import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import seedData from '../data';
import { generateId, isOverdue, calculateDueDate } from '../utils/calculations';
import {
  COLLECTIONS, fetchCollection, upsertDoc, updateDocument,
  deleteDocument, batchWriteCollection, subscribeCollection,
  migrateToFirestore,
} from '../services/firestoreService';

const DataContext = createContext();

// 시드 데이터에 _id 부여
function initializeSeed(data) {
  return {
    ledger: data.ledger.map(item => ({ ...item, _id: item._id || generateId() })),
    hospitals: data.hospitals.map(item => ({ ...item, _id: item._id || generateId() })),
    master: data.master.map(item => ({ ...item, _id: item._id || generateId() })),
    invoiceTemplate: data.invoiceTemplate,
  };
}

const SEED = initializeSeed(seedData);

export function DataProvider({ children }) {
  const [ledger, setLedger] = useLocalStorage('billing_ledger', SEED.ledger);
  const [hospitals, setHospitals] = useLocalStorage('billing_hospitals', SEED.hospitals);
  const [master, setMaster] = useLocalStorage('billing_master', SEED.master);
  const [invoiceTemplate] = useLocalStorage('billing_template', SEED.invoiceTemplate);
  const [notifiedIds, setNotifiedIds] = useLocalStorage('billing_notified', []);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);
  const notificationSent = useRef(false);
  const unsubscribes = useRef([]);

  // --- Firebase 초기화 + 실시간 구독 ---
  useEffect(() => {
    let mounted = true;

    async function initFirebase() {
      try {
        // 1. localStorage → Firestore 마이그레이션 (최초 1회)
        await migrateToFirestore();

        // 2. Firestore에서 초기 데이터 로드
        const [fbLedger, fbHospitals, fbMaster] = await Promise.all([
          fetchCollection(COLLECTIONS.LEDGER),
          fetchCollection(COLLECTIONS.HOSPITALS),
          fetchCollection(COLLECTIONS.MASTER),
        ]);

        if (!mounted) return;

        // Firestore에 데이터가 있으면 사용, 없으면 localStorage 유지
        if (fbLedger && fbLedger.length > 0) setLedger(fbLedger);
        if (fbHospitals && fbHospitals.length > 0) setHospitals(fbHospitals);
        if (fbMaster && fbMaster.length > 0) setMaster(fbMaster);

        // 3. 실시간 구독 시작 (다른 탭/사용자 변경 감지)
        const unsub1 = subscribeCollection(COLLECTIONS.LEDGER, (data) => {
          if (data.length > 0) setLedger(data);
        });
        const unsub2 = subscribeCollection(COLLECTIONS.HOSPITALS, (data) => {
          if (data.length > 0) setHospitals(data);
        });
        const unsub3 = subscribeCollection(COLLECTIONS.MASTER, (data) => {
          if (data.length > 0) setMaster(data);
        });

        unsubscribes.current = [unsub1, unsub2, unsub3];
        if (mounted) setFirebaseReady(true);
        console.log('🔥 Firebase 연결 완료');
      } catch (err) {
        console.error('Firebase 초기화 실패, localStorage 모드로 동작:', err);
        if (mounted) {
          setFirebaseError(err.message);
          setFirebaseReady(true); // 오류여도 앱은 동작하게
        }
      }
    }

    initFirebase();

    return () => {
      mounted = false;
      unsubscribes.current.forEach(fn => fn && fn());
    };
  // eslint-disable-next-line
  }, []);

  // --- Firestore 동기화 헬퍼 ---
  const syncToFirestore = useCallback(async (collectionName, id, data, action = 'upsert') => {
    try {
      if (action === 'delete') {
        await deleteDocument(collectionName, id);
      } else if (action === 'update') {
        await updateDocument(collectionName, id, data);
      } else {
        await upsertDoc(collectionName, id, data);
      }
    } catch (err) {
      console.error(`Firestore 동기화 실패 (${action} ${collectionName}/${id}):`, err);
    }
  }, []);

  // --- Ledger CRUD ---
  const addLedgerEntry = useCallback((entry) => {
    const newEntry = { ...entry, _id: generateId() };
    setLedger(prev => [...prev, newEntry]);
    syncToFirestore(COLLECTIONS.LEDGER, newEntry._id, newEntry);
  }, [setLedger, syncToFirestore]);

  const updateLedgerEntry = useCallback((id, fields) => {
    setLedger(prev => prev.map(item =>
      item._id === id ? { ...item, ...fields } : item
    ));
    syncToFirestore(COLLECTIONS.LEDGER, id, fields, 'update');
  }, [setLedger, syncToFirestore]);

  const deleteLedgerEntry = useCallback((id) => {
    setLedger(prev => prev.filter(item => item._id !== id));
    syncToFirestore(COLLECTIONS.LEDGER, id, null, 'delete');
  }, [setLedger, syncToFirestore]);

  // --- Hospital CRUD ---
  const addHospital = useCallback((hospital) => {
    const newHospital = { ...hospital, _id: generateId() };
    setHospitals(prev => [...prev, newHospital]);
    syncToFirestore(COLLECTIONS.HOSPITALS, newHospital._id, newHospital);
  }, [setHospitals, syncToFirestore]);

  const updateHospital = useCallback((id, fields) => {
    setHospitals(prev => prev.map(item =>
      item._id === id ? { ...item, ...fields } : item
    ));
    syncToFirestore(COLLECTIONS.HOSPITALS, id, fields, 'update');
  }, [setHospitals, syncToFirestore]);

  const deleteHospital = useCallback((id) => {
    setHospitals(prev => prev.filter(item => item._id !== id));
    syncToFirestore(COLLECTIONS.HOSPITALS, id, null, 'delete');
  }, [setHospitals, syncToFirestore]);

  // --- Master CRUD ---
  const addContract = useCallback((contract) => {
    const newContract = { ...contract, _id: generateId() };
    setMaster(prev => [...prev, newContract]);
    syncToFirestore(COLLECTIONS.MASTER, newContract._id, newContract);
  }, [setMaster, syncToFirestore]);

  const updateContract = useCallback((id, fields) => {
    setMaster(prev => prev.map(item =>
      item._id === id ? { ...item, ...fields } : item
    ));
    syncToFirestore(COLLECTIONS.MASTER, id, fields, 'update');
  }, [setMaster, syncToFirestore]);

  // --- 월별 자동 생성: 등록된 거래처 기준으로 빈 청구 틀 생성 ---
  const generateMonthlyEntries = useCallback((billingMonth) => {
    const existing = new Set(
      ledger
        .filter(l => l['청구기준'] === billingMonth)
        .map(l => l['거래처명'] + '||' + l['제품명'])
    );

    const newEntries = [];
    hospitals.forEach(h => {
      const key = h['거래처명'] + '||' + h['제품명'];
      if (!h['거래처명'] || existing.has(key)) return;

      const unitPrice = (h['납품가'] != null && h['납품가'] !== 0) ? h['납품가'] : (h['단가'] || 0);
      const settlementDays = parseInt(h['정산주기']) || 0;
      const dueDate = calculateDueDate(billingMonth, settlementDays);

      newEntries.push({
        _id: generateId(),
        '청구기준': billingMonth,
        '발생기준': billingMonth,
        '거래처명': h['거래처명'],
        '진료과': h['진료과'] || '',
        '제품명': h['제품명'] || 'CAS',
        '수량확정': 'FALSE',
        '계산서': 'FALSE',
        '당월발생': '0',
        '병원수량': '0',
        '차월이월': '0',
        '전월반영': '0',
        '최종건수': 0,
        '단가': unitPrice,
        '공급가': 0,
        '부가세': 0,
        '청구금액': 0,
        '정산주기': settlementDays,
        '입금예정일': dueDate,
        '실제입금일': '',
        '미수금': 0,
        '채권상태': '미청구',
        '채권연령': 0,
        '잠금': 'FALSE',
        '비고': '',
        '청구단계': (h['청구단계목록'] && h['청구단계목록'].length > 0)
          ? h['청구단계목록'].reduce((acc, s) => ({ ...acc, [s.key]: false }), {})
          : { step1: false, step2: false, step3: false, step4: false },
      });
    });

    if (newEntries.length > 0) {
      setLedger(prev => [...prev, ...newEntries]);
      // Firestore에도 일괄 저장
      batchWriteCollection(COLLECTIONS.LEDGER, newEntries).catch(console.error);
    }
    return newEntries.length;
  }, [ledger, hospitals, setLedger]);

  // --- Computed ---
  const getHospitalSummary = useCallback((hospitalName) => {
    const items = ledger.filter(l => l['거래처명'] === hospitalName);
    return {
      totalSales: items.reduce((s, i) => s + (i['청구금액'] || 0), 0),
      outstanding: items.reduce((s, i) => s + (i['미수금'] || 0), 0),
    };
  }, [ledger]);

  const getOverdueEntries = useCallback(() => {
    return ledger.filter(isOverdue);
  }, [ledger]);

  // --- 연체 브라우저 알림 ---
  useEffect(() => {
    if (notificationSent.current) return;
    const overdue = ledger.filter(isOverdue);
    const newOverdue = overdue.filter(e => !notifiedIds.includes(e._id));
    if (newOverdue.length === 0) return;

    notificationSent.current = true;

    if ('Notification' in window && Notification.permission === 'granted') {
      const totalAmt = newOverdue.reduce((s, e) => s + (e['미수금'] || 0), 0);
      new Notification('매출청구 연체 알림', {
        body: `연체 ${newOverdue.length}건 - ${totalAmt.toLocaleString()}원 미수`,
        icon: '/stamp.jpg',
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    setNotifiedIds(prev => [...prev, ...newOverdue.map(e => e._id)]);
  }, [ledger, notifiedIds, setNotifiedIds]);

  // --- 데이터 내보내기/가져오기 ---
  const exportData = useCallback(() => {
    return JSON.stringify({ ledger, hospitals, master, invoiceTemplate }, null, 2);
  }, [ledger, hospitals, master, invoiceTemplate]);

  const importData = useCallback((json) => {
    try {
      const parsed = JSON.parse(json);
      if (parsed.ledger) {
        setLedger(parsed.ledger);
        batchWriteCollection(COLLECTIONS.LEDGER, parsed.ledger).catch(console.error);
      }
      if (parsed.hospitals) {
        setHospitals(parsed.hospitals);
        batchWriteCollection(COLLECTIONS.HOSPITALS, parsed.hospitals).catch(console.error);
      }
      if (parsed.master) {
        setMaster(parsed.master);
        batchWriteCollection(COLLECTIONS.MASTER, parsed.master).catch(console.error);
      }
      return true;
    } catch {
      return false;
    }
  }, [setLedger, setHospitals, setMaster]);

  const resetToSeed = useCallback(() => {
    setLedger(SEED.ledger);
    setHospitals(SEED.hospitals);
    setMaster(SEED.master);
    setNotifiedIds([]);
    // Firestore도 시드 데이터로 덮어쓰기
    batchWriteCollection(COLLECTIONS.LEDGER, SEED.ledger).catch(console.error);
    batchWriteCollection(COLLECTIONS.HOSPITALS, SEED.hospitals).catch(console.error);
    batchWriteCollection(COLLECTIONS.MASTER, SEED.master).catch(console.error);
    // 마이그레이션 플래그 리셋
    localStorage.removeItem('billing_firebase_migrated');
  }, [setLedger, setHospitals, setMaster, setNotifiedIds]);

  const value = {
    ledger, hospitals, master, invoiceTemplate,
    addLedgerEntry, updateLedgerEntry, deleteLedgerEntry, generateMonthlyEntries,
    addHospital, updateHospital, deleteHospital,
    addContract, updateContract,
    getHospitalSummary, getOverdueEntries,
    exportData, importData, resetToSeed,
    firebaseReady, firebaseError,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}

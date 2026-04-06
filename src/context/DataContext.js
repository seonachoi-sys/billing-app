import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import seedData from '../data';
import { generateId, isOverdue, calculateDueDate } from '../utils/calculations';
import { DEFAULT_COST_SETTINGS, DEFAULT_HOSPITAL_COST } from '../utils/bepCalculations';
import {
  COLLECTIONS, fetchCollection, upsertDoc, updateDocument,
  deleteDocument, batchWriteCollection, replaceCollection,
  subscribeCollection, migrateToFirestore, saveSingleDoc,
} from '../services/firestoreService';
import { checkSeedStatus, executeSeed, SEED_COUNTS } from '../services/seedService';

const DataContext = createContext();

// --- 중복 제거 유틸 (모듈 레벨, 어디서든 재사용) ---

/** _id 기반 중복 제거 (hospitals, master 등) */
function dedup(items) {
  const seen = new Map();
  items.forEach(item => {
    if (item._id && !seen.has(item._id)) seen.set(item._id, item);
  });
  return Array.from(seen.values());
}

/** ledger 전용: 비즈니스 키(거래처+제품+청구기준) 기반 중복 제거 */
function dedupLedger(items) {
  const seen = new Map();
  items.forEach(item => {
    const bizKey = `${item['거래처명']}||${item['제품명']}||${item['청구기준']}`;
    const existing = seen.get(bizKey);
    if (!existing) {
      seen.set(bizKey, item);
    } else {
      // 더 최근에 수정된 항목 유지 (청구금액이 있는 쪽 우선, 같으면 먼저 온 것 유지)
      if ((item['청구금액'] || 0) > (existing['청구금액'] || 0)) {
        seen.set(bizKey, item);
      }
    }
  });
  return Array.from(seen.values());
}

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
  // localStorage 초기값에도 dedup 적용 (이전 세션에서 쌓인 중복 방어)
  const [ledger, setLedgerRaw] = useLocalStorage('billing_ledger', SEED.ledger);
  const [hospitals, setHospitalsRaw] = useLocalStorage('billing_hospitals', SEED.hospitals);
  const [master, setMaster] = useLocalStorage('billing_master', SEED.master);
  const [invoiceTemplate] = useLocalStorage('billing_template', SEED.invoiceTemplate);
  const [notifiedIds, setNotifiedIds] = useLocalStorage('billing_notified', []);
  const [costSettings, setCostSettings] = useLocalStorage('billing_cost_settings', { ...DEFAULT_COST_SETTINGS });
  const [hospitalCosts, setHospitalCosts] = useLocalStorage('billing_hospital_costs', {});
  const [closedMonths, setClosedMonths] = useLocalStorage('billing_closed_months', []);
  const [statsMemo, setStatsMemo] = useLocalStorage('billing_stats_memo', '');
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [reconciliation, setReconciliation] = useState([]);
  const [seedingStatus, setSeedingStatus] = useState(null); // null | { message, percent }
  const notificationSent = useRef(false);
  const unsubscribes = useRef([]);
  const isInitializing = useRef(true); // 초기화 중 구독 콜백 무시 플래그

  // --- dedup 래핑 setter (중복 방어) ---
  const setLedger = useCallback((valueOrFn) => {
    setLedgerRaw(prev => {
      const next = typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn;
      return dedupLedger(next);
    });
  }, [setLedgerRaw]);

  const setHospitals = useCallback((valueOrFn) => {
    setHospitalsRaw(prev => {
      const next = typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn;
      return dedup(next);
    });
  }, [setHospitalsRaw]);

  // --- Firebase 초기화 + 실시간 구독 ---
  useEffect(() => {
    let mounted = true;

    async function initFirebase() {
      try {
        // 1. Firestore 연결 테스트 (빠른 실패)
        const testResult = await fetchCollection(COLLECTIONS.LEDGER);
        if (testResult === null) {
          throw new Error('Firestore 연결 불가 — 보안 규칙을 확인해주세요');
        }

        if (!mounted) return;

        // 2. 시드 데이터 확인 및 실행
        const seedDone = await checkSeedStatus();
        if (!seedDone) {
          setSeedingStatus({ message: `과거 데이터를 불러오는 중... (${SEED_COUNTS.invoices}건)`, percent: 0 });
          const seedResult = await executeSeed((msg, pct) => {
            if (mounted) setSeedingStatus({ message: msg, percent: pct });
          });
          if (mounted) {
            setInvoices(seedResult.invoices);
            setReconciliation(seedResult.reconciliation);
            // hospitals는 기존 로직에서 로드됨
            setSeedingStatus(null);
          }
        } else {
          // 이미 시딩 완료 → Firestore에서 invoices/reconciliation 로드
          const [fbInvoices, fbRecon] = await Promise.all([
            fetchCollection(COLLECTIONS.INVOICES),
            fetchCollection(COLLECTIONS.RECONCILIATION),
          ]);
          if (mounted) {
            if (fbInvoices) setInvoices(fbInvoices);
            if (fbRecon) setReconciliation(fbRecon);
          }
        }

        // 3. localStorage → Firestore 마이그레이션 (최초 1회)
        await migrateToFirestore();

        // 4. Firestore에서 초기 데이터 로드
        const [fbLedger, fbHospitals, fbMaster] = await Promise.all([
          Promise.resolve(testResult), // 이미 가져온 ledger 재사용
          fetchCollection(COLLECTIONS.HOSPITALS),
          fetchCollection(COLLECTIONS.MASTER),
        ]);

        if (!mounted) return;

        // --- 동기화: Firestore가 source of truth ---
        const syncCollection = async (colName, fbData, localKey, isLedgerCol = false) => {
          if (fbData && fbData.length > 0) {
            // Firestore 데이터 기준으로 중복 제거
            const result = isLedgerCol ? dedupLedger(fbData) : dedup(fbData);
            // Firestore에 중복이 있었으면 정리
            if (result.length < fbData.length) {
              console.warn(`${colName}: ${fbData.length - result.length}건 중복 제거, Firestore 정리`);
              await replaceCollection(colName, result).catch(console.error);
            }
            return result;
          }
          // Firestore 비어있음 → localStorage에서 업로드
          const localData = JSON.parse(localStorage.getItem(localKey) || '[]');
          if (localData.length > 0) {
            const cleaned = isLedgerCol ? dedupLedger(localData) : dedup(localData);
            await batchWriteCollection(colName, cleaned).catch(console.error);
            return cleaned;
          }
          return [];
        };

        const syncedLedger = await syncCollection(COLLECTIONS.LEDGER, fbLedger, 'billing_ledger', true);

        // 병원 데이터 복구: 영문 필드명(seed 오염)이면 원래 시드로 교체
        let hospitalsToSync = fbHospitals;
        if (fbHospitals && fbHospitals.length > 0 && !fbHospitals[0]['거래처명'] && fbHospitals[0]['name']) {
          console.warn('⚠️ 병원 데이터 영문 필드 감지 — 원래 시드로 복원');
          await replaceCollection(COLLECTIONS.HOSPITALS, SEED.hospitals).catch(console.error);
          hospitalsToSync = SEED.hospitals;
        }
        const syncedHospitals = await syncCollection(COLLECTIONS.HOSPITALS, hospitalsToSync, 'billing_hospitals');
        const syncedMaster = await syncCollection(COLLECTIONS.MASTER, fbMaster, 'billing_master');

        if (syncedLedger.length > 0) setLedger(syncedLedger);
        if (syncedHospitals.length > 0) setHospitals(syncedHospitals);
        if (syncedMaster.length > 0) setMaster(syncedMaster);

        // 원가설정 로드
        const fbCostSettings = await fetchCollection(COLLECTIONS.COST_SETTINGS);
        if (fbCostSettings && fbCostSettings.length > 0) {
          const global = fbCostSettings.find(d => d._id === 'global');
          if (global) {
            const { _id, ...rest } = global;
            setCostSettings(prev => ({ ...prev, ...rest }));
          }
        }

        // 병원별 원가설정 로드
        const fbHospitalCosts = await fetchCollection(COLLECTIONS.HOSPITAL_COSTS);
        if (fbHospitalCosts && fbHospitalCosts.length > 0) {
          const costsMap = {};
          fbHospitalCosts.forEach(doc => {
            const { _id, ...rest } = doc;
            costsMap[_id] = rest;
          });
          setHospitalCosts(costsMap);
        }

        // 초기화 완료 후 구독 시작 (이 시점부터 onSnapshot 콜백 허용)
        isInitializing.current = false;

        // 4. 실시간 구독 (Firestore = source of truth)
        const unsub1 = subscribeCollection(COLLECTIONS.LEDGER, (data) => {
          if (isInitializing.current) return; // 초기화 중이면 무시
          if (data.length > 0) setLedger(dedupLedger(data));
        });
        const unsub2 = subscribeCollection(COLLECTIONS.HOSPITALS, (data) => {
          if (isInitializing.current) return;
          if (data.length > 0) setHospitals(dedup(data));
        });
        const unsub3 = subscribeCollection(COLLECTIONS.MASTER, (data) => {
          if (isInitializing.current) return;
          if (data.length > 0) setMaster(dedup(data));
        });

        unsubscribes.current = [unsub1, unsub2, unsub3];
        if (mounted) setFirebaseReady(true);
        console.log('🔥 Firebase 연결 완료');
      } catch (err) {
        console.warn('Firebase 초기화 실패, localStorage 모드로 동작:', err.message);
        isInitializing.current = false;
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

  // --- Firestore 동기화 헬퍼 (Firebase 연결 실패 시 스킵) ---
  const syncToFirestore = useCallback(async (collectionName, id, data, action = 'upsert') => {
    if (firebaseError) return; // Firebase 연결 실패 시 localStorage만 사용
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
  }, [firebaseError]);

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

    // 병원 목록에서 거래처+제품 중복 제거 (같은 조합이 여러 행이면 첫 번째만 사용)
    const seenHospitalKeys = new Set();
    const uniqueHospitalEntries = hospitals.filter(h => {
      const key = h['거래처명'] + '||' + h['제품명'];
      if (!h['거래처명'] || seenHospitalKeys.has(key)) return false;
      seenHospitalKeys.add(key);
      return true;
    });

    const newEntries = [];
    uniqueHospitalEntries.forEach(h => {
      const key = h['거래처명'] + '||' + h['제품명'];
      if (existing.has(key)) return;

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

  // --- Cost Settings CRUD ---
  const updateCostSettings = useCallback((fields) => {
    setCostSettings(prev => {
      const updated = { ...prev, ...fields };
      // Firestore에 저장 (단일 문서)
      saveSingleDoc(COLLECTIONS.COST_SETTINGS, 'global', updated).catch(console.error);
      return updated;
    });
  }, [setCostSettings]);

  const updateHospitalCost = useCallback((hospitalName, fields) => {
    setHospitalCosts(prev => {
      const current = prev[hospitalName] || { ...DEFAULT_HOSPITAL_COST };
      const updated = { ...current, ...fields };
      // Firestore에 저장 (병원명을 doc ID로)
      saveSingleDoc(COLLECTIONS.HOSPITAL_COSTS, hospitalName, updated).catch(console.error);
      return { ...prev, [hospitalName]: updated };
    });
  }, [setHospitalCosts]);

  // --- Monthly Summary 집계 (Firestore 저장) ---
  const buildMonthlySummary = useCallback(() => {
    const summary = {};
    ledger.forEach(entry => {
      const month = entry['청구기준'];
      const name = entry['거래처명'];
      if (!month || !name) return;
      const key = `${month}__${name}`;
      if (!summary[key]) {
        summary[key] = { month, hospitalName: name, revenue: 0, cases: 0, outstanding: 0 };
      }
      summary[key].revenue += entry['청구금액'] || 0;
      summary[key].cases += entry['최종건수'] || 0;
      summary[key].outstanding += entry['미수금'] || 0;
    });
    return Object.values(summary);
  }, [ledger]);

  const syncMonthlySummary = useCallback(async () => {
    if (firebaseError) return;
    const summaryData = buildMonthlySummary();
    const items = summaryData.map(s => ({
      ...s,
      _id: `${s.month}__${s.hospitalName}`,
    }));
    await replaceCollection(COLLECTIONS.MONTHLY_SUMMARY, items).catch(console.error);
  }, [buildMonthlySummary, firebaseError]);

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
        replaceCollection(COLLECTIONS.LEDGER, parsed.ledger).catch(console.error);
      }
      if (parsed.hospitals) {
        setHospitals(parsed.hospitals);
        replaceCollection(COLLECTIONS.HOSPITALS, parsed.hospitals).catch(console.error);
      }
      if (parsed.master) {
        setMaster(parsed.master);
        replaceCollection(COLLECTIONS.MASTER, parsed.master).catch(console.error);
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
    setCostSettings({ ...DEFAULT_COST_SETTINGS });
    setHospitalCosts({});
    // Firestore: 기존 문서 전부 삭제 후 시드 데이터로 교체
    replaceCollection(COLLECTIONS.LEDGER, SEED.ledger).catch(console.error);
    replaceCollection(COLLECTIONS.HOSPITALS, SEED.hospitals).catch(console.error);
    replaceCollection(COLLECTIONS.MASTER, SEED.master).catch(console.error);
    replaceCollection(COLLECTIONS.COST_SETTINGS, []).catch(console.error);
    replaceCollection(COLLECTIONS.HOSPITAL_COSTS, []).catch(console.error);
    localStorage.removeItem('billing_firebase_migrated');
  }, [setLedger, setHospitals, setMaster, setNotifiedIds, setCostSettings, setHospitalCosts]);

  const closeMonth = useCallback((month) => {
    setClosedMonths(prev => prev.includes(month) ? prev : [...prev, month]);
  }, [setClosedMonths]);

  const openMonth = useCallback((month) => {
    setClosedMonths(prev => prev.filter(m => m !== month));
  }, [setClosedMonths]);

  const isMonthClosed = useCallback((month) => {
    return closedMonths.includes(month);
  }, [closedMonths]);

  const value = {
    ledger, hospitals, master, invoiceTemplate,
    addLedgerEntry, updateLedgerEntry, deleteLedgerEntry, generateMonthlyEntries,
    addHospital, updateHospital, deleteHospital,
    addContract, updateContract,
    getHospitalSummary, getOverdueEntries,
    exportData, importData, resetToSeed,
    firebaseReady, firebaseError,
    costSettings, hospitalCosts,
    updateCostSettings, updateHospitalCost,
    buildMonthlySummary, syncMonthlySummary,
    closeMonth, openMonth, isMonthClosed,
    invoices, reconciliation, seedingStatus,
    statsMemo, setStatsMemo,
  };

  return (
    <DataContext.Provider value={value}>
      {seedingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-800 mb-2">{seedingStatus.message}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${seedingStatus.percent}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">{seedingStatus.percent}%</p>
          </div>
        </div>
      )}
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}

import React, { createContext, useContext, useCallback, useEffect, useRef } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';
import seedData from '../data';
import { generateId, isOverdue, calculateDueDate } from '../utils/calculations';

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
  const notificationSent = useRef(false);

  // --- Ledger CRUD ---
  const addLedgerEntry = useCallback((entry) => {
    setLedger(prev => [...prev, { ...entry, _id: generateId() }]);
  }, [setLedger]);

  const updateLedgerEntry = useCallback((id, fields) => {
    setLedger(prev => prev.map(item =>
      item._id === id ? { ...item, ...fields } : item
    ));
  }, [setLedger]);

  const deleteLedgerEntry = useCallback((id) => {
    setLedger(prev => prev.filter(item => item._id !== id));
  }, [setLedger]);

  // --- Hospital CRUD ---
  const addHospital = useCallback((hospital) => {
    setHospitals(prev => [...prev, { ...hospital, _id: generateId() }]);
  }, [setHospitals]);

  const updateHospital = useCallback((id, fields) => {
    setHospitals(prev => prev.map(item =>
      item._id === id ? { ...item, ...fields } : item
    ));
  }, [setHospitals]);

  const deleteHospital = useCallback((id) => {
    setHospitals(prev => prev.filter(item => item._id !== id));
  }, [setHospitals]);

  // --- Master CRUD ---
  const addContract = useCallback((contract) => {
    setMaster(prev => [...prev, { ...contract, _id: generateId() }]);
  }, [setMaster]);

  const updateContract = useCallback((id, fields) => {
    setMaster(prev => prev.map(item =>
      item._id === id ? { ...item, ...fields } : item
    ));
  }, [setMaster]);

  // --- 월별 자동 생성: 등록된 거래처 기준으로 빈 청구 틀 생성 ---
  const generateMonthlyEntries = useCallback((billingMonth) => {
    // 이미 해당 월에 생성된 거래처+제품 조합 확인
    const existing = new Set(
      ledger
        .filter(l => l['청구기준'] === billingMonth)
        .map(l => l['거래처명'] + '||' + l['제품명'])
    );

    const newEntries = [];
    hospitals.forEach(h => {
      const key = h['거래처명'] + '||' + h['제품명'];
      if (!h['거래처명'] || existing.has(key)) return;

      const unitPrice = h['단가'] || 0;
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
      if (parsed.ledger) setLedger(parsed.ledger);
      if (parsed.hospitals) setHospitals(parsed.hospitals);
      if (parsed.master) setMaster(parsed.master);
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
  }, [setLedger, setHospitals, setMaster, setNotifiedIds]);

  const value = {
    ledger, hospitals, master, invoiceTemplate,
    addLedgerEntry, updateLedgerEntry, deleteLedgerEntry, generateMonthlyEntries,
    addHospital, updateHospital, deleteHospital,
    addContract, updateContract,
    getHospitalSummary, getOverdueEntries,
    exportData, importData, resetToSeed,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}

import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { fmt, calculateDday, isOverdue } from '../utils/calculations';
import { exportToExcel } from '../utils/exportExcel';
import { mergeLedgerWithSeed } from '../utils/mergeLedger';

const Dashboard = () => {
  const { ledger: rawLedger } = useData();
  const ledger = useMemo(() => mergeLedgerWithSeed(rawLedger), [rawLedger]);

  // KPI
  const totalBilled = ledger.reduce((s, i) => s + (i['청구금액'] || 0), 0);
  const totalOutstanding = ledger.reduce((s, i) => s + (i['미수금'] || 0), 0);
  const paidCount = ledger.filter(i => i['채권상태'] === '완납').length;
  const overdueItems = ledger.filter(isOverdue);
  const collectionRate = totalBilled > 0
    ? ((1 - totalOutstanding / totalBilled) * 100).toFixed(1)
    : '0.0';

  // --- 월별 예상 입금액 ---
  const dueMap = {};
  ledger.forEach(item => {
    if (item['채권상태'] === '완납' || !item['입금예정일'] || item['미수금'] <= 0) return;
    const m = item['입금예정일'].slice(0, 7);
    if (!dueMap[m]) dueMap[m] = { amount: 0, count: 0, overdue: 0, overdueItems: [] };
    dueMap[m].amount += item['미수금'];
    dueMap[m].count += 1;
    if (isOverdue(item)) {
      dueMap[m].overdue += 1;
      dueMap[m].overdueItems.push({
        name: item['거래처명'],
        amount: item['미수금'],
        dday: calculateDday(item['입금예정일']),
      });
    }
  });
  const dueMonths = Object.keys(dueMap).sort();

  // --- 미회수 D-day ---
  const receivables = ledger
    .filter(i => i['미수금'] > 0 && i['채권상태'] !== '완납' && i['입금예정일'])
    .map(i => ({ ...i, dday: calculateDday(i['입금예정일']) }))
    .sort((a, b) => (b.dday || 0) - (a.dday || 0));

  const [tooltipMonth, setTooltipMonth] = useState(null);

  return (
    <div className="space-y-6">
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500">총 청구금액</p>
          <p className="text-2xl font-bold text-gray-800">{fmt(totalBilled)}<span className="text-sm font-normal text-gray-400">원</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500">총 미수금</p>
          <p className="text-2xl font-bold text-red-600">{fmt(totalOutstanding)}<span className="text-sm font-normal text-gray-400">원</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500">회수율</p>
          <p className={`text-2xl font-bold ${parseFloat(collectionRate) >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
            {collectionRate}<span className="text-sm font-normal text-gray-400">%</span>
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500">완납 건수</p>
          <p className="text-2xl font-bold text-green-600">{paidCount}<span className="text-sm font-normal text-gray-400">건</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500">연체 건수</p>
          <p className={`text-2xl font-bold ${overdueItems.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {overdueItems.length}<span className="text-sm font-normal text-gray-400">건</span>
          </p>
        </div>
      </div>

      {/* 월별 예상 입금 + 미회수 D-day */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b"><h3 className="text-sm font-semibold text-gray-700">월별 입금 예정</h3></div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header px-4 py-3">월</th>
                  <th className="table-header px-4 py-3 text-right">건수</th>
                  <th className="table-header px-4 py-3 text-right">예상 금액</th>
                  <th className="table-header px-4 py-3 text-right">연체</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dueMonths.map(m => (
                  <tr key={m} className={dueMap[m].overdue > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="table-cell font-medium">{m}</td>
                    <td className="table-cell text-right">{dueMap[m].count}건</td>
                    <td className="table-cell text-right font-medium">{fmt(dueMap[m].amount)}원</td>
                    <td className="table-cell text-right relative">
                      {dueMap[m].overdue > 0 && (
                        <span
                          className="badge badge-red cursor-pointer"
                          onMouseEnter={() => setTooltipMonth(m)}
                          onMouseLeave={() => setTooltipMonth(null)}
                        >
                          {dueMap[m].overdue}건
                          {tooltipMonth === m && (
                            <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-red-200 rounded-lg shadow-lg p-3 min-w-[220px] text-left"
                              onClick={e => e.stopPropagation()}>
                              <p className="text-xs font-semibold text-red-600 mb-2 border-b border-red-100 pb-1">연체 상세</p>
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {dueMap[m].overdueItems
                                  .sort((a, b) => b.dday - a.dday)
                                  .map((oi, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs gap-2">
                                    <span className="text-gray-700 truncate">{oi.name}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-gray-500">{fmt(oi.amount)}원</span>
                                      <span className="text-red-500 font-semibold">D+{oi.dday}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-[10px] text-gray-400 mt-2 pt-1 border-t border-gray-100">
                                합계 {fmt(dueMap[m].overdueItems.reduce((s, i) => s + i.amount, 0))}원
                              </p>
                            </div>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {dueMonths.length === 0 && (
                  <tr><td colSpan="4" className="table-cell text-center text-gray-400">미수금 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b"><h3 className="text-sm font-semibold text-gray-700">채권 회수 현황 (D-day)</h3></div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="table-header px-4 py-3">거래처</th>
                  <th className="table-header px-4 py-3">예정일</th>
                  <th className="table-header px-4 py-3 text-right">미수금</th>
                  <th className="table-header px-4 py-3 text-center">D-day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {receivables.slice(0, 20).map((item, i) => (
                  <tr key={i} className={item.dday > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="table-cell text-sm">{item['거래처명']}</td>
                    <td className="table-cell text-sm">{item['입금예정일']}</td>
                    <td className="table-cell text-right text-sm font-medium">{fmt(item['미수금'])}원</td>
                    <td className="table-cell text-center">
                      <span className={`badge ${item.dday > 0 ? 'badge-red' : item.dday > -7 ? 'badge-yellow' : 'badge-blue'}`}>
                        {item.dday > 0 ? `D+${item.dday}` : `D${item.dday}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 건수 대사 섹션 */}
      <ReconciliationSection />
    </div>
  );
};

// =============================================================================
// Admin vs 병원 건수 대사 — 병원별 누적
// =============================================================================
function ReconciliationSection() {
  const { reconciliation } = useData();

  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // 병원별 누적 집계
  const hospitalStats = useMemo(() => {
    const map = {};
    reconciliation.forEach(r => {
      if (!map[r.hospital]) map[r.hospital] = { hospital: r.hospital, admin: 0, hospital_: 0, diff: 0, monthSet: new Set(), unconfirmed: 0 };
      map[r.hospital].admin += r.adminQty || 0;
      map[r.hospital].hospital_ += (r.hospitalQty != null ? r.hospitalQty : 0);
      if (r.diff != null) map[r.hospital].diff += r.diff;
      map[r.hospital].monthSet.add(r.month);
      if (r.hospitalQty == null) map[r.hospital].unconfirmed += 1;
    });
    return Object.values(map)
      .map(h => ({ ...h, months: h.monthSet.size, diffRate: h.hospital_ > 0 ? ((h.diff / h.hospital_) * 100).toFixed(1) : '0.0' }))
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [reconciliation]);

  // 요약
  const totalDiff = hospitalStats.reduce((s, h) => s + Math.abs(h.diff), 0);
  const currentMonthDiff = useMemo(() =>
    reconciliation.filter(r => r.month === currentMonth && r.diff != null)
      .reduce((s, r) => s + Math.abs(r.diff), 0),
    [reconciliation, currentMonth]
  );
  const unconfirmedCount = reconciliation.filter(r => r.hospitalQty == null).length;

  // 월별 세부 데이터 (엑셀용)
  const allMonths = useMemo(() =>
    [...new Set(reconciliation.map(r => r.month))].filter(Boolean).sort(),
    [reconciliation]
  );

  const handleExport = () => {
    // 병원별 월별 매트릭스 생성 (같은 병원+월에 CAS/EXO 합산)
    const monthMap = {};
    reconciliation.forEach(r => {
      if (!monthMap[r.hospital]) monthMap[r.hospital] = {};
      const existing = monthMap[r.hospital][r.month];
      if (existing) {
        existing.admin += r.adminQty || 0;
        existing.hosp += (r.hospitalQty != null ? r.hospitalQty : 0);
        existing.diff = (existing.diff ?? 0) + (r.diff ?? 0);
      } else {
        monthMap[r.hospital][r.month] = {
          admin: r.adminQty || 0,
          hosp: r.hospitalQty != null ? r.hospitalQty : 0,
          diff: r.diff,
        };
      }
    });

    const columns = [
      { key: 'hospital', header: '거래처명', width: 25 },
      ...allMonths.flatMap(m => [
        { key: `${m}_admin`, header: `${m} Admin`, width: 10 },
        { key: `${m}_hosp`, header: `${m} 병원`, width: 10 },
        { key: `${m}_diff`, header: `${m} 차이`, width: 8 },
      ]),
      { key: 'totalAdmin', header: 'Admin 합계', width: 12 },
      { key: 'totalHosp', header: '병원 합계', width: 12 },
      { key: 'totalDiff', header: '누적 차이', width: 10 },
      { key: 'diffRate', header: '차이율(%)', width: 10 },
    ];

    const rows = hospitalStats.map(h => {
      const row = { hospital: h.hospital, totalAdmin: h.admin, totalHosp: h.hospital_, totalDiff: h.diff, diffRate: h.diffRate + '%' };
      allMonths.forEach(m => {
        const d = monthMap[h.hospital]?.[m];
        row[`${m}_admin`] = d?.admin ?? '';
        row[`${m}_hosp`] = d?.hosp ?? '';
        row[`${m}_diff`] = d?.diff ?? '';
      });
      return row;
    });
    exportToExcel(rows, columns, `건수대사_상세.xlsx`);
  };

  if (reconciliation.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">Admin vs 병원 건수 대사</h2>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">이번 달 차이</p>
          <p className={`text-2xl font-bold ${currentMonthDiff > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {currentMonthDiff}<span className="text-sm font-normal text-gray-400">건</span>
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">누적 차이</p>
          <p className="text-2xl font-bold text-gray-800">{totalDiff}<span className="text-sm font-normal text-gray-400">건</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">미확인</p>
          <p className={`text-2xl font-bold ${unconfirmedCount > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
            {unconfirmedCount}<span className="text-sm font-normal text-gray-400">건</span>
          </p>
        </div>
      </div>

      {/* 누적 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            병원별 누적 건수 대사
            <span className="ml-2 text-xs font-normal text-gray-400">차이 큰 순</span>
          </h3>
          <button onClick={handleExport} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600">
            엑셀 다운로드
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header px-4 py-3 text-left">거래처명</th>
                <th className="table-header px-3 py-3 text-right">Admin</th>
                <th className="table-header px-3 py-3 text-right">병원</th>
                <th className="table-header px-3 py-3 text-right">차이</th>
                <th className="table-header px-3 py-3 text-right">차이율</th>
                <th className="table-header px-3 py-3 text-right">개월</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {hospitalStats.map(h => (
                <tr key={h.hospital} className={`hover:bg-gray-50 ${Math.abs(h.diff) > 10 ? 'bg-orange-50' : ''}`}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {h.hospital}
                    {h.unconfirmed > 0 && (
                      <span className="ml-1.5 text-xs text-yellow-500">({h.unconfirmed}건 미확인)</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">{fmt(h.admin)}</td>
                  <td className="px-3 py-3 text-right">{fmt(h.hospital_)}</td>
                  <td className={`px-3 py-3 text-right font-bold ${
                    h.diff > 0 ? 'text-red-500' : h.diff < 0 ? 'text-green-600' : ''
                  }`}>
                    {h.diff > 0 ? '+' : ''}{h.diff}
                  </td>
                  <td className={`px-3 py-3 text-right ${
                    Math.abs(parseFloat(h.diffRate)) > 10 ? 'text-red-500 font-medium' : 'text-gray-500'
                  }`}>
                    {h.diffRate}%
                  </td>
                  <td className="px-3 py-3 text-right text-gray-500">{h.months}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

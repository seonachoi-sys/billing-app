import React from 'react';
import { useData } from '../context/DataContext';
import { fmt, calculateDday, isOverdue } from '../utils/calculations';

const Dashboard = () => {
  const { ledger } = useData();

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
    if (!dueMap[m]) dueMap[m] = { amount: 0, count: 0, overdue: 0 };
    dueMap[m].amount += item['미수금'];
    dueMap[m].count += 1;
    if (isOverdue(item)) dueMap[m].overdue += 1;
  });
  const dueMonths = Object.keys(dueMap).sort();

  // --- 미회수 D-day ---
  const receivables = ledger
    .filter(i => i['미수금'] > 0 && i['채권상태'] !== '완납' && i['입금예정일'])
    .map(i => ({ ...i, dday: calculateDday(i['입금예정일']) }))
    .sort((a, b) => (b.dday || 0) - (a.dday || 0));

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
                    <td className="table-cell text-right">
                      {dueMap[m].overdue > 0 && <span className="badge badge-red">{dueMap[m].overdue}건</span>}
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
    </div>
  );
};

export default Dashboard;

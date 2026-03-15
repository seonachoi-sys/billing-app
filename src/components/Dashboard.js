import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useData } from '../context/DataContext';
import { fmt, calculateDday, isOverdue } from '../utils/calculations';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Dashboard = () => {
  const { ledger, hospitals, getHospitalSummary } = useData();

  // KPI
  const totalBilled = ledger.reduce((s, i) => s + (i['청구금액'] || 0), 0);
  const totalOutstanding = ledger.reduce((s, i) => s + (i['미수금'] || 0), 0);
  const paidCount = ledger.filter(i => i['채권상태'] === '완납').length;
  const overdueItems = ledger.filter(isOverdue);

  // --- 청구기준 vs 발생기준 월별 매출 ---
  const monthMap = {};
  ledger.forEach(item => {
    const bm = item['청구기준'];
    const om = item['발생기준'];
    const amt = item['청구금액'] || 0;
    if (bm) {
      if (!monthMap[bm]) monthMap[bm] = { 청구기준: 0, 발생기준: 0 };
      monthMap[bm]['청구기준'] += amt;
    }
    if (om) {
      if (!monthMap[om]) monthMap[om] = { 청구기준: 0, 발생기준: 0 };
      monthMap[om]['발생기준'] += amt;
    }
  });
  const revenueChart = Object.keys(monthMap).sort().map(month => ({
    month, 청구기준: monthMap[month]['청구기준'], 발생기준: monthMap[month]['발생기준'],
  }));

  // --- CAS vs EXO 제품별 월별 ---
  const productMap = {};
  ledger.forEach(item => {
    const m = item['청구기준'];
    const p = item['제품명'];
    const amt = item['청구금액'] || 0;
    if (!m || !p) return;
    if (!productMap[m]) productMap[m] = { CAS: 0, EXO: 0 };
    productMap[m][p] = (productMap[m][p] || 0) + amt;
  });
  const productChart = Object.keys(productMap).sort().map(month => ({
    month, CAS: productMap[month].CAS || 0, EXO: productMap[month].EXO || 0,
  }));

  // --- 채권상태 분포 ---
  const statusMap = {};
  ledger.forEach(item => {
    const s = item['채권상태'] || '기타';
    statusMap[s] = (statusMap[s] || 0) + 1;
  });
  const statusData = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

  // --- 월별 예상 입금액 ---
  const dueMap = {};
  ledger.forEach(item => {
    if (item['채권상태'] === '완납' || !item['입금예정일'] || item['미수금'] <= 0) return;
    const m = item['입금예정일'].slice(0, 7); // YYYY-MM
    if (!dueMap[m]) dueMap[m] = { amount: 0, count: 0, overdue: 0 };
    dueMap[m].amount += item['미수금'];
    dueMap[m].count += 1;
    if (isOverdue(item)) dueMap[m].overdue += 1;
  });
  const dueMonths = Object.keys(dueMap).sort();

  // --- 병원별 요약 (월별 + 기준 필터) ---
  const allMonths = [...new Set(ledger.flatMap(l => [l['청구기준'], l['발생기준']]))].filter(Boolean).sort();
  const uniqueNames = [...new Set(hospitals.map(h => h['거래처명']))];

  // --- 미회수 D-day ---
  const receivables = ledger
    .filter(i => i['미수금'] > 0 && i['채권상태'] !== '완납' && i['입금예정일'])
    .map(i => ({ ...i, dday: calculateDday(i['입금예정일']) }))
    .sort((a, b) => (b.dday || 0) - (a.dday || 0));

  return (
    <div className="space-y-6">
      {/* KPI 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">총 청구금액</p>
          <p className="text-2xl font-bold text-gray-800">{fmt(totalBilled)}원</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">총 미수금</p>
          <p className="text-2xl font-bold text-red-600">{fmt(totalOutstanding)}원</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">완납 건수</p>
          <p className="text-2xl font-bold text-green-600">{paidCount}건</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">연체 건수</p>
          <p className={`text-2xl font-bold ${overdueItems.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {overdueItems.length}건
          </p>
        </div>
      </div>

      {/* 매출 차트 + 채권상태 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-5">
          <h3 className="text-base font-semibold text-gray-700 mb-4">청구기준 vs 발생기준 매출</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => `${fmt(v)}원`} />
              <Legend />
              <Bar dataKey="청구기준" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="발생기준" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-base font-semibold text-gray-700 mb-4">채권상태 분포</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                label={({ name, value }) => `${name} ${value}`}>
                {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 제품별 매출 */}
      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="text-base font-semibold text-gray-700 mb-4">제품별 매출 (CAS vs EXO)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={productChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={v => `${fmt(v)}원`} />
            <Legend />
            <Bar dataKey="CAS" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="EXO" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 월별 예상 입금 + 미회수 D-day */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 월별 예상 입금 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b"><h3 className="text-base font-semibold text-gray-700">월별 입금 예정</h3></div>
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

        {/* 미회수 D-day */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-4 border-b"><h3 className="text-base font-semibold text-gray-700">채권 회수 현황 (D-day)</h3></div>
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

      {/* 병원별 요약 (월별 + 청구/발생 기준 필터) */}
      <HospitalSummaryTable ledger={ledger} uniqueNames={uniqueNames} allMonths={allMonths} hospitals={hospitals} />
    </div>
  );
};

// 상급종합병원 키워드 목록 (보건복지부 기준 자동 분류용)
const TERTIARY_KEYWORDS = [
  '대학교', '대학병원', '의과대학', '서울성모', '세브란스', '백병원',
  '울산대', '인하대', '단국대', '가톨릭대', '원광대',
];

function classifyHospital(name) {
  return TERTIARY_KEYWORDS.some(kw => name.includes(kw)) ? '상급' : '로컬';
}

// 병원별 청구 요약 (월별 + 청구/발생 기준 + 제품 + 병원구분 필터)
function HospitalSummaryTable({ ledger, uniqueNames, allMonths, hospitals }) {
  const [basisType, setBasisType] = useState('청구기준');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // 병원명 → 병원구분 매핑 (hospitals 데이터 우선, 없으면 자동 분류)
  const hospitalTypeMap = {};
  hospitals.forEach(h => {
    if (h['거래처명'] && h['병원구분']) hospitalTypeMap[h['거래처명']] = h['병원구분'];
  });
  const getType = (name) => hospitalTypeMap[name] || classifyHospital(name);

  const filteredLedger = ledger.filter(item => {
    if (selectedMonth && item[basisType] !== selectedMonth) return false;
    if (productFilter && item['제품명'] !== productFilter) return false;
    if (typeFilter && getType(item['거래처명']) !== typeFilter) return false;
    return true;
  });

  // 병원+제품 단위로 집계
  const summaryMap = {};
  filteredLedger.forEach(item => {
    const key = item['거래처명'] + '||' + item['제품명'];
    if (!summaryMap[key]) {
      summaryMap[key] = {
        name: item['거래처명'],
        product: item['제품명'],
        type: getType(item['거래처명']),
        이용건수: 0,
        청구금액: 0,
      };
    }
    summaryMap[key].이용건수 += (item['최종건수'] || 0);
    summaryMap[key].청구금액 += (item['청구금액'] || 0);
  });

  const summary = Object.values(summaryMap)
    .filter(h => h.이용건수 > 0)
    .sort((a, b) => b.청구금액 - a.청구금액);

  const totalAll = summary.reduce((s, h) => s + h.청구금액, 0);

  // 제품별 소계
  const casSub = summary.filter(h => h.product === 'CAS').reduce((s, h) => s + h.청구금액, 0);
  const exoSub = summary.filter(h => h.product === 'EXO').reduce((s, h) => s + h.청구금액, 0);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-4 border-b space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-700">병원별 청구 요약</h3>
          <span className="text-xs text-gray-400">
            합계 {fmt(totalAll)}원
            {!productFilter && <> (CAS {fmt(casSub)}원 / EXO {fmt(exoSub)}원)</>}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 청구/발생 기준 */}
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <button onClick={() => setBasisType('청구기준')}
              className={`px-3 py-1.5 text-xs font-medium rounded ${
                basisType === '청구기준' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
              청구기준
            </button>
            <button onClick={() => setBasisType('발생기준')}
              className={`px-3 py-1.5 text-xs font-medium rounded ${
                basisType === '발생기준' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
              발생기준
            </button>
          </div>
          {/* 월 */}
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-xs">
            <option value="">전체 월</option>
            {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {/* 제품 */}
          <div className="flex bg-gray-100 rounded-md p-0.5">
            {['', 'CAS', 'EXO'].map(p => (
              <button key={p} onClick={() => setProductFilter(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded ${
                  productFilter === p ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
                {p || '전체'}
              </button>
            ))}
          </div>
          {/* 병원구분 */}
          <div className="flex bg-gray-100 rounded-md p-0.5">
            {['', '상급', '로컬'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded ${
                  typeFilter === t ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
                {t || '전체'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-header px-4 py-3">병원명</th>
              <th className="table-header px-4 py-3 text-center">구분</th>
              <th className="table-header px-4 py-3 text-center">제품</th>
              <th className="table-header px-4 py-3 text-right">이용건수</th>
              <th className="table-header px-4 py-3 text-right">청구금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {summary.map((h, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="table-cell font-medium">{h.name}</td>
                <td className="table-cell text-center">
                  <span className={`badge ${h.type === '상급' ? 'badge-blue' : 'badge-gray'}`}>{h.type}</span>
                </td>
                <td className="table-cell text-center">
                  <span className={`badge ${h.product === 'CAS' ? 'badge-green' : 'badge-yellow'}`}>{h.product}</span>
                </td>
                <td className="table-cell text-right">{fmt(h.이용건수)}</td>
                <td className="table-cell text-right">{fmt(h.청구금액)}원</td>
              </tr>
            ))}
            {summary.length === 0 && (
              <tr><td colSpan="5" className="table-cell text-center text-gray-400">데이터 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;

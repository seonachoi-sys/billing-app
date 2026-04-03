import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useData } from '../context/DataContext';
import { fmt } from '../utils/calculations';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];

const SharedStats = () => {
  const { ledger, firebaseReady, firebaseError } = useData();

  const [hospitalFilter, setHospitalFilter] = useState('');
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [productFilter, setProductFilter] = useState('');

  const allMonths = useMemo(() =>
    [...new Set(ledger.map(l => l['청구기준']))].filter(Boolean).sort(),
    [ledger]
  );
  const allHospitals = useMemo(() =>
    [...new Set(ledger.map(l => l['거래처명']))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko')),
    [ledger]
  );
  const allProducts = useMemo(() =>
    [...new Set(ledger.map(l => l['제품명']))].filter(Boolean).sort(),
    [ledger]
  );

  const filtered = useMemo(() => {
    return ledger.filter(item => {
      if (hospitalFilter && item['거래처명'] !== hospitalFilter) return false;
      if (productFilter && item['제품명'] !== productFilter) return false;
      const m = item['청구기준'];
      if (monthFrom && m < monthFrom) return false;
      if (monthTo && m > monthTo) return false;
      return true;
    });
  }, [ledger, hospitalFilter, productFilter, monthFrom, monthTo]);

  const totalCount = filtered.length;
  const totalAmount = filtered.reduce((s, i) => s + (i['청구금액'] || 0), 0);
  const totalCases = filtered.reduce((s, i) => s + (i['최종건수'] || 0), 0);
  const totalOutstanding = filtered.reduce((s, i) => s + (i['미수금'] || 0), 0);
  const uniqueHospitalCount = new Set(filtered.map(i => i['거래처명'])).size;
  const paidCount = filtered.filter(i => i['채권상태'] === '완납').length;
  const collectionRate = totalAmount > 0 ? ((1 - totalOutstanding / totalAmount) * 100).toFixed(1) : '0.0';

  // 월별 청구 추이
  const monthlyTrend = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const m = item['청구기준'];
      if (!m) return;
      if (!map[m]) map[m] = { month: m, 건수: 0, 금액: 0, 이용건수: 0 };
      map[m].건수 += 1;
      map[m].금액 += item['청구금액'] || 0;
      map[m].이용건수 += item['최종건수'] || 0;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  // 병원별 청구 현황
  const hospitalStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const name = item['거래처명'];
      if (!name) return;
      if (!map[name]) map[name] = { name, 건수: 0, 금액: 0, 이용건수: 0, 미수금: 0 };
      map[name].건수 += 1;
      map[name].금액 += item['청구금액'] || 0;
      map[name].이용건수 += item['최종건수'] || 0;
      map[name].미수금 += item['미수금'] || 0;
    });
    return Object.values(map).sort((a, b) => b.금액 - a.금액);
  }, [filtered]);

  // 제품별 청구 현황
  const productStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const p = item['제품명'] || '기타';
      if (!map[p]) map[p] = { name: p, 건수: 0, 금액: 0, 이용건수: 0 };
      map[p].건수 += 1;
      map[p].금액 += item['청구금액'] || 0;
      map[p].이용건수 += item['최종건수'] || 0;
    });
    return Object.values(map).sort((a, b) => b.금액 - a.금액);
  }, [filtered]);

  // 채권상태 분포
  const statusData = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const s = item['채권상태'] || '기타';
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const hasFilter = hospitalFilter || monthFrom || monthTo || productFilter;
  const resetFilters = () => { setHospitalFilter(''); setMonthFrom(''); setMonthTo(''); setProductFilter(''); };

  if (!firebaseReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              매출청구 통계 대시보드
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">㈜타이로스코프 · Glandy CAS / EXO · 읽기 전용</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
              firebaseError ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${firebaseError ? 'bg-yellow-500' : 'bg-green-500'}`} />
              {firebaseError ? 'localStorage 모드' : '실시간 동기화'}
            </div>
            <span className="text-xs text-gray-300">
              {new Date().toLocaleDateString('ko-KR')} 기준
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* 필터 */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">거래처</label>
              <select value={hospitalFilter} onChange={e => setHospitalFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[180px]">
                <option value="">전체 거래처</option>
                {allHospitals.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">기간 (시작)</label>
              <select value={monthFrom} onChange={e => setMonthFrom(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option value="">전체</option>
                {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">기간 (종료)</label>
              <select value={monthTo} onChange={e => setMonthTo(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option value="">전체</option>
                {allMonths.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">제품</label>
              <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option value="">전체 제품</option>
                {allProducts.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {hasFilter && (
              <button onClick={resetFilters}
                className="px-3 py-2 text-sm text-gray-500 hover:text-red-500 border border-gray-300 rounded-md hover:border-red-300">
                필터 초기화
              </button>
            )}
          </div>
        </div>

        {/* KPI 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">총 청구 건수</p>
            <p className="text-2xl font-bold text-gray-800">{totalCount}<span className="text-sm font-normal text-gray-400">건</span></p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">총 이용 건수</p>
            <p className="text-2xl font-bold text-blue-600">{fmt(totalCases)}<span className="text-sm font-normal text-gray-400">건</span></p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">총 청구 금액</p>
            <p className="text-2xl font-bold text-gray-800">{fmt(totalAmount)}<span className="text-sm font-normal text-gray-400">원</span></p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">미수금</p>
            <p className={`text-2xl font-bold ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(totalOutstanding)}<span className="text-sm font-normal text-gray-400">원</span></p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">회수율</p>
            <p className={`text-2xl font-bold ${parseFloat(collectionRate) >= 80 ? 'text-green-600' : 'text-yellow-600'}`}>
              {collectionRate}<span className="text-sm font-normal text-gray-400">%</span>
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">완납 / 거래처</p>
            <p className="text-2xl font-bold text-green-600">{paidCount}<span className="text-sm font-normal text-gray-400"> / {uniqueHospitalCount}곳</span></p>
          </div>
        </div>

        {/* 차트 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">월별 청구 금액 추이</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={v => `${fmt(v)}원`} />
                <Bar dataKey="금액" fill="#3b82f6" radius={[4, 4, 0, 0]} name="청구 금액" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">월별 이용건수 추이</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="이용건수" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="이용 건수" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">제품별 청구 금액</h3>
            {productStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={productStats} dataKey="금액" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {productStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => `${fmt(v)}원`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">채권상태 분포</h3>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                    label={({ name, value }) => `${name} ${value}`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>
            )}
          </div>
        </div>

        {/* 제품별 요약 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-700">제품별 청구 현황</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['제품', '청구 건수', '이용 건수', '청구 금액', '비율'].map(h => (
                    <th key={h} className="table-header px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productStats.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">
                      <span className={`badge ${p.name === 'CAS' ? 'badge-blue' : 'badge-yellow'}`}>{p.name}</span>
                    </td>
                    <td className="table-cell text-right">{p.건수}건</td>
                    <td className="table-cell text-right">{fmt(p.이용건수)}건</td>
                    <td className="table-cell text-right font-medium">{fmt(p.금액)}원</td>
                    <td className="table-cell text-right text-gray-500">
                      {totalAmount > 0 ? `${((p.금액 / totalAmount) * 100).toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 병원별 청구 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">병원별 청구 현황</h3>
            <span className="text-xs text-gray-400">{hospitalStats.length}개 거래처</span>
          </div>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {['순위', '거래처명', '청구 건수', '이용 건수', '청구 금액', '미수금', '비율'].map(h => (
                    <th key={h} className="table-header px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {hospitalStats.map((h, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="table-cell text-center text-gray-400 text-xs">{i + 1}</td>
                    <td className="table-cell font-medium">{h.name}</td>
                    <td className="table-cell text-right">{h.건수}건</td>
                    <td className="table-cell text-right">{fmt(h.이용건수)}건</td>
                    <td className="table-cell text-right font-medium">{fmt(h.금액)}원</td>
                    <td className={`table-cell text-right ${h.미수금 > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                      {h.미수금 > 0 ? `${fmt(h.미수금)}원` : '-'}
                    </td>
                    <td className="table-cell text-right text-gray-500">
                      {totalAmount > 0 ? `${((h.금액 / totalAmount) * 100).toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 병원별 청구 금액 바 차트 */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">병원별 청구 금액 (상위 10)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={hospitalStats.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `${fmt(v)}원`} />
              <Bar dataKey="금액" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="청구 금액" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          ㈜타이로스코프 매출청구 관리 · 읽기 전용 통계 페이지
        </div>
      </footer>
    </div>
  );
};

export default SharedStats;

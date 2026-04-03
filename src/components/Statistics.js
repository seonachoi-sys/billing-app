import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useData } from '../context/DataContext';
import { fmt } from '../utils/calculations';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];

const Statistics = () => {
  const { ledger, hospitals } = useData();

  // --- 필터 상태 ---
  const [hospitalFilter, setHospitalFilter] = useState('');
  const [monthFrom, setMonthFrom] = useState('');
  const [monthTo, setMonthTo] = useState('');
  const [productFilter, setProductFilter] = useState('');

  // 고유 값 목록
  const allMonths = useMemo(() =>
    [...new Set(ledger.map(l => l['청구기준']))].filter(Boolean).sort(),
    [ledger]
  );
  const allHospitals = useMemo(() =>
    [...new Set(ledger.map(l => l['거래처명']))].filter(Boolean).sort(),
    [ledger]
  );
  const allProducts = useMemo(() =>
    [...new Set(ledger.map(l => l['제품명']))].filter(Boolean).sort(),
    [ledger]
  );

  // --- 필터 적용 ---
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

  // --- 요약 KPI ---
  const totalCount = filtered.length;
  const totalAmount = filtered.reduce((s, i) => s + (i['청구금액'] || 0), 0);
  const totalCases = filtered.reduce((s, i) => s + (i['최종건수'] || 0), 0);
  const uniqueHospitalCount = new Set(filtered.map(i => i['거래처명'])).size;
  const avgPerHospital = uniqueHospitalCount > 0 ? Math.round(totalAmount / uniqueHospitalCount) : 0;

  // --- 1) 월별 청구 추이 ---
  const monthlyTrend = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const m = item['청구기준'];
      if (!m) return;
      if (!map[m]) map[m] = { month: m, 건수: 0, 금액: 0 };
      map[m].건수 += 1;
      map[m].금액 += item['청구금액'] || 0;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  // --- 2) 병원별 청구 현황 ---
  const hospitalStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const name = item['거래처명'];
      if (!name) return;
      if (!map[name]) map[name] = { name, 건수: 0, 금액: 0, 이용건수: 0 };
      map[name].건수 += 1;
      map[name].금액 += item['청구금액'] || 0;
      map[name].이용건수 += item['최종건수'] || 0;
    });
    return Object.values(map).sort((a, b) => b.금액 - a.금액);
  }, [filtered]);

  // --- 3) 제품별 청구 현황 ---
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

  // --- 4) 병원별 × 월별 교차 테이블 ---
  const crossTable = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const name = item['거래처명'];
      const m = item['청구기준'];
      if (!name || !m) return;
      const key = name + '||' + m;
      if (!map[key]) map[key] = { name, month: m, product: item['제품명'], 건수: 0, 이용건수: 0, 금액: 0 };
      map[key].건수 += 1;
      map[key].이용건수 += item['최종건수'] || 0;
      map[key].금액 += item['청구금액'] || 0;
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month) || b.금액 - a.금액);
  }, [filtered]);

  // 필터 초기화
  const resetFilters = () => {
    setHospitalFilter('');
    setMonthFrom('');
    setMonthTo('');
    setProductFilter('');
  };

  const hasFilter = hospitalFilter || monthFrom || monthTo || productFilter;

  return (
    <div className="space-y-6">
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

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          <p className="text-xs text-gray-500">거래처 수</p>
          <p className="text-2xl font-bold text-green-600">{uniqueHospitalCount}<span className="text-sm font-normal text-gray-400">곳</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">거래처당 평균</p>
          <p className="text-2xl font-bold text-gray-700">{fmt(avgPerHospital)}<span className="text-sm font-normal text-gray-400">원</span></p>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 월별 청구 추이 (금액) */}
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

        {/* 월별 청구 추이 (건수) */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">월별 청구 건수 추이</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="건수" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="청구 건수" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 제품별 청구 (파이) */}
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

        {/* 병원별 청구 금액 (수평 바) */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">병원별 청구 금액 (상위 10)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hospitalStats.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `${fmt(v)}원`} />
              <Bar dataKey="금액" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="청구 금액" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 제품별 요약 테이블 */}
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
                {['순위', '거래처명', '청구 건수', '이용 건수', '청구 금액', '비율'].map(h => (
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
                  <td className="table-cell text-right text-gray-500">
                    {totalAmount > 0 ? `${((h.금액 / totalAmount) * 100).toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 상세 교차 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">상세 데이터 (거래처 × 월별)</h3>
          <span className="text-xs text-gray-400">{crossTable.length}건</span>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {['청구기준', '거래처명', '제품', '청구 건수', '이용 건수', '청구 금액'].map(h => (
                  <th key={h} className="table-header px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {crossTable.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="table-cell text-sm">{row.month}</td>
                  <td className="table-cell font-medium text-sm">{row.name}</td>
                  <td className="table-cell text-center">
                    <span className={`badge ${row.product === 'CAS' ? 'badge-blue' : 'badge-yellow'}`}>{row.product}</span>
                  </td>
                  <td className="table-cell text-right">{row.건수}건</td>
                  <td className="table-cell text-right">{fmt(row.이용건수)}건</td>
                  <td className="table-cell text-right font-medium">{fmt(row.금액)}원</td>
                </tr>
              ))}
              {crossTable.length === 0 && (
                <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-8">조건에 맞는 데이터가 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Statistics;

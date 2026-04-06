import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useData } from '../context/DataContext';
import { fmt } from '../utils/calculations';
import { exportToExcel, exportMultiSheet } from '../utils/exportExcel';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];

const Statistics = () => {
  const { invoices, hospitals } = useData();

  // --- 필터 ---
  const [productFilter, setProductFilter] = useState('');
  const [activeSection, setActiveSection] = useState('qty');

  const allHospitals = useMemo(() =>
    [...new Set(invoices.map(i => i.hospital))].filter(Boolean).sort(),
    [invoices]
  );

  // 병원→영업담당자 매핑
  const hospitalSalesRepMap = useMemo(() => {
    const map = {};
    hospitals.forEach(h => {
      if (h.name && h.salesRep) map[h.name] = h.salesRep;
    });
    return map;
  }, [hospitals]);

  // 제품 필터만 적용
  const filtered = useMemo(() => {
    if (!productFilter) return invoices;
    return invoices.filter(item => item.product === productFilter);
  }, [invoices, productFilter]);

  // --- KPI ---
  const totalCount = filtered.length;
  const totalAmount = filtered.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalCases = filtered.reduce((s, i) => s + (i.finalQty || 0), 0);
  const uniqueHospitalCount = new Set(filtered.map(i => i.hospital)).size;
  const avgPerHospital = uniqueHospitalCount > 0 ? Math.round(totalAmount / uniqueHospitalCount) : 0;

  const tabs = [
    { key: 'qty', label: '병원별 청구 건수' },
    { key: 'revenue', label: '병원별 매출' },
    { key: 'salesRep', label: '영업담당자별 실적' },
    { key: 'detail', label: '거래처별 상세' },
  ];

  return (
    <div className="space-y-6">
      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">제품</label>
            <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="">전체 제품</option>
              <option value="CAS">CAS</option>
              <option value="EXO">EXO</option>
            </select>
          </div>
          {productFilter && (
            <button onClick={() => setProductFilter('')}
              className="px-3 py-2 text-sm text-gray-500 hover:text-red-500 border border-gray-300 rounded-md hover:border-red-300">
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* KPI 카드 */}
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

      {/* 섹션 탭 */}
      <div className="flex gap-1 bg-white rounded-lg shadow p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveSection(t.key)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${activeSection === t.key ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeSection === 'qty' && <HospitalQtySection data={filtered} />}
      {activeSection === 'revenue' && <HospitalRevenueSection data={filtered} />}
      {activeSection === 'salesRep' && <SalesRepSection data={filtered} salesRepMap={hospitalSalesRepMap} hospitals={hospitals} />}
      {activeSection === 'detail' && <HospitalDetailSection data={filtered} allHospitals={allHospitals} hospitals={hospitals} salesRepMap={hospitalSalesRepMap} />}
    </div>
  );
};

// =============================================================================
// 연도 탭 공통 훅
// =============================================================================
function useYearTab(data) {
  const years = useMemo(() =>
    [...new Set(data.map(i => (i.occurrenceMonth || '').slice(0, 4)))].filter(Boolean).sort(),
    [data]
  );
  const [selectedYear, setSelectedYear] = useState(() => years[years.length - 1] || '');

  const yearData = useMemo(() =>
    selectedYear ? data.filter(i => (i.occurrenceMonth || '').startsWith(selectedYear)) : data,
    [data, selectedYear]
  );

  const months = useMemo(() =>
    [...new Set(yearData.map(i => i.occurrenceMonth))].filter(Boolean).sort(),
    [yearData]
  );

  return { years, selectedYear, setSelectedYear, yearData, months };
}

function YearTabs({ years, selectedYear, onChange }) {
  return (
    <div className="flex gap-1">
      {years.map(y => (
        <button key={y} onClick={() => onChange(y)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
            ${selectedYear === y ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {y}년
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// 3-1. 병원별 청구 건수
// =============================================================================
function HospitalQtySection({ data }) {
  const { years, selectedYear, setSelectedYear, yearData, months } = useYearTab(data);

  const hospitalStats = useMemo(() => {
    const map = {};
    yearData.forEach(item => {
      const h = item.hospital;
      if (!h) return;
      if (!map[h]) map[h] = { hospital: h, total: 0, months: {} };
      const qty = item.finalQty || 0;
      map[h].months[item.occurrenceMonth] = (map[h].months[item.occurrenceMonth] || 0) + qty;
      map[h].total += qty;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [yearData]);

  const grandTotal = hospitalStats.reduce((s, h) => s + h.total, 0);

  const handleExport = () => {
    const columns = [
      { key: 'rank', header: '순위', width: 6 },
      { key: 'hospital', header: '거래처명', width: 25 },
      ...months.map(m => ({ key: m, header: m, width: 10 })),
      { key: 'total', header: '합계', width: 10 },
    ];
    const rows = hospitalStats.map((h, i) => {
      const row = { rank: i + 1, hospital: h.hospital, total: h.total };
      months.forEach(m => { row[m] = h.months[m] || 0; });
      return row;
    });
    exportToExcel(rows, columns, `병원별청구건수_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* 연도 탭 + 차트 */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">병원별 청구 건수 (상위 10)</h3>
          <YearTabs years={years} selectedYear={selectedYear} onChange={setSelectedYear} />
        </div>
        {hospitalStats.length > 0 && (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hospitalStats.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="hospital" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `${v}건`} />
              <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} name="건수" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            {selectedYear}년 병원별 청구 건수
            <span className="ml-2 text-xs font-normal text-gray-400">{hospitalStats.length}개 거래처</span>
          </h3>
          <button onClick={handleExport} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600">
            엑셀 다운로드
          </button>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="table-header px-3 py-2 text-center w-10">순위</th>
                <th className="table-header px-3 py-2 text-left">거래처명</th>
                {months.map(m => (
                  <th key={m} className="table-header px-3 py-2 text-right">{m.slice(5)}월</th>
                ))}
                <th className="table-header px-3 py-2 text-right font-bold">합계</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {hospitalStats.map((h, i) => (
                <tr key={h.hospital} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{h.hospital}</td>
                  {months.map(m => (
                    <td key={m} className={`px-3 py-2 text-right ${h.months[m] ? '' : 'text-gray-300'}`}>
                      {h.months[m] || 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-bold">{h.total}</td>
                </tr>
              ))}
              <tr className="bg-blue-50 font-bold">
                <td className="px-3 py-2" />
                <td className="px-3 py-2">합계</td>
                {months.map(m => {
                  const mTotal = hospitalStats.reduce((s, h) => s + (h.months[m] || 0), 0);
                  return <td key={m} className="px-3 py-2 text-right">{mTotal}</td>;
                })}
                <td className="px-3 py-2 text-right">{grandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 3-2. 병원별 매출
// =============================================================================
function HospitalRevenueSection({ data }) {
  const { years, selectedYear, setSelectedYear, yearData, months } = useYearTab(data);

  const hospitalStats = useMemo(() => {
    const map = {};
    yearData.forEach(item => {
      const h = item.hospital;
      if (!h) return;
      if (!map[h]) map[h] = { hospital: h, total: 0, months: {} };
      const amt = item.totalAmount || 0;
      map[h].months[item.occurrenceMonth] = (map[h].months[item.occurrenceMonth] || 0) + amt;
      map[h].total += amt;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [yearData]);

  const grandTotal = hospitalStats.reduce((s, h) => s + h.total, 0);
  const fmtMan = (v) => v >= 10000 ? `${(v / 10000).toFixed(1)}만` : fmt(v);

  // 제품별 분포 (파이차트)
  const productStats = useMemo(() => {
    const map = {};
    yearData.forEach(item => {
      const p = item.product || '기타';
      if (!map[p]) map[p] = { name: p, value: 0 };
      map[p].value += item.totalAmount || 0;
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [yearData]);

  const handleExport = () => {
    const columns = [
      { key: 'rank', header: '순위', width: 6 },
      { key: 'hospital', header: '거래처명', width: 25 },
      ...months.map(m => ({ key: m, header: m, width: 12 })),
      { key: 'total', header: '합계', width: 15 },
      { key: 'pct', header: '비율', width: 8 },
    ];
    const rows = hospitalStats.map((h, i) => {
      const row = { rank: i + 1, hospital: h.hospital, total: h.total,
        pct: grandTotal > 0 ? `${((h.total / grandTotal) * 100).toFixed(1)}%` : '-' };
      months.forEach(m => { row[m] = h.months[m] || 0; });
      return row;
    });
    exportToExcel(rows, columns, `병원별매출_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 병원별 매출 상위 10 */}
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">병원별 매출 (상위 10)</h3>
            <YearTabs years={years} selectedYear={selectedYear} onChange={setSelectedYear} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hospitalStats.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={v => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="hospital" width={130} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => `${fmt(v)}원`} />
              <Bar dataKey="total" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="매출" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 제품별 파이 */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{selectedYear}년 제품별 매출 비율</h3>
          {productStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={productStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
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
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            {selectedYear}년 병원별 매출 현황
            <span className="ml-2 text-xs font-normal text-gray-400">{hospitalStats.length}개 거래처</span>
          </h3>
          <button onClick={handleExport} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600">
            엑셀 다운로드
          </button>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="table-header px-3 py-2 text-center w-10">순위</th>
                <th className="table-header px-3 py-2 text-left">거래처명</th>
                {months.map(m => (
                  <th key={m} className="table-header px-3 py-2 text-right">{m.slice(5)}월</th>
                ))}
                <th className="table-header px-3 py-2 text-right font-bold">합계</th>
                <th className="table-header px-3 py-2 text-right">비율</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {hospitalStats.map((h, i) => (
                <tr key={h.hospital} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{h.hospital}</td>
                  {months.map(m => (
                    <td key={m} className={`px-3 py-2 text-right ${h.months[m] ? '' : 'text-gray-300'}`}>
                      {h.months[m] ? fmtMan(h.months[m]) : '-'}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-bold">{fmtMan(h.total)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {grandTotal > 0 ? `${((h.total / grandTotal) * 100).toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
              <tr className="bg-blue-50 font-bold">
                <td className="px-3 py-2" />
                <td className="px-3 py-2">합계</td>
                {months.map(m => {
                  const mTotal = hospitalStats.reduce((s, h) => s + (h.months[m] || 0), 0);
                  return <td key={m} className="px-3 py-2 text-right">{fmtMan(mTotal)}</td>;
                })}
                <td className="px-3 py-2 text-right">{fmtMan(grandTotal)}</td>
                <td className="px-3 py-2 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 3-3. 영업담당자별 실적 (거래처 현황 제거, 매출/건수만)
// =============================================================================
function SalesRepSection({ data, salesRepMap, hospitals }) {
  const { years, selectedYear, setSelectedYear, yearData, months } = useYearTab(data);

  const salesReps = useMemo(() =>
    [...new Set(hospitals.map(h => h.salesRep))].filter(Boolean).sort(),
    [hospitals]
  );

  const repStats = useMemo(() => {
    const map = {};
    yearData.forEach(item => {
      const rep = salesRepMap[item.hospital];
      if (!rep) return;
      if (!map[rep]) map[rep] = { rep, revenue: 0, qty: 0, monthlyRevenue: {}, monthlyQty: {} };
      map[rep].revenue += item.totalAmount || 0;
      map[rep].qty += item.finalQty || 0;
      const m = item.occurrenceMonth;
      map[rep].monthlyRevenue[m] = (map[rep].monthlyRevenue[m] || 0) + (item.totalAmount || 0);
      map[rep].monthlyQty[m] = (map[rep].monthlyQty[m] || 0) + (item.finalQty || 0);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [yearData, salesRepMap]);

  const grandTotal = repStats.reduce((s, r) => s + r.revenue, 0);
  const fmtMan = (v) => v >= 10000 ? `${(v / 10000).toFixed(1)}만` : fmt(v);

  const handleExport = () => {
    const sheets = [];
    sheets.push({
      name: '매출집계',
      data: repStats.map(r => {
        const row = { rep: r.rep, total: r.revenue, pct: grandTotal > 0 ? `${((r.revenue / grandTotal) * 100).toFixed(1)}%` : '-' };
        months.forEach(m => { row[m] = r.monthlyRevenue[m] || 0; });
        return row;
      }),
      columns: [
        { key: 'rep', header: '담당자', width: 10 },
        ...months.map(m => ({ key: m, header: m, width: 12 })),
        { key: 'total', header: '합계', width: 15 },
        { key: 'pct', header: '비율', width: 8 },
      ],
    });
    sheets.push({
      name: '건수집계',
      data: repStats.map(r => {
        const row = { rep: r.rep, total: r.qty };
        months.forEach(m => { row[m] = r.monthlyQty[m] || 0; });
        return row;
      }),
      columns: [
        { key: 'rep', header: '담당자', width: 10 },
        ...months.map(m => ({ key: m, header: m, width: 10 })),
        { key: 'total', header: '합계', width: 10 },
      ],
    });
    exportMultiSheet(sheets, `영업담당자별실적_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* 매출 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{selectedYear}년 담당자별 매출 집계</h3>
          <div className="flex items-center gap-3">
            <YearTabs years={years} selectedYear={selectedYear} onChange={setSelectedYear} />
            <button onClick={handleExport} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600">
              엑셀 다운로드
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header px-4 py-3 text-left">담당자</th>
                {months.map(m => (
                  <th key={m} className="table-header px-3 py-3 text-right">{m.slice(5)}월</th>
                ))}
                <th className="table-header px-4 py-3 text-right font-bold">합계</th>
                <th className="table-header px-4 py-3 text-right">비율</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {repStats.map(r => (
                <tr key={r.rep} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.rep}</td>
                  {months.map(m => (
                    <td key={m} className="px-3 py-3 text-right">{r.monthlyRevenue[m] ? fmtMan(r.monthlyRevenue[m]) : '-'}</td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold">{fmtMan(r.revenue)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {grandTotal > 0 ? `${((r.revenue / grandTotal) * 100).toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
              <tr className="bg-blue-50 font-bold">
                <td className="px-4 py-3">합계</td>
                {months.map(m => {
                  const mTotal = repStats.reduce((s, r) => s + (r.monthlyRevenue[m] || 0), 0);
                  return <td key={m} className="px-3 py-3 text-right">{fmtMan(mTotal)}</td>;
                })}
                <td className="px-4 py-3 text-right">{fmtMan(grandTotal)}</td>
                <td className="px-4 py-3 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 건수 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b">
          <h3 className="text-sm font-semibold text-gray-700">{selectedYear}년 담당자별 청구 건수</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header px-4 py-3 text-left">담당자</th>
                {months.map(m => (
                  <th key={m} className="table-header px-3 py-3 text-right">{m.slice(5)}월</th>
                ))}
                <th className="table-header px-4 py-3 text-right font-bold">합계</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {repStats.map(r => (
                <tr key={r.rep} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.rep}</td>
                  {months.map(m => (
                    <td key={m} className="px-3 py-3 text-right">{r.monthlyQty[m] || 0}</td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold">{r.qty}</td>
                </tr>
              ))}
              <tr className="bg-blue-50 font-bold">
                <td className="px-4 py-3">합계</td>
                {months.map(m => {
                  const mTotal = repStats.reduce((s, r) => s + (r.monthlyQty[m] || 0), 0);
                  return <td key={m} className="px-3 py-3 text-right">{mTotal}</td>;
                })}
                <td className="px-4 py-3 text-right">{repStats.reduce((s, r) => s + r.qty, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 3-4. 거래처별 상세 매출 (엑셀에 세부정보 포함)
// =============================================================================
function HospitalDetailSection({ data, allHospitals, hospitals, salesRepMap }) {
  const [selectedHospital, setSelectedHospital] = useState(allHospitals[0] || '');

  const hospitalData = useMemo(() => {
    if (!selectedHospital) return [];
    return data
      .filter(item => item.hospital === selectedHospital)
      .sort((a, b) => (a.occurrenceMonth || '').localeCompare(b.occurrenceMonth || ''));
  }, [data, selectedHospital]);

  const totalAmount = hospitalData.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalQty = hospitalData.reduce((s, i) => s + (i.finalQty || 0), 0);

  // 병원 기본 정보
  const hospitalInfo = useMemo(() =>
    hospitals.find(h => h.name === selectedHospital) || {},
    [hospitals, selectedHospital]
  );

  const handleExport = () => {
    const columns = [
      { key: 'occurrenceMonth', header: '발생월', width: 10 },
      { key: 'product', header: '제품', width: 8 },
      { key: 'adminQty', header: 'Admin건수', width: 10 },
      { key: 'hospitalQty', header: '병원건수', width: 10 },
      { key: 'finalQty', header: '최종건수', width: 10 },
      { key: 'unitPrice', header: '단가', width: 12 },
      { key: 'supplyAmount', header: '공급가', width: 12 },
      { key: 'tax', header: '부가세', width: 12 },
      { key: 'totalAmount', header: '청구금액', width: 12 },
      { key: 'status', header: '채권상태', width: 10 },
      { key: 'dueDate', header: '입금예정일', width: 12 },
      { key: 'paidDate', header: '실제입금일', width: 12 },
      { key: 'settlementDays', header: '정산주기', width: 10 },
      { key: 'note', header: '비고', width: 15 },
    ];
    exportToExcel(hospitalData, columns, `거래처상세_${selectedHospital}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">거래처 선택</label>
            <select value={selectedHospital} onChange={e => setSelectedHospital(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm min-w-[250px]">
              {allHospitals.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          {hospitalInfo.salesRep && (
            <div className="text-xs text-gray-500">
              담당: <span className="font-medium text-gray-700">{hospitalInfo.salesRep}</span>
              {hospitalInfo.billingType && <> | {hospitalInfo.billingType}</>}
              {hospitalInfo.settlementDays != null && <> | 정산 {hospitalInfo.settlementDays}일</>}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{selectedHospital} — 상세 내역</h3>
          <button onClick={handleExport} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600">
            엑셀 다운로드
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['발생월', '제품', 'Admin', '병원', '최종건수', '단가', '공급가', '부가세', '청구금액', '상태'].map(h => (
                  <th key={h} className="table-header px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {hospitalData.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{item.occurrenceMonth}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`badge ${item.product === 'CAS' ? 'badge-blue' : 'badge-yellow'}`}>{item.product}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{item.adminQty ?? '-'}</td>
                  <td className="px-3 py-2 text-right">{item.hospitalQty ?? '-'}</td>
                  <td className="px-3 py-2 text-right font-medium">{item.finalQty ?? '-'}</td>
                  <td className="px-3 py-2 text-right">{fmt(item.unitPrice)}</td>
                  <td className="px-3 py-2 text-right">{fmt(item.supplyAmount)}</td>
                  <td className="px-3 py-2 text-right">{fmt(item.tax)}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmt(item.totalAmount)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`badge ${
                      item.status === '완납' ? 'badge-green' : item.status === '연체' ? 'badge-red' : 'badge-blue'
                    }`}>{item.status}</span>
                  </td>
                </tr>
              ))}
              {hospitalData.length === 0 && (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">데이터 없음</td></tr>
              )}
              {hospitalData.length > 0 && (
                <tr className="bg-blue-50 font-bold">
                  <td className="px-3 py-2">합계</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right">{hospitalData.reduce((s, i) => s + (i.adminQty || 0), 0)}</td>
                  <td className="px-3 py-2 text-right">{hospitalData.reduce((s, i) => s + (i.hospitalQty || 0), 0)}</td>
                  <td className="px-3 py-2 text-right">{totalQty}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right">{fmt(hospitalData.reduce((s, i) => s + (i.supplyAmount || 0), 0))}</td>
                  <td className="px-3 py-2 text-right">{fmt(hospitalData.reduce((s, i) => s + (i.tax || 0), 0))}</td>
                  <td className="px-3 py-2 text-right">{fmt(totalAmount)}</td>
                  <td className="px-3 py-2" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Statistics;

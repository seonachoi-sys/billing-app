import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { fmt } from '../utils/calculations';
import { exportToExcel, exportMultiSheet } from '../utils/exportExcel';
import seedHospitals from '../data/seedHospitals.json';

// seedHospitals.json에서 병원 메타 빌드 (Firestore hospitals와 분리)
const HOSPITAL_META = {};
seedHospitals.forEach(h => {
  if (h.name) HOSPITAL_META[h.name] = { type: h.type, department: h.department, salesRep: h.salesRep };
});

const Statistics = () => {
  const { invoices } = useData();

  const [activeSection, setActiveSection] = useState('qty');

  const hospitalMeta = HOSPITAL_META;

  const tabs = [
    { key: 'qty', label: '청구 건수' },
    { key: 'revenue', label: '매출' },
    { key: 'salesRep', label: '영업담당자별' },
  ];

  return (
    <div className="space-y-6">
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

      {activeSection === 'qty' && <QtySection invoices={invoices} hospitalMeta={hospitalMeta} />}
      {activeSection === 'revenue' && <RevenueSection invoices={invoices} hospitalMeta={hospitalMeta} />}
      {activeSection === 'salesRep' && <SalesRepSection invoices={invoices} hospitalMeta={hospitalMeta} />}
    </div>
  );
};

// =============================================================================
// 공통: 연도 탭 + 청구/발생 기준 + 필터
// =============================================================================
function useCommonFilters(invoices) {
  const [basisType, setBasisType] = useState('occurrence'); // occurrence | billing
  const monthKey = basisType === 'occurrence' ? 'occurrenceMonth' : 'billingMonth';

  const years = useMemo(() =>
    [...new Set(invoices.map(i => (i[monthKey] || '').slice(0, 4)))].filter(Boolean).sort(),
    [invoices, monthKey]
  );
  const [selectedYear, setSelectedYear] = useState(() => years[years.length - 1] || '');

  // 연도 바뀌면 최신 연도로
  const effectiveYear = years.includes(selectedYear) ? selectedYear : (years[years.length - 1] || '');

  const yearData = useMemo(() =>
    effectiveYear ? invoices.filter(i => (i[monthKey] || '').startsWith(effectiveYear)) : invoices,
    [invoices, effectiveYear, monthKey]
  );

  const months = useMemo(() =>
    [...new Set(yearData.map(i => i[monthKey]))].filter(Boolean).sort(),
    [yearData, monthKey]
  );

  return { basisType, setBasisType, monthKey, years, selectedYear: effectiveYear, setSelectedYear, yearData, months };
}

function FilterBar({ years, selectedYear, setSelectedYear, basisType, setBasisType, productFilter, setProductFilter, extra }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* 연도 */}
        <div className="flex gap-1">
          {years.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                ${selectedYear === y ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {y}
            </button>
          ))}
        </div>
        <div className="w-px h-6 bg-gray-300" />
        {/* 청구/발생 기준 */}
        <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
          <button onClick={() => setBasisType('occurrence')}
            className={`px-3 py-1 rounded text-xs font-medium ${basisType === 'occurrence' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
            발생기준
          </button>
          <button onClick={() => setBasisType('billing')}
            className={`px-3 py-1 rounded text-xs font-medium ${basisType === 'billing' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>
            청구기준
          </button>
        </div>
        {/* 제품 */}
        <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
          <option value="">전체 제품</option>
          <option value="CAS">CAS</option>
          <option value="EXO">EXO</option>
        </select>
        {extra}
      </div>
    </div>
  );
}

// =============================================================================
// 1. 청구 건수
// =============================================================================
function QtySection({ invoices, hospitalMeta }) {
  const { basisType, setBasisType, monthKey, years, selectedYear, setSelectedYear, yearData, months } = useCommonFilters(invoices);
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // 상급 | 로컬
  const [deptFilter, setDeptFilter] = useState(''); // 안과 | 내과
  const [sortKey, setSortKey] = useState('total'); // total | hospital
  const [sortDir, setSortDir] = useState('desc');

  const filtered = useMemo(() => {
    return yearData.filter(item => {
      if (productFilter && item.product !== productFilter) return false;
      if (typeFilter) {
        const meta = hospitalMeta[item.hospital];
        if (!meta || meta.type !== typeFilter) return false;
      }
      if (deptFilter && item.department !== deptFilter) return false;
      return true;
    });
  }, [yearData, productFilter, typeFilter, deptFilter, hospitalMeta]);

  // 병원별 집계
  const hospitalStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const h = item.hospital;
      if (!h) return;
      const meta = hospitalMeta[h] || {};
      if (!map[h]) map[h] = { hospital: h, type: meta.type || '', dept: meta.department || '', total: 0, months: {} };
      const qty = item.finalQty || 0;
      map[h].months[item[monthKey]] = (map[h].months[item[monthKey]] || 0) + qty;
      map[h].total += qty;
    });
    const list = Object.values(map);
    list.sort((a, b) => {
      if (sortKey === 'hospital') return sortDir === 'asc' ? a.hospital.localeCompare(b.hospital) : b.hospital.localeCompare(a.hospital);
      return sortDir === 'asc' ? a.total - b.total : b.total - a.total;
    });
    return list;
  }, [filtered, monthKey, hospitalMeta, sortKey, sortDir]);

  const grandTotal = hospitalStats.reduce((s, h) => s + h.total, 0);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleExport = () => {
    const columns = [
      { key: 'rank', header: '순위', width: 6 },
      { key: 'hospital', header: '거래처명', width: 25 },
      { key: 'type', header: '구분', width: 8 },
      { key: 'dept', header: '진료과', width: 8 },
      ...months.map(m => ({ key: m, header: m, width: 10 })),
      { key: 'total', header: '합계', width: 10 },
    ];
    const rows = hospitalStats.map((h, i) => {
      const row = { rank: i + 1, hospital: h.hospital, type: h.type, dept: h.dept, total: h.total };
      months.forEach(m => { row[m] = h.months[m] || 0; });
      return row;
    });
    exportToExcel(rows, columns, `청구건수_${selectedYear}_${basisType === 'occurrence' ? '발생' : '청구'}기준.xlsx`);
  };

  const extraFilters = (
    <>
      <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
        <option value="">전체 구분</option>
        <option value="상급">상급</option>
        <option value="로컬">로컬</option>
      </select>
      <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
        <option value="">전체 진료과</option>
        <option value="안과">안과</option>
        <option value="내과">내과</option>
      </select>
    </>
  );

  return (
    <div className="space-y-4">
      <FilterBar years={years} selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        basisType={basisType} setBasisType={setBasisType}
        productFilter={productFilter} setProductFilter={setProductFilter}
        extra={extraFilters} />

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">거래처 수</p>
          <p className="text-2xl font-bold text-gray-800">{hospitalStats.length}<span className="text-sm font-normal text-gray-400">곳</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">총 건수</p>
          <p className="text-2xl font-bold text-blue-600">{fmt(grandTotal)}<span className="text-sm font-normal text-gray-400">건</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">거래처당 평균</p>
          <p className="text-2xl font-bold text-gray-700">{hospitalStats.length > 0 ? Math.round(grandTotal / hospitalStats.length) : 0}<span className="text-sm font-normal text-gray-400">건</span></p>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            {selectedYear}년 청구 건수
            <span className="ml-1 text-xs font-normal text-gray-400">({basisType === 'occurrence' ? '발생' : '청구'}기준)</span>
          </h3>
          <button onClick={handleExport} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600">엑셀 다운로드</button>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="table-header px-3 py-2 text-center w-10">순위</th>
                <th className="table-header px-3 py-2 text-left cursor-pointer select-none hover:text-blue-600"
                  onClick={() => toggleSort('hospital')}>
                  거래처명 {sortKey === 'hospital' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="table-header px-3 py-2 text-center">구분</th>
                <th className="table-header px-3 py-2 text-center">진료과</th>
                {months.map(m => (
                  <th key={m} className="table-header px-3 py-2 text-right">{m.slice(5)}월</th>
                ))}
                <th className="table-header px-3 py-2 text-right cursor-pointer select-none hover:text-blue-600 font-bold"
                  onClick={() => toggleSort('total')}>
                  합계 {sortKey === 'total' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {hospitalStats.map((h, i) => (
                <tr key={h.hospital} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{h.hospital}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${h.type === '상급' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{h.type}</span>
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">{h.dept}</td>
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
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                {months.map(m => {
                  const t = hospitalStats.reduce((s, h) => s + (h.months[m] || 0), 0);
                  return <td key={m} className="px-3 py-2 text-right">{t}</td>;
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
// 2. 매출 — 연간 누적, 엑셀에 월별 세부
// =============================================================================
function RevenueSection({ invoices, hospitalMeta }) {
  const { basisType, setBasisType, monthKey, years, selectedYear, setSelectedYear, yearData, months } = useCommonFilters(invoices);
  const [productFilter, setProductFilter] = useState('');

  const filtered = useMemo(() => {
    if (!productFilter) return yearData;
    return yearData.filter(i => i.product === productFilter);
  }, [yearData, productFilter]);

  // 병원별 연간 누적
  const hospitalStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const h = item.hospital;
      if (!h) return;
      const meta = hospitalMeta[h] || {};
      if (!map[h]) map[h] = { hospital: h, type: meta.type || '', revenue: 0, qty: 0, months: {} };
      map[h].revenue += item.totalAmount || 0;
      map[h].qty += item.finalQty || 0;
      const m = item[monthKey];
      if (!map[h].months[m]) map[h].months[m] = { qty: 0, revenue: 0 };
      map[h].months[m].qty += item.finalQty || 0;
      map[h].months[m].revenue += item.totalAmount || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filtered, monthKey, hospitalMeta]);

  const grandRevenue = hospitalStats.reduce((s, h) => s + h.revenue, 0);
  const grandQty = hospitalStats.reduce((s, h) => s + h.qty, 0);
  // 엑셀: 월별 건수/단가/금액 세부
  const handleExport = () => {
    // 상세 시트: 원본 데이터 그대로
    const detailColumns = [
      { key: 'hospital', header: '거래처명', width: 25 },
      { key: 'type', header: '구분', width: 8 },
      { key: 'month', header: basisType === 'occurrence' ? '발생월' : '청구월', width: 10 },
      { key: 'product', header: '제품', width: 8 },
      { key: 'finalQty', header: '건수', width: 8 },
      { key: 'unitPrice', header: '단가', width: 12 },
      { key: 'supplyAmount', header: '공급가', width: 12 },
      { key: 'tax', header: '부가세', width: 12 },
      { key: 'totalAmount', header: '청구금액', width: 12 },
      { key: 'status', header: '상태', width: 8 },
    ];
    const detailRows = filtered
      .sort((a, b) => (a.hospital || '').localeCompare(b.hospital) || (a[monthKey] || '').localeCompare(b[monthKey]))
      .map(item => ({
        hospital: item.hospital,
        type: (hospitalMeta[item.hospital] || {}).type || '',
        month: item[monthKey],
        product: item.product,
        finalQty: item.finalQty,
        unitPrice: item.unitPrice,
        supplyAmount: item.supplyAmount,
        tax: item.tax,
        totalAmount: item.totalAmount,
        status: item.status,
      }));

    // 누적 시트
    const summaryColumns = [
      { key: 'rank', header: '순위', width: 6 },
      { key: 'hospital', header: '거래처명', width: 25 },
      { key: 'type', header: '구분', width: 8 },
      { key: 'qty', header: '총 건수', width: 10 },
      { key: 'revenue', header: '총 매출', width: 15 },
      { key: 'pct', header: '비율', width: 8 },
    ];
    const summaryRows = hospitalStats.map((h, i) => ({
      rank: i + 1, hospital: h.hospital, type: h.type, qty: h.qty, revenue: h.revenue,
      pct: grandRevenue > 0 ? `${((h.revenue / grandRevenue) * 100).toFixed(1)}%` : '-',
    }));

    exportMultiSheet([
      { name: '누적', data: summaryRows, columns: summaryColumns },
      { name: '월별상세', data: detailRows, columns: detailColumns },
    ], `매출_${selectedYear}_${basisType === 'occurrence' ? '발생' : '청구'}기준.xlsx`);
  };

  return (
    <div className="space-y-4">
      <FilterBar years={years} selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        basisType={basisType} setBasisType={setBasisType}
        productFilter={productFilter} setProductFilter={setProductFilter} />

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">총 매출 <span className="text-orange-400">(공급가액)</span></p>
          <p className="text-2xl font-bold text-gray-800">{fmt(grandRevenue)}<span className="text-sm font-normal text-gray-400">원</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">총 건수</p>
          <p className="text-2xl font-bold text-blue-600">{fmt(grandQty)}<span className="text-sm font-normal text-gray-400">건</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">거래처당 평균 매출</p>
          <p className="text-2xl font-bold text-gray-700">{hospitalStats.length > 0 ? fmt(Math.round(grandRevenue / hospitalStats.length)) : 0}<span className="text-sm font-normal text-gray-400">원</span></p>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            {selectedYear}년 연간 누적 매출 <span className="text-xs font-normal text-orange-500 ml-1">공급가액 기준</span>
            <span className="ml-1 text-xs font-normal text-gray-400">({basisType === 'occurrence' ? '발생' : '청구'}기준)</span>
          </h3>
          <button onClick={handleExport} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600">엑셀 다운로드</button>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="table-header px-3 py-2 text-center w-10">순위</th>
                <th className="table-header px-3 py-2 text-left">거래처명</th>
                <th className="table-header px-3 py-2 text-center">구분</th>
                <th className="table-header px-3 py-2 text-right">건수</th>
                <th className="table-header px-3 py-2 text-right font-bold">매출</th>
                <th className="table-header px-3 py-2 text-right">비율</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {hospitalStats.map((h, i) => (
                <tr key={h.hospital} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{h.hospital}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${h.type === '상급' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{h.type}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(h.qty)}</td>
                  <td className="px-3 py-2 text-right font-bold">{fmt(h.revenue)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {grandRevenue > 0 ? `${((h.revenue / grandRevenue) * 100).toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
              <tr className="bg-blue-50 font-bold">
                <td className="px-3 py-2" />
                <td className="px-3 py-2">합계</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right">{fmt(grandQty)}</td>
                <td className="px-3 py-2 text-right">{fmt(grandRevenue)}</td>
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
// 3. 영업담당자별 — 연간 누적, 엑셀에 병원별 세부
// =============================================================================
function SalesRepSection({ invoices, hospitalMeta }) {
  const { basisType, setBasisType, monthKey, years, selectedYear, setSelectedYear, yearData, months } = useCommonFilters(invoices);
  const [productFilter, setProductFilter] = useState('');

  const filtered = useMemo(() => {
    if (!productFilter) return yearData;
    return yearData.filter(i => i.product === productFilter);
  }, [yearData, productFilter]);

  // 담당자별 누적
  const repStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const meta = hospitalMeta[item.hospital];
      const rep = meta?.salesRep;
      if (!rep) return;
      if (!map[rep]) map[rep] = { rep, revenue: 0, qty: 0, hospitalCount: new Set(), hospitalDetails: {} };
      map[rep].revenue += item.totalAmount || 0;
      map[rep].qty += item.finalQty || 0;
      map[rep].hospitalCount.add(item.hospital);
      // 병원별 세부
      if (!map[rep].hospitalDetails[item.hospital]) {
        map[rep].hospitalDetails[item.hospital] = { hospital: item.hospital, type: meta.type || '', revenue: 0, qty: 0 };
      }
      map[rep].hospitalDetails[item.hospital].revenue += item.totalAmount || 0;
      map[rep].hospitalDetails[item.hospital].qty += item.finalQty || 0;
    });
    return Object.values(map)
      .map(r => ({ ...r, hospitalCount: r.hospitalCount.size, hospitalList: Object.values(r.hospitalDetails).sort((a, b) => b.revenue - a.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered, hospitalMeta]);

  const grandRevenue = repStats.reduce((s, r) => s + r.revenue, 0);
  const grandQty = repStats.reduce((s, r) => s + r.qty, 0);

  // 엑셀: 담당자별 + 병원별 세부
  const handleExport = () => {
    // 시트1: 누적 요약
    const summaryColumns = [
      { key: 'rep', header: '담당자', width: 10 },
      { key: 'hospitalCount', header: '거래처 수', width: 10 },
      { key: 'qty', header: '건수', width: 10 },
      { key: 'revenue', header: '매출', width: 15 },
      { key: 'pct', header: '비율', width: 8 },
    ];
    const summaryRows = repStats.map(r => ({
      rep: r.rep, hospitalCount: r.hospitalCount, qty: r.qty, revenue: r.revenue,
      pct: grandRevenue > 0 ? `${((r.revenue / grandRevenue) * 100).toFixed(1)}%` : '-',
    }));

    // 시트2: 병원별 세부
    const detailColumns = [
      { key: 'rep', header: '담당자', width: 10 },
      { key: 'hospital', header: '거래처명', width: 25 },
      { key: 'type', header: '구분', width: 8 },
      { key: 'month', header: basisType === 'occurrence' ? '발생월' : '청구월', width: 10 },
      { key: 'product', header: '제품', width: 8 },
      { key: 'finalQty', header: '건수', width: 8 },
      { key: 'unitPrice', header: '단가', width: 12 },
      { key: 'totalAmount', header: '청구금액', width: 12 },
      { key: 'status', header: '상태', width: 8 },
    ];
    const detailRows = filtered
      .filter(item => hospitalMeta[item.hospital]?.salesRep)
      .sort((a, b) => {
        const ra = hospitalMeta[a.hospital]?.salesRep || '';
        const rb = hospitalMeta[b.hospital]?.salesRep || '';
        return ra.localeCompare(rb) || (a.hospital || '').localeCompare(b.hospital) || (a[monthKey] || '').localeCompare(b[monthKey]);
      })
      .map(item => ({
        rep: hospitalMeta[item.hospital]?.salesRep || '',
        hospital: item.hospital,
        type: (hospitalMeta[item.hospital] || {}).type || '',
        month: item[monthKey],
        product: item.product,
        finalQty: item.finalQty,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
        status: item.status,
      }));

    exportMultiSheet([
      { name: '담당자별누적', data: summaryRows, columns: summaryColumns },
      { name: '병원별상세', data: detailRows, columns: detailColumns },
    ], `영업담당자_${selectedYear}_${basisType === 'occurrence' ? '발생' : '청구'}기준.xlsx`);
  };

  return (
    <div className="space-y-4">
      <FilterBar years={years} selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        basisType={basisType} setBasisType={setBasisType}
        productFilter={productFilter} setProductFilter={setProductFilter} />

      {/* 담당자별 누적 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            {selectedYear}년 담당자별 실적 <span className="text-xs font-normal text-orange-500 ml-1">공급가액 기준</span>
            <span className="ml-1 text-xs font-normal text-gray-400">({basisType === 'occurrence' ? '발생' : '청구'}기준)</span>
          </h3>
          <button onClick={handleExport} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600">엑셀 다운로드</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header px-4 py-3 text-left">담당자</th>
                <th className="table-header px-3 py-3 text-right">거래처</th>
                <th className="table-header px-3 py-3 text-right">건수</th>
                <th className="table-header px-3 py-3 text-right font-bold">매출</th>
                <th className="table-header px-3 py-3 text-right">비율</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {repStats.map(r => (
                <tr key={r.rep} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.rep}</td>
                  <td className="px-3 py-3 text-right">{r.hospitalCount}곳</td>
                  <td className="px-3 py-3 text-right">{fmt(r.qty)}</td>
                  <td className="px-3 py-3 text-right font-bold">{fmt(r.revenue)}</td>
                  <td className="px-3 py-3 text-right text-gray-500">
                    {grandRevenue > 0 ? `${((r.revenue / grandRevenue) * 100).toFixed(1)}%` : '-'}
                  </td>
                </tr>
              ))}
              <tr className="bg-blue-50 font-bold">
                <td className="px-4 py-3">합계</td>
                <td className="px-3 py-3 text-right">{repStats.reduce((s, r) => s + r.hospitalCount, 0)}곳</td>
                <td className="px-3 py-3 text-right">{fmt(grandQty)}</td>
                <td className="px-3 py-3 text-right">{fmt(grandRevenue)}</td>
                <td className="px-3 py-3 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 담당자별 병원 내역 (화면에서도 간략히) */}
      {repStats.map(r => (
        <div key={r.rep} className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-2 border-b bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">{r.rep}</span>
            <span className="ml-2 text-xs text-gray-400">{r.hospitalCount}곳 · {fmt(r.revenue)}원</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header px-4 py-2 text-left">거래처명</th>
                  <th className="table-header px-3 py-2 text-center">구분</th>
                  <th className="table-header px-3 py-2 text-right">건수</th>
                  <th className="table-header px-3 py-2 text-right">매출</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {r.hospitalList.map(h => (
                  <tr key={h.hospital} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">{h.hospital}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${h.type === '상급' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{h.type}</span>
                    </td>
                    <td className="px-3 py-2 text-right">{fmt(h.qty)}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmt(h.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Statistics;

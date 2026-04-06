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

// 전월 대비 증감 계산 헬퍼
function calcChange(current, previous) {
  if (previous === 0 || previous == null) return current > 0 ? { val: current, pct: null } : { val: 0, pct: null };
  const diff = current - previous;
  const pct = ((diff / previous) * 100).toFixed(1);
  return { val: diff, pct };
}
function ChangeIndicator({ change, unit = '' }) {
  if (!change || (change.val === 0 && change.pct === null)) return null;
  const isUp = change.val > 0;
  const color = isUp ? 'text-red-500' : change.val < 0 ? 'text-blue-500' : 'text-gray-400';
  return (
    <span className={`text-xs ${color} ml-1`}>
      {isUp ? '▲' : change.val < 0 ? '▼' : ''}
      {change.pct != null ? `${Math.abs(parseFloat(change.pct))}%` : `${Math.abs(change.val)}${unit}`}
    </span>
  );
}

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
      {/* 안내 문구 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        <span className="font-semibold">발생기준:</span> 해당 월에 실제 처방이 발생한 건수 &nbsp;/&nbsp;
        <span className="font-semibold">청구기준:</span> 해당 월에 청구서를 발행한 건수
        <span className="text-blue-400 ml-2">(이월 청구 등으로 차이 발생 가능)</span>
      </div>

      {/* 탭 */}
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
// 공통 훅
// =============================================================================
function useCommonFilters(invoices) {
  const [basisType, setBasisType] = useState('occurrence');
  const monthKey = basisType === 'occurrence' ? 'occurrenceMonth' : 'billingMonth';
  const years = useMemo(() =>
    [...new Set(invoices.map(i => (i[monthKey] || '').slice(0, 4)))].filter(Boolean).sort(),
    [invoices, monthKey]
  );
  const [selectedYear, setSelectedYear] = useState(() => years[years.length - 1] || '');
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

// 발생 vs 청구 차이 비교 배너
function BasisComparisonBanner({ invoices, selectedYear, basisType }) {
  const occData = useMemo(() => {
    return invoices.filter(i => (i.occurrenceMonth || '').startsWith(selectedYear));
  }, [invoices, selectedYear]);
  const billData = useMemo(() => {
    return invoices.filter(i => (i.billingMonth || '').startsWith(selectedYear));
  }, [invoices, selectedYear]);

  const occQty = occData.reduce((s, i) => s + (i.finalQty || 0), 0);
  const billQty = billData.reduce((s, i) => s + (i.finalQty || 0), 0);
  const diff = occQty - billQty;

  if (diff === 0) return null;

  // 차이 원인: 이월 건 찾기
  const carryovers = invoices.filter(i =>
    i.occurrenceMonth !== i.billingMonth &&
    ((i.occurrenceMonth || '').startsWith(selectedYear) || (i.billingMonth || '').startsWith(selectedYear))
  );
  const carryoverHospitals = [...new Set(carryovers.map(i => i.hospital))];

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-amber-700">기준별 차이:</span>
        <span className="text-gray-700">발생기준 <span className="font-bold">{fmt(occQty)}</span>건</span>
        <span className="text-gray-400">vs</span>
        <span className="text-gray-700">청구기준 <span className="font-bold">{fmt(billQty)}</span>건</span>
        <span className={`font-bold ${diff > 0 ? 'text-red-500' : 'text-blue-500'}`}>
          (차이 {diff > 0 ? '+' : ''}{fmt(diff)}건)
        </span>
      </div>
      {carryoverHospitals.length > 0 && (
        <p className="mt-1 text-amber-600">
          원인: {carryoverHospitals.join(', ')} 청구 이월 ({carryovers.length}건의 발생월≠청구월)
        </p>
      )}
    </div>
  );
}

function FilterBar({ years, selectedYear, setSelectedYear, basisType, setBasisType, productFilter, setProductFilter, extra }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-center gap-3">
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

// 전월 대비 KPI 카드
function KpiCard({ label, value, unit, change, sub }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800">
        {value}<span className="text-sm font-normal text-gray-400">{unit}</span>
        {change && <ChangeIndicator change={change} />}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// =============================================================================
// 1. 청구 건수 — 누계 컬럼 추가
// =============================================================================
function QtySection({ invoices, hospitalMeta }) {
  const { basisType, setBasisType, monthKey, years, selectedYear, setSelectedYear, yearData, months } = useCommonFilters(invoices);
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState('desc');

  const filtered = useMemo(() => {
    return yearData.filter(item => {
      if (productFilter && item.product !== productFilter) return false;
      if (typeFilter && (hospitalMeta[item.hospital] || {}).type !== typeFilter) return false;
      if (deptFilter && item.department !== deptFilter) return false;
      return true;
    });
  }, [yearData, productFilter, typeFilter, deptFilter, hospitalMeta]);

  const hospitalStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const h = item.hospital;
      if (!h) return;
      const meta = hospitalMeta[h] || {};
      if (!map[h]) map[h] = { hospital: h, type: meta.type || '', dept: meta.department || '', total: 0, months: {} };
      map[h].months[item[monthKey]] = (map[h].months[item[monthKey]] || 0) + (item.finalQty || 0);
      map[h].total += item.finalQty || 0;
    });
    const list = Object.values(map);
    list.sort((a, b) => {
      if (sortKey === 'hospital') return sortDir === 'asc' ? a.hospital.localeCompare(b.hospital) : b.hospital.localeCompare(a.hospital);
      return sortDir === 'asc' ? a.total - b.total : b.total - a.total;
    });
    return list;
  }, [filtered, monthKey, hospitalMeta, sortKey, sortDir]);

  const grandTotal = hospitalStats.reduce((s, h) => s + h.total, 0);

  // 전월 대비
  const lastMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const lastMonthQty = lastMonth ? hospitalStats.reduce((s, h) => s + (h.months[lastMonth] || 0), 0) : 0;
  const prevMonthQty = prevMonth ? hospitalStats.reduce((s, h) => s + (h.months[prevMonth] || 0), 0) : 0;
  const qtyChange = calcChange(lastMonthQty, prevMonthQty);

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
      ...months.flatMap((m, i) => [
        { key: m, header: m, width: 10 },
        { key: `cum_${m}`, header: `${m} 누계`, width: 10 },
      ]),
      { key: 'total', header: '합계', width: 10 },
    ];
    const rows = hospitalStats.map((h, idx) => {
      const row = { rank: idx + 1, hospital: h.hospital, type: h.type, dept: h.dept, total: h.total };
      let cum = 0;
      months.forEach(m => { const v = h.months[m] || 0; cum += v; row[m] = v; row[`cum_${m}`] = cum; });
      return row;
    });
    exportToExcel(rows, columns, `청구건수_${selectedYear}_${basisType === 'occurrence' ? '발생' : '청구'}기준.xlsx`);
  };

  return (
    <div className="space-y-4">
      <FilterBar years={years} selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        basisType={basisType} setBasisType={setBasisType}
        productFilter={productFilter} setProductFilter={setProductFilter}
        extra={<>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">전체 구분</option><option value="상급">상급</option><option value="로컬">로컬</option>
          </select>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">전체 진료과</option><option value="안과">안과</option><option value="내과">내과</option>
          </select>
        </>} />

      <BasisComparisonBanner invoices={invoices} selectedYear={selectedYear} basisType={basisType} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="거래처 수" value={hospitalStats.length} unit="곳" />
        <KpiCard label="총 건수" value={fmt(grandTotal)} unit="건" />
        <KpiCard label="거래처당 평균" value={hospitalStats.length > 0 ? Math.round(grandTotal / hospitalStats.length) : 0} unit="건" />
        <KpiCard label={`${lastMonth?.slice(5)}월 건수`} value={fmt(lastMonthQty)} unit="건" change={qtyChange}
          sub={prevMonth ? `전월(${prevMonth.slice(5)}월) ${fmt(prevMonthQty)}건` : ''} />
      </div>

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
                <th className="table-header px-3 py-2 text-left cursor-pointer hover:text-blue-600" onClick={() => toggleSort('hospital')}>
                  거래처명 {sortKey === 'hospital' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="table-header px-3 py-2 text-center">구분</th>
                <th className="table-header px-3 py-2 text-center">진료과</th>
                {months.map(m => (
                  <th key={m} className="table-header px-3 py-2 text-right">{m.slice(5)}월</th>
                ))}
                <th className="table-header px-3 py-2 text-right bg-blue-50">누계</th>
                <th className="table-header px-3 py-2 text-right font-bold cursor-pointer hover:text-blue-600" onClick={() => toggleSort('total')}>
                  합계 {sortKey === 'total' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {hospitalStats.map((h, i) => {
                let cum = 0;
                return (
                  <tr key={h.hospital} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-center text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{h.hospital}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${h.type === '상급' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{h.type}</span>
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-gray-500">{h.dept}</td>
                    {months.map(m => {
                      cum += h.months[m] || 0;
                      return <td key={m} className={`px-3 py-2 text-right ${h.months[m] ? '' : 'text-gray-300'}`}>{h.months[m] || 0}</td>;
                    })}
                    <td className="px-3 py-2 text-right bg-blue-50 font-medium text-blue-700">{cum}</td>
                    <td className="px-3 py-2 text-right font-bold">{h.total}</td>
                  </tr>
                );
              })}
              <tr className="bg-blue-50 font-bold">
                <td className="px-3 py-2" /><td className="px-3 py-2">합계</td><td className="px-3 py-2" /><td className="px-3 py-2" />
                {(() => { let cum = 0; return months.map(m => {
                  const t = hospitalStats.reduce((s, h) => s + (h.months[m] || 0), 0);
                  cum += t;
                  return <td key={m} className="px-3 py-2 text-right">{t}</td>;
                }); })()}
                <td className="px-3 py-2 text-right text-blue-700">{grandTotal}</td>
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
// 2. 매출 — 필터 강화 + 상급/로컬 소계 + 전월 대비
// =============================================================================
function RevenueSection({ invoices, hospitalMeta }) {
  const { basisType, setBasisType, monthKey, years, selectedYear, setSelectedYear, yearData, months } = useCommonFilters(invoices);
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const filtered = useMemo(() => {
    return yearData.filter(item => {
      if (productFilter && item.product !== productFilter) return false;
      if (typeFilter && (hospitalMeta[item.hospital] || {}).type !== typeFilter) return false;
      if (deptFilter && item.department !== deptFilter) return false;
      return true;
    });
  }, [yearData, productFilter, typeFilter, deptFilter, hospitalMeta]);

  const hospitalStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const h = item.hospital;
      if (!h) return;
      const meta = hospitalMeta[h] || {};
      if (!map[h]) map[h] = { hospital: h, type: meta.type || '', revenue: 0, qty: 0, months: {} };
      map[h].revenue += item.supplyAmount || 0;
      map[h].qty += item.finalQty || 0;
      const m = item[monthKey];
      if (!map[h].months[m]) map[h].months[m] = { qty: 0, revenue: 0 };
      map[h].months[m].revenue += item.supplyAmount || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filtered, monthKey, hospitalMeta]);

  const grandRevenue = hospitalStats.reduce((s, h) => s + h.revenue, 0);
  const grandQty = hospitalStats.reduce((s, h) => s + h.qty, 0);

  // 상급/로컬 소계
  const sanggeup = hospitalStats.filter(h => h.type === '상급');
  const local = hospitalStats.filter(h => h.type === '로컬');
  const sanggeupRev = sanggeup.reduce((s, h) => s + h.revenue, 0);
  const localRev = local.reduce((s, h) => s + h.revenue, 0);

  // 전월 대비
  const lastMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const lastMonthRev = lastMonth ? hospitalStats.reduce((s, h) => s + (h.months[lastMonth]?.revenue || 0), 0) : 0;
  const prevMonthRev = prevMonth ? hospitalStats.reduce((s, h) => s + (h.months[prevMonth]?.revenue || 0), 0) : 0;
  const revChange = calcChange(lastMonthRev, prevMonthRev);

  const handleExport = () => {
    const detailColumns = [
      { key: 'hospital', header: '거래처명', width: 25 }, { key: 'type', header: '구분', width: 8 },
      { key: 'month', header: basisType === 'occurrence' ? '발생월' : '청구월', width: 10 },
      { key: 'product', header: '제품', width: 8 }, { key: 'finalQty', header: '건수', width: 8 },
      { key: 'unitPrice', header: '단가', width: 12 }, { key: 'supplyAmount', header: '공급가', width: 12 },
      { key: 'tax', header: '부가세', width: 12 }, { key: 'totalAmount', header: '청구금액', width: 12 },
      { key: 'status', header: '상태', width: 8 },
    ];
    const detailRows = filtered.sort((a, b) => (a.hospital || '').localeCompare(b.hospital) || (a[monthKey] || '').localeCompare(b[monthKey]))
      .map(item => ({ hospital: item.hospital, type: (hospitalMeta[item.hospital] || {}).type || '', month: item[monthKey],
        product: item.product, finalQty: item.finalQty, unitPrice: item.unitPrice, supplyAmount: item.supplyAmount, tax: item.tax, totalAmount: item.totalAmount, status: item.status }));
    const summaryColumns = [
      { key: 'rank', header: '순위', width: 6 }, { key: 'hospital', header: '거래처명', width: 25 }, { key: 'type', header: '구분', width: 8 },
      { key: 'qty', header: '건수', width: 10 }, { key: 'revenue', header: '공급가 합계', width: 15 }, { key: 'pct', header: '비율', width: 8 },
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
        productFilter={productFilter} setProductFilter={setProductFilter}
        extra={<>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">전체 구분</option><option value="상급">상급</option><option value="로컬">로컬</option>
          </select>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">전체 진료과</option><option value="안과">안과</option><option value="내과">내과</option>
          </select>
        </>} />

      <BasisComparisonBanner invoices={invoices} selectedYear={selectedYear} basisType={basisType} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="총 매출 (공급가액)" value={fmt(grandRevenue)} unit="원" />
        <KpiCard label="총 건수" value={fmt(grandQty)} unit="건" />
        <KpiCard label="거래처당 평균" value={hospitalStats.length > 0 ? fmt(Math.round(grandRevenue / hospitalStats.length)) : '0'} unit="원" />
        <KpiCard label={`${lastMonth?.slice(5) || '-'}월 매출`} value={fmt(lastMonthRev)} unit="원" change={revChange}
          sub={prevMonth ? `전월(${prevMonth.slice(5)}월) ${fmt(prevMonthRev)}원` : ''} />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            {selectedYear}년 매출 <span className="text-xs font-normal text-orange-500 ml-1">공급가액 기준</span>
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
                <th className="table-header px-3 py-2 text-right font-bold">매출(공급가)</th>
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
              {/* 소계 */}
              <tr className="bg-purple-50 font-semibold text-purple-700">
                <td className="px-3 py-2" /><td className="px-3 py-2">상급 소계 ({sanggeup.length}곳)</td><td className="px-3 py-2" />
                <td className="px-3 py-2 text-right">{fmt(sanggeup.reduce((s,h) => s + h.qty, 0))}</td>
                <td className="px-3 py-2 text-right">{fmt(sanggeupRev)}</td>
                <td className="px-3 py-2 text-right">{grandRevenue > 0 ? `${((sanggeupRev / grandRevenue) * 100).toFixed(1)}%` : '-'}</td>
              </tr>
              <tr className="bg-gray-100 font-semibold text-gray-600">
                <td className="px-3 py-2" /><td className="px-3 py-2">로컬 소계 ({local.length}곳)</td><td className="px-3 py-2" />
                <td className="px-3 py-2 text-right">{fmt(local.reduce((s,h) => s + h.qty, 0))}</td>
                <td className="px-3 py-2 text-right">{fmt(localRev)}</td>
                <td className="px-3 py-2 text-right">{grandRevenue > 0 ? `${((localRev / grandRevenue) * 100).toFixed(1)}%` : '-'}</td>
              </tr>
              <tr className="bg-blue-50 font-bold">
                <td className="px-3 py-2" /><td className="px-3 py-2">합계</td><td className="px-3 py-2" />
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
// 3. 영업담당자별 — 월별 추이 + 전월 대비 증감
// =============================================================================
function SalesRepSection({ invoices, hospitalMeta }) {
  const { basisType, setBasisType, monthKey, years, selectedYear, setSelectedYear, yearData, months } = useCommonFilters(invoices);
  const [productFilter, setProductFilter] = useState('');

  const filtered = useMemo(() =>
    productFilter ? yearData.filter(i => i.product === productFilter) : yearData,
    [yearData, productFilter]
  );

  const repStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const rep = (hospitalMeta[item.hospital] || {}).salesRep;
      if (!rep) return;
      if (!map[rep]) map[rep] = { rep, revenue: 0, qty: 0, hospitalCount: new Set(), monthlyQty: {}, monthlyRev: {}, hospitalDetails: {} };
      map[rep].revenue += item.supplyAmount || 0;
      map[rep].qty += item.finalQty || 0;
      map[rep].hospitalCount.add(item.hospital);
      const m = item[monthKey];
      map[rep].monthlyQty[m] = (map[rep].monthlyQty[m] || 0) + (item.finalQty || 0);
      map[rep].monthlyRev[m] = (map[rep].monthlyRev[m] || 0) + (item.supplyAmount || 0);
      if (!map[rep].hospitalDetails[item.hospital]) {
        map[rep].hospitalDetails[item.hospital] = { hospital: item.hospital, type: (hospitalMeta[item.hospital] || {}).type || '', revenue: 0, qty: 0, monthlyQty: {} };
      }
      map[rep].hospitalDetails[item.hospital].revenue += item.supplyAmount || 0;
      map[rep].hospitalDetails[item.hospital].qty += item.finalQty || 0;
      map[rep].hospitalDetails[item.hospital].monthlyQty[m] = (map[rep].hospitalDetails[item.hospital].monthlyQty[m] || 0) + (item.finalQty || 0);
    });
    return Object.values(map)
      .map(r => ({ ...r, hospitalCount: r.hospitalCount.size, hospitalList: Object.values(r.hospitalDetails).sort((a, b) => b.revenue - a.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered, hospitalMeta, monthKey]);

  const grandRevenue = repStats.reduce((s, r) => s + r.revenue, 0);
  const grandQty = repStats.reduce((s, r) => s + r.qty, 0);

  const handleExport = () => {
    const summaryColumns = [
      { key: 'rep', header: '담당자', width: 10 }, { key: 'hospitalCount', header: '거래처 수', width: 10 },
      { key: 'qty', header: '건수', width: 10 }, { key: 'revenue', header: '매출(공급가)', width: 15 }, { key: 'pct', header: '비율', width: 8 },
    ];
    const summaryRows = repStats.map(r => ({
      rep: r.rep, hospitalCount: r.hospitalCount, qty: r.qty, revenue: r.revenue,
      pct: grandRevenue > 0 ? `${((r.revenue / grandRevenue) * 100).toFixed(1)}%` : '-',
    }));
    const detailColumns = [
      { key: 'rep', header: '담당자', width: 10 }, { key: 'hospital', header: '거래처명', width: 25 }, { key: 'type', header: '구분', width: 8 },
      { key: 'month', header: basisType === 'occurrence' ? '발생월' : '청구월', width: 10 },
      { key: 'product', header: '제품', width: 8 }, { key: 'finalQty', header: '건수', width: 8 },
      { key: 'unitPrice', header: '단가', width: 12 }, { key: 'supplyAmount', header: '공급가', width: 12 },
      { key: 'totalAmount', header: '청구금액', width: 12 }, { key: 'status', header: '상태', width: 8 },
    ];
    const detailRows = filtered.filter(i => (hospitalMeta[i.hospital] || {}).salesRep)
      .sort((a, b) => ((hospitalMeta[a.hospital]||{}).salesRep||'').localeCompare((hospitalMeta[b.hospital]||{}).salesRep||'') || (a.hospital||'').localeCompare(b.hospital) || (a[monthKey]||'').localeCompare(b[monthKey]))
      .map(i => ({ rep: (hospitalMeta[i.hospital]||{}).salesRep||'', hospital: i.hospital, type: (hospitalMeta[i.hospital]||{}).type||'', month: i[monthKey],
        product: i.product, finalQty: i.finalQty, unitPrice: i.unitPrice, supplyAmount: i.supplyAmount, totalAmount: i.totalAmount, status: i.status }));
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
          </h3>
          <button onClick={handleExport} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600">엑셀 다운로드</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header px-4 py-3 text-left">담당자</th>
                <th className="table-header px-3 py-3 text-right">거래처</th>
                {months.map(m => (
                  <th key={m} className="table-header px-3 py-3 text-right">{m.slice(5)}월</th>
                ))}
                <th className="table-header px-3 py-3 text-right">총 건수</th>
                <th className="table-header px-3 py-3 text-right font-bold">총 매출</th>
                <th className="table-header px-3 py-3 text-right">비율</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {repStats.map(r => (
                <tr key={r.rep} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.rep}</td>
                  <td className="px-3 py-3 text-right">{r.hospitalCount}곳</td>
                  {months.map((m, mi) => {
                    const qty = r.monthlyQty[m] || 0;
                    const prevQty = mi > 0 ? (r.monthlyQty[months[mi - 1]] || 0) : null;
                    const ch = prevQty != null ? calcChange(qty, prevQty) : null;
                    return (
                      <td key={m} className="px-3 py-3 text-right">
                        {qty}<ChangeIndicator change={ch} unit="건" />
                      </td>
                    );
                  })}
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
                {months.map(m => {
                  const t = repStats.reduce((s, r) => s + (r.monthlyQty[m] || 0), 0);
                  return <td key={m} className="px-3 py-3 text-right">{t}</td>;
                })}
                <td className="px-3 py-3 text-right">{fmt(grandQty)}</td>
                <td className="px-3 py-3 text-right">{fmt(grandRevenue)}</td>
                <td className="px-3 py-3 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 담당자별 병원 드릴다운 (전월 대비 증감) */}
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
                  {months.map(m => (
                    <th key={m} className="table-header px-3 py-2 text-right">{m.slice(5)}월</th>
                  ))}
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
                    {months.map((m, mi) => {
                      const qty = h.monthlyQty[m] || 0;
                      const prevQty = mi > 0 ? (h.monthlyQty[months[mi - 1]] || 0) : null;
                      const diff = prevQty != null ? qty - prevQty : null;
                      return (
                        <td key={m} className="px-3 py-2 text-right">
                          {qty || <span className="text-gray-300">0</span>}
                          {diff != null && diff !== 0 && (
                            <span className={`text-xs ml-0.5 ${diff > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                              {diff > 0 ? '▲' : '▼'}{Math.abs(diff)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-medium">{fmt(h.qty)}</td>
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

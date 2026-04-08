import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { fmt } from '../utils/calculations';
import { exportToExcel, exportMultiSheet } from '../utils/exportExcel';
import { mergeLedgerWithSeed, filterForStats } from '../utils/mergeLedger';
import { buildHospitalMeta } from '../utils/hospitalMeta';

// 전월 대비 증감 계산 헬퍼
function calcChange(current, previous) {
  if (previous === 0 || previous == null) return current > 0 ? { val: current, pct: null } : { val: 0, pct: null };
  return { val: current - previous, pct: (((current - previous) / previous) * 100).toFixed(1) };
}
function ChangeIndicator({ change, unit = '' }) {
  if (!change || (change.val === 0 && change.pct === null)) return null;
  const color = change.val > 0 ? 'text-red-500' : change.val < 0 ? 'text-blue-500' : 'text-gray-400';
  return (
    <span className={`text-xs ${color} ml-1`}>
      {change.val > 0 ? '▲' : change.val < 0 ? '▼' : ''}
      {change.pct != null ? `${Math.abs(parseFloat(change.pct))}%` : `${Math.abs(change.val)}${unit}`}
    </span>
  );
}

const Statistics = () => {
  const { ledger, hospitals, statsMemo, setStatsMemo, products } = useData();
  const [activeSection, setActiveSection] = useState('qty');

  const mergedLedger = useMemo(() => filterForStats(mergeLedgerWithSeed(ledger), products), [ledger, products]);

  const hospitalMeta = useMemo(() => buildHospitalMeta(hospitals), [hospitals]);

  const tabs = [
    { key: 'qty', label: '청구 건수' },
    { key: 'revenue', label: '매출' },
    { key: 'salesRep', label: '영업담당자별' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        <span className="font-semibold">발생기준:</span> 해당 월에 실제 처방이 발생한 건수 &nbsp;/&nbsp;
        <span className="font-semibold">청구기준:</span> 해당 월에 청구서를 발행한 건수
        <span className="text-blue-400 ml-2">(이월 청구 등으로 차이 발생 가능)</span>
      </div>

      <div className="flex gap-1 bg-white rounded-lg shadow p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveSection(t.key)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${activeSection === t.key ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeSection === 'qty' && <QtySection ledger={mergedLedger} hospitalMeta={hospitalMeta} statsMemo={statsMemo} setStatsMemo={setStatsMemo} products={products} />}
      {activeSection === 'revenue' && <RevenueSection ledger={mergedLedger} hospitalMeta={hospitalMeta} statsMemo={statsMemo} setStatsMemo={setStatsMemo} products={products} />}
      {activeSection === 'salesRep' && <SalesRepSection ledger={mergedLedger} hospitalMeta={hospitalMeta} products={products} />}
    </div>
  );
};

// =============================================================================
// 공통 훅 — ledger 한국어 필드 기반
// =============================================================================
function useCommonFilters(ledger) {
  const [basisType, setBasisType] = useState('occurrence');
  // 발생기준=발생기준, 청구기준=청구기준
  const monthKey = basisType === 'occurrence' ? '발생기준' : '청구기준';

  const years = useMemo(() =>
    [...new Set(ledger.map(i => ((i[monthKey] || i['청구기준']) || '').slice(0, 4)))].filter(Boolean).sort(),
    [ledger, monthKey]
  );
  const [selectedYear, setSelectedYear] = useState(() => years[years.length - 1] || '');
  const effectiveYear = years.includes(selectedYear) ? selectedYear : (years[years.length - 1] || '');

  const yearData = useMemo(() =>
    effectiveYear ? ledger.filter(i => ((i[monthKey] || i['청구기준']) || '').startsWith(effectiveYear)) : ledger,
    [ledger, effectiveYear, monthKey]
  );
  const months = useMemo(() =>
    [...new Set(yearData.map(i => (i[monthKey] || i['청구기준'])))].filter(Boolean).sort(),
    [yearData, monthKey]
  );

  return { basisType, setBasisType, monthKey, years, selectedYear: effectiveYear, setSelectedYear, yearData, months };
}

// 발생 vs 청구 차이 요약
function BasisDiffSummary({ ledger, selectedYear }) {
  const occQty = useMemo(() =>
    ledger.filter(i => ((i['발생기준'] || i['청구기준']) || '').startsWith(selectedYear)).reduce((s, i) => s + (i['최종건수'] || 0), 0),
    [ledger, selectedYear]);
  const billQty = useMemo(() =>
    ledger.filter(i => (i['청구기준'] || '').startsWith(selectedYear)).reduce((s, i) => s + (i['최종건수'] || 0), 0),
    [ledger, selectedYear]);
  const diff = occQty - billQty;
  if (diff === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs flex items-center gap-2 flex-wrap">
      <span className="font-semibold text-amber-700">기준별 차이:</span>
      <span>발생 <span className="font-bold">{fmt(occQty)}</span>건</span>
      <span className="text-gray-400">vs</span>
      <span>청구 <span className="font-bold">{fmt(billQty)}</span>건</span>
      <span className={`font-bold ${diff > 0 ? 'text-red-500' : 'text-blue-500'}`}>({diff > 0 ? '+' : ''}{fmt(diff)}건)</span>
    </div>
  );
}

// 이월 메모 배너
function BasisComparisonBanner({ memo, onMemoChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memo || '');
  const handleSave = () => { onMemoChange(draft); setEditing(false); };
  if (!memo && !editing && !onMemoChange) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-amber-700">청구 이월 메모</p>
        {onMemoChange && (
          <button onClick={() => { setDraft(memo || ''); setEditing(!editing); }}
            className="text-xs text-amber-500 hover:text-amber-700">{editing ? '취소' : (memo ? '편집' : '메모 작성')}</button>
        )}
      </div>
      {editing ? (
        <div className="mt-2">
          <textarea value={draft} onChange={e => setDraft(e.target.value)}
            placeholder="예: 세브란스 2월 발생분 → 4월 청구 (3월 미청구)"
            className="w-full border border-amber-300 rounded px-2 py-1.5 text-xs min-h-[50px] resize-y bg-white" />
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400">취소</button>
            <button onClick={handleSave} className="text-xs bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-600">저장</button>
          </div>
        </div>
      ) : memo ? <p className="mt-1 text-xs text-amber-700 whitespace-pre-wrap">{memo}</p> : null}
    </div>
  );
}

function FilterBar({ years, selectedYear, setSelectedYear, basisType, setBasisType, productFilter, setProductFilter, extra, products }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {years.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                ${selectedYear === y ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{y}</button>
          ))}
        </div>
        <div className="w-px h-6 bg-gray-300" />
        <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
          <button onClick={() => setBasisType('occurrence')}
            className={`px-3 py-1 rounded text-xs font-medium ${basisType === 'occurrence' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>발생기준</button>
          <button onClick={() => setBasisType('billing')}
            className={`px-3 py-1 rounded text-xs font-medium ${basisType === 'billing' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>청구기준</button>
        </div>
        <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
          <option value="">전체 제품</option>
          {(products || []).map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        {extra}
      </div>
    </div>
  );
}

function KpiCard({ label, value, unit, change, sub }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{value}<span className="text-sm font-normal text-gray-400">{unit}</span>
        {change && <ChangeIndicator change={change} />}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// =============================================================================
// 1. 청구 건수
// =============================================================================
function QtySection({ ledger, hospitalMeta, statsMemo, setStatsMemo, products }) {
  const { basisType, setBasisType, monthKey, years, selectedYear, setSelectedYear, yearData, months } = useCommonFilters(ledger);
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState('desc');

  const filtered = useMemo(() => yearData.filter(item => {
    if (productFilter && item['제품명'] !== productFilter) return false;
    if (typeFilter && (hospitalMeta[item['거래처명']] || {}).type !== typeFilter) return false;
    if (deptFilter && item['진료과'] !== deptFilter) return false;
    return true;
  }), [yearData, productFilter, typeFilter, deptFilter, hospitalMeta]);

  const hospitalStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const h = item['거래처명']; if (!h) return;
      const meta = hospitalMeta[h] || {};
      const m = item[monthKey] || item['청구기준'];
      if (!map[h]) map[h] = { hospital: h, type: meta.type || '', dept: meta.department || '', total: 0, months: {} };
      map[h].months[m] = (map[h].months[m] || 0) + (item['최종건수'] || 0);
      map[h].total += item['최종건수'] || 0;
    });
    const list = Object.values(map);
    list.sort((a, b) => {
      if (sortKey === 'hospital') return sortDir === 'asc' ? a.hospital.localeCompare(b.hospital) : b.hospital.localeCompare(a.hospital);
      return sortDir === 'asc' ? a.total - b.total : b.total - a.total;
    });
    return list;
  }, [filtered, monthKey, hospitalMeta, sortKey, sortDir]);

  const grandTotal = hospitalStats.reduce((s, h) => s + h.total, 0);
  const lastMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const lastMonthQty = lastMonth ? hospitalStats.reduce((s, h) => s + (h.months[lastMonth] || 0), 0) : 0;
  const prevMonthQty = prevMonth ? hospitalStats.reduce((s, h) => s + (h.months[prevMonth] || 0), 0) : 0;

  const toggleSort = (key) => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('desc'); } };

  const handleExport = () => {
    const buildSheet = (basis) => {
      const mk = basis === 'occurrence' ? '발생기준' : '청구기준';
      const label = basis === 'occurrence' ? '발생기준' : '청구기준';
      let base = ledger.filter(i => ((i[mk] || i['청구기준']) || '').startsWith(selectedYear));
      if (productFilter) base = base.filter(i => i['제품명'] === productFilter);
      if (typeFilter) base = base.filter(i => (hospitalMeta[i['거래처명']] || {}).type === typeFilter);
      if (deptFilter) base = base.filter(i => i['진료과'] === deptFilter);
      const ms = [...new Set(base.map(i => i[mk] || i['청구기준']))].filter(Boolean).sort();
      const map = {};
      base.forEach(item => {
        const h = item['거래처명']; if (!h) return;
        const meta = hospitalMeta[h] || {};
        const m = item[mk] || item['청구기준'];
        if (!map[h]) map[h] = { hospital: h, type: meta.type || '', dept: meta.department || '', total: 0, months: {} };
        map[h].months[m] = (map[h].months[m] || 0) + (item['최종건수'] || 0);
        map[h].total += item['최종건수'] || 0;
      });
      const stats = Object.values(map).sort((a, b) => b.total - a.total);
      const columns = [
        { key: 'rank', header: '순위', width: 6 }, { key: 'hospital', header: '거래처명', width: 25 },
        { key: 'type', header: '구분', width: 8 }, { key: 'dept', header: '진료과', width: 8 },
        ...ms.flatMap(m => [{ key: m, header: m, width: 10 }, { key: `cum_${m}`, header: `${m} 누계`, width: 10 }]),
        { key: 'total', header: '합계', width: 10 },
      ];
      const rows = stats.map((h, i) => {
        const row = { rank: i + 1, hospital: h.hospital, type: h.type, dept: h.dept, total: h.total };
        let cum = 0;
        ms.forEach(m => { const v = h.months[m] || 0; cum += v; row[m] = v; row[`cum_${m}`] = cum; });
        return row;
      });
      return { name: label, data: rows, columns };
    };
    exportMultiSheet([buildSheet('occurrence'), buildSheet('billing')], `청구건수_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <FilterBar years={years} selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        basisType={basisType} setBasisType={setBasisType} productFilter={productFilter} setProductFilter={setProductFilter} products={products}
        extra={<>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">전체 구분</option><option value="상급">상급</option><option value="로컬">로컬</option>
          </select>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">전체 진료과</option><option value="안과">안과</option><option value="내과">내과</option>
          </select>
        </>} />
      <BasisComparisonBanner memo={statsMemo} onMemoChange={setStatsMemo} />
      <BasisDiffSummary ledger={ledger} selectedYear={selectedYear} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="거래처 수" value={hospitalStats.length} unit="곳" />
        <KpiCard label="총 건수" value={fmt(grandTotal)} unit="건" />
        <KpiCard label="거래처당 평균" value={hospitalStats.length > 0 ? Math.round(grandTotal / hospitalStats.length) : 0} unit="건" />
        <KpiCard label={`${lastMonth?.slice(5) || '-'}월 건수`} value={fmt(lastMonthQty)} unit="건" change={calcChange(lastMonthQty, prevMonthQty)}
          sub={prevMonth ? `전월(${prevMonth.slice(5)}월) ${fmt(prevMonthQty)}건` : ''} />
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">
            {selectedYear}년 청구 건수 <span className="ml-1 text-xs font-normal text-gray-400">({basisType === 'occurrence' ? '발생' : '청구'}기준)</span>
          </h3>
          <button onClick={handleExport} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600">엑셀 다운로드</button>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0"><tr>
              <th className="table-header px-3 py-2 text-center w-10">순위</th>
              <th className="table-header px-3 py-2 text-left cursor-pointer hover:text-blue-600" onClick={() => toggleSort('hospital')}>
                거래처명 {sortKey === 'hospital' && (sortDir === 'asc' ? '↑' : '↓')}</th>
              <th className="table-header px-3 py-2 text-center">구분</th>
              <th className="table-header px-3 py-2 text-center">진료과</th>
              {months.map(m => <th key={m} className="table-header px-3 py-2 text-right">{m.slice(5)}월</th>)}
              <th className="table-header px-3 py-2 text-right bg-blue-50">누계</th>
              <th className="table-header px-3 py-2 text-right font-bold cursor-pointer hover:text-blue-600" onClick={() => toggleSort('total')}>
                합계 {sortKey === 'total' && (sortDir === 'asc' ? '↑' : '↓')}</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {hospitalStats.map((h, i) => { let cum = 0; return (
                <tr key={h.hospital} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{h.hospital}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-xs px-1.5 py-0.5 rounded ${h.type === '상급' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{h.type}</span></td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">{h.dept}</td>
                  {months.map(m => { cum += h.months[m] || 0; return <td key={m} className={`px-3 py-2 text-right ${h.months[m] ? '' : 'text-gray-300'}`}>{h.months[m] || 0}</td>; })}
                  <td className="px-3 py-2 text-right bg-blue-50 font-medium text-blue-700">{cum}</td>
                  <td className="px-3 py-2 text-right font-bold">{h.total}</td>
                </tr>); })}
              <tr className="bg-blue-50 font-bold">
                <td className="px-3 py-2" /><td className="px-3 py-2">합계</td><td className="px-3 py-2" /><td className="px-3 py-2" />
                {(() => { let c = 0; return months.map(m => { const t = hospitalStats.reduce((s, h) => s + (h.months[m] || 0), 0); c += t; return <td key={m} className="px-3 py-2 text-right">{t}</td>; }); })()}
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
// 2. 매출
// =============================================================================
function RevenueSection({ ledger, hospitalMeta, statsMemo, setStatsMemo, products }) {
  const { basisType, setBasisType, monthKey, years, selectedYear, setSelectedYear, yearData, months } = useCommonFilters(ledger);
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const filtered = useMemo(() => yearData.filter(item => {
    if (productFilter && item['제품명'] !== productFilter) return false;
    if (typeFilter && (hospitalMeta[item['거래처명']] || {}).type !== typeFilter) return false;
    if (deptFilter && item['진료과'] !== deptFilter) return false;
    return true;
  }), [yearData, productFilter, typeFilter, deptFilter, hospitalMeta]);

  const hospitalStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const h = item['거래처명']; if (!h) return;
      const meta = hospitalMeta[h] || {};
      if (!map[h]) map[h] = { hospital: h, type: meta.type || '', revenue: 0, qty: 0 };
      map[h].revenue += item['공급가'] || 0;
      map[h].qty += item['최종건수'] || 0;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filtered, hospitalMeta]);

  const grandRevenue = hospitalStats.reduce((s, h) => s + h.revenue, 0);
  const grandQty = hospitalStats.reduce((s, h) => s + h.qty, 0);
  const sanggeup = hospitalStats.filter(h => h.type === '상급');
  const local = hospitalStats.filter(h => h.type === '로컬');
  const sanggeupRev = sanggeup.reduce((s, h) => s + h.revenue, 0);
  const localRev = local.reduce((s, h) => s + h.revenue, 0);
  const lastMonth = months[months.length - 1]; const prevMonth = months[months.length - 2];
  const lastMonthRev = lastMonth ? filtered.filter(i => (i[monthKey] || i['청구기준']) === lastMonth).reduce((s, i) => s + (i['공급가'] || 0), 0) : 0;
  const prevMonthRev = prevMonth ? filtered.filter(i => (i[monthKey] || i['청구기준']) === prevMonth).reduce((s, i) => s + (i['공급가'] || 0), 0) : 0;

  const handleExport = () => {
    const detailColumns = [
      { key: 'hospital', header: '거래처명', width: 25 }, { key: 'type', header: '구분', width: 8 },
      { key: 'occMonth', header: '발생월', width: 10 }, { key: 'billMonth', header: '청구월', width: 10 },
      { key: 'product', header: '제품', width: 8 }, { key: 'qty', header: '건수', width: 8 },
      { key: 'unitPrice', header: '단가', width: 12 }, { key: 'supply', header: '공급가', width: 12 },
      { key: 'vat', header: '부가세', width: 12 }, { key: 'total', header: '청구금액', width: 12 },
      { key: 'status', header: '상태', width: 8 },
    ];
    const detailRows = filtered.sort((a, b) => (a['거래처명'] || '').localeCompare(b['거래처명']) || (a['청구기준'] || '').localeCompare(b['청구기준']))
      .map(i => ({ hospital: i['거래처명'], type: (hospitalMeta[i['거래처명']] || {}).type || '',
        occMonth: i['발생기준'] || i['청구기준'], billMonth: i['청구기준'], product: i['제품명'],
        qty: i['최종건수'], unitPrice: i['단가'], supply: i['공급가'], vat: i['부가세'], total: i['청구금액'], status: i['채권상태'] }));
    const summaryColumns = [
      { key: 'rank', header: '순위', width: 6 }, { key: 'hospital', header: '거래처명', width: 25 }, { key: 'type', header: '구분', width: 8 },
      { key: 'qty', header: '건수', width: 10 }, { key: 'revenue', header: '공급가 합계', width: 15 }, { key: 'pct', header: '비율', width: 8 },
    ];
    const summaryRows = hospitalStats.map((h, i) => ({ rank: i + 1, hospital: h.hospital, type: h.type, qty: h.qty, revenue: h.revenue,
      pct: grandRevenue > 0 ? `${((h.revenue / grandRevenue) * 100).toFixed(1)}%` : '-' }));
    exportMultiSheet([{ name: '누적', data: summaryRows, columns: summaryColumns }, { name: '월별상세', data: detailRows, columns: detailColumns }], `매출_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <FilterBar years={years} selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        basisType={basisType} setBasisType={setBasisType} productFilter={productFilter} setProductFilter={setProductFilter} products={products}
        extra={<>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">전체 구분</option><option value="상급">상급</option><option value="로컬">로컬</option></select>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">전체 진료과</option><option value="안과">안과</option><option value="내과">내과</option></select>
        </>} />
      <BasisComparisonBanner memo={statsMemo} onMemoChange={setStatsMemo} />
      <BasisDiffSummary ledger={ledger} selectedYear={selectedYear} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="총 매출 (공급가액)" value={fmt(grandRevenue)} unit="원" />
        <KpiCard label="총 건수" value={fmt(grandQty)} unit="건" />
        <KpiCard label="거래처당 평균" value={hospitalStats.length > 0 ? fmt(Math.round(grandRevenue / hospitalStats.length)) : '0'} unit="원" />
        <KpiCard label={`${lastMonth?.slice(5) || '-'}월 매출`} value={fmt(lastMonthRev)} unit="원" change={calcChange(lastMonthRev, prevMonthRev)}
          sub={prevMonth ? `전월(${prevMonth.slice(5)}월) ${fmt(prevMonthRev)}원` : ''} />
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{selectedYear}년 매출 <span className="text-xs font-normal text-orange-500 ml-1">공급가액 기준</span>
            <span className="ml-1 text-xs font-normal text-gray-400">({basisType === 'occurrence' ? '발생' : '청구'}기준)</span></h3>
          <button onClick={handleExport} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600">엑셀 다운로드</button>
        </div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0"><tr>
              <th className="table-header px-3 py-2 text-center w-10">순위</th>
              <th className="table-header px-3 py-2 text-left">거래처명</th>
              <th className="table-header px-3 py-2 text-center">구분</th>
              <th className="table-header px-3 py-2 text-right">건수</th>
              <th className="table-header px-3 py-2 text-right font-bold">매출(공급가)</th>
              <th className="table-header px-3 py-2 text-right">비율</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {hospitalStats.map((h, i) => (
                <tr key={h.hospital} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-center text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{h.hospital}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-xs px-1.5 py-0.5 rounded ${h.type === '상급' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{h.type}</span></td>
                  <td className="px-3 py-2 text-right">{fmt(h.qty)}</td>
                  <td className="px-3 py-2 text-right font-bold">{fmt(h.revenue)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{grandRevenue > 0 ? `${((h.revenue / grandRevenue) * 100).toFixed(1)}%` : '-'}</td>
                </tr>
              ))}
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
// 3. 영업담당자별
// =============================================================================
function SalesRepSection({ ledger, hospitalMeta, products }) {
  const { basisType, setBasisType, monthKey, years, selectedYear, setSelectedYear, yearData, months } = useCommonFilters(ledger);
  const [productFilter, setProductFilter] = useState('');

  const filtered = useMemo(() =>
    productFilter ? yearData.filter(i => i['제품명'] === productFilter) : yearData,
    [yearData, productFilter]
  );

  const repStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const rep = (hospitalMeta[item['거래처명']] || {}).salesRep;
      if (!rep) return;
      if (!map[rep]) map[rep] = { rep, revenue: 0, qty: 0, hospitalCount: new Set(), monthlyQty: {}, monthlyRev: {}, hospitalDetails: {} };
      map[rep].revenue += item['공급가'] || 0;
      map[rep].qty += item['최종건수'] || 0;
      map[rep].hospitalCount.add(item['거래처명']);
      const m = item[monthKey] || item['청구기준'];
      map[rep].monthlyQty[m] = (map[rep].monthlyQty[m] || 0) + (item['최종건수'] || 0);
      map[rep].monthlyRev[m] = (map[rep].monthlyRev[m] || 0) + (item['공급가'] || 0);
      const hName = item['거래처명'];
      if (!map[rep].hospitalDetails[hName]) {
        map[rep].hospitalDetails[hName] = { hospital: hName, type: (hospitalMeta[hName] || {}).type || '', revenue: 0, qty: 0, monthlyQty: {} };
      }
      map[rep].hospitalDetails[hName].revenue += item['공급가'] || 0;
      map[rep].hospitalDetails[hName].qty += item['최종건수'] || 0;
      map[rep].hospitalDetails[hName].monthlyQty[m] = (map[rep].hospitalDetails[hName].monthlyQty[m] || 0) + (item['최종건수'] || 0);
    });
    return Object.values(map)
      .map(r => ({ ...r, hospitalCount: r.hospitalCount.size, hospitalList: Object.values(r.hospitalDetails).sort((a, b) => b.revenue - a.revenue) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filtered, hospitalMeta, monthKey]);

  const grandRevenue = repStats.reduce((s, r) => s + r.revenue, 0);
  const grandQty = repStats.reduce((s, r) => s + r.qty, 0);

  const handleExport = () => {
    const summaryRows = repStats.map(r => ({ rep: r.rep, hospitalCount: r.hospitalCount, qty: r.qty, revenue: r.revenue,
      pct: grandRevenue > 0 ? `${((r.revenue / grandRevenue) * 100).toFixed(1)}%` : '-' }));
    const detailColumns = [
      { key: 'rep', header: '담당자', width: 10 }, { key: 'hospital', header: '거래처명', width: 25 }, { key: 'type', header: '구분', width: 8 },
      { key: 'occMonth', header: '발생월', width: 10 }, { key: 'billMonth', header: '청구월', width: 10 },
      { key: 'product', header: '제품', width: 8 }, { key: 'qty', header: '건수', width: 8 },
      { key: 'unitPrice', header: '단가', width: 12 }, { key: 'supply', header: '공급가', width: 12 },
      { key: 'total', header: '청구금액', width: 12 }, { key: 'status', header: '상태', width: 8 },
    ];
    const detailRows = filtered.filter(i => (hospitalMeta[i['거래처명']] || {}).salesRep)
      .sort((a, b) => ((hospitalMeta[a['거래처명']]||{}).salesRep||'').localeCompare((hospitalMeta[b['거래처명']]||{}).salesRep||'') || (a['거래처명']||'').localeCompare(b['거래처명']))
      .map(i => ({ rep: (hospitalMeta[i['거래처명']]||{}).salesRep||'', hospital: i['거래처명'], type: (hospitalMeta[i['거래처명']]||{}).type||'',
        occMonth: i['발생기준'] || i['청구기준'], billMonth: i['청구기준'], product: i['제품명'],
        qty: i['최종건수'], unitPrice: i['단가'], supply: i['공급가'], total: i['청구금액'], status: i['채권상태'] }));
    exportMultiSheet([
      { name: '담당자별누적', data: summaryRows, columns: [
        { key: 'rep', header: '담당자', width: 10 }, { key: 'hospitalCount', header: '거래처 수', width: 10 },
        { key: 'qty', header: '건수', width: 10 }, { key: 'revenue', header: '매출(공급가)', width: 15 }, { key: 'pct', header: '비율', width: 8 }] },
      { name: '병원별상세', data: detailRows, columns: detailColumns },
    ], `영업담당자_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <FilterBar years={years} selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        basisType={basisType} setBasisType={setBasisType} productFilter={productFilter} setProductFilter={setProductFilter} products={products} />
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{selectedYear}년 담당자별 실적 <span className="text-xs font-normal text-orange-500 ml-1">공급가액 기준</span></h3>
          <button onClick={handleExport} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600">엑셀 다운로드</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="table-header px-4 py-3 text-left">담당자</th>
              <th className="table-header px-3 py-3 text-right">거래처</th>
              {months.map(m => <th key={m} className="table-header px-3 py-3 text-right">{m.slice(5)}월</th>)}
              <th className="table-header px-3 py-3 text-right">건수</th>
              <th className="table-header px-3 py-3 text-right font-bold">매출</th>
              <th className="table-header px-3 py-3 text-right">비율</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {repStats.map(r => (
                <tr key={r.rep} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.rep}</td>
                  <td className="px-3 py-3 text-right">{r.hospitalCount}곳</td>
                  {months.map((m, mi) => {
                    const qty = r.monthlyQty[m] || 0;
                    const prev = mi > 0 ? (r.monthlyQty[months[mi - 1]] || 0) : null;
                    return <td key={m} className="px-3 py-3 text-right">{qty}<ChangeIndicator change={prev != null ? calcChange(qty, prev) : null} unit="건" /></td>;
                  })}
                  <td className="px-3 py-3 text-right">{fmt(r.qty)}</td>
                  <td className="px-3 py-3 text-right font-bold">{fmt(r.revenue)}</td>
                  <td className="px-3 py-3 text-right text-gray-500">{grandRevenue > 0 ? `${((r.revenue / grandRevenue) * 100).toFixed(1)}%` : '-'}</td>
                </tr>
              ))}
              <tr className="bg-blue-50 font-bold">
                <td className="px-4 py-3">합계</td>
                <td className="px-3 py-3 text-right">{repStats.reduce((s, r) => s + r.hospitalCount, 0)}곳</td>
                {months.map(m => <td key={m} className="px-3 py-3 text-right">{repStats.reduce((s, r) => s + (r.monthlyQty[m] || 0), 0)}</td>)}
                <td className="px-3 py-3 text-right">{fmt(grandQty)}</td>
                <td className="px-3 py-3 text-right">{fmt(grandRevenue)}</td>
                <td className="px-3 py-3 text-right">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {repStats.map(r => (
        <div key={r.rep} className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-2 border-b bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">{r.rep}</span>
            <span className="ml-2 text-xs text-gray-400">{r.hospitalCount}곳 · {fmt(r.revenue)}원</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="table-header px-4 py-2 text-left">거래처명</th>
                <th className="table-header px-3 py-2 text-center">구분</th>
                {months.map(m => <th key={m} className="table-header px-3 py-2 text-right">{m.slice(5)}월</th>)}
                <th className="table-header px-3 py-2 text-right">건수</th>
                <th className="table-header px-3 py-2 text-right">매출</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-200">
                {r.hospitalList.map(h => (
                  <tr key={h.hospital} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">{h.hospital}</td>
                    <td className="px-3 py-2 text-center"><span className={`text-xs px-1.5 py-0.5 rounded ${h.type === '상급' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{h.type}</span></td>
                    {months.map((m, mi) => {
                      const qty = h.monthlyQty[m] || 0;
                      const prev = mi > 0 ? (h.monthlyQty[months[mi - 1]] || 0) : null;
                      const diff = prev != null ? qty - prev : null;
                      return <td key={m} className="px-3 py-2 text-right">{qty || <span className="text-gray-300">0</span>}
                        {diff != null && diff !== 0 && <span className={`text-xs ml-0.5 ${diff > 0 ? 'text-red-500' : 'text-blue-500'}`}>{diff > 0 ? '▲' : '▼'}{Math.abs(diff)}</span>}</td>;
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

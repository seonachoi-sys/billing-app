import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { fmt } from '../utils/calculations';
import seedHospitals from '../data/seedHospitals.json';

const HOSPITAL_META = {};
seedHospitals.forEach(h => {
  if (h.name) HOSPITAL_META[h.name] = { type: h.type, department: h.department, salesRep: h.salesRep };
});

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

const SharedStats = () => {
  const { invoices, firebaseReady, firebaseError } = useData();
  const [activeSection, setActiveSection] = useState('qty');
  const hospitalMeta = HOSPITAL_META;

  const tabs = [
    { key: 'qty', label: '청구 건수' },
    { key: 'revenue', label: '매출' },
    { key: 'salesRep', label: '영업담당자별' },
  ];

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
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">매출청구 통계</h1>
            <p className="text-xs text-gray-400 mt-0.5">㈜타이로스코프 · Glandy CAS / EXO · 읽기 전용</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
              firebaseError ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${firebaseError ? 'bg-yellow-500' : 'bg-green-500'}`} />
              {firebaseError ? 'localStorage 모드' : '실시간 동기화'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
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

        {activeSection === 'qty' && <SharedQty invoices={invoices} hospitalMeta={hospitalMeta} />}
        {activeSection === 'revenue' && <SharedRevenue invoices={invoices} hospitalMeta={hospitalMeta} />}
        {activeSection === 'salesRep' && <SharedSalesRep invoices={invoices} hospitalMeta={hospitalMeta} />}
      </main>

      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          ㈜타이로스코프 매출청구 관리 · 읽기 전용 통계 페이지
        </div>
      </footer>
    </div>
  );
};

// 공통 훅
function useYearTab(invoices, basisType) {
  const monthKey = basisType === 'occurrence' ? 'occurrenceMonth' : 'billingMonth';
  const years = useMemo(() => [...new Set(invoices.map(i => (i[monthKey] || '').slice(0, 4)))].filter(Boolean).sort(), [invoices, monthKey]);
  const [selectedYear, setSelectedYear] = useState(() => years[years.length - 1] || '');
  const effectiveYear = years.includes(selectedYear) ? selectedYear : (years[years.length - 1] || '');
  const yearData = useMemo(() => effectiveYear ? invoices.filter(i => (i[monthKey] || '').startsWith(effectiveYear)) : invoices, [invoices, effectiveYear, monthKey]);
  const months = useMemo(() => [...new Set(yearData.map(i => i[monthKey]))].filter(Boolean).sort(), [yearData, monthKey]);
  return { monthKey, years, selectedYear: effectiveYear, setSelectedYear, yearData, months };
}

function BasisBanner({ invoices, selectedYear }) {
  const carryovers = useMemo(() =>
    invoices.filter(i => i.occurrenceMonth !== i.billingMonth &&
      ((i.occurrenceMonth||'').startsWith(selectedYear) || (i.billingMonth||'').startsWith(selectedYear))),
    [invoices, selectedYear]
  );
  if (carryovers.length === 0) return null;

  const patterns = useMemo(() => {
    const map = {};
    carryovers.forEach(c => {
      const key = `${c.occurrenceMonth} → ${c.billingMonth}`;
      if (!map[key]) map[key] = { occMonth: c.occurrenceMonth, billMonth: c.billingMonth, hospitals: new Set(), qty: 0 };
      map[key].hospitals.add(c.hospital);
      map[key].qty += c.finalQty || 0;
    });
    return Object.values(map).sort((a, b) => a.occMonth.localeCompare(b.occMonth));
  }, [carryovers]);

  const fm = (m) => { const [y, mo] = (m||'').split('-'); return `${y?.slice(2)}.${mo}`; };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-amber-700 mb-2">청구 이월 내역</p>
      <div className="space-y-1">
        {patterns.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="bg-white border border-amber-300 rounded px-2 py-0.5 font-medium text-gray-700">{fm(p.occMonth)} 발생</span>
            <span className="text-amber-400">→</span>
            <span className="bg-white border border-amber-300 rounded px-2 py-0.5 font-medium text-gray-700">{fm(p.billMonth)} 청구</span>
            <span className="text-gray-500">{[...p.hospitals].join(', ')}</span>
            {p.qty > 0 && <span className="text-amber-600 font-medium">{fmt(p.qty)}건</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function SFilterBar({ years, selectedYear, setSelectedYear, basisType, setBasisType, productFilter, setProductFilter, extra }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {years.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium ${selectedYear === y ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{y}</button>
          ))}
        </div>
        <div className="w-px h-6 bg-gray-300" />
        <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
          <button onClick={() => setBasisType('occurrence')} className={`px-3 py-1 rounded text-xs font-medium ${basisType === 'occurrence' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>발생기준</button>
          <button onClick={() => setBasisType('billing')} className={`px-3 py-1 rounded text-xs font-medium ${basisType === 'billing' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>청구기준</button>
        </div>
        <select value={productFilter} onChange={e => setProductFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
          <option value="">전체 제품</option><option value="CAS">CAS</option><option value="EXO">EXO</option>
        </select>
        {extra}
      </div>
    </div>
  );
}

// 청구 건수
function SharedQty({ invoices, hospitalMeta }) {
  const [basisType, setBasisType] = useState('occurrence');
  const { monthKey, years, selectedYear, setSelectedYear, yearData, months } = useYearTab(invoices, basisType);
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const filtered = useMemo(() => {
    let d = productFilter ? yearData.filter(i => i.product === productFilter) : yearData;
    if (typeFilter) d = d.filter(i => (hospitalMeta[i.hospital]||{}).type === typeFilter);
    if (deptFilter) d = d.filter(i => i.department === deptFilter);
    return d;
  }, [yearData, productFilter, typeFilter, deptFilter, hospitalMeta]);

  const hospitalStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const h = item.hospital; if (!h) return;
      const meta = hospitalMeta[h] || {};
      if (!map[h]) map[h] = { hospital: h, type: meta.type||'', dept: meta.department||'', total: 0, months: {} };
      map[h].months[item[monthKey]] = (map[h].months[item[monthKey]]||0) + (item.finalQty||0);
      map[h].total += item.finalQty||0;
    });
    return Object.values(map).sort((a,b) => b.total - a.total);
  }, [filtered, monthKey, hospitalMeta]);

  const grandTotal = hospitalStats.reduce((s,h) => s + h.total, 0);

  return (
    <div className="space-y-4">
      <SFilterBar years={years} selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        basisType={basisType} setBasisType={setBasisType} productFilter={productFilter} setProductFilter={setProductFilter}
        extra={<>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">전체 구분</option><option value="상급">상급</option><option value="로컬">로컬</option>
          </select>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
            <option value="">전체 진료과</option><option value="안과">안과</option><option value="내과">내과</option>
          </select>
        </>} />
      <BasisBanner invoices={invoices} selectedYear={selectedYear} />
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">거래처 수</p><p className="text-2xl font-bold text-gray-800">{hospitalStats.length}<span className="text-sm font-normal text-gray-400">곳</span></p></div>
        <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">총 건수</p><p className="text-2xl font-bold text-blue-600">{fmt(grandTotal)}<span className="text-sm font-normal text-gray-400">건</span></p></div>
        <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">거래처당 평균</p><p className="text-2xl font-bold text-gray-700">{hospitalStats.length > 0 ? Math.round(grandTotal/hospitalStats.length) : 0}<span className="text-sm font-normal text-gray-400">건</span></p></div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b"><h3 className="text-sm font-semibold text-gray-700">{selectedYear}년 청구 건수 <span className="ml-1 text-xs font-normal text-gray-400">({basisType === 'occurrence' ? '발생' : '청구'}기준)</span></h3></div>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 sticky top-0"><tr>
              <th className="table-header px-3 py-2 text-center w-10">순위</th>
              <th className="table-header px-3 py-2 text-left">거래처명</th>
              <th className="table-header px-3 py-2 text-center">구분</th>
              <th className="table-header px-3 py-2 text-center">진료과</th>
              {months.map(m => <th key={m} className="table-header px-3 py-2 text-right">{m.slice(5)}월</th>)}
              <th className="table-header px-3 py-2 text-right bg-blue-50">누계</th>
              <th className="table-header px-3 py-2 text-right font-bold">합계</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {hospitalStats.map((h,i) => {
                let cum = 0;
                return (
                  <tr key={h.hospital} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-center text-gray-400 text-xs">{i+1}</td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{h.hospital}</td>
                    <td className="px-3 py-2 text-center"><span className={`text-xs px-1.5 py-0.5 rounded ${h.type === '상급' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{h.type}</span></td>
                    <td className="px-3 py-2 text-center text-xs text-gray-500">{h.dept}</td>
                    {months.map(m => { cum += h.months[m]||0; return <td key={m} className={`px-3 py-2 text-right ${h.months[m] ? '' : 'text-gray-300'}`}>{h.months[m]||0}</td>; })}
                    <td className="px-3 py-2 text-right bg-blue-50 font-medium text-blue-700">{cum}</td>
                    <td className="px-3 py-2 text-right font-bold">{h.total}</td>
                  </tr>);
              })}
              <tr className="bg-blue-50 font-bold">
                <td className="px-3 py-2" /><td className="px-3 py-2">합계</td><td className="px-3 py-2" /><td className="px-3 py-2" />
                {(() => { let c = 0; return months.map(m => { const t = hospitalStats.reduce((s,h) => s+(h.months[m]||0),0); c+=t; return <td key={m} className="px-3 py-2 text-right">{t}</td>; }); })()}
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

// 매출
function SharedRevenue({ invoices, hospitalMeta }) {
  const [basisType, setBasisType] = useState('occurrence');
  const { monthKey, years, selectedYear, setSelectedYear, yearData } = useYearTab(invoices, basisType);
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filtered = useMemo(() => {
    let d = productFilter ? yearData.filter(i => i.product === productFilter) : yearData;
    if (typeFilter) d = d.filter(i => (hospitalMeta[i.hospital]||{}).type === typeFilter);
    return d;
  }, [yearData, productFilter, typeFilter, hospitalMeta]);

  const hospitalStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const h = item.hospital; if (!h) return;
      const meta = hospitalMeta[h] || {};
      if (!map[h]) map[h] = { hospital: h, type: meta.type||'', revenue: 0, qty: 0 };
      map[h].revenue += item.supplyAmount||0; map[h].qty += item.finalQty||0;
    });
    return Object.values(map).sort((a,b) => b.revenue - a.revenue);
  }, [filtered, hospitalMeta]);

  const grandRevenue = hospitalStats.reduce((s,h) => s + h.revenue, 0);
  const grandQty = hospitalStats.reduce((s,h) => s + h.qty, 0);
  const sanggeup = hospitalStats.filter(h => h.type === '상급');
  const local = hospitalStats.filter(h => h.type === '로컬');
  const sanggeupRev = sanggeup.reduce((s,h) => s + h.revenue, 0);
  const localRev = local.reduce((s,h) => s + h.revenue, 0);

  return (
    <div className="space-y-4">
      <SFilterBar years={years} selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        basisType={basisType} setBasisType={setBasisType} productFilter={productFilter} setProductFilter={setProductFilter}
        extra={<select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
          <option value="">전체 구분</option><option value="상급">상급</option><option value="로컬">로컬</option>
        </select>} />
      <BasisBanner invoices={invoices} selectedYear={selectedYear} />
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">총 매출 <span className="text-orange-400">(공급가액)</span></p><p className="text-2xl font-bold text-gray-800">{fmt(grandRevenue)}<span className="text-sm font-normal text-gray-400">원</span></p></div>
        <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">총 건수</p><p className="text-2xl font-bold text-blue-600">{fmt(grandQty)}<span className="text-sm font-normal text-gray-400">건</span></p></div>
        <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">거래처당 평균</p><p className="text-2xl font-bold text-gray-700">{hospitalStats.length > 0 ? fmt(Math.round(grandRevenue/hospitalStats.length)) : '0'}<span className="text-sm font-normal text-gray-400">원</span></p></div>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b"><h3 className="text-sm font-semibold text-gray-700">{selectedYear}년 매출 <span className="text-xs font-normal text-orange-500 ml-1">공급가액 기준</span></h3></div>
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
              {hospitalStats.map((h,i) => (
                <tr key={h.hospital} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-center text-gray-400 text-xs">{i+1}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{h.hospital}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-xs px-1.5 py-0.5 rounded ${h.type === '상급' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{h.type}</span></td>
                  <td className="px-3 py-2 text-right">{fmt(h.qty)}</td>
                  <td className="px-3 py-2 text-right font-bold">{fmt(h.revenue)}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{grandRevenue > 0 ? `${((h.revenue/grandRevenue)*100).toFixed(1)}%` : '-'}</td>
                </tr>
              ))}
              <tr className="bg-purple-50 font-semibold text-purple-700">
                <td className="px-3 py-2" /><td className="px-3 py-2">상급 소계 ({sanggeup.length}곳)</td><td className="px-3 py-2" />
                <td className="px-3 py-2 text-right">{fmt(sanggeup.reduce((s,h)=>s+h.qty,0))}</td>
                <td className="px-3 py-2 text-right">{fmt(sanggeupRev)}</td>
                <td className="px-3 py-2 text-right">{grandRevenue > 0 ? `${((sanggeupRev/grandRevenue)*100).toFixed(1)}%` : '-'}</td>
              </tr>
              <tr className="bg-gray-100 font-semibold text-gray-600">
                <td className="px-3 py-2" /><td className="px-3 py-2">로컬 소계 ({local.length}곳)</td><td className="px-3 py-2" />
                <td className="px-3 py-2 text-right">{fmt(local.reduce((s,h)=>s+h.qty,0))}</td>
                <td className="px-3 py-2 text-right">{fmt(localRev)}</td>
                <td className="px-3 py-2 text-right">{grandRevenue > 0 ? `${((localRev/grandRevenue)*100).toFixed(1)}%` : '-'}</td>
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

// 영업담당자별
function SharedSalesRep({ invoices, hospitalMeta }) {
  const [basisType, setBasisType] = useState('occurrence');
  const { monthKey, years, selectedYear, setSelectedYear, yearData, months } = useYearTab(invoices, basisType);
  const [productFilter, setProductFilter] = useState('');

  const filtered = useMemo(() => productFilter ? yearData.filter(i => i.product === productFilter) : yearData, [yearData, productFilter]);

  const repStats = useMemo(() => {
    const map = {};
    filtered.forEach(item => {
      const rep = (hospitalMeta[item.hospital]||{}).salesRep; if (!rep) return;
      if (!map[rep]) map[rep] = { rep, revenue: 0, qty: 0, hospitalCount: new Set(), monthlyQty: {}, hospitalDetails: {} };
      map[rep].revenue += item.supplyAmount||0; map[rep].qty += item.finalQty||0;
      map[rep].hospitalCount.add(item.hospital);
      const m = item[monthKey];
      map[rep].monthlyQty[m] = (map[rep].monthlyQty[m]||0) + (item.finalQty||0);
      if (!map[rep].hospitalDetails[item.hospital]) map[rep].hospitalDetails[item.hospital] = { hospital: item.hospital, type: (hospitalMeta[item.hospital]||{}).type||'', revenue: 0, qty: 0, monthlyQty: {} };
      map[rep].hospitalDetails[item.hospital].revenue += item.supplyAmount||0;
      map[rep].hospitalDetails[item.hospital].qty += item.finalQty||0;
      map[rep].hospitalDetails[item.hospital].monthlyQty[m] = (map[rep].hospitalDetails[item.hospital].monthlyQty[m]||0) + (item.finalQty||0);
    });
    return Object.values(map).map(r => ({ ...r, hospitalCount: r.hospitalCount.size, hospitalList: Object.values(r.hospitalDetails).sort((a,b) => b.revenue - a.revenue) })).sort((a,b) => b.revenue - a.revenue);
  }, [filtered, hospitalMeta, monthKey]);

  const grandRevenue = repStats.reduce((s,r) => s + r.revenue, 0);

  return (
    <div className="space-y-4">
      <SFilterBar years={years} selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        basisType={basisType} setBasisType={setBasisType} productFilter={productFilter} setProductFilter={setProductFilter} />
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-3 border-b"><h3 className="text-sm font-semibold text-gray-700">{selectedYear}년 담당자별 실적 <span className="text-xs font-normal text-orange-500 ml-1">공급가액 기준</span></h3></div>
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
                  {months.map((m,mi) => {
                    const qty = r.monthlyQty[m]||0;
                    const prev = mi > 0 ? (r.monthlyQty[months[mi-1]]||0) : null;
                    const ch = prev != null ? calcChange(qty, prev) : null;
                    return <td key={m} className="px-3 py-3 text-right">{qty}<ChangeIndicator change={ch} unit="건" /></td>;
                  })}
                  <td className="px-3 py-3 text-right">{fmt(r.qty)}</td>
                  <td className="px-3 py-3 text-right font-bold">{fmt(r.revenue)}</td>
                  <td className="px-3 py-3 text-right text-gray-500">{grandRevenue > 0 ? `${((r.revenue/grandRevenue)*100).toFixed(1)}%` : '-'}</td>
                </tr>
              ))}
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
                    {months.map((m,mi) => {
                      const qty = h.monthlyQty[m]||0;
                      const prev = mi > 0 ? (h.monthlyQty[months[mi-1]]||0) : null;
                      const diff = prev != null ? qty - prev : null;
                      return <td key={m} className="px-3 py-2 text-right">{qty||<span className="text-gray-300">0</span>}{diff != null && diff !== 0 && <span className={`text-xs ml-0.5 ${diff > 0 ? 'text-red-500' : 'text-blue-500'}`}>{diff > 0 ? '▲' : '▼'}{Math.abs(diff)}</span>}</td>;
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

export default SharedStats;

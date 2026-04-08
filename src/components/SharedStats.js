import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { fmt } from '../utils/calculations';
import { mergeLedgerWithSeed, filterForStats } from '../utils/mergeLedger';
import { buildHospitalMeta } from '../utils/hospitalMeta';

function calcChange(c, p) {
  if (p === 0 || p == null) return c > 0 ? { val: c, pct: null } : { val: 0, pct: null };
  return { val: c - p, pct: (((c - p) / p) * 100).toFixed(1) };
}
function CI({ change, unit = '' }) {
  if (!change || (change.val === 0 && change.pct === null)) return null;
  const color = change.val > 0 ? 'text-red-500' : change.val < 0 ? 'text-blue-500' : 'text-gray-400';
  return <span className={`text-xs ${color} ml-1`}>{change.val > 0 ? '▲' : change.val < 0 ? '▼' : ''}{change.pct != null ? `${Math.abs(parseFloat(change.pct))}%` : `${Math.abs(change.val)}${unit}`}</span>;
}

const SharedStats = () => {
  const { ledger, hospitals, firebaseReady, firebaseError, statsMemo, products } = useData();
  const [activeSection, setActiveSection] = useState('qty');

  const hospitalMeta = useMemo(() => buildHospitalMeta(hospitals), [hospitals]);

  const mergedLedger = useMemo(() => filterForStats(mergeLedgerWithSeed(ledger), products), [ledger, products]);

  if (!firebaseReady) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" /><p className="text-gray-500 text-sm">데이터를 불러오는 중...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div><h1 className="text-xl font-bold text-gray-800">매출청구 통계</h1><p className="text-xs text-gray-400 mt-0.5">㈜타이로스코프 · Glandy CAS / EXO · 읽기 전용</p></div>
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${firebaseError ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
            <div className={`w-2 h-2 rounded-full ${firebaseError ? 'bg-yellow-500' : 'bg-green-500'}`} />{firebaseError ? 'localStorage 모드' : '실시간 동기화'}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
          <span className="font-semibold">발생기준:</span> 해당 월에 실제 처방이 발생한 건수 / <span className="font-semibold">청구기준:</span> 해당 월에 청구서를 발행한 건수
        </div>
        <div className="flex gap-1 bg-white rounded-lg shadow p-1">
          {[{ key: 'qty', label: '청구 건수' }, { key: 'revenue', label: '매출' }, { key: 'salesRep', label: '영업담당자별' }].map(t => (
            <button key={t.key} onClick={() => setActiveSection(t.key)}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium ${activeSection === t.key ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{t.label}</button>
          ))}
        </div>
        {statsMemo && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><p className="text-xs font-semibold text-amber-700">청구 이월 메모</p><p className="mt-1 text-xs text-amber-700 whitespace-pre-wrap">{statsMemo}</p></div>}
        {activeSection === 'qty' && <SQty ledger={mergedLedger} meta={hospitalMeta} products={products} />}
        {activeSection === 'revenue' && <SRevenue ledger={mergedLedger} meta={hospitalMeta} products={products} />}
        {activeSection === 'salesRep' && <SSalesRep ledger={mergedLedger} meta={hospitalMeta} products={products} />}
      </main>
      <footer className="bg-white border-t border-gray-200 mt-8"><div className="max-w-6xl mx-auto px-4 py-4 text-center text-xs text-gray-400">㈜타이로스코프 매출청구 관리 · 읽기 전용</div></footer>
    </div>
  );
};

function useYT(ledger) {
  const [basisType, setBasisType] = useState('occurrence');
  const mk = basisType === 'occurrence' ? '발생기준' : '청구기준';
  const years = useMemo(() => [...new Set(ledger.map(i => ((i[mk]||i['청구기준'])||'').slice(0,4)))].filter(Boolean).sort(), [ledger, mk]);
  const [sy, setSy] = useState(() => years[years.length-1]||'');
  const ey = years.includes(sy) ? sy : (years[years.length-1]||'');
  const yd = useMemo(() => ey ? ledger.filter(i => ((i[mk]||i['청구기준'])||'').startsWith(ey)) : ledger, [ledger, ey, mk]);
  const ms = useMemo(() => [...new Set(yd.map(i => i[mk]||i['청구기준']))].filter(Boolean).sort(), [yd, mk]);
  return { basisType, setBasisType, mk, years, sy: ey, setSy, yd, ms };
}

function FB({ years, sy, setSy, basisType, setBasisType, pf, setPf, extra, products }) {
  return (<div className="bg-white rounded-lg shadow p-4"><div className="flex flex-wrap items-center gap-3">
    <div className="flex gap-1">{years.map(y => <button key={y} onClick={() => setSy(y)} className={`px-4 py-1.5 rounded-md text-sm font-medium ${sy === y ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{y}</button>)}</div>
    <div className="w-px h-6 bg-gray-300" />
    <div className="flex gap-1 bg-gray-100 rounded-md p-0.5">
      <button onClick={() => setBasisType('occurrence')} className={`px-3 py-1 rounded text-xs font-medium ${basisType === 'occurrence' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>발생기준</button>
      <button onClick={() => setBasisType('billing')} className={`px-3 py-1 rounded text-xs font-medium ${basisType === 'billing' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>청구기준</button>
    </div>
    <select value={pf} onChange={e => setPf(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm">
      <option value="">전체 제품</option>{(products || []).map(p => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
    {extra}
  </div></div>);
}

function SQty({ ledger, meta, products }) {
  const { basisType, setBasisType, mk, years, sy, setSy, yd, ms } = useYT(ledger);
  const [pf, setPf] = useState(''); const [tf, setTf] = useState(''); const [df, setDf] = useState('');
  const f = useMemo(() => yd.filter(i => { if (pf && i['제품명']!==pf) return false; if (tf && (meta[i['거래처명']]||{}).type!==tf) return false; if (df && i['진료과']!==df) return false; return true; }), [yd, pf, tf, df, meta]);
  const hs = useMemo(() => { const m = {}; f.forEach(i => { const h=i['거래처명']; if(!h) return; const mt=meta[h]||{}; const mo=i[mk]||i['청구기준']; if(!m[h]) m[h]={hospital:h,type:mt.type||'',dept:mt.department||'',total:0,months:{}}; m[h].months[mo]=(m[h].months[mo]||0)+(i['최종건수']||0); m[h].total+=i['최종건수']||0; }); return Object.values(m).sort((a,b)=>b.total-a.total); }, [f, mk, meta]);
  const gt = hs.reduce((s,h) => s+h.total, 0);
  return (<div className="space-y-4">
    <FB years={years} sy={sy} setSy={setSy} basisType={basisType} setBasisType={setBasisType} pf={pf} setPf={setPf} products={products}
      extra={<><select value={tf} onChange={e=>setTf(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"><option value="">전체 구분</option><option value="상급">상급</option><option value="로컬">로컬</option></select>
        <select value={df} onChange={e=>setDf(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"><option value="">전체 진료과</option><option value="안과">안과</option><option value="내과">내과</option></select></>} />
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">거래처 수</p><p className="text-2xl font-bold text-gray-800">{hs.length}<span className="text-sm font-normal text-gray-400">곳</span></p></div>
      <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">총 건수</p><p className="text-2xl font-bold text-blue-600">{fmt(gt)}<span className="text-sm font-normal text-gray-400">건</span></p></div>
      <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">거래처당 평균</p><p className="text-2xl font-bold text-gray-700">{hs.length>0?Math.round(gt/hs.length):0}<span className="text-sm font-normal text-gray-400">건</span></p></div>
    </div>
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-3 border-b"><h3 className="text-sm font-semibold text-gray-700">{sy}년 청구 건수 <span className="text-xs font-normal text-gray-400">({basisType==='occurrence'?'발생':'청구'}기준)</span></h3></div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto"><table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 sticky top-0"><tr>
          <th className="table-header px-3 py-2 text-center w-10">순위</th><th className="table-header px-3 py-2 text-left">거래처명</th><th className="table-header px-3 py-2 text-center">구분</th><th className="table-header px-3 py-2 text-center">진료과</th>
          {ms.map(m=><th key={m} className="table-header px-3 py-2 text-right">{m.slice(5)}월</th>)}
          <th className="table-header px-3 py-2 text-right bg-blue-50">누계</th><th className="table-header px-3 py-2 text-right font-bold">합계</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-200">
          {hs.map((h,i) => { let c=0; return (<tr key={h.hospital} className="hover:bg-gray-50">
            <td className="px-3 py-2 text-center text-gray-400 text-xs">{i+1}</td>
            <td className="px-3 py-2 font-medium whitespace-nowrap">{h.hospital}</td>
            <td className="px-3 py-2 text-center"><span className={`text-xs px-1.5 py-0.5 rounded ${h.type==='상급'?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-600'}`}>{h.type}</span></td>
            <td className="px-3 py-2 text-center text-xs text-gray-500">{h.dept}</td>
            {ms.map(m=>{c+=h.months[m]||0; return <td key={m} className={`px-3 py-2 text-right ${h.months[m]?'':'text-gray-300'}`}>{h.months[m]||0}</td>;})}
            <td className="px-3 py-2 text-right bg-blue-50 font-medium text-blue-700">{c}</td>
            <td className="px-3 py-2 text-right font-bold">{h.total}</td>
          </tr>);})}
        </tbody>
      </table></div>
    </div>
  </div>);
}

function SRevenue({ ledger, meta, products }) {
  const { basisType, setBasisType, mk, years, sy, setSy, yd, ms } = useYT(ledger);
  const [pf, setPf] = useState(''); const [tf, setTf] = useState('');
  const f = useMemo(() => { let d = pf ? yd.filter(i=>i['제품명']===pf) : yd; if (tf) d=d.filter(i=>(meta[i['거래처명']]||{}).type===tf); return d; }, [yd, pf, tf, meta]);
  const hs = useMemo(() => { const m={}; f.forEach(i=>{ const h=i['거래처명']; if(!h) return; const mt=meta[h]||{}; if(!m[h]) m[h]={hospital:h,type:mt.type||'',revenue:0,qty:0}; m[h].revenue+=i['공급가']||0; m[h].qty+=i['최종건수']||0; }); return Object.values(m).sort((a,b)=>b.revenue-a.revenue); }, [f, meta]);
  const gr = hs.reduce((s,h)=>s+h.revenue,0); const gq = hs.reduce((s,h)=>s+h.qty,0);
  const sg = hs.filter(h=>h.type==='상급'); const lc = hs.filter(h=>h.type==='로컬');
  return (<div className="space-y-4">
    <FB years={years} sy={sy} setSy={setSy} basisType={basisType} setBasisType={setBasisType} pf={pf} setPf={setPf} products={products}
      extra={<select value={tf} onChange={e=>setTf(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"><option value="">전체 구분</option><option value="상급">상급</option><option value="로컬">로컬</option></select>} />
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">총 매출 <span className="text-orange-400">(공급가액)</span></p><p className="text-2xl font-bold text-gray-800">{fmt(gr)}<span className="text-sm font-normal text-gray-400">원</span></p></div>
      <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">총 건수</p><p className="text-2xl font-bold text-blue-600">{fmt(gq)}<span className="text-sm font-normal text-gray-400">건</span></p></div>
      <div className="bg-white rounded-lg shadow p-4"><p className="text-xs text-gray-500">거래처당 평균</p><p className="text-2xl font-bold text-gray-700">{hs.length>0?fmt(Math.round(gr/hs.length)):'0'}<span className="text-sm font-normal text-gray-400">원</span></p></div>
    </div>
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-3 border-b"><h3 className="text-sm font-semibold text-gray-700">{sy}년 매출 <span className="text-xs font-normal text-orange-500 ml-1">공급가액 기준</span></h3></div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto"><table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 sticky top-0"><tr>
          <th className="table-header px-3 py-2 text-center w-10">순위</th><th className="table-header px-3 py-2 text-left">거래처명</th><th className="table-header px-3 py-2 text-center">구분</th>
          <th className="table-header px-3 py-2 text-right">건수</th><th className="table-header px-3 py-2 text-right font-bold">매출(공급가)</th><th className="table-header px-3 py-2 text-right">비율</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-200">
          {hs.map((h,i)=><tr key={h.hospital} className="hover:bg-gray-50">
            <td className="px-3 py-2 text-center text-gray-400 text-xs">{i+1}</td><td className="px-3 py-2 font-medium whitespace-nowrap">{h.hospital}</td>
            <td className="px-3 py-2 text-center"><span className={`text-xs px-1.5 py-0.5 rounded ${h.type==='상급'?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-600'}`}>{h.type}</span></td>
            <td className="px-3 py-2 text-right">{fmt(h.qty)}</td><td className="px-3 py-2 text-right font-bold">{fmt(h.revenue)}</td>
            <td className="px-3 py-2 text-right text-gray-500">{gr>0?`${((h.revenue/gr)*100).toFixed(1)}%`:'-'}</td></tr>)}
          <tr className="bg-purple-50 font-semibold text-purple-700"><td className="px-3 py-2"/><td className="px-3 py-2">상급 소계 ({sg.length}곳)</td><td className="px-3 py-2"/>
            <td className="px-3 py-2 text-right">{fmt(sg.reduce((s,h)=>s+h.qty,0))}</td><td className="px-3 py-2 text-right">{fmt(sg.reduce((s,h)=>s+h.revenue,0))}</td>
            <td className="px-3 py-2 text-right">{gr>0?`${((sg.reduce((s,h)=>s+h.revenue,0)/gr)*100).toFixed(1)}%`:'-'}</td></tr>
          <tr className="bg-gray-100 font-semibold text-gray-600"><td className="px-3 py-2"/><td className="px-3 py-2">로컬 소계 ({lc.length}곳)</td><td className="px-3 py-2"/>
            <td className="px-3 py-2 text-right">{fmt(lc.reduce((s,h)=>s+h.qty,0))}</td><td className="px-3 py-2 text-right">{fmt(lc.reduce((s,h)=>s+h.revenue,0))}</td>
            <td className="px-3 py-2 text-right">{gr>0?`${((lc.reduce((s,h)=>s+h.revenue,0)/gr)*100).toFixed(1)}%`:'-'}</td></tr>
          <tr className="bg-blue-50 font-bold"><td className="px-3 py-2"/><td className="px-3 py-2">합계</td><td className="px-3 py-2"/>
            <td className="px-3 py-2 text-right">{fmt(gq)}</td><td className="px-3 py-2 text-right">{fmt(gr)}</td><td className="px-3 py-2 text-right">100%</td></tr>
        </tbody>
      </table></div>
    </div>
  </div>);
}

function SSalesRep({ ledger, meta, products }) {
  const { basisType, setBasisType, mk, years, sy, setSy, yd, ms } = useYT(ledger);
  const [pf, setPf] = useState('');
  const f = useMemo(() => pf ? yd.filter(i=>i['제품명']===pf) : yd, [yd, pf]);
  const rs = useMemo(() => { const m={}; f.forEach(i=>{ const rep=(meta[i['거래처명']]||{}).salesRep; if(!rep) return; if(!m[rep]) m[rep]={rep,revenue:0,qty:0,hc:new Set(),mq:{},hd:{}}; m[rep].revenue+=i['공급가']||0; m[rep].qty+=i['최종건수']||0; m[rep].hc.add(i['거래처명']); const mo=i[mk]||i['청구기준']; m[rep].mq[mo]=(m[rep].mq[mo]||0)+(i['최종건수']||0); const hn=i['거래처명']; if(!m[rep].hd[hn]) m[rep].hd[hn]={hospital:hn,type:(meta[hn]||{}).type||'',revenue:0,qty:0,mq:{}}; m[rep].hd[hn].revenue+=i['공급가']||0; m[rep].hd[hn].qty+=i['최종건수']||0; m[rep].hd[hn].mq[mo]=(m[rep].hd[hn].mq[mo]||0)+(i['최종건수']||0); }); return Object.values(m).map(r=>({...r,hc:r.hc.size,hl:Object.values(r.hd).sort((a,b)=>b.revenue-a.revenue)})).sort((a,b)=>b.revenue-a.revenue); }, [f, meta, mk]);
  const gr = rs.reduce((s,r)=>s+r.revenue,0);
  return (<div className="space-y-4">
    <FB years={years} sy={sy} setSy={setSy} basisType={basisType} setBasisType={setBasisType} pf={pf} setPf={setPf} products={products} />
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-3 border-b"><h3 className="text-sm font-semibold text-gray-700">{sy}년 담당자별 실적 <span className="text-xs font-normal text-orange-500 ml-1">공급가액 기준</span></h3></div>
      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50"><tr>
          <th className="table-header px-4 py-3 text-left">담당자</th><th className="table-header px-3 py-3 text-right">거래처</th>
          {ms.map(m=><th key={m} className="table-header px-3 py-3 text-right">{m.slice(5)}월</th>)}
          <th className="table-header px-3 py-3 text-right">건수</th><th className="table-header px-3 py-3 text-right font-bold">매출</th><th className="table-header px-3 py-3 text-right">비율</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-200">
          {rs.map(r=><tr key={r.rep} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium">{r.rep}</td><td className="px-3 py-3 text-right">{r.hc}곳</td>
            {ms.map((m,mi)=>{const q=r.mq[m]||0;const p=mi>0?(r.mq[ms[mi-1]]||0):null; return <td key={m} className="px-3 py-3 text-right">{q}<CI change={p!=null?calcChange(q,p):null} unit="건"/></td>;})}
            <td className="px-3 py-3 text-right">{fmt(r.qty)}</td><td className="px-3 py-3 text-right font-bold">{fmt(r.revenue)}</td>
            <td className="px-3 py-3 text-right text-gray-500">{gr>0?`${((r.revenue/gr)*100).toFixed(1)}%`:'-'}</td></tr>)}
        </tbody>
      </table></div>
    </div>
    {rs.map(r=><div key={r.rep} className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-5 py-2 border-b bg-gray-50"><span className="text-sm font-semibold text-gray-700">{r.rep}</span><span className="ml-2 text-xs text-gray-400">{r.hc}곳 · {fmt(r.revenue)}원</span></div>
      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50"><tr>
          <th className="table-header px-4 py-2 text-left">거래처명</th><th className="table-header px-3 py-2 text-center">구분</th>
          {ms.map(m=><th key={m} className="table-header px-3 py-2 text-right">{m.slice(5)}월</th>)}
          <th className="table-header px-3 py-2 text-right">건수</th><th className="table-header px-3 py-2 text-right">매출</th>
        </tr></thead>
        <tbody className="divide-y divide-gray-200">
          {r.hl.map(h=><tr key={h.hospital} className="hover:bg-gray-50">
            <td className="px-4 py-2 whitespace-nowrap">{h.hospital}</td>
            <td className="px-3 py-2 text-center"><span className={`text-xs px-1.5 py-0.5 rounded ${h.type==='상급'?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-600'}`}>{h.type}</span></td>
            {ms.map((m,mi)=>{const q=h.mq[m]||0;const p=mi>0?(h.mq[ms[mi-1]]||0):null;const d=p!=null?q-p:null; return <td key={m} className="px-3 py-2 text-right">{q||<span className="text-gray-300">0</span>}{d!=null&&d!==0&&<span className={`text-xs ml-0.5 ${d>0?'text-red-500':'text-blue-500'}`}>{d>0?'▲':'▼'}{Math.abs(d)}</span>}</td>;})}
            <td className="px-3 py-2 text-right font-medium">{fmt(h.qty)}</td><td className="px-3 py-2 text-right font-medium">{fmt(h.revenue)}</td>
          </tr>)}
        </tbody>
      </table></div>
    </div>)}
  </div>);
}

export default SharedStats;

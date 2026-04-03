import React, { useState, useRef } from 'react';
import { useData } from '../context/DataContext';
import { fmt, calculateDday } from '../utils/calculations';
import BillingGuide from './BillingGuide';

const DateInput = ({ value, onCommit }) => {
  const [local, setLocal] = useState(value || '');
  const prevValue = useRef(value || '');

  if ((value || '') !== prevValue.current) {
    prevValue.current = value || '';
    setLocal(value || '');
  }

  return (
    <input
      type="date"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => {
        if (local && local !== (value || '')) {
          onCommit(local);
        }
      }}
      className="border rounded px-2 py-1 text-xs w-32"
    />
  );
};

const Ledger = () => {
  const { ledger, updateLedgerEntry } = useData();
  const [nameFilter, setNameFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleExpand = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const months = [...new Set(ledger.map(i => i['청구기준']))].filter(Boolean).sort();

  // 미수금이 있거나 아직 완납 아닌 건만 대상
  const filtered = ledger.filter(item =>
    item['거래처명'].includes(nameFilter) &&
    (monthFilter === '' || item['청구기준'] === monthFilter)
  );

  const activeItems = filtered
    .filter(item => item['채권상태'] !== '완납')
    .sort((a, b) => {
      const ddayA = calculateDday(a['입금예정일']);
      const ddayB = calculateDday(b['입금예정일']);
      if (ddayA === null && ddayB === null) return 0;
      if (ddayA === null) return 1;
      if (ddayB === null) return -1;
      return ddayB - ddayA;
    });

  const completedItems = filtered.filter(item => item['채권상태'] === '완납');

  const outstandingTotal = activeItems.reduce((s, i) => s + (i['미수금'] || 0), 0);
  const overdueItems = activeItems.filter(i => {
    const d = calculateDday(i['입금예정일']);
    return d !== null && d > 0;
  });
  const overdueTotal = overdueItems.reduce((s, i) => s + (i['미수금'] || 0), 0);

  const handleStatusChange = (item, newStatus) => {
    const updates = { '채권상태': newStatus };
    if (newStatus === '완납') {
      updates['미수금'] = 0;
      updates['실제입금일'] = new Date().toISOString().slice(0, 10);
    } else if (item['채권상태'] === '완납') {
      updates['미수금'] = item['청구금액'] || 0;
      updates['실제입금일'] = '';
    }
    updateLedgerEntry(item._id, updates);
  };

  const handlePaymentDate = (item, date) => {
    updateLedgerEntry(item._id, {
      '실제입금일': date,
      '채권상태': '완납',
      '미수금': 0,
    });
  };

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">총 미수금</p>
          <p className={`text-2xl font-bold ${outstandingTotal > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {fmt(outstandingTotal)}원
          </p>
          <p className="text-xs text-gray-400 mt-1">{activeItems.length}건 진행 중</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">연체 미수금</p>
          <p className={`text-2xl font-bold ${overdueTotal > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {fmt(overdueTotal)}원
          </p>
          <p className="text-xs text-gray-400 mt-1">{overdueItems.length}건 연체</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">완납 처리</p>
          <p className="text-2xl font-bold text-green-600">{completedItems.length}건</p>
          <p className="text-xs text-gray-400 mt-1">
            {fmt(completedItems.reduce((s, i) => s + (i['청구금액'] || 0), 0))}원
          </p>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">청구기준</label>
          <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">전체</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">거래처명</label>
          <input type="text" placeholder="검색..." value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </div>
      </div>

      {/* 미수금 진행 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b bg-red-50">
          <h3 className="text-sm font-semibold text-red-700">
            미수금 진행 <span className="text-red-400 font-normal ml-1">{activeItems.length}건 · {fmt(outstandingTotal)}원</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['', '청구기준', '거래처명', '제품', '건수', '청구금액', '미수금', '예정일', 'D-day', '상태', '입금일'].map(h => (
                  <th key={h} className="table-header px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeItems.map((item) => {
                const dday = calculateDday(item['입금예정일']);
                const steps = item['청구단계'] || { step1: false, step2: false, step3: false, step4: false };
                const stepValues = [steps.step1, steps.step2, steps.step3, steps.step4];
                const isExpanded = expandedRows.has(item._id);
                return (
                  <React.Fragment key={item._id}>
                    <tr className={`hover:bg-gray-50 ${dday > 0 ? 'bg-red-50' : ''}`}>
                      <td className="table-cell px-2">
                        <button onClick={() => toggleExpand(item._id)}
                          className="flex items-center gap-1.5 text-gray-400 hover:text-blue-500 transition-colors">
                          <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                          <div className="flex gap-0.5">
                            {stepValues.map((v, i) => (
                              <div key={i} className={`w-1.5 h-1.5 rounded-full ${v ? 'bg-green-500' : 'bg-gray-300'}`} />
                            ))}
                          </div>
                        </button>
                      </td>
                      <td className="table-cell text-xs">{item['청구기준']}</td>
                      <td className="table-cell font-medium text-sm">{item['거래처명']}</td>
                      <td className="table-cell text-xs">{item['제품명']}</td>
                      <td className="table-cell text-right text-xs">{item['최종건수']}</td>
                      <td className="table-cell text-right text-sm">{fmt(item['청구금액'])}원</td>
                      <td className={`table-cell text-right text-sm ${item['미수금'] > 0 ? 'text-red-600 font-semibold' : ''}`}>
                        {fmt(item['미수금'])}원
                      </td>
                      <td className="table-cell text-xs">{item['입금예정일']}</td>
                      <td className="table-cell text-center">
                        {dday !== null && (
                          <span className={`badge ${dday > 0 ? 'badge-red' : dday > -7 ? 'badge-yellow' : 'badge-blue'}`}>
                            {dday > 0 ? `D+${dday}` : `D${dday}`}
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        <select value={item['채권상태']}
                          onChange={e => handleStatusChange(item, e.target.value)}
                          className="border rounded px-2 py-1 text-xs border-gray-300">
                          <option value="정상">정상</option>
                          <option value="완납">완납</option>
                          <option value="청구확정">청구확정</option>
                          <option value="미청구">미청구</option>
                          <option value="연체">연체</option>
                        </select>
                      </td>
                      <td className="table-cell">
                        <DateInput
                          value={item['실제입금일']}
                          onCommit={date => handlePaymentDate(item, date)}
                        />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={11} className="p-0 bg-gray-50 border-b border-blue-100">
                          <BillingGuide entry={item} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {activeItems.length === 0 && (
                <tr><td colSpan={11} className="text-center text-gray-400 py-8 text-sm">미수금이 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 완납 이력 */}
      {completedItems.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <button
            onClick={() => setShowCompleted(prev => !prev)}
            className="w-full px-4 py-3 border-b bg-green-50 flex items-center justify-between text-left hover:bg-green-100 transition-colors"
          >
            <h3 className="text-sm font-semibold text-green-700">
              완납 이력 <span className="font-normal ml-1">{completedItems.length}건</span>
              <span className="font-normal text-green-500 ml-2">
                {fmt(completedItems.reduce((s, i) => s + (i['청구금액'] || 0), 0))}원
              </span>
            </h3>
            <span className="text-green-500 text-xs">{showCompleted ? '접기' : '펼치기'}</span>
          </button>
          {showCompleted && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['청구기준', '거래처명', '제품', '건수', '청구금액', '입금일', '상태'].map(h => (
                      <th key={h} className="table-header px-3 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {completedItems.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="table-cell text-xs">{item['청구기준']}</td>
                      <td className="table-cell font-medium text-sm">{item['거래처명']}</td>
                      <td className="table-cell text-xs">{item['제품명']}</td>
                      <td className="table-cell text-right text-xs">{item['최종건수']}</td>
                      <td className="table-cell text-right text-sm">{fmt(item['청구금액'])}원</td>
                      <td className="table-cell text-xs text-green-600">{item['실제입금일']}</td>
                      <td className="table-cell">
                        <select value={item['채권상태']}
                          onChange={e => handleStatusChange(item, e.target.value)}
                          className="border rounded px-2 py-1 text-xs bg-green-50 border-green-300">
                          <option value="정상">정상</option>
                          <option value="완납">완납</option>
                          <option value="청구확정">청구확정</option>
                          <option value="미청구">미청구</option>
                          <option value="연체">연체</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Ledger;

import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { fmt, calculateDday } from '../utils/calculations';
import BillingEntryForm from './forms/BillingEntryForm';

const statusBadge = (status) => {
  const map = {
    '완납': 'badge badge-green', '정상': 'badge badge-blue',
    '미청구': 'badge badge-yellow', '청구확정': 'badge badge-blue',
    '입금완료': 'badge badge-green', '연체': 'badge badge-red',
  };
  return map[status] || 'badge badge-gray';
};

const Ledger = () => {
  const { ledger, updateLedgerEntry, deleteLedgerEntry, generateMonthlyEntries } = useData();
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genMonth, setGenMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [editEntry, setEditEntry] = useState(null);

  const statuses = [...new Set(ledger.map(i => i['채권상태']))].filter(Boolean);
  const months = [...new Set(ledger.map(i => i['청구기준']))].filter(Boolean).sort();

  const filtered = ledger.filter(item =>
    item['거래처명'].includes(nameFilter) &&
    (statusFilter === '' || item['채권상태'] === statusFilter) &&
    (monthFilter === '' || item['청구기준'] === monthFilter)
  );

  const totalFiltered = filtered.reduce((s, i) => s + (i['청구금액'] || 0), 0);
  const outstandingFiltered = filtered.reduce((s, i) => s + (i['미수금'] || 0), 0);

  const handleStatusChange = (item, newStatus) => {
    const updates = { '채권상태': newStatus };
    if (newStatus === '완납') {
      updates['미수금'] = 0;
      updates['실제입금일'] = new Date().toISOString().slice(0, 10);
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

  const handleEdit = (item) => {
    setEditEntry(item);
    setShowForm(true);
  };

  const handleDelete = (item) => {
    if (window.confirm(`${item['거래처명']} - ${item['청구기준']} 건을 삭제하시겠습니까?`)) {
      deleteLedgerEntry(item._id);
    }
  };

  return (
    <div className="space-y-4">
      {/* 필터 + 추가 버튼 */}
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
        <div>
          <label className="block text-xs text-gray-500 mb-1">채권상태</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm">
            <option value="">전체</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {filtered.length}건 | 청구 {fmt(totalFiltered)}원 | 미수 <span className="text-red-600 font-semibold">{fmt(outstandingFiltered)}원</span>
          </span>
          <button onClick={() => setShowGenerate(true)}
            className="bg-green-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-600">
            월별 자동 생성
          </button>
          <button onClick={() => { setEditEntry(null); setShowForm(true); }}
            className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
            + 매출 입력
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['청구기준', '발생기준', '거래처명', '제품', '건수', '청구금액', '미수금', '예정일', 'D-day', '상태', '입금일', ''].map(h => (
                  <th key={h} className="table-header px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((item) => {
                const dday = calculateDday(item['입금예정일']);
                return (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="table-cell text-xs">{item['청구기준']}</td>
                    <td className="table-cell text-xs">{item['발생기준']}</td>
                    <td className="table-cell font-medium text-sm">{item['거래처명']}</td>
                    <td className="table-cell text-xs">{item['제품명']}</td>
                    <td className="table-cell text-right text-xs">{item['최종건수']}</td>
                    <td className="table-cell text-right text-sm">{fmt(item['청구금액'])}원</td>
                    <td className={`table-cell text-right text-sm ${item['미수금'] > 0 ? 'text-red-600 font-semibold' : ''}`}>
                      {fmt(item['미수금'])}원
                    </td>
                    <td className="table-cell text-xs">{item['입금예정일']}</td>
                    <td className="table-cell text-center">
                      {dday !== null && item['채권상태'] !== '완납' && (
                        <span className={`badge ${dday > 0 ? 'badge-red' : dday > -7 ? 'badge-yellow' : 'badge-blue'}`}>
                          {dday > 0 ? `D+${dday}` : `D${dday}`}
                        </span>
                      )}
                    </td>
                    <td className="table-cell">
                      <select value={item['채권상태']}
                        onChange={e => handleStatusChange(item, e.target.value)}
                        className={`border rounded px-2 py-1 text-xs ${
                          item['채권상태'] === '완납' ? 'bg-green-50 border-green-300' : 'border-gray-300'
                        }`}>
                        <option value="정상">정상</option>
                        <option value="완납">완납</option>
                        <option value="청구확정">청구확정</option>
                        <option value="미청구">미청구</option>
                        <option value="연체">연체</option>
                      </select>
                    </td>
                    <td className="table-cell">
                      {item['채권상태'] !== '완납' ? (
                        <input type="date" value={item['실제입금일'] || ''}
                          onChange={e => handlePaymentDate(item, e.target.value)}
                          className="border rounded px-2 py-1 text-xs w-32" />
                      ) : (
                        <span className="text-xs text-green-600">{item['실제입금일']}</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(item)}
                          className="text-xs text-blue-500 hover:text-blue-700">수정</button>
                        <button onClick={() => handleDelete(item)}
                          className="text-xs text-red-400 hover:text-red-600">삭제</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <BillingEntryForm
          onClose={() => { setShowForm(false); setEditEntry(null); }}
          editEntry={editEntry}
        />
      )}

      {/* 월별 자동 생성 모달 */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">월별 청구 자동 생성</h3>
              <button onClick={() => setShowGenerate(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                등록된 모든 거래처에 대해 선택한 월의 청구 틀을 자동으로 생성합니다.
                이미 해당 월에 데이터가 있는 거래처는 건너뜁니다.
              </p>
              <div>
                <label className="block text-sm text-gray-600 mb-1">청구기준 월</label>
                <input type="month" value={genMonth}
                  onChange={e => setGenMonth(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-700">
                생성 후 각 거래처의 병원수량을 입력하면 금액이 자동 계산됩니다.
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowGenerate(false)}
                  className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50">취소</button>
                <button onClick={() => {
                  const count = generateMonthlyEntries(genMonth);
                  if (count > 0) {
                    alert(`${genMonth} 청구 데이터 ${count}건이 생성되었습니다.`);
                    setMonthFilter(genMonth);
                  } else {
                    alert(`${genMonth}에 이미 모든 거래처 데이터가 존재합니다.`);
                  }
                  setShowGenerate(false);
                }}
                  className="px-4 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600">
                  자동 생성
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ledger;

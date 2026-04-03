import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { fmt, calculateDday } from '../utils/calculations';
import useLocalStorage from '../hooks/useLocalStorage';
import EmailSendModal from './EmailSendModal';

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
  const { ledger, hospitals, updateLedgerEntry } = useData();
  const [nameFilter, setNameFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [emailHistory, setEmailHistory] = useLocalStorage('billing_email_history', []);
  const [showEmailModal, setShowEmailModal] = useState(null);
  const [emailToast, setEmailToast] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

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

  // 병원별 이메일 정보 매핑
  const hospitalEmailMap = useMemo(() => {
    const map = {};
    hospitals.forEach(h => {
      if (!map[h['거래처명']]) {
        map[h['거래처명']] = {
          email: h['병원담당자이메일'] || '',
          contactName: h['병원담당자명'] || '',
          emailType: h['이메일유형'] || '회신 요청',
        };
      }
    });
    return map;
  }, [hospitals]);

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

  // 이메일 모달용 정보
  const emailModalInfo = useMemo(() => {
    if (!showEmailModal) return null;
    const item = showEmailModal;
    const hospitalName = item['거래처명'];
    const info = hospitalEmailMap[hospitalName];
    if (!info) return null;
    const billingMonth = item['청구기준'];
    const [year, month] = billingMonth ? billingMonth.split('-') : ['', ''];
    let casCount = 0, exoCount = 0;
    if (info.emailType === '건수 안내') {
      ledger.filter(l => l['청구기준'] === billingMonth && l['거래처명'] === hospitalName).forEach(l => {
        const count = parseInt(l['최종건수']) || 0;
        if (l['제품명'] === 'CAS') casCount += count;
        else if (l['제품명'] === 'EXO') exoCount += count;
      });
    }
    return { hospitalName, email: info.email, contactName: info.contactName,
             emailType: info.emailType, year, month, casCount, exoCount,
             totalCount: casCount + exoCount, billingMonth };
  }, [showEmailModal, hospitalEmailMap, ledger]);

  const openEmailModal = (item) => {
    const info = hospitalEmailMap[item['거래처명']];
    if (!info || !info.email) {
      setEmailToast({ success: false, message: `${item['거래처명']}의 이메일이 등록되지 않았습니다.\n거래처 관리에서 이메일을 등록해주세요.` });
      setTimeout(() => setEmailToast(null), 4000);
      return;
    }
    setShowEmailModal(item);
  };

  const handleEmailSent = (historyEntry) => {
    setEmailHistory(prev => [historyEntry, ...prev]);
    setEmailToast({ success: historyEntry.결과 === '성공', message: historyEntry.메시지 });
    setTimeout(() => setEmailToast(null), 4000);
  };

  return (
    <div className="space-y-4">
      {/* 발송 결과 토스트 */}
      {emailToast && (
        <div className={`fixed top-4 right-4 z-[60] max-w-sm px-4 py-3 rounded-lg shadow-lg border text-sm ${
          emailToast.success ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'
        }`}>
          <div className="flex items-start gap-2">
            <span className="text-lg">{emailToast.success ? '✅' : '❌'}</span>
            <div>
              <p className="font-medium">{emailToast.success ? '발송 완료' : '발송 실패'}</p>
              <p className="text-xs mt-0.5 whitespace-pre-line">{emailToast.message}</p>
            </div>
            <button onClick={() => setEmailToast(null)} className="ml-2 text-gray-400 hover:text-gray-600">&times;</button>
          </div>
        </div>
      )}

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

      {/* 필터 + 발송이력 버튼 */}
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
        <div className="ml-auto">
          <button onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            📧 발송 이력 <span className="text-xs text-gray-400">({emailHistory.length})</span>
          </button>
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
                {['청구기준', '거래처명', '제품', '건수', '청구금액', '미수금', '예정일', 'D-day', '상태', '입금일', '메일'].map(h => (
                  <th key={h} className="table-header px-3 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeItems.map((item) => {
                const dday = calculateDday(item['입금예정일']);
                const info = hospitalEmailMap[item['거래처명']];
                const hasEmail = info && info.email;
                return (
                  <tr key={item._id} className={`hover:bg-gray-50 ${dday > 0 ? 'bg-red-50' : ''}`}>
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
                    <td className="table-cell text-center">
                      <button
                        onClick={() => openEmailModal(item)}
                        title={hasEmail ? `${info.email} (${info.emailType})` : '이메일 미등록'}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          hasEmail
                            ? 'border-blue-300 text-blue-600 hover:bg-blue-50'
                            : 'border-gray-200 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        📧
                      </button>
                    </td>
                  </tr>
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

      {/* 이메일 발송 모달 (미리보기 + 발송) */}
      {showEmailModal && emailModalInfo && (
        <EmailSendModal
          info={emailModalInfo}
          onClose={() => setShowEmailModal(null)}
          onSent={handleEmailSent}
        />
      )}

      {/* 발송 이력 모달 */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">
                📧 메일 발송 이력 <span className="text-sm font-normal text-gray-400 ml-2">{emailHistory.length}건</span>
              </h3>
              <div className="flex items-center gap-2">
                {emailHistory.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm('발송 이력을 모두 삭제하시겠습니까?')) {
                        setEmailHistory([]);
                      }
                    }}
                    className="text-xs text-red-400 hover:text-red-600 border border-red-200 rounded px-2 py-1"
                  >
                    전체 삭제
                  </button>
                )}
                <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>
            </div>
            <div className="overflow-auto flex-1">
              {emailHistory.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm">
                  발송 이력이 없습니다
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {['발송일시', '거래처명', '이메일', '템플릿', '청구기준', '결과'].map(h => (
                        <th key={h} className="table-header px-3 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {emailHistory.map((entry) => (
                      <tr key={entry._id} className="hover:bg-gray-50">
                        <td className="table-cell text-xs text-gray-500">{entry.발송일시}</td>
                        <td className="table-cell font-medium text-sm">{entry.거래처명}</td>
                        <td className="table-cell text-xs text-gray-500">{entry.이메일}</td>
                        <td className="table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            entry.템플릿 === '회신 요청'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {entry.템플릿}
                          </span>
                        </td>
                        <td className="table-cell text-xs">{entry.청구기준}</td>
                        <td className="table-cell">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            entry.결과 === '성공'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {entry.결과}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ledger;

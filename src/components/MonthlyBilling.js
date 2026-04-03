import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { calculateVAT, calculateDueDate, fmt } from '../utils/calculations';
import BillingGuide from './BillingGuide';

// 수량 차이 허용 범위
const QTY_TOLERANCE = 20;

// 회사수량 vs 병원수량 비교 → 청구 기준 수량 자동 결정
function resolveQty(companyQty, hospitalQty) {
  const diff = Math.abs(companyQty - hospitalQty);
  if (diff <= QTY_TOLERANCE) {
    // 차이 20 이내 → 병원수량 기준 청구
    return { billingQty: hospitalQty, status: 'ok', diff };
  }
  // 차이 20 초과 → 확인 필요 (일단 병원수량 유지하되 경고)
  return { billingQty: hospitalQty, status: 'warn', diff };
}

const MonthlyBilling = () => {
  const { ledger, hospitals, updateLedgerEntry, deleteLedgerEntry, generateMonthlyEntries } = useData();

  const [billingMonth, setBillingMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // 해당 월 데이터만 필터
  const monthItems = useMemo(() =>
    ledger.filter(item => item['청구기준'] === billingMonth),
    [ledger, billingMonth]
  );

  const hasData = monthItems.length > 0;

  // 요약
  const summary = useMemo(() => {
    const total = monthItems.reduce((s, i) => s + (i['청구금액'] || 0), 0);
    const confirmed = monthItems.filter(i => i['수량확정'] === 'TRUE').length;
    const invoiced = monthItems.filter(i => i['계산서'] === 'TRUE').length;
    const qtyWarnings = monthItems.filter(i => {
      const c = parseInt(i['당월발생']) || 0;
      const h = parseInt(i['병원수량']) || 0;
      return c > 0 && h > 0 && resolveQty(c, h).status === 'warn';
    }).length;
    return { total, confirmed, invoiced, count: monthItems.length, qtyWarnings };
  }, [monthItems]);

  // 월별 자동 생성
  const handleGenerate = () => {
    const count = generateMonthlyEntries(billingMonth);
    if (count > 0) {
      alert(`${billingMonth} 청구 데이터 ${count}건이 생성되었습니다.\n각 거래처의 병원수량을 입력해 주세요.`);
    } else {
      alert(`${billingMonth}에 이미 모든 거래처 데이터가 존재합니다.`);
    }
  };

  // 수량 → 금액 재계산 공통 함수
  const recalcAmount = (item, overrides = {}) => {
    const merged = { ...item, ...overrides };
    const companyQty = parseInt(merged['당월발생']) || 0;
    const hospitalQty = parseInt(merged['병원수량']) || 0;
    const carryover = parseInt(merged['차월이월']) || 0;
    const prevMonth = parseInt(merged['전월반영']) || 0;

    // 회사 vs 병원 비교 → 청구 기준 수량 결정
    const { billingQty } = resolveQty(companyQty, hospitalQty);
    const finalCount = billingQty - carryover + prevMonth;
    const unitPrice = merged['단가'] || 0;
    const totalAmount = finalCount * unitPrice;
    const { supply, vat } = calculateVAT(totalAmount);

    return {
      ...overrides,
      '최종건수': finalCount,
      '공급가': supply,
      '부가세': vat,
      '청구금액': totalAmount,
      '미수금': totalAmount,
    };
  };

  // 회사수량 변경
  const handleCompanyQtyChange = (item, val) => {
    const updates = recalcAmount(item, { '당월발생': String(parseInt(val) || 0) });
    updateLedgerEntry(item._id, updates);
  };

  // 병원수량 변경
  const handleQtyChange = (item, newQty) => {
    const updates = recalcAmount(item, { '병원수량': String(parseInt(newQty) || 0) });
    updateLedgerEntry(item._id, updates);
  };

  // 차월이월 변경
  const handleCarryoverChange = (item, val) => {
    const updates = recalcAmount(item, { '차월이월': String(parseInt(val) || 0) });
    updateLedgerEntry(item._id, updates);
  };

  // 전월반영 변경
  const handlePrevMonthChange = (item, val) => {
    const updates = recalcAmount(item, { '전월반영': String(parseInt(val) || 0) });
    updateLedgerEntry(item._id, updates);
  };

  // 수량확정 토글
  const handleConfirmQty = (item) => {
    const next = item['수량확정'] === 'TRUE' ? 'FALSE' : 'TRUE';
    updateLedgerEntry(item._id, { '수량확정': next });
  };

  // 계산서 발행 토글
  const handleInvoiceToggle = (item) => {
    const next = item['계산서'] === 'TRUE' ? 'FALSE' : 'TRUE';
    updateLedgerEntry(item._id, { '계산서': next });
  };

  // 청구확정 일괄 처리
  const handleBulkConfirm = () => {
    const targets = monthItems.filter(i => i['수량확정'] === 'TRUE' && i['채권상태'] !== '청구확정' && i['최종건수'] > 0);
    if (targets.length === 0) {
      alert('수량확정된 항목이 없습니다.');
      return;
    }
    if (!window.confirm(`수량확정된 ${targets.length}건을 청구확정 처리하시겠습니까?`)) return;
    targets.forEach(item => {
      updateLedgerEntry(item._id, { '채권상태': '청구확정' });
    });
    alert(`${targets.length}건 청구확정 완료`);
  };

  // 이 달 청구 일괄 삭제
  const handleDeleteMonth = () => {
    if (monthItems.length === 0) return;
    const confirmed = monthItems.filter(i => i['채권상태'] === '청구확정' || i['채권상태'] === '완납');
    if (confirmed.length > 0) {
      alert(`청구확정/완납 ${confirmed.length}건이 포함되어 있습니다.\n해당 건의 상태를 먼저 변경해주세요.`);
      return;
    }
    if (!window.confirm(`${billingMonth} 청구 ${monthItems.length}건을 모두 삭제하시겠습니까?`)) return;
    monthItems.forEach(item => deleteLedgerEntry(item._id));
    alert(`${monthItems.length}건 삭제 완료`);
  };

  // 이 달 청구 → 다른 월로 이동
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTarget, setMoveTarget] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleExpand = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMoveMonth = () => {
    if (!moveTarget || moveTarget === billingMonth) return;
    const confirmed = monthItems.filter(i => i['채권상태'] === '청구확정' || i['채권상태'] === '완납');
    if (confirmed.length > 0) {
      alert(`청구확정/완납 ${confirmed.length}건이 포함되어 있습니다.\n해당 건의 상태를 먼저 변경해주세요.`);
      return;
    }
    if (!window.confirm(`${billingMonth} → ${moveTarget}로 ${monthItems.length}건을 이동하시겠습니까?`)) return;
    monthItems.forEach(item => {
      updateLedgerEntry(item._id, { '청구기준': moveTarget, '발생기준': moveTarget });
    });
    alert(`${monthItems.length}건을 ${moveTarget}로 이동했습니다.`);
    setShowMoveModal(false);
    setBillingMonth(moveTarget);
  };

  // 월 이동 (뷰 전환)
  const changeMonth = (delta) => {
    const [y, m] = billingMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setBillingMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="space-y-4">
      {/* 상단: 월 선택 + 요약 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => changeMonth(-1)}
              className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50">&larr;</button>
            <input type="month" value={billingMonth}
              onChange={e => setBillingMonth(e.target.value)}
              className="border border-gray-300 rounded-md px-4 py-2 text-lg font-bold" />
            <button onClick={() => changeMonth(1)}
              className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50">&rarr;</button>
          </div>
          <div className="flex items-center gap-2">
            {!hasData && (
              <button onClick={handleGenerate}
                className="bg-green-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-600">
                이 달 청구 생성
              </button>
            )}
            {hasData && (
              <>
                <button onClick={() => { setMoveTarget(''); setShowMoveModal(true); }}
                  className="border border-gray-300 text-gray-600 px-3 py-2 rounded-md text-sm hover:bg-gray-50">
                  월 이동
                </button>
                <button onClick={handleDeleteMonth}
                  className="border border-red-300 text-red-500 px-3 py-2 rounded-md text-sm hover:bg-red-50">
                  이 달 삭제
                </button>
                <button onClick={handleBulkConfirm}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                  수량확정 → 청구확정
                </button>
              </>
            )}
          </div>
        </div>

        {/* 요약 카드 */}
        {hasData && (
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{summary.count}</p>
              <p className="text-xs text-gray-500">총 거래처</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.confirmed}</p>
              <p className="text-xs text-gray-500">수량확정</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{summary.invoiced}</p>
              <p className="text-xs text-gray-500">계산서 발행</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{fmt(summary.total)}원</p>
              <p className="text-xs text-gray-500">청구 합계</p>
            </div>
            {summary.qtyWarnings > 0 && (
              <div className="col-span-4 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                수량 차이 20 초과: <span className="font-bold">{summary.qtyWarnings}건</span> — 회사수량과 병원수량 확인 필요
              </div>
            )}
          </div>
        )}
      </div>

      {/* 데이터 없을 때 */}
      {!hasData && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
          <p className="text-lg mb-2">{billingMonth} 청구 데이터가 없습니다</p>
          <p className="text-sm">"이 달 청구 생성" 버튼을 눌러 시작하세요</p>
        </div>
      )}

      {/* 청구 테이블 */}
      {hasData && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['', '거래처명', '진료과', '제품', '회사수량', '병원수량', '차이', '차월이월', '전월반영', '최종건수', '단가', '청구금액', '수량확정', '계산서', '상태'].map(h => (
                    <th key={h} className="table-header px-3 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {monthItems.map((item) => {
                  const isLocked = item['채권상태'] === '청구확정' || item['채권상태'] === '완납';
                  const companyQty = parseInt(item['당월발생']) || 0;
                  const hospitalQty = parseInt(item['병원수량']) || 0;
                  const qtyResult = resolveQty(companyQty, hospitalQty);
                  const bothEntered = companyQty > 0 && hospitalQty > 0;
                  const steps = item['청구단계'] || { step1: false, step2: false, step3: false, step4: false };
                  const stepValues = [steps.step1, steps.step2, steps.step3, steps.step4];
                  const isExpanded = expandedRows.has(item._id);
                  return (
                    <React.Fragment key={item._id}>
                    <tr className={`hover:bg-gray-50 ${
                      item['채권상태'] === '청구확정' ? 'bg-blue-50' :
                      bothEntered && qtyResult.status === 'warn' ? 'bg-orange-50' :
                      item['최종건수'] === 0 ? 'bg-yellow-50' : ''
                    }`}>
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
                      <td className="table-cell font-medium text-sm">{item['거래처명']}</td>
                      <td className="table-cell text-xs text-gray-500">{item['진료과']}</td>
                      <td className="table-cell text-xs">{item['제품명']}</td>

                      {/* 회사수량 (당월발생) */}
                      <td className="table-cell">
                        <input type="number" min="0"
                          value={item['당월발생'] || ''}
                          onChange={e => handleCompanyQtyChange(item, e.target.value)}
                          disabled={isLocked}
                          className={`w-16 border rounded px-2 py-1 text-sm text-right ${
                            isLocked ? 'bg-gray-100 text-gray-400' : 'border-gray-300'
                          }`} />
                      </td>

                      {/* 병원수량 */}
                      <td className="table-cell">
                        <input type="number" min="0"
                          value={item['병원수량'] || ''}
                          onChange={e => handleQtyChange(item, e.target.value)}
                          disabled={isLocked}
                          className={`w-16 border rounded px-2 py-1 text-sm text-right ${
                            isLocked ? 'bg-gray-100 text-gray-400' : 'border-gray-300'
                          }`} />
                      </td>

                      {/* 차이 표시 */}
                      <td className="table-cell text-center text-xs">
                        {bothEntered ? (
                          <span className={`px-1.5 py-0.5 rounded-full ${
                            qtyResult.status === 'ok'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700 font-semibold'
                          }`}>
                            {qtyResult.diff === 0 ? '일치' :
                             qtyResult.status === 'ok' ? `±${qtyResult.diff}` :
                             `±${qtyResult.diff} ⚠`}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>

                      {/* 차월이월 */}
                      <td className="table-cell">
                        <input type="number" min="0"
                          value={item['차월이월'] || ''}
                          onChange={e => handleCarryoverChange(item, e.target.value)}
                          disabled={isLocked}
                          className={`w-14 border rounded px-2 py-1 text-sm text-right ${
                            isLocked ? 'bg-gray-100 text-gray-400' : 'border-gray-300'
                          }`} />
                      </td>

                      {/* 전월반영 */}
                      <td className="table-cell">
                        <input type="number" min="0"
                          value={item['전월반영'] || ''}
                          onChange={e => handlePrevMonthChange(item, e.target.value)}
                          disabled={isLocked}
                          className={`w-14 border rounded px-2 py-1 text-sm text-right ${
                            isLocked ? 'bg-gray-100 text-gray-400' : 'border-gray-300'
                          }`} />
                      </td>

                      {/* 최종건수 (자동) */}
                      <td className="table-cell text-right text-sm font-semibold">
                        {item['최종건수']}
                      </td>

                      {/* 단가 */}
                      <td className="table-cell text-right text-xs text-gray-500">
                        {fmt(item['단가'])}
                      </td>

                      {/* 청구금액 */}
                      <td className={`table-cell text-right text-sm font-semibold ${
                        item['청구금액'] > 0 ? 'text-gray-800' : 'text-gray-300'
                      }`}>
                        {fmt(item['청구금액'])}원
                      </td>

                      {/* 수량확정 체크 */}
                      <td className="table-cell text-center">
                        <button onClick={() => handleConfirmQty(item)}
                          disabled={isLocked || item['최종건수'] === 0}
                          className={`w-6 h-6 rounded border text-xs ${
                            item['수량확정'] === 'TRUE'
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-white border-gray-300 text-gray-300 hover:border-blue-400'
                          } ${(isLocked || item['최종건수'] === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          {item['수량확정'] === 'TRUE' ? '✓' : ''}
                        </button>
                      </td>

                      {/* 계산서 발행 체크 */}
                      <td className="table-cell text-center">
                        <button onClick={() => handleInvoiceToggle(item)}
                          disabled={item['수량확정'] !== 'TRUE'}
                          className={`w-6 h-6 rounded border text-xs ${
                            item['계산서'] === 'TRUE'
                              ? 'bg-green-500 text-white border-green-500'
                              : 'bg-white border-gray-300 text-gray-300 hover:border-green-400'
                          } ${item['수량확정'] !== 'TRUE' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          {item['계산서'] === 'TRUE' ? '✓' : ''}
                        </button>
                      </td>

                      {/* 상태 */}
                      <td className="table-cell">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          item['채권상태'] === '청구확정' ? 'bg-blue-100 text-blue-700' :
                          item['채권상태'] === '완납' ? 'bg-green-100 text-green-700' :
                          item['최종건수'] === 0 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {item['최종건수'] === 0 && item['채권상태'] !== '청구확정' ? '수량 입력 필요' : item['채권상태']}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={15} className="p-0 bg-gray-50 border-b border-blue-100">
                          <BillingGuide entry={item} />
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 월 이동 모달 */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">청구 월 이동</h3>
              <button onClick={() => setShowMoveModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">{billingMonth}</span>의 {monthItems.length}건을 다른 월로 이동합니다.
              </p>
              <div>
                <label className="block text-sm text-gray-600 mb-1">이동할 월</label>
                <input type="month" value={moveTarget}
                  onChange={e => setMoveTarget(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 text-sm" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowMoveModal(false)}
                  className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50">취소</button>
                <button onClick={handleMoveMonth}
                  disabled={!moveTarget || moveTarget === billingMonth}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed">
                  이동
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyBilling;

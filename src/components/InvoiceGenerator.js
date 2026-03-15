import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { fmt } from '../utils/calculations';

// 청구기간 계산: YYYY-MM → "YYYY.MM.01 ~ YYYY.MM.말일"
function getBillingPeriod(billingMonth) {
  if (!billingMonth) return '';
  const [year, month] = billingMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}.${String(month).padStart(2, '0')}.01 ~ ${year}.${String(month).padStart(2, '0')}.${lastDay}`;
}

// 제품명 풀네임
function productFullName(code) {
  if (code === 'CAS') return 'Glandy CAS';
  if (code === 'EXO') return 'Glandy EXO';
  return code;
}

// 해당 월의 말일 계산 (YYYY-MM → Date)
function getLastDayOfMonth(billingMonth) {
  if (!billingMonth) return new Date();
  const [year, month] = billingMonth.split('-').map(Number);
  return new Date(year, month, 0); // month 0-indexed이므로 month를 그대로 넣으면 해당월 말일
}

// Date → "YYYY년 M월 D일" 형식
function formatDateKorean(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

// Date → "YYYY-MM-DD" (input[type=date] value)
function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const InvoiceGenerator = () => {
  const { ledger, invoiceTemplate, updateLedgerEntry } = useData();
  const [selectedIds, setSelectedIds] = useState([]);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(null); // null이면 자동 계산
  const [editingDate, setEditingDate] = useState(false);

  const billableItems = ledger.filter(item =>
    (item['채권상태'] === '청구확정' || item['채권상태'] === '정상') && item['청구금액'] > 0
  );

  const grouped = {};
  billableItems.forEach(item => {
    const name = item['거래처명'];
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(item);
  });

  const selectedItems = ledger.filter(i => selectedIds.includes(i._id));

  // 발행일: 선택된 항목의 청구기준 월 말일 (기본값)
  const effectiveDate = useMemo(() => {
    if (invoiceDate) return invoiceDate;
    if (selectedItems.length === 0) return new Date();
    // 가장 최근 청구기준 월의 말일
    const months = selectedItems.map(i => i['청구기준']).filter(Boolean).sort();
    const latestMonth = months[months.length - 1];
    return getLastDayOfMonth(latestMonth);
  }, [invoiceDate, selectedItems]);

  const handleToggle = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = (items) => {
    const ids = items.map(i => i._id);
    const allSelected = ids.every(id => selectedIds.includes(id));
    setSelectedIds(prev => allSelected
      ? prev.filter(id => !ids.includes(id))
      : [...new Set([...prev, ...ids])]
    );
  };

  const generateInvoice = () => {
    if (selectedItems.length === 0) return;
    selectedItems.forEach(item => {
      if (item['채권상태'] !== '청구확정') {
        updateLedgerEntry(item._id, { '채권상태': '청구확정', '수량확정': 'TRUE', '계산서': 'TRUE' });
      }
    });
    setInvoiceDate(null); // 새 발행시 자동 계산으로 리셋
    setShowInvoice(true);
  };

  const totalAmount = selectedItems.reduce((s, i) => s + (i['청구금액'] || 0), 0);
  const totalSupply = selectedItems.reduce((s, i) => s + (i['공급가'] || 0), 0);
  const totalVat = selectedItems.reduce((s, i) => s + (i['부가세'] || 0), 0);
  const receiverName = selectedItems.length > 0 ? selectedItems[0]['거래처명'] : '';
  const multipleClients = new Set(selectedItems.map(i => i['거래처명'])).size > 1;

  const dateStr = formatDateKorean(effectiveDate);

  return (
    <div className="space-y-6">
      {/* 선택 영역 */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-700">청구 대상 선택</h3>
          <div className="flex items-center gap-3">
            {multipleClients && (
              <span className="text-xs text-red-500">동일 거래처만 선택해 주세요</span>
            )}
            <span className="text-sm text-gray-500">{selectedItems.length}건 선택 | {fmt(totalAmount)}원</span>
            <button onClick={generateInvoice}
              disabled={selectedItems.length === 0 || multipleClients}
              className="bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed">
              거래명세서 발행
            </button>
          </div>
        </div>
        <div className="space-y-3">
          {Object.entries(grouped).map(([clientName, items]) => (
            <div key={clientName} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 flex items-center gap-3 border-b">
                <input type="checkbox"
                  checked={items.every(i => selectedIds.includes(i._id))}
                  onChange={() => handleSelectAll(items)}
                  className="rounded border-gray-300" />
                <span className="font-medium text-sm text-gray-700">{clientName}</span>
                <span className="text-xs text-gray-400">{items.length}건 · {fmt(items.reduce((s, i) => s + i['청구금액'], 0))}원</span>
              </div>
              <div className="divide-y divide-gray-100">
                {items.map(item => (
                  <label key={item._id} className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox"
                      checked={selectedIds.includes(item._id)}
                      onChange={() => handleToggle(item._id)}
                      className="rounded border-gray-300 mr-3" />
                    <span className="text-sm text-gray-600 flex-1">
                      {item['청구기준']} | {productFullName(item['제품명'])} | {item['최종건수']}건
                    </span>
                    <span className="text-sm font-medium text-gray-800">{fmt(item['청구금액'])}원</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="text-center text-gray-400 py-8">발행 대상 건이 없습니다</p>
          )}
        </div>
      </div>

      {/* ===== 거래명세서 팝업 ===== */}
      {showInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-[800px] w-full max-h-[95vh] overflow-y-auto">
            {/* 팝업 툴바 */}
            <div className="flex items-center justify-between px-6 py-3 border-b print:hidden">
              <h3 className="font-semibold text-gray-700">거래명세서 미리보기</h3>
              <div className="flex gap-2">
                <button onClick={() => window.print()}
                  className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600">
                  인쇄 / PDF 저장
                </button>
                <button onClick={() => { setShowInvoice(false); setSelectedIds([]); }}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300">
                  닫기
                </button>
              </div>
            </div>

            {/* ===== 거래명세서 본문 ===== */}
            <div id="invoice-print" className="invoice-doc" style={{ padding: '32px 36px' }}>

              {/* 제목 */}
              <h1 style={{
                textAlign: 'center', fontSize: '22pt', fontWeight: '700',
                letterSpacing: '12px', marginBottom: '24px', color: '#111',
              }}>
                거 래 명 세 서
              </h1>

              {/* 관리번호 */}
              <div style={{ marginBottom: '16px', fontSize: '9pt', color: '#666' }}>
                <span>관리NO : INV-{effectiveDate.getFullYear()}{String(effectiveDate.getMonth()+1).padStart(2,'0')}-{String(selectedItems.length).padStart(3,'0')}</span>
              </div>

              {/* 상단 정보: 공급받는 자 / 공급자 */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                {/* 공급받는 자 (좌측) — 테두리 없음, 상호 + 발행일만 */}
                <div style={{ flex: 1 }}>
                  <table className="inv-receiver-table">
                    <tbody>
                      <tr>
                        <td className="receiver-label">상 호</td>
                        <td style={{ fontWeight: '700', fontSize: '11pt' }}>{receiverName}</td>
                      </tr>
                      <tr>
                        <td className="receiver-label">발행일</td>
                        <td
                          style={{ fontSize: '10pt', cursor: 'pointer' }}
                          onClick={() => setEditingDate(true)}
                        >
                          {editingDate ? (
                            <input
                              type="date"
                              defaultValue={formatDateInput(effectiveDate)}
                              autoFocus
                              style={{ fontSize: '9.5pt', border: '1px solid #999', padding: '1px 4px', borderRadius: '3px' }}
                              onBlur={(e) => {
                                if (e.target.value) {
                                  const [y, m, d] = e.target.value.split('-').map(Number);
                                  setInvoiceDate(new Date(y, m - 1, d));
                                }
                                setEditingDate(false);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.target.blur();
                              }}
                            />
                          ) : dateStr}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 공급자 (우측) */}
                <div style={{ flex: 1 }}>
                  <table className="inv-info-table">
                    <tbody>
                      <tr>
                        <td className="label" rowSpan="4" style={{ writingMode: 'vertical-rl', textAlign: 'center', width: '28px', fontSize: '9pt', letterSpacing: '8px', fontWeight: '600' }}>
                          공급자
                        </td>
                        <td className="label">사업자번호</td>
                        <td colSpan="3">{invoiceTemplate.businessNumber}</td>
                      </tr>
                      <tr>
                        <td className="label">상 호</td>
                        <td style={{ fontWeight: '700' }}>{invoiceTemplate.company}</td>
                        <td className="label">대표자</td>
                        <td style={{ fontWeight: '600' }}>{invoiceTemplate.representative}</td>
                      </tr>
                      <tr>
                        <td className="label">주 소</td>
                        <td colSpan="3" style={{ fontSize: '8pt' }}>{invoiceTemplate.address}</td>
                      </tr>
                      <tr>
                        <td className="label">연락처</td>
                        <td colSpan="3">052-264-4154</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 합계금액 — 한글 표기 제거, ₩ 숫자만 */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '1.5px solid #333' }}>
                <tbody>
                  <tr>
                    <td style={{
                      textAlign: 'center', padding: '10px', fontSize: '10pt',
                      fontWeight: '600', backgroundColor: '#f5f5f5', border: '0.5px solid #999',
                      width: '120px',
                    }}>
                      합계금액
                    </td>
                    <td style={{
                      textAlign: 'center', padding: '10px', fontSize: '14pt',
                      fontWeight: '800', letterSpacing: '1px',
                    }}>
                      ₩ {fmt(totalAmount)}
                      <span style={{ fontSize: '9pt', fontWeight: '400', color: '#666', marginLeft: '8px' }}>
                        (VAT포함)
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 품목 내역 테이블 */}
              <table className="inv-table" style={{ marginBottom: '16px' }}>
                <thead>
                  <tr className="inv-header-bg" style={{ backgroundColor: '#f0f0f0' }}>
                    <th style={{ width: '30px' }}>No</th>
                    <th style={{ width: '130px' }}>품 목</th>
                    <th style={{ width: '160px' }}>청구 기간</th>
                    <th style={{ width: '65px' }}>수 량</th>
                    <th style={{ width: '80px' }}>단 가</th>
                    <th style={{ width: '100px' }}>공급가액</th>
                    <th style={{ width: '80px' }}>세 액</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map((item, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'center' }}>{i + 1}</td>
                      <td>{productFullName(item['제품명'])}</td>
                      <td style={{ textAlign: 'center', fontSize: '8.5pt' }}>{getBillingPeriod(item['청구기준'])}</td>
                      <td style={{ textAlign: 'center' }}>{item['최종건수']} 건</td>
                      <td style={{ textAlign: 'right' }}>{fmt(item['단가'])}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(item['공급가'])}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(item['부가세'])}</td>
                    </tr>
                  ))}
                  {/* 빈 행 채우기 (최소 8행) */}
                  {Array.from({ length: Math.max(0, 8 - selectedItems.length) }).map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: '700', backgroundColor: '#f9f9f9' }}>
                    <td colSpan="4" style={{ textAlign: 'center', fontWeight: '700', letterSpacing: '4px' }}>합 계</td>
                    <td></td>
                    <td style={{ textAlign: 'right', fontWeight: '700' }}>{fmt(totalSupply)}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700' }}>{fmt(totalVat)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* 하단: 비고 + 금액 요약 */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                {/* 비고 */}
                <div style={{ flex: 1 }}>
                  <table className="inv-info-table" style={{ height: '100%' }}>
                    <tbody>
                      <tr>
                        <td className="label" style={{ width: '50px', verticalAlign: 'top' }}>비 고</td>
                        <td style={{ verticalAlign: 'top', fontSize: '8.5pt', lineHeight: '1.8' }}>
                          <p>1. 계좌번호 : {invoiceTemplate.bankAccount}</p>
                          <p>2. 결제 조건 : {invoiceTemplate.paymentTerms}</p>
                          <p>3. 청구 담당 : {invoiceTemplate.contactTeam}</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {/* 금액 요약 */}
                <div style={{ width: '200px' }}>
                  <table className="inv-info-table">
                    <tbody>
                      <tr>
                        <td className="label">공급가액</td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmt(totalSupply)}</td>
                      </tr>
                      <tr>
                        <td className="label">부가세</td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{fmt(totalVat)}</td>
                      </tr>
                      <tr>
                        <td className="label" style={{ fontWeight: '700' }}>합 계</td>
                        <td style={{ textAlign: 'right', fontWeight: '800', fontSize: '11pt' }}>{fmt(totalAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 청구 문구 + 발행일 + 회사명 + 직인 */}
              <div style={{ textAlign: 'center', margin: '28px 0 0 0' }}>
                <p style={{
                  fontSize: '11pt', fontWeight: '500',
                  letterSpacing: '2px', color: '#333', marginBottom: '24px',
                }}>
                  위 금액을 정히 청구함
                </p>
              </div>

              <div style={{ textAlign: 'right', paddingRight: '20px', position: 'relative' }}>
                <p style={{ fontSize: '10pt', color: '#555', marginBottom: '8px' }}>{dateStr}</p>
                <p style={{ fontSize: '13pt', fontWeight: '700', color: '#111' }}>{invoiceTemplate.company}</p>
                <p style={{ fontSize: '10pt', color: '#444' }}>대표이사 {invoiceTemplate.representative}</p>
                <img
                  src="/stamp.png"
                  alt="직인"
                  className="invoice-stamp"
                  style={{
                    position: 'absolute', right: '0px', bottom: '-15px',
                    width: '90px', height: '90px', objectFit: 'contain', opacity: 0.85,
                  }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceGenerator;

import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { calculateVAT, calculateDueDate, fmt } from '../../utils/calculations';

const BillingEntryForm = ({ onClose, editEntry = null }) => {
  const { hospitals, addLedgerEntry, updateLedgerEntry } = useData();

  const [form, setForm] = useState({
    '청구기준': '', '발생기준': '', '거래처명': '', '진료과': '',
    '제품명': 'CAS', '당월발생': '', '병원수량': '', '차월이월': '0',
    '전월반영': '0', '최종건수': 0, '단가': 0, '비고': '',
  });

  useEffect(() => {
    if (editEntry) {
      setForm({
        '청구기준': editEntry['청구기준'] || '',
        '발생기준': editEntry['발생기준'] || '',
        '거래처명': editEntry['거래처명'] || '',
        '진료과': editEntry['진료과'] || '',
        '제품명': editEntry['제품명'] || 'CAS',
        '당월발생': String(editEntry['당월발생'] || ''),
        '병원수량': String(editEntry['병원수량'] || ''),
        '차월이월': String(editEntry['차월이월'] || '0'),
        '전월반영': String(editEntry['전월반영'] || '0'),
        '최종건수': editEntry['최종건수'] || 0,
        '단가': editEntry['단가'] || 0,
        '비고': editEntry['비고'] || '',
      });
    }
  }, [editEntry]);

  // 거래처 선택 시 자동 필드 채우기
  const handleHospitalChange = (name) => {
    const h = hospitals.find(h => h['거래처명'] === name);
    if (h) {
      setForm(prev => ({
        ...prev,
        '거래처명': name,
        '진료과': h['진료과'] || '',
        '단가': h['단가'] || 0,
        '제품명': h['제품명'] || prev['제품명'],
      }));
    } else {
      setForm(prev => ({ ...prev, '거래처명': name }));
    }
  };

  // 최종건수 자동계산
  const hospitalQty = parseInt(form['병원수량']) || 0;
  const carryover = parseInt(form['차월이월']) || 0;
  const prevMonth = parseInt(form['전월반영']) || 0;
  const finalCount = hospitalQty - carryover + prevMonth;

  // 금액 계산
  const unitPrice = form['단가'] || 0;
  const totalAmount = finalCount * unitPrice;
  const { supply, vat } = calculateVAT(totalAmount);

  // 입금예정일
  const hospital = hospitals.find(h => h['거래처명'] === form['거래처명']);
  const settlementDays = hospital ? parseInt(hospital['정산주기']) || 0 : 0;
  const dueDate = calculateDueDate(form['청구기준'], settlementDays);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form['거래처명'] || !form['청구기준']) return;

    const entry = {
      '청구기준': form['청구기준'],
      '발생기준': form['발생기준'] || form['청구기준'],
      '거래처명': form['거래처명'],
      '진료과': form['진료과'],
      '제품명': form['제품명'],
      '수량확정': 'FALSE',
      '계산서': 'FALSE',
      '당월발생': String(parseInt(form['당월발생']) || 0),
      '병원수량': String(hospitalQty),
      '차월이월': String(carryover),
      '전월반영': String(prevMonth),
      '최종건수': finalCount,
      '단가': unitPrice,
      '공급가': supply,
      '부가세': vat,
      '청구금액': totalAmount,
      '정산주기': settlementDays,
      '입금예정일': dueDate,
      '실제입금일': '',
      '미수금': totalAmount,
      '채권상태': '정상',
      '채권연령': 0,
      '잠금': 'FALSE',
      '비고': form['비고'],
    };

    if (editEntry) {
      updateLedgerEntry(editEntry._id, entry);
    } else {
      addLedgerEntry(entry);
    }
    onClose();
  };

  // 고유 거래처명 목록
  const uniqueHospitals = [...new Map(hospitals.map(h => [h['거래처명'], h])).values()];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">
            {editEntry ? '매출 수정' : '매출 입력'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">청구기준 (월)</label>
              <input type="month" value={form['청구기준']}
                onChange={e => setForm(f => ({ ...f, '청구기준': e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">발생기준 (월)</label>
              <input type="month" value={form['발생기준']}
                onChange={e => setForm(f => ({ ...f, '발생기준': e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">거래처명</label>
              <select value={form['거래처명']}
                onChange={e => handleHospitalChange(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm" required>
                <option value="">선택</option>
                {uniqueHospitals.map((h, i) => (
                  <option key={i} value={h['거래처명']}>{h['거래처명']}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">제품명</label>
              <select value={form['제품명']}
                onChange={e => setForm(f => ({ ...f, '제품명': e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="CAS">CAS</option>
                <option value="EXO">EXO</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">당월발생</label>
              <input type="number" value={form['당월발생']}
                onChange={e => setForm(f => ({ ...f, '당월발생': e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">병원수량</label>
              <input type="number" value={form['병원수량']}
                onChange={e => setForm(f => ({ ...f, '병원수량': e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">차월이월</label>
              <input type="number" value={form['차월이월']}
                onChange={e => setForm(f => ({ ...f, '차월이월': e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">전월반영</label>
              <input type="number" value={form['전월반영']}
                onChange={e => setForm(f => ({ ...f, '전월반영': e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          {/* 자동 계산 미리보기 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-700 mb-2">자동 계산</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-gray-500">최종건수:</span> <span className="font-bold">{finalCount}건</span></div>
              <div><span className="text-gray-500">단가:</span> <span className="font-bold">{fmt(unitPrice)}원</span></div>
              <div><span className="text-gray-500">공급가:</span> <span className="font-bold">{fmt(supply)}원</span></div>
              <div><span className="text-gray-500">부가세:</span> <span className="font-bold">{fmt(vat)}원</span></div>
              <div><span className="text-gray-500">청구금액:</span> <span className="font-bold text-blue-700">{fmt(totalAmount)}원</span></div>
              <div><span className="text-gray-500">입금예정일:</span> <span className="font-bold">{dueDate || '-'}</span></div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">비고</label>
            <input type="text" value={form['비고']}
              onChange={e => setForm(f => ({ ...f, '비고': e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50">취소</button>
            <button type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600">
              {editEntry ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BillingEntryForm;

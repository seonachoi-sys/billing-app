import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { generateClientCode, calculateVAT } from '../../utils/calculations';

const HospitalForm = ({ onClose, editHospital = null }) => {
  const { hospitals, addHospital, updateHospital, addContract } = useData();

  const [form, setForm] = useState({
    '업체코드': '', '병원구분': '로컬', '거래처명': '', '진료과': '내과',
    '담당의사': '', '제품명': 'CAS', '납품가': '', '청구형태': '직납',
    '정산주기': '60일', '담당사번': '', '병원': '', '병원 연락처': '',
    '업체': '', '비고': '',
    // 계약 정보
    '계약일': '', '갱신': '',
  });

  useEffect(() => {
    if (editHospital) {
      setForm(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(editHospital).filter(([k]) => k in prev)
        ),
        '납품가': String(editHospital['납품가'] || ''),
      }));
    } else {
      setForm(prev => ({ ...prev, '업체코드': generateClientCode(hospitals) }));
    }
  }, [editHospital, hospitals]);

  const deliveryPrice = parseInt(form['납품가']) || 0;
  const { supply, vat } = calculateVAT(deliveryPrice);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form['거래처명']) return;

    const hospital = {
      '업체코드': form['업체코드'],
      '병원구분': form['병원구분'],
      '거래처명': form['거래처명'],
      '진료과': form['진료과'],
      '담당의사': form['담당의사'],
      '제품명': form['제품명'],
      '납품가': deliveryPrice,
      '단가': supply,
      '부가세': vat,
      '청구형태': form['청구형태'],
      '정산주기': form['정산주기'],
      '담당사번': form['담당사번'],
      '병원': form['병원'],
      '병원 연락처': form['병원 연락처'],
      '업체': form['업체'],
      '비고': form['비고'],
    };

    if (editHospital) {
      updateHospital(editHospital._id, hospital);
    } else {
      addHospital(hospital);
      // 계약 정보도 함께 등록
      if (form['계약일']) {
        addContract({
          '거래처': form['거래처명'],
          '계약일': form['계약일'],
          '제품': 'Glandy ' + form['제품명'],
          '갱신': form['갱신'],
          '계약단가': supply + '원',
          'VAT포함': deliveryPrice + '원',
          '정산주기': form['정산주기'],
          '비고': form['비고'],
          '담당자': form['담당사번'],
        });
      }
    }
    onClose();
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">
            {editHospital ? '거래처 수정' : '신규 거래처 등록'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">업체코드</label>
              <input type="text" value={form['업체코드']} readOnly
                className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">병원구분</label>
              <select value={form['병원구분']} onChange={set('병원구분')}
                className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="로컬">로컬</option>
                <option value="상급">상급</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">청구형태</label>
              <select value={form['청구형태']} onChange={set('청구형태')}
                className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="직납">직납</option>
                <option value="간납">간납</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">거래처명 *</label>
              <input type="text" value={form['거래처명']} onChange={set('거래처명')}
                className="w-full border rounded-md px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">진료과</label>
              <select value={form['진료과']} onChange={set('진료과')}
                className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="내과">내과</option>
                <option value="안과">안과</option>
                <option value="외과">외과</option>
                <option value="기타">기타</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">담당의사</label>
              <input type="text" value={form['담당의사']} onChange={set('담당의사')}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">제품명</label>
              <select value={form['제품명']} onChange={set('제품명')}
                className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="CAS">CAS</option>
                <option value="EXO">EXO</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">납품가 (VAT포함)</label>
              <input type="number" value={form['납품가']} onChange={set('납품가')}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="13,000" />
              {deliveryPrice > 0 && (
                <p className="text-xs text-gray-400 mt-1">단가 {supply.toLocaleString()}원 + 부가세 {vat.toLocaleString()}원</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">정산주기</label>
              <select value={form['정산주기']} onChange={set('정산주기')}
                className="w-full border rounded-md px-3 py-2 text-sm">
                <option value="30일">30일</option>
                <option value="60일">60일</option>
                <option value="90일">90일</option>
                <option value="120일">120일</option>
                <option value="180일">180일</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">담당사번</label>
              <input type="text" value={form['담당사번']} onChange={set('담당사번')}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">병원 담당자</label>
              <input type="text" value={form['병원']} onChange={set('병원')}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">병원 연락처</label>
              <input type="text" value={form['병원 연락처']} onChange={set('병원 연락처')}
                className="w-full border rounded-md px-3 py-2 text-sm" />
            </div>
          </div>

          {/* 계약 정보 (신규 등록 시만) */}
          {!editHospital && (
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">계약 정보</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">계약일</label>
                  <input type="date" value={form['계약일']} onChange={set('계약일')}
                    className="w-full border rounded-md px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">갱신 기간</label>
                  <select value={form['갱신']} onChange={set('갱신')}
                    className="w-full border rounded-md px-3 py-2 text-sm">
                    <option value="">선택</option>
                    <option value="1년">1년</option>
                    <option value="2년">2년</option>
                    <option value="3년">3년</option>
                    <option value="5년">5년</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-600 mb-1">비고</label>
            <input type="text" value={form['비고']} onChange={set('비고')}
              className="w-full border rounded-md px-3 py-2 text-sm" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50">취소</button>
            <button type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600">
              {editHospital ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HospitalForm;

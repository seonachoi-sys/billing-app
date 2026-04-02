import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { fmt } from '../utils/calculations';
import HospitalForm from './forms/HospitalForm';

const HospitalManagement = () => {
  const { hospitals, ledger, master, getHospitalSummary, deleteHospital } = useData();
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editHospital, setEditHospital] = useState(null);

  const filteredHospitals = hospitals.filter(h =>
    h['거래처명'] && h['거래처명'].includes(search)
  );

  const getDetail = (hospital) => {
    const name = hospital['거래처명'];
    const items = ledger.filter(l => l['거래처명'] === name);
    const contract = master.find(m => m['거래처'] === name);
    const summary = getHospitalSummary(name);
    return { hospital, items, contract, ...summary };
  };

  const detail = selectedHospital ? getDetail(selectedHospital) : null;

  const handleEdit = (hospital) => {
    setEditHospital(hospital);
    setShowForm(true);
  };

  const handleDelete = (hospital) => {
    if (window.confirm(`${hospital['거래처명']}을(를) 삭제하시겠습니까?`)) {
      deleteHospital(hospital._id);
      if (selectedHospital?._id === hospital._id) setSelectedHospital(null);
    }
  };

  return (
    <div className="flex gap-6 min-h-[600px]">
      {/* 좌측: 병원 목록 */}
      <div className="w-80 flex-shrink-0">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 border-b border-gray-200 space-y-2">
            <input type="text" placeholder="병원명 검색..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            <button onClick={() => { setEditHospital(null); setShowForm(true); }}
              className="w-full bg-blue-500 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
              + 신규 거래처 등록
            </button>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
            {filteredHospitals.map((h) => {
              const summary = getHospitalSummary(h['거래처명']);
              return (
                <li key={h._id}
                  onClick={() => setSelectedHospital(h)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    selectedHospital?._id === h._id ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
                  }`}>
                  <div className="text-sm font-medium text-gray-800">{h['거래처명']}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex justify-between">
                    <span>
                      <span className={`inline-block px-1 py-0.5 rounded text-xs mr-1 ${
                        h['병원구분'] === '상급종합' || h['병원구분'] === '상급' ? 'bg-purple-100 text-purple-600' :
                        h['병원구분'] === '종합' ? 'bg-blue-100 text-blue-600' :
                        h['병원구분'] === '병원' ? 'bg-green-100 text-green-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>{h['병원구분']}</span>
                      {h['진료과']} · {h['제품명']}
                    </span>
                    {summary.outstanding > 0 && (
                      <span className="text-red-500">미수 {fmt(summary.outstanding)}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* 우측: 상세 */}
      <div className="flex-1">
        {detail ? (
          <div className="space-y-4">
            {/* 병원 정보 카드 */}
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">{detail.hospital['거래처명']}</h3>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(detail.hospital)}
                    className="text-sm text-blue-500 hover:text-blue-700 px-3 py-1 border rounded">수정</button>
                  <button onClick={() => handleDelete(detail.hospital)}
                    className="text-sm text-red-400 hover:text-red-600 px-3 py-1 border rounded">삭제</button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-gray-500">업체코드:</span> <span className="font-medium">{detail.hospital['업체코드']}</span></div>
                <div><span className="text-gray-500">병원구분:</span> <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${
                  detail.hospital['병원구분'] === '상급종합' ? 'bg-purple-100 text-purple-700' :
                  detail.hospital['병원구분'] === '종합' ? 'bg-blue-100 text-blue-700' :
                  detail.hospital['병원구분'] === '병원' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-700'
                }`}>{detail.hospital['병원구분']}</span></div>
                <div><span className="text-gray-500">진료과:</span> <span className="font-medium">{detail.hospital['진료과']}</span></div>
                <div><span className="text-gray-500">담당의사:</span> <span className="font-medium">{detail.hospital['담당의사']}</span></div>
                <div><span className="text-gray-500">제품:</span> <span className="font-medium">{detail.hospital['제품명']}</span></div>
                <div><span className="text-gray-500">청구형태:</span> <span className="font-medium">{detail.hospital['청구형태']}</span></div>
                <div><span className="text-gray-500">납품가:</span> <span className="font-medium">{fmt(detail.hospital['납품가'])}원</span></div>
                <div><span className="text-gray-500">정산주기:</span> <span className="font-medium">{detail.hospital['정산주기']}</span></div>
                <div><span className="text-gray-500">영업담당자:</span> <span className="font-medium">{detail.hospital['영업담당자'] || detail.hospital['담당사번'] || '-'}</span></div>
              </div>

              {/* 병원 담당자 정보 */}
              {(detail.hospital['병원담당자명'] || detail.hospital['병원담당자전화'] || detail.hospital['병원담당자이메일'] || detail.hospital['병원'] || detail.hospital['병원 연락처']) && (
                <div className="mt-4 pt-3 border-t">
                  <h4 className="text-xs font-semibold text-gray-500 mb-2">병원 담당자</h4>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><span className="text-gray-500">이름:</span> <span className="font-medium">{detail.hospital['병원담당자명'] || detail.hospital['병원'] || '-'}</span></div>
                    <div><span className="text-gray-500">전화:</span> <span className="font-medium">{detail.hospital['병원담당자전화'] || (detail.hospital['병원 연락처'] && !/[@.]/.test(detail.hospital['병원 연락처']) ? detail.hospital['병원 연락처'] : '-')}</span></div>
                    <div><span className="text-gray-500">이메일:</span> <span className="font-medium">{detail.hospital['병원담당자이메일'] || (detail.hospital['병원 연락처'] && /@/.test(detail.hospital['병원 연락처']) ? detail.hospital['병원 연락처'] : '-')}</span></div>
                  </div>
                </div>
              )}

              {detail.hospital['비고'] && (
                <div className="mt-3 text-sm"><span className="text-gray-500">비고:</span> <span className="font-medium">{detail.hospital['비고']}</span></div>
              )}
            </div>

            {/* 계약 정보 */}
            {detail.contract && (
              <div className="bg-white rounded-lg shadow p-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">계약 정보</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-gray-500">계약일:</span> <span className="font-medium">{detail.contract['계약일']}</span></div>
                  <div><span className="text-gray-500">갱신:</span> <span className="font-medium">{detail.contract['갱신'] || '-'}</span></div>
                  <div><span className="text-gray-500">계약단가:</span> <span className="font-medium">{detail.contract['계약단가']}</span></div>
                  <div><span className="text-gray-500">VAT포함:</span> <span className="font-medium">{detail.contract['VAT포함']}</span></div>
                </div>
              </div>
            )}

            {/* 매출/미수금 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow p-5">
                <p className="text-sm text-gray-500">누적 매출</p>
                <p className="text-xl font-bold text-gray-800">{fmt(detail.totalSales)}원</p>
              </div>
              <div className="bg-white rounded-lg shadow p-5">
                <p className="text-sm text-gray-500">미수금</p>
                <p className={`text-xl font-bold ${detail.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmt(detail.outstanding)}원
                </p>
              </div>
            </div>

            {/* 청구 내역 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-5 py-3 border-b">
                <h4 className="text-sm font-semibold text-gray-700">청구 내역 ({detail.items.length}건)</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['청구기준', '제품', '건수', '청구금액', '미수금', '상태'].map(h => (
                        <th key={h} className="table-header px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {detail.items.map((item) => (
                      <tr key={item._id} className="hover:bg-gray-50">
                        <td className="table-cell">{item['청구기준']}</td>
                        <td className="table-cell">{item['제품명']}</td>
                        <td className="table-cell text-right">{fmt(item['최종건수'])}</td>
                        <td className="table-cell text-right">{fmt(item['청구금액'])}원</td>
                        <td className={`table-cell text-right ${item['미수금'] > 0 ? 'text-red-600' : ''}`}>
                          {fmt(item['미수금'])}원
                        </td>
                        <td className="table-cell">{item['채권상태']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
            <p className="text-lg">좌측에서 병원을 선택하세요</p>
          </div>
        )}
      </div>

      {showForm && (
        <HospitalForm
          onClose={() => { setShowForm(false); setEditHospital(null); }}
          editHospital={editHospital}
        />
      )}
    </div>
  );
};

export default HospitalManagement;

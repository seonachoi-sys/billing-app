import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { fmt, generateId } from '../utils/calculations';
import HospitalForm from './forms/HospitalForm';
import { DEFAULT_STEPS, ICON_OPTIONS } from './BillingGuide';

const HospitalManagement = () => {
  const { hospitals, ledger, master, getHospitalSummary, deleteHospital, updateContract, updateHospital } = useData();
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [editHospital, setEditHospital] = useState(null);
  const [editingManual, setEditingManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const [editingSteps, setEditingSteps] = useState(false);
  const [stepsList, setStepsList] = useState([]);
  const [editingStepIdx, setEditingStepIdx] = useState(null);

  useEffect(() => {
    setEditingManual(false);
    setEditingSteps(false);
    setEditingStepIdx(null);
  }, [selectedHospital]);

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
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">계약 정보</h4>
                  {editingContract?._id === detail.contract._id ? (
                    <div className="flex gap-2">
                      <button onClick={() => {
                        updateContract(editingContract._id, editingContract);
                        setEditingContract(null);
                      }} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 border rounded">저장</button>
                      <button onClick={() => setEditingContract(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border rounded">취소</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingContract({ ...detail.contract })}
                      className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 border rounded">수정</button>
                  )}
                </div>
                {editingContract?._id === detail.contract._id ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">계약일</label>
                      <input type="date" value={editingContract['계약일'] || ''}
                        onChange={e => setEditingContract(c => ({ ...c, '계약일': e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">갱신</label>
                      <select value={editingContract['갱신'] || ''}
                        onChange={e => setEditingContract(c => ({ ...c, '갱신': e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-sm">
                        <option value="">선택</option>
                        <option value="1년">1년</option>
                        <option value="2년">2년</option>
                        <option value="3년">3년</option>
                        <option value="5년">5년</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">계약단가</label>
                      <input type="text" value={editingContract['계약단가'] || ''}
                        onChange={e => setEditingContract(c => ({ ...c, '계약단가': e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">VAT포함</label>
                      <input type="text" value={editingContract['VAT포함'] || ''}
                        onChange={e => setEditingContract(c => ({ ...c, 'VAT포함': e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">정산주기</label>
                      <input type="text" value={editingContract['정산주기'] || ''}
                        onChange={e => setEditingContract(c => ({ ...c, '정산주기': e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">담당자</label>
                      <input type="text" value={editingContract['담당자'] || ''}
                        onChange={e => setEditingContract(c => ({ ...c, '담당자': e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">비고</label>
                      <input type="text" value={editingContract['비고'] || ''}
                        onChange={e => setEditingContract(c => ({ ...c, '비고': e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-sm" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-gray-500">계약일:</span> <span className="font-medium">{detail.contract['계약일']}</span></div>
                    <div><span className="text-gray-500">갱신:</span> <span className="font-medium">{detail.contract['갱신'] || '-'}</span></div>
                    <div><span className="text-gray-500">계약단가:</span> <span className="font-medium">{detail.contract['계약단가']}</span></div>
                    <div><span className="text-gray-500">VAT포함:</span> <span className="font-medium">{detail.contract['VAT포함']}</span></div>
                    {detail.contract['정산주기'] && <div><span className="text-gray-500">정산주기:</span> <span className="font-medium">{detail.contract['정산주기']}</span></div>}
                    {detail.contract['담당자'] && <div><span className="text-gray-500">담당자:</span> <span className="font-medium">{detail.contract['담당자']}</span></div>}
                    {detail.contract['비고'] && <div className="col-span-2"><span className="text-gray-500">비고:</span> <span className="font-medium">{detail.contract['비고']}</span></div>}
                  </div>
                )}
              </div>
            )}

            {/* 청구 매뉴얼 */}
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700">📋 청구 매뉴얼</h4>
                {editingManual ? (
                  <div className="flex gap-2">
                    <button onClick={() => {
                      updateHospital(detail.hospital._id, { '청구매뉴얼': manualText });
                      setEditingManual(false);
                    }} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 border rounded">저장</button>
                    <button onClick={() => setEditingManual(false)}
                      className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border rounded">취소</button>
                  </div>
                ) : (
                  <button onClick={() => {
                    setManualText(detail.hospital['청구매뉴얼'] || '');
                    setEditingManual(true);
                  }} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 border rounded">수정</button>
                )}
              </div>
              {editingManual ? (
                <textarea
                  value={manualText}
                  onChange={e => setManualText(e.target.value)}
                  autoFocus
                  rows={5}
                  placeholder="청구 방법, 발송 방식(이메일/우편/팩스), 세금계산서 발행 방법, 담당자 연락처, 특이사항 등을 기록하세요"
                  className="w-full border rounded-md px-3 py-2 text-sm resize-y"
                />
              ) : (
                <div className="text-sm whitespace-pre-wrap">
                  {detail.hospital['청구매뉴얼'] ? (
                    <p className="text-gray-700 leading-relaxed">{detail.hospital['청구매뉴얼']}</p>
                  ) : (
                    <p className="text-gray-400 italic">등록된 청구 매뉴얼이 없습니다. 수정 버튼을 눌러 작성해주세요.</p>
                  )}
                </div>
              )}
            </div>

            {/* 청구 단계 관리 */}
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700">📌 청구 단계 설정</h4>
                {editingSteps ? (
                  <div className="flex gap-2">
                    <button onClick={() => {
                      updateHospital(detail.hospital._id, { '청구단계목록': stepsList.length > 0 ? stepsList : undefined });
                      setEditingSteps(false);
                      setEditingStepIdx(null);
                    }} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 border rounded">저장</button>
                    <button onClick={() => { setEditingSteps(false); setEditingStepIdx(null); }}
                      className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border rounded">취소</button>
                  </div>
                ) : (
                  <button onClick={() => {
                    const current = detail.hospital['청구단계목록'];
                    setStepsList((current && current.length > 0) ? [...current] : DEFAULT_STEPS.map(s => ({ ...s })));
                    setEditingSteps(true);
                  }} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 border rounded">수정</button>
                )}
              </div>

              {editingSteps ? (
                <div className="space-y-2">
                  {stepsList.map((step, idx) => (
                    <div key={step.key} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400 text-xs w-5 text-center">{idx + 1}</span>
                      {editingStepIdx === idx ? (
                        <>
                          <div className="relative">
                            <select
                              value={step.icon}
                              onChange={e => {
                                const updated = [...stepsList];
                                updated[idx] = { ...updated[idx], icon: e.target.value };
                                setStepsList(updated);
                              }}
                              className="border rounded px-1 py-1 text-lg w-12 text-center appearance-none"
                            >
                              {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                            </select>
                          </div>
                          <input
                            type="text"
                            value={step.label}
                            onChange={e => {
                              const updated = [...stepsList];
                              updated[idx] = { ...updated[idx], label: e.target.value };
                              setStepsList(updated);
                            }}
                            className="flex-1 border rounded px-2 py-1 text-sm"
                            placeholder="단계 이름"
                            autoFocus
                          />
                          <button onClick={() => setEditingStepIdx(null)}
                            className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1">확인</button>
                        </>
                      ) : (
                        <>
                          <span className="text-lg">{step.icon}</span>
                          <span className="flex-1 text-sm text-gray-700">{step.label}</span>
                          <button onClick={() => setEditingStepIdx(idx)}
                            className="text-xs text-gray-400 hover:text-blue-500 px-1">수정</button>
                          {idx > 0 && (
                            <button onClick={() => {
                              const updated = [...stepsList];
                              [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                              setStepsList(updated);
                            }} className="text-xs text-gray-400 hover:text-gray-600">↑</button>
                          )}
                          {idx < stepsList.length - 1 && (
                            <button onClick={() => {
                              const updated = [...stepsList];
                              [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                              setStepsList(updated);
                            }} className="text-xs text-gray-400 hover:text-gray-600">↓</button>
                          )}
                          <button onClick={() => {
                            if (window.confirm(`"${step.label}" 단계를 삭제하시겠습니까?`)) {
                              setStepsList(stepsList.filter((_, i) => i !== idx));
                              if (editingStepIdx === idx) setEditingStepIdx(null);
                            }
                          }} className="text-xs text-red-400 hover:text-red-600 px-1">삭제</button>
                        </>
                      )}
                    </div>
                  ))}
                  <button onClick={() => {
                    const newKey = 'step_' + generateId().slice(0, 6);
                    setStepsList([...stepsList, { key: newKey, label: '새 단계', icon: '📋' }]);
                    setEditingStepIdx(stepsList.length);
                  }} className="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors">
                    + 단계 추가
                  </button>
                  {stepsList.length > 0 && (
                    <button onClick={() => {
                      if (window.confirm('모든 커스텀 단계를 삭제하고 기본 4단계로 복원하시겠습니까?')) {
                        setStepsList(DEFAULT_STEPS.map(s => ({ ...s })));
                      }
                    }} className="text-xs text-gray-400 hover:text-gray-600">
                      기본 단계로 복원
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {(() => {
                    const currentSteps = (detail.hospital['청구단계목록'] && detail.hospital['청구단계목록'].length > 0)
                      ? detail.hospital['청구단계목록']
                      : DEFAULT_STEPS;
                    return currentSteps.map((step, idx) => (
                      <div key={step.key} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400 text-xs w-5 text-center">{idx + 1}</span>
                        <span className="text-lg">{step.icon}</span>
                        <span className="text-gray-700">{step.label}</span>
                      </div>
                    ));
                  })()}
                  {(!detail.hospital['청구단계목록'] || detail.hospital['청구단계목록'].length === 0) && (
                    <p className="text-xs text-gray-400 mt-1">기본 4단계 사용 중 — 수정 버튼으로 커스터마이징 가능</p>
                  )}
                </div>
              )}
            </div>

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

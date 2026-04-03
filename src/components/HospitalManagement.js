import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useData } from '../context/DataContext';
import { fmt, generateId, generateClientCode } from '../utils/calculations';
import HospitalForm from './forms/HospitalForm';
import { DEFAULT_STEPS, ICON_OPTIONS } from './BillingGuide';

const HospitalManagement = () => {
  const { hospitals, ledger, master, getHospitalSummary, addHospital, deleteHospital, updateContract, updateHospital } = useData();
  const [selectedName, setSelectedName] = useState(null);
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
  }, [selectedName]);

  const filteredHospitals = hospitals.filter(h =>
    h['거래처명'] && h['거래처명'].includes(search)
  );

  // 거래처명 기준 그룹화 (좌측 목록용)
  const groupedHospitals = useMemo(() => {
    const map = new Map();
    filteredHospitals.forEach(h => {
      const name = h['거래처명'];
      if (!map.has(name)) {
        map.set(name, { name, records: [], hospital: h });
      }
      map.get(name).records.push(h);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [filteredHospitals]);

  const getDetail = (hospitalName) => {
    const records = hospitals.filter(h => h['거래처명'] === hospitalName);
    if (records.length === 0) return null;
    const primary = records[0];
    const items = ledger.filter(l => l['거래처명'] === hospitalName);
    const contract = master.find(m => m['거래처'] === hospitalName);
    const summary = getHospitalSummary(hospitalName);

    // 제품별 미수금 분류
    const productSummary = {};
    records.forEach(r => {
      const key = `${r['진료과']}·${r['제품명']}`;
      const productItems = items.filter(i => i['제품명'] === r['제품명'] && (i['진료과'] === r['진료과'] || !i['진료과']));
      productSummary[key] = {
        record: r,
        dept: r['진료과'],
        product: r['제품명'],
        outstanding: productItems.reduce((s, i) => s + (i['미수금'] || 0), 0),
        totalSales: productItems.reduce((s, i) => s + (i['청구금액'] || 0), 0),
        count: productItems.length,
      };
    });

    return { hospital: primary, records, items, contract, productSummary, ...summary };
  };

  const currentHospital = selectedName ? hospitals.find(h => h['거래처명'] === selectedName) : null;
  const detail = selectedName ? getDetail(selectedName) : null;

  const handleEdit = (hospital) => {
    setEditHospital(hospital);
    setShowForm(true);
  };

  const handleDelete = (hospital) => {
    if (window.confirm(`${hospital['거래처명']}을(를) 삭제하시겠습니까?`)) {
      deleteHospital(hospital._id);
      if (selectedName === hospital['거래처명']) {
        const remaining = hospitals.filter(h => h['거래처명'] === hospital['거래처명'] && h._id !== hospital._id);
        if (remaining.length === 0) setSelectedName(null);
      }
    }
  };

  // 진료과 + 제품 추가 모달
  const [showAddCombo, setShowAddCombo] = useState(false);
  const [addCombo, setAddCombo] = useState({ dept: '내과', product: 'CAS', doctor: '' });

  // 해당 병원의 기존 진료과+제품 조합 목록
  const existingCombos = useMemo(() => {
    if (!currentHospital) return [];
    return hospitals
      .filter(h => h['거래처명'] === currentHospital['거래처명'])
      .map(h => `${h['진료과']}||${h['제품명']}`);
  }, [hospitals, currentHospital]);

  const handleAddComboSubmit = () => {
    if (!currentHospital) return;
    const key = `${addCombo.dept}||${addCombo.product}`;
    if (existingCombos.includes(key)) {
      alert(`${currentHospital['거래처명']}에 ${addCombo.dept} · ${addCombo.product} 조합이 이미 등록되어 있습니다.`);
      return;
    }

    const { _id, ...rest } = currentHospital;
    const newHospital = {
      ...rest,
      '진료과': addCombo.dept,
      '제품명': addCombo.product,
      '담당의사': addCombo.doctor || currentHospital['담당의사'] || '',
      '업체코드': generateClientCode(hospitals),
    };
    addHospital(newHospital);
    setShowAddCombo(false);
    alert(`${currentHospital['거래처명']} — ${addCombo.dept} · ${addCombo.product} 추가 완료`);
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
            {groupedHospitals.map((group) => {
              const summary = getHospitalSummary(group.name);
              const h = group.hospital;
              const products = group.records.map(r => `${r['진료과']}·${r['제품명']}`);
              return (
                <li key={group.name}
                  onClick={() => setSelectedName(group.name)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    selectedName === group.name ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-800">{group.name}</div>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                      h['병원구분'] === '상급종합' || h['병원구분'] === '상급' ? 'bg-purple-100 text-purple-600' :
                      h['병원구분'] === '종합' ? 'bg-blue-100 text-blue-600' :
                      h['병원구분'] === '병원' ? 'bg-green-100 text-green-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>{h['병원구분']}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 flex justify-between items-center">
                    <div className="flex flex-wrap gap-1">
                      {products.map(p => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{p}</span>
                      ))}
                    </div>
                    {summary.outstanding > 0 && (
                      <span className="text-red-500 ml-2 whitespace-nowrap">미수 {fmt(summary.outstanding)}</span>
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
                  <button onClick={() => { setAddCombo({ dept: '내과', product: 'CAS', doctor: '' }); setShowAddCombo(true); }}
                    className="text-sm text-green-600 hover:text-green-800 px-3 py-1 border border-green-300 rounded hover:bg-green-50">
                    + 진료과/제품 추가
                  </button>
                  <button onClick={() => handleEdit(detail.hospital)}
                    className="text-sm text-blue-500 hover:text-blue-700 px-3 py-1 border rounded">수정</button>
                  <button onClick={() => handleDelete(detail.hospital)}
                    className="text-sm text-red-400 hover:text-red-600 px-3 py-1 border rounded">삭제</button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-gray-500">병원구분:</span> <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${
                  detail.hospital['병원구분'] === '상급종합' ? 'bg-purple-100 text-purple-700' :
                  detail.hospital['병원구분'] === '종합' ? 'bg-blue-100 text-blue-700' :
                  detail.hospital['병원구분'] === '병원' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-700'
                }`}>{detail.hospital['병원구분']}</span></div>
                <div><span className="text-gray-500">청구형태:</span> <span className="font-medium">{detail.hospital['청구형태']}</span></div>
                <div><span className="text-gray-500">정산주기:</span> <span className="font-medium">{detail.hospital['정산주기']}</span></div>
                <div><span className="text-gray-500">담당의사:</span> <span className="font-medium">{detail.hospital['담당의사']}</span></div>
                <div><span className="text-gray-500">영업담당자:</span> <span className="font-medium">{detail.hospital['영업담당자'] || detail.hospital['담당사번'] || '-'}</span></div>
              </div>

              {/* 제품별 현황 */}
              <div className="mt-4 pt-3 border-t">
                <h4 className="text-xs font-semibold text-gray-500 mb-2">진료과 · 제품별 현황</h4>
                <div className="grid gap-2">
                  {Object.entries(detail.productSummary).map(([key, ps]) => (
                    <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{ps.dept}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          ps.product === 'CAS' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                        }`}>{ps.product}</span>
                        <span className="text-xs text-gray-400">코드: {ps.record['업체코드']}</span>
                        <span className="text-xs text-gray-400">납품가 {fmt(ps.record['납품가'])}원</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-gray-500">청구 {fmt(ps.totalSales)}원</span>
                        <span className={ps.outstanding > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                          미수 {fmt(ps.outstanding)}원
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
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
                      updateHospital(detail.hospital._id, { '청구단계목록': stepsList });
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

            {/* 건수 대사 이력 */}
            <ReconciliationHistory items={detail.items} hospitalName={detail.hospital['거래처명']} />

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

      {/* 진료과 + 제품 추가 모달 */}
      {showAddCombo && currentHospital && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-base font-bold text-gray-800">진료과 / 제품 추가</h3>
              <button onClick={() => setShowAddCombo(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">{currentHospital['거래처명']}</span>에 조합을 추가합니다.
              </p>

              {/* 기존 등록 현황 */}
              <div>
                <p className="text-xs text-gray-500 mb-1.5">등록된 조합</p>
                <div className="flex flex-wrap gap-1.5">
                  {existingCombos.map(c => {
                    const [dept, prod] = c.split('||');
                    return (
                      <span key={c} className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                        {dept} · {prod}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">진료과</label>
                  <select value={addCombo.dept} onChange={e => setAddCombo(p => ({ ...p, dept: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="내과">내과</option>
                    <option value="안과">안과</option>
                    <option value="외과">외과</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">제품</label>
                  <select value={addCombo.product} onChange={e => setAddCombo(p => ({ ...p, product: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="CAS">CAS</option>
                    <option value="EXO">EXO</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">담당의사</label>
                <input type="text" value={addCombo.doctor}
                  onChange={e => setAddCombo(p => ({ ...p, doctor: e.target.value }))}
                  placeholder={currentHospital?.['담당의사'] || '미입력 시 기존 담당의사 유지'}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>

              {existingCombos.includes(`${addCombo.dept}||${addCombo.product}`) && (
                <p className="text-xs text-red-500">이미 등록된 조합입니다.</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAddCombo(false)}
                  className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50">취소</button>
                <button onClick={handleAddComboSubmit}
                  disabled={existingCombos.includes(`${addCombo.dept}||${addCombo.product}`)}
                  className="px-4 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed">
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 건수 대사 이력 컴포넌트
function ReconciliationHistory({ items }) {
  const [showChart, setShowChart] = useState(false);

  const history = useMemo(() => {
    return items
      .filter(i => {
        const c = parseInt(i['당월발생']) || 0;
        const h = parseInt(i['병원수량']) || 0;
        return c > 0 || h > 0;
      })
      .map(i => {
        const company = parseInt(i['당월발생']) || 0;
        const hospital = parseInt(i['병원수량']) || 0;
        const diff = company - hospital;
        const diffRate = hospital > 0 ? ((diff / hospital) * 100).toFixed(1) : '0.0';
        return {
          month: i['청구기준'],
          product: i['제품명'],
          company,
          hospital,
          diff,
          diffRate: parseFloat(diffRate),
          hasDiff: diff !== 0,
        };
      })
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [items]);

  const totalDiff = history.reduce((s, h) => s + h.diff, 0);
  const diffMonths = history.filter(h => h.hasDiff).length;

  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700">
          건수 대사 이력
          {diffMonths > 0 && (
            <span className="ml-2 text-xs font-normal text-orange-500">차이 {diffMonths}건 · 누적 {totalDiff > 0 ? '+' : ''}{totalDiff}</span>
          )}
        </h4>
        <button onClick={() => setShowChart(prev => !prev)}
          className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 border rounded">
          {showChart ? '테이블' : '차트'}
        </button>
      </div>

      {showChart ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, name) => name === '차이' ? `${v > 0 ? '+' : ''}${v}` : v} />
            <ReferenceLine y={0} stroke="#9ca3af" />
            <Bar dataKey="diff" name="차이" fill="#f59e0b" radius={[4, 4, 0, 0]}>
              {history.map((entry, i) => (
                <Cell key={i} fill={entry.diff > 0 ? '#f59e0b' : entry.diff < 0 ? '#3b82f6' : '#10b981'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {['청구월', '제품', '회사건수', '병원건수', '차이', '차이율'].map(h => (
                  <th key={h} className="table-header px-3 py-2 text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.map((row, i) => (
                <tr key={i} className={row.hasDiff ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                  <td className="table-cell text-xs">{row.month}</td>
                  <td className="table-cell text-xs">
                    <span className={`badge ${row.product === 'CAS' ? 'badge-blue' : 'badge-yellow'}`}>{row.product}</span>
                  </td>
                  <td className="table-cell text-right text-xs">{fmt(row.company)}</td>
                  <td className="table-cell text-right text-xs">{fmt(row.hospital)}</td>
                  <td className={`table-cell text-right text-xs font-medium ${
                    row.diff > 0 ? 'text-orange-600' : row.diff < 0 ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    {row.diff === 0 ? '0' : row.diff > 0 ? `+${row.diff}` : row.diff}
                  </td>
                  <td className={`table-cell text-right text-xs ${
                    Math.abs(row.diffRate) > 5 ? 'text-red-500 font-medium' : 'text-gray-500'
                  }`}>
                    {row.diffRate > 0 ? '+' : ''}{row.diffRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default HospitalManagement;

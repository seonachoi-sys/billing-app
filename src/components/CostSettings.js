import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { calcMonthlyFixedCost } from '../utils/bepCalculations';
import { fmt } from '../utils/calculations';

const NumberInput = ({ label, value, onChange, suffix = '원', note }) => {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  const formatted = typeof value === 'number' ? value.toLocaleString('ko-KR') : String(value);

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="shrink-0">
        <label className="text-sm text-gray-700">{label}</label>
        {note && <p className="text-xs text-gray-400">{note}</p>}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={editing ? raw : formatted}
          onFocus={() => { setEditing(true); setRaw(String(value)); }}
          onChange={e => setRaw(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const num = Number(String(raw).replace(/,/g, ''));
            if (!isNaN(num)) onChange(num);
          }}
          className="w-40 text-right border border-gray-300 rounded px-2 py-1.5 text-sm"
        />
        <span className="text-xs text-gray-400 w-8">{suffix}</span>
      </div>
    </div>
  );
};

const FormattedInput = ({ value, onChange, className }) => {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');

  return (
    <input
      type="text"
      inputMode="numeric"
      value={editing ? raw : (typeof value === 'number' ? value.toLocaleString('ko-KR') : value)}
      onFocus={() => { setEditing(true); setRaw(String(value)); }}
      onChange={e => setRaw(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const num = Number(String(raw).replace(/,/g, ''));
        if (!isNaN(num)) onChange(num);
      }}
      className={className}
    />
  );
};

const CostSettings = () => {
  const { costSettings, updateCostSettings } = useData();
  const [activeSection, setActiveSection] = useState('initial');
  const [saved, setSaved] = useState(false);

  const handleChange = (field, value) => {
    updateCostSettings({ [field]: value });
    flashSaved();
  };

  const handlePersonnelChange = (index, field, value) => {
    const updated = [...(costSettings.인허가인력 || [])];
    updated[index] = { ...updated[index], [field]: value };
    updateCostSettings({ 인허가인력: updated });
    flashSaved();
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const monthlyFixed = calcMonthlyFixedCost(costSettings);
  const isManualMode = costSettings.배분모드 === 'manual';

  const sections = [
    { id: 'initial', label: '초기도입비' },
    { id: 'direct', label: '직접원가' },
    { id: 'infra', label: '인프라' },
    { id: 'maintenance', label: '유지보수' },
    { id: 'ratio', label: '고정비 배분' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">원가설정</h2>
        {saved && (
          <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full">저장됨</span>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">전체 월 고정비 합계</p>
        <p className="text-2xl font-bold text-blue-800">{fmt(Math.round(monthlyFixed))}원/월</p>
      </div>

      <div className="flex flex-wrap gap-1">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeSection === s.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 초기도입비 */}
      {activeSection === 'initial' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b pb-2">초기도입비 (1회성)</h3>
          <NumberInput label="전용 거치대 단가" value={costSettings.거치대단가} onChange={v => handleChange('거치대단가', v)} />
          <NumberInput label="병원 초기 세팅 인건비" value={costSettings.세팅인건비} onChange={v => handleChange('세팅인건비', v)} />
          <p className="text-xs text-gray-400">* 소모품비는 거래처 관리에서 병원별 개별 입력</p>
        </div>
      )}

      {/* 직접원가 */}
      {activeSection === 'direct' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b pb-2">직접원가 — 병원별 변동</h3>
          <p className="text-xs font-medium text-gray-500">스마트폰</p>
          <NumberInput label="단가" value={costSettings.스마트폰단가} onChange={v => handleChange('스마트폰단가', v)} />
          <NumberInput label="내용연수" value={costSettings.스마트폰내용연수} onChange={v => handleChange('스마트폰내용연수', v)} suffix="년" />
          <NumberInput label="통신비 (월)" value={costSettings.통신비_스마트폰} onChange={v => handleChange('통신비_스마트폰', v)} />
          <NumberInput label="기기보안 (년)" value={costSettings.기기보안_스마트폰} onChange={v => handleChange('기기보안_스마트폰', v)} />
          <p className="text-xs font-medium text-gray-500 mt-4">태블릿</p>
          <NumberInput label="단가" value={costSettings.태블릿단가} onChange={v => handleChange('태블릿단가', v)} />
          <NumberInput label="내용연수" value={costSettings.태블릿내용연수} onChange={v => handleChange('태블릿내용연수', v)} suffix="년" />
          <NumberInput label="통신비 (월)" value={costSettings.통신비_태블릿} onChange={v => handleChange('통신비_태블릿', v)} />
          <NumberInput label="기기보안 (년)" value={costSettings.기기보안_태블릿} onChange={v => handleChange('기기보안_태블릿', v)} />
          <p className="text-xs text-gray-400 mt-2">* 병원별 디바이스 수량은 거래처 관리에서 입력</p>
        </div>
      )}

      {/* 인프라 */}
      {activeSection === 'infra' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b pb-2">인프라 — 고정</h3>
          <NumberInput label="AWS 서버비 (월)" value={costSettings.AWS서버비} onChange={v => handleChange('AWS서버비', v)} note="매월 업데이트 가능" />
          <NumberInput label="AI 추론비 (건당)" value={costSettings.AI추론비} onChange={v => handleChange('AI추론비', v)} note="파악되면 입력" />
          <NumberInput label="데이터 저장 (건당)" value={costSettings.데이터저장} onChange={v => handleChange('데이터저장', v)} />
          <NumberInput label="데이터 전송 (건당)" value={costSettings.데이터전송} onChange={v => handleChange('데이터전송', v)} />
        </div>
      )}

      {/* 유지보수 */}
      {activeSection === 'maintenance' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b pb-2">유지보수 — 고정</h3>
          <NumberInput label="GMP 갱신 (3년)" value={costSettings.GMP갱신} onChange={v => handleChange('GMP갱신', v)} />
          <NumberInput label="ISO13485 (년)" value={costSettings.ISO13485} onChange={v => handleChange('ISO13485', v)} />

          <p className="text-xs font-medium text-gray-500 mt-2">인허가 인력 인건비</p>
          {(costSettings.인허가인력 || []).map((p, i) => (
            <div key={i} className="flex items-center gap-2 ml-2">
              <span className="text-xs text-gray-500 w-16">{i + 1}번 인력</span>
              <FormattedInput
                value={p.급여}
                onChange={v => handlePersonnelChange(i, '급여', v)}
                className="w-32 text-right border border-gray-300 rounded px-2 py-1 text-sm"
              />
              <span className="text-xs text-gray-400">원 ×</span>
              <input
                type="number"
                value={p.투입비율}
                onChange={e => handlePersonnelChange(i, '투입비율', Number(e.target.value))}
                step={0.1} min={0} max={1}
                className="w-16 text-right border border-gray-300 rounded px-2 py-1 text-sm"
              />
              <span className="text-xs text-gray-400">= {fmt(Math.round(p.급여 * p.투입비율))}원/월</span>
            </div>
          ))}

          <NumberInput label="배상책임보험 (년)" value={costSettings.배상책임보험} onChange={v => handleChange('배상책임보험', v)} />
          <NumberInput label="메시지 서비스 (월)" value={costSettings.메시지서비스} onChange={v => handleChange('메시지서비스', v)} />

          <p className="text-xs font-medium text-gray-500 mt-2">기술지원 인력</p>
          <NumberInput label="급여 (월)" value={costSettings.기술지원인력급여} onChange={v => handleChange('기술지원인력급여', v)} />
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm text-gray-700">투입비율</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={costSettings.기술지원투입비율}
                onChange={e => handleChange('기술지원투입비율', Number(e.target.value))}
                step={0.1} min={0} max={1}
                className="w-40 text-right border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-gray-400 w-8"></span>
            </div>
          </div>

          <NumberInput label="Glandy 앱 무형자산 (5년 상각)" value={costSettings.무형자산} onChange={v => handleChange('무형자산', v)} />
        </div>
      )}

      {/* 고정비 배분 */}
      {activeSection === 'ratio' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h3 className="text-sm font-bold text-gray-800 border-b pb-2">고정비 배분</h3>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-700">수동 비율 입력</p>
              <p className="text-xs text-gray-500">
                {isManualMode ? '직접 입력한 비율로 배분' : '처방건수 비중으로 자동 계산'}
              </p>
            </div>
            <button
              onClick={() => handleChange('배분모드', isManualMode ? 'auto' : 'manual')}
              className={`relative w-12 h-6 rounded-full transition-colors ${isManualMode ? 'bg-blue-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isManualMode ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          {isManualMode && (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm text-gray-700">상급종합</label>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    value={costSettings.상급종합비율}
                    onChange={e => {
                      const v = Number(e.target.value);
                      handleChange('상급종합비율', v);
                      handleChange('로컬비율', 100 - v);
                    }}
                    min={0} max={100}
                    className="w-24 text-right border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              </div>
              <span className="text-gray-400 text-lg">:</span>
              <div className="flex-1">
                <label className="text-sm text-gray-700">로컬</label>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    value={costSettings.로컬비율}
                    onChange={e => {
                      const v = Number(e.target.value);
                      handleChange('로컬비율', v);
                      handleChange('상급종합비율', 100 - v);
                    }}
                    min={0} max={100}
                    className="w-24 text-right border border-gray-300 rounded px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-gray-400">%</span>
                </div>
              </div>
            </div>
          )}

          {!isManualMode && (
            <div className="bg-gray-50 rounded p-3 text-xs text-gray-500">
              <p>실제 처방건수 비중으로 자동 배분됩니다.</p>
              <p className="mt-1">인사이트 페이지에서 현재 배분 비율을 확인할 수 있습니다.</p>
            </div>
          )}

          <div className="bg-gray-50 rounded p-3 text-xs text-gray-500">
            <p>월 고정비 {fmt(Math.round(monthlyFixed))}원 기준</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostSettings;

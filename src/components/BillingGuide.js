import React, { useState } from 'react';
import { useData } from '../context/DataContext';

const STEPS = [
  { key: 'step1', label: '청구서 생성', icon: '📝', desc: '청구 금액 확정 및 청구서 작성' },
  { key: 'step2', label: '거래명세서 발송', icon: '📮', desc: '거래명세서를 병원에 발송' },
  { key: 'step3', label: '입금 확인', icon: '💰', desc: '입금 여부 확인 및 대사' },
  { key: 'step4', label: '세금계산서 발행', icon: '🧾', desc: '홈택스 세금계산서 발행' },
];

const DEFAULT_STEPS = { step1: false, step2: false, step3: false, step4: false };

const BillingGuide = ({ entry }) => {
  const { hospitals, updateLedgerEntry } = useData();
  const [activeStep, setActiveStep] = useState(null);

  const hospital = hospitals.find(h => h['거래처명'] === entry['거래처명']);
  const manual = hospital?.['청구매뉴얼'] || '';
  const steps = entry['청구단계'] || DEFAULT_STEPS;
  const completedCount = Object.values(steps).filter(Boolean).length;
  const percent = Math.round((completedCount / 4) * 100);

  const toggleStep = (stepKey) => {
    const updated = { ...steps, [stepKey]: !steps[stepKey] };
    updateLedgerEntry(entry._id, { '청구단계': updated });
  };

  return (
    <div className="p-4 space-y-4">
      {/* 진행률 바 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${completedCount === 4 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className={`text-xs font-semibold whitespace-nowrap ${completedCount === 4 ? 'text-green-600' : 'text-blue-600'}`}>
          {completedCount}/4 완료
        </span>
      </div>

      {/* 4단계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {STEPS.map((s) => {
          const checked = steps[s.key];
          const isActive = activeStep === s.key;
          return (
            <div
              key={s.key}
              onClick={() => setActiveStep(isActive ? null : s.key)}
              className={`rounded-lg border-2 p-3 cursor-pointer transition-all text-center ${
                checked
                  ? 'border-green-400 bg-green-50'
                  : isActive
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xs font-semibold text-gray-700 mb-2">{s.label}</div>
              <label className="flex items-center justify-center gap-1.5 cursor-pointer" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStep(s.key)}
                  className="rounded border-gray-300"
                />
                <span className={`text-xs ${checked ? 'text-green-600' : 'text-gray-400'}`}>
                  {checked ? '완료' : '미완'}
                </span>
              </label>
            </div>
          );
        })}
      </div>

      {/* 매뉴얼 참조 패널 */}
      {activeStep && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-yellow-800">
              📋 {STEPS.find(s => s.key === activeStep)?.label} — 청구 매뉴얼
            </span>
          </div>
          {manual ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{manual}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">
              등록된 청구 매뉴얼이 없습니다. 거래처 관리에서 "{entry['거래처명']}"의 청구 매뉴얼을 작성해주세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BillingGuide;

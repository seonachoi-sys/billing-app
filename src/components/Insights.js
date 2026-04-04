import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { calcAllHospitalBEP, calcSummaryKPI } from '../utils/bepCalculations';
import { fmt } from '../utils/calculations';

// 디자인 색상
const COLORS = {
  achieved: '#639922',  // BEP 달성
  near: '#BA7517',      // 근접 (50~99%)
  warning: '#E24B4A',   // 주의 (30% 미만)
};

function getBepColor(rate) {
  if (rate >= 100) return COLORS.achieved;
  if (rate >= 30) return COLORS.near;
  return COLORS.warning;
}

function getBepLabel(rate) {
  if (rate >= 100) return 'BEP 달성';
  return `${rate}%`;
}

function getBepBgClass(rate) {
  if (rate >= 100) return 'bg-green-50 border-green-200';
  if (rate >= 30) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

const Insights = () => {
  const { ledger, hospitals, costSettings, hospitalCosts } = useData();
  const [tierFilter, setTierFilter] = useState('');

  const bepData = useMemo(() =>
    calcAllHospitalBEP(costSettings, hospitalCosts, hospitals, ledger),
    [costSettings, hospitalCosts, hospitals, ledger]
  );

  const kpi = useMemo(() => calcSummaryKPI(bepData), [bepData]);

  // 필터 + 달성률 높은 순 정렬
  const sortedResults = useMemo(() => {
    let data = [...bepData.results];
    if (tierFilter) data = data.filter(r => r.tier === tierFilter);
    data.sort((a, b) => {
      let av = a.bepRate;
      let bv = b.bepRate;
      if (av === Infinity) av = Number.MAX_SAFE_INTEGER;
      if (bv === Infinity) bv = Number.MAX_SAFE_INTEGER;
      return bv - av;
    });
    return data;
  }, [bepData.results, tierFilter]);

  // 배분 비율 표시
  const ratioDisplay = bepData.allocationRatio
    ? `상종 ${(bepData.allocationRatio['상급종합'] * 100).toFixed(1)}% : 로컬 ${(bepData.allocationRatio['로컬'] * 100).toFixed(1)}%`
    : '';

  return (
    <div className="space-y-6">
      {/* 상단 요약 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500 mb-1">전체 월 매출</p>
          <p className="text-xl font-bold text-gray-800">{fmt(kpi.totalMonthlyRevenue)}<span className="text-xs font-normal text-gray-400">원</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500 mb-1">전체 월 비용</p>
          <p className="text-xl font-bold text-gray-800">{fmt(Math.round(kpi.totalMonthlyCost))}<span className="text-xs font-normal text-gray-400">원</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500 mb-1">BEP 달성</p>
          <p className="text-xl font-bold" style={{ color: COLORS.achieved }}>
            {kpi.bepAchievedCount}<span className="text-xs font-normal text-gray-400">/{kpi.totalHospitalCount}개</span>
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-xs text-gray-500 mb-1">전체 BEP 달성률</p>
          <p className="text-xl font-bold" style={{ color: getBepColor(kpi.avgBepRate) }}>
            {kpi.avgBepRate}<span className="text-xs font-normal text-gray-400">%</span>
          </p>
        </div>
      </div>

      {/* 배분 비율 표시 */}
      {ratioDisplay && (
        <p className="text-xs text-gray-400 text-right">
          고정비 배분: {ratioDisplay} ({costSettings.배분모드 === 'manual' ? '수동' : '처방비중 자동'})
        </p>
      )}

      {/* 탭 필터 */}
      <div className="flex gap-2">
        {[
          { value: '', label: '전체' },
          { value: '상급종합', label: '상급종합' },
          { value: '로컬', label: '로컬' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setTierFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tierFilter === tab.value
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
            {tab.value === '' && ` (${bepData.results.length})`}
            {tab.value === '상급종합' && ` (${bepData.results.filter(r => r.tier === '상급종합').length})`}
            {tab.value === '로컬' && ` (${bepData.results.filter(r => r.tier === '로컬').length})`}
          </button>
        ))}
      </div>

      {/* 병원별 카드 (2열 그리드) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedResults.map(r => {
          const color = getBepColor(r.bepRate);
          const diff = r.bepCases !== Infinity ? r.avgMonthlyCases - r.bepCases : 0;
          const progressPct = Math.min(r.bepRate, 150);

          return (
            <div key={r.hospitalName} className={`rounded-lg border p-5 ${getBepBgClass(r.bepRate)}`}>
              {/* 상단: 병원 정보 + 배지 */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-bold text-gray-800">{r.hospitalName}</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {r.depts.join(', ')} · {r.products.join(', ')}
                    <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{
                      backgroundColor: r.tier === '상급종합' ? '#dbeafe' : '#dcfce7',
                      color: r.tier === '상급종합' ? '#1e40af' : '#166534',
                    }}>
                      {r.tier === '상급종합' ? '상종' : '로컬'}
                    </span>
                  </p>
                </div>
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {getBepLabel(r.bepRate)}
                </span>
              </div>

              {/* 달성률 큰 숫자 */}
              <div className="mb-3">
                <span className="text-3xl font-bold" style={{ color }}>
                  {r.bepRate}
                </span>
                <span className="text-lg text-gray-400 ml-0.5">%</span>
              </div>

              {/* 프로그레스 바 */}
              <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
                <div
                  className="absolute top-0 left-0 h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(progressPct / 1.5, 100)}%`,
                    backgroundColor: color,
                  }}
                />
                {/* BEP 라인 (100% 위치 = 66.7%) */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-gray-600"
                  style={{ left: `${100 / 1.5}%` }}
                  title="BEP"
                />
              </div>

              {/* 하단 3칸 */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white bg-opacity-60 rounded p-2">
                  <p className="text-lg font-bold text-gray-800">{fmt(r.avgMonthlyCases)}</p>
                  <p className="text-xs text-gray-500">월평균 처방</p>
                </div>
                <div className="bg-white bg-opacity-60 rounded p-2">
                  <p className="text-lg font-bold text-gray-800">
                    {r.bepCases === Infinity ? '-' : fmt(r.bepCases)}
                  </p>
                  <p className="text-xs text-gray-500">BEP 처방건수</p>
                </div>
                <div className="bg-white bg-opacity-60 rounded p-2">
                  <p className={`text-lg font-bold ${diff >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {r.bepCases === Infinity ? '-' : `${diff >= 0 ? '+' : ''}${fmt(diff)}`}
                  </p>
                  <p className="text-xs text-gray-500">{diff >= 0 ? '여유' : '부족'}</p>
                </div>
              </div>
            </div>
          );
        })}

        {sortedResults.length === 0 && (
          <div className="col-span-2 text-center py-12 text-gray-400">
            데이터가 없습니다
          </div>
        )}
      </div>

      {/* 하단 인사이트 박스 */}
      <div className="bg-white rounded-lg shadow p-5 space-y-3">
        <h3 className="text-sm font-bold text-gray-800">인사이트</h3>

        {kpi.bepAchieved.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: COLORS.achieved }} />
            <p className="text-sm text-gray-700">
              <span className="font-medium">BEP 달성 병원:</span>{' '}
              {kpi.bepAchieved.map(r => r.hospitalName).join(', ')}
              <span className="text-gray-400 ml-1">({kpi.bepAchieved.length}개/{kpi.totalHospitalCount}개)</span>
            </p>
          </div>
        )}

        {kpi.bepNear.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: COLORS.near }} />
            <p className="text-sm text-gray-700">
              <span className="font-medium">BEP 근접 (50%+):</span>{' '}
              {kpi.bepNear.map(r => `${r.hospitalName}(${r.bepRate}%)`).join(', ')}
            </p>
          </div>
        )}

        {kpi.bepWarning.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: COLORS.warning }} />
            <p className="text-sm text-gray-700">
              <span className="font-medium">주의 필요 (30% 미만):</span>{' '}
              {kpi.bepWarning.map(r => `${r.hospitalName}(${r.bepRate}%)`).join(', ')}
            </p>
          </div>
        )}

        {kpi.additionalCasesNeeded > 0 && (
          <div className="flex items-start gap-2">
            <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 bg-blue-500" />
            <p className="text-sm text-gray-700">
              <span className="font-medium">전체 BEP 달성 필요 추가 처방:</span>{' '}
              약 {fmt(kpi.additionalCasesNeeded)}건/월
            </p>
          </div>
        )}

        {kpi.totalHospitalCount === 0 && (
          <p className="text-sm text-gray-400">분석할 데이터가 없습니다</p>
        )}
      </div>
    </div>
  );
};

export default Insights;

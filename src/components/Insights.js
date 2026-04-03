import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { useData } from '../context/DataContext';
import {
  calcAllHospitalBEP, calcSummaryKPI, calcMonthlyFixedCost,
} from '../utils/bepCalculations';
import { fmt } from '../utils/calculations';

const Insights = () => {
  const { ledger, hospitals, costSettings, hospitalCosts } = useData();
  const [sortKey, setSortKey] = useState('bepRate');
  const [sortDir, setSortDir] = useState('desc');
  const [tierFilter, setTierFilter] = useState('');

  // BEP 전체 계산
  const bepData = useMemo(() =>
    calcAllHospitalBEP(costSettings, hospitalCosts, hospitals, ledger),
    [costSettings, hospitalCosts, hospitals, ledger]
  );

  const kpi = useMemo(() => calcSummaryKPI(bepData), [bepData]);

  const totalFixedCost = useMemo(() => calcMonthlyFixedCost(costSettings), [costSettings]);

  // 필터 + 정렬
  const sortedResults = useMemo(() => {
    let data = [...bepData.results];
    if (tierFilter) data = data.filter(r => r.tier === tierFilter);
    data.sort((a, b) => {
      let av = a[sortKey] ?? 0;
      let bv = b[sortKey] ?? 0;
      if (av === Infinity) av = Number.MAX_SAFE_INTEGER;
      if (bv === Infinity) bv = Number.MAX_SAFE_INTEGER;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return data;
  }, [bepData.results, sortKey, sortDir, tierFilter]);

  // 차트 데이터: BEP 달성률 막대
  const bepBarData = useMemo(() =>
    sortedResults.map(r => ({
      name: r.hospitalName.length > 6 ? r.hospitalName.slice(0, 6) + '…' : r.hospitalName,
      fullName: r.hospitalName,
      달성률: r.bepRate,
      tier: r.tier,
    })),
    [sortedResults]
  );

  // 차트 데이터: 월별 전체 매출 vs 비용
  const monthlyTrendData = useMemo(() => {
    const monthMap = {};
    ledger.forEach(entry => {
      const m = entry['청구기준'];
      if (!m) return;
      if (!monthMap[m]) monthMap[m] = { revenue: 0, cases: 0 };
      monthMap[m].revenue += entry['청구금액'] || 0;
      monthMap[m].cases += entry['최종건수'] || 0;
    });

    return Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => {
      const perCase = (costSettings.AI추론비 || 0) + (costSettings.데이터저장 || 0) + (costSettings.데이터전송 || 0);
      const totalCost = totalFixedCost + (perCase * data.cases);
      return {
        month: month.slice(2), // "26-01"
        매출: Math.round(data.revenue),
        비용: Math.round(totalCost),
        순이익: Math.round(data.revenue - totalCost),
      };
    });
  }, [ledger, costSettings, totalFixedCost]);

  // 차트 데이터: 누적 손익
  const cumulativeChartData = useMemo(() => {
    const allMonths = new Set();
    bepData.results.forEach(r => r.cumulativeData.forEach(d => allMonths.add(d.month)));
    const months = [...allMonths].sort();

    return months.map(month => {
      const row = { month: month.slice(2) };
      bepData.results.forEach(r => {
        const d = r.cumulativeData.find(c => c.month === month);
        if (d) row[r.hospitalName] = Math.round(d.cumulative);
      });
      return row;
    });
  }, [bepData.results]);

  // 차트 데이터: 상종 vs 로컬 수익성 비교
  const tierCompareData = useMemo(() => {
    const tiers = { '상급종합': { revenue: 0, cost: 0, count: 0 }, '로컬': { revenue: 0, cost: 0, count: 0 } };
    bepData.results.forEach(r => {
      const t = tiers[r.tier];
      if (!t) return;
      t.revenue += r.avgMonthlyRevenue;
      t.cost += r.monthlyMaintenance + (r.perCaseVariable * r.avgMonthlyCases);
      t.count += 1;
    });
    return Object.entries(tiers).map(([tier, d]) => ({
      tier,
      '월평균매출': d.count > 0 ? Math.round(d.revenue / d.count) : 0,
      '월평균비용': d.count > 0 ? Math.round(d.cost / d.count) : 0,
      '병원수': d.count,
    }));
  }, [bepData.results]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortArrow = ({ field }) => {
    if (sortKey !== field) return null;
    return <span className="ml-1">{sortDir === 'desc' ? '▼' : '▲'}</span>;
  };

  return (
    <div className="space-y-6">
      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">전체 월 매출</p>
          <p className="text-lg font-bold text-gray-800">{fmt(kpi.totalMonthlyRevenue)}<span className="text-xs text-gray-400">원</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">전체 월 비용</p>
          <p className="text-lg font-bold text-gray-800">{fmt(Math.round(kpi.totalMonthlyCost))}<span className="text-xs text-gray-400">원</span></p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">월 순이익</p>
          <p className={`text-lg font-bold ${kpi.monthlyNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(Math.round(kpi.monthlyNetProfit))}<span className="text-xs text-gray-400">원</span>
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">BEP 달성</p>
          <p className="text-lg font-bold text-blue-600">
            {kpi.bepAchievedCount}<span className="text-xs text-gray-400">/{kpi.totalHospitalCount}개</span>
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">평균 BEP 달성률</p>
          <p className={`text-lg font-bold ${kpi.avgBepRate >= 100 ? 'text-green-600' : kpi.avgBepRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
            {kpi.avgBepRate}<span className="text-xs text-gray-400">%</span>
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">추가 필요 처방</p>
          <p className="text-lg font-bold text-gray-800">{fmt(kpi.additionalCasesNeeded)}<span className="text-xs text-gray-400">건/월</span></p>
        </div>
      </div>

      {/* 핵심 인사이트 */}
      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">핵심 인사이트</h3>
        <div className="space-y-2 text-sm">
          {kpi.bepAchieved.length > 0 && (
            <p className="text-green-700 bg-green-50 rounded px-3 py-2">
              BEP 달성 병원: {kpi.bepAchieved.map(r => r.hospitalName).join(', ')}
              ({kpi.bepAchieved.length}개/전체 {kpi.totalHospitalCount}개)
            </p>
          )}
          {kpi.bepNear.length > 0 && (
            <p className="text-yellow-700 bg-yellow-50 rounded px-3 py-2">
              BEP 근접 병원 (달성률 70%+): {kpi.bepNear.map(r => `${r.hospitalName}(${r.bepRate}%)`).join(', ')}
            </p>
          )}
          {kpi.bepWarning.length > 0 && (
            <p className="text-red-700 bg-red-50 rounded px-3 py-2">
              주의 필요 병원 (달성률 30% 미만): {kpi.bepWarning.map(r => `${r.hospitalName}(${r.bepRate}%)`).join(', ')}
            </p>
          )}
          {kpi.additionalCasesNeeded > 0 && (
            <p className="text-blue-700 bg-blue-50 rounded px-3 py-2">
              전체 BEP 달성을 위해 필요한 추가 처방건수: 약 {fmt(kpi.additionalCasesNeeded)}건/월
            </p>
          )}
        </div>
      </div>

      {/* 병원별 현황 테이블 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">병원별 BEP 현황</h3>
          <select
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs"
          >
            <option value="">전체</option>
            <option value="상급종합">상급종합</option>
            <option value="로컬">로컬</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500">병원명</th>
                <th className="px-3 py-2 text-center text-gray-500">구분</th>
                <th className="px-3 py-2 text-right text-gray-500 cursor-pointer hover:text-gray-800"
                  onClick={() => handleSort('avgMonthlyCases')}>
                  월평균처방<SortArrow field="avgMonthlyCases" />
                </th>
                <th className="px-3 py-2 text-right text-gray-500 cursor-pointer hover:text-gray-800"
                  onClick={() => handleSort('bepCases')}>
                  BEP처방<SortArrow field="bepCases" />
                </th>
                <th className="px-3 py-2 text-right text-gray-500 cursor-pointer hover:text-gray-800"
                  onClick={() => handleSort('bepRate')}>
                  달성률<SortArrow field="bepRate" />
                </th>
                <th className="px-3 py-2 text-right text-gray-500 cursor-pointer hover:text-gray-800"
                  onClick={() => handleSort('monthlyNetProfit')}>
                  월순이익<SortArrow field="monthlyNetProfit" />
                </th>
                <th className="px-3 py-2 text-right text-gray-500 cursor-pointer hover:text-gray-800"
                  onClick={() => handleSort('cumulative')}>
                  누적손익<SortArrow field="cumulative" />
                </th>
                <th className="px-3 py-2 text-center text-gray-500">도입비회수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedResults.map(r => (
                <tr key={r.hospitalName} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{r.hospitalName}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                      r.tier === '상급종합' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {r.tier === '상급종합' ? '상종' : '로컬'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(r.avgMonthlyCases)}건</td>
                  <td className="px-3 py-2 text-right">
                    {r.bepCases === Infinity ? '-' : `${fmt(r.bepCases)}건`}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.bepRate >= 100 ? 'bg-green-100 text-green-700' :
                      r.bepRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {r.bepRate}%
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${r.monthlyNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(r.monthlyNetProfit)}원
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${r.cumulative >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(r.cumulative)}원
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.monthsUntilROI === Infinity ? (
                      <span className="text-red-500">-</span>
                    ) : r.cumulative >= 0 ? (
                      <span className="text-green-600 font-medium">회수완료</span>
                    ) : (
                      <span className="text-gray-500">{r.monthsUntilROI}개월</span>
                    )}
                  </td>
                </tr>
              ))}
              {sortedResults.length === 0 && (
                <tr><td colSpan="8" className="px-3 py-8 text-center text-gray-400">데이터가 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BEP 달성률 막대 차트 */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">병원별 BEP 달성률</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bepBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v) => [`${v}%`, '달성률']}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
              />
              <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'BEP', position: 'right', fontSize: 10 }} />
              <Bar dataKey="달성률" radius={[4, 4, 0, 0]}>
                {bepBarData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.달성률 >= 100 ? '#10b981' : entry.달성률 >= 50 ? '#f59e0b' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 월별 매출 vs 비용 추이 */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">월별 매출 vs 비용 추이</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} />
              <Tooltip formatter={v => `${fmt(v)}원`} />
              <Legend />
              <Line type="monotone" dataKey="매출" stroke="#3b82f6" strokeWidth={2} dot />
              <Line type="monotone" dataKey="비용" stroke="#ef4444" strokeWidth={2} dot />
              <Line type="monotone" dataKey="순이익" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 누적 손익 추이 */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">병원별 누적 손익 추이</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cumulativeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} />
              <Tooltip formatter={v => `${fmt(v)}원`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <ReferenceLine y={0} stroke="#666" />
              {bepData.results.slice(0, 8).map((r, i) => (
                <Line
                  key={r.hospitalName}
                  type="monotone"
                  dataKey={r.hospitalName}
                  stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'][i]}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 상종 vs 로컬 수익성 비교 */}
        <div className="bg-white rounded-lg shadow p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">상급종합 vs 로컬 수익성 비교</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={tierCompareData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tier" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} />
              <Tooltip formatter={v => `${fmt(v)}원`} />
              <Legend />
              <Bar dataKey="월평균매출" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="월평균비용" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-8 mt-2 text-xs text-gray-500">
            {tierCompareData.map(t => (
              <span key={t.tier}>{t.tier}: {t.병원수}개 병원</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Insights;

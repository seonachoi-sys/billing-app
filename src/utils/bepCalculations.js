/**
 * 원가분석 및 BEP(손익분기점) 계산 유틸리티
 */

// 기본 원가 설정값
export const DEFAULT_COST_SETTINGS = {
  // 초기도입비
  거치대단가: 1750000,
  세팅인건비: 210436,

  // 직접원가 - 병원별 변동
  스마트폰단가: 450000,
  스마트폰내용연수: 3,
  태블릿단가: 295000,
  태블릿내용연수: 3,
  통신비_스마트폰: 9091,    // 월
  통신비_태블릿: 8000,      // 월
  기기보안_스마트폰: 19000,  // 년
  기기보안_태블릿: 19000,    // 년

  // 인프라 - 고정
  AWS서버비: 10000000,  // 월
  AI추론비: 0,          // 건당 (파악되면 입력)
  데이터저장: 0,         // 건당
  데이터전송: 0,         // 건당

  // 유지보수 - 고정
  GMP갱신: 4500000,     // 3년
  ISO13485: 5040000,    // 년
  인허가인력: [
    { 급여: 8153600, 투입비율: 0.2 },
    { 급여: 7947667, 투입비율: 0.2 },
    { 급여: 4242000, 투입비율: 1.0 },
  ],
  배상책임보험: 600000,   // 년
  메시지서비스: 30000,     // 월
  기술지원인력급여: 5580900,  // 월
  기술지원투입비율: 0.5,
  무형자산: 173274225,    // 5년 상각

  // 고정비 배분
  배분모드: 'auto',  // 'auto' = 처방건수 비중, 'manual' = 수동 입력
  상급종합비율: 95,  // manual 모드일 때 사용
  로컬비율: 5,       // manual 모드일 때 사용
};

// 병원별 개별 원가 기본값 (hospital 레코드에 직접 저장)
export const DEFAULT_HOSPITAL_COST = {
  소모품비: 0,
  스마트폰수량: 1,
  태블릿수량: 1,
};

/**
 * 전체 월 고정비 합계 계산
 */
export function calcMonthlyFixedCost(settings) {
  const s = settings;
  const aws = s.AWS서버비 || 0;
  const gmp = (s.GMP갱신 || 0) / 36;
  const iso = (s.ISO13485 || 0) / 12;
  const personnelCost = (s.인허가인력 || []).reduce(
    (sum, p) => sum + (p.급여 || 0) * (p.투입비율 || 0), 0
  );
  const insurance = (s.배상책임보험 || 0) / 12;
  const messaging = s.메시지서비스 || 0;
  const techSupport = (s.기술지원인력급여 || 0) * (s.기술지원투입비율 || 0);
  const amortization = (s.무형자산 || 0) / 60;

  return aws + gmp + iso + personnelCost + insurance + messaging + techSupport + amortization;
}

/**
 * 병원별 초기도입비
 */
export function calcInitialCost(settings, hospitalCost) {
  return (settings.거치대단가 || 0)
    + (hospitalCost.소모품비 || 0)
    + (settings.세팅인건비 || 0);
}

/**
 * 병원별 월 변동비 (디바이스 감가 + 통신비 + 보안비)
 */
export function calcMonthlyVariableCost(settings, hospitalCost) {
  const phoneQty = hospitalCost.스마트폰수량 || 0;
  const tabletQty = hospitalCost.태블릿수량 || 0;

  const phoneDepreciation = phoneQty * (settings.스마트폰단가 || 0)
    / ((settings.스마트폰내용연수 || 3) * 12);
  const tabletDepreciation = tabletQty * (settings.태블릿단가 || 0)
    / ((settings.태블릿내용연수 || 3) * 12);
  const phoneCom = phoneQty * (settings.통신비_스마트폰 || 0);
  const tabletCom = tabletQty * (settings.통신비_태블릿 || 0);
  const phoneSecurity = phoneQty * (settings.기기보안_스마트폰 || 0) / 12;
  const tabletSecurity = tabletQty * (settings.기기보안_태블릿 || 0) / 12;

  return phoneDepreciation + tabletDepreciation
    + phoneCom + tabletCom
    + phoneSecurity + tabletSecurity;
}

/**
 * 건당 변동비 (AI추론 + 저장 + 전송)
 */
export function calcPerCaseVariableCost(settings) {
  return (settings.AI추론비 || 0)
    + (settings.데이터저장 || 0)
    + (settings.데이터전송 || 0);
}

/**
 * 병원 구분 판별 (상급종합 vs 로컬)
 */
export function getHospitalTier(hospital) {
  const type = hospital['병원구분'] || '';
  if (type.includes('상급')) return '상급종합';
  return '로컬';
}

/**
 * 처방건수 기반 자동 배분 비율 계산
 */
function calcAutoAllocationRatio(ledger, uniqueHospitals) {
  const tierCases = { '상급종합': 0, '로컬': 0 };

  ledger.forEach(entry => {
    const name = entry['거래처명'];
    const info = uniqueHospitals.get(name);
    if (!info) return;
    tierCases[info.tier] += entry['최종건수'] || 0;
  });

  const total = tierCases['상급종합'] + tierCases['로컬'];
  if (total === 0) return { '상급종합': 0.5, '로컬': 0.5 };

  return {
    '상급종합': tierCases['상급종합'] / total,
    '로컬': tierCases['로컬'] / total,
  };
}

/**
 * 병원별 월 고정비 배분액
 */
export function calcAllocatedFixedCost(ratio, tier, tierCounts, totalFixedCost) {
  const count = tierCounts[tier] || 1;
  return (totalFixedCost * (ratio[tier] || 0)) / count;
}

/**
 * 병원별 BEP 분석 전체 계산
 */
export function calcHospitalBEP(params) {
  const { settings, hospitalCost, hospital, ledgerEntries, tier, tierCounts, totalFixedCost, allocationRatio } = params;

  const unitPrice = hospital['단가'] || hospital['납품가'] || 0;
  const initialCost = calcInitialCost(settings, hospitalCost);
  const monthlyFixed = calcAllocatedFixedCost(allocationRatio, tier, tierCounts, totalFixedCost);
  const monthlyVariable = calcMonthlyVariableCost(settings, hospitalCost);
  const monthlyMaintenance = monthlyFixed + monthlyVariable;
  const perCaseVariable = calcPerCaseVariableCost(settings);
  const contributionMargin = unitPrice - perCaseVariable;

  const bepCases = contributionMargin > 0
    ? Math.ceil(monthlyMaintenance / contributionMargin)
    : Infinity;

  // 월별 데이터 집계
  const monthlyData = {};
  ledgerEntries.forEach(entry => {
    const month = entry['청구기준'];
    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, cases: 0 };
    monthlyData[month].revenue += entry['청구금액'] || 0;
    monthlyData[month].cases += entry['최종건수'] || 0;
  });

  const months = Object.keys(monthlyData).sort();
  const monthCount = months.length || 1;
  const totalRevenue = Object.values(monthlyData).reduce((s, m) => s + m.revenue, 0);
  const totalCases = Object.values(monthlyData).reduce((s, m) => s + m.cases, 0);
  const avgMonthlyRevenue = totalRevenue / monthCount;
  const avgMonthlyCases = totalCases / monthCount;

  // 월순이익 = 월매출 - 월유지비
  const monthlyNetProfit = avgMonthlyRevenue - monthlyMaintenance
    - (perCaseVariable * avgMonthlyCases);

  // 도입비 회수기간(월) — 흑자인 경우만
  const monthsUntilROI = monthlyNetProfit > 0
    ? Math.ceil(initialCost / monthlyNetProfit)
    : Infinity;

  // 달성률 = 월평균처방 / BEP처방 × 100
  const bepRate = bepCases > 0 && bepCases !== Infinity
    ? (avgMonthlyCases / bepCases) * 100
    : 0;

  // 누적 손익 추이
  let cumulative = -initialCost;
  const cumulativeData = months.map(month => {
    const m = monthlyData[month];
    const monthNet = m.revenue - monthlyMaintenance - (perCaseVariable * m.cases);
    cumulative += monthNet;
    return { month, revenue: m.revenue, cost: monthlyMaintenance + (perCaseVariable * m.cases), netProfit: monthNet, cumulative };
  });

  // 제품/진료과 정보 수집
  const products = new Set();
  const depts = new Set();
  ledgerEntries.forEach(e => {
    if (e['제품명']) products.add(e['제품명']);
    if (e['진료과']) depts.add(e['진료과']);
  });

  return {
    hospitalName: hospital['거래처명'],
    tier,
    products: [...products],
    depts: [...depts],
    unitPrice,
    initialCost,
    monthlyFixed,
    monthlyVariable,
    monthlyMaintenance,
    perCaseVariable,
    contributionMargin,
    bepCases,
    avgMonthlyRevenue: Math.round(avgMonthlyRevenue),
    avgMonthlyCases: Math.round(avgMonthlyCases),
    monthlyNetProfit: Math.round(monthlyNetProfit),
    monthsUntilROI,
    bepRate: Math.round(bepRate * 10) / 10,
    cumulativeData,
    totalRevenue,
    totalCases,
    cumulative: Math.round(cumulative),
  };
}

/**
 * 전체 병원 BEP 분석 일괄 계산
 * hospitalCosts는 { 병원명: { 소모품비, 스마트폰수량, 태블릿수량 } } 형태 또는
 * hospital 레코드 자체에 필드가 포함된 경우를 모두 지원
 */
export function calcAllHospitalBEP(settings, hospitalCosts, hospitals, ledger) {
  const totalFixedCost = calcMonthlyFixedCost(settings);
  const tierCounts = { '상급종합': 0, '로컬': 0 };

  const uniqueHospitals = new Map();
  hospitals.forEach(h => {
    if (!h['거래처명']) return;
    const tier = getHospitalTier(h);
    if (!uniqueHospitals.has(h['거래처명'])) {
      uniqueHospitals.set(h['거래처명'], { hospital: h, tier });
    }
  });

  uniqueHospitals.forEach(({ tier }) => {
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
  });

  // 배분비율: auto = 처방건수 비중, manual = 사용자 입력
  let allocationRatio;
  if (settings.배분모드 === 'manual') {
    allocationRatio = {
      '상급종합': (settings.상급종합비율 || 95) / 100,
      '로컬': (settings.로컬비율 || 5) / 100,
    };
  } else {
    allocationRatio = calcAutoAllocationRatio(ledger, uniqueHospitals);
  }

  const ledgerByHospital = {};
  ledger.forEach(entry => {
    const name = entry['거래처명'];
    if (!name) return;
    if (!ledgerByHospital[name]) ledgerByHospital[name] = [];
    ledgerByHospital[name].push(entry);
  });

  const results = [];
  uniqueHospitals.forEach(({ hospital, tier }, name) => {
    // hospital 레코드에서 직접 읽거나 hospitalCosts 맵에서 읽기
    const hCostFromRecord = {
      소모품비: hospital['소모품비'] || 0,
      스마트폰수량: hospital['스마트폰수량'] ?? 1,
      태블릿수량: hospital['태블릿수량'] ?? 1,
    };
    const hCostFromMap = hospitalCosts[name] || {};
    // hospital 레코드 우선, 없으면 맵에서 읽기
    const hCost = {
      소모품비: hCostFromRecord.소모품비 || hCostFromMap.소모품비 || 0,
      스마트폰수량: hospital['스마트폰수량'] != null ? hospital['스마트폰수량'] : (hCostFromMap.스마트폰수량 ?? 1),
      태블릿수량: hospital['태블릿수량'] != null ? hospital['태블릿수량'] : (hCostFromMap.태블릿수량 ?? 1),
    };
    const entries = ledgerByHospital[name] || [];

    results.push(calcHospitalBEP({
      settings,
      hospitalCost: hCost,
      hospital,
      ledgerEntries: entries,
      tier,
      tierCounts,
      totalFixedCost,
      allocationRatio,
    }));
  });

  return { results, totalFixedCost, tierCounts, allocationRatio };
}

/**
 * 전체 요약 KPI 계산
 */
export function calcSummaryKPI(bepResults) {
  const results = bepResults.results || [];
  if (results.length === 0) {
    return {
      totalMonthlyRevenue: 0,
      totalMonthlyCost: 0,
      monthlyNetProfit: 0,
      bepAchievedCount: 0,
      totalHospitalCount: 0,
      avgBepRate: 0,
      bepAchieved: [],
      bepNear: [],
      bepWarning: [],
      additionalCasesNeeded: 0,
    };
  }

  const totalMonthlyRevenue = results.reduce((s, r) => s + r.avgMonthlyRevenue, 0);
  const totalMonthlyCost = results.reduce((s, r) => s + r.monthlyMaintenance + (r.perCaseVariable * r.avgMonthlyCases), 0);
  const monthlyNetProfit = totalMonthlyRevenue - totalMonthlyCost;

  const bepAchieved = results.filter(r => r.bepRate >= 100);
  const bepNear = results.filter(r => r.bepRate >= 50 && r.bepRate < 100);
  const bepWarning = results.filter(r => r.bepRate < 30);

  const avgBepRate = results.reduce((s, r) => s + r.bepRate, 0) / results.length;

  const additionalCasesNeeded = results
    .filter(r => r.bepRate < 100 && r.bepCases !== Infinity)
    .reduce((s, r) => s + Math.max(0, r.bepCases - r.avgMonthlyCases), 0);

  return {
    totalMonthlyRevenue,
    totalMonthlyCost,
    monthlyNetProfit,
    bepAchievedCount: bepAchieved.length,
    totalHospitalCount: results.length,
    avgBepRate: Math.round(avgBepRate * 10) / 10,
    bepAchieved,
    bepNear,
    bepWarning,
    additionalCasesNeeded: Math.round(additionalCasesNeeded),
  };
}

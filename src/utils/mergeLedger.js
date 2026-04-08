/**
 * seedInvoices + billing_ledger 합산 유틸
 * 중복 시 ledger 우선 (같은 거래처+제품+청구월+발생월)
 */
import seedInvoices from '../data/seedInvoices.json';

// seedInvoices(영문) → ledger 형식(한국어)으로 변환
const SEED_AS_LEDGER = seedInvoices.map(inv => ({
  '청구기준': inv.billingMonth,
  '발생기준': inv.occurrenceMonth,
  '거래처명': inv.hospital,
  '진료과': inv.department,
  '제품명': inv.product,
  '당월발생': String(inv.adminQty || 0),
  '병원수량': String(inv.hospitalQty || 0),
  '최종건수': inv.finalQty || 0,
  '단가': inv.unitPrice || 0,
  '공급가': inv.supplyAmount || 0,
  '부가세': inv.tax || 0,
  '청구금액': inv.totalAmount || 0,
  '미수금': inv.receivable || 0,
  '채권상태': inv.status || '',
  '입금예정일': inv.dueDate || '',
  '실제입금일': inv.paidDate || '',
  '정산주기': inv.settlementDays || 0,
  '잠금': 'TRUE',
  '비고': '',
  '_source': 'seed',
}));

/**
 * ledger + seedInvoices 합산
 * @param {Array} ledger - billing_ledger 데이터 (한국어 필드)
 * @returns {Array} 합산된 배열 (중복 시 ledger 우선)
 */
/**
 * 통계 제외 제품 필터링
 * @param {Array} data - ledger 데이터
 * @param {Array} products - 제품 목록 (excludeFromStats 포함)
 * @returns {Array} 통계 제외 제품이 빠진 배열
 */
export function filterForStats(data, products) {
  const excluded = new Set((products || []).filter(p => p.excludeFromStats).map(p => p.name));
  if (excluded.size === 0) return data;
  return data.filter(item => !excluded.has(item['제품명']));
}

export function mergeLedgerWithSeed(ledger) {
  const ledgerKeys = new Set();
  ledger.forEach(item => {
    const key = `${item['거래처명']}||${item['제품명']}||${item['청구기준']}||${item['발생기준'] || item['청구기준']}`;
    ledgerKeys.add(key);
  });
  const seedOnly = SEED_AS_LEDGER.filter(s => {
    const key = `${s['거래처명']}||${s['제품명']}||${s['청구기준']}||${s['발생기준']}`;
    return !ledgerKeys.has(key);
  });
  return [...ledger, ...seedOnly];
}

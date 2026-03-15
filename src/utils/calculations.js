// 국세청 홈택스 기준 부가세 계산
export function calculateVAT(totalAmount) {
  const supply = Math.round(totalAmount / 1.1);
  const vat = totalAmount - supply;
  return { supply, vat, total: totalAmount };
}

// 공급가 + 부가세로 합계 계산
export function calculateTotal(supply) {
  const total = Math.round(supply * 1.1);
  const vat = total - supply;
  return { supply, vat, total };
}

// 입금 예정일 계산: 청구기준월 말일 + 정산주기(일)
export function calculateDueDate(billingMonth, settlementDays) {
  if (!billingMonth || !settlementDays) return '';
  const [year, month] = billingMonth.split('-').map(Number);
  // 청구기준월의 말일
  const endOfMonth = new Date(year, month, 0);
  endOfMonth.setDate(endOfMonth.getDate() + settlementDays);
  return endOfMonth.toISOString().slice(0, 10);
}

// 채권연령 (D-day): 입금예정일까지 남은 일수 (음수 = 아직 안 됨, 양수 = 연체)
export function calculateDday(dueDate) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today - due) / (1000 * 60 * 60 * 24));
}

// 연체 여부
export function isOverdue(entry) {
  if (entry['채권상태'] === '완납') return false;
  if (!entry['입금예정일']) return false;
  return calculateDday(entry['입금예정일']) > 0;
}

// 금액 포맷
export function fmt(v) {
  if (v == null) return '0';
  return typeof v === 'number' ? v.toLocaleString('ko-KR') : v;
}

// 고유 ID 생성
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 다음 업체코드 생성 (C0001, C0002, ...)
export function generateClientCode(hospitals) {
  const codes = hospitals
    .map(h => parseInt((h['업체코드'] || '').replace('C', ''), 10))
    .filter(n => !isNaN(n));
  const max = codes.length > 0 ? Math.max(...codes) : 0;
  return 'C' + String(max + 1).padStart(4, '0');
}

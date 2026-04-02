const fs = require('fs');
const path = require('path');

// --- CSV 파서 (따옴표, 줄바꿈 포함 필드 지원) ---
function parseCSV(text) {
  const rows = [];
  let i = 0;
  while (i < text.length) {
    const row = [];
    while (i < text.length) {
      let value = '';
      if (text[i] === '"') {
        i++; // skip opening quote
        while (i < text.length) {
          if (text[i] === '"') {
            if (i + 1 < text.length && text[i + 1] === '"') {
              value += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            value += text[i];
            i++;
          }
        }
      } else {
        while (i < text.length && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
          value += text[i];
          i++;
        }
      }
      row.push(value.trim());
      if (i < text.length && text[i] === ',') {
        i++;
      } else {
        break;
      }
    }
    // skip line ending
    if (i < text.length && text[i] === '\r') i++;
    if (i < text.length && text[i] === '\n') i++;
    rows.push(row);
  }
  return rows;
}

function toNumber(str) {
  if (!str) return 0;
  return Number(String(str).replace(/,/g, '').replace(/원/g, '')) || 0;
}

// --- 2026 원장 데이터 ---
function parseLedger() {
  const text = fs.readFileSync(path.join(__dirname, 'data', '매출청구 관리 대장 - 2026.csv'), 'utf-8');
  const rows = parseCSV(text);

  // 헤더: 2행 (index 1) — "당월 발생\n(admin)" 같은 멀티라인 헤더가 있으므로 하드코딩
  const headers = [
    '청구기준', '발생기준', '거래처명', '진료과', '제품명',
    '수량확정', '계산서', '당월발생', '병원수량', '차월이월',
    '전월반영', '최종건수', '단가', '공급가', '부가세',
    '청구금액', '정산주기', '입금예정일', '실제입금일', '미수금',
    '채권상태', '채권연령', '잠금', '비고'
  ];

  const data = [];
  // rows[0]=요약행, rows[1]=헤더(멀티라인 포함), rows[2]~=데이터
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    // 빈 행(거래처명 없는 행) 스킵
    if (!row[2]) continue;

    const item = {};
    headers.forEach((h, idx) => {
      item[h] = row[idx] || '';
    });

    // 숫자 변환
    item['최종건수'] = toNumber(item['최종건수']);
    item['단가'] = toNumber(item['단가']);
    // 국세청 홈택스 기준 부가세 계산
    const rawTotal = toNumber(item['청구금액']);
    const supply = Math.round(rawTotal / 1.1);
    const vat = rawTotal - supply;
    item['공급가'] = supply;
    item['부가세'] = vat;
    item['청구금액'] = rawTotal;
    item['미수금'] = toNumber(item['미수금']);
    // 완납이 아닌데 미수금이 비어있으면 청구금액으로 자동 설정
    if (item['채권상태'] !== '완납' && item['미수금'] === 0 && rawTotal > 0) {
      item['미수금'] = rawTotal;
    }
    item['정산주기'] = toNumber(item['정산주기']);
    item['채권연령'] = toNumber(item['채권연령']);

    data.push(item);
  }
  return data;
}

// --- 병원 데이터 ---
function parseHospitals(ledger) {
  const text = fs.readFileSync(path.join(__dirname, 'data', '매출청구 관리 대장 - 병원.csv'), 'utf-8');
  const rows = parseCSV(text);
  const headers = rows[0];

  const data = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[0] || !row[2]) continue; // 업체코드나 거래처명 없으면 스킵

    const item = {};
    headers.forEach((h, idx) => {
      item[h] = (row[idx] || '').trim();
    });

    item['납품가'] = toNumber(item['납품가']);
    item['단가'] = toNumber(item['단가']);
    item['부가세'] = toNumber(item['부가세']);

    // 원장에서 해당 병원의 누적 매출과 미수금 계산
    const hospitalLedger = ledger.filter(l => l['거래처명'] === item['거래처명']);
    item.totalSales = hospitalLedger.reduce((sum, l) => sum + l['청구금액'], 0);
    item.outstanding = hospitalLedger.reduce((sum, l) => sum + l['미수금'], 0);

    data.push(item);
  }
  return data;
}

// --- 마스터 (계약 정보) ---
function parseMaster() {
  const text = fs.readFileSync(path.join(__dirname, 'data', '매출청구 관리 대장 - 마스터.csv'), 'utf-8');
  const rows = parseCSV(text);
  const headers = ['거래처', '계약일', '제품', '갱신', '계약단가', 'VAT포함', '정산주기', '비고', '담당자'];

  const data = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[0]) continue;
    const item = {};
    headers.forEach((h, idx) => {
      item[h] = (row[idx] || '').trim();
    });
    data.push(item);
  }
  return data;
}

// --- 거래명세서 템플릿 정보 ---
function parseInvoiceTemplate() {
  return {
    company: '㈜타이로스코프',
    representative: '박재민',
    businessNumber: '146-88-01720',
    address: '울산광역시 중구 종가로313, 2204호',
    bankAccount: '국민은행 674701-04-553719 ㈜ 타이로스코프',
    paymentTerms: '계약서 제7조에 따름',
    contactTeam: '경영관리팀 (052-264-4154)',
  };
}

// --- 생성 ---
const ledger = parseLedger();
const hospitals = parseHospitals(ledger);
const master = parseMaster();
const invoiceTemplate = parseInvoiceTemplate();

const output = `// 이 파일은 자동 생성됩니다. 직접 수정하지 마세요.
// 생성: node gen-data.js (${new Date().toISOString().slice(0, 10)})

const data = ${JSON.stringify({ ledger, hospitals, master, invoiceTemplate }, null, 2)};

export default data;
`;

fs.writeFileSync(path.join(__dirname, 'src', 'data.js'), output, 'utf-8');
console.log('src/data.js 생성 완료 (원장 ' + ledger.length + '건, 병원 ' + hospitals.length + '건, 계약 ' + master.length + '건)');

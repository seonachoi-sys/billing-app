/**
 * 병원 메타 빌드 유틸
 * Firestore hospitals(한국어) + seedHospitals.json(영문) 폴백
 * 어느 쪽이든 빠짐없이 메타 제공
 */
import seedHospitals from '../data/seedHospitals.json';

// seedHospitals에서 폴백 메타 빌드
const SEED_META = {};
seedHospitals.forEach(h => {
  if (h.name && !SEED_META[h.name]) {
    SEED_META[h.name] = {
      type: h.type || '',
      department: h.department || '',
      salesRep: h.salesRep || '',
    };
  }
});

/**
 * hospitals 배열에서 메타 빌드 (한국어 필드 우선, seed 폴백)
 * @param {Array} hospitals - useData().hospitals
 * @returns {Object} { 거래처명: { type, department, salesRep } }
 */
export function buildHospitalMeta(hospitals) {
  const map = {};

  // 1. Firestore hospitals (한국어 필드)
  hospitals.forEach(h => {
    const name = h['거래처명'];
    if (!name || map[name]) return;
    const type = h['병원구분'] || '';
    const dept = h['진료과'] || '';
    const rep = h['담당사번'] || '';
    // 한국어 필드가 있으면 사용
    if (type || dept || rep) {
      map[name] = { type, department: dept, salesRep: rep };
    }
  });

  // 2. seedHospitals 폴백 (Firestore에 없거나 빈 값인 경우)
  Object.entries(SEED_META).forEach(([name, meta]) => {
    if (!map[name]) {
      map[name] = meta;
    }
  });

  return map;
}

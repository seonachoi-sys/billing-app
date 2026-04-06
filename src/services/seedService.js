/**
 * 시드 데이터 로딩 서비스
 * billing_invoices, billing_reconciliation, billing_hospitals에 시드 데이터 시딩
 */
import {
  COLLECTIONS, fetchSingleDoc, saveSingleDoc,
  deleteCollection, batchWriteCollection,
} from './firestoreService';
import { generateId } from '../utils/calculations';

import seedInvoices from '../data/seedInvoices.json';
import seedReconciliation from '../data/seedReconciliation.json';
import seedHospitals from '../data/seedHospitals.json';

const SEED_DOC_ID = 'seedStatus';

/** 시딩 상태 확인 */
export async function checkSeedStatus() {
  const doc = await fetchSingleDoc(COLLECTIONS.META, SEED_DOC_ID);
  return doc?.seedCompleted === true;
}

/** 시딩 상태 초기화 (재시딩용) */
export async function resetSeedStatus() {
  await saveSingleDoc(COLLECTIONS.META, SEED_DOC_ID, {
    seedCompleted: false,
  });
}

/**
 * 시드 데이터 실행
 * @param {function} onProgress - 진행 상태 콜백 (message, percent)
 * @returns {Object} { invoices, reconciliation, hospitals }
 */
export async function executeSeed(onProgress) {
  const report = (msg, pct) => onProgress && onProgress(msg, pct);

  // 1. 기존 데이터 삭제
  report('기존 인보이스 데이터 삭제 중...', 5);
  await deleteCollection(COLLECTIONS.INVOICES);

  report('기존 대사 데이터 삭제 중...', 15);
  await deleteCollection(COLLECTIONS.RECONCILIATION);

  report('기존 거래처 데이터 삭제 중...', 25);
  await deleteCollection(COLLECTIONS.HOSPITALS);

  // 2. 시드 데이터에 _id 부여
  const invoicesWithId = seedInvoices.map(item => ({
    ...item,
    _id: generateId(),
  }));
  const reconWithId = seedReconciliation.map(item => ({
    ...item,
    _id: generateId(),
  }));
  const hospitalsWithId = seedHospitals.map(item => ({
    ...item,
    _id: item.code || generateId(),
  }));

  // 3. Firestore에 시딩
  report(`인보이스 데이터 저장 중... (${invoicesWithId.length}건)`, 40);
  await batchWriteCollection(COLLECTIONS.INVOICES, invoicesWithId);

  report(`대사 데이터 저장 중... (${reconWithId.length}건)`, 60);
  await batchWriteCollection(COLLECTIONS.RECONCILIATION, reconWithId);

  report(`거래처 데이터 저장 중... (${hospitalsWithId.length}건)`, 80);
  await batchWriteCollection(COLLECTIONS.HOSPITALS, hospitalsWithId);

  // 4. 시딩 완료 상태 저장
  report('시딩 완료 처리 중...', 95);
  await saveSingleDoc(COLLECTIONS.META, SEED_DOC_ID, {
    seedCompleted: true,
    seedDate: new Date().toISOString(),
    version: 1,
    counts: {
      invoices: invoicesWithId.length,
      reconciliation: reconWithId.length,
      hospitals: hospitalsWithId.length,
    },
  });

  report('완료!', 100);

  return {
    invoices: invoicesWithId,
    reconciliation: reconWithId,
    hospitals: hospitalsWithId,
  };
}

/** 시드 데이터 건수 (UI 표시용) */
export const SEED_COUNTS = {
  invoices: seedInvoices.length,
  reconciliation: seedReconciliation.length,
  hospitals: seedHospitals.length,
};

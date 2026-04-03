/**
 * Firestore CRUD 서비스
 * 컬렉션명: billing_ 접두사로 management-app과 분리
 */
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, writeBatch, query, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';

// Firestore 컬렉션명 (billing_ 접두사)
export const COLLECTIONS = {
  LEDGER: 'billing_ledger',
  HOSPITALS: 'billing_hospitals',
  MASTER: 'billing_master',
  TEMPLATE: 'billing_template',
  EMAIL_HISTORY: 'billing_email_history',
};

// --- 범용 CRUD ---

/** 타임아웃 래퍼 */
function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Firestore 응답 시간 초과 (${ms}ms)`)), ms)
    ),
  ]);
}

/** 컬렉션 전체 읽기 */
export async function fetchCollection(collectionName) {
  try {
    const snap = await withTimeout(getDocs(collection(db, collectionName)));
    return snap.docs.map(d => ({ ...d.data(), _id: d.id }));
  } catch (err) {
    console.error(`Firestore 읽기 실패 (${collectionName}):`, err);
    return null; // null = 오류 → localStorage 폴백
  }
}

/** 문서 1건 저장 (upsert) */
export async function upsertDoc(collectionName, id, data) {
  try {
    const { _id, ...rest } = data; // _id는 Firestore 문서 ID로 사용, 데이터에서 제거
    await setDoc(doc(db, collectionName, id), rest);
    return true;
  } catch (err) {
    console.error(`Firestore 저장 실패 (${collectionName}/${id}):`, err);
    return false;
  }
}

/** 문서 1건 부분 업데이트 */
export async function updateDocument(collectionName, id, fields) {
  try {
    const { _id, ...rest } = fields;
    await updateDoc(doc(db, collectionName, id), rest);
    return true;
  } catch (err) {
    console.error(`Firestore 업데이트 실패 (${collectionName}/${id}):`, err);
    return false;
  }
}

/** 문서 1건 삭제 */
export async function deleteDocument(collectionName, id) {
  try {
    await deleteDoc(doc(db, collectionName, id));
    return true;
  } catch (err) {
    console.error(`Firestore 삭제 실패 (${collectionName}/${id}):`, err);
    return false;
  }
}

/** 컬렉션 전체를 배열로 덮어쓰기 (초기 마이그레이션용) */
export async function batchWriteCollection(collectionName, items) {
  try {
    // Firestore batch는 500건 제한 → 분할 처리
    const BATCH_SIZE = 450;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      items.slice(i, i + BATCH_SIZE).forEach(item => {
        const id = item._id;
        if (!id) return;
        const { _id, ...rest } = item;
        batch.set(doc(db, collectionName, id), rest);
      });
      await withTimeout(batch.commit(), 15000);
    }
    return true;
  } catch (err) {
    console.error(`Firestore 일괄 저장 실패 (${collectionName}):`, err);
    return false;
  }
}

/** 컬렉션 전체 삭제 후 새 데이터로 교체 */
export async function replaceCollection(collectionName, items) {
  try {
    // 1. 기존 문서 전부 삭제
    const snap = await withTimeout(getDocs(collection(db, collectionName)));
    const BATCH_SIZE = 450;
    const existingDocs = snap.docs;
    for (let i = 0; i < existingDocs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      existingDocs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
      await withTimeout(batch.commit(), 15000);
    }
    // 2. 새 데이터 쓰기
    if (items.length > 0) {
      await batchWriteCollection(collectionName, items);
    }
    return true;
  } catch (err) {
    console.error(`Firestore 교체 실패 (${collectionName}):`, err);
    return false;
  }
}

/** 단일 문서 저장 (템플릿 등 단건 데이터용) */
export async function saveSingleDoc(collectionName, docId, data) {
  try {
    await setDoc(doc(db, collectionName, docId), data);
    return true;
  } catch (err) {
    console.error(`Firestore 단일 저장 실패 (${collectionName}/${docId}):`, err);
    return false;
  }
}

/** 실시간 구독 (onSnapshot) */
export function subscribeCollection(collectionName, callback) {
  const q = collection(db, collectionName);
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
    callback(data);
  }, (err) => {
    console.error(`Firestore 구독 오류 (${collectionName}):`, err);
  });
}

// --- 마이그레이션: localStorage → Firestore ---

/** localStorage 데이터를 Firestore로 마이그레이션 */
export async function migrateToFirestore() {
  const MIGRATION_KEY = 'billing_firebase_migrated';
  if (localStorage.getItem(MIGRATION_KEY)) {
    return false; // 이미 마이그레이션 완료
  }

  console.log('🔄 Firebase 마이그레이션 시작...');
  let migrated = false;

  // 1. 원장 (ledger)
  const ledgerRaw = localStorage.getItem('billing_ledger');
  if (ledgerRaw) {
    const ledger = JSON.parse(ledgerRaw);
    // Firestore에 이미 데이터가 있는지 확인
    const existing = await fetchCollection(COLLECTIONS.LEDGER);
    if (existing && existing.length === 0 && ledger.length > 0) {
      await batchWriteCollection(COLLECTIONS.LEDGER, ledger);
      console.log(`  ✅ 원장 ${ledger.length}건 마이그레이션`);
      migrated = true;
    }
  }

  // 2. 거래처 (hospitals)
  const hospitalsRaw = localStorage.getItem('billing_hospitals');
  if (hospitalsRaw) {
    const hospitals = JSON.parse(hospitalsRaw);
    const existing = await fetchCollection(COLLECTIONS.HOSPITALS);
    if (existing && existing.length === 0 && hospitals.length > 0) {
      await batchWriteCollection(COLLECTIONS.HOSPITALS, hospitals);
      console.log(`  ✅ 거래처 ${hospitals.length}건 마이그레이션`);
      migrated = true;
    }
  }

  // 3. 계약 (master)
  const masterRaw = localStorage.getItem('billing_master');
  if (masterRaw) {
    const master = JSON.parse(masterRaw);
    const existing = await fetchCollection(COLLECTIONS.MASTER);
    if (existing && existing.length === 0 && master.length > 0) {
      await batchWriteCollection(COLLECTIONS.MASTER, master);
      console.log(`  ✅ 계약 ${master.length}건 마이그레이션`);
      migrated = true;
    }
  }

  // 4. 이메일 발송 이력
  const emailHistoryRaw = localStorage.getItem('billing_email_history');
  if (emailHistoryRaw) {
    const history = JSON.parse(emailHistoryRaw);
    const existing = await fetchCollection(COLLECTIONS.EMAIL_HISTORY);
    if (existing && existing.length === 0 && history.length > 0) {
      await batchWriteCollection(COLLECTIONS.EMAIL_HISTORY, history.map((h, i) => ({
        ...h, _id: h._id || String(Date.now() + i),
      })));
      console.log(`  ✅ 이메일 이력 ${history.length}건 마이그레이션`);
      migrated = true;
    }
  }

  localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
  console.log('✅ Firebase 마이그레이션 완료');
  return migrated;
}

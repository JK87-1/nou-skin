/**
 * AutoBackup — IndexedDB 기반 자동 백업 시스템
 *
 * localStorage 데이터를 IndexedDB에 자동 백업하여 SW 업데이트, 캐시 삭제 등으로
 * 인한 데이터 손실을 방지합니다.
 *
 * - saveRecord() 호출 시 자동 백업
 * - 앱 시작 시 무결성 검증 + 자동 복원
 * - 5분 간격 주기적 백업
 */

const DB_NAME = 'nou_backup_db';
const DB_VERSION = 1;
const STORE_NAME = 'backups';

// localStorage 키 접두사 필터
const KEY_PREFIXES = ['nou_', 'lua_', 'baselineImage'];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.warn('AutoBackup: IndexedDB open failed', req.error);
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

/**
 * 백업 대상 localStorage 키만 수집
 */
function collectLocalStorageData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && KEY_PREFIXES.some(p => key.startsWith(p))) {
      data[key] = localStorage.getItem(key);
    }
  }
  return data;
}

/**
 * 레코드 수 빠르게 확인 (JSON.parse 없이)
 */
function countRecordsQuick() {
  try {
    const raw = localStorage.getItem('nou_skin_records');
    if (!raw) return 0;
    // 간이 카운트: JSON 배열 내 id 필드 수
    return (raw.match(/"id":/g) || []).length;
  } catch {
    return 0;
  }
}

/**
 * 자동 백업 생성 — localStorage 전체를 IndexedDB에 스냅샷
 * @returns {Promise<boolean>} 성공 여부
 */
export async function createAutoBackup() {
  try {
    const lsData = collectLocalStorageData();
    const keyCount = Object.keys(lsData).length;
    if (keyCount === 0) return false;

    const backup = {
      id: 'latest',
      timestamp: Date.now(),
      keyCount,
      recordCount: countRecordsQuick(),
      data: lsData,
    };

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(backup);

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    return true;
  } catch (e) {
    console.warn('AutoBackup: backup failed', e);
    return false;
  }
}

/**
 * 자동 백업에서 복원 — IndexedDB → localStorage
 * @returns {Promise<{restored: boolean, keyCount: number}>}
 */
export async function restoreFromAutoBackup() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get('latest');

    const backup = await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    if (!backup || !backup.data) {
      return { restored: false, keyCount: 0 };
    }

    let count = 0;
    for (const [key, value] of Object.entries(backup.data)) {
      try {
        localStorage.setItem(key, value);
        count++;
      } catch (e) {
        console.warn(`AutoBackup: failed to restore key "${key}"`, e);
      }
    }

    return { restored: true, keyCount: count };
  } catch (e) {
    console.warn('AutoBackup: restore failed', e);
    return { restored: false, keyCount: 0 };
  }
}

/**
 * 백업 타임스탬프 조회
 * @returns {Promise<number|null>} 밀리초 타임스탬프 또는 null
 */
export async function getBackupTimestamp() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get('latest');
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result?.timestamp || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * 백업 메타정보 조회 (UI 표시용)
 * @returns {Promise<{timestamp: number, keyCount: number, recordCount: number}|null>}
 */
export async function getBackupInfo() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get('latest');
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const r = req.result;
        if (!r) return resolve(null);
        resolve({
          timestamp: r.timestamp,
          keyCount: r.keyCount,
          recordCount: r.recordCount,
        });
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * 데이터 무결성 검증
 *
 * localStorage가 비었는데 IndexedDB 백업이 있으면 데이터 손실로 판단
 * @returns {Promise<'ok'|'data_lost'|'no_backup'>}
 */
export async function verifyDataIntegrity() {
  try {
    const currentCount = countRecordsQuick();
    const backupInfo = await getBackupInfo();

    if (!backupInfo) return 'no_backup';

    // localStorage에 레코드가 없는데 백업에는 있는 경우 → 데이터 손실
    if (currentCount === 0 && backupInfo.recordCount > 0) {
      return 'data_lost';
    }

    return 'ok';
  } catch {
    return 'no_backup';
  }
}

/**
 * 주기적 백업 시작 (5분 간격)
 * @returns {function} cleanup 함수
 */
export function startPeriodicBackup() {
  // 앱 시작 시 즉시 1회 백업
  createAutoBackup();

  const intervalId = setInterval(() => {
    createAutoBackup();
  }, 5 * 60 * 1000);

  return () => clearInterval(intervalId);
}

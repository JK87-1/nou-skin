/**
 * PhotoDB — IndexedDB 기반 고해상도 사진 저장소
 *
 * localStorage 5-10MB 제한을 넘어 수백 MB까지 저장 가능.
 * 512×512 JPEG로 저장하여 갤러리/슬라이더에서 선명한 사진 제공.
 *
 * 하위 호환: 기존 localStorage 썸네일(200×200)이 있으면 자동 마이그레이션.
 */

const DB_NAME = 'nou_photo_db';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'date' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.warn('PhotoDB: IndexedDB open failed', req.error);
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

/**
 * 사진 저장 (512×512 JPEG)
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} dataUrl - data:image/... URL
 */
export async function savePhotoDB(dateStr, dataUrl) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({
      date: dateStr,
      dataUrl,
      timestamp: Date.now(),
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('PhotoDB: save failed', e);
  }
}

/**
 * 단일 사진 조회
 * @param {string} dateStr
 * @returns {Promise<string|null>} dataUrl or null
 */
export async function getPhotoDB(dateStr) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(dateStr);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result?.dataUrl || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * 전체 사진 조회 (갤러리용)
 * @returns {Promise<Object>} { "YYYY-MM-DD": dataUrl, ... }
 */
export async function getAllPhotosDB() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const map = {};
        for (const item of req.result || []) {
          map[item.date] = item.dataUrl;
        }
        resolve(map);
      };
      req.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}

/**
 * 사진 삭제
 * @param {string} dateStr
 */
export async function deletePhotoDB(dateStr) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(dateStr);
  } catch {}
}

/**
 * localStorage → IndexedDB 마이그레이션 (최초 1회)
 * 기존 200×200 썸네일을 IndexedDB로 이동. 이후 새 촬영은 512×512로 저장.
 */
export async function migrateFromLocalStorage() {
  const MIGRATED_KEY = 'nou_photos_migrated';
  if (localStorage.getItem(MIGRATED_KEY)) return;

  try {
    const raw = localStorage.getItem('nou_skin_thumbs');
    if (!raw) {
      localStorage.setItem(MIGRATED_KEY, '1');
      return;
    }

    const thumbs = JSON.parse(raw);
    const dates = Object.keys(thumbs);
    if (dates.length === 0) {
      localStorage.setItem(MIGRATED_KEY, '1');
      return;
    }

    const db = await openDB();

    // Check if IndexedDB already has data
    const tx0 = db.transaction(STORE_NAME, 'readonly');
    const countReq = tx0.objectStore(STORE_NAME).count();
    const existingCount = await new Promise((resolve) => {
      countReq.onsuccess = () => resolve(countReq.result);
      countReq.onerror = () => resolve(0);
    });

    if (existingCount > 0) {
      // Already has data, just mark as migrated
      localStorage.setItem(MIGRATED_KEY, '1');
      return;
    }

    // Batch write all thumbnails to IndexedDB
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const date of dates) {
      store.put({ date, dataUrl: thumbs[date], timestamp: 0 });
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        localStorage.setItem(MIGRATED_KEY, '1');
        // Remove old localStorage thumbnails to free space
        localStorage.removeItem('nou_skin_thumbs');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });

    console.log(`PhotoDB: migrated ${dates.length} thumbnails from localStorage`);
  } catch (e) {
    console.warn('PhotoDB: migration failed, keeping localStorage fallback', e);
  }
}

/**
 * 이미지를 512×512로 리사이즈하는 유틸리티
 * @param {string} imageDataUrl
 * @param {number} size - 출력 크기 (기본 512)
 * @param {number} quality - JPEG 품질 (기본 0.82)
 * @returns {Promise<string>} resized dataUrl
 */
export function resizeImage(imageDataUrl, size = 512, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // 중앙 크롭
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2;
      const sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}

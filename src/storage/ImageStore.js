// 제품 누끼 이미지를 IndexedDB에 저장 — localStorage 5MB 한도 회피.
// products(localStorage)는 메타데이터만 보유, imageThumb는 IDB에 별도 저장.
//
// 모든 API는 Promise 기반. 실패 시 fallback으로 메모리 캐시 유지.

const DB_NAME = 'lua_image_store';
const DB_VERSION = 1;
const STORE = 'product_thumbs';

let dbPromise = null;
const memoryCache = new Map(); // 빠른 동기 조회 + IDB 미지원 환경 fallback

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unsupported'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore(mode, fn) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      const r = fn(store);
      if (r && typeof r === 'object' && 'onsuccess' in r) {
        r.onsuccess = () => { result = r.result; };
        r.onerror = () => reject(r.error);
      } else {
        result = r;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (e) {
    // IDB 사용 불가 — 메모리 캐시만 동작
    throw e;
  }
}

/** 단일 thumb 저장 */
export async function setProductThumb(id, dataUrl) {
  if (!id) return;
  memoryCache.set(String(id), dataUrl || null);
  if (!dataUrl) {
    try { await withStore('readwrite', s => s.delete(String(id))); } catch {}
    return;
  }
  try {
    await withStore('readwrite', s => s.put(dataUrl, String(id)));
  } catch (e) {
    // IDB 실패해도 메모리 캐시는 유지 → 세션 내 표시 OK
  }
}

/** 모든 thumb를 Map으로 반환 */
export async function getAllProductThumbs() {
  // 메모리 캐시가 비어 있지 않고 충분하면 우선 반환할 수도 있지만 정확성 위해 IDB에서 fresh load
  try {
    const out = new Map();
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return;
        out.set(String(c.key), c.value);
        memoryCache.set(String(c.key), c.value);
        c.continue();
      };
      cursor.onerror = () => reject(cursor.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return out;
  } catch (e) {
    return new Map(memoryCache);
  }
}

/** 단일 thumb 조회 (메모리 캐시 우선) */
export async function getProductThumb(id) {
  if (!id) return null;
  const sid = String(id);
  if (memoryCache.has(sid)) return memoryCache.get(sid);
  try {
    return await withStore('readonly', s => s.get(sid));
  } catch {
    return null;
  }
}

// ===== Profile Image — 같은 IDB store, 약속 키 사용 =====
const PROFILE_KEY = '__profile_image__';

export async function setProfileImage(dataUrl) {
  if (!dataUrl) {
    memoryCache.delete(PROFILE_KEY);
    try { await withStore('readwrite', s => s.delete(PROFILE_KEY)); } catch {}
    return;
  }
  memoryCache.set(PROFILE_KEY, dataUrl);
  try {
    await withStore('readwrite', s => s.put(dataUrl, PROFILE_KEY));
  } catch {}
}

export async function getProfileImage() {
  if (memoryCache.has(PROFILE_KEY)) return memoryCache.get(PROFILE_KEY);
  try {
    const data = await withStore('readonly', s => s.get(PROFILE_KEY));
    if (data) memoryCache.set(PROFILE_KEY, data);
    return data || null;
  } catch {
    return null;
  }
}

/** 단일 thumb 삭제 */
export async function deleteProductThumb(id) {
  if (!id) return;
  memoryCache.delete(String(id));
  try { await withStore('readwrite', s => s.delete(String(id))); } catch {}
}

/** localStorage products에 박혀 있던 imageThumb를 IDB로 이전 후 localStorage에서 제거.
 *  반환: { migrated, before, after } — migrated=옮긴 개수, before/after=localStorage products 크기. */
export async function migrateThumbsFromLocalStorage(products, persistFn) {
  const targets = (products || []).filter(p => p && p.imageThumb && typeof p.imageThumb === 'string');
  if (targets.length === 0) return { migrated: 0, before: 0, after: 0 };

  for (const p of targets) {
    try {
      await setProductThumb(p.id, p.imageThumb);
    } catch { /* skip */ }
  }
  const cleaned = (products || []).map(p =>
    (p && p.imageThumb) ? { ...p, imageThumb: null } : p
  );
  const before = JSON.stringify(products || []).length;
  const after = JSON.stringify(cleaned).length;
  if (typeof persistFn === 'function') {
    try { persistFn(cleaned); } catch {}
  }
  return { migrated: targets.length, before, after, cleaned };
}

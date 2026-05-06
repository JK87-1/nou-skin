/**
 * 영양제 스토리지
 * 4시간대(아침/점심/저녁/취침전) 영양제 항목 + 일별 체크 + 루틴 설정
 */

const ITEMS_KEY = 'lua_supplement_items';
const CHECKS_KEY = 'lua_supplement_checks';
const ROUTINE_KEY = 'lua_supplement_routine';

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ===== 영양제 아이템 (기존 호환) =====
export function getSupplementItems() {
  try { return JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]'); } catch { return []; }
}

export function saveSupplementItems(items) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export function addSupplementItem(name, timing) {
  const items = getSupplementItems();
  items.push({ id: Date.now(), name, timing }); // timing: 'morning' | 'lunch' | 'evening' | 'bedtime'
  saveSupplementItems(items);
  return items;
}

export function deleteSupplementItem(id) {
  const items = getSupplementItems().filter(i => i.id !== id);
  saveSupplementItems(items);
  return items;
}

// ===== 일별 체크 =====
export function getSupplementChecks(dateStr) {
  try {
    const all = JSON.parse(localStorage.getItem(CHECKS_KEY) || '{}');
    return all[dateStr || getTodayStr()] || {};
  } catch { return {}; }
}

export function toggleSupplementCheck(id, dateStr) {
  const date = dateStr || getTodayStr();
  try {
    const all = JSON.parse(localStorage.getItem(CHECKS_KEY) || '{}');
    if (!all[date]) all[date] = {};
    all[date][id] = !all[date][id];
    localStorage.setItem(CHECKS_KEY, JSON.stringify(all));
    return all[date];
  } catch { return {}; }
}

// ===== 루틴 설정 (온보딩 결과) =====
export function getSupplementRoutine() {
  try { return JSON.parse(localStorage.getItem(ROUTINE_KEY) || 'null'); } catch { return null; }
}

export function saveSupplementRoutine(routine) {
  localStorage.setItem(ROUTINE_KEY, JSON.stringify({
    ...routine,
    lastModifiedAt: new Date().toISOString(),
  }));
  // 루틴의 스케줄을 아이템으로 동기화
  syncRoutineToItems(routine);
}

function syncRoutineToItems(routine) {
  if (!routine?.schedule) return;
  const items = [];
  let idx = 0;
  for (const [timing, supps] of Object.entries(routine.schedule)) {
    supps.forEach(s => {
      items.push({
        id: Date.now() + (idx++) * 7 + 1,
        supplementId: s.id,
        name: s.name || s.id,
        timing,
        meal: s.meal || 'after',
      });
    });
  }
  saveSupplementItems(items);
}

export function clearSupplementRoutine() {
  localStorage.removeItem(ROUTINE_KEY);
  saveSupplementItems([]);
}

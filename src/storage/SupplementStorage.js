/**
 * 영양제 스토리지
 * 시간대별(아침/점심/저녁) 영양제 항목 + 일별 체크
 */

const ITEMS_KEY = 'lua_supplement_items';
const CHECKS_KEY = 'lua_supplement_checks';

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getSupplementItems() {
  try { return JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]'); } catch { return []; }
}

export function saveSupplementItems(items) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export function addSupplementItem(name, timing) {
  const items = getSupplementItems();
  items.push({ id: Date.now(), name, timing }); // timing: 'morning' | 'lunch' | 'evening'
  saveSupplementItems(items);
  return items;
}

export function deleteSupplementItem(id) {
  const items = getSupplementItems().filter(i => i.id !== id);
  saveSupplementItems(items);
  return items;
}

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

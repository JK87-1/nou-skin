/**
 * 실시간 컨디션 체크 데이터 관리
 */
const STORAGE_KEY = 'nou_condition_checks';

export function getConditionChecks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

export function getTodayChecks() {
  const today = new Date().toISOString().slice(0, 10);
  return getConditionChecks().filter(c => c.timestamp.slice(0, 10) === today);
}

export function getLatestCheck() {
  const checks = getConditionChecks();
  return checks.length > 0 ? checks[checks.length - 1] : null;
}

export function saveConditionCheck(check) {
  const checks = getConditionChecks();
  checks.push({
    timestamp: new Date().toISOString(),
    energy: check.energy,
    skin: check.skin,
    mood: check.mood,
    gut: check.gut,
    vitality: check.vitality,
    focus: check.focus,
  });
  // 최근 100개만 유지
  const trimmed = checks.slice(-100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return trimmed[trimmed.length - 1];
}

// ===== Mood Sub Checks =====
const MOOD_SUB_KEY = 'nou_mood_sub_checks';

export function getMoodSubChecks() {
  try { return JSON.parse(localStorage.getItem(MOOD_SUB_KEY) || '[]'); } catch { return []; }
}

export function getTodayMoodSubCheck() {
  const today = new Date().toISOString().slice(0, 10);
  return getMoodSubChecks().find(c => c.date === today) || null;
}

export function saveMoodSubCheck(emotions, stress) {
  const checks = getMoodSubChecks();
  const today = new Date().toISOString().slice(0, 10);
  const idx = checks.findIndex(c => c.date === today);
  const entry = { date: today, emotions, stress, timestamp: new Date().toISOString() };
  if (idx >= 0) checks[idx] = entry;
  else checks.push(entry);
  const trimmed = checks.slice(-100);
  localStorage.setItem(MOOD_SUB_KEY, JSON.stringify(trimmed));
  return entry;
}

// ===== Skin Sub Checks =====
const SKIN_SUB_KEY = 'nou_skin_sub_checks';

export function getSkinSubChecks() {
  try { return JSON.parse(localStorage.getItem(SKIN_SUB_KEY) || '[]'); } catch { return []; }
}

export function getTodaySkinSubCheck() {
  const today = new Date().toISOString().slice(0, 10);
  return getSkinSubChecks().find(c => c.date === today) || null;
}

export function saveSkinSubCheck(data) {
  const checks = getSkinSubChecks();
  const today = new Date().toISOString().slice(0, 10);
  const idx = checks.findIndex(c => c.date === today);
  const entry = { date: today, ...data, timestamp: new Date().toISOString() };
  if (idx >= 0) checks[idx] = { ...checks[idx], ...entry };
  else checks.push(entry);
  const trimmed = checks.slice(-100);
  localStorage.setItem(SKIN_SUB_KEY, JSON.stringify(trimmed));
  return trimmed.find(c => c.date === today);
}

// ===== Blood Sugar Checks =====
const BLOOD_SUGAR_KEY = 'nou_blood_sugar_checks';

export function getBloodSugarChecks() {
  try { return JSON.parse(localStorage.getItem(BLOOD_SUGAR_KEY) || '[]'); } catch { return []; }
}

export function getTodayBloodSugar() {
  const today = new Date().toISOString().slice(0, 10);
  return getBloodSugarChecks().find(c => c.date === today) || null;
}

export function saveBloodSugar(value, timing) {
  const checks = getBloodSugarChecks();
  const today = new Date().toISOString().slice(0, 10);
  const idx = checks.findIndex(c => c.date === today);
  const entry = { date: today, value, timing, timestamp: new Date().toISOString() };
  if (idx >= 0) checks[idx] = entry;
  else checks.push(entry);
  const trimmed = checks.slice(-100);
  localStorage.setItem(BLOOD_SUGAR_KEY, JSON.stringify(trimmed));
  return entry;
}

// ===== Eye Body Checks =====
const EYE_BODY_KEY = 'nou_eye_body_checks';

export function getEyeBodyChecks() {
  try { return JSON.parse(localStorage.getItem(EYE_BODY_KEY) || '[]'); } catch { return []; }
}

export function getTodayEyeBody() {
  const today = new Date().toISOString().slice(0, 10);
  return getEyeBodyChecks().find(c => c.date === today) || null;
}

export function saveEyeBody(photos) {
  const checks = getEyeBodyChecks();
  const today = new Date().toISOString().slice(0, 10);
  const idx = checks.findIndex(c => c.date === today);
  const entry = { date: today, photos, timestamp: new Date().toISOString() };
  if (idx >= 0) checks[idx] = entry;
  else checks.push(entry);
  const trimmed = checks.slice(-50);
  localStorage.setItem(EYE_BODY_KEY, JSON.stringify(trimmed));
  return entry;
}

// ===== Energy Sub Checks =====
const ENERGY_SUB_KEY = 'nou_energy_sub_checks';

export function getEnergySubChecks() {
  try { return JSON.parse(localStorage.getItem(ENERGY_SUB_KEY) || '[]'); } catch { return []; }
}

export function getTodayEnergySubCheck() {
  const today = new Date().toISOString().slice(0, 10);
  const checks = getEnergySubChecks();
  return checks.find(c => c.date === today) || null;
}

export function saveEnergySubCheck(vitality, focus) {
  const checks = getEnergySubChecks();
  const today = new Date().toISOString().slice(0, 10);
  const idx = checks.findIndex(c => c.date === today);
  const entry = { date: today, vitality, focus, timestamp: new Date().toISOString() };
  if (idx >= 0) checks[idx] = entry;
  else checks.push(entry);
  const trimmed = checks.slice(-100);
  localStorage.setItem(ENERGY_SUB_KEY, JSON.stringify(trimmed));
  return entry;
}

export function shouldResetCheck() {
  const latest = getLatestCheck();
  if (!latest) return true;
  return (Date.now() - new Date(latest.timestamp).getTime()) > 30 * 60 * 1000;
}

export function getMinutesSinceLastCheck() {
  const latest = getLatestCheck();
  if (!latest) return null;
  return Math.floor((Date.now() - new Date(latest.timestamp).getTime()) / 60000);
}

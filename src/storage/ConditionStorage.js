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
  });
  // 최근 100개만 유지
  const trimmed = checks.slice(-100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return trimmed[trimmed.length - 1];
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

/**
 * LUA Consult Storage — 페르소나별 별도 세션
 * 케어·클리닉·컨시어지가 각자 독립된 대화 컨텍스트를 가집니다.
 * 사용자가 페르소나를 전환하면 그 페르소나의 이전 대화로 자동 복원되고,
 * 처음 진입한 페르소나면 빈 채팅으로 시작합니다.
 */

const CONSULT_KEY_PREFIX = 'nou_consult_session_';
const LEGACY_CONSULT_KEY = 'nou_consult_session'; // 이전 단일 세션 키 — 자동 정리
const MAX_MESSAGES = 20;

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function keyFor(personaId) {
  const safe = String(personaId || 'care').replace(/[^a-z0-9_-]/gi, '');
  return CONSULT_KEY_PREFIX + safe;
}

export function saveConsultSession(messages, personaId = 'care') {
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    const session = {
      date: getTodayStr(),
      messages: trimmed,
    };
    localStorage.setItem(keyFor(personaId), JSON.stringify(session));
  } catch (e) {
    console.warn('LUA: consult session save failed', e);
  }
}

export function loadConsultSession(personaId = 'care') {
  try {
    const raw = localStorage.getItem(keyFor(personaId));
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.date !== getTodayStr()) return null;
    return session.messages || null;
  } catch {
    return null;
  }
}

export function clearConsultSession(personaId = 'care') {
  try {
    localStorage.removeItem(keyFor(personaId));
  } catch {}
}

// 이전 단일 세션 키 — 첫 진입 시 1회 정리 (페르소나 구분 없는 옛 데이터)
export function purgeLegacyConsultSession() {
  try {
    localStorage.removeItem(LEGACY_CONSULT_KEY);
  } catch {}
}

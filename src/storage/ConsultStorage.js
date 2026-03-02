/**
 * LUA Consult Storage
 * 오늘의 채팅 세션을 localStorage에 저장/복원
 */

const CONSULT_KEY = 'nou_consult_session';
const MAX_MESSAGES = 20;

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function saveConsultSession(messages) {
  try {
    const trimmed = messages.slice(-MAX_MESSAGES);
    const session = {
      date: getTodayStr(),
      messages: trimmed,
    };
    localStorage.setItem(CONSULT_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('LUA: consult session save failed', e);
  }
}

export function loadConsultSession() {
  try {
    const raw = localStorage.getItem(CONSULT_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Only restore today's session
    if (session.date !== getTodayStr()) return null;
    return session.messages || null;
  } catch {
    return null;
  }
}

export function clearConsultSession() {
  try {
    localStorage.removeItem(CONSULT_KEY);
  } catch {}
}

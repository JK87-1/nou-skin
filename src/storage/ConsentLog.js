/**
 * ConsentLog — 약관 동의 이력 영속화.
 *
 * 변호사 검토(2026-05-21) 결과 반영. 누가·언제·어떤 버전 약관에 동의했는지
 * localStorage에 저장. 추후 분쟁 대응·법정 입증용.
 *
 * 'nou_' prefix → AutoBackup 자동 백업 대상.
 */

import { LEGAL_VERSION } from '../legal/legalContent';

const LOG_KEY = 'nou_consent_log';

function getDeviceUUID() {
  try {
    let id = localStorage.getItem('nou_device_id');
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('nou_device_id', id);
    }
    return id.slice(0, 8); // 8자 절단 (개인정보 처리방침과 일치)
  } catch { return 'unknown'; }
}

export function getConsentLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * 동의 시점 기록. agreed: { terms, privacy, biometric, overseas, ageConfirmed }
 * 동일 버전에 다시 동의 시 timestamp 갱신.
 */
export function recordConsent(agreed) {
  const entry = {
    acceptedAt: new Date().toISOString(),
    legalVersion: LEGAL_VERSION,
    deviceUUID: getDeviceUUID(),
    agreed: {
      terms: !!agreed.terms,
      privacy: !!agreed.privacy,
      biometric: !!agreed.biometric,
      overseas: !!agreed.overseas,
      ageConfirmed: !!agreed.ageConfirmed,
    },
    userAgent: typeof navigator !== 'undefined' ? (navigator.userAgent || '').slice(0, 200) : '',
  };
  try {
    // 기존 로그가 있으면 history 배열로 누적
    const prev = getConsentLog();
    const history = prev?.history || [];
    if (prev?.acceptedAt) history.push({ acceptedAt: prev.acceptedAt, legalVersion: prev.legalVersion, agreed: prev.agreed });
    const next = { ...entry, history: history.slice(-10) }; // 최근 10개 히스토리만 보관
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function hasConsentedTo(key) {
  const log = getConsentLog();
  return !!(log?.agreed?.[key]);
}

export function getConsentVersion() {
  const log = getConsentLog();
  return log?.legalVersion || null;
}

/** 약관 버전이 바뀌면 재동의 필요 — App 시작 시 체크 */
export function needsReConsent() {
  const log = getConsentLog();
  if (!log) return true;
  return log.legalVersion !== LEGAL_VERSION;
}

export function clearConsentLog() {
  try { localStorage.removeItem(LOG_KEY); } catch {}
}

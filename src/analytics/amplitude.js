/**
 * Amplitude Analytics 래퍼
 *
 * - VITE_AMPLITUDE_API_KEY 없으면 init 스킵 → track/identify 호출은 전부 no-op
 * - localhost / dev 빌드는 자동으로 init 스킵 (필요 시 VITE_AMPLITUDE_FORCE_DEV=1 로 강제)
 * - 외부 호출부는 본 모듈 함수만 사용 (직접 amplitude SDK import 금지)
 */
import * as amplitude from '@amplitude/analytics-browser';

let initialized = false;

function isLocalhost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
}

function shouldInit() {
  const key = import.meta.env.VITE_AMPLITUDE_API_KEY;
  if (!key) return false;
  // dev 환경에서는 기본 비활성화 (VITE_AMPLITUDE_FORCE_DEV=1 로 강제 활성화 가능)
  if (import.meta.env.DEV && !import.meta.env.VITE_AMPLITUDE_FORCE_DEV) return false;
  if (isLocalhost() && !import.meta.env.VITE_AMPLITUDE_FORCE_DEV) return false;
  return true;
}

export function initAnalytics() {
  if (initialized) return;
  if (!shouldInit()) return;
  try {
    amplitude.init(import.meta.env.VITE_AMPLITUDE_API_KEY, {
      defaultTracking: {
        attribution: true,
        pageViews: true,
        sessions: true,
        formInteractions: false,
        fileDownloads: false,
      },
    });
    initialized = true;
  } catch (e) {
    // 분석 실패가 앱 흐름을 막지 않도록 swallow
    console.warn('[analytics] init failed', e);
  }
}

export function identifyUser(userId, properties) {
  if (!initialized) return;
  try {
    if (userId) amplitude.setUserId(String(userId));
    if (properties && Object.keys(properties).length > 0) {
      const id = new amplitude.Identify();
      for (const [k, v] of Object.entries(properties)) {
        if (v === null || v === undefined) continue;
        id.set(k, v);
      }
      amplitude.identify(id);
    }
  } catch (e) {
    console.warn('[analytics] identify failed', e);
  }
}

export function setUserProperties(properties) {
  identifyUser(null, properties);
}

export function track(eventName, eventProps) {
  if (!initialized) return;
  try {
    amplitude.track(eventName, eventProps || {});
  } catch (e) {
    console.warn('[analytics] track failed', eventName, e);
  }
}

/* ── 이벤트 헬퍼 (호출부에서 import해서 사용) ────────────── */

export const trackUserSignedUp = (signupMethod = 'onboarding') =>
  track('User_Signed_Up', { signup_method: signupMethod });

export const trackFirstRecordCreated = (category) =>
  track('First_Record_Created', { category });

export const trackRecordCreated = (category, valueFilled) =>
  track('Record_Created', { category, value_filled: valueFilled });

export const trackInsightViewed = (briefingType) =>
  track('Insight_Viewed', { briefing_type: briefingType });

export const trackPaywallViewed = (trigger) =>
  track('Paywall_Viewed', { trigger });

export const trackSubscriptionPurchased = (plan, price) =>
  track('Subscription_Purchased', { plan, price });

export const trackSubscriptionCanceled = (daysUsed) =>
  track('Subscription_Canceled', { days_used: daysUsed });

/**
 * 첫 기록 여부를 1회만 발생시키기 위한 가드.
 * localStorage 플래그 사용. 카테고리별이 아닌 "앱 전체 최초 1회" 기준.
 */
const FIRST_RECORD_KEY = 'lua_first_record_tracked';
export function trackRecordCreatedWithFirstCheck(category, valueFilled) {
  trackRecordCreated(category, valueFilled);
  try {
    if (!localStorage.getItem(FIRST_RECORD_KEY)) {
      trackFirstRecordCreated(category);
      localStorage.setItem(FIRST_RECORD_KEY, '1');
    }
  } catch {}
}

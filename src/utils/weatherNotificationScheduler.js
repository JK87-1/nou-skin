// 클라이언트 로컬 알림 스케줄러
// - 웹/PWA: 서버 크론 푸시와 병행, 앱이 열려있을 때 시간대별 알림을 직접 표시
// - 네이티브 앱: Capacitor LocalNotifications로 OS 레벨 예약 (앱이 닫혀도 발송)

import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'lua_weather_notif_sent';
// 네이티브 로컬 알림 ID 영역 (hour 더해서 사용: 71008 = 오전 8시)
const NATIVE_ID_BASE = 71000;
let activeTimers = [];
let swListenerAttached = false;

function weatherEnabledSetting() {
  try {
    const settings = JSON.parse(localStorage.getItem('lua_push_settings') || '{}');
    return !!settings.weatherEnabled;
  } catch {
    return false;
  }
}

/**
 * 오늘 이미 보낸 알림 시간 목록 가져오기
 */
function getSentToday() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const today = new Date().toISOString().split('T')[0];
    if (saved.date !== today) return { date: today, hours: [] };
    return saved;
  } catch {
    return { date: new Date().toISOString().split('T')[0], hours: [] };
  }
}

function markSent(hour) {
  const sent = getSentToday();
  if (!sent.hours.includes(hour)) sent.hours.push(hour);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sent));
}

/**
 * 브라우저 알림 표시
 */
async function showLocalNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // 서비스워커가 있으면 서비스워커를 통해 표시 (PWA에서 더 안정적)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `lua-weather-local-${Date.now()}`,
        renotify: true,
      });
      return;
    } catch {}
  }

  // 폴백: 기본 Notification API
  new Notification(title, {
    body,
    icon: '/icons/icon-192.png',
  });
}

/**
 * 모든 기존 타이머 취소
 */
export function clearWeatherTimers() {
  activeTimers.forEach(id => clearTimeout(id));
  activeTimers = [];
}

/**
 * 날씨 데이터 기반으로 오늘 남은 알림 스케줄링
 * @param {Array} notifications - getScheduledNotifications() 결과
 */
/**
 * 서비스워커에서 서버 푸시 수신 시 중복 방지 리스너 등록
 */
function attachSwListener() {
  if (swListenerAttached || !('serviceWorker' in navigator)) return;
  swListenerAttached = true;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'weather-push-received') {
      markSent(event.data.hour);
    }
  });
}

/**
 * 네이티브 앱: 이전에 예약한 날씨 로컬 알림 모두 취소
 */
async function cancelNativeWeather(LocalNotifications) {
  try {
    const pending = await LocalNotifications.getPending();
    const ours = (pending.notifications || []).filter(
      (n) => n.id >= NATIVE_ID_BASE && n.id < NATIVE_ID_BASE + 100,
    );
    if (ours.length) {
      await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    }
  } catch {}
}

/**
 * 네이티브 앱(iOS/Android): Capacitor LocalNotifications로 오늘 남은 알림을 OS에 예약.
 * 웹 Notification API와 달리 앱이 닫혀 있어도 발송됨.
 */
async function scheduleNativeNotifications(notifications) {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // 설정 꺼져있으면 기존 예약 정리 후 종료
    if (!weatherEnabledSetting()) {
      await cancelNativeWeather(LocalNotifications);
      return;
    }

    // 권한 확인 (없으면 요청)
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== 'granted') return;

    // 중복 방지: 기존 날씨 알림 취소 후 재예약
    await cancelNativeWeather(LocalNotifications);

    const now = new Date();
    const toSchedule = [];
    for (const notif of notifications) {
      if (typeof notif.hour !== 'number') continue;
      const at = new Date(now);
      at.setHours(notif.hour, 0, 0, 0);
      if (at.getTime() <= now.getTime()) continue; // 이미 지난 시간 스킵

      toSchedule.push({
        id: NATIVE_ID_BASE + notif.hour,
        title: notif.title,
        body: notif.body,
        schedule: { at },
      });
    }

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule });
    }
  } catch (e) {
    console.warn('[native] 날씨 로컬 알림 예약 실패', e);
  }
}

export function scheduleWeatherNotifications(notifications) {
  clearWeatherTimers();

  // 네이티브 앱: OS 레벨 로컬 알림으로 예약 (앱이 닫혀도 발송)
  if (Capacitor.isNativePlatform()) {
    scheduleNativeNotifications(notifications);
    return;
  }

  attachSwListener();

  // 알림 권한 체크
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // 날씨 알림 설정 확인
  if (!weatherEnabledSetting()) return;

  const now = new Date();
  const sent = getSentToday();

  for (const notif of notifications) {
    // 공유 스케줄의 hour 사용 (없으면 스킵)
    const hour = typeof notif.hour === 'number' ? notif.hour : null;
    if (hour === null) continue;
    const minute = 0;

    // 이미 보낸 알림 스킵
    if (sent.hours.includes(hour)) continue;

    // 알림 시간 계산
    const target = new Date(now);
    target.setHours(hour, minute, 0, 0);

    const delay = target.getTime() - now.getTime();

    // 이미 지난 시간이면 스킵 (단, 5분 이내면 바로 보냄)
    if (delay < -5 * 60 * 1000) continue;

    const actualDelay = Math.max(0, delay);

    const timerId = setTimeout(() => {
      // 다시 한번 중복 체크 (서버 푸시와 겹칠 수 있으므로)
      const currentSent = getSentToday();
      if (currentSent.hours.includes(hour)) return;

      showLocalNotification(notif.title, notif.body);
      markSent(hour);
    }, actualDelay);

    activeTimers.push(timerId);
  }
}

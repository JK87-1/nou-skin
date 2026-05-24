// 클라이언트 로컬 알림 스케줄러
// 서버 크론 푸시와 병행하여, 앱이 열려있을 때 시간대별 알림을 직접 표시

const STORAGE_KEY = 'lua_weather_notif_sent';
let activeTimers = [];
let swListenerAttached = false;

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

export function scheduleWeatherNotifications(notifications) {
  clearWeatherTimers();
  attachSwListener();

  // 알림 권한 체크
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // 날씨 알림 설정 확인
  try {
    const settings = JSON.parse(localStorage.getItem('lua_push_settings') || '{}');
    if (!settings.weatherEnabled) return;
  } catch {
    return;
  }

  const now = new Date();
  const sent = getSentToday();

  // 시간 문자열 → 시간(hour) 파싱
  const parseHour = (timeStr) => {
    if (timeStr.includes('오전')) {
      const match = timeStr.match(/(\d+):(\d+)/);
      if (match) return parseInt(match[1]);
    }
    if (timeStr.includes('오후')) {
      const match = timeStr.match(/(\d+):(\d+)/);
      if (match) {
        const h = parseInt(match[1]);
        return h === 12 ? 12 : h + 12;
      }
    }
    return null;
  };

  const parseMinute = (timeStr) => {
    const match = timeStr.match(/(\d+):(\d+)/);
    return match ? parseInt(match[2]) : 0;
  };

  for (const notif of notifications) {
    const hour = parseHour(notif.time);
    if (hour === null) continue;
    const minute = parseMinute(notif.time);

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

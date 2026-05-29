// 날씨 알림 단일 소스 (Single Source of Truth)
// - 화면 "오늘 예정된 알림" 표시 (src/data/EnvironmentAlertData.js)
// - 서버 웹푸시 발송 (api/push-weather.js)
// - 네이티브 앱 로컬 알림 (src/utils/weatherNotificationScheduler.js)
// 세 경로가 모두 이 파일 하나를 참조하므로 내용이 항상 일치합니다.
//
// weather 객체 필드: temp, humidity, uv, uvLabel, airQuality, airLabel

export const WEATHER_NOTIFICATION_SCHEDULE = [
  {
    id: 'morning',
    hour: 8,
    condition: () => true,
    title: () => '오늘의 피부 날씨',
    body: (w) => `${Math.round(w.temp)}°C · 습도 ${w.humidity}% · UV ${w.uv} · ${w.airLabel}`,
  },
  {
    id: 'uv-am',
    hour: 11,
    condition: (w) => w.uv >= 3,
    title: () => '선크림 리마인더',
    body: (w) => `자외선 ${w.uvLabel}(UV ${w.uv}) — SPF50+ 선크림을 바르세요`,
  },
  {
    id: 'uv-pm',
    hour: 13,
    condition: (w) => w.uv >= 3,
    title: () => '선크림 덧바르기',
    body: () => '2시간이 지났어요. 선크림을 덧발라주세요!',
  },
  {
    id: 'mist',
    hour: 14,
    condition: (w) => w.humidity < 40,
    title: () => '수분 보충 타임',
    body: (w) => `습도 ${w.humidity}% — 미스트를 뿌리고 물 한 잔 마시세요`,
  },
  {
    id: 'cleanse',
    hour: 18,
    condition: (w) => w.airQuality > 50,
    title: () => '귀가 클렌징 알림',
    body: (w) => `미세먼지 ${w.airLabel} — 이중 세안으로 깨끗하게 씻어주세요`,
  },
  {
    id: 'night',
    hour: 21,
    condition: () => true,
    title: () => '나이트 케어 시작',
    body: (w) => w.humidity < 40
      ? '건조한 날이었어요. 수분팩 + 보습크림으로 마무리하세요'
      : '오늘도 수고했어요. 스킨케어 루틴을 시작하세요',
  },
];

// 24시간(hour) → "오전/오후 H:MM" 한국어 표기
export function formatKoreanTime(hour, minute = 0) {
  const period = hour < 12 ? '오전' : '오후';
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${period} ${h}:${String(minute).padStart(2, '0')}`;
}

// 현재 날씨 조건에 맞는 알림 목록 (화면 표시 · 네이티브 스케줄 공용)
// 반환: { id, hour, time, title, body }
export function buildScheduledNotifications(weatherData) {
  if (!weatherData) return [];
  return WEATHER_NOTIFICATION_SCHEDULE
    .filter((s) => s.condition(weatherData))
    .map((s) => ({
      id: s.id,
      hour: s.hour,
      time: formatKoreanTime(s.hour),
      title: s.title(weatherData),
      body: s.body(weatherData),
    }));
}

// ===== 날씨 × 웰니스 매칭 알림 규칙 =====

export const ALERT_RULES = [
  {
    id: 'dry_warning',
    condition: (weather, skin) => weather.humidity < 40,
    priority: (weather) => weather.humidity < 30 ? 'high' : 'medium',
    icon: '🏜️',
    color: '#f59e0b',
    title: (weather) => weather.humidity < 30 ? '극심한 건조 주의보' : '건조 주의',
    subtitle: (weather) => `습도 ${weather.humidity}%`,
    description: (weather) =>
      `오늘 습도가 ${weather.humidity}%로 ${weather.humidity < 30 ? '매우 ' : ''}낮아요. 피부 건조뿐 아니라 호흡기와 눈 건강에도 주의가 필요해요.`,
    tips: [
      { icon: '💧', text: '물을 평소보다 2잔 더 마시세요' },
      { icon: '🧴', text: '보습 크림과 립밤을 수시로 바르세요' },
      { icon: '🌿', text: '실내 가습기를 켜거나 젖은 수건을 놔두세요' },
    ],
    matchScore: (weather) =>
      Math.min(99, Math.round(100 - weather.humidity * 0.8)),
  },
  {
    id: 'dust_warning',
    condition: (weather) => weather.airQuality > 50,
    priority: (weather) => weather.airQuality > 80 ? 'high' : 'medium',
    icon: '😷',
    color: '#ef4444',
    title: (weather) => `미세먼지 ${weather.airLabel}`,
    subtitle: (weather) => `PM2.5 ${weather.ultraFineDust}㎍/m³`,
    description: (weather) =>
      `초미세먼지 농도가 높아요. 호흡기 건강과 피부 자극에 주의하고 야외 운동은 자제하세요.`,
    tips: [
      { icon: '😷', text: 'KF94 마스크를 착용하세요' },
      { icon: '🏠', text: '야외 운동 대신 실내 스트레칭을 하세요' },
      { icon: '🧼', text: '귀가 후 손·얼굴을 바로 씻으세요' },
    ],
    matchScore: (weather) =>
      Math.min(99, Math.round(weather.airQuality * 0.8)),
  },
  {
    id: 'uv_warning',
    condition: (weather) => weather.uv >= 3,
    priority: (weather) => weather.uv >= 6 ? 'high' : 'medium',
    icon: '☀️',
    color: '#89cef5',
    title: (weather) => `자외선 지수 ${weather.uvLabel}`,
    subtitle: (weather) => `UV ${weather.uv}`,
    description: (weather) =>
      `자외선 지수가 ${weather.uvLabel} 수준이에요. 피부 노화와 눈 건강을 위해 차단에 신경 쓰세요.`,
    tips: [
      { icon: '🧴', text: 'SPF50+ 선크림을 꼼꼼히 바르세요' },
      { icon: '🧢', text: '모자·선글라스로 자외선을 차단하세요' },
      { icon: '🕐', text: '오전 11시~오후 3시 야외 활동을 줄이세요' },
    ],
    matchScore: (weather) =>
      Math.min(99, Math.round(weather.uv * 10)),
  },
  {
    id: 'cold_warning',
    condition: (weather) => weather.tempMin < 0,
    priority: () => 'low',
    icon: '🥶',
    color: '#38bdf8',
    title: () => '한파 건강 관리',
    subtitle: (weather) => `최저 ${weather.tempMin}°C`,
    description: () =>
      '기온이 영하로 내려가면 혈액순환이 느려지고 면역력이 떨어질 수 있어요. 보온과 따뜻한 음식 섭취에 신경 쓰세요.',
    tips: [
      { icon: '🧣', text: '외출 시 목과 손을 따뜻하게 감싸세요' },
      { icon: '🍵', text: '따뜻한 차나 국물 음식을 챙기세요' },
      { icon: '🏃', text: '실내에서 가벼운 스트레칭으로 혈액순환을 도와주세요' },
    ],
    matchScore: (weather) =>
      Math.min(99, Math.round(Math.abs(weather.tempMin) * 6)),
  },
  {
    id: 'humid_warning',
    condition: (weather) => weather.humidity > 70,
    priority: () => 'medium',
    icon: '💦',
    color: '#aed8f7',
    title: () => '고습도 컨디션 관리',
    subtitle: (weather) => `습도 ${weather.humidity}%`,
    description: (weather) =>
      `습도가 ${weather.humidity}%로 높아요. 불쾌지수가 올라가고 피부 유분 증가, 식욕 저하가 올 수 있어요.`,
    tips: [
      { icon: '🫧', text: '가벼운 수분 젤크림으로 바꿔주세요' },
      { icon: '👟', text: '통풍이 잘 되는 옷을 입으세요' },
      { icon: '🥗', text: '가볍고 시원한 식단을 추천해요' },
    ],
    matchScore: (weather) =>
      Math.min(99, Math.round(weather.humidity * 0.6)),
  },
];

// ===== 계절별 시즌 가이드 =====

export const SEASONAL_TIPS = {
  봄: {
    icon: '🌸',
    title: '봄 웰니스 관리 포인트',
    content: '꽃가루와 미세먼지가 심한 시기예요. 알레르기와 춘곤증에 주의하세요.',
    keyPoints: [
      { icon: '😷', label: '미세먼지 대비', desc: '마스크 착용 + 귀가 후 세안' },
      { icon: '☀️', label: '자외선 증가', desc: '봄볕이 의외로 강해요! SPF 필수' },
      { icon: '🥱', label: '춘곤증 관리', desc: '가벼운 운동 + 충분한 수분 섭취' },
    ],
  },
  여름: {
    icon: '🌊',
    title: '여름 웰니스 관리 포인트',
    content: '고온다습한 환경에서 자외선 차단, 수분 보충, 식중독 예방에 신경 쓰세요.',
    keyPoints: [
      { icon: '☀️', label: '자외선 차단', desc: 'SPF50+ 선크림 수시로 덧바르기' },
      { icon: '💧', label: '수분 보충', desc: '하루 2L 이상 물 마시기' },
      { icon: '🥗', label: '식단 관리', desc: '시원하고 가벼운 식단 + 위생 주의' },
    ],
  },
  가을: {
    icon: '🍂',
    title: '가을 웰니스 관리 포인트',
    content: '급격히 건조해지는 환절기예요. 피부 보습 전환과 면역력 관리가 중요해요.',
    keyPoints: [
      { icon: '💧', label: '보습 전환', desc: '수분크림 → 영양크림으로 교체' },
      { icon: '🍊', label: '면역력 강화', desc: '비타민 C + 제철 과일 챙기기' },
      { icon: '🏃', label: '야외 운동', desc: '선선한 날씨에 산책·러닝 추천' },
    ],
  },
  겨울: {
    icon: '❄️',
    title: '겨울 웰니스 관리 포인트',
    content: '건조하고 추운 날씨에 피부·호흡기·관절 건강에 신경 쓰세요.',
    keyPoints: [
      { icon: '💧', label: '보습 강화', desc: '피부·입술·손 보습 꼼꼼하게' },
      { icon: '🍵', label: '체온 관리', desc: '따뜻한 음식 + 실내 적정 온도 유지' },
      { icon: '🏋️', label: '실내 운동', desc: '스트레칭·요가로 혈액순환 유지' },
    ],
  },
};

// ===== Helper: 현재 계절 =====
function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}

// ===== 알림 생성 =====

/**
 * 환경 데이터를 기반으로 활성 알림 생성
 * @param {object} weatherData - api/weather.js 응답
 * @param {object} skinProfile - 선택적 피부 점수
 * @returns {Array} 최대 4개의 활성 알림 (matchScore 높은 순)
 */
export function generateAlerts(weatherData, skinProfile) {
  if (!weatherData) return [];

  const active = [];
  for (const rule of ALERT_RULES) {
    try {
      if (rule.condition(weatherData, skinProfile || {})) {
        active.push({
          id: rule.id,
          icon: rule.icon,
          color: rule.color,
          priority: rule.priority(weatherData, skinProfile || {}),
          title: rule.title(weatherData, skinProfile || {}),
          subtitle: rule.subtitle(weatherData, skinProfile || {}),
          description: rule.description(weatherData, skinProfile || {}),
          tips: rule.tips,
          matchScore: rule.matchScore(weatherData, skinProfile || {}),
        });
      }
    } catch {
      // Skip rules that fail due to missing data
    }
  }

  // Sort by matchScore descending
  active.sort((a, b) => b.matchScore - a.matchScore);
  return active.slice(0, 4);
}

/**
 * 현재 계절의 시즌 가이드 반환
 */
export function getSeasonalTip() {
  const season = getCurrentSeason();
  return { season, ...SEASONAL_TIPS[season] };
}

/**
 * 오늘 환경 조건 기반 예정 알림 목록 생성
 * @param {object} weatherData - api/weather.js 응답
 * @param {object} skinProfile - 선택적
 * @returns {Array} 시간대별 알림 목록
 */
export function getScheduledNotifications(weatherData, skinProfile) {
  if (!weatherData) return [];

  const notifications = [];

  // 아침: 오늘의 날씨
  notifications.push({
    time: '오전 8:00',
    title: `오늘의 날씨 ${weatherData.conditionIcon}`,
    body: `${weatherData.temp}°C · 습도 ${weatherData.humidity}% · ${weatherData.airLabel}`,
  });

  // UV 높으면 → 선크림 리마인더
  if (weatherData.uv >= 3) {
    notifications.push({
      time: '오전 11:00',
      title: '선크림 리마인더 🧴',
      body: `자외선 ${weatherData.uvLabel}(UV ${weatherData.uv}) — SPF50+ 선크림을 바르세요`,
    });
  }

  // 건조하면 → 수분 보충
  if (weatherData.humidity < 40) {
    notifications.push({
      time: '오후 2:00',
      title: '수분 보충 타임 💧',
      body: `습도 ${weatherData.humidity}% — 물 한 잔 마시고 보습에 신경 쓰세요`,
    });
  }

  // 미세먼지 나쁨
  if (weatherData.airQuality > 50) {
    notifications.push({
      time: '오후 6:00',
      title: '귀가 후 케어 알림 🧼',
      body: `미세먼지 ${weatherData.airLabel} — 손·얼굴을 깨끗이 씻어주세요`,
    });
  }

  return notifications;
}

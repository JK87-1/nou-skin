// ===== 피부 × 환경 매칭 알림 규칙 =====

export const ALERT_RULES = [
  {
    id: 'dry_warning',
    condition: (weather, skin) => weather.humidity < 40 && skin.moisture < 70,
    priority: (weather) => weather.humidity < 30 ? 'high' : 'medium',
    icon: '🏜️',
    color: '#f59e0b',
    title: (weather) => weather.humidity < 30 ? '극심한 건조 주의보' : '건조 주의',
    subtitle: (weather, skin) => `습도 ${weather.humidity}% · 수분 점수 ${skin.moisture}점`,
    description: (weather, skin) =>
      `오늘 습도가 ${weather.humidity}%로 ${weather.humidity < 30 ? '매우 ' : ''}낮아요. 수분 점수가 ${skin.moisture}점인 당신의 피부는 특히 건조 영향을 크게 받아요.`,
    tips: [
      { icon: '💧', text: '미스트를 2시간마다 뿌려주세요' },
      { icon: '🧴', text: '크림을 평소보다 한 겹 더 바르세요' },
      { icon: '🥤', text: '물을 평소보다 2잔 더 마시세요' },
    ],
    matchScore: (weather, skin) =>
      Math.min(99, Math.round(100 - (weather.humidity * 0.3 + skin.moisture * 0.3))),
  },
  {
    id: 'dust_warning',
    condition: (weather) => weather.airQuality > 50,
    priority: (weather) => weather.airQuality > 80 ? 'high' : 'medium',
    icon: '😷',
    color: '#ef4444',
    title: (weather) => `미세먼지 ${weather.airLabel}`,
    subtitle: (weather, skin) => `PM2.5 ${weather.ultraFineDust}㎍/m³ · 민감도 ${skin.sensitivity}점`,
    description: (weather, skin) =>
      `초미세먼지 농도가 높아요. 민감도가 ${skin.sensitivity}점인 피부는 외부 자극에 취약한 상태예요.`,
    tips: [
      { icon: '🛡', text: '외출 전 보호막 크림을 발라주세요' },
      { icon: '🧼', text: '귀가 후 즉시 이중 세안하세요' },
      { icon: '🚫', text: '가능하면 야외 활동을 줄이세요' },
    ],
    matchScore: (weather, skin) =>
      Math.min(99, Math.round(weather.airQuality * 0.5 + (100 - skin.sensitivity) * 0.3)),
  },
  {
    id: 'uv_warning',
    condition: (weather) => weather.uv >= 3,
    priority: (weather) => weather.uv >= 6 ? 'high' : 'medium',
    icon: '☀️',
    color: '#a78bfa',
    title: (weather) => `자외선 지수 ${weather.uvLabel}`,
    subtitle: (weather, skin) => `UV ${weather.uv} · 색소 점수 ${skin.pigment}점`,
    description: (weather, skin) =>
      `자외선 지수가 ${weather.uvLabel} 수준이에요. 색소 점수가 ${skin.pigment}점이라 기미·잡티가 생기기 쉬운 상태예요.`,
    tips: [
      { icon: '🧴', text: 'SPF50+ 선크림을 꼼꼼히 바르세요' },
      { icon: '⏰', text: '2시간마다 덧바르세요' },
      { icon: '🧢', text: '모자나 양산을 쓰세요' },
    ],
    matchScore: (weather, skin) =>
      Math.min(99, Math.round(weather.uv * 8 + (100 - skin.pigment) * 0.4)),
  },
  {
    id: 'cold_warning',
    condition: (weather) => weather.tempMin < 0,
    priority: () => 'low',
    icon: '🥶',
    color: '#38bdf8',
    title: () => '한파 피부 관리',
    subtitle: (weather, skin) => `최저 ${weather.tempMin}°C · 탄력 점수 ${skin.elasticity}점`,
    description: () =>
      '기온이 영하로 내려가면 혈액순환이 느려져 피부 탄력이 떨어질 수 있어요.',
    tips: [
      { icon: '🧣', text: '외출 시 얼굴을 따뜻하게 감싸세요' },
      { icon: '💆', text: '저녁에 5분 페이스 마사지를 해보세요' },
    ],
    matchScore: (weather, skin) =>
      Math.min(99, Math.round(Math.abs(weather.tempMin) * 5 + (100 - skin.elasticity) * 0.3)),
  },
  {
    id: 'humid_warning',
    condition: (weather, skin) => weather.humidity > 70 && skin.oil > 60,
    priority: () => 'medium',
    icon: '💦',
    color: '#818cf8',
    title: () => '고습도 유분 관리',
    subtitle: (weather, skin) => `습도 ${weather.humidity}% · 유분 점수 ${skin.oil}점`,
    description: (weather, skin) =>
      `습도가 ${weather.humidity}%로 높아요. 유분이 많은 피부는 모공이 막히기 쉬워요.`,
    tips: [
      { icon: '🫧', text: '가벼운 수분 젤크림으로 바꿔주세요' },
      { icon: '📃', text: '유분 흡수 패드를 수시로 사용하세요' },
    ],
    matchScore: (weather, skin) =>
      Math.min(99, Math.round(weather.humidity * 0.4 + skin.oil * 0.4)),
  },
];

// ===== 계절별 시즌 가이드 =====

export const SEASONAL_TIPS = {
  봄: {
    icon: '🌸',
    title: '봄 피부 핵심 관리 포인트',
    content: '꽃가루와 미세먼지가 심한 시기예요. 알레르기 반응으로 피부가 민감해지기 쉬워요.',
    keyPoints: [
      { icon: '🛡', label: '장벽 강화', desc: '민감해진 장벽 회복에 집중' },
      { icon: '😷', label: '미세먼지 대비', desc: '이중 세안 + 보호막 크림' },
      { icon: '☀️', label: '자외선 증가', desc: '봄볕이 더 강해요! SPF 필수' },
    ],
  },
  여름: {
    icon: '🌊',
    title: '여름 피부 핵심 관리 포인트',
    content: '고온다습한 환경에서 유분 과다와 자외선 손상에 주의하세요.',
    keyPoints: [
      { icon: '☀️', label: '자외선 차단', desc: 'SPF50+ 수시로 덧바르기' },
      { icon: '🫧', label: '유분 관리', desc: '가벼운 수분 젤크림으로 전환' },
      { icon: '🧊', label: '진정 케어', desc: '자외선 후 진정팩 필수' },
    ],
  },
  가을: {
    icon: '🍂',
    title: '가을 피부 핵심 관리 포인트',
    content: '급격히 건조해지는 환절기예요. 여름 자외선 손상 회복과 보습 전환이 중요해요.',
    keyPoints: [
      { icon: '💧', label: '보습 전환', desc: '수분크림 → 영양크림으로 교체' },
      { icon: '✨', label: '색소 케어', desc: '여름 손상 회복 미백 케어' },
      { icon: '🧴', label: '각질 관리', desc: '주 1회 부드러운 각질 제거' },
    ],
  },
  겨울: {
    icon: '❄️',
    title: '겨울 피부 핵심 관리 포인트',
    content: '겨울은 피부가 가장 건조해지는 시기예요. 실내외 온도차로 민감도가 높아져요.',
    keyPoints: [
      { icon: '💧', label: '보습 강화', desc: '세럼 → 크림 → 오일 레이어링' },
      { icon: '🛡', label: '장벽 복구', desc: '세라마이드 + 판테놀 제품 사용' },
      { icon: '☀️', label: '자외선 차단', desc: '겨울에도 UV는 존재! SPF 필수' },
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
 * 환경 데이터 + 피부 점수를 기반으로 활성 알림 생성
 * @param {object} weatherData - api/weather.js 응답
 * @param {object} skinProfile - { moisture, oil, sensitivity, pigment, elasticity, ... }
 * @returns {Array} 최대 4개의 활성 알림 (matchScore 높은 순)
 */
export function generateAlerts(weatherData, skinProfile) {
  if (!weatherData || !skinProfile) return [];

  const active = [];
  for (const rule of ALERT_RULES) {
    try {
      if (rule.condition(weatherData, skinProfile)) {
        active.push({
          id: rule.id,
          icon: rule.icon,
          color: rule.color,
          priority: rule.priority(weatherData, skinProfile),
          title: rule.title(weatherData, skinProfile),
          subtitle: rule.subtitle(weatherData, skinProfile),
          description: rule.description(weatherData, skinProfile),
          tips: rule.tips,
          matchScore: rule.matchScore(weatherData, skinProfile),
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
 * @param {object} skinProfile - 피부 점수
 * @returns {Array} 시간대별 알림 목록
 */
export function getScheduledNotifications(weatherData, skinProfile) {
  if (!weatherData) return [];

  const notifications = [];

  // 아침: 오늘의 피부 날씨
  notifications.push({
    time: '오전 8:00',
    title: `오늘의 피부 날씨 ${weatherData.conditionIcon}`,
    body: `${weatherData.temp}°C · 습도 ${weatherData.humidity}% · ${weatherData.airLabel}`,
  });

  // UV 높으면 → 선크림 리마인더
  if (weatherData.uv >= 3) {
    notifications.push({
      time: '오전 11:00',
      title: '선크림 리마인더 🧴',
      body: `자외선 ${weatherData.uvLabel}(UV ${weatherData.uv}) — SPF50+ 선크림을 바르세요`,
    });
    notifications.push({
      time: '오후 1:00',
      title: '선크림 덧바르기 ⏰',
      body: '2시간이 지났어요. 선크림을 덧발라주세요!',
    });
  }

  // 건조하면 → 미스트 리마인더
  if (weatherData.humidity < 40) {
    notifications.push({
      time: '오후 2:00',
      title: '수분 보충 타임 💧',
      body: `습도 ${weatherData.humidity}% — 미스트를 뿌리고 물 한 잔 마시세요`,
    });
  }

  // 미세먼지 나쁨 → 세안 알림
  if (weatherData.airQuality > 50) {
    notifications.push({
      time: '오후 6:00',
      title: '귀가 클렌징 알림 🧼',
      body: `미세먼지 ${weatherData.airLabel} — 이중 세안으로 깨끗하게 씻어주세요`,
    });
  }

  // 저녁 스킨케어
  notifications.push({
    time: '오후 9:00',
    title: '나이트 케어 시작 🌙',
    body: weatherData.humidity < 40
      ? '건조한 날이었어요. 수분팩 + 보습크림으로 마무리하세요'
      : '오늘도 수고했어요. 스킨케어 루틴을 시작하세요',
  });

  return notifications;
}

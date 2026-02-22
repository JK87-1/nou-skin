/**
 * NOU Personalized Beauty Tips Engine
 *
 * 피부 분석 결과 기반 맞춤형 뷰티팁 생성
 * - 메트릭별 전문 팁 DB (각 메트릭 당 3~4개)
 * - 피부타입별 일반 팁
 * - 계절/시간대별 팁
 * - 최신 측정 결과로 우선순위 정렬
 */

// ═══════════════════════════════════════════
// 메트릭별 맞춤 팁 (threshold 미달 시 활성화)
// ═══════════════════════════════════════════

const METRIC_TIPS = {
  moisture: {
    threshold: 60,
    label: '수분 관리',
    tips: [
      {
        icon: '💧',
        title: '세라마이드로 수분 장벽 강화',
        desc: '세라마이드는 피부 장벽의 50%를 구성합니다. 세안 후 세라마이드 함유 보습제를 3분 내 도포하면 경피수분손실(TEWL)을 42% 줄일 수 있어요.',
        priority: 10,
      },
      {
        icon: '🫗',
        title: '하루 1.5L 이상 수분 섭취',
        desc: '체내 수분이 2%만 부족해도 피부 수분도가 급격히 떨어집니다. 카페인 음료 대신 미지근한 물을 조금씩 자주 마시는 것이 효과적이에요.',
        priority: 8,
      },
      {
        icon: '🧴',
        title: '히알루론산 세럼 + 수분크림 레이어링',
        desc: '히알루론산은 자기 무게의 1000배 수분을 끌어안습니다. 젖은 피부에 히알루론산 세럼을 바르고, 반드시 위에 크림으로 밀봉하세요.',
        priority: 9,
      },
      {
        icon: '🌬️',
        title: '실내 습도 40~60% 유지',
        desc: '겨울철 난방으로 실내 습도가 20%대로 떨어지면 피부 수분 증발이 3배 가속됩니다. 가습기 사용이 어려우면 젖은 수건을 걸어두세요.',
        priority: 6,
      },
    ],
  },

  skinTone: {
    threshold: 65,
    label: '피부톤 개선',
    tips: [
      {
        icon: '🍋',
        title: '비타민C 세럼으로 브라이트닝',
        desc: '비타민C(아스코르빅산 15~20%)는 멜라닌 생성을 억제하고 기존 색소침착을 개선합니다. 아침 세럼으로 사용하고 반드시 선크림을 덧바르세요.',
        priority: 10,
      },
      {
        icon: '✨',
        title: '나이아신아마이드로 톤 균일화',
        desc: '나이아신아마이드(비타민B3) 5%는 4주 사용 시 멜라닌 전달을 68% 억제합니다. 자극이 적어 민감 피부도 안전하게 사용 가능해요.',
        priority: 9,
      },
      {
        icon: '☀️',
        title: '자외선 차단 = 최고의 미백',
        desc: '아무리 좋은 미백 성분도 자외선 차단 없이는 무의미합니다. SPF50+ PA++++ 선크림을 2시간마다 덧바르면 색소침착 재발을 85% 예방해요.',
        priority: 8,
      },
    ],
  },

  trouble: {
    threshold: 60, // troubleScore = 100 - troubleCount * 8.5
    label: '트러블 관리',
    tips: [
      {
        icon: '🌿',
        title: '시카(병풀) 성분으로 진정',
        desc: '마데카소사이드는 콜라겐 합성을 촉진하고 염증을 억제합니다. 트러블 부위에 시카 젤을 스팟 도포하면 3~5일 내 붉은기가 감소해요.',
        priority: 10,
      },
      {
        icon: '🧼',
        title: 'pH 5.5 약산성 클렌저 사용',
        desc: '알칼리성 세안제는 피부 장벽을 파괴하고 세균 증식을 촉진합니다. 약산성(pH 5.5) 클렌저로 전환하면 2주 내 트러블이 30% 감소할 수 있어요.',
        priority: 9,
      },
      {
        icon: '🍦',
        title: '유제품·고당 식품 줄이기',
        desc: '유제품의 IGF-1과 고당 식품은 피지 분비를 촉진합니다. 3주간 유제품을 줄이면 여드름이 44% 감소했다는 연구 결과가 있어요.',
        priority: 7,
      },
      {
        icon: '🫧',
        title: 'BHA(살리실산) 스팟 케어',
        desc: 'BHA는 모공 속 피지를 녹여 블랙헤드와 여드름을 예방합니다. 0.5~2% 살리실산 제품을 트러블 부위에만 야간 도포하세요.',
        priority: 8,
      },
    ],
  },

  oilBalanceHigh: {
    threshold: 65, // oilBalance > 65
    label: '유분 조절',
    tips: [
      {
        icon: '💦',
        title: '수분 공급이 유분 조절의 핵심',
        desc: '피부가 건조하면 보상 작용으로 피지가 과다 분비됩니다. 유분 없는 수분 세럼으로 충분히 보습하면 피지 분비가 자연스럽게 줄어요.',
        priority: 10,
      },
      {
        icon: '🧊',
        title: '나이아신아마이드로 피지 조절',
        desc: '나이아신아마이드 5%는 4주 사용 시 피지 분비를 최대 45% 감소시킵니다. 아침저녁 기초 케어에 포함시키면 효과적이에요.',
        priority: 9,
      },
      {
        icon: '🪞',
        title: '기름종이 대신 미스트',
        desc: '기름종이는 일시적이며 피부를 자극합니다. 그린티 미스트로 유분을 가볍게 닦아내면 피부 장벽 유지 + 유분 조절이 동시에 가능해요.',
        priority: 6,
      },
    ],
  },

  oilBalanceLow: {
    threshold: 35, // oilBalance < 35
    label: '유분 보충',
    tips: [
      {
        icon: '🫒',
        title: '스쿠알란 오일로 유분 보충',
        desc: '스쿠알란은 피부 자체 유분 성분과 유사하여 자극 없이 흡수됩니다. 보습크림 마지막 단계에 2~3방울 섞어 바르면 건조함이 크게 개선돼요.',
        priority: 10,
      },
      {
        icon: '🧈',
        title: '시어버터 함유 크림 사용',
        desc: '시어버터는 올레산과 스테아르산이 풍부해 피부 장벽을 강화합니다. 밤 루틴 마지막에 리치 텍스처 크림으로 마무리하세요.',
        priority: 8,
      },
      {
        icon: '🚿',
        title: '뜨거운 물 세안 금지',
        desc: '40도 이상의 뜨거운 물은 피부의 천연 유분을 벗겨냅니다. 32~34도 미지근한 물로 세안하면 유분 손실을 최소화할 수 있어요.',
        priority: 7,
      },
    ],
  },

  wrinkles: {
    threshold: 60,
    label: '주름 관리',
    tips: [
      {
        icon: '🌙',
        title: '레티놀은 주름 관리의 금본위',
        desc: '레티놀(비타민A)은 콜라겐 합성을 촉진하고 잔주름을 개선합니다. 0.025%부터 시작해 야간에만 사용하고, 반드시 선크림과 병행하세요.',
        priority: 10,
      },
      {
        icon: '💎',
        title: '펩타이드 세럼으로 콜라겐 부스팅',
        desc: '매트릭실, 아르지릴린 등의 펩타이드는 콜라겐 합성 신호를 보냅니다. 12주 사용 시 주름 깊이가 평균 27% 감소합니다.',
        priority: 9,
      },
      {
        icon: '😴',
        title: '수면 자세가 주름을 만든다',
        desc: '옆으로 자면 베개에 눌린 쪽 볼과 눈가에 수면 주름이 생깁니다. 실크 베개커버 사용 + 똑바로 자는 습관이 효과적이에요.',
        priority: 6,
      },
    ],
  },

  pores: {
    threshold: 60,
    label: '모공 관리',
    tips: [
      {
        icon: '🧪',
        title: 'AHA/BHA 주 1~2회 각질 관리',
        desc: 'AHA(글리콜산)는 피부 표면, BHA(살리실산)는 모공 내부를 정리합니다. 주 1~2회 야간 사용으로 모공 막힘을 예방하세요.',
        priority: 10,
      },
      {
        icon: '🏔️',
        title: '클레이 마스크로 주 1회 딥클렌징',
        desc: '카올린/벤토나이트 클레이는 모공 속 피지와 노폐물을 흡착합니다. 10분 후 미지근한 물로 씻어내면 모공이 눈에 띄게 깨끗해져요.',
        priority: 8,
      },
      {
        icon: '❄️',
        title: '냉수 세안으로 마무리',
        desc: '온수 클렌징 후 찬물로 마무리하면 모공이 일시적으로 수축합니다. 매일 실천하면 모공이 늘어나는 것을 예방하는 데 도움이 돼요.',
        priority: 5,
      },
    ],
  },

  elasticity: {
    threshold: 60,
    label: '탄력 강화',
    tips: [
      {
        icon: '💪',
        title: '콜라겐 부스터: 비타민C + 레티놀',
        desc: '비타민C는 콜라겐 합성의 필수 보조인자이고, 레티놀은 합성 신호를 촉진합니다. 아침 비타민C + 저녁 레티놀 조합이 최적이에요.',
        priority: 10,
      },
      {
        icon: '🏃',
        title: '유산소 운동이 피부 탄력을 높인다',
        desc: '주 3회 이상 유산소 운동은 혈류를 촉진하고 콜라겐 합성을 25% 증가시킵니다. 운동 후 세안 + 보습을 잊지 마세요.',
        priority: 8,
      },
      {
        icon: '🥚',
        title: '단백질 섭취로 콜라겐 원료 보충',
        desc: '콜라겐은 단백질입니다. 매끼 양질의 단백질(계란, 생선, 두부)을 섭취하면 피부 탄력 유지에 직접적으로 도움이 돼요.',
        priority: 7,
      },
    ],
  },

  pigmentation: {
    threshold: 60,
    label: '색소 관리',
    tips: [
      {
        icon: '🧴',
        title: '트라넥삼산으로 기미·색소침착 관리',
        desc: '트라넥삼산은 멜라닌 생성 경로를 차단하여 기미를 개선합니다. 비타민C와 병행하면 미백 시너지 효과가 배가돼요.',
        priority: 10,
      },
      {
        icon: '🌂',
        title: '물리적 자외선 차단 강화',
        desc: '색소침착이 있는 피부는 자외선에 더 민감합니다. 선크림 + 모자/양산을 병행하면 색소 재발률을 90% 이상 줄일 수 있어요.',
        priority: 9,
      },
      {
        icon: '🫐',
        title: '항산화 식품으로 내부 방어',
        desc: '블루베리, 토마토, 녹차에 풍부한 항산화제는 자외선으로 인한 멜라닌 과생성을 억제합니다. 매일 컬러풀한 과일을 섭취하세요.',
        priority: 6,
      },
    ],
  },

  texture: {
    threshold: 60,
    label: '피부결 개선',
    tips: [
      {
        icon: '✨',
        title: 'AHA 토너로 부드러운 각질 관리',
        desc: '5% 글리콜산 토너를 격일 야간 사용하면 묵은 각질이 자연스럽게 탈락됩니다. 4주 후 피부결이 눈에 띄게 매끄러워져요.',
        priority: 10,
      },
      {
        icon: '🧖',
        title: '효소 클렌저로 부드러운 각질 제거',
        desc: '파파인·브로멜라인 효소 클렌저는 물리적 스크럽보다 자극이 적으면서 각질을 효과적으로 분해합니다. 민감 피부에도 안전해요.',
        priority: 8,
      },
      {
        icon: '💤',
        title: '수면 중 세포 교체를 도와주세요',
        desc: '밤 10시~새벽 2시에 성장 호르몬이 최고조로 분비되어 피부 세포가 가장 활발히 교체됩니다. 충분한 수면이 가장 좋은 피부결 관리예요.',
        priority: 7,
      },
    ],
  },

  darkCircles: {
    threshold: 60,
    label: '다크서클 관리',
    tips: [
      {
        icon: '☕',
        title: '카페인 아이크림으로 혈류 개선',
        desc: '카페인은 눈 밑 모세혈관을 수축시켜 다크서클을 완화합니다. 냉장 보관 후 아침에 톡톡 두드려 바르면 효과가 배가돼요.',
        priority: 10,
      },
      {
        icon: '🥄',
        title: '냉찜질로 즉각 개선',
        desc: '차가운 숟가락이나 아이마스크를 5분간 눈 밑에 대면 부기와 다크서클이 즉시 개선됩니다. 아침 스킨케어 전 습관으로 만드세요.',
        priority: 7,
      },
      {
        icon: '😴',
        title: '베개 높이를 조절하세요',
        desc: '베개가 너무 낮으면 눈 밑에 체액이 고여 부기가 생깁니다. 베개를 약간 높이면 중력에 의해 체액 순환이 개선돼요.',
        priority: 6,
      },
      {
        icon: '🫐',
        title: '비타민K + 레티놀 아이크림',
        desc: '비타민K는 혈관 강화, 레티놀은 눈가 콜라겐 합성을 돕습니다. 0.025% 레티놀 아이크림을 야간에 사용하면 4주 후 눈가가 밝아져요.',
        priority: 8,
      },
    ],
  },
};

// ═══════════════════════════════════════════
// 피부타입별 일반 팁
// ═══════════════════════════════════════════

const SKIN_TYPE_TIPS = {
  oily: [
    { icon: '🧊', title: '지성 피부를 위한 가벼운 보습', desc: '오일프리 수분 젤이나 하이드레이팅 토너로 보습하세요. 무거운 크림은 모공을 막고 피지를 더 유발합니다.', priority: 7 },
    { icon: '🪞', title: '이중 세안의 중요성', desc: '저녁엔 오일 클렌저 → 수성 클렌저 순으로 이중 세안하세요. 선크림과 피지를 확실히 제거해야 모공 트러블을 예방할 수 있어요.', priority: 6 },
  ],
  dry: [
    { icon: '🫒', title: '건성 피부는 오일 레이어링이 핵심', desc: '토너 → 세럼 → 크림 → 오일 순으로 레이어링하면 수분 증발을 최소화합니다. 마지막 오일이 밀봉 역할을 해요.', priority: 7 },
    { icon: '🚿', title: '세안은 하루 1회 + 미지근한 물', desc: '건성 피부는 과도한 세안이 적입니다. 아침엔 물만으로 가볍게, 저녁엔 순한 클렌저로 1회만 세안하세요.', priority: 6 },
  ],
  combination: [
    { icon: '🎯', title: '존별 차별 케어가 핵심', desc: 'T존(이마·코)에는 가벼운 수분 젤, U존(볼·턱)에는 리치한 크림을 발라주세요. 같은 제품을 전체에 바르면 효과가 반감돼요.', priority: 7 },
    { icon: '⚖️', title: '유수분 밸런스 맞추기', desc: '수분을 충분히 공급하면 T존의 과다 피지가 자연스럽게 줄어듭니다. 히알루론산 세럼을 전체에 먼저 도포한 후 존별 크림을 사용하세요.', priority: 6 },
  ],
  sensitive: [
    { icon: '🌿', title: '자극 성분 피하기', desc: '알코올, 향료, 에센셜오일이 포함된 제품은 피하세요. 성분이 단순하고 시카·판테놀 기반인 제품이 민감 피부에 안전해요.', priority: 8 },
    { icon: '🛡️', title: '피부 장벽 회복이 최우선', desc: '세라마이드 + 콜레스테롤 + 지방산 3:1:1 비율의 보습제가 피부 장벽 회복에 최적입니다. 새 제품은 반드시 팔 안쪽에 테스트 후 사용하세요.', priority: 9 },
  ],
  normal: [
    { icon: '🌟', title: '좋은 피부 상태를 유지하세요', desc: '기본 루틴(클렌저 → 토너 → 보습 → 선크림)을 꾸준히 유지하면 충분해요. 불필요하게 제품을 많이 쓰는 것보다 꾸준함이 핵심이에요.', priority: 5 },
    { icon: '🔬', title: '예방적 안티에이징 시작', desc: '피부가 좋을 때 시작하는 게 가장 효율적입니다. 비타민C 세럼(아침)과 레티놀(저녁)로 예방적 안티에이징을 시작해보세요.', priority: 6 },
  ],
};

// ═══════════════════════════════════════════
// 항상 표시되는 기본 웰니스 팁 (맨 아래)
// ═══════════════════════════════════════════

const GENERAL_TIPS = [
  { icon: '☀️', title: '자외선 차단이 최고의 안티에이징', desc: '피부 노화의 80%는 자외선이 원인입니다. 실내에서도 SPF50+ 선크림을 매일 바르세요.', priority: 3 },
  { icon: '🌙', title: '밤 10시~새벽 2시는 피부 골든타임', desc: '성장 호르몬 분비가 최고조에 달하는 시간. 이 시간에 수면하면 세포 재생 효율이 2배 증가합니다.', priority: 2 },
  { icon: '🥗', title: '장 건강이 곧 피부 건강', desc: '프로바이오틱스 4주 섭취 후 수분도 21%↑, 여드름 47%↓가 보고되었습니다. 장-뇌-피부 축은 실재합니다.', priority: 1 },
];

// ═══════════════════════════════════════════
// 메인 함수: generatePersonalizedTips
// ═══════════════════════════════════════════

/**
 * 최신 피부 분석 결과에 기반한 맞춤형 팁 생성
 * @param {Object|null} record - getLatestRecord() 반환값
 * @returns {{ personalTips, skinTypeTips, generalTips, concerns, skinType }}
 */
export function generatePersonalizedTips(record) {
  if (!record) {
    return {
      personalTips: [],
      skinTypeTips: [],
      generalTips: GENERAL_TIPS,
      concerns: [],
      skinType: null,
    };
  }

  // 1. 각 메트릭 점수 계산
  const scoreMap = {
    moisture: record.moisture ?? 50,
    skinTone: record.skinTone ?? 50,
    trouble: Math.max(0, 100 - (record.troubleCount ?? 0) * 8.5),
    wrinkles: record.wrinkleScore ?? 50,
    pores: record.poreScore ?? 50,
    elasticity: record.elasticityScore ?? 50,
    pigmentation: record.pigmentationScore ?? 50,
    texture: record.textureScore ?? 50,
    darkCircles: record.darkCircleScore ?? 50,
  };

  // oilBalance 특수 처리
  const oilBalance = record.oilBalance ?? 50;

  // 2. threshold 미달 메트릭에서 팁 수집
  const personalTips = [];
  const concerns = [];

  const metricLabels = {
    moisture: '수분도', skinTone: '피부톤', trouble: '트러블',
    wrinkles: '주름', pores: '모공', elasticity: '탄력',
    pigmentation: '색소침착', texture: '피부결', darkCircles: '다크서클',
  };

  for (const [key, score] of Object.entries(scoreMap)) {
    const config = METRIC_TIPS[key];
    if (config && score < config.threshold) {
      concerns.push({ key, label: metricLabels[key], score });
      config.tips.forEach(tip => {
        personalTips.push({ ...tip, concern: config.label, metricKey: key, score });
      });
    }
  }

  // oilBalance 분기 처리
  if (oilBalance > 65 && METRIC_TIPS.oilBalanceHigh) {
    concerns.push({ key: 'oilBalance', label: '유분 과다', score: oilBalance });
    METRIC_TIPS.oilBalanceHigh.tips.forEach(tip => {
      personalTips.push({ ...tip, concern: '유분 조절', metricKey: 'oilBalance', score: oilBalance });
    });
  } else if (oilBalance < 35 && METRIC_TIPS.oilBalanceLow) {
    concerns.push({ key: 'oilBalance', label: '유분 부족', score: oilBalance });
    METRIC_TIPS.oilBalanceLow.tips.forEach(tip => {
      personalTips.push({ ...tip, concern: '유분 보충', metricKey: 'oilBalance', score: oilBalance });
    });
  }

  // 3. 점수 오름차순 (가장 약한 지표 우선) → priority 내림차순
  concerns.sort((a, b) => a.score - b.score);
  personalTips.sort((a, b) => {
    const aIdx = concerns.findIndex(c => c.key === a.metricKey);
    const bIdx = concerns.findIndex(c => c.key === b.metricKey);
    if (aIdx !== bIdx) return aIdx - bIdx; // 약한 메트릭의 팁 우선
    return b.priority - a.priority;
  });

  // 최대 8개로 제한 (너무 많으면 압도됨)
  const limitedPersonal = personalTips.slice(0, 8);

  // 4. 피부타입별 팁
  const skinType = determineSkinTypeFromRecord(record);
  const skinTypeTips = SKIN_TYPE_TIPS[skinType] || SKIN_TYPE_TIPS.normal;

  return {
    personalTips: limitedPersonal,
    skinTypeTips,
    generalTips: GENERAL_TIPS,
    concerns: concerns.slice(0, 4),
    skinType,
  };
}

/**
 * 레코드에서 피부타입 추론
 */
function determineSkinTypeFromRecord(record) {
  const oil = record.oilBalance ?? 50;
  const moisture = record.moisture ?? 50;
  const trouble = record.troubleCount ?? 0;

  if (oil > 65 && moisture < 45) return 'combination';
  if (oil > 65) return 'oily';
  if (oil < 35 && moisture < 45) return 'dry';
  if (oil < 35) return 'dry';
  if (trouble > 8) return 'sensitive';
  return 'normal';
}

/**
 * TreatmentData.js — 한국 인기 피부 시술 DB + 맞춤 추천 알고리즘
 *
 * 측정 점수 기반으로 사용자에게 적합한 피부과 시술을 추천.
 * 의료 행위가 아닌 정보 제공 목적.
 */

export const TREATMENT_CATEGORIES = {
  lifting:       { icon: '🏋️', label: '리프팅/탄력', color: '#F06292' },
  pigmentation:  { icon: '✨', label: '색소/미백',   color: '#A1887F' },
  texture:       { icon: '🧴', label: '피부결/모공', color: '#4DB6AC' },
  wrinkle:       { icon: '💉', label: '주름/볼륨',   color: '#9575CD' },
  acne:          { icon: '🎯', label: '트러블',      color: '#FF8A65' },
  rejuvenation:  { icon: '💧', label: '재생/광채',   color: '#4FC3F7' },
};

export const TREATMENTS = [
  // ── Lifting/Tightening ──
  {
    id: 'ultherapy', name: '울쎄라', nameEn: 'Ultherapy', category: 'lifting',
    mechanism: '고강도 집속초음파(HIFU)로 SMAS층까지 열 전달, 콜라겐 재생 유도',
    icon: '🔥',
    triggers: [
      { metric: 'elasticityScore', threshold: 50, operator: '<' },
      { metric: 'wrinkleScore', threshold: 50, operator: '<' },
    ],
    priorityWeight: 0.9,
    costRange: '50~200만원', downtime: '1~3일', frequency: '6~12개월',
  },
  {
    id: 'shurink', name: '슈링크', nameEn: 'Shurink', category: 'lifting',
    mechanism: '마이크로·매크로 집속초음파로 피부 탄력 개선',
    icon: '🔥',
    triggers: [
      { metric: 'elasticityScore', threshold: 58, operator: '<' },
    ],
    priorityWeight: 0.85,
    costRange: '20~60만원', downtime: '거의 없음', frequency: '3~6개월',
  },
  {
    id: 'thermage', name: '써마지', nameEn: 'Thermage', category: 'lifting',
    mechanism: '모노폴라 RF로 전 피부층 타이트닝 및 콜라겐 리모델링',
    icon: '🔥',
    triggers: [
      { metric: 'elasticityScore', threshold: 52, operator: '<' },
      { metric: 'wrinkleScore', threshold: 55, operator: '<' },
    ],
    priorityWeight: 0.88,
    costRange: '80~250만원', downtime: '없음', frequency: '12~18개월',
  },
  {
    id: 'inmode', name: '인모드', nameEn: 'InMode', category: 'lifting',
    mechanism: '바이폴라 RF + 광에너지로 피부 탄력·윤곽 개선',
    icon: '⚡',
    triggers: [
      { metric: 'elasticityScore', threshold: 58, operator: '<' },
      { metric: 'wrinkleScore', threshold: 60, operator: '<' },
    ],
    priorityWeight: 0.75,
    costRange: '30~80만원', downtime: '없음', frequency: '4~6주 간격 3~5회',
  },

  // ── Pigmentation ──
  {
    id: 'laser-toning', name: '레이저토닝', nameEn: 'Laser Toning', category: 'pigmentation',
    mechanism: '저출력 Q-switched Nd:YAG 레이저로 멜라닌 분해',
    icon: '✨',
    triggers: [
      { metric: 'pigmentationScore', threshold: 55, operator: '<' },
      { metric: 'skinTone', threshold: 58, operator: '<' },
    ],
    priorityWeight: 0.8,
    costRange: '5~15만원/회', downtime: '없음', frequency: '1~2주 간격 10회+',
  },
  {
    id: 'pico-toning', name: '피코토닝', nameEn: 'Pico Toning', category: 'pigmentation',
    mechanism: '피코초 레이저로 깊은 색소까지 미세 분해',
    icon: '✨',
    triggers: [
      { metric: 'pigmentationScore', threshold: 50, operator: '<' },
    ],
    priorityWeight: 0.85,
    costRange: '8~20만원/회', downtime: '거의 없음', frequency: '2~4주 간격 5~10회',
  },
  {
    id: 'ipl', name: 'IPL', nameEn: 'IPL', category: 'pigmentation',
    mechanism: '광선치료로 잡티·홍조·혈관 확장 동시 개선',
    icon: '💡',
    triggers: [
      { metric: 'pigmentationScore', threshold: 58, operator: '<' },
      { metric: 'skinTone', threshold: 55, operator: '<' },
    ],
    priorityWeight: 0.7,
    costRange: '5~15만원/회', downtime: '1~3일', frequency: '3~4주 간격 5회',
  },

  // ── Texture/Pores ──
  {
    id: 'fraxel', name: '프락셀', nameEn: 'Fraxel', category: 'texture',
    mechanism: '프랙셔널 레이저로 피부 리서페이싱 및 콜라겐 재생',
    icon: '🔬',
    triggers: [
      { metric: 'textureScore', threshold: 50, operator: '<' },
      { metric: 'poreScore', threshold: 50, operator: '<' },
    ],
    priorityWeight: 0.85,
    costRange: '20~50만원', downtime: '3~7일', frequency: '4~8주 간격 3~5회',
  },
  {
    id: 'co2-fractional', name: 'CO2 프랙셔널', nameEn: 'CO2 Fractional', category: 'texture',
    mechanism: '절삭형 CO2 레이저로 흉터·모공·피부결 집중 개선',
    icon: '🔬',
    triggers: [
      { metric: 'textureScore', threshold: 45, operator: '<' },
      { metric: 'poreScore', threshold: 45, operator: '<' },
    ],
    priorityWeight: 0.8,
    costRange: '15~40만원', downtime: '5~10일', frequency: '4~8주 간격 3회',
  },
  {
    id: 'mts', name: 'MTS', nameEn: 'Microneedling', category: 'texture',
    mechanism: '미세침으로 콜라겐 생성 유도, 모공·피부결 개선',
    icon: '📌',
    triggers: [
      { metric: 'textureScore', threshold: 58, operator: '<' },
      { metric: 'poreScore', threshold: 55, operator: '<' },
    ],
    priorityWeight: 0.7,
    costRange: '5~15만원', downtime: '1~3일', frequency: '4주 간격 3~5회',
  },
  {
    id: 'aquapeel', name: '아쿠아필', nameEn: 'Hydrafacial', category: 'texture',
    mechanism: '수소수 필링 + 세럼 주입으로 모공 세정 및 보습',
    icon: '🫧',
    triggers: [
      { metric: 'poreScore', threshold: 58, operator: '<' },
      { metric: 'moisture', threshold: 55, operator: '<' },
    ],
    priorityWeight: 0.65,
    costRange: '5~15만원', downtime: '없음', frequency: '2~4주 간격',
  },

  // ── Wrinkles/Volume ──
  {
    id: 'botox', name: '보톡스', nameEn: 'Botox', category: 'wrinkle',
    mechanism: '보툴리눔 톡신으로 표정 주름(이마·눈가·미간) 이완',
    icon: '💉',
    triggers: [
      { metric: 'wrinkleScore', threshold: 55, operator: '<' },
    ],
    priorityWeight: 0.85,
    costRange: '5~20만원/부위', downtime: '없음', frequency: '3~6개월',
  },
  {
    id: 'filler', name: '필러', nameEn: 'Filler', category: 'wrinkle',
    mechanism: '히알루론산 필러로 볼륨 보충 및 깊은 주름 개선',
    icon: '💉',
    triggers: [
      { metric: 'elasticityScore', threshold: 48, operator: '<' },
      { metric: 'wrinkleScore', threshold: 48, operator: '<' },
    ],
    priorityWeight: 0.8,
    costRange: '20~80만원/주사', downtime: '1~3일', frequency: '6~18개월',
  },

  // ── Acne/Trouble ──
  {
    id: 'pdt', name: 'PDT', nameEn: 'Photodynamic Therapy', category: 'acne',
    mechanism: '광감작제 + 광 조사로 여드름균 제거 및 피지선 억제',
    icon: '🎯',
    triggers: [
      { metric: 'troubleCount', threshold: 7, operator: '>' },
    ],
    priorityWeight: 0.85,
    costRange: '10~25만원', downtime: '2~5일', frequency: '2주 간격 3~5회',
  },
  {
    id: 'skin-botox', name: '스킨보톡스', nameEn: 'Skin Botox', category: 'acne',
    mechanism: '진피 내 미량 보톡스 주입으로 모공·피지 분비 조절',
    icon: '💧',
    triggers: [
      { metric: 'oilBalance', threshold: 70, operator: '>' },
      { metric: 'poreScore', threshold: 50, operator: '<' },
    ],
    priorityWeight: 0.7,
    costRange: '10~30만원', downtime: '없음', frequency: '3~6개월',
  },

  // ── Rejuvenation ──
  {
    id: 'skin-booster', name: '물광주사', nameEn: 'Skin Booster', category: 'rejuvenation',
    mechanism: 'HA + 비타민 칵테일 미세 주입으로 수분·윤기 개선',
    icon: '💧',
    triggers: [
      { metric: 'moisture', threshold: 50, operator: '<' },
      { metric: 'textureScore', threshold: 55, operator: '<' },
    ],
    priorityWeight: 0.8,
    costRange: '15~40만원', downtime: '1~2일', frequency: '2~4주 간격 3회 후 유지',
  },
  {
    id: 'pdrn', name: '연어주사', nameEn: 'PDRN', category: 'rejuvenation',
    mechanism: '폴리디옥시리보뉴클레오타이드로 손상 조직 재생 촉진',
    icon: '🐟',
    triggers: [
      { metric: 'textureScore', threshold: 55, operator: '<' },
      { metric: 'elasticityScore', threshold: 55, operator: '<' },
    ],
    priorityWeight: 0.75,
    costRange: '10~30만원', downtime: '1일', frequency: '2~4주 간격 3~5회',
  },
  {
    id: 'exosome', name: '엑소좀', nameEn: 'Exosome', category: 'rejuvenation',
    mechanism: '세포외소포체로 세포 재생·항염·피부 장벽 강화',
    icon: '🧬',
    triggers: [
      { metric: 'textureScore', threshold: 50, operator: '<' },
      { metric: 'elasticityScore', threshold: 50, operator: '<' },
    ],
    priorityWeight: 0.7,
    costRange: '30~80만원', downtime: '거의 없음', frequency: '2~4주 간격 3~5회',
  },
  {
    id: 'prp', name: 'PRP', nameEn: 'PRP', category: 'rejuvenation',
    mechanism: '자가 혈소판 풍부 혈장으로 자연 재생 및 콜라겐 생성',
    icon: '🩸',
    triggers: [
      { metric: 'textureScore', threshold: 55, operator: '<' },
      { metric: 'elasticityScore', threshold: 55, operator: '<' },
    ],
    priorityWeight: 0.65,
    costRange: '15~40만원', downtime: '1~2일', frequency: '4주 간격 3회',
  },
];

// ===== Metric label map =====
const METRIC_LABELS = {
  elasticityScore: '탄력', wrinkleScore: '주름', pigmentationScore: '색소',
  poreScore: '모공', textureScore: '피부결', moisture: '수분',
  darkCircleScore: '다크서클', skinTone: '피부톤',
  troubleCount: '트러블', oilBalance: '유분',
};

/**
 * 측정 결과 기반 맞춤 시술 추천
 * @param {object} result - 피부 측정 결과
 * @param {number} maxCount - 최대 추천 개수 (기본 3)
 * @returns {Array} 추천 시술 배열 (urgency 순)
 */
export function getRecommendedTreatments(result, maxCount = 3) {
  if (!result) return [];

  const scored = TREATMENTS.map(t => {
    let triggerScore = 0;
    for (const trigger of t.triggers) {
      const value = result[trigger.metric];
      if (value == null) continue;
      const met = trigger.operator === '<' ? value < trigger.threshold
        : trigger.operator === '>' ? value > trigger.threshold
        : false;
      if (met) {
        const gap = trigger.operator === '<'
          ? trigger.threshold - value
          : value - trigger.threshold;
        triggerScore += 1 + gap / 100;
      }
    }
    if (triggerScore === 0) return null;

    const urgency = (triggerScore / t.triggers.length) * t.priorityWeight;

    // Find the weakest metric for display
    const weakest = t.triggers
      .map(tr => ({ metric: tr.metric, value: result[tr.metric] ?? 50, label: METRIC_LABELS[tr.metric] || tr.metric }))
      .sort((a, b) => a.value - b.value)[0];

    return { ...t, urgency, weakestMetric: weakest };
  }).filter(Boolean);

  scored.sort((a, b) => b.urgency - a.urgency);

  // Deduplicate: max 2 per category
  const catCount = {};
  const selected = [];
  for (const item of scored) {
    const cc = catCount[item.category] || 0;
    if (cc >= 2) continue;
    catCount[item.category] = cc + 1;
    selected.push(item);
    if (selected.length >= maxCount) break;
  }
  return selected;
}

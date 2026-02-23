/**
 * NOU Routine Storage v1.0
 *
 * localStorage 기반 루틴 체크리스트 시스템
 * - 모닝/나이트 루틴 체크 상태 관리
 * - 매일 자정 자동 리셋
 * - 주간 완료율 추적
 */

const ROUTINE_KEY = 'nou_routine_checks';
const ROUTINE_HISTORY_KEY = 'nou_routine_history';

// ===== DEFAULT ROUTINES =====

export const MORNING_STEPS = [
  { id: 'm1', step: 1, name: '클렌저', desc: '순한 폼 or 젤 클렌저로 밤사이 노폐물 제거', time: '1분' },
  { id: 'm2', step: 2, name: '토너', desc: '피부 pH 밸런스 정돈, 다음 단계 흡수력 UP', time: '30초' },
  { id: 'm3', step: 3, name: '세럼', desc: '고농축 활성 성분으로 피부 고민 집중 케어', time: '1분' },
  { id: 'm4', step: 4, name: '수분크림', desc: '수분 장벽 형성, 하루 종일 촉촉함 유지', time: '30초' },
  { id: 'm5', step: 5, name: '선크림', desc: 'SPF50+ PA++++ 자외선 차단 (광노화 예방 필수)', time: '30초' },
];

export const NIGHT_STEPS = [
  { id: 'n1', step: 1, name: '클렌징 오일', desc: '메이크업 & 선크림 유분 기반 1차 세정', time: '2분' },
  { id: 'n2', step: 2, name: '클렌저', desc: '수성 2차 세정으로 잔여물 깔끔 제거', time: '1분' },
  { id: 'n3', step: 3, name: '토너', desc: '세안 후 피부 진정 및 보습 준비', time: '30초' },
  { id: 'n4', step: 4, name: '세럼/앰플', desc: '밤사이 피부 재생을 돕는 집중 케어', time: '1분' },
  { id: 'n5', step: 5, name: '크림', desc: '영양 크림으로 수분 증발 방지 & 피부 재생', time: '1분' },
];

// ===== AI 추천 성분 DB (피부 상태 기반, 카테고리별 복수 성분) =====

const INGREDIENT_DB = {
  pores: [
    { name: 'Niacinamide', nameKo: '나이아신아마이드', icon: '🧪', desc: '피지 조절 & 모공 축소에 효과적인 비타민 B3 유도체.', tip: '아침·저녁 세럼 단계에서 사용. 비타민C와 교대 사용 권장.', concentration: '5~10%', skinTypes: ['지성', '복합성', '민감성'] },
    { name: 'Salicylic Acid (BHA)', nameKo: 'BHA (살리실산)', icon: '🧴', desc: '지용성이라 모공 속 피지까지 녹여내어 블랙헤드·화이트헤드 제거.', tip: '주 2~3회 저녁에 사용. 건조할 수 있으니 보습 필수.', concentration: '0.5~2%', skinTypes: ['지성', '복합성'] },
  ],
  wrinkles: [
    { name: 'Retinol', nameKo: '레티놀', icon: '✨', desc: '세포 턴오버 촉진으로 잔주름·주름 개선. 피부과 인정 안티에이징 성분.', tip: '저녁에만 소량 사용, 자외선 차단 필수. 2주 적응기 필요.', concentration: '0.025~0.1%', skinTypes: ['건성', '복합성'] },
    { name: 'Peptide', nameKo: '펩타이드', icon: '💎', desc: '콜라겐 합성 신호를 보내 주름을 채워주는 온화한 안티에이징 성분.', tip: '레티놀 대신 민감성 피부에 적합. 아침·저녁 사용 가능.', concentration: '마트릭실 5%+', skinTypes: ['민감성', '건성', '복합성', '지성'] },
  ],
  moisture: [
    { name: 'Hyaluronic Acid', nameKo: '히알루론산', icon: '💧', desc: '자기 무게 1000배 수분 흡착. 저분자·고분자 혼합이 가장 효과적.', tip: '축축한 피부에 바른 뒤 크림으로 밀봉. 건조한 환경에선 미스트 병행.', concentration: '1~2%', skinTypes: ['건성', '민감성', '복합성', '지성'] },
    { name: 'Ceramide', nameKo: '세라마이드', icon: '🛡️', desc: '피부 장벽의 핵심 구성 성분. 수분 증발 방지 & 외부 자극 차단.', tip: '크림·로션 단계에서 사용. 건조·민감 피부에 필수.', concentration: '0.5~1%', skinTypes: ['건성', '민감성'] },
  ],
  pigmentation: [
    { name: 'Vitamin C', nameKo: '비타민C (아스코빅산)', icon: '🍊', desc: '멜라닌 생성 억제 & 기존 색소 환원. 강력한 항산화 효과.', tip: '아침 세럼으로 사용하면 자외선 방어력 강화. 빛·열에 약해 냉장 보관.', concentration: '10~20%', skinTypes: ['지성', '복합성'] },
    { name: 'Arbutin', nameKo: '알부틴', icon: '🌸', desc: '티로시나제 억제로 멜라닌 생성을 온화하게 차단. 자극이 적음.', tip: '비타민C보다 순한 미백 성분. 민감성 피부도 사용 가능.', concentration: '2~5%', skinTypes: ['민감성', '건성'] },
  ],
  elasticity: [
    { name: 'Peptide', nameKo: '펩타이드', icon: '💎', desc: '콜라겐·엘라스틴 합성을 촉진하여 피부 탄력 회복.', tip: '마트릭실(Matrixyl), 구리 펩타이드 등 다양한 종류. 꾸준한 사용이 핵심.', concentration: '5%+', skinTypes: ['건성', '복합성', '민감성', '지성'] },
    { name: 'Collagen', nameKo: '콜라겐', icon: '🔬', desc: '저분자 콜라겐은 표피 수분 유지, 피부 탄력감 개선에 도움.', tip: '바르는 콜라겐은 표피 보습 효과. 근본 개선은 펩타이드와 병행.', concentration: '저분자 1~5%', skinTypes: ['건성', '복합성'] },
  ],
  darkCircles: [
    { name: 'Vitamin K + Caffeine', nameKo: '비타민K + 카페인', icon: '👁️', desc: '눈 밑 혈액 순환 개선 & 부기 감소. 다크서클 완화.', tip: '냉장 보관 후 아이크림으로 사용. 약지로 톡톡 두드려 흡수.', concentration: '카페인 1~3%', skinTypes: ['건성', '복합성', '민감성', '지성'] },
    { name: 'Retinol', nameKo: '레티놀', icon: '✨', desc: '눈가 피부 턴오버 촉진, 색소 침착 개선으로 다크서클 완화.', tip: '아이크림 형태로 저농도 사용. 눈가 자극 주의.', concentration: '0.01~0.025%', skinTypes: ['복합성', '지성'] },
  ],
  texture: [
    { name: 'AHA (Glycolic Acid)', nameKo: 'AHA (글리콜산)', icon: '🧴', desc: '수용성 각질 제거제. 칙칙한 피부톤 개선 & 매끈한 피부결.', tip: '주 2~3회 저녁 사용. 이후 반드시 선크림. 건성 피부에 적합.', concentration: '5~10%', skinTypes: ['건성', '복합성'] },
    { name: 'PHA (Gluconolactone)', nameKo: 'PHA (글루코노락톤)', icon: '🌿', desc: '분자가 커서 천천히 흡수, 자극 최소화. 보습 효과까지.', tip: '민감성 피부용 각질 케어. 매일 사용 가능.', concentration: '3~8%', skinTypes: ['민감성', '건성'] },
  ],
  oilBalance: [
    { name: 'Green Tea Extract', nameKo: '녹차 추출물', icon: '🍵', desc: 'EGCG 성분이 피지 과다 생산 억제 & 항산화·항염 효과.', tip: '아침 토너·세럼 단계에서 사용. 가벼운 제형 선택.', concentration: 'EGCG 0.5~1%', skinTypes: ['지성', '복합성'] },
    { name: 'Niacinamide', nameKo: '나이아신아마이드', icon: '🧪', desc: '피지 분비 조절 & 유수분 밸런스 정상화. 모공 관리에도 효과적.', tip: '지성 피부 필수 성분. 아침·저녁 모두 사용 가능.', concentration: '4~5%', skinTypes: ['지성', '복합성'] },
  ],
  trouble: [
    { name: 'Tea Tree Oil', nameKo: '티트리 오일', icon: '🌿', desc: '천연 항균·항염 성분. 여드름 부위에 국소 사용 시 효과적.', tip: '원액은 자극적이므로 희석 제품 사용. 스팟 케어로 활용.', concentration: '1~5%', skinTypes: ['지성', '복합성', '민감성'] },
    { name: 'Salicylic Acid (BHA)', nameKo: '살리실산 (BHA)', icon: '🧴', desc: '모공 속 피지·각질 제거로 트러블 원인 차단. 항염 효과.', tip: '주 2~3회 저녁에 국소 사용. 과사용 시 건조 주의.', concentration: '0.5~2%', skinTypes: ['지성', '복합성'] },
  ],
};

// 기본 추천 성분 (분석 기록 없을 때)
const DEFAULT_RECOMMENDATIONS = [
  { ...INGREDIENT_DB.moisture[0], reason: '기본 보습 관리', metric: 'moisture', score: null },
  { ...INGREDIENT_DB.oilBalance[1], reason: '유수분 밸런스', metric: 'oilBalance', score: null },
  { ...INGREDIENT_DB.pigmentation[0], reason: '기본 항산화', metric: 'pigmentation', score: null },
];

// ===== CORE FUNCTIONS =====

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getChecks() {
  try {
    const raw = JSON.parse(localStorage.getItem(ROUTINE_KEY) || '{}');
    // 자정 리셋: 날짜가 다르면 초기화
    if (raw.date !== getTodayKey()) {
      return { date: getTodayKey(), morning: {}, night: {} };
    }
    return raw;
  } catch {
    return { date: getTodayKey(), morning: {}, night: {} };
  }
}

export function toggleCheck(mode, stepId) {
  const checks = getChecks();
  if (!checks[mode]) checks[mode] = {};
  checks[mode][stepId] = !checks[mode][stepId];
  checks.date = getTodayKey();
  localStorage.setItem(ROUTINE_KEY, JSON.stringify(checks));
  // 히스토리 업데이트
  updateHistory(checks);
  return checks;
}

export function getProgress(mode) {
  const checks = getChecks();
  const steps = mode === 'morning' ? MORNING_STEPS : NIGHT_STEPS;
  const modeChecks = checks[mode] || {};
  const done = steps.filter(s => modeChecks[s.id]).length;
  return { done, total: steps.length };
}

// ===== WEEKLY HISTORY =====

function updateHistory(checks) {
  try {
    const history = JSON.parse(localStorage.getItem(ROUTINE_HISTORY_KEY) || '{}');
    const today = getTodayKey();
    const mDone = MORNING_STEPS.filter(s => (checks.morning || {})[s.id]).length;
    const nDone = NIGHT_STEPS.filter(s => (checks.night || {})[s.id]).length;
    history[today] = {
      morning: mDone >= MORNING_STEPS.length,
      night: nDone >= NIGHT_STEPS.length,
      morningCount: mDone,
      nightCount: nDone,
    };
    // 30일 이상 오래된 항목 정리
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const key of Object.keys(history)) {
      if (new Date(key).getTime() < cutoff) delete history[key];
    }
    localStorage.setItem(ROUTINE_HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

export function getWeeklyCompletion() {
  try {
    const history = JSON.parse(localStorage.getItem(ROUTINE_HISTORY_KEY) || '{}');
    const days = [];
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + mondayOffset + i);
      const key = d.toISOString().slice(0, 10);
      const entry = history[key];
      days.push({
        date: key,
        dayLabel: ['월', '화', '수', '목', '금', '토', '일'][i],
        isToday: key === getTodayKey(),
        completed: entry ? (entry.morning && entry.night) : false,
        partial: entry ? (entry.morningCount > 0 || entry.nightCount > 0) : false,
      });
    }
    return days;
  } catch {
    return [];
  }
}

// ===== AI RECOMMENDATION =====

const METRIC_LABELS = {
  pores: '모공', wrinkles: '주름', moisture: '수분',
  pigmentation: '색소침착', elasticity: '탄력', darkCircles: '다크서클',
  texture: '피부결', oilBalance: '유수분', trouble: '트러블',
};

// 기존 단일 추천 함수 (하위호환)
export function getIngredientRecommendation(latestRecord) {
  const recs = getIngredientRecommendations(latestRecord);
  return recs[0];
}

// 복수 성분 추천 (최대 3개)
export function getIngredientRecommendations(latestRecord) {
  if (!latestRecord) return DEFAULT_RECOMMENDATIONS;

  const skinType = latestRecord.skinType || null;

  const metrics = [
    { key: 'pores', score: latestRecord.poreScore },
    { key: 'wrinkles', score: latestRecord.wrinkleScore },
    { key: 'moisture', score: latestRecord.moisture },
    { key: 'pigmentation', score: latestRecord.pigmentationScore },
    { key: 'elasticity', score: latestRecord.elasticityScore },
    { key: 'darkCircles', score: latestRecord.darkCircleScore },
    { key: 'texture', score: latestRecord.textureScore },
    { key: 'oilBalance', score: latestRecord.oilBalance },
    { key: 'trouble', score: latestRecord.troubleCount != null ? Math.max(0, 100 - latestRecord.troubleCount * 10) : undefined },
  ];

  // 점수 오름차순 정렬 (낮을수록 약점)
  metrics.sort((a, b) => (a.score ?? 100) - (b.score ?? 100));

  const results = [];
  const usedNames = new Set();

  for (const m of metrics) {
    if (results.length >= 3) break;
    const candidates = INGREDIENT_DB[m.key];
    if (!candidates) continue;

    // 피부 타입에 맞는 성분 우선 선택
    let picked = null;
    for (const c of candidates) {
      if (usedNames.has(c.nameKo)) continue;
      if (skinType && c.skinTypes.includes(skinType)) { picked = c; break; }
    }
    // 피부타입 매칭 없으면 중복 아닌 첫 번째
    if (!picked) {
      picked = candidates.find(c => !usedNames.has(c.nameKo));
    }
    if (!picked) continue;

    usedNames.add(picked.nameKo);
    results.push({
      ...picked,
      reason: `${METRIC_LABELS[m.key] || m.key} ${m.score ?? '?'}점`,
      metric: m.key,
      score: m.score ?? null,
    });
  }

  return results.length > 0 ? results : DEFAULT_RECOMMENDATIONS;
}

// ===== PERSONALIZED STEPS (AI 진단 기반 루틴 조정) =====

export function getPersonalizedSteps(mode, latestRecord) {
  const base = mode === 'morning' ? MORNING_STEPS : NIGHT_STEPS;
  if (!latestRecord) return base;

  // 피부 상태에 따라 설명 커스터마이징
  return base.map(step => {
    const custom = { ...step };
    if (mode === 'morning' && step.id === 'm3') {
      // 세럼 추천 커스터마이징
      if (latestRecord.poreScore < 50) custom.desc = '나이아신아마이드 세럼으로 모공 집중 케어';
      else if (latestRecord.moisture < 50) custom.desc = '히알루론산 세럼으로 수분 집중 보충';
      else if (latestRecord.pigmentationScore < 50) custom.desc = '비타민C 세럼으로 톤 업 & 항산화';
    }
    if (mode === 'night' && step.id === 'n4') {
      if (latestRecord.wrinkleScore < 50) custom.desc = '레티놀 앰플로 주름 집중 케어 (소량부터 시작)';
      else if (latestRecord.elasticityScore < 50) custom.desc = '펩타이드 앰플로 탄력 집중 강화';
      else if (latestRecord.textureScore < 50) custom.desc = 'AHA 앰플로 각질 관리 & 피부결 개선';
    }
    return custom;
  });
}

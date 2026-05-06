/**
 * 영양제 라이브러리 (Phase 1, 30종)
 * 목표-역할-영양제 매핑, 충돌 규칙, 시너지, 타이밍
 */

// ===== 11개 목표 =====
export const GOALS = [
  { id: 'fatigue', icon: '😴', label: '피곤·기력 없음' },
  { id: 'focus', icon: '🧠', label: '집중력 저하' },
  { id: 'stress', icon: '💆', label: '스트레스' },
  { id: 'sleep', icon: '🌙', label: '수면 문제' },
  { id: 'skin', icon: '✨', label: '피부 트러블' },
  { id: 'muscle', icon: '💪', label: '근육량 증가' },
  { id: 'cycle', icon: '🩸', label: '생리 불규칙' },
  { id: 'bones', icon: '🦴', label: '관절·뼈' },
  { id: 'weight', icon: '⚖️', label: '체중 관리' },
  { id: 'immunity', icon: '🫀', label: '면역력' },
  { id: 'hair', icon: '🪮', label: '탈모·모발' },
];

// ===== 30종 영양제 라이브러리 =====
export const SUPPLEMENTS = {
  vitamin_b_complex: {
    name: '비타민B군', emoji: '💊',
    badges: ['검증됨'],
    description: '에너지 대사 핵심',
    detailed: '탄수화물·지방·단백질을 에너지로 변환',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1정',
    cautions: ['빈 속 시 위장 자극 가능'],
    conflicts: [],
    synergies: ['iron'],
  },
  vitamin_b6: {
    name: '비타민B6', emoji: '💊',
    badges: [],
    description: '호르몬 균형·수면 보조',
    detailed: '멜라토닌 합성, 신경 전달 물질 생성',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1정',
    cautions: [],
    conflicts: [],
    synergies: ['magnesium'],
  },
  vitamin_b12: {
    name: '비타민B12', emoji: '💊',
    badges: [],
    description: '신경 기능·에너지 생성',
    detailed: '적혈구 생성, 신경 세포 보호',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1정',
    cautions: [],
    conflicts: [],
    synergies: ['folate'],
  },
  vitamin_c: {
    name: '비타민C', emoji: '🍊',
    badges: ['검증됨'],
    description: '항산화·콜라겐 합성',
    detailed: '면역력 강화, 피부 건강, 철분 흡수 촉진',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1정',
    cautions: [],
    conflicts: [],
    synergies: ['iron', 'collagen'],
  },
  vitamin_d: {
    name: '비타민D', emoji: '☀️',
    badges: ['한국인 80% 부족'],
    description: '뼈 건강·면역 조절',
    detailed: '칼슘 흡수, 면역 조절, 근력 유지',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1정',
    cautions: ['지용성 — 과잉 섭취 주의'],
    conflicts: [],
    synergies: ['calcium', 'magnesium'],
  },
  vitamin_e: {
    name: '비타민E', emoji: '🛡️',
    badges: [],
    description: '항산화·세포 보호',
    detailed: '활성산소 제거, 피부 노화 방지',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1정',
    cautions: ['지용성 — 과잉 섭취 주의', '항응고제 복용 시 의사 상담'],
    conflicts: [],
    synergies: ['vitamin_c'],
  },
  vitamin_k2: {
    name: '비타민K2', emoji: '💚',
    badges: [],
    description: '칼슘 대사·혈관 건강',
    detailed: '칼슘을 뼈로 보내고 혈관 석회화 방지',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1정',
    cautions: ['항응고제 복용 시 의사 상담'],
    conflicts: [],
    synergies: ['vitamin_d', 'calcium'],
  },
  folate: {
    name: '엽산', emoji: '🌱',
    badges: ['여성 권장'],
    description: '세포 분열·빈혈 예방',
    detailed: 'DNA 합성, 태아 발달, 적혈구 생성',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1정',
    cautions: [],
    conflicts: [],
    synergies: ['vitamin_b12'],
  },
  biotin: {
    name: '비오틴', emoji: '💅',
    badges: [],
    description: '모발·피부·손톱 건강',
    detailed: '케라틴 합성 촉진',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1정',
    cautions: ['혈액검사 7일 전 중단'],
    conflicts: [],
    synergies: [],
  },
  // 미네랄 (5종)
  calcium: {
    name: '칼슘', emoji: '🦴',
    badges: ['검증됨'],
    description: '뼈·치아 건강',
    detailed: '골밀도 유지, 근육 수축, 신경 전달',
    timing: { time: 'evening', meal: 'after' },
    dosage: '1정',
    cautions: ['과량 시 신장 결석 위험'],
    conflicts: ['iron', 'magnesium'],
    synergies: ['vitamin_d', 'vitamin_k2'],
  },
  magnesium: {
    name: '마그네슘', emoji: '💚',
    badges: ['검증됨'],
    description: '수면·이완·신경 안정',
    detailed: '300+ 효소 작용에 필요, 한국인 70% 부족',
    timing: { time: 'bedtime', meal: 'any' },
    dosage: '1정',
    cautions: ['과량 시 설사'],
    conflicts: ['calcium'],
    synergies: ['vitamin_d'],
  },
  iron: {
    name: '철분', emoji: '🩸',
    badges: ['여성 권장'],
    description: '산소 운반·빈혈 예방',
    detailed: '생리하는 여성에게 특히 중요',
    timing: { time: 'morning', meal: 'before' },
    dosage: '1정',
    cautions: ['위장 약하면 식후로 변경', '공복 흡수 ↑'],
    conflicts: ['calcium', 'vitamin_b12'],
    synergies: ['vitamin_c'],
  },
  zinc: {
    name: '아연', emoji: '🔬',
    badges: [],
    description: '면역·피부·모발 건강',
    detailed: '세포 분열, 상처 회복, 면역 세포 활성화',
    timing: { time: 'evening', meal: 'after' },
    dosage: '1정',
    cautions: ['빈 속 시 메스꺼움'],
    conflicts: [],
    synergies: [],
  },
  selenium: {
    name: '셀레늄', emoji: '🔬',
    badges: [],
    description: '항산화·갑상선 기능',
    detailed: '갑상선 호르몬 대사, 항산화 방어',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1정',
    cautions: ['과잉 섭취 주의'],
    conflicts: [],
    synergies: ['vitamin_e'],
  },
  // 기능성 (10종)
  omega3: {
    name: '오메가3', emoji: '🐟',
    badges: ['검증됨'],
    description: '뇌 건강·항염',
    detailed: 'DHA/EPA — 뇌 기능, 심혈관, 항염',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1-2정',
    cautions: ['항응고제 복용 시 의사 상담'],
    conflicts: [],
    synergies: [],
  },
  coenzyme_q10: {
    name: '코엔자임Q10', emoji: '⚡',
    badges: ['30대+'],
    description: '세포 에너지 생산',
    detailed: '미토콘드리아 에너지 생성, 항산화',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1정',
    cautions: [],
    conflicts: [],
    synergies: [],
  },
  collagen: {
    name: '콜라겐', emoji: '✨',
    badges: [],
    description: '피부 탄력·관절 건강',
    detailed: '피부 수분, 탄력, 관절 연골 보호',
    timing: { time: 'evening', meal: 'after' },
    dosage: '1포',
    cautions: [],
    conflicts: [],
    synergies: ['vitamin_c'],
  },
  probiotics: {
    name: '유산균', emoji: '🦠',
    badges: [],
    description: '장 건강·면역력',
    detailed: '장내 유익균 균형, 소화·면역 기능',
    timing: { time: 'morning', meal: 'before' },
    dosage: '1캡슐',
    cautions: ['냉장 보관 권장'],
    conflicts: [],
    synergies: ['prebiotics'],
  },
  prebiotics: {
    name: '프리바이오틱스', emoji: '🌿',
    badges: [],
    description: '유산균 먹이·장 환경 개선',
    detailed: '유익균 증식 촉진',
    timing: { time: 'morning', meal: 'with' },
    dosage: '1포',
    cautions: [],
    conflicts: [],
    synergies: ['probiotics'],
  },
  l_theanine: {
    name: 'L-테아닌', emoji: '🍵',
    badges: [],
    description: '이완·집중 동시 향상',
    detailed: '알파파 증가, 카페인 부작용 완화',
    timing: { time: 'bedtime', meal: 'any' },
    dosage: '1정',
    cautions: [],
    conflicts: [],
    synergies: [],
  },
  glucosamine: {
    name: '글루코사민', emoji: '🦴',
    badges: [],
    description: '관절 연골 보호',
    detailed: '연골 구성 성분, 관절 마모 방지',
    timing: { time: 'lunch', meal: 'with' },
    dosage: '1정',
    cautions: ['갑각류 알레르기 주의'],
    conflicts: [],
    synergies: ['msm'],
  },
  msm: {
    name: 'MSM', emoji: '🦴',
    badges: [],
    description: '관절 염증 완화',
    detailed: '유기 유황 — 관절·연골 건강',
    timing: { time: 'lunch', meal: 'with' },
    dosage: '1정',
    cautions: [],
    conflicts: [],
    synergies: ['glucosamine'],
  },
  multivitamin: {
    name: '종합비타민', emoji: '💊',
    badges: [],
    description: '기본 영양소 보충',
    detailed: '여러 비타민·미네랄 종합 보충',
    timing: { time: 'lunch', meal: 'with' },
    dosage: '1정',
    cautions: ['지용성 비타민 중복 주의'],
    conflicts: [],
    synergies: [],
  },
  evening_primrose: {
    name: '달맞이꽃종자유', emoji: '🌸',
    badges: ['여성 권장'],
    description: '호르몬 균형·피부 건강',
    detailed: 'GLA 함유 — PMS 완화, 피부 수분',
    timing: { time: 'evening', meal: 'after' },
    dosage: '1캡슐',
    cautions: [],
    conflicts: [],
    synergies: [],
  },
  // 운동 (4종)
  protein: {
    name: '단백질', emoji: '🥩',
    badges: ['검증됨'],
    description: '근육 합성·회복',
    detailed: '근육 성장, 포만감, 대사율 유지',
    timing: { time: 'lunch', meal: 'with' },
    dosage: '1스쿱',
    cautions: [],
    conflicts: [],
    synergies: [],
  },
  bcaa: {
    name: 'BCAA', emoji: '💪',
    badges: [],
    description: '근육 회복·분해 방지',
    detailed: '류신·이소류신·발린 — 운동 전후 회복',
    timing: { time: 'lunch', meal: 'with' },
    dosage: '1스쿱',
    cautions: [],
    conflicts: [],
    synergies: ['protein'],
  },
  creatine: {
    name: '크레아틴', emoji: '💪',
    badges: ['검증됨'],
    description: '근력·근육량 증가',
    detailed: 'ATP 재합성 — 고강도 운동 능력 향상',
    timing: { time: 'morning', meal: 'after' },
    dosage: '5g',
    cautions: ['충분한 수분 섭취 필요'],
    conflicts: [],
    synergies: [],
  },
  chromium: {
    name: '크롬', emoji: '⚖️',
    badges: [],
    description: '혈당 안정·식욕 조절',
    detailed: '인슐린 민감도 개선',
    timing: { time: 'lunch', meal: 'before' },
    dosage: '1정',
    cautions: [],
    conflicts: [],
    synergies: [],
  },
  // 기타 (3종)
  fiber: {
    name: '식이섬유', emoji: '🌾',
    badges: [],
    description: '포만감·장 건강',
    detailed: '혈당 조절, 콜레스테롤 관리',
    timing: { time: 'lunch', meal: 'with' },
    dosage: '1포',
    cautions: ['충분한 수분과 함께'],
    conflicts: [],
    synergies: [],
  },
  glycine: {
    name: '글리신', emoji: '🌙',
    badges: [],
    description: '수면 질 개선',
    detailed: '체온 하강, 수면 유도, 콜라겐 합성',
    timing: { time: 'bedtime', meal: 'any' },
    dosage: '3g',
    cautions: [],
    conflicts: [],
    synergies: [],
  },
  green_tea_extract: {
    name: '녹차추출물', emoji: '🍃',
    badges: [],
    description: '대사 활성·항산화',
    detailed: 'EGCG — 지방 산화 촉진',
    timing: { time: 'morning', meal: 'after' },
    dosage: '1정',
    cautions: ['카페인 포함 — 저녁 복용 피하기'],
    conflicts: [],
    synergies: [],
  },
};

// ===== 목표 → 역할 그룹 → 영양제 매핑 =====
export const GOAL_ROLE_MAP = {
  fatigue: [
    { emoji: '⚡', name: '에너지 생성', description: '세포에서 ATP를 만드는 데 필요',
      supplements: ['vitamin_b_complex', 'coenzyme_q10'] },
    { emoji: '🩸', name: '산소 운반', description: '혈액이 산소를 잘 나르도록 도움',
      supplements: ['iron', 'vitamin_c'] },
    { emoji: '💚', name: '세포 활력', description: '근육·신경의 기본 에너지원',
      supplements: ['magnesium', 'vitamin_d'] },
  ],
  focus: [
    { emoji: '🔥', name: '뇌 활성', description: '뇌세포 막을 구성하고 보호',
      supplements: ['omega3', 'vitamin_b12'] },
    { emoji: '🎯', name: '집중·각성', description: '알파파 증가, 집중력 향상',
      supplements: ['l_theanine'] },
    { emoji: '💚', name: '신경 안정', description: '신경 흥분을 조절해 균형 유지',
      supplements: ['magnesium'] },
  ],
  stress: [
    { emoji: '🧘', name: '신경 안정', description: '긴장된 신경을 이완시키는 핵심',
      supplements: ['magnesium', 'vitamin_b_complex'] },
    { emoji: '💪', name: '부신 회복', description: '스트레스 호르몬 대응에 소모되는 영양소 보충',
      supplements: ['vitamin_c'] },
    { emoji: '😌', name: '진정·이완', description: '마음을 차분하게 만드는 성분',
      supplements: ['l_theanine'] },
  ],
  sleep: [
    { emoji: '💤', name: '수면 유도', description: '근육 이완, 수면 질 개선',
      supplements: ['magnesium'] },
    { emoji: '🧠', name: '멜라토닌 합성', description: '수면 호르몬 생성에 필요',
      supplements: ['vitamin_b6'] },
    { emoji: '😌', name: '신경 진정', description: '잠들기 전 긴장 완화',
      supplements: ['l_theanine', 'zinc'] },
  ],
  skin: [
    { emoji: '🧬', name: '콜라겐 합성', description: '피부 탄력의 핵심 구조 단백질',
      supplements: ['vitamin_c', 'collagen'] },
    { emoji: '🛡️', name: '항산화·재생', description: '피부 세포 보호 및 재생',
      supplements: ['vitamin_e', 'zinc'] },
    { emoji: '💧', name: '수분·장벽', description: '피부 장벽 강화, 수분 유지',
      supplements: ['omega3', 'biotin'] },
  ],
  muscle: [
    { emoji: '🥩', name: '단백질 합성', description: '근육 성장의 기본 재료',
      supplements: ['protein', 'bcaa'] },
    { emoji: '⚡', name: '근력·근육량', description: 'ATP 재합성으로 운동 능력 향상',
      supplements: ['creatine'] },
    { emoji: '💚', name: '회복·골격', description: '운동 후 회복과 골격 지지',
      supplements: ['vitamin_d', 'magnesium'] },
  ],
  cycle: [
    { emoji: '🌸', name: '호르몬 균형', description: '호르몬 대사에 관여하는 영양소',
      supplements: ['vitamin_b6', 'magnesium'] },
    { emoji: '🩸', name: '빈혈 예방', description: '생리로 손실되는 철분 보충',
      supplements: ['iron', 'folate'] },
    { emoji: '💚', name: '자궁 건강', description: '자궁 기능과 염증 조절',
      supplements: ['vitamin_d', 'omega3'] },
  ],
  bones: [
    { emoji: '🦴', name: '골밀도', description: '뼈를 단단하게 유지하는 핵심',
      supplements: ['calcium', 'vitamin_d'] },
    { emoji: '🛡️', name: '관절 보호', description: '관절 연골을 보호하고 염증 완화',
      supplements: ['glucosamine', 'msm'] },
    { emoji: '💚', name: '결합조직', description: '뼈와 관절을 잇는 조직 강화',
      supplements: ['collagen', 'vitamin_c'] },
  ],
  weight: [
    { emoji: '🔥', name: '대사 활성', description: '기초 대사율을 높이는 데 도움',
      supplements: ['green_tea_extract'] },
    { emoji: '🩸', name: '혈당 안정', description: '혈당 급등락을 줄여 식욕 조절',
      supplements: ['chromium', 'magnesium'] },
    { emoji: '🍽️', name: '포만감', description: '포만감을 높여 과식 방지',
      supplements: ['fiber', 'protein'] },
  ],
  immunity: [
    { emoji: '🛡️', name: '면역 증강', description: '면역 세포 활성화의 핵심',
      supplements: ['vitamin_c', 'zinc'] },
    { emoji: '☀️', name: '면역 조절', description: '면역 반응의 균형을 맞춤',
      supplements: ['vitamin_d'] },
    { emoji: '🦠', name: '장 건강', description: '면역 세포의 70%가 장에 존재',
      supplements: ['probiotics'] },
  ],
  hair: [
    { emoji: '🌱', name: '모낭 영양', description: '모낭 세포 분열에 필요한 미네랄',
      supplements: ['zinc', 'iron'] },
    { emoji: '💪', name: '단백질 공급', description: '모발의 주성분 케라틴 합성',
      supplements: ['protein', 'collagen'] },
    { emoji: '🔬', name: '보조', description: '모발 성장 보조 영양소',
      supplements: ['biotin', 'vitamin_d'] },
  ],
};

// ===== lua 추천 세트 (목표별 핵심 2-3개) =====
export const LUA_RECOMMENDED_SETS = {
  fatigue: ['vitamin_b_complex', 'iron'],
  focus: ['omega3', 'l_theanine'],
  stress: ['magnesium', 'vitamin_b_complex'],
  sleep: ['magnesium', 'l_theanine'],
  skin: ['vitamin_c', 'collagen'],
  muscle: ['protein', 'creatine'],
  cycle: ['iron', 'folate', 'vitamin_b6'],
  bones: ['calcium', 'vitamin_d'],
  weight: ['chromium', 'fiber'],
  immunity: ['vitamin_c', 'vitamin_d', 'probiotics'],
  hair: ['zinc', 'iron', 'protein'],
};

// ===== 충돌 규칙 =====
export const CONFLICT_RULES = [
  { a: 'iron', b: 'calcium', hours: 4, msg: '철분과 칼슘은 4시간 간격으로 드시는 게 좋아요' },
  { a: 'magnesium', b: 'calcium', msg: '마그네슘과 칼슘은 흡수 경쟁이 있어요. 시간을 나눠 드세요' },
  { a: 'vitamin_c', b: 'vitamin_b12', hours: 2, msg: '비타민C와 B12는 2시간 간격 권장이에요' },
  { a: 'zinc', b: 'iron', msg: '아연과 철분은 동시 복용 시 흡수가 줄어요' },
];

// ===== 시너지 규칙 =====
export const SYNERGY_RULES = [
  { supplements: ['vitamin_d', 'calcium'], note: '비타민D가 칼슘 흡수를 높여요' },
  { supplements: ['vitamin_d', 'magnesium'], note: '마그네슘이 비타민D 활성화에 필요해요' },
  { supplements: ['iron', 'vitamin_c'], note: '비타민C가 철분 흡수를 높여요 (특히 식물성)' },
  { supplements: ['vitamin_c', 'collagen'], note: '콜라겐 합성에 비타민C가 필수예요' },
  { supplements: ['glucosamine', 'msm'], note: '함께 복용 시 관절 보호 시너지' },
  { supplements: ['probiotics', 'prebiotics'], note: '프리바이오틱스가 유산균 먹이 역할' },
];

// ===== 의료 주의 =====
export const MEDICAL_WARNINGS = [
  { supplement: 'biotin', warning: '혈액검사 7일 전 중단 권장' },
  { supplements: ['vitamin_e', 'omega3'], warning: '항응고제 복용 시 의사 상담' },
];

// ===== 자동 충돌 검사 =====
export function checkConflicts(selectedIds) {
  const warnings = [];
  CONFLICT_RULES.forEach(rule => {
    if (selectedIds.includes(rule.a) && selectedIds.includes(rule.b)) {
      warnings.push({ type: 'conflict', ...rule });
    }
  });
  MEDICAL_WARNINGS.forEach(rule => {
    if (rule.supplement && selectedIds.includes(rule.supplement)) {
      warnings.push({ type: 'medical', msg: `${SUPPLEMENTS[rule.supplement].name}: ${rule.warning}` });
    }
    if (rule.supplements && rule.supplements.every(s => selectedIds.includes(s))) {
      const names = rule.supplements.map(s => SUPPLEMENTS[s].name).join('·');
      warnings.push({ type: 'medical', msg: `${names}: ${rule.warning}` });
    }
  });
  return warnings;
}

// ===== 시너지 찾기 =====
export function findSynergies(selectedIds) {
  return SYNERGY_RULES.filter(rule =>
    rule.supplements.every(s => selectedIds.includes(s))
  );
}

// ===== 자동 시간대 배치 =====
export function autoSchedule(selectedIds) {
  const schedule = { morning: [], lunch: [], evening: [], bedtime: [] };
  selectedIds.forEach(id => {
    const supp = SUPPLEMENTS[id];
    if (!supp) return;
    schedule[supp.timing.time].push({ id, meal: supp.timing.meal });
  });

  // 충돌 자동 분리: iron+calcium 같은 시간대면 분리
  CONFLICT_RULES.forEach(rule => {
    const aTime = findTimeSlot(schedule, rule.a);
    const bTime = findTimeSlot(schedule, rule.b);
    if (aTime && bTime && aTime === bTime) {
      // b를 다른 시간대로 이동
      const altTime = aTime === 'evening' ? 'morning' : 'evening';
      moveToSlot(schedule, rule.b, aTime, altTime);
    }
  });

  return schedule;
}

function findTimeSlot(schedule, id) {
  for (const [time, items] of Object.entries(schedule)) {
    if (items.some(item => item.id === id)) return time;
  }
  return null;
}

function moveToSlot(schedule, id, fromTime, toTime) {
  const idx = schedule[fromTime].findIndex(item => item.id === id);
  if (idx >= 0) {
    const [item] = schedule[fromTime].splice(idx, 1);
    schedule[toTime].push(item);
  }
}

// ===== 시간대 라벨 =====
export const TIME_SLOTS = {
  morning: { emoji: '🌅', label: '아침', defaultTime: '08:00', mealLabel: '식사 후' },
  lunch: { emoji: '🌞', label: '점심', defaultTime: '12:30', mealLabel: '식사와 함께' },
  evening: { emoji: '🌆', label: '저녁', defaultTime: '18:30', mealLabel: '식사 후' },
  bedtime: { emoji: '🌙', label: '취침 전', defaultTime: '22:00', mealLabel: '' },
};

export const MEAL_LABELS = {
  before: '식전',
  after: '식후',
  with: '식사와 함께',
  any: '',
};

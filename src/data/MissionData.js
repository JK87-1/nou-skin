/**
 * 피부 미션 데이터베이스
 * 최근 분석 결과 기반으로 가장 약한 지표에 맞춤 미션 생성
 */

const MISSION_DATABASE = {
  수분부족: {
    main: {
      icon: '💧', category: '수분 케어',
      title: '물 8잔 마시기',
      description: '수분 점수가 낮은 편이에요. 충분한 수분 섭취가 피부 수분 유지의 첫걸음이에요.',
      xp: 30, trackable: true, trackTotal: 8, trackUnit: '잔',
      buttonText: '물 한 잔 마셨어요!',
    },
    bonus: [
      { icon: '🧴', category: '스킨케어', title: '세럼 후 크림으로 수분 잠금', description: '세럼만으로는 수분이 날아가요. 크림으로 덮어줘야 효과가 유지돼요.', xp: 20 },
      { icon: '🌙', category: '수면 케어', title: '오늘 11시 전에 잠들기', description: '충분한 수면이 피부 수분 회복의 핵심이에요.', xp: 25 },
    ],
  },
  색소침착: {
    main: {
      icon: '☀️', category: '자외선 차단',
      title: '선크림 2시간마다 덧바르기',
      description: '색소 점수가 낮아요. 자외선 차단이 색소 침착 예방의 가장 중요한 습관이에요.',
      xp: 30, trackable: true, trackTotal: 3, trackUnit: '회',
      buttonText: '선크림 발랐어요!',
    },
    bonus: [
      { icon: '✨', category: '미백 케어', title: '비타민C 세럼 바르기', description: '비타민C는 멜라닌 생성을 억제하는 대표 미백 성분이에요.', xp: 20 },
      { icon: '🧢', category: '생활 습관', title: '외출 시 모자 또는 양산 쓰기', description: '물리적 차단이 가장 확실한 자외선 방어법이에요.', xp: 15 },
    ],
  },
  다크서클: {
    main: {
      icon: '🌙', category: '수면 케어',
      title: '7시간 이상 수면하기',
      description: '다크서클 점수가 낮아요. 충분한 수면이 눈가 피부 회복의 핵심이에요.',
      xp: 30, trackable: false,
    },
    bonus: [
      { icon: '👁', category: '아이 케어', title: '아이크림 톡톡 두드려 바르기', description: '눈가 피부는 얇아서 문지르지 말고 톡톡 두드려주세요.', xp: 20 },
      { icon: '🧊', category: '혈액순환', title: '냉장 보관 아이패치 10분', description: '차가운 아이패치가 눈가 혈액순환을 도와 다크서클을 완화해요.', xp: 15 },
    ],
  },
  트러블: {
    main: {
      icon: '🫧', category: '클렌징',
      title: '이중 세안 꼼꼼히 하기',
      description: '트러블 관리의 시작은 깨끗한 세안이에요. 오일 → 폼 순서로 해주세요.',
      xp: 30, trackable: false,
    },
    bonus: [
      { icon: '🚫', category: '생활 습관', title: '얼굴 만지지 않기', description: '손의 세균이 트러블의 주요 원인이에요. 의식적으로 참아보세요.', xp: 20 },
      { icon: '🥗', category: '식습관', title: '기름진 음식 피하기', description: '오늘 하루 담백한 식단을 유지해보세요.', xp: 15 },
    ],
  },
  민감도: {
    main: {
      icon: '🛡', category: '장벽 케어',
      title: '세라마이드 크림 충분히 바르기',
      description: '민감도가 높아요. 세라마이드가 피부 장벽을 복구하는 데 도움을 줘요.',
      xp: 30, trackable: false,
    },
    bonus: [
      { icon: '🚿', category: '클렌징', title: '미온수로만 세안하기', description: '뜨거운 물은 피부 장벽을 손상시켜요. 미온수가 최적이에요.', xp: 20 },
      { icon: '🧘', category: '스트레스', title: '5분 심호흡 또는 명상', description: '스트레스는 피부 민감도를 높이는 주요 원인이에요.', xp: 15 },
    ],
  },
  기본: {
    main: {
      icon: '✨', category: '유지 관리',
      title: '기본 스킨케어 루틴 완수하기',
      description: '피부 상태가 좋아요! 기본 루틴을 꾸준히 유지하는 게 핵심이에요.',
      xp: 30, trackable: false,
    },
    bonus: [
      { icon: '💧', category: '수분', title: '물 6잔 이상 마시기', description: '좋은 상태를 유지하려면 수분 섭취가 중요해요.', xp: 20 },
      { icon: '☀️', category: '자외선', title: '선크림 꼼꼼히 바르기', description: '자외선 차단은 365일 필수예요.', xp: 15 },
    ],
  },
};

// 분석 지표 → 미션 카테고리 매핑
const METRIC_TO_CATEGORY = [
  { key: 'moisture', category: '수분부족', label: '수분' },
  { key: 'pigmentationScore', category: '색소침착', label: '색소' },
  { key: 'darkCircleScore', category: '다크서클', label: '다크서클' },
  { key: 'poreScore', category: '트러블', label: '모공' },
  { key: 'elasticityScore', category: '민감도', label: '탄력' },
];

const UV_BONUS = {
  icon: '☀️', category: '자외선', title: '선크림 꼼꼼히 바르기',
  description: '자외선 차단은 365일 모든 피부 타입의 필수 습관이에요.', xp: 15,
};

/**
 * 최신 분석 결과 기반으로 오늘의 미션 세트 생성
 * @param {Object} analysisResult - getLatestRecord() 결과
 * @returns {{ category, main, bonus, sourceMetric, sourceScore, sourceLabel }}
 */
export function getTodayMissions(analysisResult) {
  if (!analysisResult) return null;

  // 가장 낮은 점수 항목 찾기
  let weakest = null;
  for (const m of METRIC_TO_CATEGORY) {
    const score = analysisResult[m.key];
    if (typeof score !== 'number') continue;
    if (!weakest || score < weakest.score) {
      weakest = { ...m, score };
    }
  }

  // 카테고리 결정
  let category = '기본';
  let sourceMetric = null;
  let sourceScore = null;
  let sourceLabel = null;

  if (weakest && weakest.score < 65) {
    category = weakest.category;
    sourceMetric = weakest.key;
    sourceScore = weakest.score;
    sourceLabel = weakest.label;
  }

  const missions = MISSION_DATABASE[category];
  const bonus = [...missions.bonus];

  // 자외선 차단 보너스 미션 보장
  const hasUV = bonus.some(b => b.icon === '☀️');
  if (!hasUV) {
    bonus.push(UV_BONUS);
  }

  return {
    category,
    main: { ...missions.main },
    bonus: bonus.map((b, i) => ({ ...b, id: i })),
    sourceMetric,
    sourceScore,
    sourceLabel,
  };
}

export { MISSION_DATABASE };

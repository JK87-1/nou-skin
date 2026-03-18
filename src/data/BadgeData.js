/**
 * 뱃지 & 레벨 시스템 데이터
 */

const BADGE_DATABASE = {
  streak: {
    label: '꾸준함', icon: '🔥', color: '#fbbf24',
    badges: [
      { id: 'streak_3', icon: '🔥', name: '3일 연속', desc: '3일 연속 측정 완료', condition: { type: 'streak', value: 3 } },
      { id: 'streak_7', icon: '🔥', name: '7일 연속', desc: '7일 연속 측정 완료', condition: { type: 'streak', value: 7 } },
      { id: 'streak_14', icon: '🔥', name: '14일 연속', desc: '14일 연속 측정 완료', condition: { type: 'streak', value: 14 } },
      { id: 'streak_30', icon: '🔥', name: '30일 연속', desc: '30일 연속 측정 완료', condition: { type: 'streak', value: 30 } },
      { id: 'streak_100', icon: '💎', name: '100일 연속', desc: '100일 연속 측정! 전설의 시작', condition: { type: 'streak', value: 100 } },
    ],
  },
  score: {
    label: '점수 달성', icon: '⭐', color: '#a78bfa',
    badges: [
      { id: 'score_60', icon: '⭐', name: '60점 돌파', desc: '종합 점수 60점 이상 달성', condition: { type: 'score', value: 60 } },
      { id: 'score_70', icon: '⭐', name: '70점 돌파', desc: '종합 점수 70점 이상 달성', condition: { type: 'score', value: 70 } },
      { id: 'score_80', icon: '🌟', name: '80점 돌파', desc: '종합 점수 80점 이상 달성', condition: { type: 'score', value: 80 } },
      { id: 'score_90', icon: '💫', name: '90점 돌파', desc: '종합 점수 90점 이상 달성', condition: { type: 'score', value: 90 } },
    ],
  },
  improvement: {
    label: '피부 개선', icon: '📈', color: '#34d399',
    badges: [
      { id: 'improve_5', icon: '📈', name: '첫 번째 변화', desc: '종합 점수 5점 이상 상승', condition: { type: 'improvement', value: 5 } },
      { id: 'improve_10', icon: '📈', name: '10점 상승', desc: '종합 점수 10점 이상 상승', condition: { type: 'improvement', value: 10 } },
      { id: 'improve_20', icon: '🚀', name: '대변신', desc: '종합 점수 20점 이상 상승', condition: { type: 'improvement', value: 20 } },
      { id: 'skinAge_3', icon: '⏳', name: '시간 역행', desc: '피부나이 3세 이상 감소', condition: { type: 'skinAge', value: 3 } },
      { id: 'skinAge_5', icon: '⏳', name: '회춘의 비밀', desc: '피부나이 5세 이상 감소', condition: { type: 'skinAge', value: 5 } },
    ],
  },
  mission: {
    label: '미션 달인', icon: '🎯', color: '#f472b6',
    badges: [
      { id: 'mission_10', icon: '🎯', name: '미션 10회', desc: '미션 10회 완료', condition: { type: 'missionCount', value: 10 } },
      { id: 'mission_30', icon: '🎯', name: '미션 30회', desc: '미션 30회 완료', condition: { type: 'missionCount', value: 30 } },
      { id: 'mission_50', icon: '🎯', name: '미션 50회', desc: '미션 50회 완료', condition: { type: 'missionCount', value: 50 } },
      { id: 'allclear_5', icon: '🏆', name: '올클리어 ×5', desc: '하루 미션 전체 완료 5회', condition: { type: 'allClear', value: 5 } },
      { id: 'allclear_20', icon: '🏆', name: '올클리어 ×20', desc: '하루 미션 전체 완료 20회', condition: { type: 'allClear', value: 20 } },
    ],
  },
  special: {
    label: '특별 뱃지', icon: '💎', color: '#38bdf8',
    badges: [
      { id: 'first_analysis', icon: '🪞', name: '첫 측정', desc: '첫 번째 피부 분석 완료', condition: { type: 'measureCount', value: 1 } },
      { id: 'moisture_master', icon: '💧', name: '수분 마스터', desc: '수분 점수 80점 이상 달성', condition: { type: 'itemScore', item: 'moisture', value: 80 } },
      { id: 'consult_10', icon: '💬', name: '상담 매니아', desc: 'AI 상담 10회 이용', condition: { type: 'consultCount', value: 10 } },
      { id: 'night_owl', icon: '🌙', name: '나이트 케어', desc: '밤 10시 이후 측정 5회', condition: { type: 'nightMeasure', value: 5 } },
      { id: 'share_first', icon: '📤', name: '소문내기', desc: '첫 번째 결과 공유', condition: { type: 'shareCount', value: 1 } },
    ],
  },
};

const LEVEL_TITLES = [
  { level: 1, title: '피부 초보', minXP: 0 },
  { level: 5, title: '스킨케어 입문자', minXP: 500 },
  { level: 10, title: '스킨케어 루키', minXP: 2000 },
  { level: 15, title: '뷰티 마스터', minXP: 4000 },
  { level: 20, title: '스킨 전문가', minXP: 7000 },
  { level: 25, title: '피부 과학자', minXP: 11000 },
  { level: 30, title: '글로우 레전드', minXP: 16000 },
];

/**
 * XP → 레벨 계산 (200 XP당 1레벨)
 */
export function calculateLevel(totalXP) {
  return Math.floor(totalXP / 200) + 1;
}

/**
 * 레벨에 해당하는 칭호 반환
 */
export function getLevelTitle(level) {
  let title = LEVEL_TITLES[0].title;
  for (const lt of LEVEL_TITLES) {
    if (level >= lt.level) title = lt.title;
    else break;
  }
  return title;
}

export { BADGE_DATABASE, LEVEL_TITLES };

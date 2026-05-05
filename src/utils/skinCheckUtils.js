/**
 * 피부 체크 점수 계산 + 패턴 분석 유틸리티
 */

const CONDITION_IMPACT = {
  bad: -25,
  normal: -10,
  okay: 0,
  glowing: 10,
};

const SIGNAL_IMPACT = {
  new_trouble: -8,
  dry: -5,
  oily: -3,
  puffy: -3,
  redness: -5,
  sensitive: -5,
  dull: -3,
};

export function calculateSkinScore(input) {
  if (!input || !input.overallCondition) return null;

  let score = 100;

  // 컨디션 반영
  score += CONDITION_IMPACT[input.overallCondition] || 0;

  // 신호별 감점
  (input.signals || []).forEach(signal => {
    score += SIGNAL_IMPACT[signal] || 0;
  });

  // 위치 가중치
  if ((input.locations || []).includes('all_over')) {
    score -= 5;
  } else if ((input.locations || []).length > 1) {
    score -= 2 * ((input.locations || []).length - 1);
  }

  return Math.max(0, Math.min(100, score));
}

export function getScoreState(score) {
  if (score >= 75) return 'good';
  if (score >= 60) return 'signals';
  return 'needs_care';
}

export function getScoreStatusText(score) {
  if (score >= 90) return '컨디션 최고';
  if (score >= 75) return '컨디션 좋아요';
  if (score >= 60) return '신호 있음';
  return '관리 필요';
}

export function getTopImpactSignals(signals) {
  const signalLabels = {
    new_trouble: '새 트러블',
    dry: '건조함',
    oily: '번들거림',
    puffy: '붓기',
    redness: '홍조',
    sensitive: '예민함',
    dull: '칙칙함',
  };

  const impactOrder = ['new_trouble', 'redness', 'sensitive', 'dry', 'puffy', 'oily', 'dull'];

  const sorted = (signals || [])
    .filter(s => impactOrder.includes(s))
    .sort((a, b) => impactOrder.indexOf(a) - impactOrder.indexOf(b))
    .slice(0, 2)
    .map(s => signalLabels[s]);

  if (sorted.length === 0) return '';
  if (sorted.length === 1) return `${sorted[0]}이 영향을 주고 있어요`;
  return `${sorted[0]} + ${sorted[1]}이 영향을 주고 있어요`;
}

export function getDotColors(score, signals) {
  const activeCount = score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 45 ? 2 : 1;

  const hasTrouble = (signals || []).some(s => ['new_trouble', 'redness', 'sensitive'].includes(s));
  const hasDry = (signals || []).some(s => ['dry', 'oily'].includes(s));

  const dots = [];
  for (let i = 0; i < 5; i++) {
    if (i >= activeCount) {
      dots.push('rgba(74, 107, 133, 0.2)');
    } else if (hasTrouble && i >= activeCount - 2) {
      dots.push('rgba(217, 124, 94, 0.6)');
    } else if (hasDry && i >= activeCount - 1) {
      dots.push('rgba(184, 134, 92, 0.5)');
    } else {
      dots.push('rgba(94, 157, 138, 0.5)');
    }
  }
  return dots;
}

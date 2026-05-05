/**
 * 카페인 5단계 상태 계산 유틸리티
 */

export function calculateCaffeineState(todayTotalMg, userWeightKg, pendingAdditionMg = 0) {
  const limit = userWeightKg ? userWeightKg * 5 : 400;
  const projected = todayTotalMg + pendingAdditionMg;
  const percent = Math.min((projected / limit) * 100, 100);

  let stage, status, statusColor, gaugeColor;

  if (projected < 50) {
    stage = 1;
    status = '차분한 시작이에요';
    statusColor = '#2E6E5A';
    gaugeColor = '#5E9D8A';
  } else if (projected < 150) {
    stage = 2;
    status = '오늘 적당해요';
    statusColor = '#6B4A2A';
    gaugeColor = 'linear-gradient(90deg, #5E9D8A, #B8865C)';
  } else if (projected < 200) {
    stage = 3;
    status = '적정선이에요';
    statusColor = '#8A5A3C';
    gaugeColor = 'linear-gradient(90deg, #5E9D8A 0%, #B8865C 60%)';
  } else if (projected < limit) {
    stage = 4;
    status = '많이 마셨어요';
    statusColor = '#8A4A3C';
    gaugeColor = 'linear-gradient(90deg, #5E9D8A 0%, #B8865C 50%, #C97C5E 100%)';
  } else {
    stage = 5;
    status = '과하게 마신 편이에요';
    statusColor = '#791F1F';
    gaugeColor = 'linear-gradient(90deg, #5E9D8A 0%, #B8865C 35%, #C97C5E 70%, #A32D2D 100%)';
  }

  return {
    currentMg: todayTotalMg,
    projectedMg: projected,
    limitMg: Math.round(limit),
    percent,
    stage,
    status,
    statusColor,
    gaugeColor,
    remainingText: projected < limit
      ? `${Math.round(limit - projected)}mg 더 마실 수 있어요`
      : '오늘은 충분해요',
  };
}

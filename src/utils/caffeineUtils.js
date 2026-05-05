/**
 * 카페인 적정량 계산 유틸리티
 */

export function calculateCaffeineState(todayTotalMg, userWeightKg, pendingAdditionMg = 0) {
  const limit = userWeightKg ? userWeightKg * 5 : 400;
  const projected = todayTotalMg + pendingAdditionMg;
  const percent = Math.min((projected / limit) * 100, 200);

  let status, statusColor, gaugeColor;

  if (percent < 50) {
    status = '여유 있어요';
    statusColor = '#5E9D8A';
    gaugeColor = 'linear-gradient(90deg, #5E9D8A, #B8865C)';
  } else if (percent < 80) {
    status = '적정 수준';
    statusColor = '#B8865C';
    gaugeColor = '#B8865C';
  } else if (percent < 100) {
    status = '곧 한도 도달';
    statusColor = '#C97C5E';
    gaugeColor = '#C97C5E';
  } else {
    status = '한도 초과';
    statusColor = '#A32D2D';
    gaugeColor = '#A32D2D';
  }

  const remaining = Math.max(0, limit - projected);

  return {
    currentMg: todayTotalMg,
    projectedMg: projected,
    limitMg: limit,
    percent: Math.min(percent, 100),
    status,
    statusColor,
    gaugeColor,
    remainingText: remaining > 0
      ? `권장 한도까지 ${Math.round(remaining)}mg 남음`
      : `오늘은 충분해요`,
  };
}

/**
 * 수분 권장량 자동 계산
 */
export function calculateWaterGoal(weight, activityLevel = 'moderate') {
  if (!weight || weight <= 0) {
    return { dailyMl: 2000, cups: 8, display: '2,000ml', subDisplay: '하루 · 250ml 기준 8잔' };
  }

  let base = weight * 35;

  if (activityLevel === 'high') base += 500;
  else if (activityLevel === 'low') base -= 200;

  const rounded = Math.round(base / 250) * 250;
  const final = Math.max(1500, Math.min(3500, rounded));
  const cups = final / 250;

  return {
    dailyMl: final,
    cups,
    display: `${final.toLocaleString()}ml`,
    subDisplay: `하루 · 250ml 기준 ${cups}잔`,
  };
}

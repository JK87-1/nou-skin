/**
 * 생리주기 계산 유틸리티
 * 다른 화면(달력·모달)에서도 재사용 가능
 */

const CYCLE_KEY = 'lua_cycle_data';

export function getCycleData() {
  try {
    const raw = localStorage.getItem(CYCLE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function saveCycleData(data) {
  try {
    localStorage.setItem(CYCLE_KEY, JSON.stringify(data));
  } catch {}
}

function diffDays(a, b) {
  const msDay = 86400000;
  return Math.round((a.getTime() - b.getTime()) / msDay);
}

/**
 * 주기 상태 계산
 * @returns {{ state, daysUntil?, currentDay?, stage?, label, subtitle, bgStyle }}
 */
export function calculateCycleState(cycleData, today = new Date()) {
  if (!cycleData || !cycleData.lastPeriodStart) {
    return { state: 'unset', label: '시작하기', subtitle: '30초만 입력하면 분석이 깊어져요' };
  }

  const lastStart = new Date(cycleData.lastPeriodStart);
  const cycleLength = cycleData.averageCycleLength || 28;
  const periodLength = cycleData.averagePeriodLength || 5;
  const daysSinceStart = diffDays(today, lastStart);

  // 생리 중
  if (daysSinceStart >= 0 && daysSinceStart < periodLength) {
    return {
      state: 'active',
      currentDay: daysSinceStart + 1,
      stage: 'menstrual',
      label: `${daysSinceStart + 1}일째`,
      subtitle: '생리 중 · 푹 쉬세요',
    };
  }

  // 다음 생리까지 남은 날
  const nextStart = new Date(lastStart);
  nextStart.setDate(nextStart.getDate() + cycleLength);
  const daysUntilNext = diffDays(nextStart, today);

  // 예정일 지남
  if (daysUntilNext < 0) {
    return {
      state: 'imminent',
      daysUntil: 0,
      stage: 'luteal_late',
      label: `D+${Math.abs(daysUntilNext)}`,
      subtitle: '예정일이 지났어요',
    };
  }

  // 임박 (D-1 ~ D-3)
  if (daysUntilNext >= 1 && daysUntilNext <= 3) {
    return {
      state: 'imminent',
      daysUntil: daysUntilNext,
      stage: 'luteal_late',
      label: `D-${daysUntilNext}`,
      subtitle: '곧 시작될 수 있어요',
    };
  }

  // 가까워짐 (D-4 ~ D-7)
  if (daysUntilNext >= 4 && daysUntilNext <= 7) {
    return {
      state: 'approaching',
      daysUntil: daysUntilNext,
      stage: 'luteal_early',
      label: `D-${daysUntilNext}`,
      subtitle: '황체기 진입',
    };
  }

  // 평소 (D-8 이상)
  const daysSincePeriodEnd = daysSinceStart - periodLength;
  let stage, subtitle;

  if (daysSincePeriodEnd <= 8) {
    stage = 'follicular';
    subtitle = `난포기 ${daysSincePeriodEnd}일째`;
  } else if (daysUntilNext >= 12 && daysUntilNext <= 14) {
    stage = 'ovulation';
    subtitle = '배란기';
  } else if (daysUntilNext >= 8 && daysUntilNext < 12) {
    stage = 'luteal_early';
    subtitle = '황체기';
  } else {
    stage = 'follicular';
    subtitle = `난포기 ${daysSincePeriodEnd}일째`;
  }

  return {
    state: 'normal',
    daysUntil: daysUntilNext,
    stage,
    label: `D-${daysUntilNext}`,
    subtitle,
  };
}

export function getActivePosition(stage) {
  switch (stage) {
    case 'menstrual': return 0;
    case 'follicular': return 1;
    case 'ovulation': return 2;
    case 'luteal_early': return 3;
    case 'luteal_late': return 4;
    default: return 1;
  }
}

export function getCycleBgStyle(state) {
  switch (state) {
    case 'approaching': return 'rgba(255, 240, 244, 0.6)';
    case 'imminent': return 'rgba(252, 230, 235, 0.7)';
    case 'active': return 'rgba(248, 215, 222, 0.8)';
    default: return 'rgba(255, 255, 255, 0.2)';
  }
}

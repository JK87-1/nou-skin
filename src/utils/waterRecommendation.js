/**
 * 시간대별 수분 권장량 계산 및 분석 메시지 생성
 */

function parseTime(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m; // 분 단위
}

function minToHours(min) { return min / 60; }

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

// 시간대별 권장량 계산
export function calculateHourlyRecommendation(wakeTime = '07:00', sleepTime = '23:00', dailyGoal = 2000) {
  const wake = parseTime(wakeTime);
  let sleepMin = parseTime(sleepTime);
  // 자정 넘김 처리: 취침이 기상보다 이르면 다음 날로 간주
  if (sleepMin <= wake) sleepMin += 24 * 60;
  const cutoff = sleepMin - 120; // 취침 2시간 전
  const totalMin = cutoff - wake;
  if (totalMin <= 0) return null;

  const totalHours = minToHours(totalMin);

  // 구간 경계 (분 단위)
  const activeEnd = wake + totalMin * 0.3;
  const stableEnd = wake + totalMin * 0.7;

  // 각 구간 시간 (시간 단위)
  const activeDur = totalHours * 0.3;
  const stableDur = totalHours * 0.4;
  const decelDur = totalHours * 0.3;

  // 정규화
  const totalWeighted = activeDur * 1.3 + stableDur * 1.0 + decelDur * 0.6;
  const norm = dailyGoal / totalWeighted;

  return {
    phases: {
      active: { start: wake, end: activeEnd, hourlyMl: clamp(norm * 1.3, 50, 250) },
      stable: { start: activeEnd, end: stableEnd, hourlyMl: clamp(norm * 1.0, 50, 250) },
      decel: { start: stableEnd, end: cutoff, hourlyMl: clamp(norm * 0.6, 50, 250) },
    },
    cutoffTime: cutoff,
    wakeTime: wake,
  };
}

// 현재 시각의 이상 누적량
export function calculateIdealCumulative(currentMin, rec) {
  if (!rec) return 0;
  const { phases } = rec;
  let total = 0;

  // 활성기
  if (currentMin > phases.active.start) {
    const elapsed = minToHours(Math.min(currentMin, phases.active.end) - phases.active.start);
    total += elapsed * phases.active.hourlyMl;
  }
  // 안정기
  if (currentMin > phases.stable.start) {
    const elapsed = minToHours(Math.min(currentMin, phases.stable.end) - phases.stable.start);
    total += elapsed * phases.stable.hourlyMl;
  }
  // 감속기
  if (currentMin > phases.decel.start) {
    const elapsed = minToHours(Math.min(currentMin, phases.decel.end) - phases.decel.start);
    total += elapsed * phases.decel.hourlyMl;
  }

  return total;
}

// 현재 구간 판별
export function getCurrentPhase(currentMin, rec) {
  if (!rec) return 'before_start';
  const { phases } = rec;
  if (currentMin < phases.active.start) return 'before_start';
  if (currentMin <= phases.active.end) return 'active';
  if (currentMin <= phases.stable.end) return 'stable';
  if (currentMin <= rec.cutoffTime) return 'decel';
  return 'decel'; // 컷오프 이후도 감속기 메시지
}

// 진행률 분류
export function calculateProgressStatus(actualMl, idealMl) {
  if (idealMl <= 0) return 'before_start';
  const ratio = (actualMl / idealMl) * 100;
  if (ratio < 50) return 'insufficient';
  if (ratio < 80) return 'slightly_low';
  if (ratio <= 120) return 'adequate';
  return 'abundant';
}

// 메시지 템플릿
const MESSAGES = {
  before_start: '곧 하루가 시작돼요. 첫 잔으로 깨워보세요.',
  insufficient: {
    active: '오전인데 수분이 부족해요. 한 잔 챙겨보세요.',
    stable: '오후가 시작됐어요. 수분이 조금 부족하니 한 잔 더 챙기세요.',
    decel: '저녁이지만 오늘 수분이 부족했네요. 마지막 한 잔 챙겨보세요.',
  },
  slightly_low: {
    active: '조금만 더 마시면 좋아요. 한 잔 추가해보세요.',
    stable: '수분 페이스가 약간 느려요. 한 잔 챙겨보세요.',
    decel: '곧 수분 컷오프 시간이에요. 마지막 한 잔 어떠세요?',
  },
  adequate: {
    active: '좋은 페이스예요. 이대로 꾸준히 가요.',
    stable: '수분 페이스가 안정적이에요.',
    decel: '오늘 수분 잘 챙기셨네요. 곧 마무리 시간이에요.',
  },
  abundant: {
    active: '이미 충분히 마셨어요. 페이스가 빠르니 오후엔 천천히 분산해보세요.',
    stable: '오늘 수분 페이스가 빨라요. 저녁엔 천천히 마셔도 돼요.',
    decel: '오늘 수분 충분해요. 곧 컷오프 시간이니 더 마시지 않아도 좋아요.',
  },
};

// 통합 메시지 생성
export function generateWaterAnalysis(waterMl, now = new Date()) {
  // 사용자 프로필에서 기상/취침 시간과 목표 가져오기
  let wakeTime = '07:00', sleepTime = '23:00', dailyGoal = 2000;
  try {
    const rec = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayRec = rec[todayKey] || {};
    if (todayRec.sleep?.wakeTime) {
      const wt = todayRec.sleep.wakeTime;
      wakeTime = wt.length <= 5 ? wt : wt.slice(11, 16);
    }
    if (todayRec.sleep?.bedtime) {
      const bt = todayRec.sleep.bedtime;
      sleepTime = bt.length <= 5 ? bt : bt.slice(11, 16);
    }
    const ws = JSON.parse(localStorage.getItem('lua_water_settings') || '{}');
    if (ws.goalMl) dailyGoal = ws.goalMl;
  } catch { /* defaults */ }

  const rec = calculateHourlyRecommendation(wakeTime, sleepTime, dailyGoal);
  if (!rec) return null;

  const currentMin = now.getHours() * 60 + now.getMinutes();
  const idealMl = calculateIdealCumulative(currentMin, rec);
  const phase = getCurrentPhase(currentMin, rec);
  const status = calculateProgressStatus(waterMl, idealMl);

  let message;
  if (status === 'before_start') {
    message = MESSAGES.before_start;
  } else {
    message = MESSAGES[status]?.[phase] || MESSAGES[status]?.stable || '';
  }

  return {
    message,
    status,
    phase,
    actualMl: waterMl,
    idealMl: Math.round(idealMl),
    progressRatio: idealMl > 0 ? Math.round((waterMl / idealMl) * 100) : 0,
  };
}

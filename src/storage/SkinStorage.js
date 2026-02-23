/**
 * NOU Skin Storage v1.0
 * 
 * localStorage 기반 피부 기록 시스템
 * - 측정 결과 저장/조회/삭제
 * - 주간 변화 계산
 * - 동기부여 코멘트 생성
 * - 연속 측정 스트릭 관리
 * 
 * Phase 2에서 Supabase로 마이그레이션 시 이 인터페이스 유지
 */

const STORAGE_KEY = 'nou_skin_records';
const STREAK_KEY = 'nou_skin_streak';
const THUMB_KEY = 'nou_skin_thumbs';
const MAX_RECORDS = 52; // 1년치 주간 기록

function getLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ===== CORE CRUD =====

export function saveRecord(result) {
  const records = getRecords();
  const today = getLocalDateStr(); // YYYY-MM-DD

  // 같은 날 기록이 있으면 최신으로 덮어쓰기
  const existingIdx = records.findIndex(r => r.date === today);

  const record = {
    date: today,
    timestamp: Date.now(),
    skinAge: result.skinAge,
    overallScore: result.overallScore,
    moisture: result.moisture,
    skinTone: result.skinTone,
    wrinkleScore: result.wrinkleScore,
    poreScore: result.poreScore,
    elasticityScore: result.elasticityScore,
    pigmentationScore: result.pigmentationScore,
    textureScore: result.textureScore,
    darkCircleScore: result.darkCircleScore,
    troubleCount: result.troubleCount,
    oilBalance: result.oilBalance,
    skinType: result.skinType,
    concerns: result.concerns,
  };

  if (existingIdx >= 0) {
    records[existingIdx] = record;
  } else {
    records.push(record);
  }

  // 오래된 기록 제한
  if (records.length > MAX_RECORDS) {
    records.splice(0, records.length - MAX_RECORDS);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    updateStreak(today);
    return true;
  } catch (e) {
    console.warn('NOU: localStorage save failed', e);
    return false;
  }
}

export function getRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLatestRecord() {
  const records = getRecords();
  return records.length > 0 ? records[records.length - 1] : null;
}

export function getPreviousRecord() {
  const records = getRecords();
  return records.length > 1 ? records[records.length - 2] : null;
}

export function getRecordCount() {
  return getRecords().length;
}

export function deleteRecord(date) {
  const records = getRecords().filter(r => r.date !== date);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function clearAllRecords() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STREAK_KEY);
  localStorage.removeItem(THUMB_KEY);
}

// ===== THUMBNAIL STORAGE =====

/**
 * 사진 축소 썸네일 생성 (80x80 JPEG, ~3-5KB)
 * localStorage에 저장하여 갤러리/여정에서 사용
 */
export function saveThumbnail(dateStr, imageDataUrl) {
  if (!imageDataUrl) return;
  try {
    const thumbs = JSON.parse(localStorage.getItem(THUMB_KEY) || '{}');
    // Canvas로 80x80 리사이즈
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 200;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // 중앙 크롭
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2;
      const sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      thumbs[dateStr] = canvas.toDataURL('image/jpeg', 0.7);
      // 오래된 썸네일 정리
      const keys = Object.keys(thumbs).sort();
      while (keys.length > MAX_RECORDS) {
        delete thumbs[keys.shift()];
      }
      localStorage.setItem(THUMB_KEY, JSON.stringify(thumbs));
    };
    img.src = imageDataUrl;
  } catch (e) {
    console.warn('NOU: thumbnail save failed', e);
  }
}

export function getThumbnail(dateStr) {
  try {
    const thumbs = JSON.parse(localStorage.getItem(THUMB_KEY) || '{}');
    return thumbs[dateStr] || null;
  } catch {
    return null;
  }
}

export function getAllThumbnails() {
  try {
    return JSON.parse(localStorage.getItem(THUMB_KEY) || '{}');
  } catch {
    return {};
  }
}

// ===== TODAY HELPERS =====

export function getTodayRecord() {
  const today = getLocalDateStr();
  const records = getRecords();
  return records.find(r => r.date === today) || null;
}

export function hasTodayRecord() {
  return getTodayRecord() !== null;
}

// ===== STREAK (연속 측정) =====

function updateStreak(today) {
  try {
    const streak = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}');
    const lastDate = streak.lastDate || '';
    const lastStreak = streak.count || 0;

    // 지난주 날짜 계산 (7일 전 ~ 오늘 범위)
    const todayMs = new Date(today).getTime();
    const lastMs = lastDate ? new Date(lastDate).getTime() : 0;
    const daysDiff = Math.floor((todayMs - lastMs) / (1000 * 60 * 60 * 24));

    let newCount;
    if (daysDiff === 0) {
      newCount = lastStreak; // 같은 날 재측정
    } else if (daysDiff >= 5 && daysDiff <= 9) {
      // 주간 측정 범위 (5~9일 간격 = 주 1회)
      newCount = lastStreak + 1;
    } else if (daysDiff < 5) {
      newCount = lastStreak; // 너무 빠른 재측정 — 스트릭 유지
    } else {
      newCount = 1; // 10일+ 공백 — 스트릭 리셋
    }

    localStorage.setItem(STREAK_KEY, JSON.stringify({
      count: newCount,
      lastDate: today,
      bestStreak: Math.max(newCount, streak.bestStreak || 0),
    }));
  } catch {}
}

export function getStreak() {
  try {
    const streak = JSON.parse(localStorage.getItem(STREAK_KEY) || '{}');
    return {
      count: streak.count || 0,
      bestStreak: streak.bestStreak || 0,
      lastDate: streak.lastDate || null,
    };
  } catch {
    return { count: 0, bestStreak: 0, lastDate: null };
  }
}

// ===== CHANGE CALCULATION =====

/**
 * 직전 기록 대비 변화량 계산
 * @returns {Object|null} { metric: { prev, curr, diff, improved } } or null
 */
export function getChanges() {
  const records = getRecords();
  if (records.length < 2) return null;

  const curr = records[records.length - 1];
  const prev = records[records.length - 2];

  const metrics = [
    { key: 'skinAge',           label: '피부나이',  unit: '세',  icon: '🎂', inverse: true },
    { key: 'overallScore',      label: '종합점수',  unit: '점',  icon: '⭐' },
    { key: 'moisture',          label: '수분도',    unit: '%',   icon: '💧' },
    { key: 'skinTone',          label: '피부톤',    unit: '점',  icon: '✨' },
    { key: 'wrinkleScore',      label: '주름',      unit: '점',  icon: '📐' },
    { key: 'poreScore',         label: '모공',      unit: '점',  icon: '🔬' },
    { key: 'elasticityScore',   label: '탄력',      unit: '점',  icon: '💎' },
    { key: 'pigmentationScore', label: '색소',      unit: '점',  icon: '🎨' },
    { key: 'textureScore',      label: '피부결',    unit: '점',  icon: '🧴' },
    { key: 'darkCircleScore',   label: '다크서클',  unit: '점',  icon: '👁️' },
    { key: 'oilBalance',        label: '유분',      unit: '%',   icon: '🫧' },
  ];

  const changes = {};
  for (const m of metrics) {
    const prevVal = prev[m.key] ?? 0;
    const currVal = curr[m.key] ?? 0;
    const diff = currVal - prevVal;
    // inverse: 피부나이는 줄어야 개선
    const improved = m.inverse ? diff < 0 : diff > 0;
    changes[m.key] = { ...m, prev: prevVal, curr: currVal, diff, improved };
  }

  return changes;
}

/**
 * EMA 시간 평활 변화량 (노이즈 제거)
 * alpha=0.4: 최근 측정에 40% 가중, 이전 누적에 60% 가중
 * 측정 간 조명/컨디션 차이로 인한 일시적 변동을 완화하여 추세를 정확히 표시
 */
export function getSmoothedChanges(alpha = 0.4) {
  const records = getRecords();
  if (records.length < 2) return null;

  const metrics = [
    { key: 'skinAge',           label: '피부나이',  unit: '세',  icon: '🎂', inverse: true },
    { key: 'overallScore',      label: '종합점수',  unit: '점',  icon: '⭐' },
    { key: 'moisture',          label: '수분도',    unit: '%',   icon: '💧' },
    { key: 'skinTone',          label: '피부톤',    unit: '점',  icon: '✨' },
    { key: 'wrinkleScore',      label: '주름',      unit: '점',  icon: '📐' },
    { key: 'poreScore',         label: '모공',      unit: '점',  icon: '🔬' },
    { key: 'elasticityScore',   label: '탄력',      unit: '점',  icon: '💎' },
    { key: 'pigmentationScore', label: '색소',      unit: '점',  icon: '🎨' },
    { key: 'textureScore',      label: '피부결',    unit: '점',  icon: '🧴' },
    { key: 'darkCircleScore',   label: '다크서클',  unit: '점',  icon: '👁️' },
    { key: 'oilBalance',        label: '유분',      unit: '%',   icon: '🫧' },
  ];

  const changes = {};
  for (const m of metrics) {
    // EMA up to previous record
    let prevEma = records[0][m.key] ?? 0;
    for (let i = 1; i < records.length - 1; i++) {
      prevEma = alpha * (records[i][m.key] ?? 0) + (1 - alpha) * prevEma;
    }
    // EMA including latest record
    const currEma = alpha * (records[records.length - 1][m.key] ?? 0) + (1 - alpha) * prevEma;
    const diff = Math.round(currEma - prevEma);
    const improved = m.inverse ? diff < 0 : diff > 0;
    changes[m.key] = { ...m, prev: Math.round(prevEma), curr: Math.round(currEma), diff, improved };
  }

  return changes;
}

/**
 * 전체 기간 변화 (첫 기록 → 최신 기록)
 */
export function getTotalChanges() {
  const records = getRecords();
  if (records.length < 2) return null;

  const first = records[0];
  const last = records[records.length - 1];

  return {
    skinAge: last.skinAge - first.skinAge,
    overallScore: last.overallScore - first.overallScore,
    moisture: last.moisture - first.moisture,
    period: Math.ceil((new Date(last.date) - new Date(first.date)) / (1000*60*60*24)),
    totalRecords: records.length,
    startDate: first.date,
  };
}

// ===== GRAPH DATA =====

/**
 * 시계열 데이터 (그래프용)
 * @param {string} metricKey - e.g. 'skinAge', 'moisture', 'overallScore'
 * @returns {Array} [{ date, value, label }]
 */
export function getTimeSeries(metricKey = 'skinAge') {
  return getRecords().map(r => ({
    date: r.date,
    value: r[metricKey] ?? 0,
    label: formatDate(r.date),
  }));
}

/**
 * 모든 지표의 최신 vs 이전 비교 (레이더 차트용)
 */
export function getComparisonData() {
  const records = getRecords();
  if (records.length < 2) return null;

  const curr = records[records.length - 1];
  const prev = records[records.length - 2];

  const keys = ['moisture','skinTone','wrinkleScore','poreScore','elasticityScore','pigmentationScore','textureScore','darkCircleScore'];
  const labels = ['수분','피부톤','주름','모공','탄력','색소','피부결','다크서클'];

  return keys.map((k, i) => ({
    label: labels[i],
    curr: curr[k] ?? 0,
    prev: prev[k] ?? 0,
  }));
}

// ===== MOTIVATIONAL FEEDBACK =====

/**
 * 체중계의 "잘하고 있어요!" 같은 동기부여 메시지
 */
export function getMotivation() {
  const records = getRecords();
  const streak = getStreak();
  const changes = getChanges();
  const total = getTotalChanges();

  // 첫 측정
  if (records.length === 0) {
    return {
      emoji: '🌟',
      title: '첫 피부 측정을 시작하세요!',
      body: '매주 한 번 측정하면 피부 변화를 눈으로 확인할 수 있어요.',
      cta: '지금 측정하기',
    };
  }

  // 1회 측정 완료
  if (records.length === 1) {
    return {
      emoji: '🎯',
      title: '기준점이 설정되었어요!',
      body: '다음 주에 다시 측정하면 변화를 비교할 수 있어요. 7일 후에 만나요!',
      cta: null,
    };
  }

  // 변화 기반 메시지
  if (!changes) return { emoji: '📊', title: '기록을 확인하세요', body: '', cta: null };

  const skinAgeDiff = changes.skinAge.diff;
  const overallDiff = changes.overallScore.diff;
  const improvedCount = Object.values(changes).filter(c => c.improved && Math.abs(c.diff) >= 2).length;

  // 피부나이 감소 (최고의 결과)
  if (skinAgeDiff <= -3) {
    return {
      emoji: '🏆',
      title: `피부나이 ${Math.abs(skinAgeDiff)}세 감소!`,
      body: `놀라운 변화예요! ${streak.count >= 3 ? `${streak.count}주 연속 측정의 성과가 나타나고 있어요.` : '꾸준히 측정하면 더 큰 변화를 확인할 수 있어요.'}`,
      cta: null,
    };
  }
  if (skinAgeDiff <= -1) {
    return {
      emoji: '🎉',
      title: `피부나이 ${Math.abs(skinAgeDiff)}세 젊어졌어요!`,
      body: `${improvedCount}개 지표가 개선됐어요. ${getBestImprovement(changes)}`,
      cta: null,
    };
  }

  // 종합점수 상승
  if (overallDiff >= 3) {
    return {
      emoji: '📈',
      title: `종합점수 +${overallDiff}점 상승!`,
      body: `${getBestImprovement(changes)} 이 조 가 계속되면 피부나이도 곧 줄어들 거예요.`,
      cta: null,
    };
  }

  // 개별 지표 개선
  if (improvedCount >= 3) {
    return {
      emoji: '💪',
      title: `${improvedCount}개 지표가 개선됐어요!`,
      body: getBestImprovement(changes),
      cta: null,
    };
  }

  // 유지 (변화 미미)
  if (Math.abs(skinAgeDiff) <= 1 && Math.abs(overallDiff) <= 2) {
    return {
      emoji: '✊',
      title: '피부 상태 유지 중',
      body: `현재 컨디션을 잘 유지하고 있어요. ${getWeakestPoint(changes)}`,
      cta: null,
    };
  }

  // 악화
  if (skinAgeDiff >= 2) {
    return {
      emoji: '💡',
      title: '이번 주는 피부가 조금 힘들었나봐요',
      body: `피부나이가 ${skinAgeDiff}세 올랐지만 걱정 마세요. ${getWeakestPoint(changes)} 다음 주에 다시 도전!`,
      cta: null,
    };
  }

  // 스트릭 기반
  if (streak.count >= 4) {
    return {
      emoji: '🔥',
      title: `${streak.count}주 연속 측정!`,
      body: `꾸준함이 최고의 스킨케어예요. ${total ? `첫 측정 대비 종합점수 ${total.overallScore > 0 ? '+' : ''}${total.overallScore}점.` : ''}`,
      cta: null,
    };
  }

  return {
    emoji: '📊',
    title: '피부 변화를 추적 중이에요',
    body: `${records.length}회 측정 완료. 매주 꾸준히 측정하면 패턴이 보여요.`,
    cta: null,
  };
}

function getBestImprovement(changes) {
  const improved = Object.values(changes)
    .filter(c => c.improved && c.key !== 'overallScore' && c.key !== 'skinAge')
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  if (improved.length === 0) return '';
  const best = improved[0];
  const direction = best.inverse ? '감소' : '상승';
  return `특히 ${best.icon} ${best.label}이 ${Math.abs(best.diff)}${best.unit} ${direction}했어요!`;
}

function getWeakestPoint(changes) {
  const weakened = Object.values(changes)
    .filter(c => !c.improved && Math.abs(c.diff) >= 2 && c.key !== 'overallScore' && c.key !== 'skinAge')
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  if (weakened.length === 0) return '모든 지표가 안정적이에요.';
  const worst = weakened[0];
  return `${worst.icon} ${worst.label} 관리에 집중해보세요.`;
}

// ===== NEXT MEASUREMENT REMINDER =====

export function getNextMeasurementInfo() {
  const latest = getLatestRecord();
  if (!latest) return { dueIn: 0, isOverdue: false, message: '첫 측정을 시작하세요!' };

  const lastMs = new Date(latest.date).getTime();
  const nowMs = Date.now();
  const daysSince = Math.floor((nowMs - lastMs) / (1000 * 60 * 60 * 24));
  const dueIn = 7 - daysSince;

  if (dueIn > 3) return { dueIn, isOverdue: false, message: `다음 측정까지 ${dueIn}일` };
  if (dueIn > 0) return { dueIn, isOverdue: false, message: `${dueIn}일 후 측정하면 정확한 비교가 가능해요!` };
  if (dueIn === 0) return { dueIn: 0, isOverdue: false, message: '오늘이 측정일이에요! 📸' };
  return { dueIn, isOverdue: true, message: `측정일이 ${Math.abs(dueIn)}일 지났어요. 지금 측정하세요!` };
}

// ===== SHARE DATA =====

export function generateShareText(result) {
  const records = getRecords();
  const streak = getStreak();
  const changes = getChanges();

  let text = `🧬 NOU 피부 나이: ${result.skinAge}세 (종합 ${result.overallScore}점)`;

  if (changes && changes.skinAge.diff !== 0) {
    const diff = changes.skinAge.diff;
    text += `\n${diff < 0 ? `📉 지난주 대비 ${Math.abs(diff)}세 젊어짐!` : `📈 지난주 대비 ${diff}세 변화`}`;
  }

  if (streak.count >= 2) {
    text += `\n🔥 ${streak.count}주 연속 측정 중`;
  }

  if (records.length >= 2) {
    const total = getTotalChanges();
    if (total && total.skinAge < 0) {
      text += `\n✨ ${total.period}일간 피부나이 ${Math.abs(total.skinAge)}세 감소`;
    }
  }

  text += '\n\n셀카 한 장으로 피부 나이 측정 → skin.nou.kr';
  return text;
}

// ===== UTILS =====

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth()+1}/${d.getDate()}`;
}

export function formatDateFull(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

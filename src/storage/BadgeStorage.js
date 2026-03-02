/**
 * 뱃지 & XP 시스템 스토리지 (localStorage)
 * 접두사: lua_badge_
 */

import { BADGE_DATABASE, calculateLevel } from '../data/BadgeData';
import { getRecords, getStreak } from './SkinStorage';

const XP_KEY = 'lua_badge_xp';
const XP_LOG_KEY = 'lua_badge_xp_log';
const BADGES_KEY = 'lua_badge_earned';
const STATS_KEY = 'lua_badge_stats';

// ===== XP =====

/**
 * XP 추가
 * @returns {{ totalXP, prevLevel, newLevel, levelUp }}
 */
export function addXP(amount, reason) {
  const prev = getTotalXP();
  const prevLevel = calculateLevel(prev);
  const next = prev + amount;
  localStorage.setItem(XP_KEY, String(next));

  // 이력 저장 (최근 100건)
  const log = getXPLog();
  log.push({ amount, reason, date: new Date().toISOString() });
  while (log.length > 100) log.shift();
  localStorage.setItem(XP_LOG_KEY, JSON.stringify(log));

  const newLevel = calculateLevel(next);
  return { totalXP: next, prevLevel, newLevel, levelUp: newLevel > prevLevel };
}

/**
 * 누적 XP
 */
export function getTotalXP() {
  return parseInt(localStorage.getItem(XP_KEY) || '0', 10);
}

/**
 * 현재 레벨
 */
export function getLevel() {
  return calculateLevel(getTotalXP());
}

/**
 * 현재 레벨 내 진행률 (0~100)
 */
export function getLevelProgress() {
  const xp = getTotalXP();
  const level = calculateLevel(xp);
  const currentLevelXP = (level - 1) * 200;
  const nextLevelXP = level * 200;
  return Math.min(100, Math.round(((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100));
}

function getXPLog() {
  try {
    return JSON.parse(localStorage.getItem(XP_LOG_KEY) || '[]');
  } catch {
    return [];
  }
}

// ===== BADGES =====

function getEarnedBadgesRaw() {
  try {
    return JSON.parse(localStorage.getItem(BADGES_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * 조건 확인 후 뱃지 자동 부여
 * @returns {{ newBadges: Array<{ id, icon, name, desc }> }}
 */
export function checkAndAwardBadges() {
  const earned = getEarnedBadgesRaw();
  const stats = getStats();
  const records = getRecords();
  const streak = getStreak();
  const newBadges = [];

  const latestRecord = records.length > 0 ? records[records.length - 1] : null;
  const firstRecord = records.length > 0 ? records[0] : null;

  // 점수 개선 계산
  let improvement = 0;
  let skinAgeImprovement = 0;
  if (firstRecord && latestRecord && records.length >= 2) {
    improvement = (latestRecord.overallScore || 0) - (firstRecord.overallScore || 0);
    skinAgeImprovement = (firstRecord.skinAge || 0) - (latestRecord.skinAge || 0); // 감소가 긍정적
  }

  const allBadges = [];
  for (const cat of Object.values(BADGE_DATABASE)) {
    for (const badge of cat.badges) {
      allBadges.push(badge);
    }
  }

  for (const badge of allBadges) {
    if (earned[badge.id]) continue;

    const { type, value, item } = badge.condition;
    let met = false;

    switch (type) {
      case 'streak':
        met = streak.count >= value;
        break;
      case 'score':
        met = latestRecord && (latestRecord.overallScore || 0) >= value;
        break;
      case 'improvement':
        met = improvement >= value;
        break;
      case 'skinAge':
        met = skinAgeImprovement >= value;
        break;
      case 'missionCount':
        met = (stats.totalMissions || 0) >= value;
        break;
      case 'allClear':
        met = (stats.allClearCount || 0) >= value;
        break;
      case 'measureCount':
        met = records.length >= value;
        break;
      case 'itemScore':
        met = latestRecord && (latestRecord[item] || 0) >= value;
        break;
      case 'consultCount':
        met = (stats.consultCount || 0) >= value;
        break;
      case 'nightMeasure':
        met = (stats.nightMeasure || 0) >= value;
        break;
      case 'shareCount':
        met = (stats.shareCount || 0) >= value;
        break;
    }

    if (met) {
      earned[badge.id] = { date: new Date().toISOString() };
      newBadges.push(badge);
      // 뱃지 획득 보너스 XP
      addXP(100, `뱃지 획득: ${badge.name}`);
    }
  }

  if (newBadges.length > 0) {
    localStorage.setItem(BADGES_KEY, JSON.stringify(earned));
  }

  return { newBadges };
}

/**
 * 획득한 뱃지 목록 + 날짜
 */
export function getEarnedBadges() {
  const earned = getEarnedBadgesRaw();
  const result = [];
  for (const cat of Object.values(BADGE_DATABASE)) {
    for (const badge of cat.badges) {
      if (earned[badge.id]) {
        result.push({ ...badge, earnedDate: earned[badge.id].date });
      }
    }
  }
  return result;
}

/**
 * 특정 뱃지 진행률 (0~1)
 */
export function getBadgeProgress(badgeId) {
  const stats = getStats();
  const records = getRecords();
  const streak = getStreak();
  const latestRecord = records.length > 0 ? records[records.length - 1] : null;
  const firstRecord = records.length > 0 ? records[0] : null;

  let badge = null;
  for (const cat of Object.values(BADGE_DATABASE)) {
    badge = cat.badges.find(b => b.id === badgeId);
    if (badge) break;
  }
  if (!badge) return 0;

  const { type, value, item } = badge.condition;
  let current = 0;

  switch (type) {
    case 'streak': current = streak.count; break;
    case 'score': current = latestRecord ? (latestRecord.overallScore || 0) : 0; break;
    case 'improvement':
      current = (firstRecord && latestRecord && records.length >= 2)
        ? (latestRecord.overallScore || 0) - (firstRecord.overallScore || 0) : 0;
      break;
    case 'skinAge':
      current = (firstRecord && latestRecord && records.length >= 2)
        ? (firstRecord.skinAge || 0) - (latestRecord.skinAge || 0) : 0;
      break;
    case 'missionCount': current = stats.totalMissions || 0; break;
    case 'allClear': current = stats.allClearCount || 0; break;
    case 'measureCount': current = records.length; break;
    case 'itemScore': current = latestRecord ? (latestRecord[item] || 0) : 0; break;
    case 'consultCount': current = stats.consultCount || 0; break;
    case 'nightMeasure': current = stats.nightMeasure || 0; break;
    case 'shareCount': current = stats.shareCount || 0; break;
  }

  return { current: Math.max(0, current), target: value, progress: Math.min(1, Math.max(0, current) / value) };
}

/**
 * 전체 뱃지 목록 + earned/progress 정보
 */
export function getAllBadgesWithStatus() {
  const earned = getEarnedBadgesRaw();
  const result = {};

  for (const [catKey, cat] of Object.entries(BADGE_DATABASE)) {
    result[catKey] = {
      label: cat.label,
      icon: cat.icon,
      color: cat.color,
      badges: cat.badges.map(badge => {
        const isEarned = !!earned[badge.id];
        const progressData = isEarned
          ? { current: badge.condition.value, target: badge.condition.value, progress: 1 }
          : getBadgeProgress(badge.id);
        return {
          ...badge,
          earned: isEarned,
          earnedDate: earned[badge.id]?.date || null,
          ...progressData,
        };
      }),
    };
  }

  return result;
}

// ===== STATS =====

function getStatsRaw() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * 통계 카운터 증가
 */
export function incrementStat(statName, amount = 1) {
  const stats = getStatsRaw();
  stats[statName] = (stats[statName] || 0) + amount;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  return stats[statName];
}

/**
 * 전체 통계 반환
 */
export function getStats() {
  const stats = getStatsRaw();
  const records = getRecords();
  const streak = getStreak();

  return {
    totalMeasurements: records.length,
    totalMissions: stats.totalMissions || 0,
    allClearCount: stats.allClearCount || 0,
    streak: streak.count,
    consultCount: stats.consultCount || 0,
    shareCount: stats.shareCount || 0,
    nightMeasure: stats.nightMeasure || 0,
    ...stats,
  };
}

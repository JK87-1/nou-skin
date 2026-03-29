/**
 * 몸무게 기록 스토리지 (localStorage)
 * 접두사: lua_body_
 */

const RECORDS_KEY = 'lua_body_records';
const GOAL_KEY = 'lua_body_goal';
const PROFILE_KEY = 'lua_body_profile';

export function getBodyRecords() {
  return JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
}

export function saveBodyRecord(weight) {
  const records = getBodyRecords();
  const today = new Date().toISOString().slice(0, 10);
  const existing = records.findIndex(r => r.date === today);
  if (existing >= 0) {
    records[existing].weight = weight;
  } else {
    records.push({ date: today, weight, timestamp: Date.now() });
  }
  records.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  return records;
}

export function deleteBodyRecord(date) {
  const records = getBodyRecords().filter(r => r.date !== date);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  return records;
}

export function getBodyGoal() {
  return JSON.parse(localStorage.getItem(GOAL_KEY) || 'null');
}

export function saveBodyGoal(goal) {
  localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
}

export function getBodyProfile() {
  return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{"height":165}');
}

export function saveBodyProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function calcBMI(weight, heightCm) {
  if (!weight || !heightCm) return null;
  const m = heightCm / 100;
  return (weight / (m * m)).toFixed(1);
}

export function getLatestWeight() {
  const records = getBodyRecords();
  return records.length > 0 ? records[records.length - 1] : null;
}

export function getStartWeight() {
  const records = getBodyRecords();
  return records.length > 0 ? records[0] : null;
}

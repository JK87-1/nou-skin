import { getLatestRecord } from './SkinStorage';

const GOAL_KEY = 'nou_skin_goal';

const METRIC_META = [
  { key: 'moisture', label: '수분도', icon: '💧' },
  { key: 'skinTone', label: '피부톤', icon: '✨' },
  { key: 'wrinkleScore', label: '주름', icon: '📐' },
  { key: 'poreScore', label: '모공', icon: '🔬' },
  { key: 'elasticityScore', label: '탄력', icon: '💎' },
  { key: 'pigmentationScore', label: '색소', icon: '🎨' },
  { key: 'textureScore', label: '피부결', icon: '🧴' },
  { key: 'darkCircleScore', label: '다크서클', icon: '👁️' },
  { key: 'oilBalance', label: '유분', icon: '🫧' },
];

export { METRIC_META };

export function getGoal() {
  try {
    const raw = localStorage.getItem(GOAL_KEY);
    if (!raw) return null;
    const goal = JSON.parse(raw);
    // Auto-expire
    if (goal.status === 'active' && goal.endDate) {
      const now = new Date();
      const end = new Date(goal.endDate);
      if (now > end) {
        goal.status = 'expired';
        localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
      }
    }
    return goal;
  } catch {
    return null;
  }
}

export function saveGoal(goal) {
  try {
    localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
    return true;
  } catch {
    return false;
  }
}

export function clearGoal() {
  localStorage.removeItem(GOAL_KEY);
}

export function updateGoalProgress(scores) {
  const goal = getGoal();
  if (!goal || goal.status !== 'active') return { updated: false };

  let allAchieved = true;
  for (const metric of goal.metrics) {
    // Use provided scores first, fallback to latest record
    const val = scores?.[metric.key];
    if (typeof val === 'number') {
      metric.currentValue = val;
    }
    if (metric.currentValue < metric.targetValue) {
      allAchieved = false;
    }
  }

  if (allAchieved) {
    goal.status = 'completed';
    goal.completedAt = new Date().toISOString();
  }

  saveGoal(goal);
  return { updated: true, achieved: allAchieved, goal };
}

export function getGoalProgress() {
  const goal = getGoal();
  if (!goal) return null;

  // Always use latest measurement for accurate current values
  const latest = getLatestRecord();

  return goal.metrics.map((m) => {
    const currentValue = (latest && typeof latest[m.key] === 'number')
      ? latest[m.key]
      : m.currentValue;
    const range = m.targetValue - m.startValue;
    const progress = range <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(((currentValue - m.startValue) / range) * 100)));
    return { ...m, currentValue, progress };
  });
}

export function getDaysRemaining() {
  const goal = getGoal();
  if (!goal || !goal.endDate) return null;
  const now = new Date();
  const end = new Date(goal.endDate);
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

export function getOverallProgress() {
  const metrics = getGoalProgress();
  if (!metrics || metrics.length === 0) return 0;
  return Math.round(metrics.reduce((sum, m) => sum + m.progress, 0) / metrics.length);
}

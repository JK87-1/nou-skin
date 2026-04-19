import { getGoal, getGoalProgress, getDaysRemaining, getOverallProgress } from '../storage/GoalStorage';
import { TargetIcon, PastelIcon } from './icons/PastelIcons';

const ENCOURAGEMENT = [
  { max: 25, msg: '시작이 반이에요! 꾸준히 해봐요' },
  { max: 50, msg: '잘하고 있어요! 조금만 더 힘내요' },
  { max: 75, msg: '절반을 넘었어요! 변화가 보이죠?' },
  { max: 99, msg: '거의 다 왔어요! 목표가 코앞이에요' },
  { max: 100, msg: '축하해요! 목표를 달성했어요!' },
];

export default function GoalProgressCard({ onTap }) {
  const goal = getGoal();
  if (!goal || goal.status === 'expired') return null;

  const metrics = getGoalProgress();
  const overall = getOverallProgress();
  const isCompleted = goal.status === 'completed';

  return (
    <div
      onClick={onTap}
      style={{
        margin: '0 20px',
        padding: '20px',
        borderRadius: 16,
        background: 'var(--bg-card)',
        boxShadow: 'none',
        cursor: onTap ? 'pointer' : 'default',
        animation: 'breatheIn 0.5s ease both',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--context-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}><TargetIcon size={18} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>이번 주 목표</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            {metrics?.[0]?.label || '수분'} {metrics?.[0]?.currentValue || '?'} → {metrics?.[0]?.targetValue || '?'}
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: isCompleted ? 'var(--accent-success)' : 'var(--accent-primary)', flexShrink: 0 }}>
          {overall}%
        </div>
      </div>
      {/* Single progress bar */}
      <div style={{ height: 6, borderRadius: 3, background: 'var(--progress-track)', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(100, overall)}%`,
          height: '100%', borderRadius: 3,
          background: isCompleted
            ? 'linear-gradient(90deg, #89cef5, #10b981)'
            : 'var(--progress-fill)',
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}

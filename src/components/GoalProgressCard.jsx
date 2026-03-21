import { getGoal, getGoalProgress, getDaysRemaining, getOverallProgress } from '../storage/GoalStorage';
import { TargetIcon, PastelIcon } from './icons/PastelIcons';

const ENCOURAGEMENT = [
  { max: 25, msg: '시작이 반이에요! 꾸준히 해봐요' },
  { max: 50, msg: '잘하고 있어요! 조금만 더 힘내요' },
  { max: 75, msg: '절반을 넘었어요! 변화가 보이죠?' },
  { max: 99, msg: '거의 다 왔어요! 목표가 코앞이에요' },
  { max: 100, msg: '축하해요! 목표를 달성했어요!' },
];

export default function GoalProgressCard({ onTap, colorMode }) {
  const goal = getGoal();
  if (!goal || goal.status === 'expired') return null;

  const metrics = getGoalProgress();
  const daysLeft = getDaysRemaining();
  const overall = getOverallProgress();
  const isCompleted = goal.status === 'completed';
  const isLight = colorMode === 'light';

  const encouragement = ENCOURAGEMENT.find((e) => overall <= e.max) || ENCOURAGEMENT[ENCOURAGEMENT.length - 1];

  /* ── Light mode: compact Toss-style (icon + title + %) ── */
  if (isLight) {
    return (
      <div
        onClick={onTap}
        style={{
          margin: '0 20px',
          padding: '20px',
          borderRadius: 16,
          background: '#FFFFFF',
          boxShadow: 'none',
          cursor: onTap ? 'pointer' : 'default',
          animation: 'breatheIn 0.5s ease both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(124,92,252,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}><TargetIcon size={18} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#8B95A1' }}>이번 주 목표</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#191F28' }}>
              {metrics?.[0]?.label || '수분'} {metrics?.[0]?.currentValue || '?'} → {metrics?.[0]?.targetValue || '?'}
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: isCompleted ? '#34d399' : '#81E4BD', flexShrink: 0 }}>
            {overall}%
          </div>
        </div>
        {/* Single progress bar */}
        <div style={{ height: 6, borderRadius: 3, background: '#F2F3F5', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, overall)}%`,
            height: '100%', borderRadius: 3,
            background: isCompleted
              ? 'linear-gradient(90deg, #34d399, #10b981)'
              : 'linear-gradient(90deg, #81E4BD, #81E4BD)',
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>
    );
  }

  /* ── Dark mode: original detailed view ── */
  return (
    <div
      onClick={onTap}
      style={{
        margin: '0 20px 12px',
        padding: '20px',
        borderRadius: 22,
        background: 'var(--bg-card)',
        backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
        border: '1px solid var(--border-light)',
        cursor: onTap ? 'pointer' : 'default',
        animation: 'breatheIn 0.5s ease both',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, display: 'inline-flex', verticalAlign: 'middle' }}><TargetIcon size={15} /></span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>나의 피부 목표</span>
        </div>
        {daysLeft !== null && !isCompleted && (
          <span style={{
            padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
            background: daysLeft <= 7 ? 'rgba(240,96,80,0.12)' : 'rgba(240,144,112,0.12)',
            color: daysLeft <= 7 ? '#e05545' : '#ADEBB3',
          }}>D-{daysLeft}</span>
        )}
        {isCompleted && (
          <span style={{
            padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
            background: 'rgba(52,211,153,0.12)', color: '#34d399',
          }}>달성 완료</span>
        )}
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {metrics && metrics.map((m) => {
          const achieved = m.progress >= 100;
          return (
            <div key={m.key}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, display: 'inline-flex', verticalAlign: 'middle' }}><PastelIcon emoji={m.icon} size={13} /></span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{m.label}</span>
                </div>
                <span style={{ fontSize: 11, color: achieved ? '#34d399' : 'var(--text-muted)', fontWeight: 400 }}>
                  {m.currentValue} → {m.targetValue}
                  {achieved && ' ✓'}
                </span>
              </div>
              <div style={{
                width: '100%', height: 6, borderRadius: 3,
                background: 'var(--bg-card-hover)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(100, m.progress)}%`,
                  height: '100%', borderRadius: 3,
                  background: achieved
                    ? 'linear-gradient(90deg, #34d399, #10b981)'
                    : 'linear-gradient(90deg, #E87080, #81E4BD, #81E4BD)',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 14, paddingTop: 12,
        borderTop: '1px solid var(--border-separator)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 300 }}>
          {encouragement.msg}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: isCompleted ? '#34d399' : '#ADEBB3',
        }}>{overall}%</span>
      </div>
    </div>
  );
}

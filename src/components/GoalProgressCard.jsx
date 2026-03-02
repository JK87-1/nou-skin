import { getGoal, getGoalProgress, getDaysRemaining, getOverallProgress } from '../storage/GoalStorage';

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
  const daysLeft = getDaysRemaining();
  const overall = getOverallProgress();
  const isCompleted = goal.status === 'completed';

  const encouragement = ENCOURAGEMENT.find((e) => overall <= e.max) || ENCOURAGEMENT[ENCOURAGEMENT.length - 1];

  return (
    <div
      onClick={onTap}
      style={{
        margin: '0 20px 16px',
        padding: '20px',
        borderRadius: 22,
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.06)',
        cursor: onTap ? 'pointer' : 'default',
        animation: 'breatheIn 0.5s ease both',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>🎯</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f5' }}>나의 피부 목표</span>
        </div>
        {daysLeft !== null && !isCompleted && (
          <span style={{
            padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
            background: daysLeft <= 7 ? 'rgba(240,96,80,0.12)' : 'rgba(167,139,250,0.12)',
            color: daysLeft <= 7 ? '#e05545' : '#818cf8',
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
                  <span style={{ fontSize: 13 }}>{m.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#e0e0e8' }}>{m.label}</span>
                </div>
                <span style={{ fontSize: 11, color: achieved ? '#34d399' : '#8888a0', fontWeight: 400 }}>
                  {m.currentValue} → {m.targetValue}
                  {achieved && ' ✓'}
                </span>
              </div>
              {/* Progress bar */}
              <div style={{
                width: '100%', height: 6, borderRadius: 3,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(100, m.progress)}%`,
                  height: '100%', borderRadius: 3,
                  background: achieved
                    ? 'linear-gradient(90deg, #34d399, #10b981)'
                    : 'linear-gradient(90deg, #6858a8, #9080c8, #a78bfa)',
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
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: '#8888a0', fontWeight: 300 }}>
          {encouragement.msg}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700,
          color: isCompleted ? '#34d399' : '#818cf8',
        }}>{overall}%</span>
      </div>
    </div>
  );
}

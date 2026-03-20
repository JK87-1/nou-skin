/**
 * 피부 점수 원형 표시 (홈 탭)
 * 평면 그라데이션 오브 + 은은한 움직임 효과
 * 레몬 80% · 민트 20% · 하늘 10% 그라데이션
 */
import { useState, useEffect } from 'react';

const orbKeyframes = `
@keyframes orbGradientShift {
  0%   { background-position: 0% 50%; }
  25%  { background-position: 100% 25%; }
  50%  { background-position: 50% 100%; }
  75%  { background-position: 0% 75%; }
  100% { background-position: 0% 50%; }
}
@keyframes orbGlow {
  0%, 100% { box-shadow: 0 0 40px rgba(250,240,140,0.25), 0 0 80px rgba(250,240,140,0.08); }
  50%      { box-shadow: 0 0 50px rgba(186,230,210,0.3), 0 0 90px rgba(186,230,210,0.1); }
}
`;

export default function SkinScoreCircle({ score, change, onTap }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (score == null) return null;

  return (
    <>
      <style>{orbKeyframes}</style>
      <div onClick={onTap} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: onTap ? 'pointer' : 'default', marginTop: 28, padding: '0 20px',
      }}>
        <div className="section-label" style={{ marginBottom: 14 }}>TODAY'S CONDITION</div>
        <div style={{ position: 'relative', width: 160, height: 160 }}>
          {/* 평면 그라데이션 오브 */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FDF6B2 0%, #FAF08C 30%, #D4F5E0 65%, #BAE6D2 80%, #B8E4F0 95%)',
            backgroundSize: '300% 300%',
            animation: 'orbGradientShift 8s ease-in-out infinite, orbGlow 6s ease-in-out infinite',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'scale(1)' : 'scale(0.9)',
            transition: 'opacity 0.8s ease, transform 0.8s ease',
          }} />

          {/* 내부 은은한 레이어 */}
          <div style={{
            position: 'absolute', inset: '8px', borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.5) 0%, rgba(253,246,178,0.2) 40%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* 중앙 텍스트 */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 42, fontWeight: 300, color: '#1a1a2e', lineHeight: 1,
              fontFamily: "'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif",
              opacity: 0.85,
            }}>{score}</span>
            <span style={{
              fontSize: 10, color: '#4a5568', marginTop: 4, letterSpacing: 1, opacity: 0.7,
            }}>skin score</span>
          </div>
        </div>

        {/* 변화량 표시 */}
        {change != null && change !== 0 && (
          <div style={{
            marginTop: 12,
            fontSize: 12, fontWeight: 600,
            color: change > 0 ? '#4ade80' : '#F0B870',
          }}>
            지난주 대비 {change > 0 ? '+' : ''}{change}점
          </div>
        )}
      </div>
    </>
  );
}

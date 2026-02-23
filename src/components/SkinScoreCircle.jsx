/**
 * 피부 점수 원형 표시 (홈 탭)
 * 큰 숫자 + "skin score" 라벨 + 회전 링 애니메이션 + 지난주 대비 변화
 */
import { useState, useEffect } from 'react';

export default function SkinScoreCircle({ score, change, onTap }) {
  const [offset, setOffset] = useState(314);
  const radius = 50;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(circumference - (score / 100) * circumference);
    }, 300);
    return () => clearTimeout(timer);
  }, [score, circumference]);

  if (score == null) return null;

  return (
    <div onClick={onTap} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      cursor: onTap ? 'pointer' : 'default', marginTop: 28, padding: '0 20px',
    }}>
      <div className="section-label" style={{ marginBottom: 14 }}>TODAY'S CONDITION</div>
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        {/* 은은하게 회전하는 외곽 링 */}
        <svg width="140" height="140" style={{
          position: 'absolute', top: 0, left: 0,
          animation: 'ringRotate 20s linear infinite',
        }}>
          <defs>
            <linearGradient id="homeScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c4705a" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#d4856c" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#c4705a" stopOpacity="0.15" />
            </linearGradient>
          </defs>
          <circle cx="70" cy="70" r="65" fill="none" stroke="url(#homeScoreGrad)" strokeWidth="2"
            strokeDasharray="8 6" />
        </svg>

        {/* 점수 프로그레스 링 */}
        <svg width="140" height="140" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id="homeProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#c4705a" />
              <stop offset="100%" stopColor="#d4856c" />
            </linearGradient>
          </defs>
          <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(196,112,90,0.08)" strokeWidth="8" />
          <circle cx="70" cy="70" r={radius} fill="none" stroke="url(#homeProgressGrad)" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </svg>

        {/* 중앙 텍스트 */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 38, fontWeight: 300, color: '#5a4a40', lineHeight: 1,
            fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif",
          }}>{score}</span>
          <span style={{ fontSize: 10, color: '#a89888', marginTop: 4, letterSpacing: 1 }}>skin score</span>
        </div>
      </div>

      {/* 변화량 표시 */}
      {change != null && change !== 0 && (
        <div style={{
          marginTop: 10,
          fontSize: 12, fontWeight: 600,
          color: change > 0 ? '#8aad8c' : '#d4a040',
        }}>
          지난주 대비 {change > 0 ? '+' : ''}{change}점
        </div>
      )}
    </div>
  );
}

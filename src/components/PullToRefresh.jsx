// 토스증권 스타일 pull-to-refresh.
// document body 기반 — 페이지 최상위 wrap. window.scrollY===0일 때만 발동.
// 풍선 인디케이터만 상단에 띄움 (children 자체는 안 움직임 → fixed 요소 영향 X).
// 임계치(THRESHOLD) 넘기고 손가락 떼면 onRefresh 콜백(기본 window.location.reload).
import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 72;     // 이만큼 당기면 트리거
const MAX_PULL = 130;     // 풍선이 더 이상 안 내려오는 한계
const RESISTANCE = 2.4;   // 손가락 이동 대비 풍선 이동 비율 (작을수록 잘 따라옴)

export default function PullToRefresh({ onRefresh, children, color = '#6598ef' }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const active = useRef(false);
  const pullYRef = useRef(0);

  useEffect(() => { pullYRef.current = pullY; }, [pullY]);

  const handleTouchStart = (e) => {
    if (refreshing) return;
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    active.current = true;
  };

  const handleTouchMove = (e) => {
    if (!active.current || startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      setPullY(0);
      return;
    }
    // 스크롤이 위로 벗어났으면 즉시 cancel
    if (window.scrollY > 0) {
      active.current = false;
      setPullY(0);
      return;
    }
    const pulled = Math.min(MAX_PULL, dy / RESISTANCE);
    setPullY(pulled);
  };

  const handleTouchEnd = async () => {
    if (!active.current) {
      startY.current = null;
      return;
    }
    active.current = false;
    if (pullYRef.current >= THRESHOLD) {
      setRefreshing(true);
      try {
        const result = onRefresh?.();
        if (result && typeof result.then === 'function') await result;
      } catch {}
      // 시각 피드백 — 살짝 멈췄다가 reload (location.reload 기본 동작)
      setTimeout(() => {
        setRefreshing(false);
        setPullY(0);
      }, 380);
    } else {
      setPullY(0);
    }
    startY.current = null;
  };

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [refreshing]);

  const visible = pullY > 4 || refreshing;
  const progress = Math.min(pullY / THRESHOLD, 1);
  const reached = pullY >= THRESHOLD;
  // 풍선 위치: 위(-40px)에서 살짝 내려오는 형태
  const topPx = visible ? Math.min(pullY * 0.55, 60) - 14 : -50;

  return (
    <>
      {/* 풍선 인디케이터 — 상단 위쪽에서 떨어짐. children 자체는 안 움직임 → fixed/sticky 요소 안전 */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top: `calc(env(safe-area-inset-top, 0px) + ${topPx}px)`,
          left: 0, right: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          pointerEvents: 'none',
          zIndex: 99998,
          transition: refreshing || pullY === 0 ? 'top 0.32s cubic-bezier(0.34,1.2,0.6,1)' : 'none',
        }}
      >
        <Balloon
          color={color}
          progress={progress}
          reached={reached}
          refreshing={refreshing}
        />
      </div>
      {children}
    </>
  );
}

function Balloon({ color, progress, reached, refreshing }) {
  // 풍선 회전·흔들림: refreshing 중엔 부드럽게 떠다님
  const baseColor = '#cdd5e0';
  const fill = reached || refreshing ? color : baseColor;
  const opacity = reached || refreshing ? 1 : (0.4 + progress * 0.55);
  const scale = 0.7 + progress * 0.3;

  return (
    <div style={{
      width: 46, height: 62,
      transform: `scale(${refreshing ? 1 : scale})`,
      transformOrigin: 'top center',
      transition: refreshing ? 'transform 0.3s ease' : 'none',
      animation: refreshing ? 'tossPtrFloat 1.6s ease-in-out infinite' : 'none',
    }}>
      <style>{`
        @keyframes tossPtrFloat {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-6px) rotate(3deg); }
        }
      `}</style>
      <svg width="46" height="62" viewBox="0 0 46 62" fill="none">
        {/* 풍선 본체 */}
        <ellipse cx="23" cy="22" rx="18" ry="20" fill={fill} fillOpacity={opacity} />
        {/* 풍선 꼭지 (아래 작은 삼각) */}
        <path d="M20.5 41 L23 44 L25.5 41 Z" fill={fill} fillOpacity={opacity} />
        {/* 끈 — 약간 곡선 */}
        <path
          d="M23 44 Q21 50 23 56 Q25 60 23 62"
          stroke={fill}
          strokeOpacity={opacity * 0.85}
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
        {/* highlight */}
        <ellipse cx="17" cy="15" rx="4" ry="6" fill="rgba(255,255,255,0.5)" opacity={opacity} />
      </svg>
    </div>
  );
}

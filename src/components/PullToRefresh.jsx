// 토스증권 스타일 pull-to-refresh.
// document body 기반 — 페이지 최상위 wrap. window.scrollY===0일 때만 발동.
// 풍선 인디케이터만 상단에 띄움 (children 자체는 안 움직임 → fixed 요소 영향 X).
// 임계치(THRESHOLD) 넘기고 손가락 떼면 onRefresh 콜백(기본 window.location.reload).
import { useEffect, useRef, useState } from 'react';
import { hapticLight, hapticSelection } from '../utils/haptics';

const THRESHOLD = 72;     // 이만큼 당기면 트리거
const MAX_PULL = 130;     // 풍선이 더 이상 안 내려오는 한계
const RESISTANCE = 2.4;   // 손가락 이동 대비 풍선 이동 비율 (작을수록 잘 따라옴)

export default function PullToRefresh({ onRefresh, children, color = 'var(--accent-primary)' }) {
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

  const reachedRef = useRef(false);
  const handleTouchMove = (e) => {
    if (!active.current || startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      setPullY(0);
      reachedRef.current = false;
      return;
    }
    // 스크롤이 위로 벗어났으면 즉시 cancel
    if (window.scrollY > 0) {
      active.current = false;
      setPullY(0);
      reachedRef.current = false;
      return;
    }
    const pulled = Math.min(MAX_PULL, dy / RESISTANCE);
    setPullY(pulled);
    // 임계 도달 순간 1회 selection 진동 (토스도 이 시점에 톡 느낌)
    const nowReached = pulled >= THRESHOLD;
    if (nowReached && !reachedRef.current) {
      reachedRef.current = true;
      hapticSelection();
    } else if (!nowReached && reachedRef.current) {
      reachedRef.current = false;
    }
  };

  const handleTouchEnd = async () => {
    if (!active.current) {
      startY.current = null;
      return;
    }
    active.current = false;
    reachedRef.current = false;
    if (pullYRef.current >= THRESHOLD) {
      hapticLight(); // 트리거 순간 무게감
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
        <div style={{ position: 'relative', width: 36, height: 36 }}>
          {/* 글로우 링 — luastar 중심(44%, 50%)에 맞춤 */}
          {(reached || refreshing) && (
            <div style={{
              position: 'absolute',
              top: '50%', left: '44%',
              width: 60, height: 60,
              borderRadius: '50%',
              border: 'none',
              transform: 'translate(-50%, -50%)',
              animation: 'luaPtrGlow 1.5s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          )}
          <LuaStarIndicator
            progress={progress}
            reached={reached}
            refreshing={refreshing}
          />
        </div>
      </div>
      {children}
    </>
  );
}

function LuaStarIndicator({ progress, reached, refreshing }) {
  const visible = progress > 0.05 || refreshing;
  const opacity = reached || refreshing ? 1 : (0.3 + progress * 0.7);
  const scale = 0.5 + progress * 0.5;

  return (
    <div style={{
      width: 36, height: 36,
      position: 'relative',
      transformStyle: 'preserve-3d',
      transformOrigin: '44% 100%',
      transform: refreshing ? 'scale(1)' : `scale(${scale})`,
      transition: refreshing ? 'transform 0.3s ease' : 'none',
      animation: visible ? 'luaPtrFlip 1.5s ease-in-out infinite' : 'none',
      opacity,
      filter: reached || refreshing
        ? 'drop-shadow(0 0 12px rgba(168,216,255,0.5))'
        : 'none',
    }}>
      <style>{`
        @keyframes luaPtrFlip {
          0% { transform: scale(1) perspective(400px) rotateY(0deg); }
          50% { transform: scale(1.05) perspective(400px) rotateY(180deg); }
          100% { transform: scale(1) perspective(400px) rotateY(360deg); }
        }
        @keyframes luaPtrGlow {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          30% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          60% { transform: translate(-50%, -50%) scale(1.4); opacity: 0.2; }
          100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
        }
      `}</style>
      {/* 앞면 */}
      <img
        src="/luastar-ptr.svg"
        alt=""
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          backfaceVisibility: 'hidden',
        }}
      />
      {/* 뒷면 */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        backfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
        background: 'rgba(0,0,0,0.08)',
        borderRadius: '50%',
      }}>
        <img src="/luastar-ptr.svg" alt="" style={{ width: '100%', height: '100%', opacity: 0.15 }} />
      </div>
    </div>
  );
}

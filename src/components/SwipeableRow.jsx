import { useRef, useState, useEffect } from 'react';
import { hapticLight, hapticMedium } from '../utils/haptics';

/**
 * SwipeableRow — iOS Mail 스타일 좌·우 스와이프 액션.
 * 좌 스와이프(왼쪽으로 손가락): 우측에서 빨간 '삭제' 액션 reveal.
 * 우 스와이프(오른쪽으로 손가락): 좌측에서 ▲▼ 순서 변경 액션 reveal.
 *
 * 부드러움 디테일:
 *  - baseX(드래그 시작 시점 위치) 추적해 누적 위치 정확
 *  - bounds 넘으면 rubber-band 저항 (1/3 비율)
 *  - velocity 기반 결정 — 빠르게 휙 던지면 짧은 dx에도 open/close
 *  - open 시 미세 spring overshoot
 */
export default function SwipeableRow({
  onDelete,
  onMoveUp,
  onMoveDown,
  children,
  rowId,
  openRowId,
  setOpenRowId,
}) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(null);
  const startY = useRef(null);
  const baseX = useRef(0); // 드래그 시작 시점의 translateX
  const lastMoveX = useRef(0);
  const lastMoveT = useRef(0);
  const velocity = useRef(0);
  const decided = useRef(false);

  const DELETE_REVEAL = -84;
  const REORDER_REVEAL = 96;
  const DELETE_TRIGGER = -160;
  const DELETE_MAX = -210;
  const REORDER_MAX = 140;
  const isOpenSelf = openRowId === rowId;

  // 다른 row 열리면 close
  useEffect(() => {
    if (!isOpenSelf && translateX !== 0 && !isDragging) setTranslateX(0);
  }, [isOpenSelf, isDragging]); // eslint-disable-line

  const onTouchStart = (e) => {
    if (!e.touches?.length) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    baseX.current = translateX;
    lastMoveX.current = startX.current;
    lastMoveT.current = Date.now();
    velocity.current = 0;
    decided.current = false;
  };

  const onTouchMove = (e) => {
    if (startX.current == null) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - startX.current;
    const dy = y - startY.current;

    if (!decided.current) {
      // 작은 움직임은 무시 (탭 vs 드래그 결정 대기)
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      // 수직 우세 → 스크롤로 위임, 스와이프 무시
      if (Math.abs(dy) > Math.abs(dx) * 1.15) {
        startX.current = null;
        return;
      }
      decided.current = true;
      setIsDragging(true);
    }

    // velocity 추적 (px/ms)
    const now = Date.now();
    const dt = Math.max(1, now - lastMoveT.current);
    velocity.current = (x - lastMoveX.current) / dt;
    lastMoveX.current = x;
    lastMoveT.current = now;

    let next = baseX.current + dx;
    // rubber-band at bounds
    if (next < DELETE_MAX) next = DELETE_MAX + (next - DELETE_MAX) * 0.25;
    if (next > REORDER_MAX) next = REORDER_MAX + (next - REORDER_MAX) * 0.25;
    setTranslateX(next);
  };

  const onTouchEnd = () => {
    if (!decided.current) {
      startX.current = null;
      return;
    }
    setIsDragging(false);
    const v = velocity.current; // px/ms
    const FLING = 0.6; // 빠른 flick 임계

    // 빠른 좌측 flick → 즉시 삭제
    if (v < -FLING && onDelete) {
      hapticMedium();
      onDelete();
      setTranslateX(0);
      setOpenRowId?.(null);
    }
    // 깊이 쭉 좌 → 즉시 삭제
    else if (translateX <= DELETE_TRIGGER && onDelete) {
      hapticMedium();
      onDelete();
      setTranslateX(0);
      setOpenRowId?.(null);
    }
    // 좌 reveal (얕은 좌 스와이프 또는 좌측 flick 약함)
    else if ((translateX <= DELETE_REVEAL / 2 || (v < -0.2 && translateX < 0)) && onDelete) {
      setTranslateX(DELETE_REVEAL);
      setOpenRowId?.(rowId);
      hapticLight();
    }
    // 우 reveal
    else if ((translateX >= REORDER_REVEAL / 2 || (v > 0.2 && translateX > 0)) && (onMoveUp || onMoveDown)) {
      setTranslateX(REORDER_REVEAL);
      setOpenRowId?.(rowId);
      hapticLight();
    }
    // 그 외 close
    else {
      setTranslateX(0);
      setOpenRowId?.(null);
    }
    startX.current = null;
  };

  const closeRow = () => { setTranslateX(0); setOpenRowId?.(null); };

  // transition curve — 닫을 땐 ease-out-quad, 열 땐 약간의 spring overshoot
  const transitionCurve = isDragging
    ? 'none'
    : (translateX === 0
        ? 'transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)'
        : 'transform 0.38s cubic-bezier(0.22,1.18,0.36,1)'); // mild overshoot

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* 좌측 액션 (우 스와이프) — ▲▼ */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: REORDER_REVEAL,
        display: 'flex', alignItems: 'center', gap: 4,
        paddingLeft: 8,
        opacity: translateX > 4 ? 1 : 0,
        transition: isDragging ? 'none' : 'opacity 0.2s',
        pointerEvents: translateX > 4 ? 'auto' : 'none',
      }}>
        <button
          onClick={() => { if (onMoveUp) { hapticLight(); onMoveUp(); } closeRow(); }}
          disabled={!onMoveUp}
          aria-label="위로"
          style={{
            width: 40, height: 36, borderRadius: 10, border: 'none',
            background: onMoveUp ? 'rgba(101,152,239,0.9)' : 'rgba(0,0,0,0.08)',
            color: '#fff', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: onMoveUp ? 'pointer' : 'default',
            transform: translateX > 4 ? 'scale(1)' : 'scale(0.86)',
            transition: 'transform 0.22s cubic-bezier(0.32,0.72,0,1), background 0.15s',
            boxShadow: onMoveUp ? '0 2px 8px rgba(101,152,239,0.32)' : 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
        <button
          onClick={() => { if (onMoveDown) { hapticLight(); onMoveDown(); } closeRow(); }}
          disabled={!onMoveDown}
          aria-label="아래로"
          style={{
            width: 40, height: 36, borderRadius: 10, border: 'none',
            background: onMoveDown ? 'rgba(101,152,239,0.9)' : 'rgba(0,0,0,0.08)',
            color: '#fff', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: onMoveDown ? 'pointer' : 'default',
            transform: translateX > 4 ? 'scale(1)' : 'scale(0.86)',
            transition: 'transform 0.22s cubic-bezier(0.32,0.72,0,1) 30ms, background 0.15s',
            boxShadow: onMoveDown ? '0 2px 8px rgba(101,152,239,0.32)' : 'none',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      {/* 우측 액션 (좌 스와이프) — 삭제 */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: Math.abs(DELETE_REVEAL),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#ef4444',
        opacity: translateX < -4 ? 1 : 0,
        transition: isDragging ? 'none' : 'opacity 0.2s',
        pointerEvents: translateX < -4 ? 'auto' : 'none',
      }}>
        <button
          onClick={() => { hapticMedium(); onDelete?.(); closeRow(); }}
          aria-label="삭제"
          style={{
            width: '100%', height: '100%', border: 'none', background: 'transparent',
            color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            cursor: 'pointer', fontFamily: 'inherit',
            transform: translateX < -4 ? 'scale(1)' : 'scale(0.9)',
            transition: 'transform 0.22s cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
          삭제
        </button>
      </div>

      {/* 콘텐츠 */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClick={() => { if (isOpenSelf) closeRow(); }}
        style={{
          transform: `translate3d(${translateX}px, 0, 0)`,
          transition: transitionCurve,
          background: 'var(--card-bg, transparent)',
          willChange: 'transform',
          // 드래그 중 미세 lift
          boxShadow: isDragging && Math.abs(translateX) > 12
            ? '0 4px 18px rgba(0,0,0,0.06)'
            : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}

import { useRef, useState, useEffect } from 'react';
import { hapticLight, hapticMedium } from '../utils/haptics';

/**
 * SwipeableRow — iOS Mail 스타일 좌·우 스와이프 액션.
 * 좌 스와이프(왼쪽으로 손가락): 우측에서 빨간 '삭제' 액션 reveal.
 * 우 스와이프(오른쪽으로 손가락): 좌측에서 ▲▼ 순서 변경 액션 reveal.
 *
 * Props:
 *   onDelete   — 삭제 시 호출
 *   onMoveUp   — 위로 이동 시 호출 (없으면 ▲ 버튼 비활성)
 *   onMoveDown — 아래로 이동 시 호출 (없으면 ▼ 버튼 비활성)
 *   children   — 행 콘텐츠
 *   isOpen / onRequestOpen — 외부에서 열림 상태 관리 (다른 row가 열리면 닫기)
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
  const decided = useRef(false); // horizontal vs vertical 결정됨

  const DELETE_REVEAL = -84;
  const REORDER_REVEAL = 96;
  const DELETE_TRIGGER = -160; // 더 깊이 스와이프하면 즉시 삭제
  const isOpenSelf = openRowId === rowId;

  // 다른 row가 열리면 이 row 닫기
  useEffect(() => {
    if (!isOpenSelf && translateX !== 0 && !isDragging) {
      setTranslateX(0);
    }
  }, [isOpenSelf, isDragging]); // eslint-disable-line

  const onTouchStart = (e) => {
    if (!e.touches?.length) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    decided.current = false;
  };

  const onTouchMove = (e) => {
    if (startX.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!decided.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      // 수직 우세면 무시 (스크롤 영역으로)
      if (Math.abs(dy) > Math.abs(dx) * 1.2) {
        startX.current = null;
        return;
      }
      decided.current = true;
      setIsDragging(true);
    }
    let next = translateX + (dx - (startX.current === e.touches[0].clientX ? 0 : 0));
    next = dx;
    // 시작 위치 — 이미 열려있는 상태면 그 위치에서 시작
    if (isOpenSelf) {
      next = (translateX < 0 ? DELETE_REVEAL : REORDER_REVEAL) + dx;
    }
    // bound
    next = Math.max(-200, Math.min(160, next));
    setTranslateX(next);
  };

  const onTouchEnd = () => {
    if (!decided.current) {
      startX.current = null;
      return;
    }
    setIsDragging(false);
    if (translateX <= DELETE_TRIGGER && onDelete) {
      hapticMedium();
      onDelete();
      setTranslateX(0);
      setOpenRowId?.(null);
    } else if (translateX <= DELETE_REVEAL / 2 && onDelete) {
      setTranslateX(DELETE_REVEAL);
      setOpenRowId?.(rowId);
      hapticLight();
    } else if (translateX >= REORDER_REVEAL / 2 && (onMoveUp || onMoveDown)) {
      setTranslateX(REORDER_REVEAL);
      setOpenRowId?.(rowId);
      hapticLight();
    } else {
      setTranslateX(0);
      setOpenRowId?.(null);
    }
    startX.current = null;
  };

  const closeRow = () => { setTranslateX(0); setOpenRowId?.(null); };

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* 좌측 액션 (우 스와이프로 reveal) — ▲▼ 순서 변경 */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: REORDER_REVEAL,
        display: 'flex', alignItems: 'center', gap: 4,
        paddingLeft: 8,
        opacity: translateX > 0 ? 1 : 0,
        transition: isDragging ? 'none' : 'opacity 0.18s',
      }}>
        <button
          onClick={() => { if (onMoveUp) { hapticLight(); onMoveUp(); } closeRow(); }}
          disabled={!onMoveUp}
          aria-label="위로"
          style={{
            width: 40, height: 36, borderRadius: 10, border: 'none',
            background: onMoveUp ? 'rgba(101,152,239,0.85)' : 'rgba(0,0,0,0.08)',
            color: '#fff', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: onMoveUp ? 'pointer' : 'default',
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
            background: onMoveDown ? 'rgba(101,152,239,0.85)' : 'rgba(0,0,0,0.08)',
            color: '#fff', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: onMoveDown ? 'pointer' : 'default',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

      {/* 우측 액션 (좌 스와이프로 reveal) — 삭제 */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: Math.abs(DELETE_REVEAL),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#ef4444',
        opacity: translateX < 0 ? 1 : 0,
        transition: isDragging ? 'none' : 'opacity 0.18s',
      }}>
        <button
          onClick={() => { hapticMedium(); onDelete?.(); closeRow(); }}
          aria-label="삭제"
          style={{
            width: '100%', height: '100%', border: 'none', background: 'transparent',
            color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            cursor: 'pointer', fontFamily: 'inherit',
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
        onClick={() => { if (isOpenSelf) closeRow(); }}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.32,0.72,0,1)',
          background: 'var(--card-bg, transparent)',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}

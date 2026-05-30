import { useEffect, useRef } from 'react';
import { PERSONAS } from '../data/PersonaCatalog';

/**
 * PersonaPicker — Gemini Flash 스타일 페르소나 선택 드롭다운.
 *
 * 헤더의 "lua ⌄" chevron 클릭 시 표시. 선택 시 onSelect(id) 호출 후 닫힘.
 * 외부 클릭 시 닫힘. backdrop은 투명 (sheet 내부 absolute 배치).
 */
export default function PersonaPicker({ open, activeId, onSelect, onClose, anchorTop = 64 }) {
  const cardRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) onClose?.();
    };
    // setTimeout: 트리거 클릭이 곧바로 outside로 잡히는 것 방지
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes personaCardIn {
          from { opacity: 0; transform: translateX(-50%) scale(0.96); }
          to   { opacity: 1; transform: translateX(-50%) scale(1); }
        }
        .persona-opt {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 9px 18px 9px 50px;
          cursor: pointer; position: relative;
          transition: background 0.12s;
          -webkit-tap-highlight-color: transparent;
        }
        .persona-opt:active { background: rgba(0,0,0,0.04); }
        .persona-opt + .persona-opt { border-top: 1px solid rgba(0,0,0,0.04); }
        .persona-check {
          position: absolute; left: 20px; top: 50%;
          transform: translateY(-50%);
        }
      `}</style>
      <div
        ref={cardRef}
        role="menu"
        style={{
          position: 'absolute', top: anchorTop, left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(280px, calc(100% - 28px))',
          background: '#ffffff',
          borderRadius: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.04)',
          zIndex: 320,
          overflow: 'hidden',
          padding: '3px 0',
          animation: 'personaCardIn 180ms cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {PERSONAS.map((p) => {
          const isActive = p.id === activeId;
          return (
            <div
              key={p.id}
              className="persona-opt"
              role="menuitem"
              onClick={() => onSelect?.(p.id)}
            >
              {isActive && (
                <svg className="persona-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 6,
                  fontSize: 16, color: '#1F1F1F', letterSpacing: -0.2,
                }}>
                  <span style={{ fontWeight: 500 }}>{p.label}</span>
                </div>
                <div style={{
                  marginTop: 3,
                  fontSize: 13, color: '#5F6368', letterSpacing: -0.1, lineHeight: 1.45,
                }}>
                  {p.tagline}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

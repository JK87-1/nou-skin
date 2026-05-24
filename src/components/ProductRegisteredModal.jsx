import { useEffect, useState } from 'react';
import { hapticSuccess } from '../utils/haptics';
import { TRACKER_CATEGORIES } from '../storage/TrackerStorage';

/**
 * ProductRegisteredModal — 제품이 케어에 등록된 직후 노출.
 * BaselineCompleteModal과 같은 톤(circular checkmark gradient · spring pop · 큰 모달).
 *
 * product   — 방금 등록된 제품 { brand, name, category, imageThumb, ... }
 * totalCount — 등록 후 전체 제품 수 (예: 8/30)
 * onClose   — 닫기
 */
export default function ProductRegisteredModal({ product, totalCount, onClose }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    hapticSuccess();
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  if (!product) return null;
  const cat = TRACKER_CATEGORIES[product.category] || TRACKER_CATEGORIES['기타'];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9600,
      background: 'rgba(15,20,30,0.66)',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      animation: 'productRegFade 220ms ease-out',
    }}>
      <style>{`
        @keyframes productRegFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes productRegRise { from { transform: translateY(20px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes productRegPop { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>

      <div style={{
        width: '100%', maxWidth: 360,
        background: 'linear-gradient(180deg, #ffffff 0%, #f4f8fc 100%)',
        borderRadius: 28, padding: '32px 24px 24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        textAlign: 'center',
        animation: 'productRegRise 360ms cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Success checkmark */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          margin: '0 auto 18px',
          background: 'linear-gradient(135deg, #6598ef, #8ac4fe)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(101,152,239,0.32)',
          animation: animated ? 'productRegPop 480ms cubic-bezier(0.34,1.56,0.64,1)' : 'none',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Headline */}
        <div style={{
          fontSize: 21, fontWeight: 700, color: '#042C53',
          letterSpacing: -0.4, marginBottom: 6,
        }}>
          케어에 등록 완료!
        </div>
        <div style={{
          fontSize: 12.5, color: '#6B7F99',
          marginBottom: 20, letterSpacing: -0.1,
        }}>
          {typeof totalCount === 'number' ? `지금 ${totalCount}개 등록됨` : '제품이 케어에 추가됐어요'}
        </div>

        {/* Product card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px',
          background: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(101,152,239,0.18)',
          borderRadius: 14,
          marginBottom: 22,
          textAlign: 'left',
        }}>
          {product.imageThumb ? (
            <img
              src={product.imageThumb}
              alt=""
              style={{
                width: 56, height: 56, borderRadius: 12,
                objectFit: 'contain',
                background: '#fff',
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: 12,
              background: `${cat.color}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={cat.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="3" width="12" height="18" rx="2"/><line x1="9" y1="8" x2="15" y2="8"/>
              </svg>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {product.brand && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6598ef' }}>{product.brand}</span>
              )}
              <span style={{
                fontSize: 9.5, padding: '1px 6px', borderRadius: 5,
                background: `${cat.color}22`, color: '#374E66', fontWeight: 600, letterSpacing: 0.2,
              }}>{product.category}</span>
            </div>
            <div style={{
              fontSize: 13, fontWeight: 500, color: '#1F2937',
              letterSpacing: -0.1, lineHeight: 1.4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{product.name}</div>
            {product.timeSlot && (
              <div style={{ fontSize: 10.5, color: '#6B7F99', marginTop: 3 }}>
                {product.timeSlot === 'morning' ? '아침 전용' : product.timeSlot === 'night' ? '저녁 전용' : '아침·저녁'}
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px',
            background: 'linear-gradient(135deg, #6598ef, #8ac4fe)',
            border: 'none', borderRadius: 14,
            color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 6px 18px rgba(101,152,239,0.35)',
            letterSpacing: -0.2,
          }}
        >확인</button>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { getLatestRecord } from '../storage/SkinStorage';
import { getProducts } from '../storage/TrackerStorage';
import {
  CATEGORY_META, PRODUCTS,
  getWeakestCategories, getProductsByCategory,
  calcMatchScore, getProductTimeSlot, getTimeSlotLabel,
} from '../data/ProductCatalog';
import { hapticLight } from '../utils/haptics';

/**
 * CareRecommendation — 측정 데이터 기반 맞춤 제품 추천.
 *
 * 약점 카테고리(점수 < 65) 별로 가로 carousel 카드.
 * 사용자가 이미 등록한 제품은 추천 제외 (중복 방지).
 * 각 카드에 매칭 ring, 시점 tag, 핵심 성분.
 */

function pickRecommendations(result, registeredIds) {
  if (!result) return [];
  const weakest = getWeakestCategories(result);
  // 약점이 없으면 종합 점수 낮은 카테고리 fallback (체감 추천 없음 방지)
  const baseCats = weakest.length > 0 ? weakest : ['수분부족', '주름탄력', '색소침착'];
  return baseCats.slice(0, 4).map(cat => {
    const meta = CATEGORY_META[cat];
    const metricVal = result[meta.metricKey];
    const matchScore = typeof metricVal === 'number' ? calcMatchScore(metricVal, meta.inverse) : 88;
    const products = getProductsByCategory(cat)
      .filter(p => !registeredIds.has(p.id))
      .slice(0, 6); // 최대 6개
    return { cat, meta, metricVal, matchScore, products };
  }).filter(g => g.products.length > 0);
}

function ProductCard({ product, matchScore }) {
  const slot = getProductTimeSlot(product);
  const slotLabel = getTimeSlotLabel(slot);

  return (
    <a
      href={product.link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => hapticLight()}
      style={{
        flex: '0 0 168px',
        display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.42)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.4)',
        borderRadius: 18, padding: 14,
        textDecoration: 'none', color: 'inherit',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
      onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {/* Match ring */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
          <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(137,206,245,0.15)" strokeWidth="3" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#5BA8D6" strokeWidth="3"
              strokeDasharray={`${(matchScore / 100) * 87.96} 87.96`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.6s ease-out' }} />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: 'var(--text-primary)',
          }}>{matchScore}</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: 'rgba(255,255,255,0.55)', borderRadius: 12,
          padding: '4px 8px', fontSize: 10, fontWeight: 600,
          color: 'var(--text-secondary)',
        }}>
          <span>{slotLabel.icon}</span>
          <span>{slotLabel.label}</span>
        </div>
      </div>

      {/* Brand · Name */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 500 }}>
        {product.brand}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
        lineHeight: 1.4, minHeight: '2.8em',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden', wordBreak: 'keep-all',
      }}>
        {product.name}
      </div>

      {/* Volume + 핵심 tag */}
      <div style={{
        marginTop: 'auto', paddingTop: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{product.volume}</span>
        <span style={{
          fontSize: 9, fontWeight: 600, color: '#5BA8D6',
          background: 'rgba(137,206,245,0.15)', borderRadius: 10,
          padding: '2px 7px',
        }}>{(product.tags || [])[0] || '추천'}</span>
      </div>
    </a>
  );
}

export default function CareRecommendation() {
  const result = getLatestRecord();
  const registeredIds = useMemo(() => {
    try {
      const list = getProducts();
      return new Set(list.map(p => p.id).filter(Boolean));
    } catch { return new Set(); }
  }, []);

  const groups = useMemo(() => pickRecommendations(result, registeredIds), [result, registeredIds]);

  if (!result) {
    return (
      <div style={{
        padding: '24px 18px', marginBottom: 20,
        background: 'rgba(255,255,255,0.3)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: 18, textAlign: 'center',
      }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>✨</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          맞춤 제품 추천을 받아보세요
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          첫 측정 후 내 피부에 꼭 맞는 제품을<br />루틴별로 추천해드릴게요.
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div style={{
        padding: '24px 18px', marginBottom: 20,
        background: 'rgba(255,255,255,0.3)',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: 18, textAlign: 'center',
      }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>🌿</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          지금 피부 상태가 좋아요
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          모든 메트릭이 안정적이에요. 지금 루틴을 꾸준히 유지해주세요.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Section Header */}
      <div style={{ padding: '0 4px', marginBottom: 4 }}>
        <div style={{
          fontSize: 17, fontWeight: 700, color: 'var(--text-primary)',
          letterSpacing: -0.3, marginBottom: 2,
        }}>
          당신의 피부에 맞는 제품
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {`${result.date || '최근 측정'} 기준 · 종합 ${result.overallScore}점 · 약점 ${groups.length}개`}
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.cat} style={{ marginTop: 18 }}>
          {/* Category pill row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '0 4px', marginBottom: 10,
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 16,
              background: 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.4)',
            }}>
              <span style={{ fontSize: 15 }}>{g.meta.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{g.meta.label}</span>
              {typeof g.metricVal === 'number' && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {g.metricVal}{g.cat === '트러블' ? '개' : '점'}</span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.meta.ingredient}</div>
          </div>

          {/* Horizontal carousel */}
          <div style={{
            display: 'flex', gap: 10, padding: '4px 4px 8px',
            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
          }}>
            <style>{`
              .care-cards::-webkit-scrollbar { display: none; }
            `}</style>
            {g.products.map(p => (
              <ProductCard key={p.id} product={p} matchScore={g.matchScore} />
            ))}
          </div>
        </div>
      ))}

      <div style={{
        marginTop: 12, padding: '8px 12px',
        fontSize: 10, color: 'var(--text-dim, #B0B8C1)', textAlign: 'center', lineHeight: 1.5,
      }}>
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </div>
    </div>
  );
}

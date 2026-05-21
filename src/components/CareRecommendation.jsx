import { useMemo } from 'react';
import { getLatestRecord } from '../storage/SkinStorage';
import { getProducts } from '../storage/TrackerStorage';
import { TRACKER_CATEGORIES } from '../storage/TrackerStorage';
import { getProductTimeSlot } from '../data/ProductCatalog';

/**
 * CareRecommendation — 등록한 화장품을 피부 데이터 기반으로 루틴에 맞게 추천.
 *
 * 새 제품 추천 X. 사용자의 화장대(등록 제품)를 분석해서:
 *   1. 아침 루틴 — morning 시점이거나 비타민C·SPF 계열
 *   2. 저녁 루틴 — night 시점이거나 레티놀·AHA·BHA 계열
 *   3. 각 카드에 "왜 추천되는지" 이유 (약점 메트릭과 성분 매칭)
 *
 * 등록 제품 없으면 안내. 측정 없으면 시점 추천만 작동.
 */

// 성분 → 메트릭 매핑. consult prompt와 동일 룰.
const INGREDIENT_METRIC_MAP = {
  moisture:           { label: '수분',     ingredients: ['히알루론산', '히아루론', '세라마이드', '글리세린', '판테놀', 'NMF', '스쿠알란', 'hyaluron', 'ceramide', 'glycerin', 'squalane'] },
  pigmentationScore:  { label: '색소',     ingredients: ['비타민C', '나이아신아마이드', '나이아신', '알부틴', '트라넥삼', '코직', '글루타치온', 'vitamin c', 'niacinamide', 'arbutin', 'tranexamic'] },
  oilBalance:         { label: '유분',     ingredients: ['살리실', '녹차', '아연', '티트리', '시카', 'salicylic', 'tea tree', 'zinc', 'centella'] },
  troubleCount:       { label: '트러블',   ingredients: ['살리실', '티트리', '아연', '시카', '판테놀', '센텔라', 'salicylic', 'centella', 'panthenol', 'tea tree'] },
  wrinkleScore:       { label: '주름',     ingredients: ['레티놀', '레티날', '펩타이드', '아데노신', '바쿠치올', 'retinol', 'peptide', 'bakuchiol', 'adenosine'] },
  elasticityScore:    { label: '탄력',     ingredients: ['펩타이드', 'EGF', '콜라겐', '아데노신', '레티놀', 'peptide', 'collagen', 'retinol'] },
  textureScore:       { label: '피부결',   ingredients: ['AHA', 'PHA', 'BHA', '글리콜', '락트산', 'glycolic', 'lactic'] },
  poreScore:          { label: '모공',     ingredients: ['BHA', '나이아신아마이드', '나이아신', '녹차', '살리실', 'niacinamide', 'salicylic'] },
  darkCircleScore:    { label: '다크서클', ingredients: ['카페인', '비타민K', '펩타이드', '나이아신아마이드', 'caffeine', 'vitamin k', 'peptide'] },
  skinTone:           { label: '피부톤',   ingredients: ['나이아신아마이드', '비타민C', '알부틴', '감초', 'niacinamide', 'vitamin c'] },
};

function getMatchedIngredients(product, metricKey) {
  const keywords = INGREDIENT_METRIC_MAP[metricKey]?.ingredients || [];
  const text = [
    product.name || '',
    product.brand || '',
    typeof product.ingredients === 'string' ? product.ingredients : (Array.isArray(product.ingredients) ? product.ingredients.join(' ') : ''),
    ...(product.tags || []),
  ].join(' ').toLowerCase();
  const matched = [];
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase()) && !matched.includes(kw)) matched.push(kw);
  }
  return matched;
}

/**
 * 약점 메트릭 추출 (점수 < 65 또는 트러블 > 3).
 * troubleCount는 inverse라 별도 처리.
 */
function getWeakMetrics(result) {
  if (!result) return [];
  const candidates = [
    { key: 'moisture',          val: result.moisture },
    { key: 'oilBalance',        val: typeof result.oilBalance === 'number' && (result.oilBalance < 40 || result.oilBalance > 75) ? Math.min(result.oilBalance, 100 - Math.abs(55 - result.oilBalance) * 1.4) : 100 },
    { key: 'pigmentationScore', val: result.pigmentationScore },
    { key: 'wrinkleScore',      val: result.wrinkleScore },
    { key: 'elasticityScore',   val: result.elasticityScore },
    { key: 'textureScore',      val: result.textureScore },
    { key: 'poreScore',         val: result.poreScore },
    { key: 'darkCircleScore',   val: result.darkCircleScore },
    { key: 'skinTone',          val: result.skinTone },
    { key: 'troubleCount',      val: result.troubleCount > 3 ? (100 - result.troubleCount * 8) : 100, raw: result.troubleCount },
  ];
  return candidates
    .filter(m => typeof m.val === 'number' && m.val < 65)
    .sort((a, b) => a.val - b.val);
}

/**
 * 각 등록 제품을 분석.
 * - matchedMetrics: 매칭되는 약점 메트릭 + 매칭 성분
 * - timeSlot: morning/night/both (등록값 우선, 없으면 자동 추정)
 * - score: 매칭 강도 (매칭 성분 수 * 매칭 약점 수)
 */
function analyzeProduct(product, weakMetrics) {
  const slot = (product.timeSlot === 'morning' || product.timeSlot === 'night') ? product.timeSlot : (product.timeSlot === 'both' ? 'both' : getProductTimeSlot(product));

  const matchedMetrics = [];
  for (const wm of weakMetrics) {
    const ings = getMatchedIngredients(product, wm.key);
    if (ings.length > 0) {
      const label = INGREDIENT_METRIC_MAP[wm.key]?.label || wm.key;
      matchedMetrics.push({
        key: wm.key,
        label,
        val: wm.raw != null ? `${wm.raw}개` : `${wm.val}점`,
        ingredients: ings,
      });
    }
  }

  return {
    ...product,
    slot,
    matchedMetrics,
    score: matchedMetrics.length * 10 + matchedMetrics.reduce((s, m) => s + m.ingredients.length, 0),
  };
}

function ProductCard({ product }) {
  const cat = TRACKER_CATEGORIES[product.category] || TRACKER_CATEGORIES['기타'];

  return (
    <div style={{
      display: 'flex', gap: 14, padding: '14px 14px',
      background: 'rgba(255,255,255,0.45)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(255,255,255,0.4)',
      borderRadius: 16,
      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
    }}>
      {/* Thumbnail */}
      {product.imageThumb ? (
        <img src={product.imageThumb} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 56, height: 56, borderRadius: 12, flexShrink: 0,
          background: 'rgba(255,255,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        }}>{cat.emoji}</div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Brand · Name */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 2 }}>{product.brand || ''}</div>
        <div style={{
          fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35,
          marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
        }}>{product.name || '(이름 없음)'}</div>

        {/* 매칭 이유 */}
        {product.matchedMetrics.length > 0 ? (
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55, wordBreak: 'keep-all' }}>
            <strong style={{ color: '#5BA8D6' }}>{product.matchedMetrics[0].ingredients[0]}</strong>
            {`이(가) ${product.matchedMetrics[0].label} ${product.matchedMetrics[0].val} 케어에 도움`}
            {product.matchedMetrics.length > 1 && (
              <span style={{ color: 'var(--text-muted)' }}> · +{product.matchedMetrics.length - 1}</span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            기본 루틴 제품
          </div>
        )}

        {/* Metric chips */}
        {product.matchedMetrics.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {product.matchedMetrics.slice(0, 3).map(m => (
              <span key={m.key} style={{
                fontSize: 9, fontWeight: 600, color: '#5BA8D6',
                background: 'rgba(137,206,245,0.15)', borderRadius: 8,
                padding: '2px 7px',
              }}>{m.label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RoutineSection({ icon, title, products }) {
  if (products.length === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 4px', marginBottom: 10,
      }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {products.length}개</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {products.map(p => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}

export default function CareRecommendation() {
  const result = getLatestRecord();
  const userProducts = useMemo(() => {
    try { return getProducts(); } catch { return []; }
  }, []);

  const { morningProducts, nightProducts, generalProducts } = useMemo(() => {
    const weakMetrics = getWeakMetrics(result);
    const analyzed = userProducts.map(p => analyzeProduct(p, weakMetrics));
    // 매칭 강한 제품 우선 정렬
    analyzed.sort((a, b) => b.score - a.score);

    const morning = analyzed.filter(p => p.slot === 'morning' || p.slot === 'both');
    const night   = analyzed.filter(p => p.slot === 'night' || p.slot === 'both');
    // 매칭되는 제품만 우선 노출. 매칭 0인 제품은 "기본 루틴"으로 별도 표시.
    return {
      morningProducts: morning.filter(p => p.matchedMetrics.length > 0),
      nightProducts: night.filter(p => p.matchedMetrics.length > 0),
      generalProducts: analyzed.filter(p => p.matchedMetrics.length === 0),
    };
  }, [userProducts, result]);

  // 빈 상태들
  if (userProducts.length === 0) {
    return (
      <div style={{
        padding: '28px 18px', marginBottom: 20,
        background: 'rgba(255,255,255,0.3)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: 18, textAlign: 'center',
      }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>🧴</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          먼저 화장품을 등록해주세요
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          위의 '제품 등록' 버튼으로 화장품을 등록하면<br />피부 데이터에 맞게 루틴별로 추천해드려요.
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div style={{
        padding: '28px 18px', marginBottom: 20,
        background: 'rgba(255,255,255,0.3)',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: 18, textAlign: 'center',
      }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>📸</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          첫 측정 후에 맞춤 추천을 받을 수 있어요
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          피부 측정 결과로 등록한 제품 중 지금<br />필요한 것을 골라드릴게요.
        </div>
      </div>
    );
  }

  const hasMatched = morningProducts.length > 0 || nightProducts.length > 0;

  if (!hasMatched && generalProducts.length === userProducts.length) {
    // 모든 제품이 매칭 0개 (피부 약점이 없거나 성분 매칭 안 됨)
    return (
      <div style={{
        padding: '28px 18px', marginBottom: 20,
        background: 'rgba(255,255,255,0.3)',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: 18, textAlign: 'center',
      }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>🌿</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          지금 피부 상태가 안정적이에요
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          등록한 제품으로 기본 루틴을 꾸준히 유지해주세요.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8, marginBottom: 24 }}>
      {/* Section Header */}
      <div style={{ padding: '0 4px', marginBottom: 14 }}>
        <div style={{
          fontSize: 17, fontWeight: 700, color: 'var(--text-primary)',
          letterSpacing: -0.3, marginBottom: 4,
        }}>
          당신의 피부에 맞는 제품
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          등록한 화장품을 피부 데이터에 맞게 루틴별로 정렬했어요
          {result.overallScore != null && ` · 종합 ${result.overallScore}점`}
        </div>
      </div>

      <RoutineSection icon="☀️" title="아침 루틴" products={morningProducts} />
      <RoutineSection icon="🌙" title="저녁 루틴" products={nightProducts} />
    </div>
  );
}

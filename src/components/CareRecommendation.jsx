import { useMemo } from 'react';
import { getLatestRecord } from '../storage/SkinStorage';
import { getProducts, TRACKER_CATEGORIES } from '../storage/TrackerStorage';
import { getProductTimeSlot } from '../data/ProductCatalog';

/**
 * CareRecommendation — 등록한 화장품을 피부 데이터 기반으로 표준 스킨케어 순서대로 정렬.
 *
 * 핵심:
 *   1. 카테고리를 표준 스텝에 매핑 (클렌저 → 토너 → 세럼 → 크림 → 선크림 등)
 *   2. 같은 스텝에 여러 제품이면 매칭 강도 정렬, 1~2개는 "매일", 그 외 "가끔"
 *   3. 새 제품 추천 없음. 등록 제품만 사용.
 */

// ===== 성분 → 약점 메트릭 매핑 (consult prompt와 동일 룰) =====
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

// ===== 스킨케어 표준 순서 (아침·저녁) =====
// 카테고리(KR) → step에 매핑. 사용자 등록 시 카테고리는 TRACKER_CATEGORIES.
const MORNING_STEPS = [
  { step: 1, label: '클렌저', categoryKeys: ['클렌저'], hint: '가볍게 세안' },
  { step: 2, label: '토너', categoryKeys: ['토너'], hint: '수분 첫 단계' },
  { step: 3, label: '세럼·앰플', categoryKeys: ['세럼', '에센스'], hint: '핵심 성분 흡수' },
  { step: 4, label: '크림', categoryKeys: ['크림'], hint: '수분 가둠' },
  { step: 5, label: '선크림', categoryKeys: ['선크림'], hint: '꼭 발라야 색소·주름 막아요' },
];

const NIGHT_STEPS = [
  { step: 1, label: '클렌저', categoryKeys: ['클렌저'], hint: '하루 노폐물 제거' },
  { step: 2, label: '토너', categoryKeys: ['토너'], hint: '결 정리' },
  { step: 3, label: '세럼·앰플', categoryKeys: ['세럼', '에센스'], hint: '액티브 케어' },
  { step: 4, label: '크림', categoryKeys: ['크림'], hint: '밤사이 복원' },
  { step: 5, label: '마스크팩', categoryKeys: ['마스크팩'], hint: '주 2~3회 집중 케어', frequencyTag: '주 2~3회' },
];

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

function getWeakMetrics(result) {
  if (!result) return [];
  const candidates = [
    { key: 'moisture',          val: result.moisture },
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

function analyzeProduct(product, weakMetrics) {
  const slot = (product.timeSlot === 'morning' || product.timeSlot === 'night' || product.timeSlot === 'both')
    ? product.timeSlot
    : getProductTimeSlot(product);

  const matchedMetrics = [];
  for (const wm of weakMetrics) {
    const ings = getMatchedIngredients(product, wm.key);
    if (ings.length > 0) {
      matchedMetrics.push({
        key: wm.key,
        label: INGREDIENT_METRIC_MAP[wm.key]?.label || wm.key,
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

/**
 * 같은 step의 등록 제품들 우선순위 결정.
 * - 1~2번: 매일 (핵심)
 * - 3번+: 가끔 (선택)
 * 매칭 점수 우선 정렬, 같으면 등록 일자 빠른 순.
 */
function rankInStep(products) {
  const sorted = [...products].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aDays = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bDays = b.startDate ? new Date(b.startDate).getTime() : 0;
    return aDays - bDays;
  });
  return sorted.map((p, idx) => ({
    ...p,
    priority: idx < 2 ? 'daily' : 'occasional',
  }));
}

/**
 * 시간대(morning/night) + step 정의를 받아서, 각 step별로 매칭 제품 그룹화.
 */
function buildRoutine(timeSlot, steps, products) {
  return steps.map(stepDef => {
    const matched = products.filter(p => {
      // 시간대 매칭 — 'both'이면 양쪽 다 포함
      const slotOk = p.slot === timeSlot || p.slot === 'both';
      // 카테고리 매칭
      const categoryOk = stepDef.categoryKeys.includes(p.category);
      return slotOk && categoryOk;
    });
    const ranked = rankInStep(matched);
    return { ...stepDef, products: ranked };
  }).filter(s => s.products.length > 0);
}

// ===== UI 컴포넌트 =====

function ProductRow({ product, priority }) {
  const cat = TRACKER_CATEGORIES[product.category] || TRACKER_CATEGORIES['기타'];
  const isOccasional = priority === 'occasional';

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '10px 12px',
      background: isOccasional ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.4)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.35)',
      borderRadius: 12,
      opacity: isOccasional ? 0.78 : 1,
    }}>
      {product.imageThumb ? (
        <img src={product.imageThumb} alt="" style={{ width: 40, height: 40, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 40, height: 40, borderRadius: 9, flexShrink: 0,
          background: 'rgba(255,255,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>{cat.emoji}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          {product.brand && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{product.brand}</span>
          )}
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
          }}>{product.name || '(이름 없음)'}</span>
        </div>
        {product.matchedMetrics.length > 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 3 }}>
            <strong style={{ color: '#5BA8D6' }}>{product.matchedMetrics[0].ingredients[0]}</strong>
            {` · ${product.matchedMetrics[0].label} 케어`}
            {product.matchedMetrics.length > 1 && (
              <span style={{ color: 'var(--text-muted)' }}> +{product.matchedMetrics.length - 1}</span>
            )}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: isOccasional ? 'var(--text-muted)' : '#5BA8D6',
          background: isOccasional ? 'rgba(0,0,0,0.05)' : 'rgba(137,206,245,0.18)',
          borderRadius: 10, padding: '3px 8px', whiteSpace: 'nowrap',
        }}>{isOccasional ? '가끔' : '매일'}</span>
      </div>
    </div>
  );
}

function StepBlock({ stepDef }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 4px', marginBottom: 8,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(137,206,245,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#5BA8D6',
          flexShrink: 0,
        }}>{stepDef.step}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)',
            display: 'flex', alignItems: 'baseline', gap: 6,
          }}>
            <span>{stepDef.label}</span>
            {stepDef.frequencyTag && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>· {stepDef.frequencyTag}</span>
            )}
          </div>
          {stepDef.hint && (
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{stepDef.hint}</div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 30 }}>
        {stepDef.products.map(p => (
          <ProductRow key={p.id} product={p} priority={p.priority} />
        ))}
      </div>
    </div>
  );
}

function RoutineColumn({ icon, title, subtitle, steps, totalProducts, dailyCount, occasionalCount }) {
  if (steps.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ padding: '0 4px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.2 }}>{title}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalProducts}개</span>
        </div>
        {subtitle && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div>
        )}
      </div>
      {steps.map(s => <StepBlock key={s.step} stepDef={s} />)}
    </div>
  );
}

export default function CareRecommendation() {
  const result = getLatestRecord();
  const userProducts = useMemo(() => { try { return getProducts(); } catch { return []; } }, []);

  const { morningSteps, nightSteps, morningStats, nightStats, hasManyProducts } = useMemo(() => {
    const weakMetrics = getWeakMetrics(result);
    const analyzed = userProducts.map(p => analyzeProduct(p, weakMetrics));

    const morning = buildRoutine('morning', MORNING_STEPS, analyzed);
    const night = buildRoutine('night', NIGHT_STEPS, analyzed);

    const countStats = (steps) => {
      let daily = 0, occasional = 0;
      for (const s of steps) {
        for (const p of s.products) {
          if (p.priority === 'daily') daily++;
          else occasional++;
        }
      }
      return { daily, occasional, total: daily + occasional };
    };

    const ms = countStats(morning);
    const ns = countStats(night);

    return {
      morningSteps: morning,
      nightSteps: night,
      morningStats: ms,
      nightStats: ns,
      hasManyProducts: ms.occasional + ns.occasional >= 3,
    };
  }, [userProducts, result]);

  // 빈 상태
  if (userProducts.length === 0) {
    return (
      <div style={{
        padding: '28px 18px', marginBottom: 20,
        background: 'rgba(255,255,255,0.42)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.4)',
        borderRadius: 18, textAlign: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>🧴</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          먼저 화장품을 등록해주세요
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          위 '제품 등록' 버튼으로 화장품을 추가하면<br />피부 데이터에 맞춰 루틴을 짜드릴게요.
        </div>
      </div>
    );
  }

  if (morningSteps.length === 0 && nightSteps.length === 0) {
    return (
      <div style={{
        padding: '24px 18px', marginBottom: 20,
        background: 'rgba(255,255,255,0.42)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255,255,255,0.4)',
        borderRadius: 18, textAlign: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🤔</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          제품 카테고리를 확인해주세요
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          등록 제품의 카테고리(클렌저·토너·세럼 등)가 명확해야<br />루틴 순서대로 정렬할 수 있어요.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8, marginBottom: 24 }}>
      {/* Section Header */}
      <div style={{ padding: '0 4px', marginBottom: 16 }}>
        <div style={{
          fontSize: 17, fontWeight: 700, color: 'var(--text-primary)',
          letterSpacing: -0.3, marginBottom: 4,
        }}>
          당신의 피부에 맞는 루틴
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          등록한 화장품을 표준 순서대로 정리했어요.
          {result?.overallScore != null && ` 종합 ${result.overallScore}점 기준 매칭도 높은 순.`}
        </div>
      </div>

      {/* 과다 등록 가이드 */}
      {hasManyProducts && (
        <div style={{
          padding: '12px 14px', marginBottom: 16,
          background: 'rgba(255,200,120,0.18)',
          border: '1px solid rgba(255,180,80,0.25)',
          borderRadius: 14,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.1 }}>💡</span>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            제품이 많아요. 각 단계에서 <strong style={{ color: 'var(--text-primary)' }}>2개까지만 매일</strong> 쓰고, 나머지는 <strong style={{ color: 'var(--text-primary)' }}>주 2~3회 가끔</strong> 발라주세요. 한꺼번에 다 바르면 영양 과다·각질 누적으로 피부톤이 칙칙해질 수 있어요.
          </div>
        </div>
      )}

      <RoutineColumn
        icon="☀️"
        title="아침 루틴"
        subtitle={morningStats.occasional > 0
          ? `매일 ${morningStats.daily}개 · 가끔 ${morningStats.occasional}개`
          : `매일 ${morningStats.daily}개`}
        steps={morningSteps}
        totalProducts={morningStats.total}
      />

      <RoutineColumn
        icon="🌙"
        title="저녁 루틴"
        subtitle={nightStats.occasional > 0
          ? `매일 ${nightStats.daily}개 · 가끔 ${nightStats.occasional}개`
          : `매일 ${nightStats.daily}개`}
        steps={nightSteps}
        totalProducts={nightStats.total}
      />
    </div>
  );
}

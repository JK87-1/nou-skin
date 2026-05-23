import { useMemo } from 'react';
import { getLatestRecord } from '../storage/SkinStorage';
import { getProducts, TRACKER_CATEGORIES } from '../storage/TrackerStorage';
import { buildRoutineRecommendation, detectInteractions } from '../utils/routineBuilder';

/**
 * CareRecommendation — 등록한 화장품을 피부 데이터 기반으로 표준 스킨케어 순서대로 정렬.
 * 로직은 src/utils/routineBuilder.js에 일원화 (consult API context와 공유).
 */

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
            <strong style={{ color: '#6598ef' }}>{product.matchedMetrics[0].ingredients[0]}</strong>
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
          color: isOccasional ? 'var(--text-muted)' : '#6598ef',
          background: isOccasional ? 'rgba(0,0,0,0.05)' : 'rgba(101,152,239,0.18)',
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
          background: 'rgba(101,152,239,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#6598ef',
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
    const rec = buildRoutineRecommendation(result, userProducts);
    return {
      morningSteps: rec.morning,
      nightSteps: rec.night,
      morningStats: rec.stats.morning,
      nightStats: rec.stats.night,
      hasManyProducts: rec.hasManyProducts,
    };
  }, [userProducts, result]);

  const interactions = useMemo(() => detectInteractions(userProducts), [userProducts]);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{
            fontSize: 17, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: -0.3,
          }}>
            당신의 피부에 맞는 루틴
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600, color: '#6598ef',
            background: 'rgba(101,152,239,0.18)', borderRadius: 8,
            padding: '3px 8px', letterSpacing: -0.1,
          }}>표준 정렬</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>
          등록한 화장품을 표준 순서대로 정리했어요.
          {result?.overallScore != null && ` 종합 ${result.overallScore}점 기준 매칭도 높은 순.`}
        </div>
        <div style={{ fontSize: 11.5, color: '#6598ef', lineHeight: 1.55, marginTop: 6, fontWeight: 500 }}>
          내 피부 별 맞춤 추천은 상담으로 진행해보세요.
        </div>
      </div>

      {/* 가이드 카드 — 가장 임팩트 큰 1개만 노출 (피로도 ↓)
          우선순위: 충돌 high > medium > 과다 > low > 시너지 1개
          상담사는 모든 정보 활용 — UI만 압축 */}
      {(() => {
        const sortedConflicts = [...(interactions.conflicts || [])].sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
        });
        const topConflict = sortedConflicts[0];
        const hasUrgentConflict = topConflict && (topConflict.severity === 'high' || topConflict.severity === 'medium');
        const topSynergy = (interactions.synergies || [])[0];

        // 우선순위 분기
        let pick = null;
        if (hasUrgentConflict) {
          pick = {
            type: 'conflict', severity: topConflict.severity,
            icon: '⚠️',
            title: topConflict.title,
            advice: topConflict.advice,
            bg: topConflict.severity === 'high' ? 'rgba(232,140,140,0.22)' : 'rgba(240,180,120,0.2)',
            border: topConflict.severity === 'high' ? 'rgba(220,100,100,0.32)' : 'rgba(220,150,80,0.28)',
          };
        } else if (hasManyProducts) {
          pick = {
            type: 'overuse',
            icon: '💡',
            title: '제품이 많아요',
            advice: '각 단계 2개까지만 매일, 나머지는 주 2~3회 가끔 발라주세요.',
            bg: 'rgba(255,200,120,0.18)',
            border: 'rgba(255,180,80,0.25)',
          };
        } else if (topConflict) {
          pick = {
            type: 'conflict-low', severity: 'low',
            icon: '⚠️',
            title: topConflict.title,
            advice: topConflict.advice,
            bg: 'rgba(240,210,140,0.18)',
            border: 'rgba(220,180,80,0.25)',
          };
        } else if (topSynergy) {
          pick = {
            type: 'synergy',
            icon: '✨',
            title: topSynergy.title,
            advice: topSynergy.advice,
            bg: 'rgba(173,235,179,0.18)',
            border: 'rgba(140,210,150,0.28)',
          };
        }

        if (!pick) return null;

        return (
          <div style={{
            padding: '12px 14px', marginBottom: 14,
            background: pick.bg,
            border: `1px solid ${pick.border}`,
            borderRadius: 14,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 15, flexShrink: 0, lineHeight: 1.1 }}>{pick.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{pick.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{pick.advice}</div>
            </div>
          </div>
        );
      })()}

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

      {/* 쿠팡 파트너스 안내 (전자상거래법 표시 의무) — 맞춤 제품 추천 아래에 작게 */}
      <div style={{
        fontSize: 9, color: 'var(--text-dim, #B0B8C1)',
        textAlign: 'center', lineHeight: 1.5,
        padding: '8px 12px 0', marginTop: 4,
      }}>
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </div>
    </div>
  );
}

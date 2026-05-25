import { useMemo, useState } from 'react';
import { getLatestRecord } from '../storage/SkinStorage';
import { getProducts, TRACKER_CATEGORIES } from '../storage/TrackerStorage';
import { buildRoutineRecommendation, detectInteractions } from '../utils/routineBuilder';

/**
 * CareRecommendation — 등록한 화장품을 피부 데이터 기반으로 표준 스킨케어 순서대로 정렬.
 * 로직은 src/utils/routineBuilder.js에 일원화 (consult API context와 공유).
 */

// ===== Tabler Icons (Filled) =====
const TI = ({ children, size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="#6598ef" stroke="none">{children}</svg>;
const IconBottle = ({ size }) => <TI size={size}><path d="M13 2a1 1 0 0 1 .993 .883l.007 .117v1h1a1 1 0 0 1 .993 .883l.007 .117v1.5a3.5 3.5 0 0 1 -1.336 2.753l-.164 .131v8.116a2.5 2.5 0 0 1 -2.336 2.495l-.164 .005h-2a2.5 2.5 0 0 1 -2.495 -2.336l-.005 -.164v-8.116a3.5 3.5 0 0 1 -1.455 -2.644l-.04 -.24l-.005 -.216v-1.5a1 1 0 0 1 .883 -.993l.117 -.007h1v-1a1 1 0 0 1 .883 -.993l.117 -.007h2z" /></TI>;
const IconSearch = ({ size }) => <TI size={size}><path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-5 2.66a1 1 0 0 0 -.993 .883l-.007 .117v3h-3a1 1 0 0 0 -.117 1.993l.117 .007h3v3a1 1 0 0 0 1.993 .117l.007 -.117v-3h3a1 1 0 0 0 .117 -1.993l-.117 -.007h-3v-3a1 1 0 0 0 -1 -1z" /></TI>;
const IconAlert = ({ size }) => <TI size={size}><path d="M12 1.67c.955 0 1.845 .467 2.39 1.247l.105 .16l8.114 13.548a2.914 2.914 0 0 1 -2.307 4.363l-.195 .012h-16.214a2.914 2.914 0 0 1 -2.513 -4.4l8.114 -13.548a2.914 2.914 0 0 1 2.506 -1.382zm.01 13.33l-.127 .007a1 1 0 0 0 0 1.986l.117 .007l.127 -.007a1 1 0 0 0 0 -1.986l-.117 -.007zm-.01 -7a1 1 0 0 0 -.993 .883l-.007 .117v4l.007 .117a1 1 0 0 0 1.986 0l.007 -.117v-4l-.007 -.117a1 1 0 0 0 -.993 -.883z" /></TI>;
const IconBulb = ({ size }) => <TI size={size}><path d="M4 11a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1zm16 0a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1zm-2.834 -6.304l.094 .083l.7 .7a1 1 0 0 1 -1.32 1.497l-.094 -.083l-.7 -.7a1 1 0 0 1 1.218 -1.567l.102 .07zm-11.332 0a1 1 0 0 1 .083 1.32l-.083 .094l-.7 .7a1 1 0 0 1 -1.497 -1.32l.083 -.094l.7 -.7a1 1 0 0 1 1.414 0zM12 2a1 1 0 0 1 .993 .883l.007 .117v1a1 1 0 0 1 -1.993 .117l-.007 -.117v-1a1 1 0 0 1 1 -1zm2 12h-4l-.15 .005a2 2 0 0 0 -1.844 1.838l-.006 .157v2l.005 .15a2 2 0 0 0 1.838 1.844l.157 .006h4l.15 -.005a2 2 0 0 0 1.844 -1.838l.006 -.157v-2l-.005 -.15a2 2 0 0 0 -1.838 -1.844l-.157 -.006zm-2 -10a6 6 0 0 1 5.996 5.775l.004 .225a6 6 0 0 1 -2.639 4.963l-.361 .237v.8l-.005 .15a2 2 0 0 0 -1.838 1.844l-.157 .006h-2l-.15 -.005a2 2 0 0 0 -1.844 -1.838l-.006 -.157v-.8a6 6 0 0 1 -2.996 -5l-.004 -.225a6 6 0 0 1 6 -6z" /></TI>;
const IconSparkles = ({ size }) => <TI size={size}><path d="M10.5 2l1.67 4.83l4.83 1.67l-4.83 1.67l-1.67 4.83l-1.67 -4.83l-4.83 -1.67l4.83 -1.67l1.67 -4.83z" /><path d="M17.5 13l1 2.5l2.5 1l-2.5 1l-1 2.5l-1 -2.5l-2.5 -1l2.5 -1l1 -2.5z" /></TI>;
const IconSunrise = ({ size }) => <TI size={size}><path d="M12 19a1 1 0 0 1 .993 .883l.007 .117v1a1 1 0 0 1 -1.993 .117l-.007 -.117v-1a1 1 0 0 1 1 -1z" /><path d="M18.313 16.91l.094 .083l.7 .7a1 1 0 0 1 -1.32 1.497l-.094 -.083l-.7 -.7a1 1 0 0 1 1.218 -1.567l.102 .07z" /><path d="M7.007 16.993a1 1 0 0 1 .083 1.32l-.083 .094l-.7 .7a1 1 0 0 1 -1.497 -1.32l.083 -.094l.7 -.7a1 1 0 0 1 1.414 0z" /><path d="M4 11a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1z" /><path d="M21 11a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1z" /><path d="M12 7a5 5 0 1 1 -4.995 5.217l-.005 -.217l.005 -.217a5 5 0 0 1 4.995 -4.783z" /></TI>;
const IconMoon = ({ size }) => <TI size={size}><path d="M12 1.992a10 10 0 1 1 -9.874 11.628c-.051 -.4 .182 -.756 .559 -.879c.345 -.113 .73 .005 .938 .281a6 6 0 0 0 8.373 1.328a6 6 0 0 0 2.272 -7.723a.746 .746 0 0 1 .271 -.942a.75 .75 0 0 1 .983 .071a10.002 10.002 0 0 1 -3.522 7.863z" /></TI>;
const IconTarget = ({ size }) => <TI size={size}><path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10 -10 10s-10 -4.477 -10 -10s4.477 -10 10 -10zm0 4a6 6 0 1 0 0 12a6 6 0 0 0 0 -12zm0 3a3 3 0 1 1 0 6a3 3 0 0 1 0 -6z" /></TI>;

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

function RoutineColumn({ icon, title, subtitle, steps, totalProducts, hideHeader = false }) {
  if (steps.length === 0) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      {!hideHeader ? (
        <div style={{ padding: '0 4px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.2 }}>{title}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalProducts}개</span>
          </div>
          {subtitle && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div>
          )}
        </div>
      ) : subtitle ? (
        <div style={{ padding: '0 4px', marginBottom: 10, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{subtitle}</div>
      ) : null}
      {steps.map(s => <StepBlock key={s.step} stepDef={s} />)}
    </div>
  );
}

export default function CareRecommendation({ products: productsProp, refreshKey = 0, hideHeader = false }) {
  const result = getLatestRecord();
  // 부모가 products를 prop으로 주면 실시간 반영. 없으면 1회 fetch (이전 호환).
  const userProducts = useMemo(() => {
    if (Array.isArray(productsProp)) return productsProp;
    try { return getProducts(); } catch { return []; }
  }, [productsProp, refreshKey]);

  const { morningSteps, nightSteps, morningStats, nightStats, hasManyProducts } = useMemo(() => {
    const rec = buildRoutineRecommendation(result, userProducts);
    return {
      morningSteps: rec.morning,
      nightSteps: rec.night,
      morningStats: rec.stats.morning,
      nightStats: rec.stats.night,
      hasManyProducts: rec.hasManyProducts,
    };
  }, [userProducts, result, refreshKey]);

  const interactions = useMemo(() => detectInteractions(userProducts), [userProducts, refreshKey]);

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
        <div style={{ marginBottom: 10 }}><IconBottle size={30} /></div>
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
        <div style={{ marginBottom: 8 }}><IconSearch size={28} /></div>
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
      {/* Section Header — hideHeader=true면 부모가 자체 헤더 노출 */}
      {!hideHeader && (
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
      )}

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
            icon: <IconAlert size={15} />,
            title: topConflict.title,
            advice: topConflict.advice,
            bg: topConflict.severity === 'high' ? 'rgba(232,140,140,0.22)' : 'rgba(240,180,120,0.2)',
            border: topConflict.severity === 'high' ? 'rgba(220,100,100,0.32)' : 'rgba(220,150,80,0.28)',
          };
        } else if (hasManyProducts) {
          pick = {
            type: 'overuse',
            icon: <IconBulb size={15} />,
            title: '제품이 많아요',
            advice: '각 단계 2개까지만 매일, 나머지는 주 2~3회 가끔 발라주세요.',
            bg: 'rgba(255,200,120,0.18)',
            border: 'rgba(255,180,80,0.25)',
          };
        } else if (topConflict) {
          pick = {
            type: 'conflict-low', severity: 'low',
            icon: <IconAlert size={15} />,
            title: topConflict.title,
            advice: topConflict.advice,
            bg: 'rgba(240,210,140,0.18)',
            border: 'rgba(220,180,80,0.25)',
          };
        } else if (topSynergy) {
          pick = {
            type: 'synergy',
            icon: <IconSparkles size={15} />,
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
            <span style={{ flexShrink: 0, lineHeight: 1.1, display: 'flex' }}>{pick.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{pick.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{pick.advice}</div>
            </div>
          </div>
        );
      })()}

      <RoutineTabs
        morningSteps={morningSteps}
        nightSteps={nightSteps}
        morningStats={morningStats}
        nightStats={nightStats}
      />

    </div>
  );
}

// 아침/저녁 루틴 탭 — 한 쪽만 있을 땐 탭 숨김(그 쪽만 노출).
function RoutineTabs({ morningSteps, nightSteps, morningStats, nightStats }) {
  const hasMorning = morningSteps.length > 0;
  const hasNight = nightSteps.length > 0;
  // 기본 활성 탭: 현재 시간 기준 18시 이후면 저녁, 아니면 아침. 활성 쪽이 비어있으면 반대로.
  const initial = (() => {
    const isEvening = new Date().getHours() >= 18;
    if (isEvening && hasNight) return 'night';
    if (!isEvening && hasMorning) return 'morning';
    return hasMorning ? 'morning' : 'night';
  })();
  const [tab, setTab] = useState(initial);

  // 한 쪽만 있으면 탭 없이 그 쪽만
  if (!hasMorning || !hasNight) {
    return hasMorning ? (
      <RoutineColumn
        icon={<IconSunrise size={18} />}
        title="아침 루틴"
        subtitle={morningStats.occasional > 0 ? `매일 ${morningStats.daily}개 · 가끔 ${morningStats.occasional}개` : `매일 ${morningStats.daily}개`}
        steps={morningSteps}
        totalProducts={morningStats.total}
      />
    ) : (
      <RoutineColumn
        icon={<IconMoon size={18} />}
        title="저녁 루틴"
        subtitle={nightStats.occasional > 0 ? `매일 ${nightStats.daily}개 · 가끔 ${nightStats.occasional}개` : `매일 ${nightStats.daily}개`}
        steps={nightSteps}
        totalProducts={nightStats.total}
      />
    );
  }

  const tabs = [
    { key: 'morning', label: '아침', icon: <IconSunrise size={15} />, count: morningStats.total },
    { key: 'night',   label: '저녁', icon: <IconMoon size={15} />,    count: nightStats.total },
  ];

  return (
    <>
      {/* 세그먼트 탭 — 글래스 카드 안에 두 칸. 활성 탭은 흰색 pill로 강조 */}
      <div style={{
        display: 'flex', gap: 4, padding: 4, marginBottom: 16,
        background: 'rgba(255,255,255,0.35)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.4)',
        borderRadius: 14,
      }}>
        {tabs.map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 0', borderRadius: 11, cursor: 'pointer',
                border: 'none',
                background: active ? 'rgba(255,255,255,0.85)' : 'transparent',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                color: active ? '#6598ef' : 'var(--text-secondary)',
                fontSize: 13.5, fontWeight: active ? 700 : 500,
                letterSpacing: -0.2,
                transition: 'background 0.18s ease, color 0.18s ease',
              }}
            >
              <span style={{ display: 'flex', opacity: active ? 1 : 0.55 }}>{t.icon}</span>
              <span>{t.label}</span>
              <span style={{
                fontSize: 10.5, fontWeight: 600,
                color: active ? '#6598ef' : 'var(--text-muted)',
                background: active ? 'rgba(101,152,239,0.14)' : 'rgba(0,0,0,0.05)',
                borderRadius: 8, padding: '2px 7px',
              }}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* 선택된 탭만 렌더링. 탭이 이미 아침/저녁을 노출하니 column 헤더는 숨김. */}
      {tab === 'morning' ? (
        <RoutineColumn
          icon={<IconSunrise size={18} />}
          title="아침 루틴"
          subtitle={morningStats.occasional > 0 ? `매일 ${morningStats.daily}개 · 가끔 ${morningStats.occasional}개` : `매일 ${morningStats.daily}개`}
          steps={morningSteps}
          totalProducts={morningStats.total}
          hideHeader
        />
      ) : (
        <RoutineColumn
          icon={<IconMoon size={18} />}
          title="저녁 루틴"
          subtitle={nightStats.occasional > 0 ? `매일 ${nightStats.daily}개 · 가끔 ${nightStats.occasional}개` : `매일 ${nightStats.daily}개`}
          steps={nightSteps}
          totalProducts={nightStats.total}
          hideHeader
        />
      )}
    </>
  );
}

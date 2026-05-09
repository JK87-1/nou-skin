import { useState, useEffect, useRef } from 'react';
import { getOrGenerateDiscoverPage, refreshDiscoverPage, getWeekRange, formatWeekLabel, getActiveDays, getDiscoverHistory } from '../engine/DiscoverEngine';

// ===== 페이지 진입 애니메이션 =====
function useReveal(delay = 0) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay * 1000); return () => clearTimeout(t); }, []);
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.4s ease ${delay}s, transform 0.4s ease ${delay}s`,
  };
}

// ===== 공통 글라스 카드 스타일 =====
const glass = {
  background: 'rgba(255,255,255,0.2)',
  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  borderRadius: 30,
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
};

// ===== 색상 시스템 (그라데이션은 유지하되 앱 톤에 맞게 연하게) =====
const COLORS = {
  hero: { gradient: 'linear-gradient(135deg, rgba(74,107,133,0.35) 0%, rgba(107,132,153,0.25) 100%)' },
  condition: { gradient: 'linear-gradient(135deg, rgba(255,232,176,0.4) 0%, rgba(252,246,224,0.3) 100%)' },
  sleep: { gradient: 'linear-gradient(135deg, rgba(200,218,232,0.4) 0%, rgba(229,238,245,0.3) 100%)' },
  activity: { gradient: 'linear-gradient(135deg, rgba(200,232,212,0.4) 0%, rgba(224,242,229,0.3) 100%)' },
  skin: { gradient: 'linear-gradient(135deg, rgba(255,212,212,0.4) 0%, rgba(255,235,235,0.3) 100%)' },
  discovery: { gradient: 'linear-gradient(135deg, rgba(252,246,224,0.35) 0%, rgba(255,248,224,0.25) 100%)' },
  trend: { gradient: 'linear-gradient(135deg, rgba(44,74,94,0.85) 0%, rgba(74,107,133,0.85) 100%)' },
  recommendation: { gradient: 'linear-gradient(135deg, rgba(255,235,224,0.35) 0%, rgba(255,244,237,0.25) 100%)' },
  bar: ['#4A6B85', '#B8865C', '#5e9d8a', '#C97C5E', '#E5E5E0'],
};

export default function DiscoveryPage() {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getOrGenerateDiscoverPage().then(data => {
      setPage(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const activeDays = getActiveDays();

  if (loading) return <SkeletonPage />;

  if (!page || page.status === 'insufficient_data') {
    return <InsufficientDataPage activeDays={activeDays} />;
  }

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100 }}>
      <Header weekLabel={page.weekLabel} weekNumber={page.weekNumber} />
      <Section1Hero hero={page.hero} />
      <Section2Metrics metrics={page.metrics} />
      {page.influenceFactors && <Section3Factors factors={page.influenceFactors} />}
      {page.discoveries?.length > 0 && <Section4Discoveries discoveries={page.discoveries} />}
      <Section5Trend trend={page.trend} />
      {page.recommendations?.length > 0 && <Section6Recommendations recommendations={page.recommendations} />}
      <Section7More hint={page.moreHint} />
    </div>
  );
}

// ===== 헤더 =====
function Header({ weekLabel, weekNumber }) {
  const style = useReveal(0);
  return (
    <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 20px 0', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>발견</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{weekLabel} (이번 주)</div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', padding: '4px 10px', background: 'rgba(255,255,255,0.15)', borderRadius: 100, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          {weekNumber}번째 발견
        </div>
      </div>
    </div>
  );
}

// ===== 섹션 1: 히어로 =====
function Section1Hero({ hero }) {
  const style = useReveal(0.1);
  const [tapped, setTapped] = useState(false);

  return (
    <div style={{ padding: '14px 20px 0', ...style }}>
      <div
        onClick={() => { setTapped(true); setTimeout(() => setTapped(false), 200); }}
        style={{
          ...glass,
          background: COLORS.hero.gradient,
          padding: 20, color: 'var(--text-primary)', position: 'relative', overflow: 'hidden',
          transform: tapped ? 'scale(1.02)' : 'scale(1)',
          transition: 'transform 0.2s ease-out',
        }}
      >
        {/* 장식 원 */}
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 30, width: 60, height: 60, background: 'rgba(255,255,255,0.06)', borderRadius: '50%' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>✨ 이번 주 발견</div>
          <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.4, marginBottom: 8, whiteSpace: 'pre-line', color: 'var(--text-primary)' }}>
            {hero?.headline || '이번 주도\n잘 보내고 계세요'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {hero?.summary || '데이터를 분석 중이에요'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 섹션 2: 2열 그리드 =====
function Section2Metrics({ metrics }) {
  if (!metrics || metrics.length === 0) return null;

  return (
    <div style={{ padding: '10px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {metrics.map((m, i) => (
        <MetricCard key={m.id} metric={m} delay={0.2 + i * 0.1} />
      ))}
    </div>
  );
}

function MetricCard({ metric, delay }) {
  const style = useReveal(delay);
  const [tapped, setTapped] = useState(false);
  const colors = COLORS[metric.id] || COLORS.condition;
  const changeColor = metric.change?.direction === 'up' ? '#5e9d8a' : metric.change?.direction === 'down' ? '#C97C5E' : 'var(--text-muted)';
  const changeArrow = metric.change?.direction === 'up' ? '↑' : metric.change?.direction === 'down' ? '↓' : '→';

  let displayValue = metric.value;
  let displayUnit = metric.unit;
  if (metric.id === 'activity' && metric.value >= 1000) {
    displayValue = (metric.value / 1000).toFixed(1) + 'k';
    displayUnit = '보';
  }

  return (
    <div
      onClick={() => { setTapped(true); setTimeout(() => setTapped(false), 300); }}
      style={{
        ...glass,
        background: colors.gradient,
        aspectRatio: '1', borderRadius: 24, padding: 16,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transform: tapped ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 0.3s ease-out',
        ...style,
      }}
    >
      <div>
        <div style={{ fontSize: 16 }}>{metric.icon}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{metric.label}</div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{displayValue || '—'}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{displayUnit}</span>
        </div>
        {metric.change && metric.change.value !== 0 && (
          <div style={{ fontSize: 10, fontWeight: 500, color: changeColor, marginTop: 3 }}>
            {changeArrow} {metric.change.value > 0 ? '+' : ''}{metric.change.value} {metric.change.label}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== 섹션 3: 영향 요인 =====
function Section3Factors({ factors }) {
  const style = useReveal(0.4);

  if (!factors?.factors?.length) return null;

  const topFactor = factors.topFactor || factors.factors[0];

  return (
    <div style={{ padding: '10px 20px 0', ...style }}>
      <div style={{ ...glass, padding: 18 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>컨디션 영향 요인</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 3 }}>
              {topFactor.emoji} {topFactor.name}이 가장 커요
            </div>
          </div>
          <div style={{ fontSize: 10, padding: '4px 10px', background: 'rgba(255,255,255,0.15)', borderRadius: 100, color: 'var(--text-muted)' }}>
            탑 {Math.min(factors.factors.filter(f => f.name !== '기타').length, 3)}
          </div>
        </div>

        {/* 막대 그래프 */}
        <div style={{ display: 'flex', gap: 3, height: 14, borderRadius: 100, overflow: 'hidden', marginBottom: 12 }}>
          {factors.factors.map((f, i) => (
            <div key={f.name} style={{
              flex: f.percentage,
              background: f.color || COLORS.bar[i],
              borderRadius: i === 0 ? '100px 0 0 100px' : i === factors.factors.length - 1 ? '0 100px 100px 0' : 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'flex 0.6s ease',
            }}>
              {f.percentage > 15 && (
                <span style={{ fontSize: 8, color: 'white', fontWeight: 500 }}>{f.percentage}%</span>
              )}
            </div>
          ))}
        </div>

        {/* 범례 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          {factors.factors.map((f, i) => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: f.color || COLORS.bar[i] }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {f.emoji && <span style={{ marginRight: 2 }}>{f.emoji}</span>}
                {f.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== 섹션 4: 발견 3가지 =====
function Section4Discoveries({ discoveries }) {
  const style = useReveal(0.5);

  return (
    <div style={{ padding: '10px 20px 0', ...style }}>
      <div style={{ ...glass, background: COLORS.discovery.gradient, padding: 18 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 14 }}>🔍</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>본인만의 발견 {discoveries.length}가지</span>
        </div>

        {/* 카드 */}
        {discoveries.map((d, i) => (
          <DiscoveryCard key={i} discovery={d} index={i} />
        ))}
      </div>
    </div>
  );
}

function DiscoveryCard({ discovery, index }) {
  const num = String(index + 1).padStart(2, '0');

  const renderMessage = (msg) => {
    if (!msg) return null;
    const parts = msg.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1
        ? <strong key={i} style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{part}</strong>
        : <span key={i}>{part}</span>
    );
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.25)', borderRadius: 16, padding: 12, marginBottom: index < 2 ? 8 : 0,
      display: 'flex', alignItems: 'flex-start', gap: 10,
      border: '1px solid rgba(255,255,255,0.2)',
    }}>
      <span style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 700, minWidth: 20, lineHeight: '20px', fontFamily: 'var(--font-display)' }}>{num}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>
          {renderMessage(discovery.message)}
        </div>
      </div>
    </div>
  );
}

// ===== 섹션 5: 4주 트렌드 =====
function Section5Trend({ trend }) {
  const style = useReveal(0.7);
  const [barsGrown, setBarsGrown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarsGrown(true), 800);
    return () => clearTimeout(t);
  }, []);

  if (!trend?.weeks) return null;

  const maxVal = Math.max(...trend.weeks.map(w => w.value), 1);

  return (
    <div style={{ padding: '10px 20px 0', ...style }}>
      <div style={{ ...glass, background: COLORS.trend.gradient, padding: 18, color: 'white' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 14 }}>📈</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>4주 트렌드 — {trend.trendDescription}</span>
        </div>

        {/* 막대 차트 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 60, marginBottom: 10 }}>
          {trend.weeks.map((w, i) => {
            const heightPct = maxVal > 0 ? (w.value / maxVal) * 100 : 10;
            const isCurrent = w.isCurrent;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                {w.value > 0 && (
                  <span style={{ fontSize: 9, color: isCurrent ? '#FFE8B0' : 'rgba(255,255,255,0.6)' }}>
                    {w.value}
                  </span>
                )}
                <div style={{
                  width: '100%',
                  height: barsGrown ? `${Math.max(heightPct, 8)}%` : '4%',
                  background: isCurrent ? 'linear-gradient(180deg, #FFE8B0, #FCF6E0)' : 'rgba(255,255,255,0.25)',
                  borderRadius: '6px 6px 0 0',
                  transition: `height 0.6s ease ${i * 0.1}s`,
                }} />
              </div>
            );
          })}
        </div>

        {/* 라벨 */}
        <div style={{ display: 'flex', gap: 8 }}>
          {trend.weeks.map((w, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: w.isCurrent ? '#FFE8B0' : 'rgba(255,255,255,0.6)', fontWeight: w.isCurrent ? 600 : 400 }}>
              {w.label}
            </div>
          ))}
        </div>

        {/* 캡션 */}
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 10 }}>
          {trend.caption}
        </div>
      </div>
    </div>
  );
}

// ===== 섹션 6: 추천 행동 =====
function Section6Recommendations({ recommendations }) {
  const style = useReveal(0.9);
  const scrollRef = useRef(null);

  const RANK_BADGES = { 1: '⭐ 가장 효과', 2: '2순위', 3: '3순위' };
  const CATEGORY_ICONS = { activity: '🏃', sleep: '😴', caffeine: '☕', water: '💧', meal: '🍽', supplement: '💊', condition: '⚡' };

  return (
    <div style={{ padding: '10px 20px 0', ...style }}>
      <div style={{ ...glass, background: COLORS.recommendation.gradient, padding: 18 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 14 }}>🎯</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>이번 주 추천 행동</span>
        </div>

        {/* 가로 스크롤 */}
        <div ref={scrollRef} style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
          scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {recommendations.map((rec, i) => (
            <div key={i} style={{
              flexShrink: 0, width: 140, background: 'rgba(255,255,255,0.3)', borderRadius: 20, padding: 14,
              border: '1px solid rgba(255,255,255,0.25)', scrollSnapAlign: 'start',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--accent-primary)', fontWeight: 600, marginBottom: 6 }}>
                {RANK_BADGES[rec.rank] || `${rec.rank}순위`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[rec.category] || '🎯'}</span>
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{rec.title}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {rec.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== 섹션 7: 더 알아내려면 =====
function Section7More({ hint }) {
  const style = useReveal(1.0);

  if (!hint) return null;

  return (
    <div style={{ padding: '10px 20px 0', ...style }}>
      <div style={{
        ...glass, padding: 14,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 24 }}>💡</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{hint.title}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{hint.description}</div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 500 }}>→</span>
      </div>
    </div>
  );
}

// ===== 데이터 부족 페이지 =====
function InsufficientDataPage({ activeDays }) {
  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 20px 0' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>발견</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>매주 새로운 발견을 보여드려요</div>
      </div>
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ ...glass, padding: 30 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>당신의 패턴을 함께 찾아갈게요</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
            매일 기록을 쌓으면 나만의 패턴과 인사이트를 발견할 수 있어요
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>기록 진행률</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-primary)' }}>{activeDays}/7일</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: 'var(--accent-primary)', width: `${Math.min((activeDays / 7) * 100, 100)}%`, transition: 'width 0.5s ease' }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {7 - activeDays}일 더 기록하면 첫 번째 발견을 보여드릴게요
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 스켈레톤 로딩 =====
function SkeletonPage() {
  const shimmer = {
    background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.1) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 30,
  };

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100 }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 20px 0' }}>
        <div style={{ ...shimmer, width: 60, height: 26, marginBottom: 6, borderRadius: 8 }} />
        <div style={{ ...shimmer, width: 120, height: 14, borderRadius: 6 }} />
      </div>
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ ...shimmer, height: 130 }} />
      </div>
      <div style={{ padding: '10px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ ...shimmer, aspectRatio: '1', borderRadius: 24 }} />
        <div style={{ ...shimmer, aspectRatio: '1', borderRadius: 24 }} />
      </div>
      <div style={{ padding: '10px 20px 0' }}>
        <div style={{ ...shimmer, height: 110 }} />
      </div>
      <div style={{ padding: '10px 20px 0' }}>
        <div style={{ ...shimmer, height: 150 }} />
      </div>
      <div style={{ padding: '10px 20px 0' }}>
        <div style={{ ...shimmer, height: 110 }} />
      </div>
    </div>
  );
}

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

// ===== 색상 시스템 =====
const COLORS = {
  hero: { gradient: 'linear-gradient(135deg, #4A6B85 0%, #6B8499 100%)' },
  condition: { gradient: 'linear-gradient(135deg, #FFE8B0 0%, #FCF6E0 100%)', dark: '#6b4a2a', muted: '#a08c6b' },
  sleep: { gradient: 'linear-gradient(135deg, #C8DAE8 0%, #E5EEF5 100%)', dark: '#2c4a5e', muted: '#6b8499' },
  activity: { gradient: 'linear-gradient(135deg, #C8E8D4 0%, #E0F2E5 100%)', dark: '#2c5e3a', muted: '#6b9080' },
  skin: { gradient: 'linear-gradient(135deg, #FFD4D4 0%, #FFEBEB 100%)', dark: '#7a3a3a', muted: '#a86b6b' },
  discovery: { gradient: 'linear-gradient(135deg, #FCF6E0 0%, #FFF8E0 100%)' },
  trend: { gradient: 'linear-gradient(135deg, #2c4a5e 0%, #4A6B85 100%)' },
  recommendation: { gradient: 'linear-gradient(135deg, #FFEBE0 0%, #FFF4ED 100%)' },
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

  // 로딩
  if (loading) return <SkeletonPage />;

  // 7일 미만
  if (!page || page.status === 'insufficient_data') {
    return <InsufficientDataPage activeDays={activeDays} />;
  }

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100, background: 'linear-gradient(180deg, #E8F1F7 0%, #F4F8FB 100%)' }}>
      {/* 헤더 */}
      <Header weekLabel={page.weekLabel} weekNumber={page.weekNumber} />

      {/* 섹션 1: 히어로 */}
      <Section1Hero hero={page.hero} />

      {/* 섹션 2: 2열 그리드 */}
      <Section2Metrics metrics={page.metrics} />

      {/* 섹션 3: 영향 요인 */}
      {page.influenceFactors && <Section3Factors factors={page.influenceFactors} />}

      {/* 섹션 4: 발견 3가지 */}
      {page.discoveries?.length > 0 && <Section4Discoveries discoveries={page.discoveries} />}

      {/* 섹션 5: 4주 트렌드 */}
      <Section5Trend trend={page.trend} />

      {/* 섹션 6: 추천 행동 */}
      {page.recommendations?.length > 0 && <Section6Recommendations recommendations={page.recommendations} />}

      {/* 섹션 7: 더 알아내려면 */}
      <Section7More hint={page.moreHint} />
    </div>
  );
}

// ===== 헤더 =====
function Header({ weekLabel, weekNumber }) {
  const style = useReveal(0);
  return (
    <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2c4a5e' }}>발견</div>
          <div style={{ fontSize: 10, color: '#6b8499', marginTop: 2 }}>{weekLabel} (이번 주)</div>
        </div>
        <div style={{ fontSize: 9, color: '#8ba6bd', padding: '4px 8px', background: 'rgba(255,255,255,0.6)', borderRadius: 100 }}>
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
          background: COLORS.hero.gradient,
          borderRadius: 20, padding: 18, color: 'white', position: 'relative', overflow: 'hidden',
          transform: tapped ? 'scale(1.02)' : 'scale(1)',
          transition: 'transform 0.2s ease-out',
        }}
      >
        {/* 장식 원 */}
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 30, width: 60, height: 60, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>✨ 이번 주 발견</div>
          <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3, marginBottom: 8, whiteSpace: 'pre-line' }}>
            {hero?.headline || '이번 주도\n잘 보내고 계세요'}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
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
    <div style={{ padding: '12px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
  const changeColor = metric.change?.direction === 'up' ? '#5e9d8a' : metric.change?.direction === 'down' ? '#C97C5E' : '#8ba6bd';
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
        aspectRatio: '1', background: colors.gradient, borderRadius: 16, padding: 14,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transform: tapped ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 0.3s ease-out',
        ...style,
      }}
    >
      <div>
        <div style={{ fontSize: 14 }}>{metric.icon}</div>
        <div style={{ fontSize: 9, color: colors.dark, marginTop: 4, fontWeight: 500 }}>{metric.label}</div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: colors.dark }}>{displayValue || '—'}</span>
          <span style={{ fontSize: 11, color: colors.muted }}>{displayUnit}</span>
        </div>
        {metric.change && metric.change.value !== 0 && (
          <div style={{ fontSize: 9, fontWeight: 500, color: changeColor, marginTop: 2 }}>
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
    <div style={{ padding: '12px 20px 0', ...style }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 14 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, color: '#6b8499' }}>컨디션 영향 요인</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2c4a5e', marginTop: 2 }}>
              {topFactor.emoji} {topFactor.name}이 가장 커요
            </div>
          </div>
          <div style={{ fontSize: 9, padding: '3px 8px', background: '#F4F8FB', borderRadius: 100, color: '#6b8499' }}>
            탑 {Math.min(factors.factors.filter(f => f.name !== '기타').length, 3)}
          </div>
        </div>

        {/* 막대 그래프 */}
        <div style={{ display: 'flex', gap: 3, height: 14, borderRadius: 100, overflow: 'hidden', marginBottom: 10 }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
          {factors.factors.map((f, i) => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: 2, background: f.color || COLORS.bar[i] }} />
              <span style={{ fontSize: 9, color: '#6b8499' }}>
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
    <div style={{ padding: '12px 20px 0', ...style }}>
      <div style={{ background: COLORS.discovery.gradient, borderRadius: 16, padding: 14 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>🔍</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#6b4a2a' }}>본인만의 발견 {discoveries.length}가지</span>
        </div>

        {/* 카드 */}
        {discoveries.map((d, i) => (
          <DiscoveryCard key={i} discovery={d} index={i} delay={0.5 + i * 0.1} />
        ))}
      </div>
    </div>
  );
}

function DiscoveryCard({ discovery, index }) {
  const num = String(index + 1).padStart(2, '0');

  // **강조** 처리
  const renderMessage = (msg) => {
    if (!msg) return null;
    const parts = msg.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1
        ? <strong key={i} style={{ color: '#6b4a2a', fontWeight: 600 }}>{part}</strong>
        : <span key={i}>{part}</span>
    );
  };

  return (
    <div style={{
      background: 'white', borderRadius: 10, padding: 10, marginBottom: index < 2 ? 6 : 0,
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <span style={{ fontSize: 10, color: '#6b4a2a', fontWeight: 600, minWidth: 18, lineHeight: '18px' }}>{num}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: '#2c4a5e', lineHeight: 1.5 }}>
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
    <div style={{ padding: '12px 20px 0', ...style }}>
      <div style={{ background: COLORS.trend.gradient, borderRadius: 16, padding: 14, color: 'white' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>📈</span>
          <span style={{ fontSize: 11, fontWeight: 600 }}>4주 트렌드 — {trend.trendDescription}</span>
        </div>

        {/* 막대 차트 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60, marginBottom: 8 }}>
          {trend.weeks.map((w, i) => {
            const heightPct = maxVal > 0 ? (w.value / maxVal) * 100 : 10;
            const isCurrent = w.isCurrent;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                {w.value > 0 && (
                  <span style={{ fontSize: 8, color: isCurrent ? '#FFE8B0' : 'rgba(255,255,255,0.6)' }}>
                    {w.value}
                  </span>
                )}
                <div style={{
                  width: '100%',
                  height: barsGrown ? `${Math.max(heightPct, 8)}%` : '4%',
                  background: isCurrent ? 'linear-gradient(180deg, #FFE8B0, #FCF6E0)' : 'rgba(255,255,255,0.3)',
                  borderRadius: '4px 4px 0 0',
                  transition: `height 0.6s ease ${i * 0.1}s`,
                }} />
              </div>
            );
          })}
        </div>

        {/* 라벨 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {trend.weeks.map((w, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 8, color: w.isCurrent ? '#FFE8B0' : 'rgba(255,255,255,0.6)', fontWeight: w.isCurrent ? 500 : 400 }}>
              {w.label}
            </div>
          ))}
        </div>

        {/* 캡션 */}
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', marginTop: 8 }}>
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
    <div style={{ padding: '12px 20px 0', ...style }}>
      <div style={{ background: COLORS.recommendation.gradient, borderRadius: 16, padding: 14 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>🎯</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#7a3a1d' }}>이번 주 추천 행동</span>
        </div>

        {/* 가로 스크롤 */}
        <div ref={scrollRef} style={{
          display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
          scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {recommendations.map((rec, i) => (
            <div key={i} style={{
              flexShrink: 0, width: 130, background: 'white', borderRadius: 12, padding: 10,
              border: '0.5px solid #FFC8A8', scrollSnapAlign: 'start',
            }}>
              <div style={{ fontSize: 9, color: '#7a3a1d', fontWeight: 600, marginBottom: 4 }}>
                {RANK_BADGES[rec.rank] || `${rec.rank}순위`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 12 }}>{CATEGORY_ICONS[rec.category] || '🎯'}</span>
                <span style={{ fontSize: 11, color: '#2c4a5e', fontWeight: 500 }}>{rec.title}</span>
              </div>
              <div style={{ fontSize: 9, color: '#6b8499', lineHeight: 1.4 }}>
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
    <div style={{ padding: '12px 20px 0', ...style }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: 12,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 24 }}>💡</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#2c4a5e', fontWeight: 500 }}>{hint.title}</div>
          <div style={{ fontSize: 9, color: '#6b8499', marginTop: 2 }}>{hint.description}</div>
        </div>
        <span style={{ fontSize: 10, color: '#4A6B85', fontWeight: 500 }}>→</span>
      </div>
    </div>
  );
}

// ===== 데이터 부족 페이지 =====
function InsufficientDataPage({ activeDays }) {
  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100, background: 'linear-gradient(180deg, #E8F1F7 0%, #F4F8FB 100%)' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#2c4a5e' }}>발견</div>
        <div style={{ fontSize: 10, color: '#6b8499', marginTop: 2 }}>매주 새로운 발견을 보여드려요</div>
      </div>
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 30 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#2c4a5e', marginBottom: 8 }}>당신의 패턴을 함께 찾아갈게요</div>
          <div style={{ fontSize: 13, color: '#6b8499', lineHeight: 1.6, marginBottom: 20 }}>
            매일 기록을 쌓으면 나만의 패턴과 인사이트를 발견할 수 있어요
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#6b8499' }}>기록 진행률</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#4A6B85' }}>{activeDays}/7일</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #4A6B85, #6B8499)', width: `${Math.min((activeDays / 7) * 100, 100)}%`, transition: 'width 0.5s ease' }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#8ba6bd' }}>
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
    background: 'linear-gradient(90deg, #e8eef3 25%, #f0f4f8 50%, #e8eef3 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 12,
  };

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100, background: 'linear-gradient(180deg, #E8F1F7 0%, #F4F8FB 100%)' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0' }}>
        <div style={{ ...shimmer, width: 60, height: 24, marginBottom: 6 }} />
        <div style={{ ...shimmer, width: 120, height: 12 }} />
      </div>
      <div style={{ padding: '14px 20px 0' }}>
        <div style={{ ...shimmer, height: 120, borderRadius: 20 }} />
      </div>
      <div style={{ padding: '12px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ ...shimmer, aspectRatio: '1', borderRadius: 16 }} />
        <div style={{ ...shimmer, aspectRatio: '1', borderRadius: 16 }} />
      </div>
      <div style={{ padding: '12px 20px 0' }}>
        <div style={{ ...shimmer, height: 100, borderRadius: 16 }} />
      </div>
      <div style={{ padding: '12px 20px 0' }}>
        <div style={{ ...shimmer, height: 140, borderRadius: 16 }} />
      </div>
      <div style={{ padding: '12px 20px 0' }}>
        <div style={{ ...shimmer, height: 100, borderRadius: 16 }} />
      </div>
    </div>
  );
}

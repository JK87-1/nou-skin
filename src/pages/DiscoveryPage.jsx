import { useState, useEffect, useRef, useMemo } from 'react';
import { getOrGenerateDiscoverPage, refreshDiscoverPage, getWeekRange, formatWeekLabel, getActiveDays, getDiscoverHistory } from '../engine/DiscoverEngine';
import { IconShare, IconGridPattern, IconSparkles, IconTrendingUp, IconBulb, IconMoodSmile, IconMoon, IconDroplet, IconCoffee, IconApple, IconScale, IconArrowsShuffle, IconVs, IconArrowRight, IconChartBar, IconCalendarStats, IconHeart } from '@tabler/icons-react';
import { getProfile } from '../storage/ProfileStorage';

// ===== 애니메이션 =====
function useReveal(delay = 0) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay * 1000); return () => clearTimeout(t); }, []);
  return { opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: `opacity 0.4s ease ${delay}s, transform 0.4s ease ${delay}s` };
}

// ===== 카테고리 색상 =====
const CAT_DOTS = { all: '#042C53', condition: '#534AB7', sleep: '#378ADD', skin: '#ED93B1', caffeine: '#BA7517', meal: '#639922' };
const FOLDER_TABS = [
  { key: 'all', label: '전체' },
  { key: 'condition', label: '컨디션' },
  { key: 'sleep', label: '수면' },
  { key: 'skin', label: '피부' },
];

// ===== 통계 카테고리 =====
const STAT_CATS = [
  { key: 'condition', Icon: IconMoodSmile, color: '#534AB7', label: '컨디션' },
  { key: 'water', Icon: IconDroplet, color: '#378ADD', label: '수분' },
  { key: 'caffeine', Icon: IconCoffee, color: '#BA7517', label: '카페인' },
  { key: 'meal', Icon: IconApple, color: '#639922', label: '식사' },
  { key: 'sleep', Icon: IconMoon, color: '#534AB7', label: '수면' },
  { key: 'weight', Icon: IconScale, color: '#8B95A1', label: '체중' },
];

export default function DiscoveryPage() {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('insight');
  const [activeCat, setActiveCat] = useState('all');

  useEffect(() => {
    setLoading(true);
    getOrGenerateDiscoverPage().then(data => { setPage(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const activeDays = getActiveDays();
  const profile = getProfile();
  const nickname = profile.nickname || '';

  // 월간 통계 데이터 (hooks는 early return 전에 호출해야 함)
  const monthlyStats = useMemo(() => {
    try {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const lastMonth = now.getMonth() === 0 ? `${now.getFullYear() - 1}-12` : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;
      const recs = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
      const checks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
      const drinks = JSON.parse(localStorage.getItem('lua_drink_records') || '{}');
      const body = JSON.parse(localStorage.getItem('lua_body_records') || '[]');

      const getMonthAvg = (month, field) => {
        const vals = [];
        Object.keys(recs).filter(k => k.startsWith(month)).forEach(k => { if (recs[k]?.[field]) vals.push(typeof recs[k][field] === 'object' ? recs[k][field].hours || 0 : recs[k][field]); });
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      };
      const getCondAvg = (month) => {
        const vals = checks.filter(c => (c.date || '').startsWith(month)).map(c => ((c.energy || c.에너지 || 0) + (c.mood || c.기분 || 0) + (c.skin || c.피부 || 0) + (c.gut || c.소화 || 0)) / 4).filter(v => v > 0);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      };
      const getWaterAvg = (month) => {
        const vals = Object.keys(recs).filter(k => k.startsWith(month)).map(k => (recs[k]?.water?.cups || 0) * 250).filter(v => v > 0);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      };
      const getCafAvg = (month) => {
        const vals = Object.keys(drinks).filter(k => k.startsWith(month)).map(k => {
          return (drinks[k]?.caffeine || []).reduce((s, d) => s + (({ espresso: 150, americano: 150, latte: 150, drip: 130, coldbrew: 200, matcha: 70, green_tea: 30, black_tea: 50, energy_drink: 160 })[d.key] || 100) * (d.count || 0), 0);
        }).filter(v => v > 0);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      };

      const thisCond = getCondAvg(thisMonth); const lastCond = getCondAvg(lastMonth);
      const thisSleep = getMonthAvg(thisMonth, 'sleep'); const lastSleep = getMonthAvg(lastMonth, 'sleep');
      const daysRecorded = new Set(Object.keys(recs).filter(k => k.startsWith(thisMonth))).size;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const latestWeight = body.length > 0 ? body[body.length - 1] : null;
      const firstWeight = body.filter(b => b.date?.startsWith(thisMonth))[0];
      const weightChange = latestWeight && firstWeight ? latestWeight.weight - firstWeight.weight : null;

      return {
        avgCond: thisCond, condChange: lastCond > 0 ? thisCond - lastCond : null,
        avgSleep: thisSleep, sleepChange: lastSleep > 0 ? thisSleep - lastSleep : null,
        daysRecorded, daysInMonth, weightChange,
        catAvgs: {
          condition: { avg: thisCond > 0 ? thisCond.toFixed(1) : '—', label: `평균 ${thisCond > 0 ? thisCond.toFixed(1) : '—'}` },
          water: { avg: getWaterAvg(thisMonth), label: `평균 ${getWaterAvg(thisMonth) > 0 ? (getWaterAvg(thisMonth) / 1000).toFixed(2) + 'L' : '—'}` },
          caffeine: { avg: getCafAvg(thisMonth), label: `평균 ${getCafAvg(thisMonth) > 0 ? Math.round(getCafAvg(thisMonth)) + 'mg' : '—'}` },
          meal: { avg: 0, label: `기록 ${daysRecorded}일` },
          sleep: { avg: thisSleep, label: `평균 ${thisSleep > 0 ? thisSleep.toFixed(1) + 'h' : '—'}` },
          weight: { avg: latestWeight?.weight || 0, label: latestWeight ? `${latestWeight.weight}kg` : '—' },
        },
        month: now.getMonth() + 1,
        warmMsg: thisCond > lastCond && thisSleep > lastSleep ? '지난 달보다 컨디션과 수면이 좋아졌어요. 꾸준히 기록해주신 덕분이에요'
          : thisCond > lastCond ? '컨디션이 좋아지고 있어요. 이 흐름을 이어가세요'
          : '꾸준한 기록이 변화의 시작이에요. 함께 해줘서 고마워요',
      };
    } catch { return null; }
  }, []);

  if (loading) return <SkeletonPage />;
  if (!page || page.status === 'insufficient_data') return <InsufficientDataPage activeDays={activeDays} />;

  const insightCount = (page.discoveries?.length || 0) + (page.recommendations?.length || 0);

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100 }}>

      {/* 1. 헤더 */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(0,0,0,0.35)' }}>{page.weekLabel} 리포트</div>
          <IconShare size={14} color="var(--text-muted)" style={{ cursor: 'pointer' }} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0D3028', letterSpacing: -0.3, marginBottom: 4, lineHeight: 1.35 }}>
          {nickname ? `${nickname}님의 패턴을\n발견했어요` : '이번 주 패턴을\n발견했어요'}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {insightCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.5)', fontSize: 11, color: 'rgba(0,0,0,0.35)', fontWeight: 500 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', marginRight: 4 }}>{insightCount}개</span> 인사이트
            </span>
          )}
          {page.weekNumber && (
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '5px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.5)', fontSize: 11, color: 'rgba(0,0,0,0.35)', fontWeight: 500 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#534AB7', marginRight: 4 }}>{page.weekNumber}번째</span> 발견
            </span>
          )}
        </div>
      </div>

      {/* 2. 세그먼트 탭 (인사이트/통계) */}
      {(() => {
        const modeTabs = [{ key: 'insight', label: '인사이트' }, { key: 'stats', label: '통계' }];
        const modeIdx = modeTabs.findIndex(t => t.key === mode);
        const modePos = modeIdx === 0 ? 'first' : modeIdx === modeTabs.length - 1 ? 'last' : 'mid';
        return (
          <>
            <div style={{ padding: '12px 10px 0' }}>
              <div className="segment-control" data-active={modePos}>
                {modeTabs.map(tab => (
                  <button key={tab.key} className={`segment-btn${mode === tab.key ? ' active' : ''}`}
                    onClick={() => setMode(tab.key)}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="tab-content-panel" data-active={modePos}>
              <div style={{ padding: '0 14px' }}>

                {/* ===== 인사이트 모드 ===== */}
                {mode === 'insight' && (() => {
                  const catIdx = FOLDER_TABS.findIndex(t => t.key === activeCat);
                  const catPos = catIdx === 0 ? 'first' : catIdx === FOLDER_TABS.length - 1 ? 'last' : 'mid';
                  return <>
                    {/* 카테고리 세그먼트 */}
                    <div style={{ padding: '12px 0 0' }}>
                      <div className="segment-control" data-active={catPos}>
                        {FOLDER_TABS.map(tab => (
                          <button key={tab.key} className={`segment-btn${activeCat === tab.key ? ' active' : ''}`}
                            onClick={() => setActiveCat(tab.key)}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: CAT_DOTS[tab.key] }} />
                              {tab.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* 히어로 */}
                    <HeroCard hero={page.hero} />
                    {/* 2열 지표 */}
                    <MetricsGrid metrics={page.metrics} />
                    {/* 영향 요인 */}
                    {page.influenceFactors && <FactorsCard factors={page.influenceFactors} onStatsClick={() => setMode('stats')} />}
                    {/* 발견 3가지 */}
                    {page.discoveries?.length > 0 && <DiscoveriesCard discoveries={page.discoveries} />}
                    {/* 4주 트렌드 */}
                    {page.trend && <TrendCard trend={page.trend} />}
                    {/* 추천 행동 */}
                    {page.recommendations?.length > 0 && <RecommendationsCard recommendations={page.recommendations} />}
                    {/* 더 알아내려면 */}
                    {page.moreHint && <MoreHintCard hint={page.moreHint} />}
                  </>;
                })()}

                {/* ===== 통계 모드 ===== */}
                {mode === 'stats' && <>
                  <StatsCategoryGrid catAvgs={monthlyStats?.catAvgs} />
                  {monthlyStats && <MonthlyChangeCard stats={monthlyStats} />}
                  <CompareCard />
                </>}

              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ===== 인사이트 섹션 컴포넌트 =====

const _dcs = { background: 'var(--card-bg)', borderRadius: 30, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: 'var(--card-border)', boxShadow: 'var(--card-shadow)' };

function HeroCard({ hero }) {
  const [tapped, setTapped] = useState(false);
  return (
    <div onClick={() => { setTapped(true); setTimeout(() => setTapped(false), 200); }}
      style={{ ..._dcs, padding: '20px', marginBottom: 15, overflow: 'hidden', transform: tapped ? 'scale(1.02)' : 'scale(1)', transition: 'transform 0.2s ease-out', cursor: 'pointer' }}>
      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 8, whiteSpace: 'pre-line', letterSpacing: -0.2 }}>
        {hero?.headline || '이번 주도\n잘 보내고 계세요'}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>{hero?.summary || ''}</div>
    </div>
  );
}

function MetricsGrid({ metrics }) {
  if (!metrics?.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 15 }}>
      {metrics.map(m => {
        const changeColor = m.change?.direction === 'up' ? '#639922' : m.change?.direction === 'down' ? '#A32D2D' : 'var(--text-muted)';
        const arrow = m.change?.direction === 'up' ? '↑' : m.change?.direction === 'down' ? '↓' : '';
        let val = m.value;
        if (m.id === 'activity' && m.value >= 1000) val = (m.value / 1000).toFixed(1) + 'k';
        return (
          <div key={m.id} style={{ ..._dcs, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 16 }}>{m.icon}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.label}</div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{val || '—'}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.unit}</span>
              </div>
              {m.change?.value !== 0 && <div style={{ fontSize: 10, color: changeColor, marginTop: 3 }}>{arrow} {m.change?.value > 0 ? '+' : ''}{m.change?.value} {m.change?.label}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FactorsCard({ factors, onStatsClick }) {
  if (!factors?.factors?.length) return null;
  const topFactor = factors.topFactor || factors.factors[0];
  return (
    <div style={{ ..._dcs, padding: '18px 20px', marginBottom: 15 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconGridPattern size={13} color="#534AB7" />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>컨디션 영향 요인</span>
        </div>
        <span style={{ background: '#FAEEDA', color: '#854F0B', fontSize: 9, padding: '2px 7px', borderRadius: 6 }}>탑 {factors.factors.filter(f => f.name !== '기타').length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {factors.factors.filter(f => f.name !== '기타').map((f, i) => {
          const isNeg = f.percentage < 0;
          const pct = Math.abs(f.percentage);
          return (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, minWidth: 44, color: 'var(--text-muted)' }}>{f.emoji} {f.name}</span>
              <div style={{ flex: 1, height: 12, background: isNeg ? '#FCEBEB' : '#F0F7FE', borderRadius: 6, overflow: 'hidden', display: 'flex', justifyContent: isNeg ? 'flex-end' : 'flex-start' }}>
                <div style={{ width: `${Math.max(pct, 8)}%`, height: '100%', background: isNeg ? '#E24B4A' : '#378ADD', borderRadius: 6, transition: 'width 0.6s ease' }} />
              </div>
              <span style={{ fontSize: 9, fontWeight: 500, minWidth: 28, textAlign: 'right', color: isNeg ? '#A32D2D' : '#185FA5' }}>{isNeg ? '-' : '+'}{pct}%</span>
            </div>
          );
        })}
      </div>
      <div onClick={onStatsClick} style={{ paddingTop: 8, borderTop: '0.5px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
        <IconChartBar size={11} color="#185FA5" />
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>영향 요인 통계 자세히 보기 →</span>
      </div>
    </div>
  );
}

function DiscoveriesCard({ discoveries }) {
  return (
    <div style={{ ..._dcs, padding: '18px 20px', marginBottom: 15 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <IconSparkles size={13} color="#534AB7" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>본인만의 발견</span>
      </div>
      {discoveries.map((d, i) => {
        const num = String(i + 1).padStart(2, '0');
        const parts = (d.message || '').split(/\*\*(.*?)\*\*/g);
        return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < discoveries.length - 1 ? 8 : 0 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#042C53', color: '#fff', fontSize: 9, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: 'var(--accent-primary)' }}>{p}</strong> : <span key={j}>{p}</span>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrendCard({ trend }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setGrown(true), 400); return () => clearTimeout(t); }, []);
  if (!trend?.weeks) return null;
  const maxVal = Math.max(...trend.weeks.map(w => w.value), 1);
  return (
    <div style={{ ..._dcs, padding: '18px 20px', marginBottom: 15 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <IconTrendingUp size={13} color="#639922" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>4주 트렌드 — {trend.trendDescription}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 50, gap: 6, marginBottom: 6 }}>
        {trend.weeks.map((w, i) => {
          const pct = maxVal > 0 ? (w.value / maxVal) * 100 : 10;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: grown ? `${Math.max(pct, 8)}%` : '4%', background: w.isCurrent ? '#378ADD' : '#B5D4F4', opacity: w.isCurrent ? 1 : 0.5, borderRadius: '3px 3px 0 0', transition: `height 0.6s ease ${i * 0.1}s` }} />
              <span style={{ fontSize: 8, color: w.isCurrent ? '#185FA5' : 'var(--text-dim)', fontWeight: w.isCurrent ? 500 : 400 }}>{w.label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>{trend.caption}</div>
    </div>
  );
}

function RecommendationsCard({ recommendations }) {
  const RANK = { 1: { bg: '#FAEEDA', label: '⭐ 가장 효과', labelColor: '#854F0B', titleColor: '#412402', descColor: '#854F0B' }, 2: { bg: '#F0F7FE', labelColor: '#185FA5', titleColor: '#042C53', descColor: '#185FA5' }, 3: { bg: '#F0F7FE', labelColor: '#185FA5', titleColor: '#042C53', descColor: '#185FA5' } };
  return (
    <div style={{ ..._dcs, padding: '18px 20px', marginBottom: 15 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <IconBulb size={13} color="#BA7517" />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>추천 행동</span>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none', paddingBottom: 4 }}>
        {recommendations.map((rec, i) => {
          const r = RANK[rec.rank] || RANK[3];
          return (
            <div key={i} style={{ minWidth: 160, borderRadius: 10, padding: 12, scrollSnapAlign: 'start', flexShrink: 0, background: r.bg }}>
              <div style={{ fontSize: 9, fontWeight: 500, color: r.labelColor, marginBottom: 6 }}>{rec.rank === 1 ? '⭐ 가장 효과' : `${rec.rank}순위`}</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: r.titleColor, lineHeight: 1.4, marginBottom: 4 }}>{rec.title}</div>
              <div style={{ fontSize: 10, color: r.descColor, lineHeight: 1.4 }}>{rec.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MoreHintCard({ hint }) {
  return (
    <div style={{ ..._dcs, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconBulb size={16} color="#BA7517" />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{hint.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint.description}</div>
        </div>
      </div>
      <IconArrowRight size={14} color="var(--text-muted)" />
    </div>
  );
}

// ===== 통계 모드 컴포넌트 =====

function StatsCategoryGrid({ catAvgs }) {
  return (
    <div style={{ ..._dcs, padding: '18px 20px', marginBottom: 15 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>어떤 지표를 자세히 볼까요?</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {STAT_CATS.map(cat => (
          <div key={cat.key} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 16, padding: '14px 8px', textAlign: 'center', cursor: 'pointer' }}>
            <cat.Icon size={22} color={cat.color} />
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', marginTop: 6 }}>{cat.label}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{catAvgs?.[cat.key]?.label || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyChangeCard({ stats }) {
  const changeEl = (val, change) => {
    if (change == null || change === 0) return null;
    return <span style={{ fontSize: 10, color: change > 0 ? '#639922' : '#A32D2D', marginLeft: 4 }}>{change > 0 ? '↑' : '↓'} {change > 0 ? '+' : ''}{change.toFixed(1)}</span>;
  };
  return (
    <div style={{ ..._dcs, padding: '18px 20px', marginBottom: 15 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconCalendarStats size={14} color="#534AB7" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>이번 달 변화</span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{stats.month}월</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[
          { label: '평균 컨디션', val: stats.avgCond > 0 ? stats.avgCond.toFixed(1) : '—', change: stats.condChange },
          { label: '평균 수면', val: stats.avgSleep > 0 ? stats.avgSleep.toFixed(1) + 'h' : '—', change: stats.sleepChange },
          { label: '기록 일수', val: `${stats.daysRecorded}일`, change: null },
          { label: '체중 변화', val: stats.weightChange != null ? `${stats.weightChange > 0 ? '+' : ''}${stats.weightChange.toFixed(1)}kg` : '—', change: null },
        ].map(m => (
          <div key={m.label} style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 16, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>{m.val}</span>
              {changeEl(m.val, m.change)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 16, padding: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {stats.warmMsg} <IconHeart size={12} color="var(--text-muted)" style={{ verticalAlign: -1 }} />
      </div>
    </div>
  );
}

function CompareCard() {
  return (
    <div style={{ ..._dcs, padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconArrowsShuffle size={14} color="#534AB7" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>두 지표 비교하기</span>
        </div>
        <span style={{ background: '#FAEEDA', color: '#854F0B', fontSize: 9, padding: '3px 8px', borderRadius: 8 }}>NEW</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.03)', padding: '8px 12px', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>기준</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>수면시간</div>
        </div>
        <IconVs size={14} color="var(--text-dim)" />
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.03)', padding: '8px 12px', borderRadius: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>비교</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>컨디션</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 8, cursor: 'pointer' }}>두 지표의 관계를 그래프로 보기 →</div>
    </div>
  );
}

// ===== 엣지케이스 =====

function InsufficientDataPage({ activeDays }) {
  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0D3028', letterSpacing: -0.3 }}>발견</div>
        <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.35)', marginTop: 2 }}>매주 새로운 발견을 보여드려요</div>
      </div>
      <div style={{ padding: '40px 18px', textAlign: 'center' }}>
        <div style={{ ..._dcs, padding: 30 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>당신의 패턴을 함께 찾아갈게요</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>매일 기록을 쌓으면 나만의 패턴과 인사이트를 발견할 수 있어요</div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>기록 진행률</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-primary)' }}>{activeDays}/7일</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: 'var(--accent-primary)', width: `${Math.min((activeDays / 7) * 100, 100)}%`, transition: 'width 0.5s ease' }} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{7 - activeDays}일 더 기록하면 첫 번째 발견을 보여드릴게요</div>
        </div>
      </div>
    </div>
  );
}

function SkeletonPage() {
  const sh = { background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.1) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', borderRadius: 12 };
  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100 }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div style={{ padding: '12px 16px' }}><div style={{ ...sh, height: 100 }} /></div>
      <div style={{ padding: '0 16px' }}><div style={{ ...sh, height: 40, marginBottom: 8 }} /><div style={{ ...sh, height: 400 }} /></div>
    </div>
  );
}

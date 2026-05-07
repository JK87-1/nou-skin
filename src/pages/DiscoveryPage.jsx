import { useState, useEffect } from 'react';
import { getOrGenerateInsights, refreshInsights, markShown, triggerLLMOnDataInput } from '../engine/InsightEngine';
import { getRecords } from '../storage/SkinStorage';
import { getEnabledCategories, getCategoryColor } from '../storage/ProfileStorage';
import { getConditionChecks, getEnergySubChecks, getMoodSubChecks, getSkinSubChecks } from '../storage/ConditionStorage';

const fadeUp = (delay = 0) => ({ animation: `breatheIn 0.5s ease ${delay}s both` });

const TYPE_COLORS = {
  pattern: '#B8865C',
  cross_analysis: '#5E9D8A',
  change_detection: '#C97C5E',
  positive: '#5E9D8A',
  action: '#4A6B85',
};

const cardStyle = {
  background: 'rgba(255,255,255,0.2)',
  borderRadius: 30,
  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
  padding: 20,
};

function getDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getActiveDays() {
  try {
    const records = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const foods = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
    const checks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
    const checkDates = new Set(checks.map(c => c.date || (c.timestamp && c.timestamp.slice(0, 10))).filter(Boolean));
    const allDates = new Set([...Object.keys(records), ...Object.keys(foods), ...checkDates]);
    return allDates.size;
  } catch { return 0; }
}

function getConditionSummary() {
  const checks = getEnergySubChecks();
  const moods = getMoodSubChecks();
  const last30 = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    last30.push(getDateKey(d));
  }
  const energyVals = [];
  const moodVals = [];
  last30.forEach(dk => {
    const e = checks.find(c => c.date === dk);
    if (e?.vitality) energyVals.push(e.vitality);
    const m = moods.find(c => c.date === dk);
    if (m?.stress) moodVals.push(m.stress);
  });
  const avgEnergy = energyVals.length > 0 ? (energyVals.reduce((a, b) => a + b, 0) / energyVals.length).toFixed(1) : null;
  const recentEnergy = energyVals.length >= 2 ? energyVals[0] - energyVals[energyVals.length - 1] : null;

  // 가장 큰 영향 요인 추정
  let topFactor = { name: '수면', percentage: 45, emoji: '😴' };
  try {
    const records = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const sleepDays = last30.filter(dk => records[dk]?.sleep?.hours > 0).length;
    const waterDays = last30.filter(dk => (records[dk]?.water?.cups || 0) > 0).length;
    if (waterDays > sleepDays) topFactor = { name: '수분', percentage: 40, emoji: '💧' };
  } catch {}

  return { avg: avgEnergy, trend: recentEnergy > 0 ? 'up' : recentEnergy < 0 ? 'down' : 'stable', trendValue: recentEnergy, topFactor, dataCount: energyVals.length };
}

function getSkinSummary() {
  const skinSubs = getSkinSubChecks();
  const last30 = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    last30.push(getDateKey(d));
  }
  const tagFreq = {};
  let troubleCount = 0;
  skinSubs.filter(s => last30.includes(s.date)).forEach(s => {
    (s.tags || []).forEach(t => { tagFreq[t] = (tagFreq[t] || 0) + 1; });
    if ((s.tags || []).includes('트러블')) troubleCount++;
  });
  const topTag = Object.entries(tagFreq).sort((a, b) => b[1] - a[1])[0];
  const SKIN_TAG_ICONS = { '촉촉': '💧', '건조': '🏜', '맑음': '✨', '트러블': '🔴', '칙칙': '🟡', '탄력': '🌊', '번들': '🌊', '예민': '😤' };

  let topFactor = { name: '수면', percentage: 50, emoji: '😴' };
  if (troubleCount >= 3) topFactor = { name: '식단', percentage: 40, emoji: '🍽' };

  return {
    troubleRate: skinSubs.length > 0 ? Math.round((troubleCount / skinSubs.length) * 100) : null,
    topTag: topTag ? { name: topTag[0], icon: SKIN_TAG_ICONS[topTag[0]] || '📊', count: topTag[1] } : null,
    topFactor,
    dataCount: skinSubs.filter(s => last30.includes(s.date)).length,
  };
}

function getSleepSummary() {
  const last30 = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    last30.push(getDateKey(d));
  }
  try {
    const records = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const sleepHours = last30.map(dk => records[dk]?.sleep?.hours).filter(h => h > 0);
    const avg = sleepHours.length > 0 ? (sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length).toFixed(1) : null;
    const recent = sleepHours.slice(0, 7);
    const older = sleepHours.slice(7, 14);
    const recentAvg = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : 0;
    const trend = recentAvg > olderAvg ? 'up' : recentAvg < olderAvg ? 'down' : 'stable';

    // 카페인 영향 추정
    let topFactor = { name: '취침 시간', percentage: 35, emoji: '🕐' };
    try {
      const drinks = JSON.parse(localStorage.getItem('lua_drink_records') || '{}');
      const cafDays = last30.filter(dk => (drinks[dk]?.caffeine || []).length > 0).length;
      if (cafDays > 10) topFactor = { name: '카페인', percentage: 35, emoji: '☕' };
    } catch {}

    return { avg, trend, trendValue: Math.round((recentAvg - olderAvg) * 10) / 10, topFactor, dataCount: sleepHours.length };
  } catch { return { avg: null, trend: 'stable', trendValue: 0, topFactor: { name: '취침 시간', percentage: 35, emoji: '🕐' }, dataCount: 0 }; }
}

export default function DiscoveryPage() {
  const [insights, setInsights] = useState([]);
  const activeDays = getActiveDays();
  const condSummary = getConditionSummary();
  const skinSummary = getSkinSummary();
  const sleepSummary = getSleepSummary();

  useEffect(() => {
    setInsights(getOrGenerateInsights());
  }, []);

  useEffect(() => {
    const triggerAndRefresh = (dataType) => {
      setInsights(refreshInsights());
      triggerLLMOnDataInput(dataType);
    };
    const handlers = {
      'lua-record-updated': () => triggerAndRefresh('meal_logged'),
      'lua-sleep-updated': () => triggerAndRefresh('sleep_logged'),
      'lua-food-logged': () => triggerAndRefresh('meal_logged'),
      'lua-drink-logged': (e) => triggerAndRefresh(e.detail?.type || 'drink_caffeine'),
      'lua-condition-logged': () => triggerAndRefresh('condition_logged'),
      'lua-supplement-completed': () => triggerAndRefresh('supplement_completed'),
      'lua-llm-insight-ready': () => setInsights(getOrGenerateInsights()),
    };
    Object.entries(handlers).forEach(([evt, fn]) => window.addEventListener(evt, fn));
    return () => Object.entries(handlers).forEach(([evt, fn]) => window.removeEventListener(evt, fn));
  }, []);

  const todayDate = new Date();
  const dateStr = `${todayDate.getFullYear()}년 ${todayDate.getMonth() + 1}월 ${todayDate.getDate()}일`;
  const DAY_NAMES = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100 }}>
      {/* === 헤더 === */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 20px 0' }}>
        <div style={{ ...fadeUp(0.03) }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>발견</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dateStr} {DAY_NAMES[todayDate.getDay()]}</div>
        </div>
      </div>

      {/* === 신규 사용자 (7일 미만) === */}
      {activeDays < 7 && (
        <div style={{ padding: '24px 20px' }}>
          <div style={{ ...cardStyle, textAlign: 'center', ...fadeUp(0.08) }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>당신의 패턴을 함께 찾아갈게요</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
              매일 기록을 쌓으면 나만의 패턴과 인사이트를 발견할 수 있어요
            </div>
            {/* 진행률 */}
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
      )}

      {/* === 오늘의 발견 (7일 이상) === */}
      {activeDays >= 7 && (
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, ...fadeUp(0.06) }}>오늘의 발견</div>
          {insights.length > 0 ? (() => {
            const main = insights[0];
            const additional = insights.slice(1);
            return (
              <div style={{ ...fadeUp(0.1) }}>
                {/* 메인 인사이트 */}
                <div style={{ ...cardStyle, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{main.emoji}</span>
                      {main.label && <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>{main.label}</span>}
                    </div>
                    <div onClick={() => setInsights(refreshInsights())} style={{ cursor: 'pointer', padding: 4, WebkitTapHighlightColor: 'transparent' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b1b8ba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{main.message}</div>
                  {main.action && (
                    <button onClick={() => { markShown(main.id); setInsights(refreshInsights()); }}
                      style={{ background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 11, color: 'var(--text-primary)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginTop: 12 }}>
                      {main.action.label}
                    </button>
                  )}
                </div>

                {/* 추가 인사이트 */}
                {additional.map((ins, i) => (
                  <div key={ins.id || i} style={{ ...cardStyle, marginBottom: 8, padding: '16px 20px', ...fadeUp(0.12 + i * 0.03) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 12 }}>{ins.emoji}</span>
                      {ins.label && <span style={{ fontSize: 11, fontWeight: 600, color: '#b1b8ba' }}>{ins.label}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{ins.message}</div>
                  </div>
                ))}
              </div>
            );
          })() : (
            <div style={{ ...cardStyle, textAlign: 'center', ...fadeUp(0.1) }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🌿</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>이번 주는 잘 보내고 계시네요</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>새로운 패턴이 발견되면 알려드릴게요</div>
            </div>
          )}
        </div>
      )}

      {/* === 영향 요인 분석 미리보기 (7일 이상) === */}
      {activeDays >= 7 && (
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, ...fadeUp(0.18) }}>영향 요인</div>

          {/* 컨디션 카드 */}
          <ImpactPreviewCard
            delay={0.2}
            icon="⚡"
            title="컨디션"
            color={getCategoryColor('condition') || '#F5C870'}
            locked={activeDays < 30}
            activeDays={activeDays}
            mainValue={condSummary.avg ? `${condSummary.avg}` : '—'}
            mainUnit="/10"
            mainLabel="평균 활력"
            topFactor={condSummary.topFactor}
            trend={condSummary.trend}
            trendValue={condSummary.trendValue}
            dataCount={condSummary.dataCount}
          />

          {/* 피부 카드 */}
          <ImpactPreviewCard
            delay={0.23}
            icon="✨"
            title="피부"
            color={getCategoryColor('skin') || '#D8A0E0'}
            locked={activeDays < 30}
            activeDays={activeDays}
            mainValue={skinSummary.topTag ? skinSummary.topTag.icon : '—'}
            mainUnit=""
            mainLabel={skinSummary.topTag ? `"${skinSummary.topTag.name}" ${skinSummary.topTag.count}회 기록` : '데이터 수집 중'}
            topFactor={skinSummary.topFactor}
            trend={skinSummary.troubleRate != null ? (skinSummary.troubleRate > 30 ? 'up' : 'stable') : 'stable'}
            trendValue={skinSummary.troubleRate != null ? `트러블 ${skinSummary.troubleRate}%` : null}
            dataCount={skinSummary.dataCount}
          />

          {/* 수면 카드 */}
          <ImpactPreviewCard
            delay={0.26}
            icon="😴"
            title="수면"
            color={getCategoryColor('sleep') || '#9AAFD4'}
            locked={activeDays < 30}
            activeDays={activeDays}
            mainValue={sleepSummary.avg || '—'}
            mainUnit={sleepSummary.avg ? '시간' : ''}
            mainLabel="평균 수면"
            topFactor={sleepSummary.topFactor}
            trend={sleepSummary.trend}
            trendValue={sleepSummary.trendValue}
            dataCount={sleepSummary.dataCount}
          />
        </div>
      )}

      {/* === 학습 중 안내 (7-29일) === */}
      {activeDays >= 7 && activeDays < 30 && (
        <div style={{ padding: '20px 20px 0', ...fadeUp(0.3) }}>
          <div style={{ ...cardStyle, padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              📊 {30 - activeDays}일 더 기록하면 영향 요인 상세 분석을 볼 수 있어요
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.06)', overflow: 'hidden', marginTop: 10 }}>
              <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent-primary)', width: `${Math.min((activeDays / 30) * 100, 100)}%`, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>{activeDays}/30일</div>
          </div>
        </div>
      )}
    </div>
  );
}

// === 영향 요인 미리보기 카드 ===
function ImpactPreviewCard({ delay, icon, title, color, locked, activeDays, mainValue, mainUnit, mainLabel, topFactor, trend, trendValue, dataCount }) {
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? '#4A9A7A' : trend === 'down' ? '#C4580A' : '#9ABBC8';

  return (
    <div style={{ ...cardStyle, marginBottom: 10, ...fadeUp(delay) }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 3, height: 14, borderRadius: 2, background: color }} />
          <span style={{ fontSize: 15 }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        </div>
        {!locked && dataCount > 0 && (
          <span style={{ fontSize: 11, color: '#9ABBC8' }}>자세히 보기 ›</span>
        )}
      </div>

      {dataCount === 0 ? (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>아직 {title} 데이터가 없어요</div>
        </div>
      ) : (
        <>
          {/* 메인 수치 + 영향 요인 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{mainValue}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mainUnit}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{mainLabel}</div>
            </div>

            {/* 영향 요인 */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 14 }}>{topFactor.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{topFactor.name}</span>
                {!locked && <span style={{ fontSize: 11, fontWeight: 600, color }}>{topFactor.percentage}%</span>}
              </div>
              {locked ? (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>30일 후 분석 가능</div>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>가장 큰 영향</div>
              )}
            </div>
          </div>

          {/* 트렌드 */}
          {trendValue != null && typeof trendValue === 'number' && trendValue !== 0 && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: trendColor, fontWeight: 500 }}>{trendIcon}</span>
              <span style={{ fontSize: 11, color: trendColor }}>
                지난주 대비 {trendValue > 0 ? '+' : ''}{trendValue}
              </span>
            </div>
          )}
          {trendValue != null && typeof trendValue === 'string' && (
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>{trendValue}</div>
          )}
        </>
      )}
    </div>
  );
}

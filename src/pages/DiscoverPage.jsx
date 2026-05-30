import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getLatestRecord, getPreviousRecord, getRecordCount, getRecords, getTimeSeries } from '../storage/SkinStorage';
import { getProducts, computeAllCorrelations } from '../storage/TrackerStorage';
import TossLineChart from '../components/TossLineChart';
import { AnimatedNumber } from '../components/UIComponents';

const glass = {
  background: 'var(--card-bg)',
  backdropFilter: 'var(--card-blur)', WebkitBackdropFilter: 'var(--card-blur)',
  border: 'none',
  boxShadow: 'var(--card-shadow)',
  borderRadius: 'var(--card-radius)',
};

const ALL_METRICS = [
  { key: 'moisture', label: '수분' },
  { key: 'oilBalance', label: '유분' },
  { key: 'oilMoistureBalance', label: '유수분' },
  { key: 'skinTone', label: '피부톤' },
  { key: 'textureScore', label: '피부결' },
  { key: 'poreScore', label: '모공' },
  { key: 'elasticityScore', label: '탄력' },
  { key: 'pigmentationScore', label: '색소' },
  { key: 'rednessScore', label: '붉은기' },
  { key: 'troubleCount', label: '트러블', inverse: true },
  { key: 'darkCircleScore', label: '다크서클' },
  { key: 'wrinkleScore', label: '주름' },
];

function getTopChangedMetrics(latest, prev, count = 4) {
  if (!latest || !prev) return ALL_METRICS.slice(0, count);
  const diffs = ALL_METRICS.map(m => ({
    ...m,
    diff: Math.abs((latest[m.key] ?? 0) - (prev[m.key] ?? 0)),
  }));
  diffs.sort((a, b) => b.diff - a.diff);
  return diffs.slice(0, count);
}

const CHART_COLORS = ['#1E90E8', '#185FA5', '#7FB3E3', '#C5DEF5'];
const DAY_LABELS = ['일','월','화','수','목','금','토'];

// ===== 실제 영향 요인 분석 =====
// 루틴 체크 데이터 + 제품 사용 기록 ↔ 피부 측정 변화 상관분석
function getImpactFactors(metricKey, records) {
  if (records.length < 2) return [];
  const factors = [];
  const metric = ALL_METRICS.find(m => m.key === metricKey);
  const isInverse = metric?.inverse; // troubleCount: 낮을수록 좋음

  // 1) 루틴 습관 체크 ↔ 다음 측정 변화
  // lua_routine_YYYY-MM-DD 키에서 체크 데이터를 가져와 측정일 기준으로 매칭
  const habitItems = (() => {
    try { return JSON.parse(localStorage.getItem('lua_my_routines') || '[]'); } catch { return []; }
  })();
  const uniqueHabits = [...new Map(habitItems.filter(h => h.id?.startsWith('_')).map(h => [h.id, h])).values()];

  for (const habit of uniqueHabits) {
    const doneScores = [];
    const notDoneScores = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const val = r[metricKey];
      if (val == null) continue;
      // 이 측정 날짜의 루틴 체크 확인
      try {
        const checkData = JSON.parse(localStorage.getItem(`lua_routine_${r.date}`) || '{}');
        if (checkData[habit.id] === true) doneScores.push(val);
        else if (checkData[habit.id] === false || !(habit.id in checkData)) notDoneScores.push(val);
      } catch { continue; }
    }
    if (doneScores.length >= 2 && notDoneScores.length >= 1) {
      const avgDone = doneScores.reduce((a, b) => a + b, 0) / doneScores.length;
      const avgNot = notDoneScores.reduce((a, b) => a + b, 0) / notDoneScores.length;
      let diff = avgDone - avgNot;
      if (isInverse) diff = -diff; // troubleCount: done 평균이 낮으면 좋음
      if (Math.abs(diff) >= 1) {
        factors.push({
          name: habit.name,
          type: 'habit',
          impact: Math.round(diff),
          samples: doneScores.length + notDoneScores.length,
        });
      }
    }
  }

  // 2) 제품 사용 기간 ↔ 메트릭 변화 (computeAllCorrelations 활용)
  const products = getProducts();
  for (const p of products) {
    if (!p.startDate) continue;
    const before = records.filter(r => r.date < p.startDate);
    const after = records.filter(r => r.date >= p.startDate);
    if (before.length < 1 || after.length < 1) continue;
    const avgBefore = before.reduce((s, r) => s + (r[metricKey] ?? 0), 0) / before.length;
    const avgAfter = after.reduce((s, r) => s + (r[metricKey] ?? 0), 0) / after.length;
    let diff = avgAfter - avgBefore;
    if (isInverse) diff = -diff;
    if (Math.abs(diff) >= 1) {
      factors.push({
        name: `${p.brand} ${p.name}`.trim(),
        type: 'product',
        impact: Math.round(diff),
        samples: before.length + after.length,
      });
    }
  }

  // 3) 루틴 완료율 ↔ 메트릭 (높은 완료일 vs 낮은 완료일)
  const completionScores = [];
  for (const r of records) {
    const val = r[metricKey];
    if (val == null) continue;
    try {
      const checkData = JSON.parse(localStorage.getItem(`lua_routine_${r.date}`) || '{}');
      const total = Object.keys(checkData).length;
      const done = Object.values(checkData).filter(Boolean).length;
      if (total > 0) completionScores.push({ val, rate: done / total });
    } catch { continue; }
  }
  if (completionScores.length >= 4) {
    const sorted = [...completionScores].sort((a, b) => a.rate - b.rate);
    const half = Math.floor(sorted.length / 2);
    const lowAvg = sorted.slice(0, half).reduce((s, x) => s + x.val, 0) / half;
    const highAvg = sorted.slice(half).reduce((s, x) => s + x.val, 0) / (sorted.length - half);
    let diff = highAvg - lowAvg;
    if (isInverse) diff = -diff;
    if (Math.abs(diff) >= 2) {
      factors.push({
        name: '루틴 꾸준함',
        type: 'habit',
        impact: Math.round(diff),
        samples: completionScores.length,
      });
    }
  }

  // 영향력 절대값 순 정렬, 상위 5개
  factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  return factors.slice(0, 5);
}

// ===== lua의 발견 — 실제 데이터 기반 인사이트 =====
function getDiscoveries(records, products) {
  if (records.length < 2) return [];
  const discoveries = [];
  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];

  // 1) 가장 크게 개선된 메트릭
  for (const m of ALL_METRICS) {
    const firstVal = first[m.key];
    const lastVal = latest[m.key];
    if (firstVal == null || lastVal == null) continue;
    let diff = lastVal - firstVal;
    const improved = m.inverse ? diff < 0 : diff > 0;
    if (improved && Math.abs(diff) >= 5) {
      discoveries.push({
        text: `${m.label}이 처음 측정 때보다 ${Math.abs(diff)}점 좋아졌어요. 꾸준한 관리 효과가 보이고 있어요.`,
        tag: '피부 변화',
      });
      break; // 가장 큰 개선 1개만
    }
  }

  // 2) 측정 주기 패턴
  if (sorted.length >= 3) {
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000);
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const dayDist = new Map();
    for (const r of sorted) {
      const d = new Date(r.date).getDay();
      dayDist.set(d, (dayDist.get(d) || 0) + 1);
    }
    const mostDay = [...dayDist.entries()].sort((a, b) => b[1] - a[1])[0];
    if (mostDay && mostDay[1] >= 2) {
      discoveries.push({
        text: `주로 ${DAY_LABELS[mostDay[0]]}요일에 측정하고 있어요. 평균 ${avgGap.toFixed(0)}일 간격으로 기록 중이에요.`,
        tag: '측정 패턴',
      });
    }
  }

  // 3) 제품 효과 발견
  try {
    const correlations = computeAllCorrelations();
    const best = correlations.find(c => c.metrics?.length > 0 && c.metrics[0].improved);
    if (best) {
      const m = best.metrics[0];
      discoveries.push({
        text: `${best.brand} ${best.productName} 사용 후 ${m.label}이 ${m.diff}점 변화했어요. (${best.days}일 사용 기준)`,
        tag: '제품 효과',
      });
    }
  } catch {}

  // 4) 최근 트렌드 (최근 5회 vs 이전 5회)
  if (sorted.length >= 6) {
    const recent5 = sorted.slice(-5);
    const prev5 = sorted.slice(-10, -5);
    if (prev5.length >= 3) {
      const recentAvg = recent5.reduce((s, r) => s + (r.overallScore || 0), 0) / recent5.length;
      const prevAvg = prev5.reduce((s, r) => s + (r.overallScore || 0), 0) / prev5.length;
      const diff = recentAvg - prevAvg;
      if (Math.abs(diff) >= 2) {
        discoveries.push({
          text: diff > 0
            ? `최근 5회 종합점수 평균이 이전보다 ${diff.toFixed(0)}점 올랐어요. 좋은 흐름이에요.`
            : `최근 5회 종합점수 평균이 이전보다 ${Math.abs(diff).toFixed(0)}점 내려갔어요. 루틴을 점검해보세요.`,
          tag: diff > 0 ? '좋은 흐름' : '점검 필요',
        });
      }
    }
  }

  // 5) 루틴 완료율과 피부 상태 상관
  const withCompletion = [];
  for (const r of sorted) {
    try {
      const checks = JSON.parse(localStorage.getItem(`lua_routine_${r.date}`) || '{}');
      const total = Object.keys(checks).length;
      const done = Object.values(checks).filter(Boolean).length;
      if (total > 0) withCompletion.push({ score: r.overallScore || 0, rate: done / total });
    } catch {}
  }
  if (withCompletion.length >= 4) {
    const highRate = withCompletion.filter(x => x.rate >= 0.7);
    const lowRate = withCompletion.filter(x => x.rate < 0.5);
    if (highRate.length >= 2 && lowRate.length >= 1) {
      const highAvg = highRate.reduce((s, x) => s + x.score, 0) / highRate.length;
      const lowAvg = lowRate.reduce((s, x) => s + x.score, 0) / lowRate.length;
      const diff = highAvg - lowAvg;
      if (diff >= 3) {
        discoveries.push({
          text: `루틴을 70% 이상 지킨 날은 종합점수가 평균 ${diff.toFixed(0)}점 더 높았어요.`,
          tag: '루틴 발견',
        });
      }
    }
  }

  return discoveries.slice(0, 4);
}

function getHeadline(latest, prev) {
  if (!latest) return '첫 측정을 해볼까요?';
  if (!prev) return '기준선이 만들어졌어요. 이제 함께 변화를 따라가요.';
  let bestKey = null, bestDiff = 0;
  for (const m of ALL_METRICS) {
    const diff = (latest[m.key] ?? 0) - (prev[m.key] ?? 0);
    if (Math.abs(diff) > Math.abs(bestDiff)) { bestDiff = diff; bestKey = m.label; }
  }
  if (Math.abs(bestDiff) < 2) return '전반적으로 안정적인 한 주';
  return bestDiff > 0 ? `이번 주, ${bestKey}이 크게 좋아졌어요` : `${bestKey}이 조금 떨어졌네요`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '날짜 없음';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function DiscoverPage({ onMeasure, onOpenConsult }) {
  const [period, setPeriod] = useState('4w');
  const [impactMetric, setImpactMetric] = useState(null);
  const [showMetricDropdown, setShowMetricDropdown] = useState(false);
  const dropdownRef = useRef(null);
  useEffect(() => {
    if (!showMetricDropdown) return;
    const handleClick = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowMetricDropdown(false); };
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [showMetricDropdown]);
  const latest = getLatestRecord();
  const prev = getPreviousRecord();

  // 이전 측정 대비 변화폭 큰 4개 메트릭 동적 선택
  const METRICS = useMemo(() => getTopChangedMetrics(latest, prev, 4), [latest, prev]);

  // 4주 변화 차트 — 한 번에 한 메트릭만 단일 라인으로 표시 (토스 스타일)
  const [trendMetric, setTrendMetric] = useState(null);
  const records = getRecords();
  const recordCount = records.length;

  const daysSince = (() => { if (!latest) return null; const t = new Date(latest.date).getTime(); return isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000); })();
  const headline = getHeadline(latest, prev);

  // Determine default impact metric
  const selectedMetric = impactMetric || (() => {
    if (!latest || !prev) return 'poreScore';
    let best = ALL_METRICS[0].key, bestDiff = 0;
    for (const m of ALL_METRICS) {
      const d = Math.abs((latest[m.key] ?? 0) - (prev[m.key] ?? 0));
      if (d > bestDiff) { bestDiff = d; best = m.key; }
    }
    return best;
  })();

  const handleMeasure = useCallback(() => onMeasure?.(), [onMeasure]);
  const handleConsult = useCallback(() => onOpenConsult?.(), [onOpenConsult]);
  const impacts = getImpactFactors(selectedMetric, records);
  const confidence = recordCount < 5 ? '낮음' : recordCount < 10 ? '보통' : '높음';

  // Chart data
  const chartRecords = (() => {
    const now = Date.now();
    const ms = period === '7d' ? 7*86400000 : period === '4w' ? 28*86400000 : 90*86400000;
    return records.filter(r => now - new Date(r.date).getTime() <= ms);
  })();

  return (
    <div className="ux-stagger" style={{ minHeight: '100dvh', paddingBottom: 100 }}>

      {/* ① 헤더 spacer */}
      <div style={{ padding: '30px 16px 4px' }} />

      {/* ② 점수 변화 — 최상단 */}
          <div className="card" style={{ margin: '0 12px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, lineHeight: 1.5, fontWeight: 600, color: 'var(--text-primary)' }}>내 피부 흐름</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ k: '7d', l: '7일' }, { k: '4w', l: '4주' }, { k: '3m', l: '3개월' }].map(p => (
                  <button key={p.k} onClick={() => setPeriod(p.k)} style={{
                    padding: '4px 10px', borderRadius: 10, border: period === p.k ? 'none' : '1px solid rgba(255,255,255,0.2)', fontSize: 10, lineHeight: 1.3, fontWeight: 500,
                    background: period === p.k ? 'var(--accent-primary, var(--accent-primary))' : 'rgba(255,255,255,0.4)',
                    color: period === p.k ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>{p.l}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
              {[{ key: 'overallScore', label: '종합점수' }, { key: 'skinAge', label: '피부나이' }, ...ALL_METRICS].map((m) => {
                const activeTrend = trendMetric || 'overallScore';
                const active = activeTrend === m.key;
                return (
                  <button key={m.key} onClick={() => setTrendMetric(m.key)} style={{
                    padding: '3px 8px', borderRadius: 7, border: 'none',
                    background: active ? 'var(--accent-primary)12' : 'rgba(0,0,0,0.04)',
                    color: active ? 'var(--accent-primary)' : 'rgba(0,0,0,0.4)',
                    fontSize: 11, fontWeight: 500, lineHeight: 1.3,
                    cursor: 'pointer', fontFamily: 'inherit',
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}>{m.label}</button>
                );
              })}
            </div>
            {chartRecords.length < 2 ? (
              <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                  측정이 부족해요.<br />트렌드를 보려면 한 번 더 측정해보세요
                </div>
              </div>
            ) : (() => {
              const activeTrendKey = trendMetric || 'overallScore';
              const series = chartRecords.map(r => ({ date: r.date, value: r[activeTrendKey] ?? 50 }));
              const vals = series.map(s => s.value);
              const lastVal = vals[vals.length - 1];
              const firstVal = vals[0];
              const diff = lastVal - firstVal;
              const metricLabel = activeTrendKey === 'overallScore' ? '종합' : activeTrendKey === 'skinAge' ? '피부나이' : (ALL_METRICS.find(m => m.key === activeTrendKey)?.label || '');
              const unit = activeTrendKey === 'skinAge' ? '세' : '점';
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 18, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: -0.3 }}>{lastVal}{unit}</span>
                    <span style={{ fontSize: 11, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-muted)' }}>{metricLabel}</span>
                    {diff !== 0 && (
                      <span style={{ fontSize: 11, lineHeight: 1.3, fontWeight: 500, color: diff > 0 ? 'var(--accent-primary)' : '#e05545', marginLeft: 'auto' }}>
                        {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(0)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {period === '7d' ? '7일' : period === '4w' ? '4주' : '3개월'} · {series.length}회 측정
                  </div>
                  <TossLineChart
                    data={series}
                    height={150}
                    averageLabel="평균"
                  />
                  {recordCount <= 3 && (
                    <div style={{ fontSize: 10, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-muted)', marginTop: 4 }}>데이터가 쌓일수록 정확해져요</div>
                  )}
                </>
              );
            })()}
          </div>

      {/* ③ 히어로 요약 카드 */}
          <div style={{ margin: '0 12px 12px' }}>
            {recordCount === 0 ? (
              <div role="button" aria-label="첫 측정 시작" onClick={handleMeasure} style={{
                background: 'var(--card-bg)',
                backdropFilter: 'var(--card-blur)', WebkitBackdropFilter: 'var(--card-blur)',
                borderRadius: 'var(--card-radius)',
                boxShadow: 'var(--card-shadow)',
                padding: '32px 16px', textAlign: 'center', cursor: 'pointer',
              }}>
                <div style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>첫 측정을 해볼까요?</div>
                <button style={{
                  background: 'var(--accent-primary, var(--accent-primary))', color: '#fff', fontSize: 13, lineHeight: 1.5, fontWeight: 500,
                  padding: '10px 24px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}>측정 시작</button>
              </div>
            ) : (
              <div style={{
                ...glass,
                padding: 16,
              }}>
                {/* 메타 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-muted)' }}>
                  <span>{formatDate(latest.date)} 측정</span>
                  {daysSince !== null && prev && <span>이전 측정 → {daysSince > 7 ? `${Math.floor(daysSince/7)}주 전` : `${daysSince}일 전`}</span>}
                </div>
                {/* 헤드라인 */}
                <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: -0.3, lineHeight: 1.3, marginTop: 8 }}>
                  {headline}
                </div>
                {/* 4분할 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
                  {METRICS.map(m => {
                    const val = latest?.[m.key] ?? null;
                    const prevVal = prev?.[m.key] ?? null;
                    const diff = val !== null && prevVal !== null ? val - prevVal : null;
                    return (
                      <div key={m.key} style={{ background: 'var(--card-sm-bg)', backdropFilter: 'var(--card-blur)', WebkitBackdropFilter: 'var(--card-blur)', borderRadius: 'var(--card-sm-radius)', padding: '8px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-muted)' }}>{m.label}</div>
                        <div style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>{val != null ? <AnimatedNumber target={val} duration={600} /> : '—'}</div>
                        <div style={{ fontSize: 10, lineHeight: 1.3, fontWeight: 500, marginTop: 1, color: diff === null ? 'var(--text-muted)' : diff > 0 ? 'var(--accent-primary)' : diff < 0 ? '#e05545' : 'var(--text-muted)' }}>
                          {diff === null ? '기준선' : diff > 0 ? <>+<AnimatedNumber target={diff} duration={800} /></> : diff < 0 ? <>-<AnimatedNumber target={Math.abs(diff)} duration={800} /></> : '0'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ⑤ 영향 요인 차트 */}
          <div className="card" style={{ margin: '0 12px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, lineHeight: 1.5, fontWeight: 600, color: 'var(--text-primary)' }}>영향 요인</span>
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <span role="button" aria-label="메트릭 선택" aria-expanded={showMetricDropdown} onClick={() => setShowMetricDropdown(!showMetricDropdown)} style={{ fontSize: 10, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {METRICS.find(m => m.key === selectedMetric)?.label || '모공'} 기준 ▾
                </span>
                {showMetricDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 10,
                    ...glass, background: 'rgba(255,255,255,0.85)', padding: '4px 0', minWidth: 90,
                  }}>
                    {METRICS.map(m => (
                      <div key={m.key} onClick={() => { setImpactMetric(m.key); setShowMetricDropdown(false); }} style={{
                        padding: '8px 14px', fontSize: 11, lineHeight: 1.3, fontWeight: 500, color: m.key === selectedMetric ? 'var(--accent-primary)' : 'var(--text-primary)',
                        fontWeight: m.key === selectedMetric ? 600 : 400, cursor: 'pointer',
                      }}>{m.label}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {recordCount < 2 || impacts.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {recordCount < 2 ? '측정이 더 쌓이면 영향 요인을 분석해드릴게요' : '아직 유의미한 영향 요인을 찾지 못했어요. 루틴을 꾸준히 체크해보세요.'}
                </div>
              </div>
            ) : (
              <>
                {impacts.map((f, i) => {
                  const maxImpact = Math.max(...impacts.map(x => Math.abs(x.impact)), 1);
                  const barWidth = Math.min(Math.abs(f.impact) / maxImpact * 50, 50);
                  return (
                    <div key={i} style={{ padding: '8px 0', borderTop: i > 0 ? '0.5px solid rgba(255,255,255,0.2)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: f.type === 'product' ? 'rgba(var(--accent-rgb),0.12)' : 'rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {f.type === 'product' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><line x1="9" y1="8" x2="15" y2="8"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5l0 14"/><path d="M5 12l14 0"/></svg>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, lineHeight: 1.5, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                        <div style={{ fontSize: 11, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-muted)', marginTop: 2 }}>{f.type === 'habit' ? '습관' : '화장품'}{f.samples ? ` · ${f.samples}회` : ''}</div>
                        <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '50%', top: -2, width: 1, height: 8, background: 'rgba(255,255,255,0.4)' }} />
                          {f.impact > 0 ? (
                            <div style={{ position: 'absolute', left: '50%', top: 0, height: '100%', borderRadius: 2, background: 'var(--accent-primary, var(--accent-primary))', width: `${barWidth}%` }} />
                          ) : (
                            <div style={{ position: 'absolute', right: '50%', top: 0, height: '100%', borderRadius: 2, background: confidence === '낮음' ? '#888' : '#E24B4A', width: `${barWidth}%` }} />
                          )}
                        </div>
                      </div>
                      <span style={{ minWidth: 36, textAlign: 'right', fontSize: 12, lineHeight: 1.5, fontWeight: 500, color: f.impact > 0 ? '#1976D2' : f.impact < 0 ? (confidence === '낮음' ? '#888' : '#e05545') : 'var(--text-muted)' }}>
                        {f.impact > 0 ? `+${f.impact}점` : `${f.impact}점`}
                      </span>
                    </div>
                  );
                })}
                <div style={{ fontSize: 10, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-muted)', marginTop: 12 }}>
                  측정 {recordCount}회 기반 · 신뢰도 {confidence}
                </div>
                {confidence === '낮음' && (
                  <div style={{ fontSize: 10, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-muted)', marginTop: 4 }}>더 많은 측정 데이터가 쌓이면 정확도가 올라가요</div>
                )}
              </>
            )}
          </div>

          {/* ⑥ lua의 발견 */}
          <div className="card" style={{ margin: '0 12px 12px' }}>
            <div style={{ fontSize: 14, lineHeight: 1.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>인사이트</div>
            {(() => {
              const discoveries = getDiscoveries(records, getProducts());
              if (discoveries.length === 0) return (
                <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {recordCount < 2 ? '꾸준히 기록하면, lua가 패턴을 찾아드릴게요' : '아직 뚜렷한 패턴을 찾지 못했어요. 측정과 루틴을 계속 기록해보세요.'}
                </div>
              );
              return discoveries.map((d, i) => (
                <div key={i} onClick={handleConsult} style={{
                  padding: '12px 0', cursor: 'pointer',
                  borderTop: i > 0 ? '0.5px solid rgba(255,255,255,0.2)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5 }}>{d.text}</div>
                    <span style={{ display: 'inline-block', marginTop: 5, fontSize: 10, lineHeight: 1.3, fontWeight: 500, padding: '2px 7px', borderRadius: 8, background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent-primary)' }}>{d.tag}</span>
                  </div>
                </div>
              ));
            })()}
          </div>
    </div>
  );
}

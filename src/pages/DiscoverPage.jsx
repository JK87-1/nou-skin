import { useState, useEffect, useMemo } from 'react';
import { getLatestRecord, getPreviousRecord, getRecordCount, getRecords, getTimeSeries, getAllThumbnailsAsync } from '../storage/SkinStorage';
import TossLineChart from '../components/TossLineChart';
import { AnimatedNumber } from '../components/UIComponents';

const glass = {
  background: 'rgba(255,255,255,0.5)',
  backdropFilter: 'none', WebkitBackdropFilter: 'none',
  border: 'none',
  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  borderRadius: 20,
};

const ALL_METRICS = [
  { key: 'moisture', label: '수분' },
  { key: 'skinTone', label: '피부톤' },
  { key: 'troubleCount', label: '트러블' },
  { key: 'oilBalance', label: '유수분' },
  { key: 'wrinkleScore', label: '주름' },
  { key: 'poreScore', label: '모공' },
  { key: 'elasticityScore', label: '탄력' },
  { key: 'pigmentationScore', label: '색소' },
  { key: 'textureScore', label: '결' },
  { key: 'darkCircleScore', label: '다크서클' },
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

// Mock impact factors (real implementation would compute from data)
function getImpactFactors(metricKey, records) {
  if (records.length < 2) return [];
  return [
    { name: '수분 섭취', type: 'habit', icon: '', impact: 76 },
    { name: '수면 시간', type: 'habit', icon: '', impact: 42 },
    { name: '자외선 차단', type: 'habit', icon: '', impact: 28 },
    { name: '토너', type: 'product', icon: '', impact: -18 },
  ];
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
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function DiscoverPage({ onMeasure, onOpenConsult }) {
  const [period, setPeriod] = useState('4w');
  const [impactMetric, setImpactMetric] = useState(null);
  const [showMetricDropdown, setShowMetricDropdown] = useState(false);
  const latest = getLatestRecord();
  const prev = getPreviousRecord();

  // 이전 측정 대비 변화폭 큰 4개 메트릭 동적 선택
  const METRICS = useMemo(() => getTopChangedMetrics(latest, prev, 4), [latest, prev]);

  // 4주 변화 차트 — 한 번에 한 메트릭만 단일 라인으로 표시 (토스 스타일)
  const [trendMetric, setTrendMetric] = useState(null);
  const records = getRecords();
  const recordCount = records.length;
  const [thumbs, setThumbs] = useState({});
  useEffect(() => { getAllThumbnailsAsync().then(setThumbs); }, []);

  const daysSince = latest ? Math.floor((Date.now() - new Date(latest.date).getTime()) / 86400000) : null;
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

  const impacts = getImpactFactors(selectedMetric, records);
  const confidence = recordCount < 5 ? '낮음' : recordCount < 10 ? '보통' : '높음';

  // Chart data
  const chartRecords = (() => {
    const now = Date.now();
    const ms = period === '7d' ? 7*86400000 : period === '4w' ? 28*86400000 : 90*86400000;
    return records.filter(r => now - new Date(r.date).getTime() <= ms).reverse();
  })();

  return (
    <div className="ux-stagger" style={{ minHeight: '100dvh', paddingBottom: 100 }}>

      {/* ① 헤더 spacer */}
      <div style={{ padding: '30px 16px 4px' }} />

      {/* ③ 히어로 요약 카드 */}
          <div style={{ margin: '0 12px 12px' }}>
            {recordCount === 0 ? (
              <div onClick={() => onMeasure?.()} style={{
                ...glass, background: 'linear-gradient(135deg, rgba(220,238,251,0.6), rgba(240,247,254,0.4))',
                padding: '32px 16px', textAlign: 'center', cursor: 'pointer',
              }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>첫 측정을 해볼까요?</div>
                <button style={{
                  background: 'var(--accent-primary, #6598ef)', color: '#fff', fontSize: 13, fontWeight: 500,
                  padding: '10px 24px', borderRadius: 50, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}>측정 시작</button>
              </div>
            ) : (
              <div style={{
                ...glass, background: 'linear-gradient(135deg, rgba(220,238,251,0.6), rgba(240,247,254,0.4))',
                padding: 16,
              }}>
                {/* 메타 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-muted)' }}>
                  <span>{formatDate(latest.date)} 측정</span>
                  {daysSince !== null && prev && <span>이전 측정 → {daysSince > 7 ? `${Math.floor(daysSince/7)}주 전` : `${daysSince}일 전`}</span>}
                </div>
                {/* 헤드라인 */}
                <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: -0.3, lineHeight: 1.35, marginTop: 8 }}>
                  {headline}
                </div>
                {/* 4분할 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 14 }}>
                  {METRICS.map(m => {
                    const val = latest?.[m.key] ?? null;
                    const prevVal = prev?.[m.key] ?? null;
                    const diff = val !== null && prevVal !== null ? val - prevVal : null;
                    return (
                      <div key={m.key} style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{m.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>{val ?? '—'}</div>
                        <div style={{ fontSize: 9, fontWeight: 500, marginTop: 1, color: diff === null ? 'var(--text-muted)' : diff > 0 ? '#1976D2' : diff < 0 ? '#A32D2D' : 'var(--text-muted)' }}>
                          {diff === null ? '기준선' : diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 피부나이 · 종합점수 요약 */}
          {recordCount >= 2 && (
            <div style={{ margin: '0 12px 12px', display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, ...glass, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>피부나이 변화</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {latest?.skinAge != null ? <AnimatedNumber target={latest.skinAge} duration={1000} /> : '—'}
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>세</span>
                </div>
                {prev && (
                  <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, color: (latest.skinAge - prev.skinAge) <= 0 ? 'var(--accent-primary)' : '#e05545' }}>
                    {latest.skinAge - prev.skinAge <= 0 ? `${latest.skinAge - prev.skinAge}세` : `+${latest.skinAge - prev.skinAge}세`}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, ...glass, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>종합점수 변화</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {latest?.overallScore != null ? <AnimatedNumber target={latest.overallScore} duration={1100} /> : '—'}
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>점</span>
                </div>
                {prev && (
                  <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, color: (latest.overallScore - prev.overallScore) >= 0 ? 'var(--accent-primary)' : '#e05545' }}>
                    {latest.overallScore - prev.overallScore >= 0 ? `+${latest.overallScore - prev.overallScore}점` : `${latest.overallScore - prev.overallScore}점`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 종합 점수 추이 — 토스 스타일 라인 차트 (점·x축 라벨 제거, 최고/최저·평균만 강조) */}
          {recordCount >= 2 && (() => {
            const series = getTimeSeries('overallScore');
            if (series.length < 2) return null;
            const vals = series.map(s => s.value);
            const firstVal = vals[0];
            const lastVal = vals[vals.length - 1];
            const diffPct = firstVal > 0 ? ((lastVal - firstVal) / firstVal * 100).toFixed(1) : null;
            return (
              <div style={{ margin: '0 12px 12px', ...glass, padding: '14px 14px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>종합 점수 추이</span>
                  {diffPct && Number(diffPct) !== 0 && (
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: Number(diffPct) > 0 ? '#6598ef' : '#e05545' }}>
                      {Number(diffPct) > 0 ? '▲' : '▼'} {Math.abs(Number(diffPct))}%
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.3, marginBottom: 2 }}>
                  {lastVal}점
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                  최근 {series.length}회 측정
                </div>
                <TossLineChart
                  data={series}
                  height={150}
                  valueFormatter={(v) => `${v}점`}
                  averageLabel="평균"
                />
              </div>
            );
          })()}

          {/* 측정 기록 타임라인 */}
          {recordCount > 0 && (
            <div style={{ margin: '0 12px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 18, padding: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>측정 기록</div>
              {[...records].reverse().slice(0, 5).map((r, i) => {
                const d = new Date(r.date);
                const dayLabels = ['일','월','화','수','목','금','토'];
                const thumb = thumbs[String(r.id)] || thumbs[r.date];
                const prevR = [...records].reverse()[i + 1];
                const diff = prevR ? r.overallScore - prevR.overallScore : 0;
                return (
                  <div key={r.id || r.timestamp} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', marginBottom: 6,
                    ...glass, cursor: 'pointer',
                  }}>
                    <div style={{ textAlign: 'center', minWidth: 32 }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{d.getDate()}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{d.getMonth()+1}월</div>
                    </div>
                    <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                    <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.2)' }}>
                      {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}></div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>종합 {r.overallScore}점</span>
                        {diff !== 0 && (
                          <span style={{ fontSize: 10, fontWeight: 500, color: diff > 0 ? 'var(--accent-primary)' : '#e05545' }}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {dayLabels[d.getDay()]}요일 · 피부나이 {r.skinAge}세
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ④ 트렌드 차트 */}
          <div style={{ margin: '0 12px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 18, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {period === '7d' ? '7일' : period === '4w' ? '4주' : '3개월'} 변화
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ k: '7d', l: '7일' }, { k: '4w', l: '4주' }, { k: '3m', l: '3개월' }].map(p => (
                  <button key={p.k} onClick={() => setPeriod(p.k)} style={{
                    padding: '4px 10px', borderRadius: 10, border: period === p.k ? 'none' : '1px solid rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 500,
                    background: period === p.k ? 'var(--accent-primary, #6598ef)' : 'rgba(255,255,255,0.4)',
                    color: period === p.k ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>{p.l}</button>
                ))}
              </div>
            </div>

            {/* 메트릭 chip — 한 번에 1개 메트릭만 단일 라인으로 (토스 스타일 가독성) */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {METRICS.map((m) => {
                const activeTrend = trendMetric || METRICS[0]?.key;
                const active = activeTrend === m.key;
                return (
                  <button key={m.key} onClick={() => setTrendMetric(m.key)} style={{
                    padding: '5px 11px', borderRadius: 10, border: 'none',
                    background: active ? 'rgba(101,152,239,0.16)' : 'rgba(0,0,0,0.04)',
                    color: active ? '#6598ef' : 'var(--text-muted)',
                    fontSize: 11, fontWeight: active ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>{m.label}</button>
                );
              })}
            </div>

            {chartRecords.length < 2 ? (
              <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
                  측정이 부족해요.<br />트렌드를 보려면 한 번 더 측정해보세요
                </div>
              </div>
            ) : (() => {
              const activeTrendKey = trendMetric || METRICS[0]?.key;
              const series = chartRecords.map(r => ({ date: r.date, value: r[activeTrendKey] ?? 50 }));
              const vals = series.map(s => s.value);
              const lastVal = vals[vals.length - 1];
              const firstVal = vals[0];
              const diff = lastVal - firstVal;
              const metricLabel = METRICS.find(m => m.key === activeTrendKey)?.label || '';
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.3 }}>{lastVal}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{metricLabel}</span>
                    {diff !== 0 && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: diff > 0 ? '#6598ef' : '#e05545', marginLeft: 'auto' }}>
                        {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(0)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {period === '7d' ? '7일' : period === '4w' ? '4주' : '3개월'} · {series.length}회 측정
                  </div>
                  <TossLineChart
                    data={series}
                    height={150}
                    averageLabel="평균"
                  />
                  {recordCount <= 3 && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>데이터가 쌓일수록 정확해져요</div>
                  )}
                </>
              );
            })()}
          </div>

          {/* ⑤ 영향 요인 차트 */}
          <div style={{ margin: '0 12px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 18, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>영향 요인</span>
              <div style={{ position: 'relative' }}>
                <span onClick={() => setShowMetricDropdown(!showMetricDropdown)} style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  {METRICS.find(m => m.key === selectedMetric)?.label || '모공'} 기준 ▾
                </span>
                {showMetricDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 10,
                    ...glass, background: 'rgba(255,255,255,0.85)', padding: '4px 0', minWidth: 90,
                  }}>
                    {METRICS.map(m => (
                      <div key={m.key} onClick={() => { setImpactMetric(m.key); setShowMetricDropdown(false); }} style={{
                        padding: '8px 14px', fontSize: 11, color: m.key === selectedMetric ? 'var(--accent-primary)' : 'var(--text-primary)',
                        fontWeight: m.key === selectedMetric ? 600 : 400, cursor: 'pointer',
                      }}>{m.label}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {recordCount < 2 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>측정이 더 쌓이면 영향 요인을 분석해드릴게요</div>
              </div>
            ) : (
              <>
                {impacts.map((f, i) => (
                  <div key={i} style={{ padding: '8px 0', borderTop: i > 0 ? '0.5px solid rgba(255,255,255,0.2)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(255,255,255,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>{f.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div style={{ fontSize: 8.5, color: 'var(--text-muted)', marginTop: 2 }}>{f.type === 'habit' ? '습관' : '화장품'}</div>
                      <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '50%', top: -2, width: 1, height: 8, background: 'rgba(255,255,255,0.4)' }} />
                        {f.impact > 0 ? (
                          <div style={{ position: 'absolute', left: '50%', top: 0, height: '100%', borderRadius: 2, background: 'var(--accent-primary, #6598ef)', width: `${Math.min(Math.abs(f.impact), 100) / 2}%` }} />
                        ) : (
                          <div style={{ position: 'absolute', right: '50%', top: 0, height: '100%', borderRadius: 2, background: confidence === '낮음' ? '#888' : '#E24B4A', width: `${Math.min(Math.abs(f.impact), 100) / 2}%` }} />
                        )}
                      </div>
                    </div>
                    <span style={{ minWidth: 36, textAlign: 'right', fontSize: 12, fontWeight: 500, color: f.impact > 0 ? '#1976D2' : f.impact < 0 ? (confidence === '낮음' ? '#888' : '#A32D2D') : 'var(--text-muted)' }}>
                      {f.impact > 0 ? `+${f.impact}%` : `${f.impact}%`}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12 }}>
                  측정 {recordCount}회 기반 · 신뢰도 {confidence}
                </div>
                {confidence === '낮음' && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>더 많은 측정 데이터가 쌓이면 정확도가 올라가요</div>
                )}
              </>
            )}
          </div>

          {/* ⑥ lua의 발견 */}
          <div style={{ margin: '0 12px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 18, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>lua의 발견</div>
            {recordCount < 2 ? (
              <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                꾸준히 기록하면, lua가 패턴을 찾아드릴게요
              </div>
            ) : (
              [
                { text: '자기 전 토너를 챙긴 날, 다음날 모공 점수가 평균 4점 더 좋았어요.', tag: '루틴 발견' },
                { text: '수분이 충분한 주에는 유수분 점수가 평균 6점 더 좋았어요.', tag: '피부 발견' },
                { text: '측정 시각이 일정할수록 점수가 안정적이에요. 주로 일요일 저녁에 재고 있어요.', tag: '패턴 발견' },
              ].map((d, i) => (
                <div key={i} onClick={() => onOpenConsult?.()} style={{
                  padding: '12px 0', cursor: 'pointer',
                  borderTop: i > 0 ? '0.5px solid rgba(255,255,255,0.2)' : 'none',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(172,226,252,0.35))',
                    border: '1px solid rgba(255,255,255,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="10" height="10" viewBox="0 0 642.82 626.11"><path fill="#6598ef" d="M283.39,624.22c-13.36,4.42-27.68.92-38.02-8.6-9.11-8.38-15.79-18.59-19.6-30.36l-11.25-34.71c-5.84-18.02-11.19-35.37-19.86-52.19-18.55-35.99-49.68-62.09-88.22-74.84l-45.43-12.53c-20.65-5.69-45.02-14.73-55.55-33.29-8-14.1-7.19-30.1,2.36-43.17,15.69-21.46,45.08-28.92,69.82-36.01l33.43-9.58c23.08-6.61,43.51-19.41,60.62-36.34l6.6-7.54c14.35-16.41,23.14-36.5,29.38-57.47l9.51-37.53c5.57-21.99,16.02-46.39,38.05-53.68,13.7-4.53,27.46-1.11,38.03,8.53,25.63,23.39,23.97,67.31,40.45,103.36,7.76,16.97,17.54,32.27,31.25,44.71,26.31,23.86,47.15,29.48,77.44,40.68l34.98,12.94c9.87,3.65,18.18,10.09,24.64,18.27,12.32,15.61,12.46,36.51-.08,52.12-8.57,10.67-20.09,17.86-32.88,22.95l-39.33,15.63c-31.62,12.57-58.51,33.68-76.08,63.01-8.47,14.15-14.81,29.08-18.72,45.21l-8.59,35.37c-6.3,25.94-16.47,56.3-42.95,65.05Z"/><path fill="#6598ef" d="M566.24,189.1c-5.51,17.06-12.16,36.33-32.49,34.81-7.19-.54-13.8-4.68-18.36-11.36-9.25-13.54-10.94-33.95-26.05-51.79-18.62-21.99-39.93-22.15-53.83-33-5.85-4.57-9.56-10.02-9.84-16.78-.29-6.71,2.52-12.91,7.73-17.86,11.76-11.16,34.28-13.3,50.87-29.99,18.41-18.52,19.4-40.08,30.52-53.45,7.88-9.48,21.11-12.94,31.78-6.11,14.26,9.13,16.25,29.81,26.68,46.23,9.89,15.56,25.11,25.51,42.3,31.79,7.15,2.61,13.57,5.63,19.28,10.64,7.73,6.79,10.69,18.67,5.07,27.55-4.96,7.84-12.96,12.22-21.47,15.47-28.52,10.89-42.75,24.6-52.2,53.84Z"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text-primary)', lineHeight: 1.5 }}>{d.text}</div>
                    <span style={{ display: 'inline-block', marginTop: 5, fontSize: 9, fontWeight: 500, padding: '2px 7px', borderRadius: 8, background: 'rgba(101,152,239,0.15)', color: 'var(--accent-primary)' }}>{d.tag}</span>
                  </div>
                </div>
              ))
            )}
          </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { getRecords, getTimeSeries, getTotalChanges } from '../storage/SkinStorage';

/**
 * 결과 페이지에 노출되는 7일 추세 카드.
 * - 토글로 컨디션/피부나이 두 지표 전환
 * - 큰 delta 숫자 + 7-bar SVG + 베이스라인 한 줄
 * - TOSS 스타일: 둥근 카드, 큰 typography, subtle shadow, 탭 인터랙션
 *
 * props
 *  - accent: theme accent color (string, e.g. '#6598ef')
 *  - changes: 결과 페이지에서 이미 계산한 getChanges() 결과 (재계산 회피)
 *  - animationDelay: 진입 애니메이션 stagger (CSS animation delay 문자열, e.g. '0.85s')
 */
export default function TrendCard({ accent = '#6598ef', changes = null, animationDelay = '0.85s' }) {
  const [metric, setMetric] = useState('conditionScore'); // 'conditionScore' | 'skinAge'

  const records = useMemo(() => getRecords().filter((r) => !r.differentPerson), []);
  const series = useMemo(() => getTimeSeries(metric).slice(-7), [metric]);
  const totalChanges = useMemo(() => getTotalChanges(), []);

  const METRIC_META = {
    conditionScore: { label: '컨디션', unit: '점', inverse: false, max: 100 },
    skinAge: { label: '피부나이', unit: '세', inverse: true, max: 58 },
  };
  const meta = METRIC_META[metric];

  const hasEnoughData = records.length >= 2;
  const last = series[series.length - 1]?.value ?? null;
  const prev = series.length >= 2 ? series[series.length - 2].value : null;
  const lastDelta = (last != null && prev != null) ? last - prev : null;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.42)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        border: 'none',
        borderRadius: 18,
        padding: 20,
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        animation: `fadeUp 0.5s ease-out ${animationDelay} both`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>이번 주 추세</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>최근 7번 측정 흐름</div>
        </div>
        <MetricToggle metric={metric} setMetric={setMetric} accent={accent} />
      </div>

      {hasEnoughData ? (
        <>
          {/* Delta — big number */}
          <DeltaDisplay
            value={lastDelta}
            unit={meta.unit}
            inverse={meta.inverse}
            accent={accent}
          />

          {/* 7-bar chart */}
          <div style={{ marginTop: 16 }}>
            <BarChart series={series} inverse={meta.inverse} accent={accent} max={meta.max} />
          </div>

          {/* Baseline narrative */}
          {totalChanges && totalChanges.totalRecords >= 2 && (
            <BaselineLine
              totalChanges={totalChanges}
              metric={metric}
              meta={meta}
              accent={accent}
            />
          )}
        </>
      ) : (
        <EmptyHint />
      )}
    </div>
  );
}

function MetricToggle({ metric, setMetric, accent }) {
  const items = [
    { key: 'conditionScore', label: '컨디션' },
    { key: 'skinAge', label: '피부나이' },
  ];
  return (
    <div style={{
      display: 'inline-flex',
      background: 'rgba(0,0,0,0.04)',
      borderRadius: 999, padding: 2,
    }}>
      {items.map((it) => {
        const on = it.key === metric;
        return (
          <button
            key={it.key}
            onClick={() => setMetric(it.key)}
            style={{
              padding: '6px 12px', borderRadius: 999,
              fontSize: 11, fontWeight: 600,
              background: on ? accent : 'transparent',
              color: on ? '#fff' : 'var(--text-muted)',
              border: 'none', cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.16s',
            }}
          >{it.label}</button>
        );
      })}
    </div>
  );
}

function DeltaDisplay({ value, unit, inverse, accent }) {
  if (value == null) {
    return (
      <div>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>
          첫 측정
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>비교할 이전 기록이 아직 없어요</div>
      </div>
    );
  }
  const abs = Math.abs(Math.round(value * 10) / 10);
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  // good = (inverse면 음수가 좋음) / (정방향이면 양수가 좋음)
  const good = inverse ? value < 0 : value > 0;
  const same = value === 0;

  const color = same ? 'var(--text-muted)' : (good ? accent : 'var(--text-secondary)');
  const subtleLabel = same
    ? '지난 측정과 같아요'
    : good
      ? '지난 측정 대비 좋아졌어요'
      : '지난 측정 대비 살짝 변했어요';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontSize: 32, fontWeight: 700, color,
          fontFamily: 'Outfit, sans-serif', lineHeight: 1,
          letterSpacing: -0.5,
        }}>{sign}{abs}</span>
        <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{subtleLabel}</div>
    </div>
  );
}

function BarChart({ series, inverse, accent, max }) {
  // SVG viewBox 사이즈
  const W = 320, H = 100;
  const padTop = 8, padBottom = 18;
  const chartH = H - padTop - padBottom;
  const n = series.length;
  if (n === 0) return null;
  const colW = W / n;
  const barW = Math.min(28, colW * 0.55);

  // y스케일: 데이터 분포에 맞게 (min~max에 약간 여유)
  const values = series.map((s) => s.value).filter((v) => typeof v === 'number');
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const range = Math.max(1, vMax - vMin);
  const pad = range * 0.18;
  const yMin = Math.max(0, vMin - pad);
  const yMax = vMax + pad;
  const yRange = Math.max(1, yMax - yMin);

  // 요일 라벨
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet">
      {/* baseline */}
      <line x1={0} x2={W} y1={H - padBottom} y2={H - padBottom} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      {series.map((s, i) => {
        const x = i * colW + colW / 2 - barW / 2;
        const norm = (s.value - yMin) / yRange; // 0..1
        const h = Math.max(3, norm * chartH);
        const y = H - padBottom - h;
        const isLast = i === n - 1;
        const fill = isLast ? accent : 'rgba(0,0,0,0.14)';
        const dow = DOW[new Date(s.date + 'T00:00:00').getDay()] || '';
        return (
          <g key={s.date + i}>
            <rect x={x} y={y} width={barW} height={h} rx={5} fill={fill} />
            <text
              x={i * colW + colW / 2}
              y={H - 4}
              textAnchor="middle"
              fontSize="10"
              fill="var(--text-muted)"
              fontFamily="inherit"
            >{dow}</text>
          </g>
        );
      })}
    </svg>
  );
}

function BaselineLine({ totalChanges, metric, meta, accent }) {
  const raw = metric === 'skinAge' ? totalChanges.skinAge : totalChanges.overallScore;
  if (raw == null) return null;
  const value = Math.round(raw * 10) / 10;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value);
  const good = meta.inverse ? value < 0 : value > 0;
  const period = totalChanges.period || 0;
  const label = meta.inverse ? '피부나이' : '점수';

  return (
    <div style={{
      marginTop: 14, padding: '10px 12px', borderRadius: 12,
      background: 'rgba(0,0,0,0.025)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        첫 측정{period > 0 ? ` (${period}일 전)` : ''}보다
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: value === 0 ? 'var(--text-muted)' : (good ? accent : 'var(--text-secondary)'),
        fontFamily: 'Outfit, sans-serif',
      }}>
        {label} {sign}{abs}{meta.unit}
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div style={{ padding: '14px 4px 4px' }}>
      <div style={{
        fontSize: 28, fontWeight: 700, color: 'var(--text-primary)',
        fontFamily: 'Outfit, sans-serif', lineHeight: 1, letterSpacing: -0.5,
      }}>첫 측정</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.55 }}>
        다음 측정부터 변화 흐름이 보여요.<br />
        하루 한 번씩 짧게 기록해주세요.
      </div>
    </div>
  );
}

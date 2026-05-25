// 토스증권 스타일 line chart — 부드러운 곡선 + 최고/최저점 라벨 + 평균선.
// 데이터 포인트마다 dot 찍지 않음(시각 노이즈 제거).
// 터치/포인터 스크럽으로 그 시점 날짜·값 확인. crosshair + tooltip.
//
// props:
//   data: [{ date, value }] 또는 [number] (sparkline용)
//   accent: 라인 색 (기본 var(--accent-primary, #6598ef))
//   inverse: 값이 낮을수록 좋은 메트릭(피부나이·트러블)일 때 추세 색 반전
//   height: 차트 높이 (px)
//   showAverage: 평균선 점선 표시
//   averageLabel: 평균선 chip 라벨 (예: '평균')
//   showHighLow: 최고/최저점 라벨 표시 (기본 true)
//   valueFormatter: v => 표시 문자열 (기본 `${v}`)
//   emptyText: 데이터 < 2일 때 표시할 문구
//   compact: 미니 sparkline 모드. 인터랙션·라벨·평균선 모두 없음.

import { useState, useRef } from 'react';

const POSITIVE = '#6598ef'; // 토스 블루 톤
const NEGATIVE = '#e05545'; // 토스 빨강

// date(ISO/Date/timestamp)를 한국어 짧은 표기로. sparkline용 숫자 인덱스면 null.
function fmtDateTime(d) {
  if (d == null) return null;
  if (typeof d === 'number' && Math.abs(d) < 10000) return null; // index 값으로 추정
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    const y = String(dt.getFullYear()).slice(2);
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    // 시:분이 00:00이면 시간 부분 생략 (날짜만 있는 데이터)
    const timeStr = (dt.getHours() === 0 && dt.getMinutes() === 0) ? '' : ` ${hh}:${mm}`;
    return `${y}.${m}.${day}${timeStr}`;
  } catch { return null; }
}

export default function TossLineChart({
  data,
  accent,
  inverse = false,
  height = 180,
  showAverage = true,
  averageLabel = '평균',
  showHighLow = true,
  valueFormatter = (v) => `${v}`,
  emptyText = '데이터가 부족해요',
  compact = false,
}) {
  const svgRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(null);

  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!compact && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>{emptyText}</div>
        )}
      </div>
    );
  }

  // 데이터 정규화: 숫자 배열이면 {value} 형태로
  const norm = data.map((d, i) => typeof d === 'number'
    ? { value: d, date: i }
    : { value: Number(d.value), date: d.date }
  );

  // viewBox — compact는 패딩 최소화, 일반 모드는 라벨 공간 확보.
  const W = 320;
  const H = height;
  const PAD_X = compact ? 4 : 14;
  // 일반 모드: tooltip 상단 22px, 최고 라벨 위쪽 14px → 합 36px 정도 확보
  const PAD_Y_TOP = compact ? 6 : 34;
  const PAD_Y_BOT = compact ? 6 : 42;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y_TOP - PAD_Y_BOT;

  const vals = norm.map(d => d.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = Math.max(maxV - minV, 1);
  const yScale = (v) => PAD_Y_TOP + innerH * (1 - (v - minV) / range);
  const xScale = (i) => PAD_X + (innerW * i) / (norm.length - 1);

  const pts = norm.map((d, i) => ({ x: xScale(i), y: yScale(d.value), v: d.value, i, date: d.date }));

  // spline path
  let path = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = (pts[i].x + pts[i + 1].x) / 2;
    path += ` C${cx.toFixed(2)},${pts[i].y.toFixed(2)} ${cx.toFixed(2)},${pts[i + 1].y.toFixed(2)} ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`;
  }

  const firstV = vals[0];
  const lastV = vals[vals.length - 1];
  const diff = lastV - firstV;
  const isImprove = inverse ? diff < 0 : diff > 0;
  const isDecline = inverse ? diff > 0 : diff < 0;
  const strokeColor = accent || (isImprove ? POSITIVE : isDecline ? NEGATIVE : POSITIVE);

  // 최고/최저점
  let hiIdx = 0, loIdx = 0;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] >= vals[hiIdx]) hiIdx = i;
    if (vals[i] <= vals[loIdx]) loIdx = i;
  }
  const hi = pts[hiIdx];
  const lo = pts[loIdx];
  const hiLoSame = hiIdx === loIdx;

  // 평균
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  const avgY = yScale(avg);

  // 라벨 anchor 보정
  const labelAnchor = (x) => {
    if (x < PAD_X + 30) return 'start';
    if (x > W - PAD_X - 30) return 'end';
    return 'middle';
  };

  // compact 모드 — 미세 area + 라인 + 마지막 점만
  if (compact) {
    const areaPath = `${path} L${pts[pts.length - 1].x.toFixed(2)},${H} L${pts[0].x.toFixed(2)},${H} Z`;
    const gradientId = `toss-area-${Math.random().toString(36).slice(2, 8)}`;
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={strokeColor} />
      </svg>
    );
  }

  // 포인터 → 가장 가까운 데이터 인덱스
  const updateActive = (clientX) => {
    if (!svgRef.current || clientX == null) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const step = innerW / (norm.length - 1);
    const idx = Math.round((svgX - PAD_X) / step);
    const clamped = Math.max(0, Math.min(norm.length - 1, idx));
    setActiveIdx(clamped);
  };
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateActive(e.clientX);
  };
  const onPointerMove = (e) => {
    // 마우스는 버튼 누르고 있어야, 터치는 항상
    if (e.pointerType !== 'touch' && e.buttons === 0 && activeIdx == null) return;
    updateActive(e.clientX);
  };
  const onPointerEnd = (e) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setActiveIdx(null);
  };

  const active = activeIdx != null ? pts[activeIdx] : null;

  // tooltip x clamp — 양 끝에서 라벨이 잘리지 않게
  const tipW = 130;
  const tipX = active ? Math.max(PAD_X + tipW / 2, Math.min(W - PAD_X - tipW / 2, active.x)) : 0;
  const tipDateStr = active ? fmtDateTime(active.date) : null;
  const tipValStr = active ? valueFormatter(active.v) : null;

  return (
    <svg
      ref={svgRef}
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', overflow: 'visible', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={() => setActiveIdx(null)}
    >
      {/* 평균 점선 + 우측 끝 위에 텍스트 라벨 (라인과 겹치지 않게) */}
      {showAverage && !hiLoSame && (
        <>
          <line
            x1={PAD_X} y1={avgY} x2={W - PAD_X} y2={avgY}
            stroke="rgba(0,0,0,0.10)" strokeWidth="1"
            strokeDasharray="2 4"
          />
          <text
            x={W - PAD_X} y={avgY - 5}
            textAnchor="end" fontSize="9.5"
            fill="var(--text-muted)" fontWeight="500"
            opacity="0.85"
            style={{ pointerEvents: 'none' }}
          >
            {averageLabel} {valueFormatter(Math.round(avg))}
          </text>
        </>
      )}

      {/* Area fill — 라인 아래 부드러운 그라데이션 */}
      <defs>
        <linearGradient id={`area-fill-${strokeColor.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L${pts[pts.length - 1].x.toFixed(2)},${H - PAD_Y_BOT} L${pts[0].x.toFixed(2)},${H - PAD_Y_BOT} Z`}
        fill={`url(#area-fill-${strokeColor.replace('#','')})`}
      />

      {/* 메인 라인 */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 데이터 포인트 dot */}
      <g opacity={active ? 0.3 : 1} style={{ transition: 'opacity 0.15s ease' }}>
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" stroke={strokeColor} strokeWidth="1.5" />
        ))}
      </g>

      {/* 최고/최저점 라벨 */}
      {showHighLow && !hiLoSame && (
        <g opacity={active ? 0.25 : 1} style={{ transition: 'opacity 0.15s ease' }}>
          <circle cx={hi.x} cy={hi.y} r="4" fill={strokeColor} />
          <text
            x={hi.x} y={hi.y - 10}
            textAnchor={labelAnchor(hi.x)}
            fontSize="10.5" fontWeight="600" fill={strokeColor}
            style={{ pointerEvents: 'none' }}
          >최고 {valueFormatter(hi.v)}</text>
          <circle cx={lo.x} cy={lo.y} r="4" fill={strokeColor} opacity="0.7" />
          <text
            x={lo.x} y={lo.y + 18}
            textAnchor={labelAnchor(lo.x)}
            fontSize="10.5" fontWeight="600" fill={strokeColor} opacity="0.75"
            style={{ pointerEvents: 'none' }}
          >최저 {valueFormatter(lo.v)}</text>
        </g>
      )}

      {/* X축 날짜 라벨 — 첫/끝 + 중간점 */}
      {(() => {
        const labelIdxs = norm.length <= 3
          ? pts.map((_, i) => i)
          : [0, Math.floor(pts.length / 2), pts.length - 1];
        return labelIdxs.map(i => {
          const dateStr = fmtDateTime(pts[i].date);
          if (!dateStr) return null;
          const short = dateStr.split(' ')[0].split('.').slice(1).join('/');
          return (
            <text
              key={i} x={pts[i].x} y={H - 6}
              textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}
              fontSize="9" fill="var(--text-muted)" opacity="0.6"
              style={{ pointerEvents: 'none' }}
            >{short}</text>
          );
        });
      })()}

      {/* Crosshair + dot + tooltip — 활성 시 */}
      {active && (
        <g style={{ pointerEvents: 'none' }}>
          {/* vertical crosshair — 민트/그린 라인 */}
          <line
            x1={active.x} y1={PAD_Y_TOP - 4}
            x2={active.x} y2={H - PAD_Y_BOT + 4}
            stroke="rgba(101,200,180,0.5)" strokeWidth="1.5"
          />
          {/* highlighted dot */}
          <circle cx={active.x} cy={active.y} r="5" fill="#fff" stroke={strokeColor} strokeWidth="2" />
          {/* tooltip chip — 상단 */}
          <g transform={`translate(${tipX - tipW / 2}, 0)`}>
            <rect x="0" y="0" width={tipW} height="24" rx="12" fill="rgba(50,55,65,0.88)" />
            <text
              x={tipW / 2} y="15.5"
              textAnchor="middle"
              fontSize="10.5" fill="#fff" fontWeight="600"
              style={{ letterSpacing: '-0.1px' }}
            >
              {tipDateStr ? `${tipDateStr} · ${tipValStr}` : tipValStr}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}

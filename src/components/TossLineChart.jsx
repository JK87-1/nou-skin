// 토스증권 스타일 line chart — 부드러운 곡선 + 최고/최저점 라벨 + 평균선.
// 데이터 포인트마다 dot 찍지 않음(시각 노이즈 제거). 깔끔한 단일 라인.
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
//   compact: 미니 sparkline 모드. 평균선·최고/최저 라벨 숨김, area fill, 마지막 dot, 최소 패딩

const POSITIVE = '#6598ef'; // 토스 블루 톤
const NEGATIVE = '#e05545'; // 토스 빨강

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
  const PAD_X = compact ? 4 : 30;
  const PAD_Y_TOP = compact ? 6 : 28;
  const PAD_Y_BOT = compact ? 6 : 28;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y_TOP - PAD_Y_BOT;

  const vals = norm.map(d => d.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  // 데이터가 한 값으로만 이뤄지면 range 0 → flat line 중앙 배치
  const range = Math.max(maxV - minV, 1);
  const yScale = (v) => PAD_Y_TOP + innerH * (1 - (v - minV) / range);
  const xScale = (i) => PAD_X + (innerW * i) / (norm.length - 1);

  const pts = norm.map((d, i) => ({ x: xScale(i), y: yScale(d.value), v: d.value, i, date: d.date }));

  // spline path — 각 segment의 중간점을 control point로 사용 (부드러운 Bezier)
  let path = `M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = (pts[i].x + pts[i + 1].x) / 2;
    path += ` C${cx.toFixed(2)},${pts[i].y.toFixed(2)} ${cx.toFixed(2)},${pts[i + 1].y.toFixed(2)} ${pts[i + 1].x.toFixed(2)},${pts[i + 1].y.toFixed(2)}`;
  }

  // 추세 판단 → 색
  const firstV = vals[0];
  const lastV = vals[vals.length - 1];
  const diff = lastV - firstV;
  const isImprove = inverse ? diff < 0 : diff > 0;
  const isDecline = inverse ? diff > 0 : diff < 0;
  const strokeColor = accent || (isImprove ? POSITIVE : isDecline ? NEGATIVE : POSITIVE);

  // 최고/최저점 인덱스 — 동률이면 가장 늦은 것
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

  // 라벨 위치 보정 — 좌/우 끝에 가까우면 anchor 조정
  const labelAnchor = (x) => {
    if (x < PAD_X + 30) return 'start';
    if (x > W - PAD_X - 30) return 'end';
    return 'middle';
  };
  const labelDx = (x, anchor) => {
    if (anchor === 'start') return -4;
    if (anchor === 'end') return 4;
    return 0;
  };

  // compact 모드 — 미세 area fill + 부드러운 라인 + 마지막 점만. 라벨/평균선 없음.
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
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* 마지막 점만 작게 — anchor 역할 */}
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3" fill={strokeColor} />
      </svg>
    );
  }

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* 평균 점선 + chip 라벨 */}
      {showAverage && !hiLoSame && (
        <>
          <line
            x1={PAD_X} y1={avgY} x2={W - PAD_X} y2={avgY}
            stroke="rgba(0,0,0,0.12)" strokeWidth="1"
            strokeDasharray="2 4"
          />
          {/* 왼쪽 평균 chip */}
          <g transform={`translate(${PAD_X - 2}, ${avgY - 9})`}>
            <rect x="0" y="0" rx="9" ry="9" width={averageLabel.length * 6 + 14} height="18" fill="rgba(0,0,0,0.04)" />
            <text x={(averageLabel.length * 6 + 14) / 2} y="12.5" textAnchor="middle"
              fontSize="9.5" fill="var(--text-muted)" fontWeight="500">
              {averageLabel}
            </text>
          </g>
        </>
      )}

      {/* 메인 라인 */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 최고/최저점 표시 — 토스 스타일 작은 점 + 위/아래 라벨 */}
      {showHighLow && (
        <>
          {!hiLoSame && (
            <g>
              <circle cx={hi.x} cy={hi.y} r="3.5" fill={strokeColor} />
              <text
                x={hi.x + labelDx(hi.x, labelAnchor(hi.x))}
                y={hi.y - 10}
                textAnchor={labelAnchor(hi.x)}
                fontSize="10.5" fontWeight="600" fill={strokeColor}
              >
                최고 {valueFormatter(hi.v)}
              </text>
            </g>
          )}
          <g>
            <circle cx={lo.x} cy={lo.y} r="3.5" fill={strokeColor} opacity={hiLoSame ? 1 : 0.7} />
            {!hiLoSame && (
              <text
                x={lo.x + labelDx(lo.x, labelAnchor(lo.x))}
                y={lo.y + 18}
                textAnchor={labelAnchor(lo.x)}
                fontSize="10.5" fontWeight="600" fill={strokeColor} opacity="0.75"
              >
                최저 {valueFormatter(lo.v)}
              </text>
            )}
          </g>
        </>
      )}
    </svg>
  );
}

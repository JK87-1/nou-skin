/**
 * NOU History Page v1.0
 * 
 * "체중계" 패러다임: 측정 → 기록 → 변화 확인 → 동기부여 → 재측정
 * 
 * Sections:
 * 1. Motivation Card (동기부여 메시지)
 * 2. Skin Age Trend Graph (피부나이 변화 그래프)
 * 3. Metric Changes (지표별 변화)
 * 4. Record List (측정 기록 목록)
 * 5. Streak & Stats (연속 측정 & 통계)
 */

import { useState, useEffect, useRef } from 'react';
import {
  getRecords, getChanges, getTotalChanges, getTimeSeries,
  getStreak, getMotivation, getNextMeasurementInfo, formatDateFull,
} from '../storage/SkinStorage';

// ===== MINI LINE GRAPH (Canvas-based, no dependencies) =====
function TrendGraph({ data, color = '#FF8C42', height = 160, metricKey = 'skinAge', inverse = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const values = data.map(d => d.value);
    const minV = Math.min(...values) - 2;
    const maxV = Math.max(...values) + 2;
    const range = maxV - minV || 1;

    const padL = 36, padR = 16, padT = 20, padB = 32;
    const gW = W - padL - padR;
    const gH = H - padT - padB;

    const getX = (i) => padL + (i / (data.length - 1)) * gW;
    const getY = (v) => padT + (1 - (v - minV) / range) * gH;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = padT + (i / gridSteps) * gH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      // Y-axis labels
      const val = Math.round(maxV - (i / gridSteps) * range);
      ctx.fillStyle = '#bbb'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(val, padL - 6, y + 3);
    }

    // Gradient fill under line
    const gradient = ctx.createLinearGradient(0, padT, 0, H - padB);
    gradient.addColorStop(0, color + '30');
    gradient.addColorStop(1, color + '05');
    ctx.beginPath();
    ctx.moveTo(getX(0), H - padB);
    data.forEach((d, i) => ctx.lineTo(getX(i), getY(d.value)));
    ctx.lineTo(getX(data.length - 1), H - padB);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    data.forEach((d, i) => {
      if (i === 0) ctx.moveTo(getX(i), getY(d.value));
      else ctx.lineTo(getX(i), getY(d.value));
    });
    ctx.stroke();

    // Points
    data.forEach((d, i) => {
      const x = getX(i), y = getY(d.value);
      ctx.beginPath();
      ctx.arc(x, y, i === data.length - 1 ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = i === data.length - 1 ? color : '#fff';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Value label on last point
      if (i === data.length - 1) {
        ctx.fillStyle = color;
        ctx.font = 'bold 12px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.value, x, y - 12);
      }
    });

    // X-axis date labels
    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const labelInterval = data.length <= 6 ? 1 : Math.ceil(data.length / 6);
    data.forEach((d, i) => {
      if (i % labelInterval === 0 || i === data.length - 1) {
        ctx.fillText(d.label, getX(i), H - padB + 16);
      }
    });

    // Trend arrow
    if (data.length >= 2) {
      const first = data[0].value, last = data[data.length - 1].value;
      const diff = last - first;
      const improving = inverse ? diff < 0 : diff > 0;
      if (Math.abs(diff) >= 1) {
        ctx.fillStyle = improving ? '#4CAF50' : '#f44336';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        const arrow = improving ? '▲' : '▼';
        const text = `${arrow} ${Math.abs(diff)}${inverse ? '세' : '점'}`;
        ctx.fillText(text, padL + 4, padT - 6);
      }
    }

  }, [data, color, height, inverse]);

  if (data.length < 2) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 13 }}>
        2회 이상 측정하면 그래프가 나타나요 📈
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: '100%', height, display: 'block' }} />;
}

// ===== CHANGE INDICATOR =====
function ChangeIndicator({ diff, unit = '점', inverse = false, size = 'normal' }) {
  if (diff === 0 || diff === undefined) return <span style={{ fontSize: size === 'small' ? 10 : 12, color: '#bbb' }}>—</span>;
  const improved = inverse ? diff < 0 : diff > 0;
  const color = improved ? '#4CAF50' : '#f44336';
  const arrow = improved ? '↑' : '↓';
  const fs = size === 'small' ? 10 : 12;
  return (
    <span style={{ fontSize: fs, fontWeight: 700, color }}>
      {arrow}{Math.abs(diff)}{unit}
    </span>
  );
}

// ===== MAIN HISTORY PAGE =====
export default function HistoryPage({ onBack, onMeasure }) {
  const [records, setRecords] = useState([]);
  const [graphMetric, setGraphMetric] = useState('skinAge');
  const [motivation, setMotivation] = useState(null);
  const [streak, setStreak] = useState({ count: 0 });
  const [changes, setChanges] = useState(null);
  const [totalChanges, setTotalChanges] = useState(null);
  const [nextInfo, setNextInfo] = useState(null);

  useEffect(() => {
    setRecords(getRecords());
    setMotivation(getMotivation());
    setStreak(getStreak());
    setChanges(getChanges());
    setTotalChanges(getTotalChanges());
    setNextInfo(getNextMeasurementInfo());
  }, []);

  const graphData = getTimeSeries(graphMetric);
  const graphOptions = [
    { key: 'skinAge', label: '피부나이', color: '#FF6B35', inverse: true },
    { key: 'overallScore', label: '종합점수', color: '#FF8C42', inverse: false },
    { key: 'moisture', label: '수분도', color: '#4FC3F7', inverse: false },
    { key: 'wrinkleScore', label: '주름', color: '#9575CD', inverse: false },
    { key: 'elasticityScore', label: '탄력', color: '#F06292', inverse: false },
    { key: 'textureScore', label: '피부결', color: '#7986CB', inverse: false },
    { key: 'darkCircleScore', label: '다크서클', color: '#78909C', inverse: false },
  ];
  const currentGraphOption = graphOptions.find(o => o.key === graphMetric) || graphOptions[0];

  // 10개 지표 변화 표시용
  const metricChangeList = changes ? [
    { ...changes.skinAge },
    { ...changes.overallScore },
    { ...changes.moisture },
    { ...changes.skinTone },
    { ...changes.wrinkleScore },
    { ...changes.poreScore },
    { ...changes.elasticityScore },
    { ...changes.pigmentationScore },
    { ...changes.textureScore },
    { ...changes.darkCircleScore },
  ] : [];

  return (
    <div className="app-container" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#FF8C42,#FF6B35)', padding: '48px 20px 24px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="btn-back" onClick={onBack}>←</button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>📊 내 피부 기록</span>
          <div style={{ width: 38 }} />
        </div>

        {/* Streak + Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit,sans-serif' }}>{streak.count}</div>
            <div style={{ fontSize: 10, opacity: 0.8 }}>🔥 연속 주</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit,sans-serif' }}>{records.length}</div>
            <div style={{ fontSize: 10, opacity: 0.8 }}>📋 총 측정</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit,sans-serif' }}>
              {totalChanges ? `${totalChanges.skinAge > 0 ? '+' : ''}${totalChanges.skinAge}` : '—'}
            </div>
            <div style={{ fontSize: 10, opacity: 0.8 }}>🎂 누적 변화</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px' }}>
        {/* Motivation Card */}
        {motivation && (
          <div style={{
            background: 'linear-gradient(135deg,#FFFBF5,#FFF3E6)', border: '1px solid #FFE0B2',
            borderRadius: 18, padding: '18px 16px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 32 }}>{motivation.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#333', marginBottom: 4 }}>{motivation.title}</div>
                <div style={{ fontSize: 13, color: '#777', lineHeight: 1.6 }}>{motivation.body}</div>
              </div>
            </div>
            {motivation.cta && (
              <button className="btn-primary" onClick={onMeasure} style={{ marginTop: 12, fontSize: 14, padding: 14 }}>
                {motivation.cta}
              </button>
            )}
          </div>
        )}

        {/* Next Measurement Reminder */}
        {nextInfo && records.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: nextInfo.isOverdue ? '#FFF3E0' : '#F3F8FF',
            border: `1px solid ${nextInfo.isOverdue ? '#FFE0B2' : '#BBDEFB'}`,
            borderRadius: 14, padding: '12px 14px', marginBottom: 16,
          }}>
            <span style={{ fontSize: 20 }}>{nextInfo.isOverdue ? '⏰' : '📅'}</span>
            <div style={{ flex: 1, fontSize: 13, color: nextInfo.isOverdue ? '#E65100' : '#555' }}>
              {nextInfo.message}
            </div>
            {(nextInfo.dueIn <= 1 || nextInfo.isOverdue) && (
              <button onClick={onMeasure} style={{
                background: '#FF8C42', color: '#fff', border: 'none', borderRadius: 10,
                padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>측정</button>
            )}
          </div>
        )}

        {/* Trend Graph */}
        <div className="card" style={{ padding: '16px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>📈 변화 추이</span>
          </div>

          {/* Graph metric selector */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {graphOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setGraphMetric(opt.key)}
                style={{
                  background: graphMetric === opt.key ? opt.color : '#f5f5f5',
                  color: graphMetric === opt.key ? '#fff' : '#999',
                  border: 'none', borderRadius: 20, padding: '5px 12px',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <TrendGraph
            data={graphData}
            color={currentGraphOption.color}
            inverse={currentGraphOption.inverse}
            height={170}
          />
        </div>

        {/* Metric Changes (직전 대비) */}
        {changes && (
          <div className="card" style={{ padding: '16px 12px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📊 지난 측정 대비 변화</div>
            {metricChangeList.map((c, i) => (
              <div key={c.key} style={{
                display: 'flex', alignItems: 'center', padding: '10px 0',
                borderBottom: i < metricChangeList.length - 1 ? '1px solid #f5f5f5' : 'none',
              }}>
                <span style={{ fontSize: 18, width: 30 }}>{c.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: '#444' }}>{c.label}</span>
                <span style={{ fontSize: 13, color: '#888', marginRight: 8 }}>{c.prev} → {c.curr}</span>
                <ChangeIndicator diff={c.diff} unit={c.unit} inverse={c.inverse} />
              </div>
            ))}
          </div>
        )}

        {/* Total Progress (첫 측정 대비) */}
        {totalChanges && totalChanges.totalRecords >= 3 && (
          <div style={{
            background: 'linear-gradient(135deg,#E8F5E9,#C8E6C9)', border: '1px solid #A5D6A7',
            borderRadius: 18, padding: 18, marginBottom: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2E7D32', marginBottom: 8 }}>🌱 전체 기간 변화</div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>
              <strong>{formatDateFull(totalChanges.startDate)}</strong>부터 <strong>{totalChanges.totalRecords}회</strong> 측정 ({totalChanges.period}일)
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: totalChanges.skinAge <= 0 ? '#2E7D32' : '#f44336' }}>
                  {totalChanges.skinAge > 0 ? '+' : ''}{totalChanges.skinAge}세
                </div>
                <div style={{ fontSize: 10, color: '#888' }}>피부나이</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: totalChanges.overallScore >= 0 ? '#2E7D32' : '#f44336' }}>
                  {totalChanges.overallScore > 0 ? '+' : ''}{totalChanges.overallScore}점
                </div>
                <div style={{ fontSize: 10, color: '#888' }}>종합점수</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: totalChanges.moisture >= 0 ? '#2E7D32' : '#f44336' }}>
                  {totalChanges.moisture > 0 ? '+' : ''}{totalChanges.moisture}%
                </div>
                <div style={{ fontSize: 10, color: '#888' }}>수분도</div>
              </div>
            </div>
          </div>
        )}

        {/* Record List */}
        <div className="card" style={{ padding: '16px 12px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🗓 측정 기록</div>
          {records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: '#bbb' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📸</div>
              <div style={{ fontSize: 13 }}>아직 기록이 없어요</div>
            </div>
          ) : (
            [...records].reverse().map((r, i) => (
              <div key={r.date} style={{
                display: 'flex', alignItems: 'center', padding: '12px 0',
                borderBottom: i < records.length - 1 ? '1px solid #f5f5f5' : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{formatDateFull(r.date)}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    {r.skinType} · {(r.concerns || []).join(' · ')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: '#FF6B35' }}>{r.skinAge}세</div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>종합 {r.overallScore}점</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* CTA */}
        <button className="btn-primary" onClick={onMeasure} style={{ marginTop: 8, fontSize: 15 }}>
          📸 지금 측정하기
        </button>

        {records.length > 0 && (
          <p style={{ textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 14 }}>
            매주 같은 조건(시간, 조명, 맨얼굴)에서 측정하면 정확도가 높아져요
          </p>
        )}
      </div>
    </div>
  );
}

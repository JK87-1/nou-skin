/**
 * NOU Retention Features v1.0
 *
 * 1. PredictionScreen — 측정 전 예측 선택
 * 2. PredictionResult — 측정 후 적중 확인
 * 3. AgeSetupModal — 최초 실제나이 입력
 * 4. SkinAgeRaceCard — 피부나이 레이스 프로그레스
 * 5. WeeklyReportCard — 주간 리포트 (다크 테마)
 * 6. ShareReportButton — 리포트 공유
 */

import { useState } from 'react';
import { getPredictionAccuracy, getLatestRecord, getStreak } from '../storage/SkinStorage';

// ═══════════════════════════════════════════
// 1. PredictionScreen — 측정 전 예측 화면
// ═══════════════════════════════════════════

export function PredictionScreen({ lastScore, onPredict, onSkip }) {
  const [selected, setSelected] = useState(null);

  const options = [
    { key: 'up', emoji: '📈', label: '올랐을 것 같아!', sub: '좋은 습관을 유지했다면' },
    { key: 'same', emoji: '➡️', label: '비슷할 것 같아', sub: '특별한 변화가 없었다면' },
    { key: 'down', emoji: '📉', label: '떨어졌을 것 같아...', sub: '스트레스나 수면 부족이 있었다면' },
  ];

  return (
    <div style={{
      padding: '60px 24px 40px', textAlign: 'center',
      background: 'linear-gradient(180deg, #FFF8F0, #FFFFFF)',
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ fontSize: 56, marginBottom: 16, animation: 'popIn 0.5s ease-out' }}>🔮</div>
      <h2 style={{
        fontSize: 22, fontWeight: 800, marginBottom: 8, color: '#2d2520',
        fontFamily: "'Outfit', sans-serif", animation: 'fadeUp 0.5s ease-out 0.1s both',
      }}>
        이번 주 예측
      </h2>
      <p style={{
        fontSize: 14, color: '#888', marginBottom: 36,
        animation: 'fadeUp 0.5s ease-out 0.2s both',
      }}>
        지난 종합점수: <b style={{ color: '#FF8C42', fontSize: 20, fontFamily: "'Outfit', sans-serif" }}>{lastScore}점</b>
      </p>

      <p style={{
        fontSize: 16, fontWeight: 600, marginBottom: 24, color: '#3d3328',
        animation: 'fadeUp 0.5s ease-out 0.3s both',
      }}>
        이번 주 점수가 어떻게 변했을까요?
      </p>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        maxWidth: 320, width: '100%',
      }}>
        {options.map((opt, i) => (
          <button
            key={opt.key}
            onClick={() => {
              setSelected(opt.key);
              setTimeout(() => onPredict(opt.key), 300);
            }}
            style={{
              padding: '16px 20px', borderRadius: 16,
              border: selected === opt.key ? '2px solid #FF8C42' : '2px solid #f0f0f0',
              background: selected === opt.key ? '#FFF8F0' : '#fff',
              cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 14,
              transition: 'all 0.2s',
              animation: `fadeUp 0.4s ease-out ${0.3 + i * 0.08}s both`,
              transform: selected === opt.key ? 'scale(0.97)' : 'scale(1)',
            }}
          >
            <span style={{ fontSize: 28 }}>{opt.emoji}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#2d2520' }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{opt.sub}</div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={onSkip}
        style={{
          marginTop: 28, background: 'none', border: 'none',
          color: '#ccc', fontSize: 13, cursor: 'pointer',
          animation: 'fadeUp 0.4s ease-out 0.6s both',
        }}
      >
        건너뛰고 바로 측정하기
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════
// 2. PredictionResult — 측정 후 예측 결과
// ═══════════════════════════════════════════

export function PredictionResult({ prediction, previousScore, actualScore }) {
  if (!prediction) return null;

  const diff = actualScore - previousScore;
  const actualDirection = diff > 2 ? 'up' : diff < -2 ? 'down' : 'same';
  const isCorrect = prediction === actualDirection;
  const accuracy = getPredictionAccuracy();

  return (
    <div style={{
      margin: '0 0 16px', padding: '16px 20px', borderRadius: 20,
      background: isCorrect
        ? 'linear-gradient(135deg, rgba(76,203,113,0.12), rgba(102,187,106,0.08))'
        : 'linear-gradient(135deg, rgba(255,183,120,0.15), rgba(255,224,178,0.1))',
      border: `1px solid ${isCorrect ? 'rgba(76,203,113,0.2)' : 'rgba(255,183,120,0.25)'}`,
      animation: 'popIn 0.5s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 36 }}>{isCorrect ? '🎯' : '😮'}</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: isCorrect ? '#2E7D32' : '#E65100' }}>
            {isCorrect ? '예측 적중!' : '아쉽게 빗나갔어요'}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
            예측: {prediction === 'up' ? '상승' : prediction === 'down' ? '하락' : '유지'}
            {' → '}실제: <span style={{ fontWeight: 700, color: diff > 0 ? '#4ecb71' : diff < 0 ? '#f06050' : '#888' }}>
              {diff > 0 ? `+${diff}` : diff}점
            </span>
          </div>
        </div>
      </div>
      {accuracy > 0 && (
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 10, textAlign: 'right' }}>
          누적 적중률: <span style={{ fontWeight: 700, color: '#FF8C42' }}>{accuracy}%</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 3. AgeSetupModal — 실제나이 입력 모달
// ═══════════════════════════════════════════

export function AgeSetupModal({ skinAge, onComplete, onSkip }) {
  const [realAge, setRealAge] = useState(skinAge || 25);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <div style={{
        background: '#fff', borderRadius: 28,
        padding: '36px 28px 28px', maxWidth: 340, width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        animation: 'popIn 0.4s ease-out 0.1s both',
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🏃</div>
        <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: '#2d2520' }}>
          피부나이 레이스 시작!
        </h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 28, lineHeight: 1.7 }}>
          실제 나이를 입력하면<br />
          <b style={{ color: '#FF8C42' }}>피부나이 = 실제나이</b>를 목표로<br />
          매주 진행률을 추적합니다.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 28 }}>
          <button
            onClick={() => setRealAge(Math.max(15, realAge - 1))}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              border: '2px solid #eee', background: '#fff',
              fontSize: 22, cursor: 'pointer', color: '#666',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >−</button>
          <div>
            <div style={{
              fontSize: 42, fontWeight: 900,
              fontFamily: "'Outfit', sans-serif", color: '#2d2520',
            }}>{realAge}</div>
            <div style={{ fontSize: 12, color: '#aaa' }}>세</div>
          </div>
          <button
            onClick={() => setRealAge(Math.min(65, realAge + 1))}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              border: '2px solid #eee', background: '#fff',
              fontSize: 22, cursor: 'pointer', color: '#666',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >+</button>
        </div>

        <button
          onClick={() => onComplete(realAge)}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 50,
            border: 'none',
            background: 'linear-gradient(135deg, #FFB878, #FF6B4A, #FF3D7F)',
            boxShadow: '0 4px 20px rgba(255,100,100,0.3)',
            color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          목표 설정 완료
        </button>
        <button
          onClick={onSkip}
          style={{
            marginTop: 12, background: 'none', border: 'none',
            color: '#ccc', fontSize: 12, cursor: 'pointer',
          }}
        >
          나중에 설정하기
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 4. SkinAgeRaceCard — 피부나이 레이스 프로그레스
// ═══════════════════════════════════════════

export function SkinAgeRaceCard({ goal }) {
  if (!goal || !goal.realAge) return null;

  const { realAge, startSkinAge, currentSkinAge } = goal;
  const totalGap = startSkinAge - realAge;
  const currentGap = currentSkinAge - realAge;
  const progress = totalGap > 0
    ? Math.min(100, Math.round(((totalGap - currentGap) / totalGap) * 100))
    : 100;
  const isAchieved = currentSkinAge <= realAge;
  const weeksToGo = currentGap > 0 ? Math.ceil(currentGap / 0.5) : 0;

  return (
    <div style={{
      padding: '20px', borderRadius: 22,
      background: isAchieved
        ? 'linear-gradient(135deg, rgba(76,203,113,0.12), rgba(102,187,106,0.08))'
        : 'linear-gradient(135deg, rgba(255,248,240,0.8), rgba(255,232,208,0.6))',
      border: `1px solid ${isAchieved ? 'rgba(76,203,113,0.2)' : 'rgba(255,208,160,0.4)'}`,
      marginBottom: 16,
      animation: 'fadeUp 0.5s ease-out',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#2d2520' }}>🏃 피부나이 레이스</div>
          <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
            목표: 피부나이 {realAge}세 (실제나이)
          </div>
        </div>
        {isAchieved && <span style={{ fontSize: 28 }}>🎉</span>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 36, marginBottom: 18 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#888' }}>현재 피부나이</div>
          <div style={{
            fontSize: 34, fontWeight: 900, fontFamily: "'Outfit', sans-serif",
            color: currentGap > 3 ? '#FF6B35' : currentGap > 0 ? '#FFA726' : '#4CAF50',
          }}>
            {currentSkinAge}<span style={{ fontSize: 16 }}>세</span>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#888' }}>실제 나이</div>
          <div style={{
            fontSize: 34, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#333',
          }}>
            {realAge}<span style={{ fontSize: 16 }}>세</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{
          height: 10, borderRadius: 5,
          background: 'rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 5,
            background: isAchieved
              ? 'linear-gradient(90deg, #66BB6A, #4CAF50)'
              : 'linear-gradient(90deg, #FFB74D, #FF8C42)',
            width: `${progress}%`,
            transition: 'width 1.5s cubic-bezier(.4,0,.2,1)',
          }} />
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>
        {isAchieved
          ? '🎉 목표 달성! 피부나이가 실제 나이와 같거나 어려요!'
          : `진행률 ${progress}% · 약 ${weeksToGo}주 후 목표 달성 예상`}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 5. WeeklyReportCard — 주간 리포트 (다크 테마)
// ═══════════════════════════════════════════

export function WeeklyReportCard({ current, previous, streak, predictionAccuracy }) {
  if (!current) return null;

  const metrics = [
    { key: 'overallScore', label: '종합점수', emoji: '📊' },
    { key: 'moisture', label: '수분도', emoji: '💧' },
    { key: 'skinTone', label: '피부톤', emoji: '🎨' },
    { key: 'oilBalance', label: '유분', emoji: '💦' },
  ];

  const changes = metrics.map(m => ({
    ...m,
    current: current[m.key] ?? 0,
    diff: previous ? (current[m.key] ?? 0) - (previous[m.key] ?? 0) : 0,
  }));

  const mvp = previous
    ? changes.filter(c => c.diff > 0).sort((a, b) => b.diff - a.diff)[0]
    : null;
  const warning = previous
    ? changes.filter(c => c.diff < 0).sort((a, b) => a.diff - b.diff)[0]
    : null;

  const now = new Date();
  const weekNum = Math.ceil(now.getDate() / 7);
  const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const dateLabel = `${monthNames[now.getMonth()]} ${weekNum}주차`;

  return (
    <div
      id="weekly-report-card"
      style={{
        padding: '24px 20px', borderRadius: 24,
        background: 'linear-gradient(180deg, #1A1A2E, #16213E)',
        color: '#fff', position: 'relative', overflow: 'hidden',
        marginBottom: 16,
        animation: 'fadeUp 0.5s ease-out',
      }}
    >
      {/* Background decoration */}
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 120, height: 120, borderRadius: '50%',
        background: 'rgba(255,140,66,0.1)',
      }} />
      <div style={{
        position: 'absolute', bottom: -20, left: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: 'rgba(130,177,255,0.06)',
      }} />

      {/* Header */}
      <div style={{ marginBottom: 20, position: 'relative' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
          📊 NOU 주간 리포트
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>
          {dateLabel}
        </div>
      </div>

      {/* Overall Score */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 20px', borderRadius: 16,
        background: 'rgba(255,255,255,0.08)',
        marginBottom: 16,
      }}>
        <div style={{
          fontSize: 44, fontWeight: 900, fontFamily: "'Outfit', sans-serif",
          color: '#FF8C42',
        }}>
          {current.overallScore}
        </div>
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>종합점수</div>
          {previous && (
            <div style={{
              fontSize: 15, fontWeight: 700, marginTop: 2,
              color: changes[0].diff >= 0 ? '#66BB6A' : '#EF5350',
            }}>
              {changes[0].diff > 0 ? '▲' : changes[0].diff < 0 ? '▼' : '→'} {Math.abs(changes[0].diff)}점
            </div>
          )}
        </div>
      </div>

      {/* MVP & Warning */}
      {(mvp || warning) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {mvp && (
            <div style={{
              flex: 1, padding: '12px 14px', borderRadius: 14,
              background: 'rgba(102,187,106,0.12)',
              border: '1px solid rgba(102,187,106,0.25)',
            }}>
              <div style={{ fontSize: 10, color: '#66BB6A', marginBottom: 4 }}>🏆 이번 주 MVP</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {mvp.emoji} {mvp.label} <span style={{ color: '#66BB6A' }}>+{mvp.diff}</span>
              </div>
            </div>
          )}
          {warning && (
            <div style={{
              flex: 1, padding: '12px 14px', borderRadius: 14,
              background: 'rgba(239,83,80,0.08)',
              border: '1px solid rgba(239,83,80,0.18)',
            }}>
              <div style={{ fontSize: 10, color: '#EF5350', marginBottom: 4 }}>⚠️ 주의 필요</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {warning.emoji} {warning.label} <span style={{ color: '#EF5350' }}>{warning.diff}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail metrics */}
      <div style={{ marginBottom: 16 }}>
        {changes.slice(1).map(c => (
          <div key={c.key} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '9px 0',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
              {c.emoji} {c.label}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {c.current}
              {previous && (
                <span style={{
                  fontSize: 11, marginLeft: 6,
                  color: c.diff > 0 ? '#66BB6A' : c.diff < 0 ? '#EF5350' : 'rgba(255,255,255,0.3)',
                }}>
                  {c.diff > 0 ? `+${c.diff}` : c.diff === 0 ? '→' : c.diff}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Streak + Prediction + Skin Age */}
      <div style={{
        display: 'flex', justifyContent: 'space-around',
        padding: '14px 0',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#FF8C42' }}>
            🔥 {streak}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>연속 측정</div>
        </div>
        {predictionAccuracy > 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#82B1FF' }}>
              🎯 {predictionAccuracy}%
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>예측 적중률</div>
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Outfit', sans-serif" }}>
            {current.skinAge}세
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>피부나이</div>
        </div>
      </div>

      {/* NOU watermark */}
      <div style={{
        textAlign: 'center', marginTop: 14,
        fontSize: 11, color: 'rgba(255,255,255,0.15)',
        fontWeight: 700, letterSpacing: 3,
      }}>
        NOU · AI 피부 분석
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 6. ShareReportButton — 공유 버튼
// ═══════════════════════════════════════════

export function ShareReportButton() {
  const handleShare = async () => {
    const latest = getLatestRecord();
    const streak = getStreak();
    if (!latest) return;

    const text = `🧴 NOU 피부 분석 리포트

📊 종합점수: ${latest.overallScore}점
🔬 피부나이: ${latest.skinAge}세
💧 수분도: ${latest.moisture}%
🎨 피부톤: ${latest.skinTone}점

🔥 ${streak.count}주 연속 측정 중!

AI 피부 분석 → skin.nou.kr`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'NOU 피부 분석 리포트', text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('리포트가 클립보드에 복사되었습니다!');
      }
    } catch (e) {
      console.log('공유 실패:', e);
    }
  };

  return (
    <button
      onClick={handleShare}
      style={{
        display: 'block', width: '100%',
        padding: '14px 0', borderRadius: 50, border: 'none',
        background: 'linear-gradient(135deg, #1A1A2E, #16213E)',
        color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: '0 4px 20px rgba(26,26,46,0.3)',
        marginBottom: 16,
      }}
    >
      📤 리포트 공유하기
    </button>
  );
}

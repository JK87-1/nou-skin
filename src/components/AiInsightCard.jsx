/**
 * 오늘의 피부 이야기 — AI 인사이트 카드 (홈 탭 상단)
 * 최근 분석 결과 기반 맞춤 조언
 */
import { useState, useCallback } from 'react';
import { getLatestRecord, getChanges } from '../storage/SkinStorage';

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getTimeLabel() {
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

export default function AiInsightCard({ onOpenChat, greeting, dateInfo }) {
  const [liked, setLiked] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const latest = getLatestRecord();
  const changes = getChanges();

  if (!latest) return null;

  let insight = '';
  let icon = '';
  let sub = '';

  const month = new Date().getMonth() + 1;
  const season = month <= 2 || month === 12 ? 'winter' : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'fall';

  if (changes) {
    const improved = Object.values(changes).filter(c => c.improved && Math.abs(c.diff) >= 2);
    const worsened = Object.values(changes).filter(c => !c.improved && Math.abs(c.diff) >= 3 && c.key !== 'overallScore');

    if (improved.length >= 3) {
      icon = '';
      const names = improved.slice(0, 3).map(c => c.label).join(', ');
      insight = pick([
        `${names} 등 ${improved.length}개가 같이 좋아지고 있어요. 지금 루틴이 잘 맞는 것 같아요!`,
        `${improved.length}개 지표가 올라가고 있어요. 꾸준히 해온 게 피부에 보이기 시작했어요.`,
        `좋은 흐름이에요! ${names}이 함께 올라가면서 피부가 전반적으로 좋아지고 있어요.`,
        `요즘 뭐 바꾸셨어요? ${names}이 눈에 띄게 좋아지고 있거든요!`,
        `${improved.length}개나 동시에 올라가는 건 흔치 않아요. 지금 하고 있는 거 정답이에요.`,
        `피부가 확실히 반응하고 있어요. ${names} 모두 상승 중이에요.`,
      ]);
      sub = pick(['지금처럼만 해주세요, 충분해요.', '이 흐름 놓치지 마세요!', '루틴 바꾸지 마세요, 지금이 딱이에요.']);
    } else if (worsened.length > 0) {
      const worst = worsened.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
      icon = worst.icon || '';
      const diffAbs = Math.abs(worst.diff);
      insight = pick([
        `${worst.label}가 ${diffAbs}점 떨어졌어요. ${worst.label === '수분도' ? '요즘 건조하지 않았나요? 수분 보충에 신경 써보세요.' : '최근 생활 패턴이 바뀐 건 없는지 한번 돌아보세요.'}`,
        `${worst.label}에 변화가 있었어요(${worst.diff > 0 ? '+' : ''}${worst.diff}). 이번 주는 이 부분을 좀 더 챙겨보세요.`,
        `${worst.label}가 이전보다 ${diffAbs}점 내려갔어요. 같이 원인 찾아봐요.`,
        `${worst.label} 쪽이 좀 신경 쓰여요. 혹시 요즘 잠을 잘 못 자거나 스트레스 받은 건 아니에요?`,
        `${worst.label}가 살짝 주춤하고 있어요. 크게 걱정할 건 아닌데, 이번 주 집중해봐요.`,
        `피부가 ${worst.label} 쪽으로 신호를 보내고 있어요. 한번 케어 루틴을 점검해볼까요?`,
      ]);
      if (improved.length > 0) {
        sub = pick([
          `대신 ${improved[0].label}은 ${Math.abs(improved[0].diff)}점 올라갔어요!`,
          `${improved[0].label}은 좋아지고 있으니까 너무 걱정 마세요.`,
        ]);
      }
    } else {
      insight = generateMetricInsight(latest, season);
      icon = getMetricIcon(latest);
    }
  } else {
    // 변화 데이터 없음 (첫 측정)
    insight = generateMetricInsight(latest, season);
    icon = getMetricIcon(latest);
    const concerns = latest.concerns || [];
    if (concerns.length > 0) {
      sub = `지금 가장 신경 쓸 부분: ${concerns[0]}`;
    } else {
      sub = '다음에 한 번 더 측정하면 변화를 비교할 수 있어요.';
    }
  }

  return (
    <div onClick={onOpenChat} style={{
      padding: '16px 18px', cursor: 'pointer',
      background: 'var(--card-bg)',
      backdropFilter: 'var(--card-blur)', WebkitBackdropFilter: 'var(--card-blur)',
      border: 'none',
      boxShadow: 'var(--card-shadow)',
      borderRadius: '36px 36px 7px 36px',
    }}>
      {/* 본문 영역 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#58aefe', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", flexShrink: 0, lineHeight: 1.8 }}>lua</span>
        {/* 본문 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {greeting && <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary, #1A1A1A)', letterSpacing: -0.3, lineHeight: 1.8, marginBottom: 0 }}>{greeting}</div>}
          {/* 인사이트 본문 */}
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary, #1A1A1A)', lineHeight: 1.8 }}>
            {(() => {
              const match = insight.match(/^([^.!?]+[.!?])\s*(.*)$/);
              if (match && match[2]) return <>{match[1]}<br/>{match[2]}</>;
              return insight;
            })()}
          </div>
          {/* 하단: sub + 시간/버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
            {sub ? (
              <div style={{ fontSize: 12, color: '#4a9ec7', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" fill="#d0eaf8" />
                  <text x="12" y="16.5" textAnchor="middle" fontSize="14" fontWeight="700" fill="#5aaad8" fontFamily="inherit">!</text>
                </svg>
                {sub}
              </div>
            ) : <span />}
            <span style={{ flex: 1 }} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted, #8C8C8C)' }}>{getTimeLabel()}</span>
              <button onClick={(e) => { e.stopPropagation(); setLiked(false); setRefreshKey(k => k + 1); }} style={{
                border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #8C8C8C)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                </svg>
              </button>
              <button onClick={(e) => { e.stopPropagation(); setLiked(!liked); }} style={{
                border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill={liked ? '#FF8A9B' : 'none'} stroke={liked ? '#FF8A9B' : 'var(--text-muted, #8C8C8C)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity={liked ? 1 : 0.4}>
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getMetricIcon(latest) {
  const weakest = getWeakestMetric(latest);
  const iconMap = {
    moisture: '', skinTone: '', wrinkleScore: '', poreScore: '',
    elasticityScore: '', pigmentationScore: '', textureScore: '',
    darkCircleScore: '', oilBalance: '',
  };
  return iconMap[weakest.key] || '';
}

function getWeakestMetric(latest) {
  const metrics = [
    { key: 'moisture', val: latest.moisture ?? 100, label: '수분도' },
    { key: 'skinTone', val: latest.skinTone ?? 100, label: '피부톤' },
    { key: 'wrinkleScore', val: latest.wrinkleScore ?? 100, label: '주름' },
    { key: 'poreScore', val: latest.poreScore ?? 100, label: '모공' },
    { key: 'elasticityScore', val: latest.elasticityScore ?? 100, label: '탄력' },
    { key: 'pigmentationScore', val: latest.pigmentationScore ?? 100, label: '색소' },
    { key: 'textureScore', val: latest.textureScore ?? 100, label: '피부결' },
    { key: 'darkCircleScore', val: latest.darkCircleScore ?? 100, label: '다크서클' },
  ];
  return metrics.sort((a, b) => a.val - b.val)[0];
}

function generateMetricInsight(latest, season) {
  const w = getWeakestMetric(latest);
  const v = w.val;
  const overall = latest.overallScore;

  const seasonContext = {
    winter: '겨울철 건조한 실내 환경이',
    spring: '봄철 미세먼지와 꽃가루가',
    summer: '여름철 강한 자외선과 높은 습도가',
    fall: '환절기 급격한 온도 변화가',
  }[season];

  if (overall >= 75) {
    return pick([
      `종합 ${overall}점, 피부 컨디션 좋아요! ${w.label}(${v}점)만 조금 더 챙기면 완벽해요.`,
      `전반적으로 건강한 피부예요(${overall}점). ${w.label}을 한 단계 올려볼까요?`,
      `피부 관리 잘하고 계세요. ${seasonContext} 영향을 줄 수 있으니 보습만 좀 더 신경 쓰세요.`,
      `${overall}점이면 상위권이에요! ${w.label}만 챙기면 거의 만점 피부예요.`,
      `오늘 피부 상태 진짜 좋아요. 어제 뭐 하셨어요? 비결이 궁금해요.`,
      `피부가 빛나고 있어요. ${w.label}(${v}점)도 곧 따라올 거예요.`,
      `꾸준함이 만든 결과예요. ${overall}점, 스스로 칭찬해도 돼요.`,
      `${w.label} 말고는 다 좋아요. 하나만 집중하면 되니까 부담 없죠?`,
    ]);
  }
  if (overall >= 55) {
    return pick([
      `종합 ${overall}점이에요. ${w.label}(${v}점)이 좀 아쉬운데, 맞춤 케어로 충분히 올릴 수 있어요.`,
      `${w.label}(${v}점)이 점수를 끌어내리고 있어요. 여기만 집중하면 금방 좋아질 거예요.`,
      `피부 컨디션이 보통이에요(${overall}점). ${seasonContext} 피부에 부담이 될 수 있으니 조심하세요.`,
      `나쁘지 않아요! ${w.label}에 조금만 신경 쓰면 70점대도 금방이에요.`,
      `${overall}점이면 기본기는 탄탄해요. ${w.label} 케어를 루틴에 넣어볼까요?`,
      `${w.label}가 조금 아쉬워요. 여기만 집중하면 확 달라질 거예요.`,
      `오늘은 ${w.label} 관련 제품 하나만 신경 써보세요. 작은 변화가 큰 차이를 만들어요.`,
      `${seasonContext} 피부에 영향을 주는 시기예요. 평소보다 보습을 한 겹 더 챙기세요.`,
    ]);
  }
  return pick([
    `종합 ${overall}점, 피부가 좀 지쳐 있어요. ${w.label}(${v}점)부터 같이 챙겨봐요.`,
    `${w.label}(${v}점)이 낮아요. 기본 루틴부터 차근차근 세워봐요.`,
    `피부 장벽이 약해진 상태예요(${overall}점). 자극은 피하고, 보습이랑 진정 위주로 가세요.`,
    `지금은 무리하지 말고, 세안-보습-차단 이 세 가지만 확실히 해보세요.`,
    `피부가 도움을 요청하고 있어요. ${w.label}부터 하나씩 잡아봐요.`,
    `${overall}점이면 회복이 필요한 시기예요. 자극적인 건 잠시 쉬고, 순한 제품으로 가세요.`,
    `힘든 시기지만 관리하면 분명 올라가요. ${w.label}부터 시작해볼까요?`,
    `지금은 빼기보다 더하기예요. 수분, 진정, 보호에 집중하세요.`,
  ]);
}

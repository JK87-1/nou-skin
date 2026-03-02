/**
 * 오늘의 피부 이야기 — AI 인사이트 카드 (홈 탭 하단)
 * 최근 분석 결과 기반 맞춤 조언
 */
import { getLatestRecord, getChanges } from '../storage/SkinStorage';

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export default function AiInsightCard() {
  const latest = getLatestRecord();
  const changes = getChanges();

  if (!latest) return null;

  let insight = '';
  let icon = '💡';
  let sub = '';

  const month = new Date().getMonth() + 1;
  const season = month <= 2 || month === 12 ? 'winter' : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'fall';

  if (changes) {
    const improved = Object.values(changes).filter(c => c.improved && Math.abs(c.diff) >= 2);
    const worsened = Object.values(changes).filter(c => !c.improved && Math.abs(c.diff) >= 3 && c.key !== 'overallScore');

    if (improved.length >= 3) {
      icon = '🌟';
      const names = improved.slice(0, 3).map(c => c.label).join(', ');
      insight = pick([
        `${names} 등 ${improved.length}개 지표가 동시에 올라가고 있어요!`,
        `${improved.length}개 지표가 개선 중이에요. 현재 루틴이 피부에 잘 맞고 있다는 신호예요.`,
        `좋은 흐름이에요! ${names}이 함께 올라가면서 피부 컨디션이 전반적으로 좋아지고 있어요.`,
      ]);
      sub = '지금 루틴을 꾸준히 유지하세요.';
    } else if (worsened.length > 0) {
      const worst = worsened.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
      icon = worst.icon || '🔍';
      const diffAbs = Math.abs(worst.diff);
      insight = pick([
        `${worst.label}이 ${diffAbs}점 하락했어요. ${worst.label === '수분도' ? '실내 건조 환경이 원인일 수 있어요.' : '최근 생활 패턴이나 스킨케어를 점검해보세요.'}`,
        `${worst.label}에 변화가 감지됐어요(${worst.diff > 0 ? '+' : ''}${worst.diff}). 이번 주 집중 케어가 필요한 부분이에요.`,
        `${worst.label} 점수가 이전보다 ${diffAbs}점 떨어졌어요. 원인을 파악하고 집중 관리해보세요.`,
      ]);
      if (improved.length > 0) {
        sub = `반면 ${improved[0].label}은 ${Math.abs(improved[0].diff)}점 올라갔어요!`;
      }
    } else {
      // 변화 있지만 큰 변동 없음
      insight = generateMetricInsight(latest, season);
      icon = getMetricIcon(latest);
    }
  } else {
    // 변화 데이터 없음 (첫 측정)
    insight = generateMetricInsight(latest, season);
    icon = getMetricIcon(latest);
    const concerns = latest.concerns || [];
    if (concerns.length > 0) {
      sub = `가장 주의할 부분: ${concerns[0]}`;
    } else {
      sub = '다음 주에 다시 측정하면 변화를 비교할 수 있어요.';
    }
  }

  return (
    <div className="card" style={{ padding: '16px 12px' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e8', letterSpacing: -0.3, marginBottom: 12 }}>Today's Insight</div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#e0e0e8', lineHeight: 1.7 }}>
            {insight}
          </div>
          {sub && (
            <div style={{ fontSize: 12, color: '#a5b4fc', marginTop: 6, fontWeight: 500 }}>
              {sub}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#8888a0', marginTop: 8 }}>
            LUA 피부 분석 · {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  );
}

function getMetricIcon(latest) {
  const weakest = getWeakestMetric(latest);
  const iconMap = {
    moisture: '💧', skinTone: '✨', wrinkleScore: '📐', poreScore: '🔬',
    elasticityScore: '💎', pigmentationScore: '🎨', textureScore: '🧴',
    darkCircleScore: '👁️', oilBalance: '🫧',
  };
  return iconMap[weakest.key] || '💡';
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
      `종합 ${overall}점으로 피부 컨디션이 좋아요! ${w.label}(${v}점)만 조금 더 신경 쓰면 완벽해요.`,
      `전반적으로 건강한 피부예요(${overall}점). ${w.label}을 한 단계 올리면 더 좋아질 거예요.`,
      `피부가 잘 관리되고 있어요. ${seasonContext} 피부에 영향을 줄 수 있으니 보습에 신경 쓰세요.`,
    ]);
  }
  if (overall >= 55) {
    return pick([
      `종합 ${overall}점이에요. ${w.label}(${v}점)이 가장 아쉬운 부분인데, 맞춤 케어로 충분히 개선할 수 있어요.`,
      `${w.label}(${v}점)이 전체 점수를 끌어내리고 있어요. 이 부분을 집중 관리하면 종합 점수가 빠르게 올라갈 거예요.`,
      `피부 컨디션이 보통 수준(${overall}점)이에요. ${seasonContext} 피부 장벽에 부담을 줄 수 있으니 주의하세요.`,
    ]);
  }
  return pick([
    `종합 ${overall}점으로 피부가 지쳐 있어요. ${w.label}(${v}점)부터 집중 관리가 필요해요.`,
    `${w.label}(${v}점)이 특히 낮아요. 기본 루틴(세안→수분→보습→차단)부터 차근차근 세워보세요.`,
    `피부 장벽이 약해진 상태(${overall}점)예요. 자극적인 성분은 피하고, 보습과 진정 위주로 케어하세요.`,
  ]);
}

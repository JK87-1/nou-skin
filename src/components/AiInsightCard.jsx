/**
 * 오늘의 피부 이야기 — AI 인사이트 카드 (홈 탭 하단)
 * 최근 분석 결과 기반 핵심 조언 한 마디
 */
import { getLatestRecord, getChanges } from '../storage/SkinStorage';

export default function AiInsightCard() {
  const latest = getLatestRecord();
  const changes = getChanges();

  if (!latest) return null;

  // 핵심 조언 생성
  let insight = '';
  let icon = '💡';

  if (changes) {
    const improved = Object.values(changes).filter(c => c.improved && Math.abs(c.diff) >= 2);
    const worsened = Object.values(changes).filter(c => !c.improved && Math.abs(c.diff) >= 3 && c.key !== 'overallScore');

    if (improved.length >= 3) {
      icon = '🌟';
      insight = `${improved.length}개 지표가 개선되고 있어요. 지금 루틴을 유지하세요!`;
    } else if (worsened.length > 0) {
      const worst = worsened.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
      icon = '🔍';
      insight = `${worst.icon} ${worst.label}에 변화가 감지됐어요. 이번 주 집중 케어해보세요.`;
    } else if (latest.moisture < 50) {
      icon = '💧';
      insight = '수분도가 낮은 편이에요. 히알루론산 세럼으로 보습을 강화해보세요.';
    } else if (latest.wrinkleScore < 50) {
      icon = '✨';
      insight = '주름 관리에 신경 써보세요. 레티놀은 저녁 루틴에 추가하면 효과적이에요.';
    } else {
      icon = '🌿';
      insight = '피부 상태가 안정적이에요. 꾸준한 관리가 최고의 비결!';
    }
  } else {
    // 변화 데이터 없음 (첫 측정)
    const concerns = latest.concerns || [];
    if (concerns.length > 0) {
      icon = '🎯';
      insight = `현재 가장 주의할 부분은 "${concerns[0]}"이에요. 맞춤 루틴을 확인해보세요.`;
    } else {
      icon = '🌸';
      insight = '첫 측정이 완료됐어요! 다음 주에 다시 측정하면 변화를 비교할 수 있어요.';
    }
  }

  return (
    <div className="card" style={{ padding: '16px 12px' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#5a4a40', letterSpacing: -0.3, marginBottom: 12 }}>Today's Insight</div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#5a4a40', lineHeight: 1.7 }}>
            {insight}
          </div>
          <div style={{ fontSize: 10, color: '#c4b0a0', marginTop: 8 }}>
            NOU AI 코치 · {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  );
}

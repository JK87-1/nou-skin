/**
 * 홈화면 인사이트카드 — 백업용 컴포넌트
 *
 * 원래 App.jsx 홈 화면에 고정 인사이트 카드로 표시되던 영역.
 * 현재 홈 화면에서는 비활성화 상태이며, 추후 재사용 시 복원 가능.
 *
 * 사용법:
 * - App.jsx에서 아래 조건으로 렌더:
 *   {homeCards.insight && showTabBar && activeTab === 'home' && stage === 'landing' && getLatestRecord() && !insightCollapsed && (
 *     <HomeInsightCard ... />
 *   )}
 */

import AiInsightCard from './AiInsightCard';
import { getProfile } from '../storage/ProfileStorage';
import { getRecords } from '../storage/SkinStorage';

export default function HomeInsightCard({ onOpenChat, insightCollapsed, setInsightCollapsed }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(var(--tab-bar-h, 64px) + 10px)',
      left: 20, right: 20,
      zIndex: 90,
      animation: 'insightFloat 3s ease-in-out infinite',
    }}>
      {/* 접기 버튼 */}
      <div onClick={(e) => { e.stopPropagation(); setInsightCollapsed(true); }} style={{
        position: 'absolute', top: 6, right: 6, zIndex: 2,
        width: 40, height: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #8C8C8C)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <AiInsightCard
        onOpenChat={onOpenChat}
        onCollapse={() => setInsightCollapsed(true)}
        greeting={(() => { const h = new Date().getHours(); if (h >= 5 && h < 11) return '좋은 아침이에요'; if (h >= 11 && h < 17) return '오늘도 잘 지내고 있나요'; if (h >= 17 && h < 22) return '오늘 하루도 수고했어요'; return '조용한 시간이에요'; })() + (getProfile().nickname ? `, ${getProfile().nickname}` : '')}
        dateInfo={`${new Date().getMonth() + 1}월 ${new Date().getDate()}일 · ${(() => { const recs = getRecords(); if (!recs.length) return '오늘부터 시작'; const d = Math.floor((Date.now() - new Date(recs[recs.length - 1].date).getTime()) / 86400000); return d > 0 ? `LUA와 ${d}일째` : '오늘부터 시작'; })()}`}
      />
    </div>
  );
}

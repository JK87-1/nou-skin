import { IconBook, IconChevronLeft, IconDroplet, IconCoffee, IconApple, IconMoon, IconMoodSmile } from '@tabler/icons-react';
import { GUIDE_DATA } from '../data/GuideContent';
import { calculateWaterGoal } from '../utils/waterCalculator';
import { hapticLight } from '../utils/haptic';

const CATEGORY_ICONS = {
  water: IconDroplet,
  caffeine: IconCoffee,
  meal: IconApple,
  sleep: IconMoon,
  condition: IconMoodSmile,
};

/* ── 인트로 메시지의 **볼드** 파싱 ── */
function IntroText({ text }) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <p style={{ fontSize: 12, color: '#185FA5', lineHeight: 1.6, margin: 0 }}>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <span key={i} style={{ color: '#042C53', fontWeight: 500 }}>{part}</span>
          : <span key={i}>{part}</span>
      )}
    </p>
  );
}

/* ── 컨디션 7일 평균 계산 ── */
function getConditionAvg7() {
  try {
    const checks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
    if (checks.length === 0) return null;
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const recent = checks.filter(c => {
      const d = new Date(c.date || c.timestamp);
      return d >= weekAgo && d <= now;
    });
    if (recent.length === 0) return null;
    const avg = recent.reduce((s, c) => s + (c.energy || 5), 0) / recent.length;
    return avg.toFixed(1);
  } catch { return null; }
}

function getSummary(category, data) {
  if (category === 'water') {
    let waterGoal;
    try {
      const body = JSON.parse(localStorage.getItem('lua_body_profile') || '{}');
      const records = JSON.parse(localStorage.getItem('lua_body_records') || '[]');
      const weight = body.weight || (records.length > 0 ? records[records.length - 1].weight : 0);
      waterGoal = calculateWaterGoal(weight, body.activityLevel || 'moderate');
    } catch { waterGoal = calculateWaterGoal(0); }
    const nickname = (() => { try { return JSON.parse(localStorage.getItem('nou_profile') || '{}').nickname || ''; } catch { return ''; } })();
    return { label: nickname ? `${nickname}님 권장량` : '권장량', mainValue: waterGoal.display, subInfo: waterGoal.subDisplay };
  }
  if (category === 'condition') {
    const avg = getConditionAvg7() || '-';
    return { label: '지난 7일 평균', mainValue: `${avg} / 10`, subInfo: '' };
  }
  return data.summary || null;
}

/**
 * 모달 내부에 삽입되는 가이드 콘텐츠 뷰
 * 모달의 기존 콘텐츠를 대체하여 표시
 */
export function GuideView({ category, onBack }) {
  const data = GUIDE_DATA[category];
  if (!data) return null;
  const Icon = CATEGORY_ICONS[category];
  const summary = getSummary(category, data);

  return (
    <div style={{ animation: 'guideSlideIn 0.2s ease' }}>
      {/* 헤더: 뒤로가기 + 타이틀 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <div onClick={onBack} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: -12 }}>
          <IconChevronLeft size={20} color="var(--text-muted, #999)" stroke={1.5} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <Icon size={18} color={data.color} stroke={1.5} />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#042C53', letterSpacing: -0.2 }}>{data.title}</span>
        </div>
      </div>

      {/* 인트로 */}
      <div style={{ marginBottom: 24 }}>
        <IntroText text={data.intro} />
      </div>

      {/* 5가지 원칙 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {data.principles.map((p) => (
          <div key={p.number} style={{ display: 'flex', gap: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#534AB7', minWidth: 20, paddingTop: 1 }}>{p.number}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: '#042C53', fontWeight: 600, lineHeight: 1.4, marginBottom: 4 }}>{p.title}</div>
              <div style={{ fontSize: 12, color: '#185FA5', lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 요약 정보 */}
      {summary && (
        <div style={{ background: '#F0F7FE', borderRadius: 12, padding: '14px 16px', marginTop: 28 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary, #999)', marginBottom: 6 }}>{summary.label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 600, color: '#042C53' }}>{summary.mainValue}</span>
            {summary.subInfo && <span style={{ fontSize: 12, color: '#185FA5' }}>{summary.subInfo}</span>}
          </div>
        </div>
      )}

      <style>{`
        @keyframes guideSlideIn {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* ── 팝업 모달 (DiscoveryPage 등에서 사용) ── */
export default function GuidePopup({ category, isOpen, onClose }) {
  if (!isOpen || !category) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
        maxHeight: '85dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <GuideView category={category} onBack={onClose} />
      </div>
    </div>
  );
}

/* ── guide 버튼 ── */
export function GuideButton({ category, onClick }) {
  const data = GUIDE_DATA[category];
  if (!data) return null;

  return (
    <div
      data-guide-btn="true"
      onClick={(e) => {
        e.stopPropagation();
        e.nativeEvent?.stopImmediatePropagation?.();
        hapticLight();
        onClick?.();
      }}
      onTouchEnd={(e) => { e.stopPropagation(); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '2px 6px', background: data.btnBg, borderRadius: 7,
        cursor: 'pointer', transition: 'background 0.2s ease',
        position: 'relative', zIndex: 2,
      }}
      onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.style.background = data.btnBg.replace('0.08', '0.12'); }}
      onPointerUp={(e) => { e.currentTarget.style.background = data.btnBg; }}
      onPointerLeave={(e) => { e.currentTarget.style.background = data.btnBg; }}
    >
      <IconBook size={8} color={data.btnColor} stroke={1.5} />
      <span style={{ fontSize: 8, color: data.btnColor, fontWeight: 500, letterSpacing: 0.2, lineHeight: 1 }}>guide</span>
    </div>
  );
}

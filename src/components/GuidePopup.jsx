import { useEffect, useRef } from 'react';
import { IconBook, IconX, IconDroplet, IconCoffee, IconApple, IconMoon, IconMoodSmile } from '@tabler/icons-react';
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
function IntroText({ text, color }) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <p style={{ fontSize: 11, color: '#185FA5', lineHeight: 1.6, margin: 0 }}>
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

/* ── 메인 컴포넌트 ── */
export default function GuidePopup({ category, isOpen, onClose }) {
  const popupRef = useRef(null);
  const data = GUIDE_DATA[category];
  if (!data) return null;

  const Icon = CATEGORY_ICONS[category];

  // 수분 권장량 계산
  const waterGoal = (() => {
    if (category !== 'water') return null;
    try {
      const body = JSON.parse(localStorage.getItem('lua_body_profile') || '{}');
      const records = JSON.parse(localStorage.getItem('lua_body_records') || '[]');
      const weight = body.weight || (records.length > 0 ? records[records.length - 1].weight : 0);
      return calculateWaterGoal(weight, body.activityLevel || 'moderate');
    } catch { return calculateWaterGoal(0); }
  })();

  // 컨디션 평균
  const condAvg = category === 'condition' ? getConditionAvg7() : null;

  // 닉네임
  const nickname = (() => {
    try { return JSON.parse(localStorage.getItem('nou_profile') || '{}').nickname || ''; }
    catch { return ''; }
  })();

  // 요약 정보 결정
  const summary = (() => {
    if (category === 'water' && waterGoal) {
      return { label: nickname ? `${nickname}님 권장량` : '권장량', mainValue: waterGoal.display, subInfo: waterGoal.subDisplay };
    }
    if (category === 'condition') {
      const avg = condAvg || '-';
      return { label: '지난 7일 평균', mainValue: `${avg} / 10`, subInfo: '' };
    }
    return data.summary || null;
  })();

  useEffect(() => {
    if (!isOpen) return;
    const handleBack = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleBack);
    return () => window.removeEventListener('keydown', handleBack);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(4, 44, 83, 0.3)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 28px',
        animation: 'guideOverlayIn 0.2s ease',
      }}
    >
      <div
        ref={popupRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 340, background: 'white', borderRadius: 16,
          padding: '22px 20px', boxShadow: '0 4px 16px rgba(4, 44, 83, 0.08)',
          animation: 'guidePopupIn 0.2s ease',
          maxHeight: '80vh', overflowY: 'auto',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon size={16} color={data.color} stroke={1.5} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#042C53', letterSpacing: -0.2 }}>{data.title}</span>
          </div>
          <div
            onClick={onClose}
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: -12 }}
          >
            <IconX size={16} color="var(--color-text-secondary, #999)" stroke={1.5} />
          </div>
        </div>

        {/* 인트로 */}
        <div style={{ marginBottom: 16 }}>
          <IntroText text={data.intro} />
        </div>

        {/* 5가지 원칙 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.principles.map((p) => (
            <div key={p.number} style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: '#534AB7', minWidth: 16, paddingTop: 1 }}>{p.number}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#042C53', fontWeight: 500, lineHeight: 1.4, marginBottom: 3 }}>{p.title}</div>
                <div style={{ fontSize: 10, color: '#185FA5', lineHeight: 1.5 }}>{p.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 요약 정보 */}
        {summary && (
          <div style={{
            background: '#F0F7FE', borderRadius: 10, padding: 12, marginTop: 18,
          }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary, #999)', marginBottom: 4 }}>{summary.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 500, color: '#042C53' }}>{summary.mainValue}</span>
              {summary.subInfo && <span style={{ fontSize: 10, color: '#185FA5' }}>{summary.subInfo}</span>}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes guideOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes guidePopupIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ── guide 버튼 (카드 위에 배치) ── */
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
        if (navigator.vibrate) navigator.vibrate(8);
        onClick?.();
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
      }}
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

import { useState, useEffect } from 'react';
import {
  isPushSupported, isIOS, isStandalone, getPermissionState,
  subscribeToPush, saveSubscriptionToServer,
} from '../utils/pushNotification';
import {
  trackPushPermissionGranted, trackPushPermissionDenied,
} from '../analytics/amplitude';
import { getProfile } from '../storage/ProfileStorage';

const PROMPT_FLAG = 'lua_push_prompt_v1';

/**
 * 매일 9시·21시 푸시 알림 권한 요청 모달.
 * - source: 'onboarding' | 'first_record' | 'mypage' (Amplitude property)
 * - iOS 비 standalone이면 "홈 화면 추가" 안내로 콘텐츠 swap
 * - 닫히면 localStorage 플래그를 세팅해 재노출 가드 (mypage source는 가드 안 함)
 */
export default function PushPermissionPrompt({ source = 'onboarding', onClose }) {
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState(false);
  const iosNeedsStandalone = isIOS() && !isStandalone();
  const unsupported = !isPushSupported() && !iosNeedsStandalone;

  useEffect(() => {
    // 백드롭 mount 시 body scroll 잠금
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  function markPromptShown() {
    if (source !== 'mypage') {
      try { localStorage.setItem(PROMPT_FLAG, '1'); } catch {}
    }
  }

  function handleClose() {
    setClosing(true);
    setTimeout(() => { markPromptShown(); onClose && onClose(); }, 200);
  }

  async function handleEnable() {
    if (busy) return;
    setBusy(true);
    try {
      const sub = await subscribeToPush();
      if (!sub) {
        trackPushPermissionDenied(source);
        markPromptShown();
        setBusy(false);
        setClosing(true);
        setTimeout(() => onClose && onClose(), 200);
        return;
      }
      const prof = (() => { try { return getProfile() || {}; } catch { return {}; } })();
      await saveSubscriptionToServer(sub, {
        morningEnabled: true,
        morningTime: '09:00',
        eveningEnabled: true,
        eveningTime: '21:00',
        nickname: prof.nickname || '',
      });
      trackPushPermissionGranted(source);
      markPromptShown();
      setBusy(false);
      setClosing(true);
      setTimeout(() => onClose && onClose(), 200);
    } catch (e) {
      console.warn('[push] enable failed', e);
      trackPushPermissionDenied(source);
      markPromptShown();
      setBusy(false);
      setClosing(true);
      setTimeout(() => onClose && onClose(), 200);
    }
  }

  function handleLater() {
    trackPushPermissionDenied(source);
    handleClose();
  }

  if (unsupported) {
    // 지원 안 하는 브라우저 — 모달 자체를 안 띄움. 부모는 source/permission 체크로 사전 가드해야 함.
    return null;
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: closing ? 'pushPromptFadeOut 0.2s ease-in forwards' : 'pushPromptFadeIn 0.25s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, margin: '0 12px 12px',
          background: 'var(--bg-modal, rgba(20,20,28,0.92))',
          backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
          border: '1px solid rgba(240,144,112,0.22)',
          borderRadius: 22, padding: '22px 22px 18px',
          color: 'var(--text-primary, #fff)',
          animation: closing ? 'pushSheetDown 0.2s ease-in forwards' : 'pushSheetUp 0.32s cubic-bezier(.18,.9,.32,1.18)',
          position: 'relative',
        }}
      >
        <button
          onClick={handleClose}
          aria-label="닫기"
          style={{
            position: 'absolute', top: 12, right: 14,
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1,
          }}
        >&times;</button>

        {iosNeedsStandalone ? (
          <IosAddToHomeContent />
        ) : (
          <DefaultPermissionContent
            busy={busy}
            onEnable={handleEnable}
            onLater={handleLater}
          />
        )}
      </div>

      <style>{`
        @keyframes pushPromptFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pushPromptFadeOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes pushSheetUp { from { transform: translateY(40px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes pushSheetDown { from { transform: translateY(0); opacity: 1 } to { transform: translateY(40px); opacity: 0 } }
      `}</style>
    </div>
  );
}

function DefaultPermissionContent({ busy, onEnable, onLater }) {
  return (
    <>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(255,140,66,0.28), rgba(137,206,245,0.18))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FF8C42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary, #fff)' }}>
        매일의 변화를 놓치지 않도록
      </h3>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-secondary, #c8c8d4)', margin: '0 0 18px' }}>
        아침 9시와 저녁 9시에 짧은 알림을 보내드려요.
        30초만 기록해도 피부 패턴이 또렷이 보이기 시작해요.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onLater}
          disabled={busy}
          style={{
            flex: 1, padding: '12px 0', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent',
            color: 'var(--text-secondary, #c8c8d4)',
            fontSize: 14, fontWeight: 500, cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >나중에</button>
        <button
          onClick={onEnable}
          disabled={busy}
          style={{
            flex: 1.4, padding: '12px 0', borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(135deg, #FF8C42, #f7b27a)',
            color: '#1b1207',
            fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit',
            opacity: busy ? 0.7 : 1,
          }}
        >{busy ? '설정 중…' : '알림 켜기'}</button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-dim, #6b6b78)', textAlign: 'center', margin: '12px 0 0' }}>
        언제든 마이 &gt; 알림에서 끌 수 있어요
      </p>
    </>
  );
}

function IosAddToHomeContent() {
  return (
    <>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(137,206,245,0.22), rgba(255,140,66,0.18))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14,
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#89cef5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary, #fff)' }}>
        알림을 받으려면 홈 화면에 추가해주세요
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary, #c8c8d4)', margin: '0 0 14px' }}>
        Safari에서는 홈 화면에 추가된 앱에서만 알림을 받을 수 있어요.
        하단 공유 버튼 &rarr; "홈 화면에 추가"를 눌러주세요.
      </p>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: 'var(--bg-card, rgba(255,255,255,0.04))', borderRadius: 14, padding: '12px 16px',
        marginBottom: 14,
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, margin: '0 auto 6px',
            background: 'rgba(137,206,245,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aed8f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary, #c8c8d4)', margin: 0, lineHeight: 1.3 }}>
            하단 <span style={{ fontWeight: 600, color: '#aed8f7' }}>공유</span> 탭
          </p>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim, #6b6b78)" strokeWidth="2" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, margin: '0 auto 6px',
            background: 'rgba(137,206,245,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aed8f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-secondary, #c8c8d4)', margin: 0, lineHeight: 1.3 }}>
            <span style={{ fontWeight: 600, color: '#aed8f7' }}>홈 화면에 추가</span>
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * 부모 컴포넌트에서 prompt를 띄울지 결정하는 헬퍼.
 * - 푸시 지원 안 함: false
 * - 이미 권한이 granted거나 denied: false (denied는 OS 설정으로만 변경 가능)
 * - localStorage 플래그 set 됨: false
 * - default 상태면 true
 */
export function shouldShowPushPrompt() {
  if (!isPushSupported()) return false;
  try {
    if (localStorage.getItem(PROMPT_FLAG)) return false;
  } catch { return false; }
  const perm = getPermissionState();
  if (perm === 'granted' || perm === 'denied') return false;
  return true;
}

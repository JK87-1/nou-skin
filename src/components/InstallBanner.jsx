import { useState, useEffect, useRef } from 'react';

const DISMISS_KEY = 'lua_install_dismissed';
const DISMISS_DAYS = 14;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isIOSSafari() {
  if (!isIOS()) return false;
  const ua = navigator.userAgent;
  // Non-Safari iOS browsers have their own identifiers
  if (/CriOS|Chrome/i.test(ua)) return false;   // Chrome
  if (/FxiOS/i.test(ua)) return false;           // Firefox
  if (/OPiOS/i.test(ua)) return false;           // Opera
  if (/Whale/i.test(ua)) return false;            // Naver Whale
  if (/NAVER/i.test(ua)) return false;            // Naver App
  if (/EdgiOS/i.test(ua)) return false;           // Edge
  if (/DaumApps|KAKAOTALK/i.test(ua)) return false; // Kakao
  if (/Line\//i.test(ua)) return false;           // LINE
  // Instagram/Facebook in-app browser
  if (/FBAN|FBAV|Instagram/i.test(ua)) return false;
  return /Safari/i.test(ua);
}

export default function InstallBanner() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState(null); // 'ios' | 'android' | 'ios-nonsafari'
  const [closing, setClosing] = useState(false);
  const deferredPrompt = useRef(null);

  useEffect(() => {
    if (isStandalone()) return;

    // Check dismissal
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      if (Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
    }

    // Android / Chrome: beforeinstallprompt
    const handlePrompt = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setPlatform('android');
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);

    // iOS
    if (isIOS() && !window.navigator.standalone) {
      const t = setTimeout(() => {
        if (isIOSSafari()) {
          setPlatform('ios');
        } else {
          setPlatform('ios-nonsafari');
        }
        setVisible(true);
      }, 2000);
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', handlePrompt); };
    }

    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  const dismiss = () => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }, 300);
  };

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        setVisible(false);
      }
      deferredPrompt.current = null;
    }
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 9999,
      background: 'var(--bg-modal)',
      backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
      border: '1px solid rgba(240,144,112,0.2)',
      borderRadius: 20, padding: '16px 18px',
      boxShadow: 'none',
      animation: closing ? 'installSlideDown 0.3s ease-in forwards' : 'installSlideUp 0.4s ease-out',
    }}>
      {/* Close button */}
      <button onClick={dismiss} style={{
        position: 'absolute', top: 10, right: 12,
        background: 'none', border: 'none', color: 'var(--text-muted)',
        fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1,
      }}>&times;</button>

      {platform === 'ios-nonsafari' ? (
        // iOS non-Safari: guide to open in Safari
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(240,144,112,0.2), rgba(240,144,112,0.2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#89cef5', fontFamily: "'Outfit', sans-serif", letterSpacing: 2 }}>루아</span>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>Safari에서 열어주세요</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>홈 화면에 추가하려면 Safari가 필요해요</p>
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            background: 'var(--bg-card)', borderRadius: 14, padding: '12px 16px',
          }}>
            {/* Step 1: Copy URL */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, margin: '0 auto 6px',
                background: 'rgba(240,144,112,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aed8f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3 }}>
                주소창 <span style={{ fontWeight: 700, color: '#aed8f7' }}>URL 복사</span>
              </p>
            </div>

            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>

            {/* Step 2: Open Safari */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, margin: '0 auto 6px',
                background: 'rgba(240,144,112,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aed8f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
                </svg>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3 }}>
                <span style={{ fontWeight: 700, color: '#aed8f7' }}>Safari</span>에서 붙여넣기
              </p>
            </div>
          </div>
          <button onClick={() => {
            navigator.clipboard.writeText(window.location.href).then(() => {
              const btn = document.getElementById('lua-copy-btn');
              if (btn) { btn.textContent = '복사 완료!'; setTimeout(() => { btn.textContent = 'URL 복사하기'; }, 2000); }
            }).catch(() => {});
          }} id="lua-copy-btn" style={{
            width: '100%', marginTop: 10, padding: '10px 0', borderRadius: 12,
            border: '1px solid rgba(240,144,112,0.25)', background: 'rgba(240,144,112,0.1)',
            color: '#a5b4fc', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>URL 복사하기</button>
        </div>
      ) : platform === 'android' ? (
        // Android: one-tap install
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(240,144,112,0.2), rgba(240,144,112,0.2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#89cef5', fontFamily: "'Outfit', sans-serif", letterSpacing: 2 }}>루아</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>홈 화면에 추가</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>앱처럼 빠르게 실행하세요</p>
          </div>
          <button onClick={handleInstall} style={{
            padding: '8px 18px', borderRadius: 'var(--btn-radius)', border: 'none',
            background: 'var(--btn-primary-bg)',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap',
            boxShadow: 'none',
          }}>설치</button>
        </div>
      ) : (
        // iOS Safari: visual guide
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(240,144,112,0.2), rgba(240,144,112,0.2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#89cef5', fontFamily: "'Outfit', sans-serif", letterSpacing: 2 }}>루아</span>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>홈 화면에 추가하기</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>앱처럼 빠르게 실행할 수 있어요</p>
            </div>
          </div>
          {/* Steps */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            background: 'var(--bg-card)', borderRadius: 14, padding: '12px 16px',
          }}>
            {/* Step 1 */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, margin: '0 auto 6px',
                background: 'rgba(240,144,112,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* Share icon (iOS style) */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aed8f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3 }}>
                하단 <span style={{ fontWeight: 700, color: '#aed8f7' }}>공유</span> 탭
              </p>
            </div>

            {/* Arrow */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>

            {/* Step 2 */}
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, margin: '0 auto 6px',
                background: 'rgba(240,144,112,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* Plus square icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aed8f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3 }}>
                <span style={{ fontWeight: 700, color: '#aed8f7' }}>홈 화면에 추가</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

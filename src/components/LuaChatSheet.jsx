import { useState, useRef, useEffect, useCallback } from 'react';
import { getRecords, getSmoothedChanges, getChanges, getLatestRecord, getStableSkinAge } from '../storage/SkinStorage';
import { getProfile } from '../storage/ProfileStorage';
import { compressImage } from '../engine/PixelAnalysis';
import { getProductsWithUsageContext, getRoutineSnapshot } from '../storage/TrackerStorage';

// 단순 마크다운 렌더링 — **볼드**, 줄바꿈, 불릿/번호 리스트, → 화살표 처리
// 외부 라이브러리 없이 가벼움. AI 응답 가독성용.
function renderChatMarkdown(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  return lines.map((line, i) => {
    const key = `mk-${i}`;
    if (line === '') return <div key={key} style={{ height: 8 }} />;

    // 불릿 / 번호 리스트
    const bulletMatch = line.match(/^(\s*)([•·\-*]|\d+[\.)])\s+(.*)$/);
    if (bulletMatch) {
      const [, indent, marker, rest] = bulletMatch;
      const isNum = /\d/.test(marker);
      return (
        <div key={key} style={{
          display: 'flex', gap: 6,
          paddingLeft: 4 + (indent.length * 8),
          margin: '3px 0', lineHeight: 1.7,
        }}>
          <span style={{ color: 'var(--accent-primary, #5BA8D6)', fontWeight: isNum ? 700 : 500, minWidth: isNum ? 18 : 8, flexShrink: 0 }}>
            {isNum ? marker : '•'}
          </span>
          <span style={{ flex: 1 }}>{renderInline(rest)}</span>
        </div>
      );
    }

    return (
      <div key={key} style={{ margin: '2px 0', lineHeight: 1.7 }}>
        {renderInline(line)}
      </div>
    );
  });
}

function renderInline(line) {
  // **bold** 처리
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, j) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={j} style={{ fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>{p.slice(2, -2)}</strong>
      : <span key={j}>{p}</span>
  );
}

function getGreetingMsg() {
  return '안녕하세요, 당신의 피부 상담사 루아에요. 궁금한 점이 있으면 편하게 물어보세요!';
}

function formatTime(ts) {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h < 12 ? '오전' : '오후'} ${h === 0 ? 12 : h > 12 ? h - 12 : h}:${m}`;
}

// Star icon SVG (same as FAB — glassmorphism + depth)
function StarIcon({ size = 14 }) {
  const id = `chat-star-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 1px 2px rgba(100,180,230,0.5))' }}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0.15" y1="0.05" x2="0.85" y2="0.95">
          <stop offset="0%" stopColor="#D6EEFB" />
          <stop offset="45%" stopColor="#a8d8f5" />
          <stop offset="100%" stopColor="#6bb8e8" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#c8e8fa" />
          <stop offset="100%" stopColor="#5aaad8" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id}-edge)`} stroke="rgba(90,170,216,0.3)" strokeWidth="0.6" d="M10.48,23.25c-.15.41-.5.71-.86.75-.27.03-.78-.29-.9-.59l-1.53-4.02c-.48-1.26-1.41-2.1-2.67-2.58l-3.91-1.48c-.29-.11-.59-.51-.6-.76-.01-.39.23-.79.6-.93l3.9-1.49c1.27-.48,2.19-1.31,2.68-2.59l1.57-4.14c.08-.2.52-.44.74-.46.24-.02.77.21.86.46l1.57,4.14c.5,1.32,1.47,2.15,2.78,2.63l3.7,1.37c.31.11.66.55.67.83.02.42-.29.82-.68.97l-3.8,1.44c-1.26.48-2.2,1.32-2.67,2.58l-1.45,3.86Z"/>
      <g transform="translate(0.3,0.3) scale(0.975)">
        <path fill={`url(#${id}-fill)`} d="M10.48,23.25c-.15.41-.5.71-.86.75-.27.03-.78-.29-.9-.59l-1.53-4.02c-.48-1.26-1.41-2.1-2.67-2.58l-3.91-1.48c-.29-.11-.59-.51-.6-.76-.01-.39.23-.79.6-.93l3.9-1.49c1.27-.48,2.19-1.31,2.68-2.59l1.57-4.14c.08-.2.52-.44.74-.46.24-.02.77.21.86.46l1.57,4.14c.5,1.32,1.47,2.15,2.78,2.63l3.7,1.37c.31.11.66.55.67.83.02.42-.29.82-.68.97l-3.8,1.44c-1.26.48-2.2,1.32-2.67,2.58l-1.45,3.86Z"/>
      </g>
      <path fill={`url(#${id}-edge)`} stroke="rgba(90,170,216,0.3)" strokeWidth="0.4" d="M21.48,6.29c-1.03.59-.9,2.91-2.01,2.98-1.23.08-.99-1.68-1.94-2.78-.77-.88-2.68-.63-2.74-1.78-.07-1.27,2.01-1.1,2.74-1.91.87-.95.73-2.72,1.78-2.8,1.29-.1.98,1.81,1.95,2.77.87.86,2.67.71,2.73,1.8.07,1.08-1.29,1.02-2.51,1.72Z"/>
      <g transform="translate(0.15,0.15) scale(0.988)">
        <path fill={`url(#${id}-fill)`} d="M21.48,6.29c-1.03.59-.9,2.91-2.01,2.98-1.23.08-.99-1.68-1.94-2.78-.77-.88-2.68-.63-2.74-1.78-.07-1.27,2.01-1.1,2.74-1.91.87-.95.73-2.72,1.78-2.8,1.29-.1.98,1.81,1.95,2.77.87.86,2.67.71,2.73,1.8.07,1.08-1.29,1.02-2.51,1.72Z"/>
      </g>
    </svg>
  );
}

// Glass style tokens
const glass = {
  background: 'rgba(255,255,255,0.35)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
};

export default function LuaChatSheet({ open, onClose, initialContext }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pendingImages, setPendingImages] = useState([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const sheetRef = useRef(null);
  const cameraInputRef = useRef(null);
  const albumInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const dragStartY = useRef(null);
  const dragDelta = useRef(0);
  const MAX_IMAGES = 3;

  useEffect(() => {
    if (open) {
      setClosing(false);
      const greeting = initialContext?.message || getGreetingMsg();
      setMessages([{ role: 'assistant', content: greeting, timestamp: Date.now() }]);
      // Match status bar to scrim
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) { meta._prev = meta.content; meta.content = '#85b5cc'; }
    } else {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && meta._prev) { meta.content = meta._prev; delete meta._prev; }
    }
  }, [open, initialContext]);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => scrollRef.current.scrollTop = scrollRef.current.scrollHeight, 50);
    }
  }, [messages, isLoading]);

  // STT init
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    setSttSupported(true);
    return () => { try { recognition.abort(); } catch {} };
  }, []);

  // Close attach menu on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = () => setShowAttachMenu(false);
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [showAttachMenu]);

  // iOS Safari 키보드 푸시 방지: visualViewport 높이를 sheet에 직접 적용
  // 키보드 올라올 때 sheet가 함께 위로 밀려 헤더가 화면 밖으로 잘리는 문제 해결
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const applyHeight = () => {
      if (sheetRef.current) {
        sheetRef.current.style.height = `${vv.height}px`;
      }
    };
    applyHeight();
    vv.addEventListener('resize', applyHeight);
    vv.addEventListener('scroll', applyHeight);
    return () => {
      vv.removeEventListener('resize', applyHeight);
      vv.removeEventListener('scroll', applyHeight);
    };
  }, []);

  const toggleListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening) { recognition.stop(); }
    else { try { recognition.start(); setIsListening(true); } catch {} }
  }, [isListening]);

  const processFile = useCallback((file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        const compressed = await compressImage(dataUrl, 1024, 0.85);
        const base64 = compressed.split(',')[1];
        resolve({ dataUrl, base64 });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    e.target.value = '';
    setShowAttachMenu(false);
    const results = await Promise.all(files.slice(0, MAX_IMAGES).map(processFile));
    const valid = results.filter(Boolean);
    if (valid.length > 0) { setPendingImages(prev => [...prev, ...valid].slice(0, MAX_IMAGES)); }
  }, [processFile]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => { onClose(); setMessages([]); setInput(''); setClosing(false); }, 240);
  }, [onClose]);

  const buildContext = useCallback(() => {
    const records = getRecords();
    const recentHistory = records.slice(-5).map(r => ({
      date: r.date, overallScore: r.overallScore, skinAge: r.skinAge,
      moisture: r.moisture, wrinkleScore: r.wrinkleScore, elasticityScore: r.elasticityScore,
    }));
    const changes = getSmoothedChanges() || getChanges();
    const profile = getProfile();
    const latest = getLatestRecord();
    return {
      currentResult: latest || null, history: recentHistory, changes,
      stableSkinAge: getStableSkinAge(),
      profile: { birthYear: profile.birthYear, gender: profile.gender, skinType: profile.skinType },
      products: getProductsWithUsageContext(),
      routineSnapshot: getRoutineSnapshot(),
    };
  }, []);

  const sendMessage = useCallback(async (text) => {
    const msgText = (text || '').trim();
    const imgs = pendingImages.length > 0 ? pendingImages : null;
    if (!msgText && !imgs) return;
    if (isLoading) return;

    const defaultMsg = imgs && imgs.length > 1 ? '이 화장품들을 비교 분석해주세요.' : imgs ? '이 화장품 내 피부에 맞는지 분석해주세요.' : '';
    const userMsg = {
      role: 'user', content: msgText || defaultMsg, timestamp: Date.now(),
      imageThumbs: imgs ? imgs.map(img => img.dataUrl) : null,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImages([]);
    setIsLoading(true);

    const conversationHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));
    try {
      const body = { message: userMsg.content, context: buildContext(), conversationHistory };
      if (imgs && imgs.length === 1) body.image = imgs[0].base64;
      else if (imgs && imgs.length > 1) body.images = imgs.map(img => img.base64);

      const response = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `HTTP ${response.status}`); }
      const data = await response.json();
      const replyText = (data?.reply || '').trim();
      if (!replyText) {
        // 빈 응답(토큰 초과·OpenAI 응답 없음 등) → 명시적 fallback 메시지
        setMessages(prev => [...prev, {
          role: 'assistant', timestamp: Date.now(),
          content: '답변이 길어서 잠시 끊겼어요. 같은 질문 한 번만 더 보내주시면 정리해서 답변드릴게요.',
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: replyText, timestamp: Date.now() }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant', timestamp: Date.now(),
        content: err.message?.includes('429') ? '오늘 상담 횟수를 초과했어요. 내일 다시 이용해주세요!' : '잠시 문제가 생겼어요. 다시 시도해주세요.',
      }]);
    } finally { setIsLoading(false); }
  }, [messages, isLoading, buildContext, pendingImages]);

  const canSend = (input.trim() || pendingImages.length > 0) && !isLoading;
  const handleSubmit = useCallback(() => { sendMessage(input); }, [input, sendMessage]);

  const onTouchStart = (e) => { dragStartY.current = e.touches[0].clientY; };
  const onTouchMove = (e) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) { dragDelta.current = delta; if (sheetRef.current) sheetRef.current.style.transform = `translateY(${delta}px)`; }
  };
  const onTouchEnd = () => {
    if (dragDelta.current > 120) { handleClose(); }
    else if (sheetRef.current) { sheetRef.current.style.transform = 'translateY(0)'; sheetRef.current.style.transition = 'transform 0.2s ease'; setTimeout(() => { if (sheetRef.current) sheetRef.current.style.transition = ''; }, 200); }
    dragStartY.current = null; dragDelta.current = 0;
  };

  const shouldShowTime = (msgs, idx) => {
    if (idx === msgs.length - 1) return true;
    if (msgs[idx].role !== msgs[idx + 1].role) return true;
    if (msgs[idx + 1].timestamp - msgs[idx].timestamp > 300000) return true;
    return false;
  };
  const isConsecutive = (msgs, idx) => idx > 0 && msgs[idx].role === msgs[idx - 1].role;

  if (!open) return null;

  // lua avatar (glass circle + star icon, same as FAB)
  const luaAvatar = (size) => (
    <div style={{
      width: size, height: size, minWidth: size, minHeight: size,
      borderRadius: '50%', flexShrink: 0,
      background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.8), rgba(172,226,252,0.35))',
      border: 'none',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.4), 0 2px 6px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      aspectRatio: '1 / 1', boxSizing: 'border-box',
    }}>
      <StarIcon size={size * 0.55} />
    </div>
  );

  return (
    <>
      {/* Hidden file inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} style={{ display: 'none' }} />
      <input ref={albumInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />

      {/* Scrim */}
      <div onClick={handleClose} style={{
        position: 'fixed', top: 'calc(-1 * env(safe-area-inset-top, 50px))', left: 0, right: 0, bottom: 0, zIndex: 200,
        background: 'rgba(4,44,83,0.12)',
        backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        opacity: closing ? 0 : 1, transition: 'opacity 200ms',
      }} />

      {/* Sheet — 풀스크린 (채팅 중 시야 최대). iOS 키보드 푸시 방지를 위해 100dvh 사용 */}
      <div ref={sheetRef} style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 201,
        height: '100vh', // fallback for older iOS
        background: '#ffffff',
        borderRadius: 0,
        boxShadow: 'none',
        display: 'flex', flexDirection: 'column',
        animation: closing ? 'luaChatSlideDown 240ms ease forwards' : 'luaChatSlideUp 280ms cubic-bezier(0.32,0.72,0,1) forwards',
        maxWidth: 430, margin: '0 auto',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
      // 키보드 영역 제외한 동적 viewport 사용 (iOS 15.4+ / Android Chrome)
      // CSS-in-JS로 100dvh 지원 (older iOS는 100vh fallback)
      data-fullscreen-dynamic>
        <style>{`
          @keyframes luaChatSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes luaChatSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
          @keyframes luaDot { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
        `}</style>

        {/* Header — 풀스크린 채팅 헤더 (좌측 lua 정보 + 우측 X 닫기) */}
        <div style={{
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          background: 'rgba(255,255,255,0.95)',
        }}>
          {luaAvatar(36)}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, #191F28)' }}>lua</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#89cef5' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted, #8B95A1)' }}>늘 곁에 있어요</span>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="채팅 닫기"
            style={{
              width: 36, height: 36, borderRadius: 18,
              background: 'rgba(0,0,0,0.04)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary, #191F28)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: '14px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
          WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted, #8B95A1)', textAlign: 'center', margin: '4px 0' }}>오늘</div>

          {messages.map((msg, i) => {
            const isLua = msg.role === 'assistant';
            const consecutive = isConsecutive(messages, i);
            const showTime = shouldShowTime(messages, i);

            return (
              <div key={i}>
                {isLua ? (
                  <div>
                    {!consecutive && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {luaAvatar(28)}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>lua</span>
                      </div>
                    )}
                    <div style={{ marginLeft: 36 }}>
                      <div style={{
                        ...glass,
                        background: 'rgba(255,255,255,0.5)',
                        padding: '12px 16px',
                        borderRadius: consecutive ? 22 : '4px 22px 22px 22px',
                        maxWidth: 'calc(85vw - 40px)',
                        fontSize: 14, color: 'var(--text-primary, #191F28)', lineHeight: 1.65,
                      }}>{renderChatMarkdown(msg.content)}</div>
                      {showTime && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted, #8B95A1)', marginTop: 3, marginLeft: 4 }}>
                          {formatTime(msg.timestamp)}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {msg.imageThumbs && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 4 }}>
                        {msg.imageThumbs.map((src, ti) => (
                          <img key={ti} src={src} alt="" style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover' }} />
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{
                        background: 'rgba(137,206,245,0.5)',
                        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid rgba(137,206,245,0.3)',
                        padding: '12px 16px',
                        borderRadius: consecutive ? 22 : '22px 4px 22px 22px',
                        maxWidth: '85%',
                        fontSize: 14, color: 'var(--text-primary, #191F28)', lineHeight: 1.65,
                        whiteSpace: 'pre-wrap',
                      }}>{msg.content}</div>
                    </div>
                    {showTime && (
                      <div style={{ fontSize: 9, color: 'var(--text-muted, #8B95A1)', marginTop: 3, textAlign: 'right' }}>
                        {formatTime(msg.timestamp)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator */}
          {isLoading && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {luaAvatar(28)}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #191F28)' }}>lua</span>
              </div>
              <div style={{
                marginLeft: 36,
                ...glass, background: 'rgba(255,255,255,0.5)',
                padding: '10px 14px', borderRadius: '22px 22px 22px 4px',
                display: 'flex', gap: 5,
              }}>
                {[0, 1, 2].map(j => (
                  <div key={j} style={{
                    width: 5, height: 5, borderRadius: '50%', background: '#89cef5',
                    animation: `luaDot 1.2s ease-in-out ${j * 0.24}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Image Preview */}
        {pendingImages.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
            flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.3)',
          }}>
            {pendingImages.map((img, idx) => (
              <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
                <img src={img.dataUrl} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.3)' }} />
                <button onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))} style={{
                  position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: '50%',
                  border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
            {pendingImages.length < MAX_IMAGES && (
              <button onClick={() => albumInputRef.current?.click()} style={{
                width: 72, height: 72, borderRadius: 12,
                border: '2px dashed rgba(137,206,245,0.4)', background: 'rgba(137,206,245,0.08)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', gap: 2, flexShrink: 0,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#89cef5" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <span style={{ fontSize: 10, color: '#89cef5', fontWeight: 600 }}>추가</span>
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted, #8B95A1)', width: '100%' }}>
              {`사진 ${pendingImages.length}/${MAX_IMAGES}장`}
              {pendingImages.length >= 2 && ' · 비교 분석 가능'}
            </span>
          </div>
        )}

        {/* Composer */}
        <div style={{
          padding: '8px 14px calc(16px + env(safe-area-inset-bottom, 0px))',
          borderTop: 'none',
          background: 'transparent',
          position: 'relative',
        }}>
          {/* Attach Menu */}
          {showAttachMenu && (
            <div onClick={(e) => e.stopPropagation()} style={{
              position: 'absolute', bottom: '100%', left: 14, marginBottom: 8,
              ...glass, background: 'rgba(255,255,255,0.85)',
              borderRadius: 22, overflow: 'hidden', zIndex: 10,
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            }}>
              <button onClick={() => { cameraInputRef.current?.click(); setShowAttachMenu(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
                border: 'none', background: 'none', width: '100%', fontSize: 14, fontWeight: 500,
                color: 'var(--text-primary, #191F28)', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#89cef5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
                카메라로 촬영
              </button>
              <button onClick={() => { albumInputRef.current?.click(); setShowAttachMenu(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
                border: 'none', background: 'none', width: '100%', fontSize: 14, fontWeight: 500,
                color: 'var(--text-primary, #191F28)', cursor: 'pointer', fontFamily: 'inherit',
                borderTop: '1px solid rgba(255,255,255,0.3)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#89cef5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                앨범에서 선택
              </button>
            </div>
          )}

          <div style={{
            display: 'flex', gap: 8, alignItems: 'center', width: '100%',
            background: 'rgba(255,255,255,0.35)', borderRadius: 28,
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '6px 6px 6px 12px', boxSizing: 'border-box',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
          }}>
            {/* + Attach Button */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowAttachMenu(!showAttachMenu); }}
              disabled={isLoading}
              style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none',
                background: 'rgba(137,206,245,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#89cef5" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>

            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSubmit(); } }}
              placeholder={isListening ? '듣고 있어요...' : pendingImages.length > 0 ? '메시지와 함께 전송...' : '피부 고민을 물어보세요...'}
              disabled={isLoading}
              style={{
                flex: 1, minWidth: 0, padding: '10px 4px', borderRadius: 0,
                border: 'none', background: 'transparent',
                fontSize: 14, color: '#333',
                fontFamily: 'inherit', outline: 'none',
              }}
            />

            {/* Mic Button */}
            {sttSupported && (
              <button
                onClick={toggleListening}
                disabled={isLoading}
                style={{
                  width: 40, height: 40, borderRadius: '50%', border: 'none',
                  background: isListening ? 'rgba(137,206,245,0.3)' : 'rgba(137,206,245,0.12)',
                  boxShadow: isListening ? '0 0 0 4px rgba(137,206,245,0.15)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                  opacity: isLoading ? 0.5 : 1, transition: 'background 0.15s, box-shadow 0.15s',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#89cef5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="1" width="6" height="11" rx="3"/><path d="M19 10v1a7 7 0 01-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
            )}

            {/* Send Button */}
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              style={{
                width: 44, height: 44, borderRadius: '50%', border: 'none',
                background: canSend ? '#89cef5' : 'rgba(137,206,245,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: canSend ? 'pointer' : 'default',
                flexShrink: 0, transition: 'background 0.2s',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke={canSend ? '#fff' : 'var(--text-dim, #B0B8C1)'}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

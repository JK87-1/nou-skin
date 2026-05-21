import { useState, useRef, useEffect, useCallback } from 'react';
import { getRecords, getSmoothedChanges, getChanges, getLatestRecord, getStableSkinAge, getRecentTrend } from '../storage/SkinStorage';
import { getProfile } from '../storage/ProfileStorage';
import { compressImage } from '../engine/PixelAnalysis';
import { getProductsWithUsageContext, getRoutineSnapshot, getProducts } from '../storage/TrackerStorage';
import { buildRoutineRecommendation, serializeRoutineForPrompt, detectInteractions, serializeInteractionsForPrompt } from '../utils/routineBuilder';
import { getMemoryContext, recordUserMessage } from '../storage/UserMemoryStorage';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { getActivePersonaId, setActivePersonaId } from '../storage/PersonaStorage';
import { getPersonaById, PERSONAS } from '../data/PersonaCatalog';
import PersonaPicker from './PersonaPicker';

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
    <svg width={size} height={size} viewBox="0 0 642.82 626.11" style={{ filter: 'drop-shadow(0 1px 2px rgba(100,180,230,0.5))' }}>
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
      <path fill={`url(#${id}-edge)`} stroke="rgba(90,170,216,0.3)" strokeWidth="16" d="M283.39,624.22c-13.36,4.42-27.68.92-38.02-8.6-9.11-8.38-15.79-18.59-19.6-30.36l-11.25-34.71c-5.84-18.02-11.19-35.37-19.86-52.19-18.55-35.99-49.68-62.09-88.22-74.84l-45.43-12.53c-20.65-5.69-45.02-14.73-55.55-33.29-8-14.1-7.19-30.1,2.36-43.17,15.69-21.46,45.08-28.92,69.82-36.01l33.43-9.58c23.08-6.61,43.51-19.41,60.62-36.34l6.6-7.54c14.35-16.41,23.14-36.5,29.38-57.47l9.51-37.53c5.57-21.99,16.02-46.39,38.05-53.68,13.7-4.53,27.46-1.11,38.03,8.53,25.63,23.39,23.97,67.31,40.45,103.36,7.76,16.97,17.54,32.27,31.25,44.71,26.31,23.86,47.15,29.48,77.44,40.68l34.98,12.94c9.87,3.65,18.18,10.09,24.64,18.27,12.32,15.61,12.46,36.51-.08,52.12-8.57,10.67-20.09,17.86-32.88,22.95l-39.33,15.63c-31.62,12.57-58.51,33.68-76.08,63.01-8.47,14.15-14.81,29.08-18.72,45.21l-8.59,35.37c-6.3,25.94-16.47,56.3-42.95,65.05Z"/>
      <g transform="translate(8,8) scale(0.975)">
        <path fill={`url(#${id}-fill)`} d="M283.39,624.22c-13.36,4.42-27.68.92-38.02-8.6-9.11-8.38-15.79-18.59-19.6-30.36l-11.25-34.71c-5.84-18.02-11.19-35.37-19.86-52.19-18.55-35.99-49.68-62.09-88.22-74.84l-45.43-12.53c-20.65-5.69-45.02-14.73-55.55-33.29-8-14.1-7.19-30.1,2.36-43.17,15.69-21.46,45.08-28.92,69.82-36.01l33.43-9.58c23.08-6.61,43.51-19.41,60.62-36.34l6.6-7.54c14.35-16.41,23.14-36.5,29.38-57.47l9.51-37.53c5.57-21.99,16.02-46.39,38.05-53.68,13.7-4.53,27.46-1.11,38.03,8.53,25.63,23.39,23.97,67.31,40.45,103.36,7.76,16.97,17.54,32.27,31.25,44.71,26.31,23.86,47.15,29.48,77.44,40.68l34.98,12.94c9.87,3.65,18.18,10.09,24.64,18.27,12.32,15.61,12.46,36.51-.08,52.12-8.57,10.67-20.09,17.86-32.88,22.95l-39.33,15.63c-31.62,12.57-58.51,33.68-76.08,63.01-8.47,14.15-14.81,29.08-18.72,45.21l-8.59,35.37c-6.3,25.94-16.47,56.3-42.95,65.05Z"/>
      </g>
      <path fill={`url(#${id}-edge)`} stroke="rgba(90,170,216,0.3)" strokeWidth="10" d="M566.24,189.1c-5.51,17.06-12.16,36.33-32.49,34.81-7.19-.54-13.8-4.68-18.36-11.36-9.25-13.54-10.94-33.95-26.05-51.79-18.62-21.99-39.93-22.15-53.83-33-5.85-4.57-9.56-10.02-9.84-16.78-.29-6.71,2.52-12.91,7.73-17.86,11.76-11.16,34.28-13.3,50.87-29.99,18.41-18.52,19.4-40.08,30.52-53.45,7.88-9.48,21.11-12.94,31.78-6.11,14.26,9.13,16.25,29.81,26.68,46.23,9.89,15.56,25.11,25.51,42.3,31.79,7.15,2.61,13.57,5.63,19.28,10.64,7.73,6.79,10.69,18.67,5.07,27.55-4.96,7.84-12.96,12.22-21.47,15.47-28.52,10.89-42.75,24.6-52.2,53.84Z"/>
      <g transform="translate(4,4) scale(0.988)">
        <path fill={`url(#${id}-fill)`} d="M566.24,189.1c-5.51,17.06-12.16,36.33-32.49,34.81-7.19-.54-13.8-4.68-18.36-11.36-9.25-13.54-10.94-33.95-26.05-51.79-18.62-21.99-39.93-22.15-53.83-33-5.85-4.57-9.56-10.02-9.84-16.78-.29-6.71,2.52-12.91,7.73-17.86,11.76-11.16,34.28-13.3,50.87-29.99,18.41-18.52,19.4-40.08,30.52-53.45,7.88-9.48,21.11-12.94,31.78-6.11,14.26,9.13,16.25,29.81,26.68,46.23,9.89,15.56,25.11,25.51,42.3,31.79,7.15,2.61,13.57,5.63,19.28,10.64,7.73,6.79,10.69,18.67,5.07,27.55-4.96,7.84-12.96,12.22-21.47,15.47-28.52,10.89-42.75,24.6-52.2,53.84Z"/>
      </g>
    </svg>
  );
}

// Glass style tokens
const glass = {
  background: '#ffffff',
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
  border: '1px solid rgba(255,255,255,0.3)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
};

// ===== Gemini 스타일 마크다운 — 평문 친화적, heading bold, 단락 여백 =====
function renderInline(text) {
  // **bold** 처리. 안전한 split 기반.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return <strong key={i} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

function renderChatMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const blocks = [];
  let para = [];
  let bullets = [];
  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push({ type: 'p', text: para.join(' ') });
    para = [];
  };
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push({ type: 'ul', items: bullets });
    bullets = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') { flushPara(); flushBullets(); blocks.push({ type: 'gap' }); continue; }
    if (line.startsWith('### ')) { flushPara(); flushBullets(); blocks.push({ type: 'h3', text: line.slice(4) }); continue; }
    if (line.startsWith('## '))  { flushPara(); flushBullets(); blocks.push({ type: 'h2', text: line.slice(3) }); continue; }
    if (line.startsWith('# '))   { flushPara(); flushBullets(); blocks.push({ type: 'h2', text: line.slice(2) }); continue; }
    if (/^[-•]\s+/.test(line))   { flushPara(); bullets.push(line.replace(/^[-•]\s+/, '')); continue; }
    flushBullets();
    para.push(line);
  }
  flushPara(); flushBullets();

  // gap 연속은 한 번만
  const compact = [];
  for (const b of blocks) {
    if (b.type === 'gap' && compact[compact.length - 1]?.type === 'gap') continue;
    compact.push(b);
  }

  return compact.map((b, i) => {
    if (b.type === 'gap') return <div key={i} style={{ height: 10 }} />;
    if (b.type === 'h2') return <div key={i} style={{ fontSize: 17, fontWeight: 700, color: '#1F1F1F', marginTop: i === 0 ? 0 : 14, marginBottom: 6, letterSpacing: -0.2 }}>{renderInline(b.text)}</div>;
    if (b.type === 'h3') return <div key={i} style={{ fontSize: 15, fontWeight: 700, color: '#1F1F1F', marginTop: i === 0 ? 0 : 10, marginBottom: 4, letterSpacing: -0.1 }}>{renderInline(b.text)}</div>;
    if (b.type === 'ul') return (
      <ul key={i} style={{ margin: '4px 0 4px 0', paddingLeft: 18, color: '#1F1F1F' }}>
        {b.items.map((it, j) => (
          <li key={j} style={{ marginBottom: 2, lineHeight: 1.6 }}>{renderInline(it)}</li>
        ))}
      </ul>
    );
    // p
    return <div key={i} style={{ marginBottom: 0, color: '#1F1F1F', lineHeight: 1.65 }}>{renderInline(b.text)}</div>;
  });
}

export default function LuaChatSheet({ open, onClose, initialContext }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pendingImages, setPendingImages] = useState([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [personaId, setPersonaId] = useState(() => getActivePersonaId());
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const persona = getPersonaById(personaId);
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
      // Gemini 스타일: 자동 인사 없이 빈 상태로 시작. initialContext.message가 있을 때만 prefill.
      if (initialContext?.message) {
        setMessages([{ role: 'assistant', content: initialContext.message, timestamp: Date.now() }]);
      } else {
        setMessages([]);
      }
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

  // iOS Keyboard sticky — Capacitor 이벤트로 정확한 키보드 높이 추적
  // dvh가 작동하지 않는 환경에 대비한 명시적 fallback. native iOS에서만 활성화.
  useEffect(() => {
    if (typeof Capacitor === 'undefined' || !Capacitor.isNativePlatform?.()) return;
    let showSub = null, hideSub = null;
    let cancelled = false;
    (async () => {
      try {
        showSub = await Keyboard.addListener('keyboardWillShow', info => {
          if (!cancelled) setKeyboardHeight(info?.keyboardHeight || 0);
        });
        hideSub = await Keyboard.addListener('keyboardWillHide', () => {
          if (!cancelled) setKeyboardHeight(0);
        });
      } catch {}
    })();
    return () => {
      cancelled = true;
      try { showSub?.remove?.(); } catch {}
      try { hideSub?.remove?.(); } catch {}
    };
  }, []);

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
      profile: { nickname: profile.nickname, birthYear: profile.birthYear, gender: profile.gender, skinType: profile.skinType },
      products: getProductsWithUsageContext(),
      routineSnapshot: getRoutineSnapshot(),
      recentTrend: getRecentTrend(7),
      longTrend: getRecentTrend(30),
      userMemory: getMemoryContext(),
      routineRecommendation: serializeRoutineForPrompt(buildRoutineRecommendation(latest, getProducts())),
      productInteractions: serializeInteractionsForPrompt(detectInteractions(getProducts())),
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
    recordUserMessage(userMsg.content);
    setInput('');
    setPendingImages([]);
    setIsLoading(true);

    const conversationHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));
    try {
      const body = { message: userMsg.content, context: buildContext(), conversationHistory, stream: true, persona: personaId };
      if (imgs && imgs.length === 1) body.image = imgs[0].base64;
      else if (imgs && imgs.length > 1) body.images = imgs.map(img => img.base64);

      const response = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || `HTTP ${response.status}`); }

      // SSE 스트리밍 읽기 — 첫 토큰 도착 시점에 빈 assistant bubble 추가, 이후 delta 누적.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';
      let bubbleAdded = false;
      let streamError = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data: ')) continue;
          const payload = t.slice(6);
          if (payload === '[DONE]') continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.error) { streamError = evt.error; continue; }
            if (evt.delta) {
              assistantText += evt.delta;
              if (!bubbleAdded) {
                bubbleAdded = true;
                setMessages(prev => [...prev, { role: 'assistant', content: assistantText, timestamp: Date.now() }]);
              } else {
                setMessages(prev => {
                  const next = [...prev];
                  next[next.length - 1] = { ...next[next.length - 1], content: assistantText };
                  return next;
                });
              }
            }
          } catch {}
        }
      }

      if (streamError) throw new Error(streamError);
      if (!bubbleAdded) {
        setMessages(prev => [...prev, { role: 'assistant', content: '잠시 문제가 생겼어요. 다시 시도해주세요.', timestamp: Date.now() }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant', timestamp: Date.now(),
        content: err.message?.includes('429') ? '오늘 상담 횟수를 초과했어요. 내일 다시 이용해주세요!' : '잠시 문제가 생겼어요. 다시 시도해주세요.',
      }]);
    } finally { setIsLoading(false); }
  }, [messages, isLoading, buildContext, pendingImages, personaId]);

  // 페르소나 변경 — 새 채팅 시작 + localStorage 저장 + 환영 메시지
  const handleSelectPersona = useCallback((id) => {
    if (!id || id === personaId) {
      setPersonaPickerOpen(false);
      return;
    }
    setActivePersonaId(id);
    setPersonaId(id);
    setPersonaPickerOpen(false);
    const p = getPersonaById(id);
    setMessages([{ role: 'assistant', content: p.welcomeMessage, timestamp: Date.now() }]);
    setInput('');
    setPendingImages([]);
  }, [personaId]);

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
        backdropFilter: 'none', WebkitBackdropFilter: 'none',
        opacity: closing ? 0 : 1, transition: 'opacity 200ms',
      }} />

      {/* Sheet — Gemini Flash 스타일 (거의 풀스크린 + 그라데이션)
          height: Capacitor 키보드 이벤트 우선, fallback으로 dvh.
          composer는 flex column 마지막이라 sheet가 줄어들면 자동으로 키보드 위에 sticky. */}
      <div ref={sheetRef} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        height: keyboardHeight > 0
          ? `calc(100% - ${keyboardHeight}px)`
          : 'min(95dvh, 100%)',
        transition: 'height 0.22s cubic-bezier(0.32,0.72,0,1)',
        background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 45%, #EAF4FB 100%)',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -6px 24px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column',
        animation: closing ? 'luaChatSlideDown 240ms ease forwards' : 'luaChatSlideUp 280ms cubic-bezier(0.32,0.72,0,1) forwards',
        maxWidth: 430, margin: '0 auto',
      }}>
        <style>{`
          @keyframes luaChatSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes luaChatSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
          @keyframes luaDot { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
          .gem-btn { transition: transform 0.12s ease, opacity 0.12s ease; -webkit-tap-highlight-color: transparent; }
          .gem-btn:active { transform: scale(0.92); opacity: 0.75; }
          .gem-input-btn { transition: transform 0.12s ease, opacity 0.12s ease, background 0.12s ease; -webkit-tap-highlight-color: transparent; }
          .gem-input-btn:active { transform: scale(0.9); opacity: 0.7; }
          .gem-act { background: transparent; border: none; cursor: pointer; padding: 6px; border-radius: 10px; transition: background 0.15s, transform 0.12s; -webkit-tap-highlight-color: transparent; display: inline-flex; align-items: center; justify-content: center; }
          .gem-act:active { transform: scale(0.92); background: rgba(0,0,0,0.06); }
        `}</style>

        {/* Persona Picker — chevron 클릭 시 헤더 아래 슬라이드 다운 */}
        <PersonaPicker
          open={personaPickerOpen}
          activeId={personaId}
          onSelect={handleSelectPersona}
          onClose={() => setPersonaPickerOpen(false)}
          anchorTop={72}
        />

        {/* Handle (드래그 닫기) */}
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
          style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px', cursor: 'grab' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ececec' }} />
        </div>

        {/* Gemini Flash Style Header — X(좌) · lua●(중앙) · 새 채팅(우) */}
        <div style={{
          padding: '8px 16px 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button onClick={handleClose} aria-label="채팅 닫기" className="gem-btn" style={{
            width: 44, height: 44, borderRadius: 22,
            background: '#ffffff',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <button
            onClick={() => setPersonaPickerOpen(v => !v)}
            aria-label="모델 선택"
            className="gem-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 8px', borderRadius: 12,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <span style={{
              fontSize: 22, fontWeight: 500, color: '#1F1F1F',
              letterSpacing: -0.3, lineHeight: 1,
              fontFamily: 'var(--font-display), Pretendard, -apple-system, sans-serif',
            }}>lua</span>
            <span style={{
              fontSize: 15, fontWeight: 400, color: '#5F6368',
              letterSpacing: -0.2, lineHeight: 1, marginLeft: 2,
            }}>{persona.short}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, transition: 'transform 0.18s', transform: personaPickerOpen ? 'rotate(180deg)' : 'none' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          <button onClick={() => { setMessages([]); setInput(''); setPendingImages([]); }} aria-label="새 채팅" className="gem-btn" style={{
            width: 44, height: 44, borderRadius: 22,
            background: '#ffffff',
            border: '1.5px dashed rgba(0,0,0,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#191F28" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
        </div>

        {/* Messages or Empty State (Gemini Flash 스타일) */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: 'auto', padding: '18px 18px 8px',
          display: 'flex', flexDirection: 'column', gap: 6,
          WebkitOverflowScrolling: 'touch',
        }}>
          {messages.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '32px 24px 80px',
              gap: 20,
            }}>
              {/* Gemini Flash 스타일 큰 4-point 별 (lua 푸른 그라데이션) */}
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
                <defs>
                  <linearGradient id="luaStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#89cef5" />
                    <stop offset="55%" stopColor="#58aefe" />
                    <stop offset="100%" stopColor="#cce8fb" />
                  </linearGradient>
                </defs>
                <path
                  d="M28 2 C29 14 30 17 32 19 C34 22 37 23 54 28 C37 33 34 34 32 37 C30 39 29 42 28 54 C27 42 26 39 24 37 C22 34 19 33 2 28 C19 23 22 22 24 19 C26 17 27 14 28 2 Z"
                  fill="url(#luaStarGrad)"
                />
              </svg>
              <div style={{
                fontSize: 30, fontWeight: 500, color: '#1F1F1F',
                letterSpacing: -0.5, lineHeight: 1.3,
                fontFamily: 'var(--font-display), Pretendard, -apple-system, sans-serif',
                maxWidth: 320,
              }}>
                오늘 피부는 어떤가요?
              </div>
            </div>
          ) : (
          <>
          {/* "오늘" 표시 제거 — Gemini와 동일하게 깔끔 */}

          {messages.map((msg, i) => {
            const isLua = msg.role === 'assistant';
            const isLast = i === messages.length - 1;

            if (isLua) {
              // Gemini 스타일: 버블 없음. 평문 마크다운만. 답변 아래 액션 row.
              return (
                <div key={i} style={{ padding: '10px 2px 4px', fontSize: 16 }}>
                  {renderChatMarkdown(msg.content)}
                  {!isLoading || !isLast ? (
                    <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 14, paddingTop: 2 }}>
                      <button className="gem-act" aria-label="좋아요" onClick={() => {}}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7l-3-3v-9a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>
                      </button>
                      <button className="gem-act" aria-label="별로예요" onClick={() => {}}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17l3 3v9a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>
                      </button>
                      <button className="gem-act" aria-label="다시 답변" onClick={() => {
                        // 마지막 user message로 재요청
                        const lastUser = [...messages].reverse().find(m => m.role === 'user');
                        if (lastUser) {
                          setMessages(prev => prev.slice(0, -1));
                          sendMessage(lastUser.content);
                        }
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                      </button>
                      <button className="gem-act" aria-label="복사" onClick={() => {
                        try { navigator.clipboard?.writeText(msg.content); } catch {}
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            }
            // User message — 옅은 회색 캡슐, 오른쪽 정렬
            return (
              <div key={i} style={{ padding: '6px 0' }}>
                {msg.imageThumbs && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 6 }}>
                    {msg.imageThumbs.map((src, ti) => (
                      <img key={ti} src={src} alt="" style={{ width: 88, height: 88, borderRadius: 14, objectFit: 'cover' }} />
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    background: '#F1F3F4',
                    padding: '11px 18px',
                    borderRadius: 20,
                    maxWidth: '82%',
                    fontSize: 16, color: '#1F1F1F', lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    letterSpacing: -0.1,
                  }}>{msg.content}</div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator — 평문 위치에 점 3개만 (버블 없음) */}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 2px', height: 24 }}>
              {[0, 1, 2].map(j => (
                <div key={j} style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#89cef5',
                  animation: `luaDot 1.2s ease-in-out ${j * 0.24}s infinite`,
                }} />
              ))}
            </div>
          )}
          </>
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
              ...glass, background: '#ffffff',
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
            display: 'flex', gap: 6, alignItems: 'center', width: '100%',
            background: '#ffffff', borderRadius: 32,
            border: '1px solid rgba(0,0,0,0.06)',
            padding: '6px 8px', boxSizing: 'border-box',
            boxShadow: '0 2px 14px rgba(0,0,0,0.06)',
          }}>
            {/* + Attach Button — Gemini와 동일하게 평면 큰 + 아이콘 */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowAttachMenu(!showAttachMenu); }}
              disabled={isLoading}
              className="gem-input-btn"
              style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none',
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>

            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSubmit(); } }}
              placeholder={isListening ? '듣고 있어요...' : pendingImages.length > 0 ? '메시지와 함께 전송...' : 'lua에게 물어보세요'}
              disabled={isLoading}
              style={{
                flex: 1, minWidth: 0, padding: '10px 4px', borderRadius: 0,
                border: 'none', background: 'transparent',
                fontSize: 16, color: '#1F1F1F',
                fontFamily: 'inherit', outline: 'none',
                letterSpacing: -0.1,
              }}
            />

            {/* Mic Button — 평면 회색 아이콘 (Gemini와 동일) */}
            {sttSupported && (
              <button
                onClick={toggleListening}
                disabled={isLoading}
                className="gem-input-btn"
                style={{
                  width: 40, height: 40, borderRadius: '50%', border: 'none',
                  background: isListening ? 'rgba(137,206,245,0.2)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                  opacity: isLoading ? 0.5 : 1, transition: 'background 0.15s',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isListening ? '#89cef5' : '#5F6368'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="2" width="6" height="11" rx="3"/><path d="M19 10v1a7 7 0 01-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
              </button>
            )}

            {/* Send / Sound-wave Button — 텍스트 있으면 send, 없으면 음성 wave chip (Gemini 패턴) */}
            <button
              onClick={canSend ? handleSubmit : toggleListening}
              disabled={isLoading}
              className="gem-input-btn"
              style={{
                width: 40, height: 40, borderRadius: '50%', border: 'none',
                background: canSend ? '#1F1F1F' : 'rgba(137,206,245,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: canSend ? 'pointer' : 'pointer',
                flexShrink: 0, transition: 'background 0.2s',
              }}
            >
              {canSend ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              ) : (
                // Sound-wave 아이콘 (Gemini와 동일)
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5F8FB5" strokeWidth="2" strokeLinecap="round">
                  <line x1="6" y1="9" x2="6" y2="15"/>
                  <line x1="10" y1="6" x2="10" y2="18"/>
                  <line x1="14" y1="8" x2="14" y2="16"/>
                  <line x1="18" y1="10" x2="18" y2="14"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

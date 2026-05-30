import { useState, useRef, useEffect, useCallback } from 'react';
import { getRecords, getSmoothedChanges, getChanges, getTodayRecords, getStableSkinAge, getRecentTrend } from '../storage/SkinStorage';
import { getProfile } from '../storage/ProfileStorage';
import { saveConsultSession, loadConsultSession, clearConsultSession } from '../storage/ConsultStorage';
import { compressImage } from '../engine/PixelAnalysis';
import { incrementStat, addXP, checkAndAwardBadges } from '../storage/BadgeStorage';
import { PRODUCTS, CATEGORY_META, getProductsByCategory, calcMatchScore } from '../data/ProductCatalog';
import { getProducts, getProductsWithUsageContext, getRoutineSnapshot, saveProduct as saveTrackerProduct } from '../storage/TrackerStorage';
import { buildRoutineRecommendation, serializeRoutineForPrompt, detectInteractions, serializeInteractionsForPrompt } from '../utils/routineBuilder';
import { getMemoryContext, recordUserMessage } from '../storage/UserMemoryStorage';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { getActivePersonaId, setActivePersonaId } from '../storage/PersonaStorage';
import { getPersonaById } from '../data/PersonaCatalog';
import PersonaPicker from './PersonaPicker';
import SoftCloverIcon from './icons/SoftCloverIcon';
import { StarIcon } from './icons/PastelIcons';
import { DropletIcon, SparkleIcon, TestTubeIcon, SunIcon, DiamondIcon, PaletteIcon, MicroscopeIcon, LotionIcon } from './icons/PastelIcons';

/** Extract [RECOMMEND:카테고리] tags — only explicit tags from AI, no keyword fallback */
function extractRecommendTags(text) {
  if (!text) return { cleanText: '', categories: [] };

  const categories = [];
  const tagRegex = /\[RECOMMEND:([^\]]+)\]/g;
  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    const cat = match[1].trim();
    if (CATEGORY_META[cat] && !categories.includes(cat)) {
      categories.push(cat);
    }
  }

  let cleanText = text
    .replace(/\s*\[RECOMMEND:[^\]]+\]/g, '')
    .replace(/\s*\[PRODUCT:\d+\]/g, '')
    .trim();

  return { cleanText, categories: categories.slice(0, 2) };
}

/** Extract [APPLY_ROUTINE]{...}[/APPLY_ROUTINE] JSON block — return parsed routine or null. */
const TRACKER_CATEGORY_SET = new Set(['클렌저','토너','에센스','세럼','크림','선크림','마스크팩','기타']);
function extractApplyRoutine(text) {
  if (!text) return { cleanText: text, routine: null };
  const re = /\[APPLY_ROUTINE\]\s*([\s\S]*?)\s*\[\/APPLY_ROUTINE\]/;
  const m = text.match(re);
  if (!m) return { cleanText: text, routine: null };
  let parsed = null;
  try { parsed = JSON.parse(m[1]); } catch { parsed = null; }
  const cleanText = text.replace(re, '').trim();
  if (!parsed || typeof parsed !== 'object') return { cleanText, routine: null };

  const sanitize = (arr) => Array.isArray(arr) ? arr
    .filter(x => x && typeof x === 'object' && typeof x.name === 'string' && x.name.trim())
    .map(x => ({
      name: String(x.name).trim().slice(0, 60),
      brand: typeof x.brand === 'string' ? x.brand.trim().slice(0, 40) : '',
      category: TRACKER_CATEGORY_SET.has(x.category) ? x.category : '기타',
      timeSlot: ['morning','night','both'].includes(x.timeSlot) ? x.timeSlot : 'both',
      ingredients: typeof x.ingredients === 'string' ? x.ingredients.trim().slice(0, 120) : '',
    }))
    .slice(0, 12)
    : [];

  const morning = sanitize(parsed.morning);
  const night = sanitize(parsed.night);
  if (morning.length === 0 && night.length === 0) return { cleanText, routine: null };
  return { cleanText, routine: { morning, night } };
}

/** Score ring SVG — small circular progress */
function MatchScoreRing({ score }) {
  const r = 16, stroke = 3;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(101,152,239,0.12)" strokeWidth={stroke} />
        <circle cx="20" cy="20" r={r} fill="none" stroke="#ADEBB3" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, lineHeight: 1.3, fontWeight: 500, color: '#a5b4fc',
      }}>{score}</div>
    </div>
  );
}

/** Single product item card */
function ProductItem({ product, matchScore, delay = 0 }) {
  return (
    <a href={product.link} target="_blank" rel="noopener noreferrer"
      className="product-item-card"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 14,
        background: 'var(--bg-card)',
        border: 'none',
        textDecoration: 'none', color: 'inherit',
        animation: `slideInRight 0.4s ease-out ${delay}s both`,
        cursor: 'pointer',
        transition: 'background 0.2s, border-color 0.2s',
      }}>
      {/* Product icon placeholder */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.15), rgba(var(--accent-rgb),0.15))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, lineHeight: 1.3, fontWeight: 500,
      }}>
        {product.tags?.[0]?.includes('히알루론') ? <DropletIcon size={18} /> :
         product.tags?.[0]?.includes('비타민') ? '' :
         product.tags?.[0]?.includes('레티놀') ? <SparkleIcon size={18} /> :
         product.tags?.[0]?.includes('나이아신') ? <TestTubeIcon size={18} /> :
         product.tags?.[0]?.includes('자외선') ? <SunIcon size={18} /> :
         product.tags?.[0]?.includes('글루타') ? <DiamondIcon size={18} /> :
         product.tags?.[0]?.includes('마스크') ? <PaletteIcon size={18} /> :
         product.tags?.[0]?.includes('펩타이드') ? <MicroscopeIcon size={18} /> : <LotionIcon size={18} />}
      </div>
      {/* Center: name + tags + volume */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 500, color: 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.brand} {product.name}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {product.tags?.slice(0, 2).map((tag, ti) => (
            <span key={ti} style={{
              fontSize: 10, lineHeight: 1.3, fontWeight: 500, padding: '2px 7px', borderRadius: 8,
              background: 'rgba(var(--accent-rgb),0.15)', color: '#6598ef',
            }}>{tag}</span>
          ))}
          <span style={{ fontSize: 10, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-muted)' }}>{product.volume}</span>
        </div>
      </div>
      {/* Right: match score ring */}
      <MatchScoreRing score={matchScore} />
    </a>
  );
}

/** Product recommendation section for a category */
function ProductRecommendSection({ category, result, delay = 0 }) {
  const meta = CATEGORY_META[category];
  if (!meta) return null;
  const products = getProductsByCategory(category);
  if (products.length === 0) return null;

  const metricValue = result?.[meta.metricKey] ?? 50;
  const isInverse = meta.inverse;

  return (
    <div style={{ margin: '10px 0 6px', animation: `fadeInUp 0.5s ease-out ${delay}s both` }}>
      {/* Category header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderRadius: 20,
        background: 'var(--bg-card)',
        border: 'none',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 18, lineHeight: 1.3, fontWeight: 500 }}>{meta.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 500, color: 'var(--text-secondary)' }}>{meta.label}</div>
          <div style={{ fontSize: 11, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-muted)' }}>{meta.ingredient}</div>
        </div>
      </div>
      {/* Product items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {products.slice(0, 3).map((product, pi) => (
          <ProductItem key={product.id} product={product}
            matchScore={calcMatchScore(metricValue, isInverse)}
            delay={delay + 0.1 + pi * 0.08} />
        ))}
      </div>
    </div>
  );
}

/** Minimal markdown → React: **bold**, \n→<br>, • bullets */
// Gemini 스타일 마크다운 — heading bold, 단락 명확한 간격, 평문 친화
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return <strong key={i} style={{ fontWeight: 600, color: 'inherit' }}>{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const blocks = [];
  let para = [], bullets = [];
  const flushPara = () => { if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = []; } };
  const flushBullets = () => { if (bullets.length) { blocks.push({ type: 'ul', items: bullets }); bullets = []; } };

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

  const compact = [];
  for (const b of blocks) {
    if (b.type === 'gap' && compact[compact.length - 1]?.type === 'gap') continue;
    compact.push(b);
  }

  return compact.map((b, i) => {
    if (b.type === 'gap') return <div key={i} style={{ height: 10 }} />;
    if (b.type === 'h2') return <div key={i} style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 500, marginTop: i === 0 ? 0 : 14, marginBottom: 6, letterSpacing: -0.2 }}>{renderInline(b.text)}</div>;
    if (b.type === 'h3') return <div key={i} style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 500, marginTop: i === 0 ? 0 : 10, marginBottom: 4 }}>{renderInline(b.text)}</div>;
    if (b.type === 'ul') return (
      <ul key={i} style={{ margin: '4px 0', paddingLeft: 18 }}>
        {b.items.map((it, j) => <li key={j} style={{ marginBottom: 2, lineHeight: 1.6 }}>{renderInline(it)}</li>)}
      </ul>
    );
    return <div key={i} style={{ marginBottom: 0, lineHeight: 1.65 }}>{renderInline(b.text)}</div>;
  });
}

function generateWelcomeMessage(result) {
  if (!result) return '안녕하세요, 당신의 피부 상담사 루아에요. 궁금한 점이 있으면 편하게 물어보세요!';

  const overall = result.overallScore;
  // Find weakest metric
  const metrics = [
    { key: 'moisture', label: '수분도', score: result.moisture },
    { key: 'skinTone', label: '피부톤', score: result.skinTone },
    { key: 'wrinkleScore', label: '주름', score: result.wrinkleScore },
    { key: 'poreScore', label: '모공', score: result.poreScore },
    { key: 'elasticityScore', label: '탄력', score: result.elasticityScore },
    { key: 'textureScore', label: '피부결', score: result.textureScore },
    { key: 'pigmentationScore', label: '색소', score: result.pigmentationScore },
    { key: 'darkCircleScore', label: '다크서클', score: result.darkCircleScore },
    { key: 'oilBalance', label: '유분', score: result.oilBalance },
  ];
  const weakest = metrics.reduce((min, m) => m.score < min.score ? m : min, metrics[0]);

  return `안녕하세요, 당신의 피부 상담사 루아에요. 오늘 피부 분석 결과를 봤어요. **종합 ${overall}점**이에요. 가장 신경 쓸 부분은 **${weakest.label}(${weakest.score}점)**이에요. 궁금한 점이 있으면 편하게 물어보세요! 화장품 사진을 보내주시면 성분 적합성도 분석해드려요.`;
}

export default function SkinConsultant({ result, onClose, isTab = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [pendingImages, setPendingImages] = useState([]); // [{ dataUrl, base64 }, ...] max 3
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [personaId, setPersonaId] = useState(() => getActivePersonaId());
  const [personaPickerOpen, setPersonaPickerOpen] = useState(false);
  const persona = getPersonaById(personaId);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const cameraInputRef = useRef(null);
  const albumInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);

  const quickQuestions = [
    '내 피부 최대 약점은?',
    '내 루틴 분석해줘',
    '피부나이 줄이려면?',
    '지금 피부 상태 요약해줘',
    '이 화장품 내 피부에 맞아?',
    '내 피부에 맞는 화장품 추천해줘',
    '맞춤 피부 시술 추천해줘',
  ];

  // Initialize: load saved session. (Gemini Flash 스타일 — 빈 시작, welcome 자동 추가 X)
  useEffect(() => {
    const saved = loadConsultSession();
    if (saved && saved.length > 0) {
      setMessages(saved);
    }
    // welcome message 자동 추가 안 함 → 빈 상태에서 "무엇을 도와드릴까요?" 표시
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Save session whenever messages change (exclude base64 image data to save space)
  useEffect(() => {
    if (messages.length > 0) {
      const toSave = messages.map(m => {
        if (m.imageThumb) {
          return { ...m, image: undefined }; // Keep thumb, drop full base64
        }
        return m;
      });
      saveConsultSession(toSave);
    }
  }, [messages]);

  // Prevent body scroll when consult is active (iOS bounce fix)
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, []);

  // Mobile keyboard handling
  // Capacitor native: Keyboard plugin event (정확). 웹: visualViewport (fallback).
  useEffect(() => {
    // Capacitor native iOS — Keyboard plugin 이벤트로 정밀 제어
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.()) {
      let showSub = null, hideSub = null;
      let cancelled = false;
      (async () => {
        try {
          showSub = await Keyboard.addListener('keyboardWillShow', info => {
            if (cancelled) return;
            const c = containerRef.current;
            const h = info?.keyboardHeight || 0;
            setKeyboardHeight(h);
            setKbOpen(true);
            if (c) {
              c.style.height = isTab
                ? `calc(100dvh - ${h}px - 76px)`
                : `calc(100dvh - ${h}px)`;
              c.style.bottom = 'auto';
            }
            requestAnimationFrame(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); });
          });
          hideSub = await Keyboard.addListener('keyboardWillHide', () => {
            if (cancelled) return;
            const c = containerRef.current;
            setKeyboardHeight(0);
            setKbOpen(false);
            if (c) { c.style.height = ''; c.style.bottom = ''; }
          });
        } catch {}
      })();
      return () => {
        cancelled = true;
        try { showSub?.remove?.(); } catch {}
        try { hideSub?.remove?.(); } catch {}
        const c = containerRef.current;
        if (c) { c.style.height = ''; c.style.bottom = ''; }
      };
    }

    // 웹 환경 — visualViewport API
    const vv = window.visualViewport;
    if (!vv || !containerRef.current) return;

    const onViewportChange = () => {
      const container = containerRef.current;
      if (!container) return;

      const kbHeight = Math.round(window.innerHeight - vv.height);
      const isOpen = kbHeight > 150;

      if (isOpen) {
        container.style.height = `${vv.height}px`;
        container.style.bottom = 'auto';
      } else {
        container.style.height = '';
        container.style.bottom = '';
      }

      setKbOpen(isOpen);
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    };

    vv.addEventListener('resize', onViewportChange);
    vv.addEventListener('scroll', onViewportChange);
    return () => {
      vv.removeEventListener('resize', onViewportChange);
      vv.removeEventListener('scroll', onViewportChange);
      const c = containerRef.current;
      if (c) {
        c.style.height = '';
        c.style.bottom = '';
      }
    };
  }, [isTab]);

  // Close attach menu on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = () => setShowAttachMenu(false);
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [showAttachMenu]);

  // Speech-to-Text — OpenAI gpt-4o-transcribe 기반 (Web Speech API보다 정확, 긴 발화도 안정)
  // MediaRecorder로 녹음 → /api/transcribe → 텍스트
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasMic = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasMR = typeof window.MediaRecorder !== 'undefined';
    setSttSupported(hasMic && hasMR);
    return () => {
      // 컴포넌트 unmount 시 마이크 stream 정리
      try {
        const rec = mediaRecorderRef.current;
        if (rec && rec.state === 'recording') rec.stop();
      } catch {}
      try {
        const stream = audioStreamRef.current;
        if (stream) stream.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  const pickSupportedMime = useCallback(() => {
    const candidates = [
      'audio/mp4',                     // Safari (iOS/macOS)
      'audio/mp4;codecs=mp4a.40.2',
      'audio/webm;codecs=opus',        // Chrome/Edge/Firefox
      'audio/webm',
      'audio/ogg;codecs=opus',
    ];
    if (typeof window === 'undefined' || !window.MediaRecorder) return '';
    for (const c of candidates) {
      try { if (window.MediaRecorder.isTypeSupported(c)) return c; } catch {}
    }
    return '';
  }, []);

  const blobToBase64 = useCallback((blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const idx = String(result).indexOf(',');
      resolve(idx >= 0 ? String(result).slice(idx + 1) : '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  }), []);

  const toggleListening = useCallback(async () => {
    if (isTranscribing) return;

    // 녹음 중 → 정지
    if (isListening) {
      try {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'recording') recorder.stop();
      } catch (e) { console.warn('[voice] stop failed', e); }
      return;
    }

    // 녹음 시작
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = stream;

      const mimeType = pickSupportedMime();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        // 마이크 stream 정리
        try { stream.getTracks().forEach((t) => t.stop()); } catch {}
        audioStreamRef.current = null;
        setIsListening(false);

        if (chunks.length === 0) return;

        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: finalMime });
        if (blob.size < 1000) return; // 너무 짧으면 무시 (잘못 눌림 방지)

        setIsTranscribing(true);
        try {
          const base64 = await blobToBase64(blob);
          const resp = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64, mime: finalMime }),
          });
          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${resp.status}`);
          }
          const data = await resp.json();
          const text = (data.text || '').trim();
          if (text) {
            // 기존 입력에 이어쓰기 (잘못 인식 시 사용자가 수정 가능)
            setInput((prev) => (prev ? `${prev} ${text}` : text));
          }
        } catch (e) {
          console.warn('[voice] transcription failed:', e?.message || e);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.onerror = (e) => {
        console.warn('[voice] recorder error', e);
        setIsListening(false);
      };

      recorder.start();
      setIsListening(true);
    } catch (e) {
      console.warn('[voice] mic access failed:', e?.message || e);
      setIsListening(false);
      audioStreamRef.current = null;
    }
  }, [isListening, isTranscribing, pickSupportedMime, blobToBase64]);

  const buildContext = useCallback(() => {
    const records = getRecords();
    const recentHistory = records.slice(-5).map(r => ({
      date: r.date,
      overallScore: r.overallScore,
      skinAge: r.skinAge,
      moisture: r.moisture,
      wrinkleScore: r.wrinkleScore,
      elasticityScore: r.elasticityScore,
    }));
    const changes = getSmoothedChanges() || getChanges();
    const profile = getProfile();

    const todayRecs = getTodayRecords();
    const stableSkinAge = getStableSkinAge();

    return {
      currentResult: result ? {
        overallScore: result.overallScore,
        skinAge: result.skinAge,
        moisture: result.moisture,
        skinTone: result.skinTone,
        oilBalance: result.oilBalance,
        troubleCount: result.troubleCount,
        wrinkleScore: result.wrinkleScore,
        elasticityScore: result.elasticityScore,
        textureScore: result.textureScore,
        poreScore: result.poreScore,
        pigmentationScore: result.pigmentationScore,
        darkCircleScore: result.darkCircleScore,
        skinType: result.skinType,
        concerns: result.concerns,
      } : null,
      history: recentHistory,
      changes,
      stableSkinAge,
      todayRecords: todayRecs.map(r => ({
        timestamp: r.timestamp,
        overallScore: r.overallScore,
        skinAge: r.skinAge,
        moisture: r.moisture,
        oilBalance: r.oilBalance,
        skinTone: r.skinTone,
        darkCircleScore: r.darkCircleScore,
      })),
      profile: {
        nickname: profile.nickname,
        birthYear: profile.birthYear,
        gender: profile.gender,
        skinType: profile.skinType,
      },
      products: getProductsWithUsageContext(),
      routineSnapshot: getRoutineSnapshot(),
      recentTrend: getRecentTrend(7),
      longTrend: getRecentTrend(30),
      userMemory: getMemoryContext(),
      routineRecommendation: serializeRoutineForPrompt(buildRoutineRecommendation(result, getProducts())),
      productInteractions: serializeInteractionsForPrompt(detectInteractions(getProducts())),
    };
  }, [result]);

  const sendMessage = useCallback(async (text, imagesOverride) => {
    const msgText = (text || '').trim();
    const imgs = imagesOverride || (pendingImages.length > 0 ? pendingImages : null);

    if (!msgText && !imgs && !isLoading) return;
    if (isLoading) return;

    const defaultMsg = imgs && imgs.length > 1
      ? '이 화장품들을 비교 분석해주세요.'
      : imgs ? '이 화장품 내 피부에 맞는지 분석해주세요.' : '';

    const userMsg = {
      role: 'user',
      content: msgText || defaultMsg,
      timestamp: Date.now(),
      imageThumbs: imgs ? imgs.map(img => img.dataUrl) : null,
      // Legacy single-image compat
      imageThumb: imgs?.[0]?.dataUrl || null,
    };
    setMessages(prev => [...prev, userMsg]);
    recordUserMessage(userMsg.content);
    setInput('');
    setPendingImages([]);
    setIsLoading(true);

    // Track consult usage for badges
    incrementStat('consultCount');
    addXP(10, 'AI 상담 이용');
    checkAndAwardBadges();

    // Build conversation history for API (exclude timestamps and images)
    const conversationHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const apiUrl = '/api/consult';
      const body = {
        message: userMsg.content,
        context: buildContext(),
        conversationHistory,
        stream: true,
        persona: personaId,
      };
      if (imgs && imgs.length === 1) {
        body.image = imgs[0].base64;
      } else if (imgs && imgs.length > 1) {
        body.images = imgs.map(img => img.base64);
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      // SSE 스트리밍: 첫 delta에 빈 assistant bubble 추가, 이후 누적 갱신
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
      console.error('Consult API error:', err);
      const errorMsg = {
        role: 'assistant',
        content: err.message?.includes('429')
          ? '오늘 상담 횟수를 초과했어요. 내일 다시 이용해주세요!'
          : '잠시 문제가 생겼어요. 다시 시도해주세요.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, buildContext, pendingImages, personaId]);

  // 페르소나 변경 — 새 채팅 + localStorage 저장 + 환영 메시지
  const handleSelectPersona = useCallback((id) => {
    if (!id || id === personaId) { setPersonaPickerOpen(false); return; }
    setActivePersonaId(id);
    setPersonaId(id);
    setPersonaPickerOpen(false);
    clearConsultSession();
    const p = getPersonaById(id);
    setMessages([{ role: 'assistant', content: p.welcomeMessage, timestamp: Date.now() }]);
    setInput('');
    setPendingImages([]);
  }, [personaId]);

  const MAX_IMAGES = 3;

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

    // Process all selected files (respect MAX_IMAGES limit)
    const results = await Promise.all(files.slice(0, MAX_IMAGES).map(processFile));
    const valid = results.filter(Boolean);
    if (valid.length > 0) {
      setPendingImages(prev => [...prev, ...valid].slice(0, MAX_IMAGES));
    }
  }, [processFile]);

  const handleClose = useCallback(() => {
    if (!onClose) return;
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage(input);
    }
  }, [input, sendMessage]);

  const canSend = (input.trim() || pendingImages.length > 0) && !isLoading;

  return (
    <div
      ref={containerRef}
      className={isTab ? 'consult-tab' : `consult-overlay${isClosing ? ' closing' : ''}`}
    >
      {/* Hidden file inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
        onChange={handleFileSelect} style={{ display: 'none' }} />
      <input ref={albumInputRef} type="file" accept="image/*" multiple
        onChange={handleFileSelect} style={{ display: 'none' }} />

      {/* Gemini Flash 스타일 Header — X(좌) · lua●(중앙) · 새 상담(우) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isTab ? '20px 16px 12px' : '52px 16px 12px',
        background: 'transparent',
        flexShrink: 0,
      }}>
        {!isTab ? (
          <button onClick={handleClose} aria-label="채팅 닫기" className="gem-btn" style={{
            width: 44, height: 44, borderRadius: 12,
            background: '#ffffff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        ) : <div style={{ width: 44 }} />}

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
            fontSize: 24, fontWeight: 500, color: '#1F1F1F',
            letterSpacing: -0.3, lineHeight: 1.3,
            fontFamily: 'var(--font-display), Pretendard, -apple-system, sans-serif',
          }}>lua</span>
          <span style={{
            fontSize: 16, fontWeight: 500, color: '#5F6368',
            letterSpacing: -0.2, lineHeight: 1.3, marginLeft: 2,
          }}>{persona.short}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, transition: 'transform 0.18s', transform: personaPickerOpen ? 'rotate(180deg)' : 'none' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <button onClick={() => {
          clearConsultSession();
          setMessages([]);
          setInput('');
          setPendingImages([]);
        }} aria-label="새 상담" className="gem-btn" style={{
          width: 44, height: 44, borderRadius: 22,
          background: '#ffffff', border: '1.5px dashed rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>
      </div>
      <style>{`
        .gem-btn { transition: transform 0.12s ease, opacity 0.12s ease; -webkit-tap-highlight-color: transparent; }
        .gem-btn:active { transform: scale(0.92); opacity: 0.75; }
        .gem-act { background: transparent; border: none; cursor: pointer; padding: 6px; border-radius: 10px; transition: background 0.15s, transform 0.12s; -webkit-tap-highlight-color: transparent; color: #5F6368; display: inline-flex; align-items: center; justify-content: center; }
        .gem-act:active { transform: scale(0.92); background: rgba(0,0,0,0.08); }
      `}</style>

      {/* Persona Picker — chevron 클릭 시 헤더 아래 슬라이드 다운 */}
      <PersonaPicker
        open={personaPickerOpen}
        activeId={personaId}
        onSelect={handleSelectPersona}
        onClose={() => setPersonaPickerOpen(false)}
        anchorTop={isTab ? 76 : 108}
      />

      {/* Quick Question Chips */}
      <div className="consult-chips">
        {quickQuestions.map((q) => (
          <button
            key={q}
            className="consult-chip"
            onClick={() => {
              if (q === '이 화장품 내 피부에 맞아?' && pendingImages.length === 0) {
                setShowAttachMenu(true);
              } else {
                sendMessage(q);
              }
            }}
            disabled={isLoading}
            style={{ opacity: isLoading ? 0.5 : 1 }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="consult-messages">
        {messages.length === 0 && (
          <div style={{
            flex: 1, minHeight: 360,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: '32px 24px 80px', gap: 20,
          }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
              <defs>
                <linearGradient id="luaStarGradSC" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6598ef" />
                  <stop offset="55%" stopColor="#58aefe" />
                  <stop offset="100%" stopColor="#cce8fb" />
                </linearGradient>
              </defs>
              <path
                d="M28 2 C29 14 30 17 32 19 C34 22 37 23 54 28 C37 33 34 34 32 37 C30 39 29 42 28 54 C27 42 26 39 24 37 C22 34 19 33 2 28 C19 23 22 22 24 19 C26 17 27 14 28 2 Z"
                fill="url(#luaStarGradSC)"
              />
            </svg>
            <div style={{
              fontSize: 24, fontWeight: 500, color: '#1F1F1F',
              letterSpacing: -0.5, lineHeight: 1.3,
              fontFamily: 'var(--font-display), Pretendard, -apple-system, sans-serif',
              maxWidth: 320,
            }}>
              오늘 피부는 어떤가요?
            </div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isAI = msg.role === 'ai' || msg.role === 'assistant';
          const { cleanText, categories } = isAI
            ? extractRecommendTags(msg.content)
            : { cleanText: msg.content, categories: [] };

          // Show products only when AI explicitly included [RECOMMEND:] tags
          const showProducts = isAI && categories.length > 0;

          // Show AI label if first AI message or previous message was from user
          const prevMsg = i > 0 ? messages[i - 1] : null;
          const showAiLabel = isAI && (!prevMsg || prevMsg.role === 'user');

          if (isAI) {
            // Gemini 스타일: 버블·아바타·"루아" 라벨 모두 없음. 평문 마크다운만 + 액션 row.
            return (
              <div key={i} style={{ padding: '10px 2px 4px', fontSize: 16, lineHeight: 1.3, fontWeight: 500, color: 'var(--text-primary)' }}>
                {msg.imageThumbs && msg.imageThumbs.length > 0 && (
                  <div className="consult-bubble-images" style={{ marginBottom: 8 }}>
                    {msg.imageThumbs.map((thumb, ti) => (
                      <img key={ti} src={thumb} alt={`첨부 이미지 ${ti + 1}`} className="consult-bubble-image" />
                    ))}
                  </div>
                )}
                {renderMarkdown(cleanText)}
                {!isLoading || i !== messages.length - 1 ? (
                  <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 14 }}>
                    <button className="gem-act" aria-label="좋아요"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7l-3-3v-9a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg></button>
                    <button className="gem-act" aria-label="별로예요"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17l3 3v9a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg></button>
                    <button className="gem-act" aria-label="다시 답변" onClick={() => {
                      const lastUser = [...messages].reverse().find(m => m.role === 'user');
                      if (lastUser) { setMessages(prev => prev.slice(0, -1)); sendMessage(lastUser.content); }
                    }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg></button>
                    <button className="gem-act" aria-label="복사" onClick={() => { try { navigator.clipboard?.writeText(cleanText); } catch {} }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                  </div>
                ) : null}
                {/* Product recommendation cards below AI message */}
                {showProducts && (
                  <div style={{ padding: '8px 0 0 0' }}>
                    {categories.map((cat, ci) => (
                      <ProductRecommendSection key={cat} category={cat} result={result} delay={ci * 0.15} />
                    ))}
                    <div style={{
                      fontSize: 10, fontWeight: 500, color: 'var(--text-dim)', textAlign: 'center',
                      padding: '6px 12px 2px', lineHeight: 1.3,
                    }}>
                      이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
                    </div>
                  </div>
                )}
              </div>
            );
          }
          // User 메시지 — Gemini 스타일 옅은 회색 캡슐
          return (
            <div key={i} style={{ padding: '6px 0' }}>
              {msg.imageThumbs && msg.imageThumbs.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginBottom: 6 }}>
                  {msg.imageThumbs.map((thumb, ti) => (
                    <img key={ti} src={thumb} alt="" style={{ width: 88, height: 88, borderRadius: 14, objectFit: 'cover' }} />
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{
                  background: 'var(--bg-card, #F1F3F4)',
                  padding: '11px 18px',
                  borderRadius: 20,
                  maxWidth: '82%',
                  fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3,
                  whiteSpace: 'pre-wrap',
                  letterSpacing: -0.1,
                }}>{msg.content}</div>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="consult-typing">
            <div className="consult-typing-dot" />
            <div className="consult-typing-dot" />
            <div className="consult-typing-dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Previews */}
      {pendingImages.length > 0 && (
        <div className="consult-image-preview">
          {pendingImages.map((img, idx) => (
            <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
              <img src={img.dataUrl} alt={`첨부할 이미지 ${idx + 1}`} />
              <button
                className="consult-image-preview-remove"
                onClick={() => setPendingImages(prev => prev.filter((_, i) => i !== idx))}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
          {pendingImages.length < MAX_IMAGES && (
            <button
              onClick={() => albumInputRef.current?.click()}
              style={{
                width: 72, height: 72, borderRadius: 12,
                border: '2px dashed rgba(var(--accent-rgb),0.4)',
                background: 'rgba(var(--accent-rgb),0.08)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', gap: 2, flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span style={{ fontSize: 10, lineHeight: 1.3, color: '#6598ef', fontWeight: 500 }}>추가</span>
            </button>
          )}
          <span style={{ fontSize: 12, lineHeight: 1.5, fontWeight: 500, color: 'var(--text-muted)', width: '100%' }}>
            {`사진 ${pendingImages.length}/${MAX_IMAGES}장`}
            {pendingImages.length >= 2 && ' · 비교 분석 가능'}
          </span>
        </div>
      )}

      {/* Input Bar */}
      <div style={{
        padding: '8px 16px',
        background: 'transparent',
        borderTop: 'none',
        position: 'absolute', bottom: 6, left: 0, right: 0,
        zIndex: 60,
      }}>
        {/* Attach Menu */}
        {showAttachMenu && (
          <div className="consult-attach-menu" onClick={(e) => e.stopPropagation()}>
            <button className="consult-attach-option" onClick={() => { cameraInputRef.current?.click(); setShowAttachMenu(false); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              카메라로 촬영
            </button>
            <button className="consult-attach-option" onClick={() => { albumInputRef.current?.click(); setShowAttachMenu(false); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              앨범에서 선택
            </button>
          </div>
        )}

        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', width: '100%',
          background: '#FFFFFF', borderRadius: 28,
          padding: '6px 6px 6px 12px', boxSizing: 'border-box',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
        {/* + Attach Button */}
        <button
          className="consult-attach-btn"
          onClick={(e) => { e.stopPropagation(); setShowAttachMenu(!showAttachMenu); }}
          disabled={isLoading}
          style={{ opacity: isLoading ? 0.5 : 1 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? '듣고 있어요... 끝나면 마이크 다시 눌러주세요' : isTranscribing ? '음성을 텍스트로 변환 중...' : pendingImages.length > 0 ? '메시지와 함께 전송...' : '피부 고민을 물어보세요...'}
          disabled={isLoading || isTranscribing}
          style={{
            flex: 1, minWidth: 0, padding: '10px 4px', borderRadius: 0,
            border: 'none',
            background: 'transparent',
            fontSize: 14, lineHeight: 1.5, fontWeight: 500, color: '#333',
            fontFamily: 'inherit', outline: 'none',
          }}
        />

        {/* Mic STT Button */}
        {sttSupported && (
          <button
            className={`consult-mic-btn${isListening ? ' listening' : ''}${isTranscribing ? ' transcribing' : ''}`}
            onClick={toggleListening}
            disabled={isLoading || isTranscribing}
            style={{ opacity: (isLoading || isTranscribing) ? 0.6 : 1 }}
            aria-label={isListening ? '녹음 정지' : isTranscribing ? '변환 중' : '음성 입력'}
          >
            {isTranscribing ? (
              // 변환 중: 작은 spinner
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="#6598ef" strokeWidth="2" strokeLinecap="round"
                style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke={isListening ? '#FF6B6B' : '#6598ef'}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="1" width="6" height="11" rx="3"
                  fill={isListening ? '#FF6B6B' : 'none'}/>
                <path d="M19 10v1a7 7 0 01-14 0v-1"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </button>
        )}

        <button
          onClick={() => sendMessage(input)}
          disabled={!canSend}
          style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none',
            background: canSend
              ? 'var(--btn-primary-bg)'
              : 'var(--bg-card-hover)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: canSend ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={canSend ? '#fff' : 'var(--text-dim)'}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
        </div>
      </div>
    </div>
  );
}

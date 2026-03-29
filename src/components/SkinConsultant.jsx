import { useState, useRef, useEffect, useCallback } from 'react';
import { getRecords, getSmoothedChanges, getChanges, getTodayRecords, getStableSkinAge } from '../storage/SkinStorage';
import { getProfile } from '../storage/ProfileStorage';
import { saveConsultSession, loadConsultSession, clearConsultSession } from '../storage/ConsultStorage';
import { getProducts } from '../storage/TrackerStorage';
import { compressImage } from '../engine/PixelAnalysis';
import { PRODUCTS, CATEGORY_META, getProductsByCategory, calcMatchScore } from '../data/ProductCatalog';
import SoftCloverIcon from './icons/SoftCloverIcon';
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

/** Score ring SVG — small circular progress */
function MatchScoreRing({ score }) {
  const r = 16, stroke = 3;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
      <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(240,144,112,0.12)" strokeWidth={stroke} />
        <circle cx="20" cy="20" r={r} fill="none" stroke="#ADEBB3" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: '#a5b4fc',
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
        border: '1px solid var(--border-light)',
        textDecoration: 'none', color: 'inherit',
        animation: `slideInRight 0.4s ease-out ${delay}s both`,
        cursor: 'pointer',
        transition: 'background 0.2s, border-color 0.2s',
      }}>
      {/* Product icon placeholder */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(240,144,112,0.15), rgba(240,144,112,0.15))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>
        {product.tags?.[0]?.includes('히알루론') ? <DropletIcon size={18} /> :
         product.tags?.[0]?.includes('비타민') ? '🍊' :
         product.tags?.[0]?.includes('레티놀') ? <SparkleIcon size={18} /> :
         product.tags?.[0]?.includes('나이아신') ? <TestTubeIcon size={18} /> :
         product.tags?.[0]?.includes('자외선') ? <SunIcon size={18} /> :
         product.tags?.[0]?.includes('글루타') ? <DiamondIcon size={18} /> :
         product.tags?.[0]?.includes('마스크') ? <PaletteIcon size={18} /> :
         product.tags?.[0]?.includes('펩타이드') ? <MicroscopeIcon size={18} /> : <LotionIcon size={18} />}
      </div>
      {/* Center: name + tags + volume */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.brand} {product.name}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {product.tags?.slice(0, 2).map((tag, ti) => (
            <span key={ti} style={{
              fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 8,
              background: 'rgba(240,144,112,0.15)', color: '#81E4BD',
            }}>{tag}</span>
          ))}
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{product.volume}</span>
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
        border: '1px solid var(--border-subtle)',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 18 }}>{meta.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>{meta.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta.ingredient}</div>
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
function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, li) => {
    const isBullet = line.trimStart().startsWith('• ') || line.trimStart().startsWith('- ');
    const cleanLine = isBullet ? line.replace(/^\s*[•\-]\s*/, '') : line;

    const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g).map((seg, si) => {
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return <strong key={si} style={{ color: '#FFF3B0', fontWeight: 500 }}>{seg.slice(2, -2)}</strong>;
      }
      return seg;
    });

    if (isBullet) {
      return <div key={li} style={{ display: 'flex', gap: 8, marginTop: li > 0 ? 6 : 0 }}>
        <span style={{ flexShrink: 0, opacity: 0.5, color: 'var(--accent-primary)' }}>•</span>
        <span>{parts}</span>
      </div>;
    }
    if (line.trim() === '') {
      return <div key={li} style={{ height: 14 }} />;
    }
    return <div key={li} style={{ marginTop: li > 0 ? 3 : 0 }}>{parts}</div>;
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
  const [sttSupported, setSttSupported] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const cameraInputRef = useRef(null);
  const albumInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const quickQuestions = [
    '내 피부 최대 약점은?',
    '내 루틴 분석해줘',
    '피부나이 줄이려면?',
    '지금 피부 상태 요약해줘',
    '이 화장품 내 피부에 맞아?',
    '내 피부에 맞는 화장품 추천해줘',
    '맞춤 피부 시술 추천해줘',
  ];

  // Initialize: load saved session or create welcome message
  useEffect(() => {
    const saved = loadConsultSession();
    if (saved && saved.length > 0) {
      setMessages(saved);
    } else {
      const welcome = {
        role: 'assistant',
        content: generateWelcomeMessage(result),
        timestamp: Date.now(),
      };
      setMessages([welcome]);
    }
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

  // Mobile keyboard handling via visualViewport API
  // Dynamically resize container to fit above the keyboard
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !containerRef.current) return;

    const onViewportChange = () => {
      const container = containerRef.current;
      if (!container) return;

      const kbHeight = Math.round(window.innerHeight - vv.height);
      const isOpen = kbHeight > 150;

      if (isOpen) {
        // Keyboard open: fill from top to visual viewport height
        container.style.height = `${vv.height}px`;
        container.style.bottom = 'auto';
      } else {
        // Keyboard closed: restore CSS defaults
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
  }, []);

  // Close attach menu on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = () => setShowAttachMenu(false);
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [showAttachMenu]);

  // Speech-to-Text initialization
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    setSttSupported(true);
    return () => {
      try { recognition.abort(); } catch {}
    };
  }, []);

  const toggleListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
    } else {
      try { recognition.start(); setIsListening(true); } catch {}
    }
  }, [isListening]);

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
        birthYear: profile.birthYear,
        gender: profile.gender,
        skinType: profile.skinType,
      },
      trackerProducts: getProducts().map(p => ({
        brand: p.brand,
        name: p.name,
        category: p.category,
        timeSlot: p.timeSlot,
        startDate: p.startDate,
        ingredients: p.ingredients,
      })),
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
    setInput('');
    setPendingImages([]);
    setIsLoading(true);


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

      const data = await response.json();
      const aiMsg = { role: 'assistant', content: data.reply, timestamp: Date.now() };
      setMessages(prev => [...prev, aiMsg]);
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
  }, [messages, isLoading, buildContext, pendingImages]);

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

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isTab ? '20px 20px 14px' : '52px 20px 14px',
        background: isTab ? 'transparent' : 'var(--consult-header-bg)',
        backdropFilter: isTab ? 'none' : 'var(--card-backdrop)', WebkitBackdropFilter: isTab ? 'none' : 'var(--card-backdrop)',
        borderBottom: '1px solid var(--border-separator)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--btn-primary-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.3 }}>
              나만의 피부 상담사
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
              AI 맞춤 피부 컨시어지 서비스
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => {
            clearConsultSession();
            const welcome = { role: 'assistant', content: generateWelcomeMessage(result), timestamp: Date.now() };
            setMessages([welcome]);
          }} style={{
            height: 32, padding: '0 12px', borderRadius: 16, border: 'none',
            background: 'var(--bg-card-hover)',
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-11.36L1 10"/>
            </svg>
            새 상담
          </button>
          {!isTab && (
            <button onClick={handleClose} style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--bg-input)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

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

          return (
            <div key={i}>
              {showAiLabel && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  marginBottom: 6, marginTop: i > 0 ? 12 : 0,
                  paddingLeft: 2,
                }}>
                  <div style={{ flexShrink: 0 }}>
                    <SoftCloverIcon theme="morningLight" size={28} animate />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>루아</span>
                </div>
              )}
              <div className={`consult-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}>
                {msg.imageThumbs && msg.imageThumbs.length > 0 ? (
                  <div className="consult-bubble-images">
                    {msg.imageThumbs.map((thumb, ti) => (
                      <img key={ti} src={thumb} alt={`첨부 이미지 ${ti + 1}`} className="consult-bubble-image" />
                    ))}
                  </div>
                ) : msg.imageThumb && (
                  <img src={msg.imageThumb} alt="첨부 이미지" className="consult-bubble-image" />
                )}
                {isAI ? renderMarkdown(cleanText) : msg.content}
              </div>
              {/* Product recommendation cards below AI message */}
              {showProducts && (
                <div style={{ padding: '0 4px 0 44px' }}>
                  {categories.map((cat, ci) => (
                    <ProductRecommendSection key={cat} category={cat} result={result} delay={ci * 0.15} />
                  ))}
                  <div style={{
                    fontSize: 10, color: 'var(--text-dim)', textAlign: 'center',
                    padding: '6px 12px 2px', lineHeight: 1.4,
                  }}>
                    이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
                  </div>
                </div>
              )}
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
                border: '2px dashed rgba(240,144,112,0.4)',
                background: 'rgba(240,144,112,0.08)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', gap: 2, flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#81E4BD" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span style={{ fontSize: 10, color: '#81E4BD', fontWeight: 600 }}>추가</span>
            </button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', width: '100%' }}>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#81E4BD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              카메라로 촬영
            </button>
            <button className="consult-attach-option" onClick={() => { albumInputRef.current?.click(); setShowAttachMenu(false); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#81E4BD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#81E4BD" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? '듣고 있어요...' : pendingImages.length > 0 ? '메시지와 함께 전송...' : '피부 고민을 물어보세요...'}
          disabled={isLoading}
          style={{
            flex: 1, minWidth: 0, padding: '10px 4px', borderRadius: 0,
            border: 'none',
            background: 'transparent',
            fontSize: 14, color: '#333',
            fontFamily: 'inherit', outline: 'none',
          }}
        />

        {/* Mic STT Button */}
        {sttSupported && (
          <button
            className={`consult-mic-btn${isListening ? ' listening' : ''}`}
            onClick={toggleListening}
            disabled={isLoading}
            style={{ opacity: isLoading ? 0.5 : 1 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={isListening ? '#81E4BD' : '#81E4BD'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="1" width="6" height="11" rx="3"/>
              <path d="M19 10v1a7 7 0 01-14 0v-1"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
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

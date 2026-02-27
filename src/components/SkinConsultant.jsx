import { useState, useRef, useEffect, useCallback } from 'react';
import { getRecords, getSmoothedChanges, getChanges, getStreak } from '../storage/SkinStorage';
import { getProfile } from '../storage/ProfileStorage';
import { saveConsultSession, loadConsultSession } from '../storage/ConsultStorage';
import { compressImage } from '../engine/PixelAnalysis';

/** Minimal markdown → React: **bold**, \n→<br>, • bullets */
function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, li) => {
    const isBullet = line.trimStart().startsWith('• ') || line.trimStart().startsWith('- ');
    const cleanLine = isBullet ? line.replace(/^\s*[•\-]\s*/, '') : line;

    // Bold: **text**
    const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g).map((seg, si) => {
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return <strong key={si}>{seg.slice(2, -2)}</strong>;
      }
      return seg;
    });

    if (isBullet) {
      return <div key={li} style={{ display: 'flex', gap: 6, marginTop: li > 0 ? 2 : 0 }}>
        <span style={{ flexShrink: 0, opacity: 0.6 }}>•</span>
        <span>{parts}</span>
      </div>;
    }
    // Empty line = paragraph spacing
    if (line.trim() === '') {
      return <div key={li} style={{ height: 8 }} />;
    }
    return <div key={li}>{parts}</div>;
  });
}

function generateWelcomeMessage(result) {
  if (!result) return '안녕하세요! 피부 상담을 시작할게요.';

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

  return `안녕하세요! 오늘 피부 분석 결과를 봤어요. 종합 ${overall}점이에요. 가장 신경 쓸 부분은 ${weakest.label}(${weakest.score}점)이에요. 궁금한 점이 있으면 편하게 물어보세요! 화장품 사진을 보내주시면 성분 적합성도 분석해드려요.`;
}

export default function SkinConsultant({ result, onClose, isTab = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // { dataUrl, base64 }
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const cameraInputRef = useRef(null);
  const albumInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const quickQuestions = [
    '내 피부 최대 약점은?',
    '추천 스킨케어 루틴은?',
    '피부나이 줄이려면?',
    '지금 피부 상태 요약해줘',
    '이 화장품 내 피부에 맞아?',
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

  // Mobile keyboard handling via visualViewport API
  // Keep overlay full-screen, use paddingBottom to push content above keyboard
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !containerRef.current) return;

    const handleResize = () => {
      const container = containerRef.current;
      if (!container) return;
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height);
      container.style.paddingBottom = `${keyboardHeight}px`;
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
      if (containerRef.current) {
        containerRef.current.style.paddingBottom = '';
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
    const streak = getStreak();
    const profile = getProfile();

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
      streak,
      profile: {
        birthYear: profile.birthYear,
        gender: profile.gender,
        skinType: profile.skinType,
      },
    };
  }, [result]);

  const sendMessage = useCallback(async (text, imageOverride) => {
    const msgText = (text || '').trim();
    const imgData = imageOverride || pendingImage;

    if (!msgText && !imgData && !isLoading) return;
    if (isLoading) return;

    const userMsg = {
      role: 'user',
      content: msgText || (imgData ? '이 화장품 내 피부에 맞는지 분석해주세요.' : ''),
      timestamp: Date.now(),
      imageThumb: imgData?.dataUrl || null,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setPendingImage(null);
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
      if (imgData?.base64) {
        body.image = imgData.base64;
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
  }, [messages, isLoading, buildContext, pendingImage]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      // Compress for API (1024px for ingredient label + skin detail readability)
      const compressed = await compressImage(dataUrl, 1024, 0.85);
      const base64 = compressed.split(',')[1];
      setPendingImage({ dataUrl, base64 });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setShowAttachMenu(false);
  }, []);

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

  const canSend = (input.trim() || pendingImage) && !isLoading;

  return (
    <div
      ref={containerRef}
      className={isTab ? 'consult-tab' : `consult-overlay${isClosing ? ' closing' : ''}`}
    >
      {/* Hidden file inputs */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
        onChange={handleFileSelect} style={{ display: 'none' }} />
      <input ref={albumInputRef} type="file" accept="image/*"
        onChange={handleFileSelect} style={{ display: 'none' }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isTab ? '20px 20px 14px' : '52px 20px 14px',
        background: isTab ? 'transparent' : 'rgba(17,17,24,0.95)',
        backdropFilter: isTab ? 'none' : 'blur(12px)', WebkitBackdropFilter: isTab ? 'none' : 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f5', letterSpacing: -0.3 }}>
              나만의 피부상담사
            </div>
            <div style={{ fontSize: 11, color: '#8888a0', fontWeight: 400 }}>
              AI 맞춤 스킨케어 상담
            </div>
          </div>
        </div>
        {!isTab && (
          <button onClick={handleClose} style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 18, color: '#8888a0',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Quick Question Chips */}
      <div className="consult-chips">
        {quickQuestions.map((q) => (
          <button
            key={q}
            className="consult-chip"
            onClick={() => {
              if (q === '이 화장품 내 피부에 맞아?' && !pendingImage) {
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
        {messages.map((msg, i) => (
          <div key={i} className={`consult-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}>
            {msg.imageThumb && (
              <img
                src={msg.imageThumb}
                alt="첨부 이미지"
                className="consult-bubble-image"
              />
            )}
            {msg.role === 'ai' || msg.role === 'assistant'
              ? renderMarkdown(msg.content)
              : msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="consult-typing">
            <div className="consult-typing-dot" />
            <div className="consult-typing-dot" />
            <div className="consult-typing-dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview */}
      {pendingImage && (
        <div className="consult-image-preview">
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={pendingImage.dataUrl} alt="첨부할 이미지" />
            <button
              className="consult-image-preview-remove"
              onClick={() => setPendingImage(null)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <span style={{ fontSize: 12, color: '#8888a0' }}>사진이 첨부됐어요</span>
        </div>
      )}

      {/* Input Bar */}
      <div style={{
        padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(17,17,24,0.95)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 8, alignItems: 'flex-end',
        flexShrink: 0, position: 'relative',
      }}>
        {/* Attach Menu */}
        {showAttachMenu && (
          <div className="consult-attach-menu" onClick={(e) => e.stopPropagation()}>
            <button className="consult-attach-option" onClick={() => { cameraInputRef.current?.click(); setShowAttachMenu(false); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              카메라로 촬영
            </button>
            <button className="consult-attach-option" onClick={() => { albumInputRef.current?.click(); setShowAttachMenu(false); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              앨범에서 선택
            </button>
          </div>
        )}

        {/* + Attach Button */}
        <button
          className="consult-attach-btn"
          onClick={(e) => { e.stopPropagation(); setShowAttachMenu(!showAttachMenu); }}
          disabled={isLoading}
          style={{ opacity: isLoading ? 0.5 : 1 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? '듣고 있어요...' : pendingImage ? '메시지와 함께 전송...' : '피부 고민을 물어보세요...'}
          disabled={isLoading}
          style={{
            flex: 1, minWidth: 0, padding: '12px 18px', borderRadius: 24,
            border: `1px solid ${isListening ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
            background: 'rgba(255,255,255,0.06)',
            fontSize: 14, color: '#f0f0f5',
            fontFamily: 'inherit', outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
          onBlur={(e) => { if (!isListening) e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
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
              stroke={isListening ? '#a78bfa' : '#8b5cf6'}
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
              ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
              : 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: canSend ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={canSend ? '#fff' : '#555570'}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

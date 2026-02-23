import { useState, useRef, useCallback, useEffect } from 'react';
import { compressImage, analyzePixels, pixelsToScores, generateDemoScores, checkPhotoQuality } from './engine/PixelAnalysis';
import { detectLandmarks } from './engine/FaceLandmarker';
import { callVisionAI, hybridMerge } from './engine/HybridAnalysis';
import { estimateAge } from './engine/FaceAgeEstimator';
import { AnimatedNumber, ScoreRing, MetricBar, Tag, DetailPage } from './components/UIComponents';
import CameraCapture from './components/CameraCapture';
import { saveRecord, getRecords, getStreak, getNextMeasurementInfo, getChanges, getSmoothedChanges, generateShareText, getLatestRecord, hasTodayRecord, saveThumbnail } from './storage/SkinStorage';
import HistoryPage from './pages/HistoryPage';
import TabBar from './components/TabBar';
import MyPage from './pages/MyPage';
import RoutinePage from './pages/RoutinePage';
import DailyJourney from './components/DailyJourney';
import SkinScoreCircle from './components/SkinScoreCircle';
import AiInsightCard from './components/AiInsightCard';

export default function App() {
  const [stage, setStage] = useState('landing');
  const [image, setImage] = useState(null);
  const [b64, setB64] = useState(null);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [detailKey, setDetailKey] = useState(null);
  const [prevStage, setPrevStage] = useState('landing');
  const [imageSize, setImageSize] = useState('');
  const [pixelData, setPixelData] = useState(null);
  const [landmarks, setLandmarks] = useState(null);
  const [saved, setSaved] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [photoQuality, setPhotoQuality] = useState(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [mlAge, setMlAge] = useState(null);
  const [faceMesh, setFaceMesh] = useState(null);
  const fileRef = useRef(null);
  const photoContainerRef = useRef(null);
  const nativeCameraRef = useRef(null);

  const [activeTab, setActiveTab] = useState('home');

  const [recordCount, setRecordCount] = useState(0);
  const [streak, setStreakState] = useState({ count: 0 });
  const [nextInfo, setNextInfo] = useState(null);

  useEffect(() => { refreshLandingData(); }, []);

  const refreshLandingData = () => {
    setRecordCount(getRecords().length);
    setStreakState(getStreak());
    setNextInfo(getNextMeasurementInfo());
  };

  // Compute face mesh mapped coordinates for result photo overlay
  useEffect(() => {
    if (!landmarks || !photoContainerRef.current || stage !== 'result' || !image) {
      setFaceMesh(null);
      return;
    }
    const el = photoContainerRef.current;
    const cw = el.offsetWidth;
    const ch = el.offsetHeight;
    const img = new Image();
    img.onload = () => {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      const ox = (cw - dw) / 2;
      const oy = (ch - dh) / 2;
      const mapped = landmarks.map(pt => ({
        x: pt.x * dw + ox,
        y: pt.y * dh + oy,
      }));
      setFaceMesh({ points: mapped, width: cw, height: ch });
    };
    img.src = image;
  }, [landmarks, stage, image]);

  const openDetail = useCallback((key) => { setPrevStage(stage); setDetailKey(key); setStage('detail'); }, [stage]);
  const closeDetail = useCallback(() => { setStage(prevStage); setDetailKey(null); }, [prevStage]);
  const goToHistory = useCallback(() => { refreshLandingData(); setActiveTab('history'); }, []);
  const goToLanding = useCallback(() => { refreshLandingData(); setActiveTab('home'); setStage('landing'); }, []);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'home') {
      setStage('landing');
      refreshLandingData();
    }
  }, []);

  const reset = useCallback(() => {
    setActiveTab('home'); setStage('landing'); setImage(null); setB64(null); setResult(null);
    setProgress(0); setDetailKey(null); setPixelData(null); setLandmarks(null); setMlAge(null); setImageSize('');
    setSaved(false); setShowSaveToast(false); setPhotoQuality(null); refreshLandingData();
  }, []);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const original = ev.target.result;
      setImage(original);
      const compressed = await compressImage(original);
      const data = compressed.split(',')[1];
      setImageSize(`${Math.round(data.length * 3 / 4 / 1024)}KB`);
      setB64(data);

      // Detect face landmarks (returns null on failure -> fallback to fixed regions)
      const imgEl = new Image();
      imgEl.src = original;
      await new Promise(r => { imgEl.onload = r; imgEl.onerror = r; });
      const [lm, ageResult] = await Promise.all([
        detectLandmarks(imgEl),
        estimateAge(imgEl),
      ]);
      setLandmarks(lm);
      setMlAge(ageResult ? ageResult.age : null);

      const px = await analyzePixels(original, lm);
      setPixelData(px);
      const quality = await checkPhotoQuality(original);
      setPhotoQuality(quality);
      setStage('upload');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  // Smart camera opener: Face ID guide on secure context, native camera on HTTP mobile
  const openCamera = useCallback(() => {
    setActiveTab('home');
    if (window.isSecureContext && navigator.mediaDevices?.getUserMedia) {
      setStage('camera');
    } else {
      // Mobile HTTP: open native camera via <input capture="user">
      nativeCameraRef.current?.click();
    }
  }, []);

  const handleCameraCapture = useCallback(async (dataUrl, lm) => {
    setImage(dataUrl);
    setLandmarks(lm);
    // ML age estimation (parallel with compression + pixel analysis)
    const imgEl = new Image();
    imgEl.src = dataUrl;
    await new Promise(r => { imgEl.onload = r; imgEl.onerror = r; });
    const ageResult = await estimateAge(imgEl);
    setMlAge(ageResult ? ageResult.age : null);
    const compressed = await compressImage(dataUrl);
    const data = compressed.split(',')[1];
    setImageSize(`${Math.round(data.length * 3 / 4 / 1024)}KB`);
    setB64(data);
    const px = await analyzePixels(dataUrl, lm);
    setPixelData(px);
    const quality = await checkPhotoQuality(dataUrl);
    setPhotoQuality(quality);
    setStage('upload');
  }, []);

  const startAnalysis = useCallback(async () => {
    if (!pixelData) return;
    setStage('analyzing'); setProgress(0); setSaved(false);
    const pi = setInterval(() => { setProgress(p => { if (p >= 90) { clearInterval(pi); return 90; } return p + Math.random() * 8 + 2; }); }, 450);

    // CV scoring (with mlAge from FaceAgeEstimator)
    const cvScores = pixelsToScores(pixelData, mlAge);

    // AI scoring (parallel, non-blocking)
    let finalScores = cvScores;
    try {
      if (b64) {
        const aiScores = await callVisionAI(b64, pixelData);
        if (aiScores) {
          finalScores = hybridMerge(cvScores, aiScores);
        } else {
          finalScores = { ...cvScores, analysisMode: 'cv_only' };
        }
      } else {
        finalScores = { ...cvScores, analysisMode: 'cv_only' };
      }
    } catch (e) {
      console.warn('Hybrid analysis fallback to CV:', e);
      finalScores = { ...cvScores, analysisMode: 'cv_only' };
    }

    clearInterval(pi); setProgress(100);
    setTimeout(() => {
      setResult(finalScores); setStage('result');
      // Auto-save record and thumbnail
      const ok = saveRecord(finalScores);
      if (ok) {
        setSaved(true);
        setShowSaveToast(true);
        setTimeout(() => setShowSaveToast(false), 2500);
        if (image) {
          const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
          saveThumbnail(today, image);
        }
      }
    }, 400);
  }, [pixelData, mlAge, image, b64]);

  const startDemo = useCallback(() => {
    setStage('analyzing'); setProgress(0); setSaved(false);
    const pi = setInterval(() => { setProgress(p => { if (p >= 90) { clearInterval(pi); return 90; } return p + Math.random() * 12 + 4; }); }, 350);
    setTimeout(() => {
      clearInterval(pi); setProgress(100);
      setTimeout(() => {
        const scores = generateDemoScores();
        setResult(scores); setStage('result');
        // Auto-save demo results
        const ok = saveRecord(scores);
        if (ok) {
          setSaved(true);
          setShowSaveToast(true);
          setTimeout(() => setShowSaveToast(false), 2500);
        }
      }, 400);
    }, 2800);
  }, []);

  const handleSave = useCallback(() => {
    if (!result || saved) return;
    const ok = saveRecord(result);
    if (ok) {
      setSaved(true);
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2500);
      // Save thumbnail for photo gallery / daily journey
      if (image) {
        const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
        saveThumbnail(today, image);
      }
    }
  }, [result, saved, image]);

  const handleShare = useCallback(() => {
    if (!result) return;
    const text = generateShareText(result);
    if (navigator.share) { navigator.share({ title: 'NOU 피부 나이', text }).catch(() => {}); }
    else { navigator.clipboard?.writeText(text).then(() => alert('복사되었습니다!')).catch(() => {}); }
  }, [result]);

  const getAgeComment = (age) => {
    if (age <= 20) return '놀라운 피부! 최고의 컨디션이에요 ✨';
    if (age <= 24) return '건강하고 탄력 넘치는 피부 💛';
    if (age <= 28) return '관리 잘 되고 있는 좋은 피부 😊';
    if (age <= 33) return '조금만 더 신경 쓰면 완벽 💪';
    return '지금부터 관리하면 충분히 좋아져요 🌱';
  };

  const getGrade = (score) => {
    if (score >= 85) return { grade: 'S', color: '#FF6B35', text: '최상' };
    if (score >= 70) return { grade: 'A', color: '#FF9800', text: '우수' };
    if (score >= 55) return { grade: 'B', color: '#FFC107', text: '양호' };
    return { grade: 'C', color: '#9E9E9E', text: '관리 필요' };
  };

  const getProgressText = (p) => {
    if (p < 12) return '얼굴 영역 감지 중...';
    if (p < 22) return '밝기·색상 실측 중...';
    if (p < 32) return '주름 존 분석 중...';
    if (p < 42) return '모공 텍스처 측정 중...';
    if (p < 50) return '턱선 탄력 분석 중...';
    if (p < 58) return '색소 클러스터 감지 중...';
    if (p < 66) return '피부결 매끄러움 측정 중...';
    if (p < 74) return '다크서클 밝기·색조 분석 중...';
    if (p < 84) return 'T/U존 유분 비교 중...';
    if (p < 92) return 'AI가 정밀 판독하고 있어요...';
    return '10개 지표 종합 산출 중...';
  };

  const changes = getSmoothedChanges() || getChanges();

  const showTabBar = activeTab !== 'home' || stage === 'landing' || stage === 'result';

  return (
    <div className="app-container">
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      <input ref={nativeCameraRef} type="file" accept="image/*" capture="user" onChange={handleFile} style={{ display: 'none' }} />

      {/* Save Toast */}
      {showSaveToast && (
        <div style={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', background: '#333', color: '#fff', padding: '10px 22px', borderRadius: 30, fontSize: 13, fontWeight: 600, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          ✅ 기록이 저장되었어요!
        </div>
      )}

      {/* ===== DETAIL PAGE ===== */}
      {activeTab === 'home' && stage === 'detail' && (
        <DetailPage
          metricKey={detailKey}
          value={result ? {
            skinAge: result.skinAge, moisture: result.moisture, skinTone: result.skinTone,
            trouble: result.troubleCount, oilBalance: result.oilBalance,
            wrinkles: result.wrinkleScore, pores: result.poreScore,
            elasticity: result.elasticityScore, pigmentation: result.pigmentationScore,
            texture: result.textureScore, darkCircles: result.darkCircleScore,
          }[detailKey] : undefined}
          onBack={closeDetail}
        />
      )}

      {/* ===== HISTORY PAGE (gallery only) ===== */}
      {activeTab === 'history' && (
        <HistoryPage mode="gallery" onBack={goToLanding} onMeasure={openCamera} />
      )}

      {/* ===== ANALYZE PAGE (insights only) ===== */}
      {activeTab === 'analyze' && (
        <HistoryPage mode="insights" onBack={goToLanding} onMeasure={openCamera} />
      )}

      {/* ===== ROUTINE PAGE ===== */}
      {activeTab === 'routine' && <RoutinePage />}

      {/* ===== MY PAGE ===== */}
      {activeTab === 'my' && <MyPage />}

      {/* ===== HOME TAB (stage-based sub-flow) ===== */}
      {activeTab === 'home' && <>

      {/* ===== LANDING PAGE ===== */}
      {stage === 'landing' && (
        <div>
          {/* Header */}
          <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
            <div style={{ marginBottom: 10 }}>
              <div><span style={{ fontSize: 21, fontWeight: 700, color: '#FF8C42', letterSpacing: 8, fontFamily: "'Outfit', sans-serif" }}>NOU</span></div>
              <div style={{ marginTop: 4 }}><span style={{ fontSize: 10, color: '#FF8C42', background: 'rgba(255,140,66,0.12)', padding: '2px 10px', borderRadius: 10 }}>Beta</span></div>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: 48 }} />

            {/* Profile Avatar — living breathing orb */}
            <div onClick={openCamera} style={{
              position: 'relative', width: 260, height: 260,
              marginBottom: 58, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* Soft aura pulse */}
              <div style={{
                position: 'absolute', width: 440, height: 440, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255,160,70,0.35) 0%, rgba(255,150,60,0.2) 15%, rgba(255,170,90,0.1) 30%, rgba(255,140,110,0.04) 50%, rgba(255,130,120,0.01) 70%, transparent 85%)',
                pointerEvents: 'none',
              }} />

              {/* Main orb with breathing */}
              <div style={{
                width: 226, height: 226, borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'orbBreathe 5s ease-in-out infinite',
                willChange: 'transform, box-shadow',
              }}>
                <div className="voice-orb" style={{
                  width: 220, height: 220, borderRadius: '50%',
                  background: '#FFF8F2',
                  position: 'relative', overflow: 'hidden',
                  clipPath: 'circle(50%)', WebkitClipPath: 'circle(50%)',
                }}>
                  <div className="orb-blob orb-blob-1" />
                  <div className="orb-blob orb-blob-2" />
                  <div className="orb-blob orb-blob-3" />
                  <div className="orb-blob orb-blob-4" />
                  {/* Inner breathing glow */}
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'radial-gradient(circle at 38% 32%, rgba(255,220,180,0.35) 0%, transparent 55%)',
                    animation: 'orbInnerGlow 4s ease-in-out infinite',
                    pointerEvents: 'none',
                  }} />
                  {image && (
                    <img src={image} alt="" style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      display: 'block', borderRadius: '50%', position: 'relative', zIndex: 1,
                    }} />
                  )}
                </div>
              </div>
            </div>

            {/* Alternating hint text */}
            <div style={{
              height: 30, overflow: 'hidden', position: 'relative',
              marginBottom: 16,
            }}>
              <div className="orb-hint-slider">
                <p className="orb-hint-text">당신의 피부를 기록해보세요.</p>
                <p className="orb-hint-text">탭을 눌러 스캔하기</p>
                <p className="orb-hint-text">당신의 피부를 기록해보세요.</p>
              </div>
            </div>
            <p style={{ fontSize: 13, fontWeight: 300, color: '#aaa', margin: '0 0 16px', letterSpacing: -0.2 }}>AI가 10개 지표를 정밀 분석합니다.</p>

            {/* Condition tags */}
            <div style={{ display: 'flex', gap: 8, marginTop: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['정면 셀카', '밝은 자연광', '맨 얼굴'].map(tag => (
                <span key={tag} style={{
                  fontSize: 11, fontWeight: 500, color: '#B8977E',
                  background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.45)',
                  boxShadow: '0 4px 14px rgba(160,130,100,0.2), inset 0 1px 1px rgba(255,255,255,0.5)',
                  borderRadius: 50, padding: '4px 10px', letterSpacing: -0.2,
                }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* bottom spacing */}
          <div style={{ height: 20 }} />
        </div>
      )}

      {/* ===== CAMERA CAPTURE ===== */}
      {stage === 'camera' && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={reset}
          onFallback={() => { setStage('landing'); setTimeout(() => nativeCameraRef.current?.click(), 100); }}
        />
      )}

      {/* ===== UPLOAD PREVIEW ===== */}
      {stage === 'upload' && (
        <div style={{ background: '#FAFAFA', padding: '24px 24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button onClick={reset} style={{
            alignSelf: 'flex-start', marginBottom: 147,
            width: 38, height: 38, borderRadius: '50%', border: 'none',
            background: 'rgba(210,170,150,0.15)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#A89890',
          }}>←</button>
          <div style={{
            width: 300, height: 300, borderRadius: '50%', overflow: 'hidden',
            border: '3px solid rgba(255,255,255,0.7)',
            boxShadow: '0 10px 40px rgba(150,120,100,0.5), inset 0 1px 2px rgba(255,255,255,0.4)',
            position: 'relative',
          }}>
            <img src={image} alt="selfie" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.4))', borderRadius: '50%' }} />
          </div>
          {photoQuality && !photoQuality.passed && (
            <div style={{
              margin: '16px 0 0', padding: '10px 16px', width: '100%', maxWidth: 320,
              background: 'rgba(255,243,224,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,224,178,0.5)', borderRadius: 16,
            }}>
              <div style={{ fontSize: 12, color: '#BF360C', lineHeight: 1.5 }}>
                {photoQuality.issues.includes('too_dark') && <span>사진이 너무 어두워요. 밝은 곳에서 다시 촬영하면 더 정확해요.<br/></span>}
                {photoQuality.issues.includes('too_bright') && <span>사진이 너무 밝아요. 직사광선을 피해서 촬영해보세요.<br/></span>}
                {photoQuality.issues.includes('blurry') && <span>사진이 흐릿해요. 카메라를 고정하고 다시 촬영해보세요.</span>}
              </div>
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 3, letterSpacing: -0.3 }}>이 사진으로 분석할까요?</p>
            <p style={{ fontSize: 11, color: '#C4A08A' }}>{imageSize}</p>
          </div>
          <div style={{ padding: '60px 20px', width: '100%' }}>
            <button onClick={startAnalysis} style={{
              marginBottom: 12, width: '100%', padding: 12, borderRadius: 50,
              border: '1px solid rgba(255,255,255,0.5)',
              background: 'linear-gradient(135deg, #FFB878, #FF6B4A, #FF3D7F)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 4px 20px rgba(255,100,100,0.3), inset 0 1px 2px rgba(255,255,255,0.4)',
              color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}><span style={{marginRight:6,fontSize:21,verticalAlign:'middle'}}>🪄</span>AI 피부 분석 시작</button>
            <button onClick={() => fileRef.current?.click()} style={{
              width: '100%', padding: 10, borderRadius: 50,
              background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.5)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.04), inset 0 1px 2px rgba(255,255,255,0.4)',
              color: '#A89890', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}><span style={{marginRight:6,fontSize:21,verticalAlign:'middle'}}>🖼️</span>다른 사진 선택</button>
          </div>
        </div>
      )}

      {/* ===== ANALYZING ===== */}
      {stage === 'analyzing' && (
        <div style={{
          minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 40,
          background: '#FAFAFA',
        }}>
          <div style={{ position: 'relative', marginBottom: 40 }}>
            {/* Blob aura behind the photo */}
            <div className="voice-orb" style={{
              position: 'absolute',
              width: 360, height: 360,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              overflow: 'hidden',
              mask: 'radial-gradient(circle, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 70%)',
              WebkitMask: 'radial-gradient(circle, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 70%)',
              animation: 'analyzingBreatheCenter 3s ease-in-out infinite',
            }}>
              <div className="orb-blob orb-blob-1" style={{ animationDuration: '3.5s' }} />
              <div className="orb-blob orb-blob-2" style={{ animationDuration: '4s' }} />
              <div className="orb-blob orb-blob-3" style={{ animationDuration: '3s' }} />
              <div className="orb-blob orb-blob-4" style={{ animationDuration: '4.5s' }} />
            </div>
            {/* Photo circle */}
            <div style={{
              width: 220, height: 220, borderRadius: '50%', overflow: 'hidden',
              border: '3px solid rgba(255,255,255,0.7)',
              boxShadow: '0 8px 32px rgba(180,160,130,0.15)',
              position: 'relative', zIndex: 1,
            }}>
              {image ? (
                <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  background: '#FFF8F2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44,
                }}>✨</div>
              )}
            </div>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: '#1a1a1a', letterSpacing: -0.3 }}>
            피부 분석중
          </h2>
          <p style={{ fontSize: 14, fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: '#C4A08A', margin: '8px 0 32px' }}>
            수분 · 탄력 · 피부결을 분석하고 있어요
          </p>

          <div style={{ width: '100%', maxWidth: 280 }}>
            <div style={{
              height: 6, borderRadius: 3,
              background: 'rgba(200,170,150,0.15)', overflow: 'hidden', marginBottom: 12,
            }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: 'linear-gradient(90deg, #FFB878, #FF6B4A, #FF3D7F)',
                width: `${Math.min(progress, 100)}%`,
                transition: 'width 0.4s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#A89890' }}>
              <span>{getProgressText(progress)}</span>
              <span>{Math.round(Math.min(progress, 99))}%</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== RESULT ===== */}
      {stage === 'result' && result && (
        <div style={{ minHeight: '100dvh', background: 'linear-gradient(160deg, #fdf5ef 0%, #f8ede3 50%, #f3e6da 100%)' }}>

          {/* ═══════ Photo Hero ═══════ */}
          <div style={{
            position: 'relative', width: '100%', height: 430,
            background: 'linear-gradient(180deg, #fef5ed 0%, #fce8d8 60%, #f8dcc8 100%)',
            overflow: 'hidden',
          }}>
            {/* Nav */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              padding: '48px 20px 0', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
              animation: 'fadeUp 0.5s ease-out',
            }}>
              <button onClick={reset} style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'rgba(232,132,92,0.9)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(232,132,92,0.3)',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <button onClick={handleShare} style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'rgba(232,132,92,0.9)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(232,132,92,0.3)', fontSize: 16,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </button>
            </div>

            {/* Face photo */}
            <div ref={photoContainerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', animation: 'fadeUp 0.6s ease-out 0.1s both' }}>
              {image ? (
                <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #fce4d6 0%, #f2c8a8 50%, #eab896 100%)' }} />
              )}
              {/* Face Mesh Overlay */}
              {faceMesh && (() => {
                const { points: m, width: vw, height: vh } = faceMesh;
                const poly = (indices) => indices.map(i => `${m[i].x},${m[i].y}`).join(' ');
                // MediaPipe 468 contour groups
                const contours = [
                  [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10], // face oval
                  [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,33], // left eye
                  [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398,362], // right eye
                  [46,53,52,65,55,70,63,105,66,107], // left eyebrow
                  [276,283,282,295,285,300,293,334,296,336], // right eyebrow
                  [168,6,197,195,5,4,1,19], // nose bridge
                  [98,97,2,326,327], // nose bottom
                  [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185,61], // outer lips
                  [78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191,78], // inner lips
                ];
                // Key landmark indices for dots (contour points + extra cheek/forehead)
                const dotIndices = [...new Set(contours.flat().concat(
                  [1,2,4,5,6,10,21,33,37,39,46,52,54,55,58,61,63,65,66,67,70,78,80,84,87,91,93,95,97,98,103,105,107,109,127,
                   132,133,136,144,145,146,148,149,150,152,153,154,155,157,158,159,160,161,162,163,168,172,173,176,178,181,185,191,
                   195,197,234,246,249,251,263,267,269,270,276,282,283,284,285,288,291,293,295,296,297,300,308,310,311,312,314,317,
                   318,321,323,324,326,327,332,334,336,338,356,361,362,365,373,374,375,377,378,379,380,381,382,384,385,386,387,388,
                   389,390,397,398,400,405,409,454,466,
                   // extra cheek/forehead points
                   8,9,151,10,109,108,69,104,68,71,139,34,227,137,123,116,117,118,119,120,121,
                   348,347,346,345,344,343,256,253,252,257,258,259,260,261,448,449,450,451,452,453]
                ))];
                return (
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                    viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none" fill="none">
                    {/* Contour lines */}
                    {contours.map((group, gi) => (
                      <polyline key={`line-${gi}`} points={poly(group)}
                        stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none"
                        style={{ animation: `fadeUp 0.8s ease-out ${1.0 + gi * 0.06}s both` }} />
                    ))}
                    {/* Landmark dots */}
                    {dotIndices.map((idx, i) => m[idx] && (
                      <circle key={`dot-${idx}`} cx={m[idx].x} cy={m[idx].y} r="2"
                        fill="rgba(255,255,255,0.65)" stroke="rgba(255,255,255,0.85)" strokeWidth="0.5"
                        style={{ animation: `popIn 0.3s ease-out ${0.4 + i * 0.008}s both` }} />
                    ))}
                  </svg>
                );
              })()}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.15))' }} />
            </div>

            {/* Floating metric labels */}
            {[
              { text: '유분존: ', val: `${result.oilBalance}%`, c: result.oilBalance >= 45 && result.oilBalance <= 65 ? '#4ecb71' : '#e8845c', pos: { left: 12, top: 148 } },
              { text: '수분: ', val: result.moisture >= 60 ? '정상' : '낮음', c: result.moisture >= 60 ? '#4ecb71' : '#e8845c', pos: { left: 12, bottom: 80 } },
              { text: '트러블: ', val: `${result.troubleCount}개`, c: result.troubleCount <= 3 ? '#4ecb71' : '#f06050', pos: { right: 12, bottom: 110 } },
            ].map((l, i) => (
              <div key={i} style={{
                position: 'absolute', ...l.pos, zIndex: 8,
                background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                borderRadius: 50, padding: '7px 16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
                animation: `popIn 0.5s ease-out ${0.8 + i * 0.12}s both`,
              }}>
                <span style={{ fontSize: 12.5, color: '#5a4a3a', fontWeight: 500 }}>
                  {l.text}<span style={{ color: l.c, fontWeight: 600 }}>{l.val}</span>
                </span>
              </div>
            ))}
          </div>

          {/* ═══════ Bottom Sheet ═══════ */}
          <div style={{
            position: 'relative',
            background: 'linear-gradient(180deg, #fefcfa 0%, #faf6f1 100%)',
            borderRadius: '28px 28px 0 0',
            marginTop: -28, padding: '0 22px 28px', zIndex: 5,
            boxShadow: '0 -8px 30px rgba(120,90,60,0.06)',
            animation: 'slideUp 0.6s ease-out 0.4s both',
          }}>
            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 20px' }}>
              <div style={{ width: 40, height: 5, borderRadius: 3, background: 'rgba(180,165,148,0.3)' }} />
            </div>

            {/* ── Header: 피부 컨디션 + 피부 나이 + 종합점수 ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 18, animation: 'fadeUp 0.5s ease-out 0.6s both',
            }}>
              <div>
                <span style={{ fontSize: 12, color: '#e8845c', fontWeight: 600, letterSpacing: 0.3 }}>분석 완료</span>
                <h2 style={{ fontSize: 22, fontWeight: 600, fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: '#2d2520', margin: '4px 0 4px', letterSpacing: -0.3 }}>피부 컨디션</h2>
                <span style={{ fontSize: 12, color: '#b8a594', fontWeight: 300 }}>
                  {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, animation: 'popIn 0.5s ease-out 0.8s both' }}>
                {/* Skin Age compact card */}
                <div onClick={() => openDetail('skinAge')} style={{
                  width: 72, height: 72, borderRadius: 14,
                  background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 26, fontWeight: 650, color: '#e8845c', lineHeight: 1, fontFamily: "'Outfit', sans-serif" }}>
                    <AnimatedNumber target={result.skinAge} />
                  </span>
                  <span style={{ fontSize: 10, color: '#b8896e', fontWeight: 500, marginTop: 2 }}>피부 나이</span>
                  {changes && changes.skinAge.diff !== 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: changes.skinAge.improved ? '#4ecb71' : '#f06050', marginTop: 1 }}>
                      {changes.skinAge.diff < 0 ? '▼' : '▲'}{Math.abs(changes.skinAge.diff)}
                    </span>
                  )}
                </div>
                {/* Overall Score compact card with gauge */}
                <div style={{
                  width: 72, height: 72, borderRadius: 14,
                  background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.6)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.8)',
                  position: 'relative',
                }}>
                  {/* Mini circular gauge */}
                  <svg width={68} height={68} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                    <defs>
                      <linearGradient id="miniGauge" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f5a623" />
                        <stop offset="100%" stopColor="#f06050" />
                      </linearGradient>
                    </defs>
                    <circle cx={34} cy={34} r={28} fill="none" stroke="rgba(220,210,200,0.25)" strokeWidth={5} />
                    <circle cx={34} cy={34} r={28} fill="none" stroke="url(#miniGauge)" strokeWidth={5}
                      strokeDasharray={175.9} strokeDashoffset={175.9 - (result.overallScore / 100) * 175.9}
                      strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
                  </svg>
                  <span style={{ fontSize: 26, fontWeight: 650, color: '#e8845c', lineHeight: 1, fontFamily: "'Outfit', sans-serif", zIndex: 1 }}>
                    <AnimatedNumber target={result.overallScore} />
                  </span>
                  <span style={{ fontSize: 9, color: '#b8896e', fontWeight: 500, marginTop: 1, zIndex: 1 }}>종합점수</span>
                  {changes && changes.overallScore.diff !== 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: changes.overallScore.improved ? '#4ecb71' : '#f06050', zIndex: 1 }}>
                      {changes.overallScore.diff > 0 ? '+' : ''}{changes.overallScore.diff}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Save & Share ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, animation: 'fadeUp 0.5s ease-out 0.7s both' }}>
              <button onClick={handleSave} disabled={saved} style={{
                flex: 1, padding: '12px 0', borderRadius: 50, border: 'none', fontSize: 14, fontWeight: 700,
                cursor: saved ? 'default' : 'pointer', fontFamily: 'inherit',
                background: saved ? 'rgba(200,230,200,0.5)' : 'linear-gradient(135deg, #FFB878, #FF6B4A, #FF3D7F)',
                color: saved ? '#4ecb71' : '#fff',
                boxShadow: saved ? 'none' : '0 4px 16px rgba(255,100,100,0.2)',
              }}>
                {saved ? '✅ 저장 완료' : '💾 기록 저장'}
              </button>
              <button onClick={handleShare} style={{
                padding: '12px 20px', borderRadius: 50, fontFamily: 'inherit',
                background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.6)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                color: '#5a4a3a', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>📤 공유</button>
            </div>

            {/* ── Skin Info glass card ── */}
            <div className="glass-card" style={{ padding: '4px 0', animation: 'fadeUp 0.5s ease-out 0.85s both' }}>
              {/* Skin type */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15 }}>🧬</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#3d3328' }}>피부 타입</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#2d2520', fontFamily: "'Outfit', sans-serif" }}>{result.skinType}</span>
              </div>
              {/* Analysis Mode */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15 }}>{result.analysisMode === 'hybrid' ? '🧠' : '📊'}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#3d3328' }}>분석 모드</span>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, fontFamily: "'Outfit', sans-serif",
                  color: result.analysisMode === 'hybrid' ? '#7C4DFF' : '#b8896e',
                  background: result.analysisMode === 'hybrid' ? 'rgba(124,77,255,0.1)' : 'rgba(184,137,110,0.1)',
                  padding: '3px 10px', borderRadius: 10,
                }}>{result.analysisMode === 'hybrid' ? 'AI + CV 하이브리드' : 'CV 비전 분석'}</span>
              </div>
              {/* Confidence */}
              {result.confidence != null && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 15 }}>📊</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#3d3328' }}>측정 신뢰도</span>
                  </div>
                  <span style={{
                    fontSize: 14, fontWeight: 700, fontFamily: "'Outfit', sans-serif",
                    color: result.confidence >= 70 ? '#4ecb71' : result.confidence >= 50 ? '#d4900a' : '#f06050',
                  }}>{result.confidence}%</span>
                </div>
              )}
              {/* Concerns */}
              <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15 }}>⚡</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#3d3328' }}>관심 사항</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto' }}>
                  {result.concerns?.map((concern, i) => (
                    <span key={i} style={{
                      fontSize: 11.5, fontWeight: 500,
                      color: i === 0 ? '#e05545' : '#d4900a',
                      background: i === 0 ? 'rgba(240,96,80,0.1)' : 'rgba(245,166,35,0.1)',
                      border: `1px solid ${i === 0 ? 'rgba(240,96,80,0.18)' : 'rgba(245,166,35,0.18)'}`,
                      padding: '4px 12px', borderRadius: 20,
                    }}>{concern}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── GROUP 1: Condition Metrics ── */}
            <div className="glass-card" style={{ padding: '18px 10px', animation: 'fadeUp 0.5s ease-out 0.95s both' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, paddingLeft: 8, color: '#2d2520' }}>컨디션 지표 <span style={{ fontSize: 11, color: '#b8a594', fontWeight: 400 }}>일상 관리 포인트</span></div>
              <div style={{ fontSize: 10, color: '#c4b5a0', paddingLeft: 8, marginBottom: 14 }}>탭하면 과학적 근거</div>
              <MetricBar label="다크서클" value={result.darkCircleScore} unit="점" icon="👁️" color="#78909C"
                description={result.darkCircleScore >= 70 ? '눈 밑 밝음' : result.darkCircleScore >= 45 ? '아이크림 추천' : '다크서클 집중 관리'}
                onClick={() => openDetail('darkCircles')} />
              <MetricBar label="수분도" value={result.moisture} unit="%" icon="💧" color="#4FC3F7" delay={60}
                description={result.moisture >= 60 ? '정상 범위' : '보습 강화 필요'}
                onClick={() => openDetail('moisture')} />
              <MetricBar label="피부톤" value={result.skinTone} unit="점" icon="✨" color="#FFB347" delay={120}
                description={result.skinTone >= 70 ? '균일하고 밝은 톤' : '색소 관리 추천'}
                onClick={() => openDetail('skinTone')} />
              <MetricBar label="유분" value={result.oilBalance} unit="%" icon="🫧" color="#81C784" delay={180}
                description={result.oilBalance >= 45 && result.oilBalance <= 65 ? '균형 상태' : result.oilBalance > 65 ? '유분 조절 필요' : '유분 보충 필요'}
                onClick={() => openDetail('oilBalance')} />
              <MetricBar label="트러블" value={Math.max(0, 100 - result.troubleCount * 8.5)} unit="점" icon="🎯" color="#FF8A65" delay={240}
                description={`${result.troubleCount}개 | ${result.troubleCount <= 2 ? '깨끗' : result.troubleCount <= 5 ? '경증' : '집중관리'}`}
                onClick={() => openDetail('trouble')} />
            </div>

            {/* ── GROUP 2: Aging Metrics ── */}
            <div className="glass-card" style={{ padding: '18px 10px', animation: 'fadeUp 0.5s ease-out 1.05s both' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, paddingLeft: 8, color: '#2d2520' }}>노화 지표 <span style={{ fontSize: 11, color: '#b8a594', fontWeight: 400 }}>피부 나이에 큰 영향</span></div>
              <MetricBar label="주름" value={result.wrinkleScore} unit="점" icon="📐" color="#9575CD"
                description={result.wrinkleScore >= 75 ? '매끄러운 피부' : result.wrinkleScore >= 50 ? '잔주름 관리 추천' : '주름 집중 관리 필요'}
                onClick={() => openDetail('wrinkles')} />
              <MetricBar label="탄력" value={result.elasticityScore} unit="점" icon="💎" color="#F06292" delay={60}
                description={result.elasticityScore >= 70 ? '턱선 선명' : result.elasticityScore >= 45 ? '탄력 관리 시작' : '탄력 집중 케어 필요'}
                onClick={() => openDetail('elasticity')} />
              <MetricBar label="피부결" value={result.textureScore} unit="점" icon="🧴" color="#7986CB" delay={120}
                description={result.textureScore >= 70 ? '매끈한 피부' : result.textureScore >= 45 ? '각질 케어 추천' : '피부결 집중 관리 필요'}
                onClick={() => openDetail('texture')} />
              <MetricBar label="모공" value={result.poreScore} unit="점" icon="🔬" color="#4DB6AC" delay={180}
                description={result.poreScore >= 70 ? '미세 모공' : result.poreScore >= 45 ? '모공 축소 관리' : '넓은 모공 관리 필요'}
                onClick={() => openDetail('pores')} />
              <MetricBar label="색소" value={result.pigmentationScore} unit="점" icon="🎨" color="#A1887F" delay={240}
                description={result.pigmentationScore >= 70 ? '맑은 피부' : result.pigmentationScore >= 45 ? '미백 관리 추천' : '색소 집중 관리 필요'}
                onClick={() => openDetail('pigmentation')} />
            </div>

            {/* ── AI Coach ── */}
            <div className="glass-card" style={{ animation: 'fadeUp 0.5s ease-out 1.15s both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <defs><linearGradient id="gbulb" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#FFD060"/><stop offset="100%" stopColor="#FF82AA"/></linearGradient></defs>
                  <path d="M9 21h6M12 3a6 6 0 014 10.5V17a1 1 0 01-1 1H9a1 1 0 01-1-1v-3.5A6 6 0 0112 3z" stroke="url(#gbulb)" strokeWidth="1.8" fill="url(#gbulb)" fillOpacity="0.15"/>
                </svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#e8845c' }}>NOU AI 코치</span>
              </div>
              <p style={{ fontSize: 14, color: '#5a4a3a', lineHeight: 1.75 }}>{result.advice}</p>
              {result.aiNotes && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(124,77,255,0.06), rgba(255,140,66,0.06))',
                  border: '1px solid rgba(124,77,255,0.1)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#7C4DFF', marginBottom: 4 }}>AI 정밀 판독</div>
                  <p style={{ fontSize: 13, color: '#5a4a3a', lineHeight: 1.7, margin: 0 }}>{result.aiNotes}</p>
                </div>
              )}
            </div>

            {/* ── Re-measure ── */}
            {!saved && (
              <button onClick={handleSave} style={{
                marginBottom: 10, width: '100%', padding: 14, borderRadius: 50, border: 'none',
                background: 'linear-gradient(135deg, #FFB878, #FF6B4A, #FF3D7F)',
                boxShadow: '0 6px 24px rgba(255,130,150,0.35), inset 0 1px 2px rgba(255,255,255,0.4)',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                animation: 'fadeUp 0.5s ease-out 1.35s both',
              }}>💾 이 결과 기록하기</button>
            )}
            <button onClick={reset} style={{
              width: '100%', padding: 14, borderRadius: 50, fontFamily: 'inherit',
              background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.6)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              color: '#5a4a3a', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              animation: 'fadeUp 0.5s ease-out 1.4s both',
            }}>🔄 다시 측정하기</button>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#b8a594', marginTop: 14, marginBottom: 0 }}>
              AI 추정치이며 의료 진단이 아닙니다 · NOU © 2026
            </p>
            {/* Tab bar spacer for result page */}
            <div className="tab-bar-spacer" />
          </div>
        </div>
      )}

      </>}
      {/* End of home tab wrapper */}

      {/* Tab bar spacer for pages that show tab bar */}
      {showTabBar && activeTab !== 'home' && <div className="tab-bar-spacer" />}
      {showTabBar && activeTab === 'home' && stage === 'landing' && <div className="tab-bar-spacer" />}

      {/* ===== TAB BAR ===== */}
      {showTabBar && <TabBar activeTab={activeTab} onTabChange={switchTab} onMeasure={openCamera} />}
    </div>
  );
}

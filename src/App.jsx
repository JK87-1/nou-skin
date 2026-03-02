import { useState, useRef, useCallback, useEffect } from 'react';
import GlobalStyles from './design/GlobalStyles';
import { compressImage, analyzePixels, pixelsToScores, generateDemoScores, checkPhotoQuality, generateSmartAdvice } from './engine/PixelAnalysis';
import { detectLandmarks } from './engine/FaceLandmarker';
import { callVisionAI, hybridMerge, hasBaseline } from './engine/HybridAnalysis';
import { estimateAge, preload as preloadAge } from './engine/FaceAgeEstimator';
import { preload as preloadLandmarker } from './engine/FaceLandmarker';
import { AnimatedNumber, ScoreRing, MetricBar, Tag, DetailPage } from './components/UIComponents';
import CameraCapture from './components/CameraCapture';
import { saveRecord, getRecords, getStreak, getNextMeasurementInfo, getChanges, generateShareText, getLatestRecord, hasTodayRecord, saveThumbnail, saveComparisonPhoto, getTodayRecords, getStableSkinAge } from './storage/SkinStorage';
import { migrateFromLocalStorage } from './storage/PhotoDB';
import HistoryPage from './pages/HistoryPage';
import TabBar from './components/TabBar';
import MyPage from './pages/MyPage';
// RoutinePage removed — tab restructuring
import SkinScoreCircle from './components/SkinScoreCircle';
import AiInsightCard from './components/AiInsightCard';
import SkinConsultant from './components/SkinConsultant';
import InstallBanner from './components/InstallBanner';
import { CATEGORY_META, getProductsByCategory, getWeakestCategories, calcMatchScore } from './data/ProductCatalog';
import { syncSkinDataToServer } from './utils/pushNotification';
import { getProfile, getDeviceId } from './storage/ProfileStorage';
import GoalProgressCard from './components/GoalProgressCard';
import SkinWeather from './components/SkinWeather';
import { getGoal, updateGoalProgress } from './storage/GoalStorage';
import { addXP, checkAndAwardBadges, incrementStat } from './storage/BadgeStorage';
import { BadgeCelebration } from './components/BadgeRanking';
import SplashScreen from './components/SplashScreen';
import AuraPearl from './components/icons/AuraPearl';

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
  const [showMigration, setShowMigration] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [conditionBriefing, setConditionBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [celebrateBadge, setCelebrateBadge] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);

  // Local fallback briefing when API fails
  const generateLocalBriefing = useCallback((scores) => {
    const s = scores || {};
    const score = s.conditionScore ?? s.overallScore ?? 50;
    const hour = new Date().getHours();
    const time = hour < 6 ? '새벽' : hour < 11 ? '아침' : hour < 14 ? '점심' : hour < 18 ? '오후' : hour < 22 ? '저녁' : '밤';

    const strengths = [];
    const concerns = [];
    if ((s.moisture ?? 50) >= 60) strengths.push('수분감이 잘 유지되고 있어요');
    else if ((s.moisture ?? 50) < 45) concerns.push('수분이 부족한 편이니 보습에 신경 써주세요');
    if ((s.skinTone ?? 50) >= 65) strengths.push('피부톤이 맑고 균일해요');
    if ((s.elasticityScore ?? 50) >= 65) strengths.push('탄력이 좋은 편이에요');
    if ((s.darkCircleScore ?? 50) < 50) concerns.push('눈 밑 다크서클에 카페인 아이크림을 추천드려요');
    if ((s.textureScore ?? 50) >= 65) strengths.push('피부결이 매끈해요');

    let text = '';
    if (score >= 75) {
      text = `${time} 컨디션이 좋은 편이에요. ${strengths[0] || '전체적으로 안정적인 상태예요'}. `;
      text += concerns.length > 0 ? concerns[0] + '.' : '현재 루틴을 잘 유지해주세요.';
    } else if (score >= 55) {
      text = `오늘 피부 상태는 괜찮은 편이에요. ${strengths[0] ? strengths[0] + ', ' : ''}${concerns[0] || '꾸준한 관리가 빛을 발하고 있어요'}. `;
      text += '저녁 세안 후 충분한 보습을 챙겨주세요.';
    } else {
      text = `피부가 조금 지쳐 보이지만 걱정 마세요. ${concerns[0] || '충분한 수면과 수분 섭취가 가장 중요해요'}. `;
      text += '오늘 저녁 집중 보습 케어를 해주면 내일 달라질 거예요.';
    }
    return text;
  }, []);

  useEffect(() => {
    if (showSplash) {
      const t = setTimeout(() => setSplashExiting(true), 1500);
      return () => clearTimeout(t);
    }
  }, [showSplash]);

  useEffect(() => {
    refreshLandingData();
    // Migrate localStorage thumbnails to IndexedDB (one-time)
    migrateFromLocalStorage();
    // Eagerly preload ML models in background so camera opens faster
    preloadLandmarker();
    preloadAge();
    // Show migration notice in standalone (PWA) mode with no data
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone && getRecords().length === 0 && !localStorage.getItem('nou_migration_dismissed')) {
      setShowMigration(true);
    }
    // Handle push notification deep link (?scan=1)
    const params = new URLSearchParams(window.location.search);
    if (params.get('scan') === '1') {
      setActiveTab('home');
      setStage('camera');
      window.history.replaceState({}, '', '/');
    }
    // PWA: force reload when new service worker takes control
    if ('serviceWorker' in navigator) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
      navigator.serviceWorker.ready.then(reg => reg.update());
    }
  }, []);

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
      const quality = await checkPhotoQuality(original, lm);
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
    const quality = await checkPhotoQuality(dataUrl, lm);
    setPhotoQuality(quality);
    setStage('upload');
  }, []);

  const startAnalysis = useCallback(async () => {
    if (!pixelData) return;
    setStage('analyzing'); setProgress(0); setSaved(false); setConditionBriefing(null); setBriefingLoading(false);
    const pi = setInterval(() => { setProgress(p => { if (p >= 90) { clearInterval(pi); return 90; } return p + Math.random() * 8 + 2; }); }, 450);

    // CV scoring (with mlAge from FaceAgeEstimator)
    const cvScores = pixelsToScores(pixelData, mlAge);

    // AI scoring (baseline image comparison handled internally)
    let finalScores = cvScores;
    try {
      if (b64) {
        const aiScores = await callVisionAI(b64, landmarks);
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

    // Regenerate advice with final scores + change trends
    const currentChanges = getChanges();
    finalScores.advice = generateSmartAdvice(finalScores, currentChanges);

    console.log('[Score Debug] overallScore:', finalScores.overallScore, 'conditionScore:', finalScores.conditionScore, 'mode:', finalScores.analysisMode);

    clearInterval(pi); setProgress(100);
    setTimeout(() => {
      // Get previous record before saving (for briefing comparison)
      const prevRecord = getLatestRecord();
      const todayBefore = getTodayRecords();

      // Set result + immediately show local condition briefing (guaranteed)
      setConditionBriefing(generateLocalBriefing(finalScores));
      setBriefingLoading(false);
      setResult(finalScores); setStage('result');

      // Try to upgrade with AI briefing in background
      fetch('/api/condition-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current: { ...finalScores, conditionScore: finalScores.conditionScore ?? finalScores.overallScore },
          previous: prevRecord || null,
          skinType: finalScores.skinType,
          todayCount: todayBefore.length + 1,
          stableSkinAge: getStableSkinAge(),
        }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.briefing) setConditionBriefing(data.briefing); })
        .catch(() => {});

      // Auto-save record and thumbnail
      const ok = saveRecord(finalScores);
      if (ok) {
        setSaved(true);
        setShowSaveToast(true);
        setTimeout(() => setShowSaveToast(false), 2500);
        if (image) {
          const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
          saveThumbnail(today, image);
          saveComparisonPhoto(image);
        }
        // Update goal progress
        const goalResult = updateGoalProgress(finalScores);
        // Sync skin data to server for personalized push tips
        const prof = getProfile();
        if (prof.tipEnabled || prof.reminderEnabled) {
          const activeGoal = getGoal();
          const goalMetrics = activeGoal?.status === 'active'
            ? activeGoal.metrics.map((m) => m.key)
            : null;
          syncSkinDataToServer(finalScores, prof, goalMetrics).catch(() => {});
        }
        if (goalResult.achieved) {
          setTimeout(() => setShowCelebration(true), 1200);
        }
        // Badge & XP: measurement completed
        addXP(50, '피부 측정 완료');
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 5) incrementStat('nightMeasure');
        const badgeResult = checkAndAwardBadges();
        if (badgeResult.newBadges.length > 0) {
          setTimeout(() => setCelebrateBadge(badgeResult.newBadges[0]), 1500);
        }
        // Submit score to ranking server
        fetch('/api/ranking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: getDeviceId(),
            nickname: prof.nickname || '사용자',
            score: finalScores.overallScore,
            xp: getTotalXP(),
            level: getLevel(),
          }),
        }).catch(() => {});
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
        scores.advice = generateSmartAdvice(scores, getChanges());
        // Set local briefing immediately (guaranteed) + try AI upgrade
        const prevRecord = getLatestRecord();
        const todayBefore = getTodayRecords();
        setConditionBriefing(generateLocalBriefing(scores));
        setBriefingLoading(false);
        setResult(scores); setStage('result');

        fetch('/api/condition-briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current: { ...scores, conditionScore: scores.conditionScore ?? scores.overallScore },
            previous: prevRecord || null,
            skinType: scores.skinType,
            todayCount: todayBefore.length + 1,
            stableSkinAge: getStableSkinAge(),
          }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data?.briefing) setConditionBriefing(data.briefing); })
          .catch(() => {});

        // Auto-save demo results
        const ok = saveRecord(scores);
        if (ok) {
          setSaved(true);
          setShowSaveToast(true);
          setTimeout(() => setShowSaveToast(false), 2500);
          updateGoalProgress(scores);
          addXP(50, '피부 측정 완료');
          const badgeResult = checkAndAwardBadges();
          if (badgeResult.newBadges.length > 0) {
            setTimeout(() => setCelebrateBadge(badgeResult.newBadges[0]), 1500);
          }
          // Submit score to ranking server
          const prof = getProfile();
          fetch('/api/ranking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId: getDeviceId(),
              nickname: prof.nickname || '사용자',
              score: scores.overallScore,
              xp: getTotalXP(),
              level: getLevel(),
            }),
          }).catch(() => {});
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
    incrementStat('shareCount');
    checkAndAwardBadges();
    if (navigator.share) { navigator.share({ title: 'LUA 피부 나이', text }).catch(() => {}); }
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

  const getProgressTip = (p) => {
    if (p < 25) return '사진은 내 기기에만 안전하게 저장돼요';
    if (p < 50) return '11가지 피부 지표를 정밀 분석 중이에요';
    if (p < 75) return '같은 조명에서 찍으면 더 정확해져요';
    return '꾸준한 기록이 피부 변화의 시작이에요';
  };

  const changes = getChanges();

  const showTabBar = activeTab !== 'home' || stage === 'landing' || stage === 'result';

  return (
    <div className="app-container">
      <GlobalStyles />
      {showSplash && <SplashScreen exiting={splashExiting} onAnimationEnd={() => setShowSplash(false)} />}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      <input ref={nativeCameraRef} type="file" accept="image/*" capture="user" onChange={handleFile} style={{ display: 'none' }} />

      {/* Save Toast */}
      {showSaveToast && (
        <div style={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', background: 'rgba(167,139,250,0.9)', color: '#fff', padding: '10px 22px', borderRadius: 30, fontSize: 13, fontWeight: 600, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
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

      {/* ===== HISTORY PAGE (gallery + insights merged) ===== */}
      {activeTab === 'history' && (
        <HistoryPage onBack={goToLanding} onMeasure={openCamera} onOpenConsult={() => setActiveTab('consult')} />
      )}

      {/* ===== CONSULT TAB ===== */}
      {activeTab === 'consult' && (
        <SkinConsultant result={result || getLatestRecord()} isTab={true} />
      )}

      {/* ===== MY PAGE ===== */}
      {activeTab === 'my' && <MyPage />}

      {/* ===== HOME TAB (stage-based sub-flow) ===== */}
      {activeTab === 'home' && <>

      {/* ===== LANDING PAGE ===== */}
      {stage === 'landing' && (
        <div>
          {/* Migration Notice */}
          {showMigration && (
            <div style={{
              margin: '12px 16px 0', padding: '14px 18px',
              background: 'rgba(167,139,250,0.08)', borderRadius: 16,
              border: '1px solid rgba(167,139,250,0.15)',
              animation: 'fadeUp 0.4s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f5', marginBottom: 4 }}>Safari 기록을 가져올 수 있어요</div>
                  <div style={{ fontSize: 11, color: '#8888a0', lineHeight: 1.5 }}>
                    Safari에서 측정한 기록은 마이페이지 &gt; 데이터 내보내기로 백업 후, 이 앱에서 가져오기로 복원할 수 있어요.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => {
                      setShowMigration(false);
                      localStorage.setItem('nou_migration_dismissed', '1');
                    }} style={{
                      padding: '6px 14px', borderRadius: 10, border: 'none',
                      background: 'rgba(255,255,255,0.06)', color: '#8888a0',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    }}>닫기</button>
                    <button onClick={() => {
                      setShowMigration(false);
                      localStorage.setItem('nou_migration_dismissed', '1');
                      setActiveTab('my');
                    }} style={{
                      padding: '6px 14px', borderRadius: 10, border: 'none',
                      background: 'rgba(167,139,250,0.15)', color: '#818cf8',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>마이페이지로 이동</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* First screen — fills viewport so weather is below the fold */}
          <div style={{ minHeight: 'calc(100dvh - 72px)', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '60%', background: 'radial-gradient(ellipse at 80% 50%, rgba(167,139,250,0.06), transparent 50%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f0f0f5', marginBottom: 4 }}>
                {(() => { const h = new Date().getHours(); return h < 6 ? '편안한 밤이에요' : h < 12 ? '좋은 아침이에요' : h < 18 ? '좋은 오후예요' : '좋은 저녁이에요'; })()}
              </div>
              <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 6 }}>
                {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
              </div>
              <div>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#818cf8', letterSpacing: 6, paddingLeft: 4, fontFamily: "'Outfit', sans-serif" }}>LUA</span>
                <span style={{ fontSize: 10, color: '#818cf8', background: 'rgba(167,139,250,0.12)', padding: '2px 10px', borderRadius: 10, marginLeft: 8 }}>Beta</span>
              </div>
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <AuraPearl variant="living" size={44} animated />
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
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
                background: 'radial-gradient(circle, rgba(167,139,250,0.25) 0%, rgba(167,139,250,0.15) 15%, rgba(167,139,250,0.08) 30%, rgba(167,139,250,0.03) 50%, rgba(167,139,250,0.01) 70%, transparent 85%)',
                pointerEvents: 'none',
              }} />

              {/* Main orb with breathing */}
              <div style={{
                width: 226, height: 226, borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'orbBreathe 5s ease-in-out infinite',
                willChange: 'transform, box-shadow',
              }}>
                <div className="voice-orb" style={{
                  width: 220, height: 220, borderRadius: '50%',
                  background: '#1a1a25',
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
                    background: 'radial-gradient(circle at 38% 32%, rgba(167,139,250,0.2) 0%, transparent 55%)',
                    animation: 'orbInnerGlow 4s ease-in-out infinite',
                    pointerEvents: 'none',
                  }} />
                  {/* Photo removed — orb animation only on landing */}
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
            <p style={{ fontSize: 13, fontWeight: 300, color: '#8888a0', margin: '0 0 16px', letterSpacing: -0.2 }}>AI가 10개 지표를 정밀 분석합니다.</p>

            {/* Condition tags */}
            <div style={{ display: 'flex', gap: 8, marginTop: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['정면 셀카', '밝은 자연광', '맨 얼굴'].map(tag => (
                <span key={tag} style={{
                  fontSize: 11, fontWeight: 500, color: '#a78bfa',
                  background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)',
                  borderRadius: 50, padding: '4px 10px', letterSpacing: -0.2,
                }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* Goal Progress Card */}
          {getGoal()?.status === 'active' && (
            <div style={{ marginTop: 24 }}>
              <GoalProgressCard onTap={() => setActiveTab('my')} />
            </div>
          )}
          </div>{/* end first screen wrapper */}

          {/* Skin Weather — below the fold */}
          <div style={{ marginTop: 24 }}>
            <SkinWeather skinResult={getLatestRecord()} />
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
        <div style={{ background: '#111118', padding: '24px 24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button onClick={reset} style={{
            alignSelf: 'flex-start', marginBottom: 147,
            width: 38, height: 38, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.08)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#8888a0',
          }}>←</button>
          <div style={{
            width: 300, height: 300, borderRadius: '50%', overflow: 'hidden',
            border: '3px solid rgba(255,255,255,0.1)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05)',
            position: 'relative',
          }}>
            <img src={image} alt="selfie" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.4))', borderRadius: '50%' }} />
          </div>
          {photoQuality && !photoQuality.passed && (
            <div style={{
              margin: '16px 0 0', padding: '10px 16px', width: '100%', maxWidth: 320,
              background: !hasBaseline() ? 'rgba(220,38,38,0.15)' : 'rgba(245,158,11,0.1)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: `1px solid ${!hasBaseline() ? 'rgba(220,38,38,0.3)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 16,
            }}>
              <div style={{ fontSize: 12, color: '#BF360C', lineHeight: 1.5 }}>
                {!hasBaseline() && <span style={{ fontWeight: 700 }}>첫 분석은 기준이 되므로 좋은 사진이 필요해요!<br/></span>}
                {photoQuality.issues.includes('too_dark') && <span>사진이 너무 어두워요. 밝은 곳에서 다시 촬영하세요.<br/></span>}
                {photoQuality.issues.includes('too_bright') && <span>사진이 너무 밝아요. 직사광선을 피해서 촬영해보세요.<br/></span>}
                {photoQuality.issues.includes('blurry') && <span>사진이 흐릿해요. 카메라를 고정하고 다시 촬영해보세요.<br/></span>}
                {photoQuality.issues.includes('face_too_small') && <span>얼굴이 너무 작아요. 좀 더 가까이에서 촬영해보세요.<br/></span>}
                {photoQuality.issues.includes('no_face') && <span>얼굴을 인식하지 못했어요. 정면을 바라보고 다시 촬영해보세요.</span>}
              </div>
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f5', marginBottom: 3, letterSpacing: -0.3 }}>이 사진으로 분석할까요?</p>
            <p style={{ fontSize: 11, color: '#8888a0' }}>{imageSize}</p>
          </div>
          <div style={{ padding: '60px 20px', width: '100%' }}>
            {(() => {
              const isBlocked = !hasBaseline() && photoQuality && !photoQuality.passed;
              return <button onClick={isBlocked ? undefined : startAnalysis} disabled={isBlocked} style={{
                marginBottom: 12, width: '100%', padding: 12, borderRadius: 50,
                border: '1px solid rgba(255,255,255,0.08)',
                background: isBlocked
                  ? 'linear-gradient(135deg, #444, #333)'
                  : 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                boxShadow: isBlocked
                  ? 'none'
                  : '0 4px 20px rgba(167,139,250,0.35), inset 0 1px 1px rgba(255,255,255,0.05)',
                color: '#fff', fontSize: 16, fontWeight: 700,
                cursor: isBlocked ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: isBlocked ? 0.6 : 1,
              }}><span style={{marginRight:6,fontSize:21,verticalAlign:'middle'}}>{isBlocked ? '📷' : '🪄'}</span>{isBlocked ? '다시 촬영해주세요' : 'AI 피부 분석 시작'}</button>;
            })()}
            <button onClick={() => fileRef.current?.click()} style={{
              width: '100%', padding: 10, borderRadius: 50,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)',
              color: '#8888a0', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}><span style={{marginRight:6,fontSize:21,verticalAlign:'middle'}}>🖼️</span>다른 사진 선택</button>
          </div>
        </div>
      )}

      {/* ===== ANALYZING ===== */}
      {stage === 'analyzing' && (
        <div style={{
          minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 40,
          background: '#111118',
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
              border: '3px solid rgba(255,255,255,0.1)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              position: 'relative', zIndex: 1,
            }}>
              {image ? (
                <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  background: '#1a1a25',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44,
                }}>✨</div>
              )}
            </div>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: '#f0f0f5', letterSpacing: -0.3 }}>
            피부 분석중
          </h2>
          <p style={{ fontSize: 14, fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: '#8888a0', margin: '8px 0 32px' }}>
            수분 · 탄력 · 피부결을 분석하고 있어요
          </p>

          <div style={{ width: '100%', maxWidth: 280 }}>
            <div style={{
              height: 6, borderRadius: 3,
              background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 12,
            }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: 'linear-gradient(90deg, #6858a8, #9080c8, #a78bfa)',
                width: `${Math.min(progress, 100)}%`,
                transition: 'width 0.4s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8888a0' }}>
              <span>{getProgressText(progress)}</span>
              <span>{Math.round(Math.min(progress, 99))}%</span>
            </div>
          </div>

          {/* Tip message */}
          <p key={getProgressTip(progress)} style={{
            marginTop: 48, fontSize: 13, color: '#6b6b80', textAlign: 'center',
            letterSpacing: -0.2, lineHeight: 1.5,
            animation: 'fadeIn 0.6s ease',
          }}>
            {getProgressTip(progress)}
          </p>
        </div>
      )}

      {/* ===== RESULT ===== */}
      {stage === 'result' && result && (
        <div style={{ minHeight: '100dvh', background: '#111118' }}>

          {/* ═══════ Photo Hero ═══════ */}
          <div style={{
            position: 'relative', width: '100%', height: 430,
            background: 'linear-gradient(180deg, #16161e 0%, #1a1a25 60%, #111118 100%)',
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
                background: 'rgba(167,139,250,0.9)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(167,139,250,0.3)',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <button onClick={handleShare} style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'rgba(167,139,250,0.9)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(167,139,250,0.3)', fontSize: 16,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </button>
            </div>

            {/* Face photo */}
            <div ref={photoContainerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', animation: 'fadeUp 0.6s ease-out 0.1s both' }}>
              {image ? (
                <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #1a1a25 0%, #16161e 50%, #111118 100%)' }} />
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
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.3))' }} />
            </div>

            {/* Floating metric labels */}
            {[
              { text: '유분존: ', val: `${result.oilBalance}%`, c: result.oilBalance >= 45 && result.oilBalance <= 65 ? '#4ecb71' : '#a78bfa', pos: { left: 12, top: 148 } },
              { text: '수분: ', val: result.moisture >= 60 ? '정상' : '낮음', c: result.moisture >= 60 ? '#4ecb71' : '#a78bfa', pos: { left: 12, bottom: 80 } },
              { text: '트러블: ', val: `${result.troubleCount}개`, c: result.troubleCount <= 3 ? '#4ecb71' : '#f06050', pos: { right: 12, bottom: 110 } },
            ].map((l, i) => (
              <div key={i} style={{
                position: 'absolute', ...l.pos, zIndex: 8,
                background: 'rgba(30,30,40,0.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                borderRadius: 50, padding: '7px 16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                animation: `popIn 0.5s ease-out ${0.8 + i * 0.12}s both`,
              }}>
                <span style={{ fontSize: 12.5, color: '#e0e0e8', fontWeight: 500 }}>
                  {l.text}<span style={{ color: l.c, fontWeight: 600 }}>{l.val}</span>
                </span>
              </div>
            ))}
          </div>

          {/* ═══════ Bottom Sheet ═══════ */}
          <div style={{
            position: 'relative',
            background: 'linear-gradient(180deg, #16161e 0%, #111118 100%)',
            borderRadius: '28px 28px 0 0',
            marginTop: -28, padding: '0 22px 28px', zIndex: 5,
            boxShadow: '0 -8px 30px rgba(0,0,0,0.3)',
            animation: 'slideUp 0.6s ease-out 0.4s both',
          }}>
            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 20px' }}>
              <div style={{ width: 40, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.1)' }} />
            </div>

            {/* ── Header: 피부 컨디션 + 피부 나이 + 컨디션 + 측정횟수 ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 18, animation: 'fadeUp 0.5s ease-out 0.6s both',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -20, right: -30, zIndex: 0, opacity: 0.3, pointerEvents: 'none' }}>
                <AuraPearl variant="aurora" size={160} />
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, letterSpacing: 0.3 }}>분석 완료</span>
                <h2 style={{ fontSize: 22, fontWeight: 600, fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: '#f0f0f5', margin: '4px 0 4px', letterSpacing: -0.3 }}>피부 컨디션</h2>
                <span style={{ fontSize: 12, color: '#8888a0', fontWeight: 300 }}>
                  {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {' · '}
                  {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, animation: 'popIn 0.5s ease-out 0.8s both', position: 'relative', zIndex: 1 }}>
                {/* Stable Skin Age card */}
                <div onClick={() => openDetail('skinAge')} style={{
                  width: 66, height: 72, borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 24, fontWeight: 650, color: '#a78bfa', lineHeight: 1, fontFamily: "'Outfit', sans-serif" }}>
                    <AnimatedNumber target={getStableSkinAge() ?? result.skinAge} />
                  </span>
                  <span style={{ fontSize: 9, color: '#8888a0', fontWeight: 500, marginTop: 2 }}>피부나이</span>
                  <span style={{ fontSize: 8, color: '#818cf8', fontWeight: 600, marginTop: 1 }}>주간평균</span>
                </div>
                {/* Overall Score card with gauge */}
                <div style={{
                  width: 66, height: 72, borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)',
                  position: 'relative',
                }}>
                  {/* Mini circular gauge */}
                  <svg width={62} height={62} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                    <defs>
                      <linearGradient id="miniGauge" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#a78bfa" />
                      </linearGradient>
                    </defs>
                    <circle cx={31} cy={31} r={25} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
                    <circle cx={31} cy={31} r={25} fill="none" stroke="url(#miniGauge)" strokeWidth={4}
                      strokeDasharray={157} strokeDashoffset={157 - (result.overallScore / 100) * 157}
                      strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease-out' }} />
                  </svg>
                  <span style={{ fontSize: 24, fontWeight: 650, color: '#a78bfa', lineHeight: 1, fontFamily: "'Outfit', sans-serif", zIndex: 1 }}>
                    <AnimatedNumber target={result.overallScore} />
                  </span>
                  <span style={{ fontSize: 9, color: '#8888a0', fontWeight: 500, marginTop: 1, zIndex: 1 }}>종합</span>
                  {changes && changes.overallScore.diff !== 0 && (
                    <span style={{ fontSize: 8, fontWeight: 700, color: changes.overallScore.improved ? '#4ecb71' : '#f06050', zIndex: 1 }}>
                      {changes.overallScore.diff > 0 ? '+' : ''}{changes.overallScore.diff}
                    </span>
                  )}
                </div>
                {/* Today measurement count */}
                {(() => {
                  const todayCount = getTodayRecords().length;
                  return todayCount > 1 ? (
                    <div style={{
                      width: 42, height: 72, borderRadius: 14,
                      background: 'rgba(167,139,250,0.08)',
                      border: '1px solid rgba(167,139,250,0.15)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: '#a78bfa', lineHeight: 1, fontFamily: "'Outfit', sans-serif" }}>{todayCount}</span>
                      <span style={{ fontSize: 8, color: '#8888a0', fontWeight: 500, marginTop: 2 }}>회째</span>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* ── Save & Share ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, animation: 'fadeUp 0.5s ease-out 0.7s both' }}>
              <button onClick={handleSave} disabled={saved} style={{
                flex: 1, padding: '12px 0', borderRadius: 50, border: 'none', fontSize: 14, fontWeight: 700,
                cursor: saved ? 'default' : 'pointer', fontFamily: 'inherit',
                background: saved ? 'rgba(74,222,128,0.15)' : 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
                color: saved ? '#4ade80' : '#fff',
                boxShadow: saved ? 'none' : '0 4px 16px rgba(167,139,250,0.35)',
              }}>
                {saved ? '✅ 저장 완료' : '💾 기록 저장'}
              </button>
              <button onClick={handleShare} style={{
                padding: '12px 20px', borderRadius: 50, fontFamily: 'inherit',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                color: '#e0e0e8', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>📤 공유</button>
            </div>

            {/* ── Skin Info glass card ── */}
            <div className="glass-card" style={{ padding: '4px 0', animation: 'fadeUp 0.5s ease-out 0.85s both' }}>
              {/* Skin type */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15 }}>🧬</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f5' }}>피부 타입</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f5', fontFamily: "'Outfit', sans-serif" }}>{result.skinType}</span>
              </div>
              {/* Analysis Mode */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15 }}>{result.analysisMode === 'hybrid' ? '🧠' : '📊'}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f5' }}>분석 모드</span>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, fontFamily: "'Outfit', sans-serif",
                  color: result.analysisMode === 'hybrid' ? '#a78bfa' : '#8888a0',
                  background: result.analysisMode === 'hybrid' ? 'rgba(167,139,250,0.12)' : 'rgba(184,137,110,0.1)',
                  padding: '3px 10px', borderRadius: 10,
                }}>{result.analysisMode === 'hybrid' ? 'AI + CV 하이브리드' : 'CV 비전 분석'}</span>
              </div>
              {/* Confidence */}
              {result.confidence != null && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 15 }}>📊</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f5' }}>측정 신뢰도</span>
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
                <span style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f5' }}>관심 사항</span>
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

            {/* ── Makeup Notice ── */}
            {result.makeupDetected && (
              <div style={{
                padding: '12px 16px', borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(244,163,187,0.1), rgba(244,163,187,0.05))',
                border: '1px solid rgba(244,163,187,0.2)',
                display: 'flex', alignItems: 'center', gap: 10,
                animation: 'fadeUp 0.5s ease-out 0.85s both',
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>💄</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f4a3bb', marginBottom: 2 }}>메이크업이 감지되었어요</div>
                  <div style={{ fontSize: 12, color: '#8888a0', lineHeight: 1.5 }}>클렌징 후 다시 측정하면 더 정확한 피부 상태를 확인할 수 있어요</div>
                </div>
              </div>
            )}

            {/* ── 오늘의 피부 컨디션 ── */}
            {conditionBriefing && (() => {
              const score = result.conditionScore ?? result.overallScore;
              const grade = score >= 85 ? { letter: 'S', label: '최상', color: '#FFD700', bg: 'rgba(255,215,0,0.15)', border: 'rgba(255,215,0,0.3)' }
                : score >= 70 ? { letter: 'A', label: '우수', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.3)' }
                : score >= 55 ? { letter: 'B', label: '양호', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' }
                : score >= 40 ? { letter: 'C', label: '보통', color: '#8888a0', bg: 'rgba(136,136,160,0.12)', border: 'rgba(136,136,160,0.2)' }
                : { letter: 'D', label: '관리필요', color: '#f06050', bg: 'rgba(240,96,80,0.12)', border: 'rgba(240,96,80,0.2)' };
              return (
              <div className="glass-card" style={{
                animation: 'fadeUp 0.5s ease-out 0.88s both',
                border: `1px solid ${grade.border}`,
                background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(167,139,250,0.04))',
              }}>
                {/* Header: title + grade + score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>오늘의 피부 컨디션</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {getTodayRecords().length > 1 && (
                      <span style={{ fontSize: 10, color: '#8888a0' }}>{getTodayRecords().length}회째</span>
                    )}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 20,
                      background: grade.bg, border: `1px solid ${grade.border}`,
                    }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: grade.color, fontFamily: "'Outfit', sans-serif" }}>{grade.letter}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: grade.color }}>{score}점</span>
                    </div>
                  </div>
                </div>
                {/* Briefing text */}
                <p style={{ fontSize: 14, color: '#e0e0e8', lineHeight: 1.8, margin: 0 }}>{conditionBriefing}</p>
                {/* Today's change badges */}
                {changes && getTodayRecords().length > 1 && (() => {
                  const keyMetrics = ['moisture', 'oilBalance', 'skinTone', 'darkCircleScore'];
                  const badges = keyMetrics
                    .map(k => changes[k])
                    .filter(c => c && Math.abs(c.diff) >= 2);
                  if (badges.length === 0) return null;
                  return (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      {badges.map(c => (
                        <span key={c.key} style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 20,
                          background: c.improved ? 'rgba(78,203,113,0.1)' : 'rgba(240,160,80,0.1)',
                          color: c.improved ? '#4ecb71' : '#f0a050',
                        }}>
                          {c.icon} {c.label} {c.diff > 0 ? '+' : ''}{c.diff}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </div>
              );
            })()}

            {/* ── AI Analysis ── */}
            <div className="glass-card" style={{ animation: 'fadeUp 0.5s ease-out 0.9s both', boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05), inset 0 0 20px rgba(167,139,250,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <AuraPearl variant="living" size={28} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>전체 피부 분석</span>
              </div>
              <p style={{ fontSize: 14, color: '#e0e0e8', lineHeight: 1.75 }}>{result.advice}</p>
              {result.aiNotes && (() => {
                // Remove any sentence about identity comparison (동일 인물, 같은 사람, etc.)
                const filtered = result.aiNotes
                  .replace(/[^.。!]*(?:동일\s*인물|같은\s*(?:사람|인물)|다른\s*(?:사람|인물)|differentPerson|두\s*사진\s*(?:은|이|를))[^.。!]*[.。!]\s*/gi, '')
                  .trim();
                if (!filtered) return null;
                return (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(167,139,250,0.06))',
                  border: '1px solid rgba(167,139,250,0.12)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#a78bfa', marginBottom: 4 }}>AI 정밀 판독</div>
                  <p style={{ fontSize: 13, color: '#e0e0e8', lineHeight: 1.7, margin: 0 }}>{filtered}</p>
                </div>
                );
              })()}
              {changes && (() => {
                const skipKeys = ['overallScore', 'skinAge'];
                const improved = Object.values(changes).filter(c => c.improved && Math.abs(c.diff) >= 1 && !skipKeys.includes(c.key));
                const worsened = Object.values(changes).filter(c => !c.improved && Math.abs(c.diff) >= 1 && !skipKeys.includes(c.key));
                if (improved.length === 0 && worsened.length === 0) return null;

                // Generate summary text
                const topImproved = improved.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 2).map(c => c.label);
                const topWorsened = worsened.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 2).map(c => c.label);
                let summary = '';
                if (topImproved.length > 0 && topWorsened.length > 0) {
                  summary = `${topImproved.join('·')} 개선, ${topWorsened.join('·')}은 조금만 신경 쓰면 돼요`;
                } else if (topImproved.length > 0) {
                  summary = `${topImproved.join('·')} 등 전반적으로 좋아지고 있어요`;
                } else {
                  summary = `${topWorsened.join('·')}이 살짝 변했지만, 금방 회복할 수 있어요`;
                }

                return (
                  <div style={{
                    marginTop: 14, padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f0f5', marginBottom: 4 }}>지난 측정 대비 변화</div>
                    <div style={{ fontSize: 11, color: '#a0a0b8', marginBottom: 10 }}>{summary}</div>
                    {improved.length > 0 && (
                      <div style={{ marginBottom: worsened.length > 0 ? 8 : 0 }}>
                        <div style={{ fontSize: 11, color: '#4ecb71', fontWeight: 600, marginBottom: 6 }}>개선됨</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {improved.map(c => (
                            <span key={c.key} style={{
                              fontSize: 12, padding: '4px 10px', borderRadius: 20,
                              background: 'rgba(78,203,113,0.1)', color: '#4ecb71',
                            }}>{c.icon} {c.label} +{Math.abs(Math.round(c.diff))}{c.unit}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {worsened.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: '#f0a050', fontWeight: 600, marginBottom: 6 }}>케어 포인트</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {worsened.map(c => (
                            <span key={c.key} style={{
                              fontSize: 12, padding: '4px 10px', borderRadius: 20,
                              background: 'rgba(240,160,80,0.1)', color: '#f0a050',
                            }}>{c.icon} {c.label} {Math.round(c.diff)}{c.unit}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* ── GROUP 1: Condition Metrics ── */}
            <div className="glass-card" style={{ padding: '18px 10px', animation: 'fadeUp 0.5s ease-out 1.0s both' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, paddingLeft: 8, color: '#f0f0f5' }}>컨디션 지표 <span style={{ fontSize: 11, color: '#8888a0', fontWeight: 400 }}>일상 관리 포인트</span></div>
              <div style={{ fontSize: 10, color: '#8888a0', paddingLeft: 8, marginBottom: 14 }}>탭하면 과학적 근거</div>
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
            <div className="glass-card" style={{ padding: '18px 10px', animation: 'fadeUp 0.5s ease-out 1.1s both' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, paddingLeft: 8, color: '#f0f0f5' }}>노화 지표 <span style={{ fontSize: 11, color: '#8888a0', fontWeight: 400 }}>피부 나이에 큰 영향</span></div>
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

            {/* ── Product Recommendations ── */}
            {(() => {
              const weakCats = getWeakestCategories(result);
              if (weakCats.length === 0) return null;
              return (
                <div className="glass-card" style={{ padding: '18px 14px', animation: 'fadeUp 0.5s ease-out 1.15s both' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#f0f0f5' }}>
                    맞춤 추천 제품 <span style={{ fontSize: 11, color: '#8888a0', fontWeight: 400 }}>내 피부에 딱 맞는</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#8888a0', marginBottom: 14 }}>쿠팡에서 바로 구매 가능</div>
                  {weakCats.slice(0, 2).map((cat) => {
                    const meta = CATEGORY_META[cat];
                    if (!meta) return null;
                    const products = getProductsByCategory(cat).slice(0, 2);
                    if (products.length === 0) return null;
                    const metricValue = result?.[meta.metricKey] ?? 50;
                    return (
                      <div key={cat} style={{ marginBottom: 12 }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px', borderRadius: 16,
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          marginBottom: 8,
                        }}>
                          <span style={{ fontSize: 16 }}>{meta.icon}</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#e0e0f0' }}>{meta.label}</div>
                            <div style={{ fontSize: 10, color: '#8888a0' }}>{meta.ingredient}</div>
                          </div>
                        </div>
                        {products.map((product) => (
                          <a key={product.id} href={product.link} target="_blank" rel="noopener noreferrer"
                            className="product-item-card"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 12px', borderRadius: 14, marginBottom: 6,
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              textDecoration: 'none', color: 'inherit',
                              transition: 'background 0.2s, border-color 0.2s',
                            }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                              background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(167,139,250,0.15))',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                            }}>
                              {product.tags?.[0]?.includes('히알루론') ? '💧' :
                               product.tags?.[0]?.includes('비타민') ? '🍊' :
                               product.tags?.[0]?.includes('레티놀') ? '✨' :
                               product.tags?.[0]?.includes('나이아신') ? '🧪' :
                               product.tags?.[0]?.includes('글루타') ? '💎' : '🧴'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#e0e0f0',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {product.brand} {product.name}
                              </div>
                              <div style={{ display: 'flex', gap: 4, marginTop: 3, alignItems: 'center' }}>
                                {product.tags?.slice(0, 2).map((tag, ti) => (
                                  <span key={ti} style={{
                                    fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 6,
                                    background: 'rgba(167,139,250,0.15)', color: '#a78bfa',
                                  }}>{tag}</span>
                                ))}
                                <span style={{ fontSize: 9, color: '#66667a' }}>{product.volume}</span>
                              </div>
                            </div>
                            <div style={{
                              padding: '5px 12px', borderRadius: 16, flexShrink: 0,
                              background: 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
                              fontSize: 11, fontWeight: 700, color: '#fff',
                            }}>구매</div>
                          </a>
                        ))}
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 9, color: '#55556a', textAlign: 'center', marginTop: 4, lineHeight: 1.4 }}>
                    이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
                  </div>
                </div>
              );
            })()}

            {/* ── Skin Consultant CTA ── */}
            <button onClick={() => setActiveTab('consult')} style={{
              width: '100%', padding: '14px 0', borderRadius: 50, border: 'none',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(167,139,250,0.12))',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              color: '#818cf8', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', marginBottom: 14,
              boxShadow: '0 2px 12px rgba(167,139,250,0.12)',
              animation: 'fadeUp 0.5s ease-out 1.25s both',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              루아(LUA)에게 물어보기
            </button>

            {/* ── Re-measure ── */}
            {!saved && (
              <button onClick={handleSave} style={{
                marginBottom: 10, width: '100%', padding: 14, borderRadius: 50, border: 'none',
                background: 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
                boxShadow: '0 6px 24px rgba(167,139,250,0.35), inset 0 1px 1px rgba(255,255,255,0.05)',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                animation: 'fadeUp 0.5s ease-out 1.35s both',
              }}>💾 이 결과 기록하기</button>
            )}
            <button onClick={reset} style={{
              width: '100%', padding: 14, borderRadius: 50, fontFamily: 'inherit',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              color: '#e0e0e8', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              animation: 'fadeUp 0.5s ease-out 1.4s both',
            }}>🔄 다시 측정하기</button>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#8888a0', marginTop: 14, marginBottom: 0 }}>
              AI 추정치이며 의료 진단이 아닙니다 · LUA © 2026
            </p>
            {/* Tab bar spacer for result page */}
            <div className="tab-bar-spacer" />
          </div>
        </div>
      )}

      </>}
      {/* End of home tab wrapper */}

      {/* Tab bar spacer for pages that show tab bar (consult tab manages its own height) */}
      {showTabBar && activeTab !== 'home' && activeTab !== 'consult' && <div className="tab-bar-spacer" />}
      {showTabBar && activeTab === 'home' && stage === 'landing' && <div className="tab-bar-spacer" />}

      {/* ===== PWA INSTALL BANNER ===== */}
      <InstallBanner />

      {/* ===== TAB BAR ===== */}
      {showTabBar && <TabBar activeTab={activeTab} onTabChange={switchTab} onMeasure={openCamera} />}

      {/* ===== GOAL CELEBRATION OVERLAY ===== */}
      {showCelebration && (
        <div
          onClick={() => setShowCelebration(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              textAlign: 'center', padding: '48px 32px',
              maxWidth: 340,
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 16, animation: 'celebrate-bounce 0.6s ease' }}>🎉</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f5', marginBottom: 8 }}>
              목표를 달성했어요!
            </div>
            <div style={{ fontSize: 14, color: '#8888a0', lineHeight: 1.6, marginBottom: 8 }}>
              설정한 모든 피부 목표를 달성했어요.
              <br />꾸준한 관리의 결과예요!
            </div>
            {(() => {
              const g = getGoal();
              if (!g) return null;
              return (
                <div style={{
                  margin: '20px 0', padding: 16, borderRadius: 16,
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.15)',
                }}>
                  {g.metrics.map((m) => (
                    <div key={m.key} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '6px 0', fontSize: 13,
                    }}>
                      <span style={{ color: '#e0e0e8' }}>{m.icon} {m.label}</span>
                      <span style={{ color: '#34d399', fontWeight: 600 }}>
                        {m.startValue} → {m.currentValue}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setShowCelebration(false)}
                style={{
                  flex: 1, padding: 14, borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'transparent', color: '#8888a0',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >닫기</button>
              <button
                onClick={() => { setShowCelebration(false); setActiveTab('my'); }}
                style={{
                  flex: 1, padding: 14, borderRadius: 16, border: 'none',
                  background: 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >새 목표 설정</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== BADGE CELEBRATION POPUP ===== */}
      <BadgeCelebration badge={celebrateBadge} onClose={() => setCelebrateBadge(null)} />
    </div>
  );
}

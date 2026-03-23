import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import GlobalStyles from './design/GlobalStyles';
import { compressImage, clearCompressCache, analyzePixels, pixelsToScores, generateDemoScores, checkPhotoQuality, generateSmartAdvice } from './engine/PixelAnalysis';
import { detectLandmarks } from './engine/FaceLandmarker';
import { callVisionAI, hybridMerge, hasBaseline } from './engine/HybridAnalysis';
import { estimateAge, preload as preloadAge } from './engine/FaceAgeEstimator';
import { preload as preloadLandmarker } from './engine/FaceLandmarker';
import { AnimatedNumber, ScoreRing, MetricBar, Tag, DetailPage } from './components/UIComponents';
import CameraCapture from './components/CameraCapture';
import { saveRecord, updateRecord, getRecords, getNextMeasurementInfo, getChanges, generateShareText, getLatestRecord, hasTodayRecord, saveThumbnail, saveComparisonPhoto, getTodayRecords, getStableSkinAge } from './storage/SkinStorage';
import { migrateFromLocalStorage } from './storage/PhotoDB';
import { createAutoBackup, verifyDataIntegrity, restoreFromAutoBackup, startPeriodicBackup, getBackupInfo } from './storage/AutoBackup';
import HistoryPage from './pages/HistoryPage';
import TabBar from './components/TabBar';
import MyPage from './pages/MyPage';
// RoutinePage removed — tab restructuring
import RoutineTracker from './pages/RoutineTracker';
import SkinScoreCircle from './components/SkinScoreCircle';
import AiInsightCard from './components/AiInsightCard';
import SkinConsultant from './components/SkinConsultant';
import InstallBanner from './components/InstallBanner';
import { CATEGORY_META, getProductsByCategory, getWeakestCategories, calcMatchScore } from './data/ProductCatalog';
import { getRecommendedTreatments, TREATMENT_CATEGORIES } from './data/TreatmentData';
import { syncSkinDataToServer } from './utils/pushNotification';
import { getProfile, saveProfile, getDeviceId } from './storage/ProfileStorage';
import GoalProgressCard from './components/GoalProgressCard';
import SkinWeather from './components/SkinWeather';
import WeatherChip from './components/WeatherChip';
import { getGoal, updateGoalProgress } from './storage/GoalStorage';
import { addXP, checkAndAwardBadges, incrementStat, getTotalXP, getLevel } from './storage/BadgeStorage';
import { calculateLevel, getDefaultTheme, getThemeById, getLevelTitleData, THEMES } from './data/BadgeData';
import { BadgeCelebration } from './components/BadgeRanking';
import SplashScreen from './components/SplashScreen';
import SkinMeasurePage from './pages/SkinMeasurePage';
import { DropletIcon, SparkleIcon, LotionIcon, DiamondIcon, PaletteIcon, MicroscopeIcon, RulerIcon, EyeIcon, BubbleIcon, TargetIcon, SunIcon, MoonIcon, CameraIcon, TestTubeIcon, StarIcon, ShieldIcon, WandIcon, PhotoIcon, CheckIcon, SaveIcon, PastelIcon, LuaMiniIcon } from './components/icons/PastelIcons';
import SoftCloverIcon from './components/icons/SoftCloverIcon';
import EternalPearl from './components/icons/EternalPearl';

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
  const [historyInitMode, setHistoryInitMode] = useState(null);

  const [recordCount, setRecordCount] = useState(0);
  const [nextInfo, setNextInfo] = useState(null);
  const [showMigration, setShowMigration] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [conditionBriefing, setConditionBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [celebrateBadge, setCelebrateBadge] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);
  const [weatherSheet, setWeatherSheet] = useState(false);
  const [showDataRecovery, setShowDataRecovery] = useState(false);
  const [recoveryInfo, setRecoveryInfo] = useState(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [colorMode, setColorModeState] = useState(() => getProfile().colorMode || 'light');
  const [userLevel, setUserLevel] = useState(() => calculateLevel(getTotalXP()));
  const [activeThemeId, setActiveThemeId] = useState(() => getProfile().activeTheme || null);

  // Apply data-theme attribute for light/dark CSS variables
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorMode);
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || (colorMode === 'light' ? '#F7F8FA' : '#000000');
    document.body.style.background = bg;
    document.body.style.color = colorMode === 'light' ? '#191F28' : '#f0f0f5';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = bg;
  }, [colorMode]);

  const setColorMode = useCallback((mode) => {
    setColorModeState(mode);
    saveProfile({ colorMode: mode });
  }, []);

  // Active theme — reactive to colorMode + user preference
  const activeThemeColors = useMemo(() => {
    if (activeThemeId) {
      const t = getThemeById(activeThemeId);
      if (t.mode === colorMode) return t;
    }
    return getDefaultTheme(colorMode);
  }, [colorMode, activeThemeId]);

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
    // PWA: 데이터 백업 후 안전하게 리로드
    if ('serviceWorker' in navigator) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        createAutoBackup()
          .then(() => {
            sessionStorage.setItem('nou_sw_updating', '1');
            window.location.reload();
          })
          .catch(() => {
            sessionStorage.setItem('nou_sw_updating', '1');
            window.location.reload();
          });
      });
      navigator.serviceWorker.ready.then(reg => reg.update());
    }

    // SW 업데이트 후 데이터 무결성 검증
    if (sessionStorage.getItem('nou_sw_updating')) {
      sessionStorage.removeItem('nou_sw_updating');
      verifyDataIntegrity().then((status) => {
        if (status === 'data_lost') {
          getBackupInfo().then((info) => {
            setRecoveryInfo(info);
            setShowDataRecovery(true);
          });
        }
      });
    } else {
      // 일반 시작 시에도 무결성 검증
      verifyDataIntegrity().then((status) => {
        if (status === 'data_lost') {
          getBackupInfo().then((info) => {
            setRecoveryInfo(info);
            setShowDataRecovery(true);
          });
        }
      });
    }

    // 주기적 자동 백업 시작 (5분 간격)
    const stopBackup = startPeriodicBackup();

    // 백업 리마인더: 14일 이상 수동 백업 없으면 알림
    const records = getRecords();
    if (records.length >= 5) {
      const lastManual = parseInt(localStorage.getItem('nou_last_manual_backup') || '0', 10);
      const daysSince = (Date.now() - lastManual) / (1000 * 60 * 60 * 24);
      if (daysSince > 14) {
        setTimeout(() => setShowBackupReminder(true), 3000);
      }
    }

    return () => stopBackup();
  }, []);

  const refreshLandingData = () => {
    setRecordCount(getRecords().length);
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
  const goToHistory = useCallback(() => { refreshLandingData(); setHistoryInitMode(null); setActiveTab('history'); }, []);
  const goToLanding = useCallback(() => { refreshLandingData(); setHistoryInitMode(null); setActiveTab('home'); setStage('landing'); }, []);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    setUserLevel(getLevel());
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
    clearCompressCache(); // Prevent cross-person contamination from cached compressed images
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

    console.log('[Score Debug] overallScore:', finalScores.overallScore, 'conditionScore:', finalScores.conditionScore, 'mode:', finalScores.analysisMode);

    clearInterval(pi); setProgress(100);
    setTimeout(() => {
      // Get previous SAME-PERSON record before saving (for briefing comparison)
      const allRecs = getRecords();
      const prevRecord = allRecs.length > 0
        ? [...allRecs].reverse().find(r => !!r.differentPerson === !!finalScores.differentPerson) || null
        : null;
      const todayBefore = getTodayRecords();

      // Save record FIRST so getChanges() compares current vs previous correctly
      const recordId = saveRecord(finalScores);

      // Generate advice with correct post-save changes
      const currentChanges = getChanges();
      finalScores.advice = generateSmartAdvice(finalScores, currentChanges);

      // Set result + immediately show local condition briefing (guaranteed)
      const localBriefing = generateLocalBriefing(finalScores);
      setConditionBriefing(localBriefing);
      setBriefingLoading(false);
      setResult(finalScores); setStage('result');

      // Update saved record with advice + briefing
      if (recordId) {
        updateRecord(recordId, {
          advice: finalScores.advice,
          conditionBriefing: localBriefing,
          ...(finalScores.confidence != null ? { confidence: finalScores.confidence } : {}),
        });
      }

      // Try to upgrade with AI briefing in background
      fetch('/api/condition-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current: { ...finalScores, conditionScore: finalScores.conditionScore ?? finalScores.overallScore },
          previous: prevRecord || null,
          skinType: finalScores.skinType,
          todayCount: todayBefore.length + 1,
          stableSkinAge: finalScores.differentPerson ? finalScores.skinAge : getStableSkinAge(),
        }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.briefing) {
            setConditionBriefing(data.briefing);
            if (recordId) updateRecord(recordId, { conditionBriefing: data.briefing });
          }
        })
        .catch(() => {});
      if (recordId) {
        setSaved(true);
        setShowSaveToast(true);
        setTimeout(() => setShowSaveToast(false), 2500);
        if (image) {
          saveThumbnail(recordId, image);
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
        const xpResult = addXP(50, '피부 측정 완료');
        const hour = new Date().getHours();
        if (hour >= 22 || hour < 5) incrementStat('nightMeasure');
        if (hour >= 5 && hour < 10) incrementStat('morningMeasure');
        const badgeResult = checkAndAwardBadges();
        if (badgeResult.newBadges.length > 0) {
          setTimeout(() => setCelebrateBadge(badgeResult.newBadges[0]), 1500);
        }
        // Auto-upgrade title on level-up
        if (xpResult.levelUp) {
          const newTitle = getLevelTitleData(xpResult.newLevel);
          saveProfile({ selectedTitleLevel: newTitle.level });
          setUserLevel(xpResult.newLevel);
        }
        // Submit score to ranking server
        const freshLevel = getLevel();
        fetch('/api/ranking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: getDeviceId(),
            nickname: prof.nickname || '사용자',
            score: finalScores.overallScore,
            xp: getTotalXP(),
            level: freshLevel,
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
        // Get previous record before saving (for briefing comparison)
        const demoRecs = getRecords();
        const prevRecord = demoRecs.length > 0
          ? [...demoRecs].reverse().find(r => !!r.differentPerson === !!scores.differentPerson) || null
          : null;
        const todayBefore = getTodayRecords();

        // Save record FIRST so getChanges() compares current vs previous correctly
        const recordId = saveRecord(scores);

        // Generate advice with correct post-save changes
        scores.advice = generateSmartAdvice(scores, getChanges());

        // Set local briefing immediately (guaranteed) + try AI upgrade
        const localBriefing2 = generateLocalBriefing(scores);
        setConditionBriefing(localBriefing2);
        setBriefingLoading(false);
        setResult(scores); setStage('result');

        // Update saved record with advice + briefing
        if (recordId) {
          updateRecord(recordId, {
            advice: scores.advice,
            conditionBriefing: localBriefing2,
            ...(scores.confidence != null ? { confidence: scores.confidence } : {}),
          });
        }

        fetch('/api/condition-briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current: { ...scores, conditionScore: scores.conditionScore ?? scores.overallScore },
            previous: prevRecord || null,
            skinType: scores.skinType,
            todayCount: todayBefore.length + 1,
            stableSkinAge: scores.differentPerson ? scores.skinAge : getStableSkinAge(),
          }),
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.briefing) {
              setConditionBriefing(data.briefing);
              if (recordId) updateRecord(recordId, { conditionBriefing: data.briefing });
            }
          })
          .catch(() => {});
        if (recordId) {
          setSaved(true);
          setShowSaveToast(true);
          setTimeout(() => setShowSaveToast(false), 2500);
          updateGoalProgress(scores);
          const demoXpResult = addXP(50, '피부 측정 완료');
          const badgeResult = checkAndAwardBadges();
          if (badgeResult.newBadges.length > 0) {
            setTimeout(() => setCelebrateBadge(badgeResult.newBadges[0]), 1500);
          }
          // Auto-upgrade title on level-up
          if (demoXpResult.levelUp) {
            const newTitle = getLevelTitleData(demoXpResult.newLevel);
            saveProfile({ selectedTitleLevel: newTitle.level });
            setUserLevel(demoXpResult.newLevel);
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
    const recordId = saveRecord(result);
    if (recordId) {
      setSaved(true);
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2500);
      if (image) {
        saveThumbnail(recordId, image);
      }
    }
  }, [result, saved, image]);

  const handleShare = useCallback(() => {
    if (!result) return;
    const text = generateShareText(result);
    incrementStat('shareCount');
    checkAndAwardBadges();
    if (navigator.share) { navigator.share({ title: '루아 피부 나이', text }).catch(() => {}); }
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
      <style>{`@keyframes landingPearlReveal { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }`}</style>
      {showSplash && <SplashScreen exiting={splashExiting} onAnimationEnd={() => setShowSplash(false)} cloverTheme={activeThemeColors?.cloverTheme} />}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      <input ref={nativeCameraRef} type="file" accept="image/*" capture="user" onChange={handleFile} style={{ display: 'none' }} />

      {/* Data Recovery Modal */}
      {showDataRecovery && recoveryInfo && (
        <div onClick={() => setShowDataRecovery(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            maxWidth: 340, width: '100%',
            background: 'var(--bg-modal, #fff)', borderRadius: 24, padding: 28,
            border: '1px solid var(--border-subtle, #e5e7eb)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}><ShieldIcon size={40} /></div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              데이터 복구 가능
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 20 }}>
              이전 데이터가 사라진 것 같아요.<br/>
              자동 백업에서 <strong>{recoveryInfo.recordCount}개 기록</strong>을 복원할 수 있어요.<br/>
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                백업 시간: {new Date(recoveryInfo.timestamp).toLocaleString('ko-KR')}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowDataRecovery(false)}
                style={{
                  flex: 1, padding: 13, borderRadius: 14,
                  border: '1px solid var(--border-subtle, #e5e7eb)',
                  background: 'transparent', color: 'var(--text-muted)',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >무시</button>
              <button
                onClick={async () => {
                  const { restored, keyCount } = await restoreFromAutoBackup();
                  setShowDataRecovery(false);
                  if (restored) {
                    window.location.reload();
                  }
                }}
                style={{
                  flex: 1, padding: 13, borderRadius: 14, border: 'none',
                  background: 'linear-gradient(135deg, #81E4BD, #81E4BD)',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: 'none',
                }}
              >복원하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Reminder Banner */}
      {showBackupReminder && !showDataRecovery && (
        <div style={{
          position: 'fixed', top: 12, left: 16, right: 16, zIndex: 1050,
          background: 'rgba(200, 200, 200, 0.1)',
          backdropFilter: 'blur(10px)',
          padding: '16px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderRadius: 16,
          border: '0.5px solid rgba(255,255,255,0.6)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🔒</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>데이터 백업을 권장해요</div>
            <div style={{ fontSize: 11, color: '#8B95A1', marginTop: 2 }}>만약을 위해 백업 파일을 다운로드하세요</div>
          </div>
          <button
            onClick={() => {
              setShowBackupReminder(false);
              setActiveTab('my');
            }}
            style={{
              padding: '7px 14px', borderRadius: 12, border: 'none',
              background: '#E0E0E0', color: '#333',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              flexShrink: 0, whiteSpace: 'nowrap',
            }}
          >백업</button>
          <button
            onClick={() => setShowBackupReminder(false)}
            style={{
              background: 'none', border: 'none', color: '#999',
              fontSize: 18, cursor: 'pointer', padding: 4, flexShrink: 0, lineHeight: 1,
            }}
          >&times;</button>
        </div>
      )}

      {/* Save Toast */}
      {showSaveToast && (
        <div style={{ position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)', background: 'rgba(240,144,112,0.9)', color: '#fff', padding: '10px 22px', borderRadius: 30, fontSize: 13, fontWeight: 600, zIndex: 999, boxShadow: 'none' }}>
          <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><CheckIcon size={18} /></span> 기록이 저장되었어요!
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
        <HistoryPage onBack={goToLanding} onMeasure={openCamera} onOpenConsult={() => setActiveTab('consult')} initialMode={historyInitMode} />
      )}

      {/* ===== CONSULT TAB ===== */}
      {activeTab === 'consult' && (
        <SkinConsultant result={result || getLatestRecord()} isTab={true} />
      )}

      {/* ===== MY PAGE ===== */}
      {activeTab === 'my' && <MyPage colorMode={colorMode} setColorMode={setColorMode} onThemeChange={setActiveThemeId} />}

      {/* ===== HOME TAB (stage-based sub-flow) ===== */}
      {activeTab === 'home' && <>

      {/* ===== ROUTINE TRACKER ===== */}
      {stage === 'routineTracker' && (
        <RoutineTracker
          colorMode={colorMode}
          themeColors={activeThemeColors}
          onBack={() => setStage('landing')}
        />
      )}

      {/* ===== LANDING PAGE ===== */}
      {stage === 'landing' && (
        <div>
          {/* Migration Notice */}
          {showMigration && (
            <div style={{
              margin: '12px 16px 0', padding: '14px 18px',
              background: 'rgba(240,144,112,0.08)', borderRadius: 16,
              border: '1px solid rgba(240,144,112,0.15)',
              animation: 'fadeUp 0.4s ease-out',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ADEBB3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Safari 기록을 가져올 수 있어요</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Safari에서 측정한 기록은 마이페이지 &gt; 데이터 내보내기로 백업 후, 이 앱에서 가져오기로 복원할 수 있어요.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => {
                      setShowMigration(false);
                      localStorage.setItem('nou_migration_dismissed', '1');
                    }} style={{
                      padding: '6px 14px', borderRadius: 10, border: 'none',
                      background: 'var(--bg-card-hover)', color: 'var(--text-muted)',
                      fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    }}>닫기</button>
                    <button onClick={() => {
                      setShowMigration(false);
                      localStorage.setItem('nou_migration_dismissed', '1');
                      setActiveTab('my');
                    }} style={{
                      padding: '6px 14px', borderRadius: 10, border: 'none',
                      background: 'rgba(240,144,112,0.15)', color: '#ADEBB3',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    }}>마이페이지로 이동</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* First screen — fills full viewport */}
          <div style={{ height: 'calc(100dvh - 72px)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {/* Header with Weather Chip */}
          <div style={{ padding: '24px 24px 16px', position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#81E4BD', letterSpacing: 6, fontFamily: "'Fredoka', sans-serif" }}>LUA</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)', background: 'var(--chip-bg)', padding: '2px 8px', borderRadius: 'var(--chip-radius)', fontWeight: 500 }}>Beta</span>
              </div>
            </div>
            {/* Weather Chip */}
            <WeatherChip onTap={() => setWeatherSheet(true)} />
          </div>

          {/* Background aura — very subtle (hidden in light mode) */}
          {colorMode !== 'light' && (
            <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '120%', height: '50%', background: `radial-gradient(ellipse at 50% 40%, ${activeThemeColors.accent}06 0%, transparent 60%)`, pointerEvents: 'none' }} />
          )}

          {/* Eternal Pearl Hero */}
          <div onClick={openCamera} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '0 20px', position: 'relative', zIndex: 2,
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}>
            {/* Pearl card wrapper */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--card-border-radius)',
              boxShadow: 'none',
              padding: '32px 20px 28px',
              width: '100%',
              textAlign: 'center',
            }}>
              <div style={{
                position: 'relative', width: 312, height: 312,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto',
                ...(showSplash ? {
                  opacity: 0,
                  transform: 'scale(0.92)',
                  animation: splashExiting
                    ? 'landingPearlReveal 0.75s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards'
                    : undefined,
                } : {}),
              }}>
                <EternalPearl size={200} animated colors={activeThemeColors} theme={colorMode} />
              </div>

              {/* CTA text */}
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: -0.3, lineHeight: 1.6, marginBottom: 6 }}>
                  탭 하여 피부를 분석하세요
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 300 }}>AI가 10개 지표를 정밀 분석합니다</p>
                {/* Condition tags */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                  {['정면 셀카', '밝은 자연광', '맨 얼굴'].map(tag => (
                    <span key={tag} style={{
                      fontSize: 11, fontWeight: 400, color: 'var(--chip-text)',
                      background: 'var(--tag-bg)',
                      borderRadius: 'var(--chip-radius)', padding: '5px 12px', letterSpacing: -0.2,
                    }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Goal Progress Card */}
          {getGoal()?.status === 'active' && (
            <div style={{ padding: '17px 0 0' }}>
              <GoalProgressCard onTap={() => setActiveTab('my')} colorMode={colorMode} />
            </div>
          )}

          {/* AI Insight Card — on landing when there's data */}
          {getLatestRecord() && (
            <div style={{ padding: '17px 20px 0' }}>
              <AiInsightCard colorMode={colorMode} />
            </div>
          )}

          {/* Routine Tracker Entry Card */}
          <div
            onClick={() => setStage('routineTracker')}
            style={{
              margin: '17px 20px 0',
              padding: 20,
              borderRadius: 20,
              background: 'var(--bg-card)',
              border: 'none',
              boxShadow: 'none',
              cursor: 'pointer',
              animation: 'breatheIn 0.5s ease 0.3s both',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 14,
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
                  <defs>
                    <linearGradient id="lotion-g1" x1="30%" y1="0%" x2="70%" y2="100%">
                      <stop offset="0%" stopColor="#FFF0F3" />
                      <stop offset="100%" stopColor="#FFD0DA" />
                    </linearGradient>
                    <linearGradient id="lotion-g2" x1="30%" y1="0%" x2="70%" y2="100%">
                      <stop offset="0%" stopColor="#FFE0E8" />
                      <stop offset="100%" stopColor="#FFC0CC" />
                    </linearGradient>
                  </defs>
                  {/* 캡 */}
                  <rect x="13" y="3" width="10" height="4" rx="1.5" fill="url(#lotion-g2)" />
                  {/* 펌프 */}
                  <rect x="16.5" y="1" width="3" height="3" rx="1" fill="url(#lotion-g2)" />
                  <rect x="14" y="0.5" width="8" height="1.5" rx="0.75" fill="url(#lotion-g2)" />
                  {/* 몸통 */}
                  <rect x="11" y="7" width="14" height="20" rx="4" fill="url(#lotion-g1)" />
                  {/* 라벨 영역 */}
                  <rect x="13" y="13" width="10" height="8" rx="2" fill="white" opacity="0.3" />
                  {/* 하이라이트 */}
                  <rect x="12.5" y="9" width="3" height="12" rx="1.5" fill="white" opacity="0.2" />
                </svg></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>스킨케어 트래커</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>제품 등록 · 루틴 관리 · 효과 분석</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          </div>{/* end first screen wrapper */}

          {/* Weather Bottom Sheet */}
          {weatherSheet && (
            <>
              <div onClick={() => setWeatherSheet(false)} style={{
                position: 'fixed', inset: 0, zIndex: 50,
                background: 'var(--bg-modal-overlay)',
                animation: 'weatherSheetFadeIn 0.3s ease',
              }} />
              <div style={{
                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
                background: 'var(--bg-secondary)',
                borderTopLeftRadius: 28, borderTopRightRadius: 28,
                borderTop: '1px solid var(--border-light)',
                maxHeight: '85vh',
                animation: 'weatherSheetSlideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
                overflow: 'hidden',
              }}>
                <style>{`
                  @keyframes weatherSheetFadeIn { from { opacity: 0; } to { opacity: 1; } }
                  @keyframes weatherSheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                `}</style>
                {/* Handle */}
                <div onClick={() => setWeatherSheet(false)} style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', cursor: 'pointer' }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-subtle)' }} />
                </div>
                {/* Sheet header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  padding: '4px 20px 16px',
                }}>
                  <div></div>
                  <button onClick={() => setWeatherSheet(false)} style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--bg-card-hover)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', marginTop: 4, color: 'var(--text-muted)', fontSize: 16,
                    fontFamily: 'inherit',
                  }}>✕</button>
                </div>
                {/* Sheet content */}
                <div style={{ overflowY: 'auto', maxHeight: 'calc(85vh - 80px)', WebkitOverflowScrolling: 'touch' }}>
                  <SkinWeather skinResult={getLatestRecord()} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== CAMERA CAPTURE ===== */}
      {stage === 'camera' && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={reset}
          onFallback={() => { setStage('landing'); setTimeout(() => nativeCameraRef.current?.click(), 100); }}
          colorMode={colorMode}
        />
      )}

      {/* ===== SKIN MEASURE (모델 이미지 데모) ===== */}
      {stage === 'skin-measure' && (
        <SkinMeasurePage
          onClose={reset}
          onCapture={() => setStage('camera')}
          colorMode={colorMode}
        />
      )}

      {/* ===== UPLOAD PREVIEW ===== */}
      {stage === 'upload' && (() => {
        const isL = colorMode === 'light';
        return (
        <div style={{ background: 'var(--bg-primary)', padding: '24px 24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button onClick={reset} style={{
            alignSelf: 'flex-start', marginBottom: 147,
            width: 38, height: 38, borderRadius: '50%', border: 'none',
            background: 'var(--bg-input)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: 'var(--text-muted)',
          }}>←</button>
          <div style={{
            width: 300, height: 300, borderRadius: '50%', overflow: 'hidden',
            border: '3px solid var(--border-subtle)',
            boxShadow: 'none',
            position: 'relative',
          }}>
            <img src={image} alt="selfie" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {!isL && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.4))', borderRadius: '50%' }} />}
          </div>
          {photoQuality && !photoQuality.passed && (
            <div style={{
              margin: '16px 0 0', padding: '10px 16px', width: '100%', maxWidth: 320,
              background: !hasBaseline() ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${!hasBaseline() ? 'rgba(220,38,38,0.15)' : 'rgba(245,158,11,0.15)'}`, borderRadius: 16,
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
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3, letterSpacing: -0.3 }}>이 사진으로 분석할까요?</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{imageSize}</p>
          </div>
          <div style={{ padding: '60px 20px', width: '100%' }}>
            {(() => {
              const isBlocked = !hasBaseline() && photoQuality && !photoQuality.passed;
              return <button onClick={isBlocked ? undefined : startAnalysis} disabled={isBlocked} style={{
                marginBottom: 12, width: '100%', padding: 14, borderRadius: 'var(--btn-radius)',
                border: 'none',
                background: isBlocked
                  ? 'var(--text-disabled)'
                  : 'var(--btn-primary-bg)',
                boxShadow: 'none',
                color: '#fff', fontSize: 16, fontWeight: 700,
                cursor: isBlocked ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: isBlocked ? 0.6 : 1,
              }}><span style={{marginRight:6,fontSize:21,verticalAlign:'middle',display:'inline-flex'}}>{isBlocked ? <CameraIcon size={21} /> : <WandIcon size={21} />}</span>{isBlocked ? '다시 촬영해주세요' : 'AI 피부 분석 시작'}</button>;
            })()}
            <button onClick={() => fileRef.current?.click()} style={{
              width: '100%', padding: 12, borderRadius: 'var(--btn-radius)',
              background: 'var(--btn-secondary-bg)',
              border: 'var(--btn-secondary-border)',
              boxShadow: 'none',
              color: 'var(--text-muted)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}><span style={{marginRight:6,fontSize:21,verticalAlign:'middle',display:'inline-flex'}}><PhotoIcon size={21} /></span>다른 사진 선택</button>
          </div>
        </div>
        );
      })()}

      {/* ===== ANALYZING ===== */}
      {stage === 'analyzing' && (() => {
        const isL = colorMode === 'light';
        return (
        <div style={{
          minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 40,
          background: 'var(--bg-primary)',
        }}>
          <div style={{ position: 'relative', marginBottom: 40 }}>
            {/* Blob aura behind the photo — only dark mode */}
            {!isL && (
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
            )}
            {/* Subtle glow ring — light mode */}
            {isL && (
              <div style={{
                position: 'absolute', width: 280, height: 280,
                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(124,92,252,0.08) 0%, transparent 70%)',
                animation: 'analyzingBreatheCenter 3s ease-in-out infinite',
              }} />
            )}
            {/* Photo circle */}
            <div style={{
              width: 220, height: 220, borderRadius: '50%', overflow: 'hidden',
              border: '3px solid var(--border-subtle)',
              boxShadow: 'none',
              position: 'relative', zIndex: 1,
            }}>
              {image ? (
                <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  background: 'var(--bg-card-solid)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44,
                }}><SparkleIcon size={44} /></div>
              )}
            </div>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: 'var(--text-primary)', letterSpacing: -0.3 }}>
            피부 분석중
          </h2>
          <p style={{ fontSize: 14, fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif", color: 'var(--text-muted)', margin: '8px 0 32px' }}>
            수분 · 탄력 · 피부결을 분석하고 있어요
          </p>

          <div style={{ width: '100%', maxWidth: 280 }}>
            <div style={{
              height: 6, borderRadius: 3,
              background: 'var(--progress-track)', overflow: 'hidden', marginBottom: 12,
            }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: 'var(--progress-fill)',
                width: `${Math.min(progress, 100)}%`,
                transition: 'width 0.4s',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
              <span>{getProgressText(progress)}</span>
              <span>{Math.round(Math.min(progress, 99))}%</span>
            </div>
          </div>

          {/* Tip message */}
          <p key={getProgressTip(progress)} style={{
            marginTop: 48, fontSize: 13, color: 'var(--text-dim)', textAlign: 'center',
            letterSpacing: -0.2, lineHeight: 1.5,
            animation: 'fadeIn 0.6s ease',
          }}>
            {getProgressTip(progress)}
          </p>
        </div>
        );
      })()}

      {/* ===== RESULT ===== */}
      {stage === 'result' && result && (
        <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)' }}>

          {/* ═══════ Photo Hero ═══════ */}
          <div style={{
            position: 'relative', width: '100%', height: 340,
            background: 'linear-gradient(180deg, #1a1a2e, #08080c)',
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
                background: 'rgba(200,200,200,0.45)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'none',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
              <button onClick={handleShare} style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'rgba(200,200,200,0.45)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'none', fontSize: 16,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </button>
            </div>

            {/* Face photo */}
            <div ref={photoContainerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', animation: 'fadeUp 0.6s ease-out 0.1s both' }}>
              {image ? (
                <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: `linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-secondary) 50%, var(--bg-secondary) 100%)` }} />
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
              { text: '유분존: ', val: `${result.oilBalance}%`, c: result.oilBalance >= 45 && result.oilBalance <= 65 ? '#4ecb71' : activeThemeColors.accent, pos: { left: 12, top: 148 } },
              { text: '수분: ', val: result.moisture >= 60 ? '정상' : '낮음', c: result.moisture >= 60 ? '#4ecb71' : activeThemeColors.accent, pos: { left: 12, bottom: 80 } },
              { text: '트러블: ', val: `${result.troubleCount}개`, c: result.troubleCount <= 3 ? '#4ecb71' : '#f06050', pos: { right: 12, bottom: 110 } },
            ].map((l, i) => (
              <div key={i} style={{
                position: 'absolute', ...l.pos, zIndex: 8,
                background: 'var(--float-pill-bg)', backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
                borderRadius: 50, padding: '7px 16px',
                boxShadow: 'none',
                animation: `popIn 0.5s ease-out ${0.8 + i * 0.12}s both`,
              }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {l.text}<span style={{ color: l.c, fontWeight: 600 }}>{l.val}</span>
                </span>
              </div>
            ))}
          </div>

          {/* ═══════ Bottom Sheet ═══════ */}
          <div style={{
            position: 'relative',
            background: 'var(--bg-primary)',
            borderRadius: '24px 24px 0 0',
            marginTop: -28, padding: '0 20px 28px', zIndex: 5,
            boxShadow: 'none',
            animation: 'slideUp 0.6s ease-out 0.4s both',
          }}>
            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 20px' }}>
              <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--border-subtle)' }} />
            </div>

            {/* ── Header: 피부 컨디션 ── */}
            <div style={{ animation: 'fadeUp 0.5s ease-out 0.6s both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>피부 컨디션</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
              </div>
              {/* card-flat sub-cards: 피부나이 + 종합점수 */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <div onClick={() => openDetail('skinAge')} style={{
                  flex: 1, textAlign: 'center', padding: '18px 14px 16px',
                  background: 'var(--tag-bg)', borderRadius: 16, cursor: 'pointer',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>피부나이</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                    <AnimatedNumber target={result.skinAge} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-dim)', marginLeft: 2 }}>세</span>
                  </div>
                  {changes && changes.skinAge ? (
                    changes.skinAge.diff !== 0 ? (
                      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: changes.skinAge.improved ? 'var(--accent-success)' : '#f06050' }}>
                        {changes.skinAge.diff > 0 ? '+' : ''}{changes.skinAge.diff}세 {changes.skinAge.improved ? '↓' : '↑'}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>변동 없음</div>
                    )
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>첫 측정</div>
                  )}
                </div>
                <div style={{
                  flex: 1, textAlign: 'center', padding: '18px 14px 16px',
                  background: 'var(--tag-bg)', borderRadius: 16,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>종합 점수</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                    <AnimatedNumber target={result.overallScore} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-dim)', marginLeft: 2 }}>점</span>
                  </div>
                  {changes && changes.overallScore ? (
                    changes.overallScore.diff !== 0 ? (
                      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: changes.overallScore.improved ? 'var(--accent-success)' : '#f06050' }}>
                        {changes.overallScore.diff > 0 ? '+' : ''}{changes.overallScore.diff}점 {changes.overallScore.improved ? '↑' : '↓'}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>변동 없음</div>
                    )
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>첫 측정</div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Save & Share ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, animation: 'fadeUp 0.5s ease-out 0.7s both' }}>
              <button onClick={handleSave} disabled={saved} style={{
                flex: 1, padding: '12px 0', borderRadius: 'var(--btn-radius)', border: 'none', fontSize: 14, fontWeight: 700,
                cursor: saved ? 'default' : 'pointer', fontFamily: 'inherit',
                background: saved ? 'rgba(74,222,128,0.15)' : 'var(--btn-primary-bg)',
                color: saved ? '#4ade80' : '#fff',
                boxShadow: 'none',
              }}>
                {saved ? <><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><CheckIcon size={18} /></span> 저장 완료</> : <><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><SaveIcon size={18} /></span> 기록 저장</>}
              </button>
              <button onClick={handleShare} style={{
                padding: '12px 20px', borderRadius: 'var(--btn-radius)', fontFamily: 'inherit',
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
                color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}>📤 공유</button>
            </div>

            {/* ── Skin Info glass card ── */}
            <div className="glass-card" style={{ padding: '24px', animation: 'fadeUp 0.5s ease-out 0.85s both' }}>
              {/* Section icon header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <LuaMiniIcon size={14} />
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>피부 타입 정보</h2>
              </div>
              {/* Skin type */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>피부 타입</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{result.skinType}</span>
              </div>
              {/* Analysis Mode */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15 }}>{result.analysisMode === 'hybrid' ? '🧠' : '📊'}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>분석 모드</span>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-display)',
                  color: result.analysisMode === 'hybrid' ? activeThemeColors.accent : 'var(--text-muted)',
                  background: result.analysisMode === 'hybrid' ? `${activeThemeColors.accent}1f` : 'rgba(184,137,110,0.1)',
                  padding: '3px 10px', borderRadius: 10,
                }}>{result.analysisMode === 'hybrid' ? 'AI + CV 하이브리드' : 'CV 비전 분석'}</span>
              </div>
              {/* Confidence */}
              {result.confidence != null && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 15 }}>📊</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>측정 신뢰도</span>
                  </div>
                  <span style={{
                    fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)',
                    color: result.confidence >= 70 ? '#4ecb71' : result.confidence >= 50 ? '#d4900a' : '#f06050',
                  }}>{result.confidence}%</span>
                </div>
              )}
              {/* Concerns */}
              <div style={{ padding: '8px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 15 }}>⚡</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>관심 사항</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>클렌징 후 다시 측정하면 더 정확한 피부 상태를 확인할 수 있어요</div>
                </div>
              </div>
            )}

            {/* ── 오늘의 피부 컨디션 ── */}
            {conditionBriefing && (() => {
              const score = result.conditionScore ?? result.overallScore;
              const grade = score >= 85 ? { letter: 'S', label: '최상', color: '#81E4BD', bg: 'rgba(125,255,192,0.15)', border: 'rgba(125,255,192,0.3)' }
                : score >= 70 ? { letter: 'A', label: '우수', color: activeThemeColors.accent, bg: `${activeThemeColors.accent}26`, border: `${activeThemeColors.accent}4d` }
                : score >= 55 ? { letter: 'B', label: '양호', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)' }
                : score >= 40 ? { letter: 'C', label: '보통', color: '#8888a0', bg: 'rgba(136,136,160,0.12)', border: 'rgba(136,136,160,0.2)' }
                : { letter: 'D', label: '관리필요', color: '#f06050', bg: 'rgba(240,96,80,0.12)', border: 'rgba(240,96,80,0.2)' };
              return (
              <div className="glass-card" style={{
                animation: 'fadeUp 0.5s ease-out 0.88s both',
                border: 'none',
                background: 'var(--bg-card)',
              }}>
                {/* Section icon header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <LuaMiniIcon size={14} />
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>컨디션 브리핑</h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--context-bg)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-display)' }}>{grade.letter}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)' }}>{score}점</span>
                    </div>
                  </div>
                </div>
                {/* Briefing text */}
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>{conditionBriefing}</p>
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
            <div className="glass-card" style={{ animation: 'fadeUp 0.5s ease-out 0.9s both', boxShadow: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <LuaMiniIcon size={14} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>전체 피부 분석</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>AI 맞춤 리포트</div>
                </div>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{result.advice}</p>
              {result.aiNotes && (() => {
                // Remove any sentence about identity comparison (동일 인물, 같은 사람, etc.)
                const filtered = result.aiNotes
                  .replace(/[^.。!]*(?:동일\s*인물|같은\s*(?:사람|인물)|다른\s*(?:사람|인물)|differentPerson|두\s*사진\s*(?:은|이|를))[^.。!]*[.。!]\s*/gi, '')
                  .trim();
                if (!filtered) return null;
                return (
                <div style={{
                  marginTop: 14, padding: '14px 16px', borderRadius: 16,
                  background: 'var(--tag-bg)',
                  border: 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, display: 'inline-flex', verticalAlign: 'middle' }}><MicroscopeIcon size={12} /></span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: activeThemeColors.accent }}>AI 정밀 판독</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{filtered}</p>
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
                    marginTop: 14, padding: '14px 16px', borderRadius: 14,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>지난 측정 대비 변화</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>{summary}</div>
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
            <div className="glass-card" style={{ padding: '24px', animation: 'fadeUp 0.5s ease-out 1.0s both', boxShadow: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <LuaMiniIcon size={14} />
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>컨디션 지표</h2>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>일상 관리 포인트</div>
                </div>
              </div>
              <MetricBar label="수분도" value={result.moisture} unit="%" icon={<DropletIcon size={18} />} color="#A8DEFF"
                description={result.moisture >= 60 ? '정상 범위' : '보습 강화 필요'}
                onClick={() => openDetail('moisture')} />
              <MetricBar label="유분" value={result.oilBalance} unit="%" icon={<BubbleIcon size={18} />} color="#F0E0A8" delay={60}
                description={result.oilBalance >= 45 && result.oilBalance <= 65 ? '균형 상태' : result.oilBalance > 65 ? '유분 조절 필요' : '유분 보충 필요'}
                onClick={() => openDetail('oilBalance')} />
              <MetricBar label="피부톤" value={result.skinTone} unit="점" icon={<SparkleIcon size={18} />} color="#FFE082" delay={120}
                description={result.skinTone >= 70 ? '균일하고 밝은 톤' : '색소 관리 추천'}
                onClick={() => openDetail('skinTone')} />
              <MetricBar label="트러블" value={Math.max(0, 100 - result.troubleCount * 8.5)} unit="점" icon={<TargetIcon size={14} />} color="#FFB0B0" delay={180}
                description={`${result.troubleCount}개 | ${result.troubleCount <= 2 ? '깨끗' : result.troubleCount <= 5 ? '경증' : '집중관리'}`}
                onClick={() => openDetail('trouble')} />
              <MetricBar label="다크서클" value={result.darkCircleScore} unit="점" icon={<EyeIcon size={18} />} color="#C8B8E8" delay={240}
                description={result.darkCircleScore >= 70 ? '눈 밑 밝음' : result.darkCircleScore >= 45 ? '아이크림 추천' : '다크서클 집중 관리'}
                onClick={() => openDetail('darkCircles')} />
            </div>

            {/* ── GROUP 2: Aging Metrics ── */}
            <div className="glass-card" style={{ padding: '24px', animation: 'fadeUp 0.5s ease-out 1.1s both', boxShadow: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <LuaMiniIcon size={14} />
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>노화 지표</h2>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>피부 나이에 큰 영향</div>
                </div>
              </div>
              <MetricBar label="피부결" value={result.textureScore} unit="점" icon={<LotionIcon size={18} />} color="#FFB0C8"
                description={result.textureScore >= 70 ? '매끈한 피부' : result.textureScore >= 45 ? '각질 케어 추천' : '피부결 집중 관리 필요'}
                onClick={() => openDetail('texture')} />
              <MetricBar label="탄력" value={result.elasticityScore} unit="점" icon={<DiamondIcon size={18} />} color="#FFD080" delay={60}
                description={result.elasticityScore >= 70 ? '턱선 선명' : result.elasticityScore >= 45 ? '탄력 관리 시작' : '탄력 집중 케어 필요'}
                onClick={() => openDetail('elasticity')} />
              <MetricBar label="주름" value={result.wrinkleScore} unit="점" icon={<RulerIcon size={18} />} color="#F5D0B8" delay={120}
                description={result.wrinkleScore >= 75 ? '매끄러운 피부' : result.wrinkleScore >= 50 ? '잔주름 관리 추천' : '주름 집중 관리 필요'}
                onClick={() => openDetail('wrinkles')} />
              <MetricBar label="모공" value={result.poreScore} unit="점" icon={<MicroscopeIcon size={18} />} color="#E8D8C8" delay={180}
                description={result.poreScore >= 70 ? '미세 모공' : result.poreScore >= 45 ? '모공 축소 관리' : '넓은 모공 관리 필요'}
                onClick={() => openDetail('pores')} />
              <MetricBar label="색소" value={result.pigmentationScore} unit="점" icon={<PaletteIcon size={18} />} color="#C0A890" delay={240}
                description={result.pigmentationScore >= 70 ? '맑은 피부' : result.pigmentationScore >= 45 ? '미백 관리 추천' : '색소 집중 관리 필요'}
                onClick={() => openDetail('pigmentation')} />
            </div>

            {/* ── Product Recommendations ── */}
            {(() => {
              const weakCats = getWeakestCategories(result);
              if (weakCats.length === 0) return null;
              return (
                <div className="glass-card" style={{ padding: '24px', animation: 'fadeUp 0.5s ease-out 1.15s both', boxShadow: 'none', borderRadius: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
                    맞춤 추천 제품
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 14 }}>내 피부에 딱 맞는 제품 바로 구매 가능</div>
                  {weakCats.slice(0, 2).map((cat) => {
                    const meta = CATEGORY_META[cat];
                    if (!meta) return null;
                    const products = getProductsByCategory(cat).slice(0, 2);
                    if (products.length === 0) return null;
                    const metricValue = result?.[meta.metricKey] ?? 50;
                    return (
                      <div key={cat} style={{
                        marginBottom: 12, borderRadius: 16,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '12px 14px',
                        }}>
                          <span style={{ fontSize: 16, display: 'inline-flex' }}><PastelIcon emoji={meta.icon} size={16} /></span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{meta.label}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{meta.ingredient}</div>
                          </div>
                        </div>
                        {products.map((product, pi) => (
                          <a key={product.id} href={product.link} target="_blank" rel="noopener noreferrer"
                            className="product-item-card"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 14px 10px 24px',
                              marginLeft: 14, marginRight: 14,
                              borderTop: '1px solid var(--border-separator)',
                              textDecoration: 'none', color: 'inherit',
                              transition: 'background 0.2s',
                            }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#555555',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {product.brand} {product.name}
                              </div>
                              <div style={{ display: 'flex', gap: 4, marginTop: 3, alignItems: 'center' }}>
                                {product.tags?.slice(0, 2).map((tag, ti) => (
                                  <span key={ti} style={{
                                    fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 6,
                                    background: `${activeThemeColors.accent}26`, color: activeThemeColors.accent,
                                  }}>{tag}</span>
                                ))}
                                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{product.volume}</span>
                              </div>
                            </div>
                            <div style={{
                              padding: '5px 12px', borderRadius: 16, flexShrink: 0,
                              background: 'var(--btn-primary-bg)',
                              fontSize: 11, fontWeight: 700, color: '#fff',
                            }}>구매</div>
                          </a>
                        ))}
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', marginTop: 4, lineHeight: 1.4 }}>
                    이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
                  </div>
                </div>
              );
            })()}

            {/* ── Treatment Recommendations ── */}
            {(() => {
              const treatments = result ? getRecommendedTreatments(result, 3) : [];
              if (treatments.length === 0) return null;
              return (
                <div style={{
                  marginBottom: 14, borderRadius: 16,
                  background: 'var(--bg-card)',
                  border: 'none',
                  backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
                  overflow: 'hidden', boxShadow: 'none',
                  animation: 'fadeUp 0.5s ease-out 1.2s both',
                }}>
                  <div style={{ padding: '24px 24px 10px' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.3 }}>
                      맞춤 추천 시술
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      내 피부 데이터 기반 맞춤 추천
                    </div>
                  </div>
                  <div style={{ padding: '6px 12px' }}>
                    {(() => {
                      // 카테고리별로 그룹핑
                      const grouped = {};
                      treatments.forEach(t => {
                        if (!grouped[t.category]) grouped[t.category] = [];
                        grouped[t.category].push(t);
                      });
                      return Object.entries(grouped).map(([cat, items]) => {
                        const catMeta = TREATMENT_CATEGORIES[cat];
                        return (
                          <div key={cat} style={{
                            marginBottom: 12, borderRadius: 16,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '12px 14px',
                            }}>
                              <span style={{ fontSize: 16, display: 'inline-flex' }}><PastelIcon emoji={catMeta?.icon || '✨'} size={16} /></span>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{catMeta?.label}</div>
                                {items[0]?.weakestMetric && (
                                  <div style={{ fontSize: 10, fontWeight: 400, color: '#ef4444', marginTop: 2 }}>
                                    {items[0].weakestMetric.label} {items[0].weakestMetric.value}점
                                  </div>
                                )}
                              </div>
                            </div>
                            {items.map((t, ti) => (
                              <div key={t.id} style={{
                                padding: '10px 14px 10px 24px',
                                marginLeft: 14, marginRight: 14,
                                borderTop: '1px solid var(--border-separator)',
                              }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#555555' }}>
                                  {t.name}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>
                                  {t.mechanism.length > 35 ? t.mechanism.slice(0, 35) + '…' : t.mechanism}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 10, color: 'var(--text-dim)' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                                    {t.costRange}
                                  </span>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    {t.downtime}
                                  </span>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                    {t.frequency}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div style={{ padding: '6px 16px 12px' }}>
                    <button onClick={() => setActiveTab('consult')} style={{
                      width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
                      background: 'var(--btn-primary-bg)', color: '#fff',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                      💬 시술에 대해 루아에게 물어보기
                    </button>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', marginTop: 6, lineHeight: 1.4 }}>
                      <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><ShieldIcon size={12} /></span> 의료 행위가 아닌 정보 제공 목적입니다. 시술은 전문 의료진과 상담 후 결정하세요.
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Skin Consultant CTA ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, animation: 'fadeUp 0.5s ease-out 1.25s both' }}>
              <button onClick={() => setActiveTab('consult')} style={{
                flex: 1, padding: 14, borderRadius: 12, fontFamily: 'inherit',
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                boxShadow: 'none',
              }}>루아에게 물어보기</button>
              {!saved && (
                <button onClick={handleSave} style={{
                  flex: 1, padding: 14, borderRadius: 12, fontFamily: 'inherit',
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  boxShadow: 'none',
                }}>이 결과 기록하기</button>
              )}
            </div>
            <button onClick={reset} style={{
              width: '100%', padding: 14, borderRadius: 12, fontFamily: 'inherit',
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              boxShadow: 'none',
              animation: 'fadeUp 0.5s ease-out 1.4s both',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="url(#refreshGrad)" strokeWidth="3" strokeLinecap="round"><defs><linearGradient id="refreshGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6DD8A8"/><stop offset="100%" stopColor="#81E4BD"/></linearGradient></defs><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              다시 측정하기
            </button>

            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 14, marginBottom: 0 }}>
              AI 추정치이며 의료 진단이 아닙니다 · 루아 © 2026
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
      {showTabBar && <TabBar activeTab={activeTab} onTabChange={switchTab} onMeasure={openCamera} themeColors={activeThemeColors} colorMode={colorMode} />}

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
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              목표를 달성했어요!
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 8 }}>
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
                      <span style={{ color: 'var(--text-secondary)' }}>{m.icon} {m.label}</span>
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
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent', color: 'var(--text-muted)',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >닫기</button>
              <button
                onClick={() => { setShowCelebration(false); setActiveTab('my'); }}
                style={{
                  flex: 1, padding: 14, borderRadius: 16, border: 'none',
                  background: 'var(--btn-primary-bg)',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >새 목표 설정</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== BADGE CELEBRATION POPUP ===== */}
      <BadgeCelebration badge={celebrateBadge} onClose={() => setCelebrateBadge(null)} accent={activeThemeColors.accent} />
    </div>
  );
}

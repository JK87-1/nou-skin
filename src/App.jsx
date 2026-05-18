import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import GlobalStyles from './design/GlobalStyles';
import { compressImage, clearCompressCache, analyzePixels, pixelsToScores, generateDemoScores, checkPhotoQuality, generateSmartAdvice } from './engine/PixelAnalysis';
import { detectLandmarks } from './engine/FaceLandmarker';
import { callVisionAI, hybridMerge, hasBaseline, getAiFallbackStats, clearAiFallbackStats } from './engine/HybridAnalysis';
import { estimateAge, preload as preloadAge } from './engine/FaceAgeEstimator';
import { preload as preloadLandmarker } from './engine/FaceLandmarker';
import { AnimatedNumber, ScoreRing, MetricBar, Tag, DetailPage } from './components/UIComponents';
import CameraCapture from './components/CameraCapture';
import { saveRecord, updateRecord, getRecords, getNextMeasurementInfo, getChanges, generateShareText, getLatestRecord, hasTodayRecord, saveThumbnail, saveComparisonPhoto, getTodayRecords, getStableSkinAge, findRecentPrimaryRecord } from './storage/SkinStorage';
import { migrateFromLocalStorage } from './storage/PhotoDB';
import { createAutoBackup, verifyDataIntegrity, restoreFromAutoBackup, startPeriodicBackup, getBackupInfo } from './storage/AutoBackup';
import HistoryPage from './pages/HistoryPage';
import TabBar from './components/TabBar';
import MyPage from './pages/MyPage';
import DiscoverPage from './pages/DiscoverPage';
// RoutinePage removed — tab restructuring
import RoutineTracker from './pages/RoutineTracker';
import SkinScoreCircle from './components/SkinScoreCircle';
import AiInsightCard from './components/AiInsightCard';
import SkinConsultant from './components/SkinConsultant';
import LuaChatSheet from './components/LuaChatSheet';
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
import TrendCard from './components/TrendCard';
import AiCommentCard from './components/AiCommentCard';
import BeforeAfterSlider from './components/BeforeAfterSlider';
import { DropletIcon, SparkleIcon, LotionIcon, DiamondIcon, PaletteIcon, MicroscopeIcon, RulerIcon, EyeIcon, BubbleIcon, TargetIcon, SunIcon, MoonIcon, CameraIcon, TestTubeIcon, StarIcon, ShieldIcon, WandIcon, PhotoIcon, CheckIcon, SaveIcon, PastelIcon, LuaMiniIcon, FlameIcon, EggIcon, BlushIcon } from './components/icons/PastelIcons';
import SoftCloverIcon from './components/icons/SoftCloverIcon';
import EternalPearl from './components/icons/EternalPearl';
import ConsentModal from './components/ConsentModal';

const LEGAL_CONSENT_VERSION = '2026-05-22';
const LEGAL_CONSENT_KEY = 'legalConsentAt';
const LEGAL_CONSENT_VERSION_KEY = 'legalConsentVersion';

export default function App() {
  const [needsLegalConsent, setNeedsLegalConsent] = useState(() => {
    try {
      const at = localStorage.getItem(LEGAL_CONSENT_KEY);
      const ver = localStorage.getItem(LEGAL_CONSENT_VERSION_KEY);
      return !at || ver !== LEGAL_CONSENT_VERSION;
    } catch { return true; }
  });

  const handleAcceptLegalConsent = useCallback(() => {
    try {
      localStorage.setItem(LEGAL_CONSENT_KEY, new Date().toISOString());
      localStorage.setItem(LEGAL_CONSENT_VERSION_KEY, LEGAL_CONSENT_VERSION);
    } catch {}
    setNeedsLegalConsent(false);
  }, []);

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

  const [fabChatOpen, setFabChatOpen] = useState(false);
  const [insightCollapsed, setInsightCollapsed] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showHomeEdit, setShowHomeEdit] = useState(false);
  const [homeCards, setHomeCards] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lua_home_cards') || 'null') || { metrics: true, water: true, sleep: true, insight: true, goal: true }; }
    catch { return { metrics: true, water: true, sleep: true, insight: true, goal: true }; }
  });
  const toggleHomeCard = (key) => {
    const next = { ...homeCards, [key]: !homeCards[key] };
    setHomeCards(next);
    localStorage.setItem('lua_home_cards', JSON.stringify(next));
  };
  const [waterCups, setWaterCups] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    const saved = JSON.parse(localStorage.getItem('lua_water') || '{}');
    return saved.date === today ? saved.cups : 0;
  });
  const [sleepHours, setSleepHours] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    const saved = JSON.parse(localStorage.getItem('lua_sleep') || '{}');
    return saved.date === today ? saved.hours : null;
  });
  const refreshWaterSleep = () => {
    const today = new Date().toISOString().slice(0, 10);
    const w = JSON.parse(localStorage.getItem('lua_water') || '{}');
    setWaterCups(w.date === today ? w.cups : 0);
    const s = JSON.parse(localStorage.getItem('lua_sleep') || '{}');
    setSleepHours(s.date === today ? s.hours : null);
  };

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
  const weatherSheetRef = useRef(null);
  const weatherDragY = useRef(null);
  const weatherDragDelta = useRef(0);
  const [showDataRecovery, setShowDataRecovery] = useState(false);
  const [recoveryInfo, setRecoveryInfo] = useState(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [colorMode, setColorModeState] = useState(() => getProfile().colorMode || 'light');
  const [userLevel, setUserLevel] = useState(() => calculateLevel(getTotalXP()));
  const [activeThemeId, setActiveThemeId] = useState(() => getProfile().activeTheme || null);

  // AI fallback 디버그 헬퍼 — 콘솔에서 window.__aiFallbackStats() 호출
  useEffect(() => {
    window.__aiFallbackStats = () => {
      const s = getAiFallbackStats();
      console.table({
        성공: s.successTotal || 0,
        실패: s.fallbackTotal || 0,
        실패율: s.successTotal + s.fallbackTotal > 0
          ? `${Math.round((s.fallbackTotal / (s.successTotal + s.fallbackTotal)) * 100)}%`
          : '-',
        마지막사유: s.lastReason || '-',
        마지막실패: s.lastAt || '-',
        마지막성공: s.lastSuccessAt || '-',
      });
      console.log('사유별 카운트:', s.byReason);
      console.log('최근 50건 이력:', s.history);
      return s;
    };
    window.__clearAiFallbackStats = () => { clearAiFallbackStats(); console.log('AI fallback 통계 초기화 완료'); };
  }, []);

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

    // 백업 리마인더: 마지막 수동 백업 후 14일 + 마지막 노출 후 14일 모두 경과 시에만 노출
    // (사용자가 닫기만 하고 백업 안 해도 14일 cooldown 유지)
    const records = getRecords();
    if (records.length >= 5) {
      const lastManual = parseInt(localStorage.getItem('nou_last_manual_backup') || '0', 10);
      const lastReminder = parseInt(localStorage.getItem('nou_last_backup_reminder') || '0', 10);
      const daysSinceManual = (Date.now() - lastManual) / (1000 * 60 * 60 * 24);
      const daysSinceReminder = (Date.now() - lastReminder) / (1000 * 60 * 60 * 24);
      if (daysSinceManual > 14 && daysSinceReminder > 14) {
        setTimeout(() => {
          setShowBackupReminder(true);
          try { localStorage.setItem('nou_last_backup_reminder', String(Date.now())); } catch {}
        }, 3000);
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

    if (finalScores.analysisMode === 'cv_only') {
      const stats = getAiFallbackStats();
      console.error('🚨 AI 분석 실패 → CV-only fallback', {
        누적_fallback: stats.fallbackTotal,
        누적_성공: stats.successTotal,
        마지막_사유: stats.lastReason,
        사유별_횟수: stats.byReason,
        상세조회: 'window.__aiFallbackStats() 입력',
      });
    }

    clearInterval(pi); setProgress(100);
    setTimeout(() => {
      // 컨디션 브리핑용 prev record — 7일 윈도우, differentPerson skip, avgDiff > 25 skip
      const prevRecord = findRecentPrimaryRecord(finalScores);
      const todayBefore = getTodayRecords();

      // Outlier 감지: 같은 사용자 baseline 대비 종합점수 ±15 또는 피부나이 ±5 이상이면
      // "결과가 평소와 크게 달라요" 친절 안내 (차단이 아닌 사용자 자체 재측정 판단용)
      if (prevRecord && !finalScores.differentPerson) {
        const overallDiff = Math.abs((finalScores.overallScore ?? 0) - (prevRecord.overallScore ?? 0));
        const skinAgeDiff = Math.abs((finalScores.skinAge ?? 0) - (prevRecord.skinAge ?? 0));
        if (overallDiff >= 15 || skinAgeDiff >= 5) {
          finalScores.outlierWarning = true;
          finalScores.outlierReason = `평소 측정값 대비 ${overallDiff >= 15 ? `종합점수 ${overallDiff}점` : ''}${overallDiff >= 15 && skinAgeDiff >= 5 ? ' · ' : ''}${skinAgeDiff >= 5 ? `피부나이 ${skinAgeDiff}세` : ''} 차이`;
        }
      }

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
        // 데모 컨디션 브리핑용 prev — 동일 룰 적용
        const prevRecord = findRecentPrimaryRecord(scores);
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
      {!showSplash && needsLegalConsent && <ConsentModal onAccept={handleAcceptLegalConsent} />}
      {showSplash && <SplashScreen exiting={splashExiting} onAnimationEnd={() => setShowSplash(false)} />}
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
        <HistoryPage onBack={goToLanding} onMeasure={openCamera} onOpenConsult={() => setFabChatOpen(true)} onAddProduct={() => { setActiveTab('home'); setStage('routineTracker'); }} initialMode={historyInitMode} />
      )}



      {activeTab === 'care1' && (
        <RoutineTracker colorMode={colorMode} themeColors={activeThemeColors} onBack={() => setActiveTab('home')} />
      )}

      {activeTab === 'discover' && <DiscoverPage onMeasure={openCamera} onOpenConsult={() => setFabChatOpen(true)} />}

      {activeTab === 'my' && <MyPage colorMode={colorMode} setColorMode={setColorMode} onThemeChange={setActiveThemeId} onMeasure={openCamera} />}

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
          {/* Header with Logo + Weather Chip */}
          {/* Header with Logo + Weather + Scan Chip */}
          <div style={{ padding: '28px 22px 20px', position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <WeatherChip onTap={() => setWeatherSheet(true)} />
            <img src="/luasky.svg" alt="lua" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', height: 30, objectFit: 'contain' }} />
            <div onClick={() => setShowHomeEdit(true)} style={{ cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(0,0,0,0.35)">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </div>
          </div>

          {/* Background aura — very subtle (hidden in light mode) */}
          {colorMode !== 'light' && (
            <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '120%', height: '50%', background: `radial-gradient(ellipse at 50% 40%, ${activeThemeColors.accent}06 0%, transparent 60%)`, pointerEvents: 'none' }} />
          )}


          {/* ② 피부 분석 버튼 */}
          <div
            onClick={openCamera}
            style={{
              margin: '14px 20px 0',
              padding: '48px 24px 34px',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 54,
            }}
          >
            <EternalPearl size={160} animated colors={activeThemeColors} theme={colorMode} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(0,0,0,0.4)', letterSpacing: -0.3 }}>탭 하여 피부를 분석하세요</div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginTop: 12 }}>AI가 10개 지표를 정밀 분석합니다</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 28 }}>
                {['정면 셀카', '밝은 자연광', '맨 얼굴'].map(tag => (
                  <div key={tag} style={{
                    padding: '6px 14px', borderRadius: 50,
                    background: 'rgba(255,255,255,0.4)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    fontSize: 11, fontWeight: 500, color: 'var(--text-secondary, #5a6a7a)',
                  }}>{tag}</div>
                ))}
              </div>
            </div>
          </div>

          {/* ③ 현재 상태 미니 패널 */}
          {homeCards.metrics && (() => {
            const latest = getLatestRecord();
            const prev = (() => { const recs = getRecords(); return recs.length >= 2 ? recs[1] : null; })();
            const rc = getRecords().length;
            const metrics = [
              { key: 'elasticityScore', label: 'V라인', icon: <EggIcon size={14} /> },
              { key: 'poreScore', label: '모공', icon: <MicroscopeIcon size={14} /> },
              { key: 'moisture', label: '유수분', icon: <DropletIcon size={14} /> },
              { key: 'skinTone', label: '홍조', icon: <BlushIcon size={14} /> },
            ];
            if (rc === 0) return null;
            return (
              <div style={{
                margin: '11px 20px 0',
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.4)',
                backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
                overflow: 'hidden',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, padding: '8px 12px' }}>
                  {metrics.map((m) => {
                    const val = latest?.[m.key] ?? null;
                    const prevVal = prev?.[m.key] ?? null;
                    const diff = val !== null && prevVal !== null ? val - prevVal : null;
                    return (
                      <div key={m.key} style={{
                        borderRadius: 16, padding: '12px 4px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, flexShrink: 0 }}>{m.icon}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{m.label}</span>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: -0.5, marginTop: 6 }}>{val !== null ? val : '—'}</div>
                        <div style={{ fontSize: 10, fontWeight: 500, marginTop: 2, color: diff === null ? 'var(--text-muted)' : diff > 0 ? 'var(--accent-primary, #89cef5)' : diff < 0 ? '#e05545' : 'var(--text-muted)' }}>
                          {diff === null ? '기준선' : diff > 0 ? `+${diff} 좋아짐` : diff < 0 ? `${diff} 하락` : 'ㅡ'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}


          {/* 수분 + 수면 카드 (noa style) */}
          {(homeCards.water || homeCards.sleep) && (() => {
            const cupMl = 250;
            const waterGoal = 8;
            const waterMl = waterCups * cupMl;
            const waterRingR = 22, waterRingC = 2 * Math.PI * waterRingR;
            const waterFill = Math.min(waterCups / waterGoal, 1);
            const waterDash = waterRingC * waterFill;

            const sleepRingR = 22, sleepRingC = 2 * Math.PI * sleepRingR;
            const sleepFill = sleepHours ? Math.min(sleepHours / 8, 1) : 0;
            const sleepDash = sleepRingC * sleepFill;

            const cardStyle = {
              borderRadius: 20, padding: 20, cursor: 'pointer',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.4)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              minHeight: 120,
            };

            return (
              <div style={{ display: 'grid', gridTemplateColumns: (homeCards.water && homeCards.sleep) ? '1fr 1fr' : '1fr', gap: 10, margin: '12px 20px 0' }}>
                {/* 수분 카드 */}
                {homeCards.water && <div onClick={() => setShowWaterModal(true)} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0, flex: '0 0 auto' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(91,163,212,0.3))' }}><defs><linearGradient id="dropCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8E0F5"/><stop offset="100%" stopColor="#5BA3D4"/></linearGradient></defs><path d="M12 2.5c0 0-7.5 8-7.5 13a7.5 7.5 0 0015 0c0-5-7.5-13-7.5-13z" fill="url(#dropCard)" opacity="0.6"/></svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>수분</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{waterCups > 0 ? waterMl.toLocaleString() : '—'}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ml</span>
                      </div>
                      <div style={{ fontSize: 10, color: waterCups > 0 ? (waterCups >= waterGoal ? '#22C55E' : 'var(--text-muted)') : 'var(--accent-primary, #89cef5)', marginTop: 4, minHeight: 14 }}>
                        {waterCups > 0 ? (waterCups >= waterGoal ? '목표 달성!' : `${((waterGoal - waterCups) * cupMl).toLocaleString()}ml 남음`) : '기록하기'}
                      </div>
                    </div>
                    <svg width="52" height="52" viewBox="0 0 52 52">
                      <defs>
                        <linearGradient id="waterRingGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#5BA3D4" />
                          <stop offset="100%" stopColor="#B8E0F5" />
                        </linearGradient>
                      </defs>
                      <circle cx="26" cy="26" r={waterRingR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                      <circle cx="26" cy="26" r={waterRingR} fill="none" stroke="url(#waterRingGrad)" strokeWidth="5"
                        strokeDasharray={`${waterDash} ${waterRingC - waterDash}`} strokeLinecap="round"
                        transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                    </svg>
                  </div>
                </div>

                }
                {/* 수면 카드 */}
                {homeCards.sleep && <div onClick={() => setShowSleepModal(true)} style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0, flex: '0 0 auto' }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(91,106,175,0.3))' }}><defs><linearGradient id="moonCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C8D0F0"/><stop offset="100%" stopColor="#5B6AAF"/></linearGradient></defs><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="url(#moonCard)" opacity="0.6"/></svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>수면</span>
                  </div>
                  {sleepHours !== null ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{sleepHours}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>시간</span>
                        </div>
                        <div style={{ fontSize: 10, color: sleepHours >= 7 ? '#22C55E' : sleepHours >= 5 ? 'var(--text-muted)' : '#E05050', marginTop: 4, minHeight: 14 }}>
                          {sleepHours >= 7 ? '충분' : sleepHours >= 5 ? '보통' : '부족'}
                        </div>
                      </div>
                      <svg width="52" height="52" viewBox="0 0 52 52">
                        <defs>
                          <linearGradient id="sleepRingGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#5B6AAF" />
                            <stop offset="100%" stopColor="#C8D0F0" />
                          </linearGradient>
                        </defs>
                        <circle cx="26" cy="26" r={sleepRingR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                        <circle cx="26" cy="26" r={sleepRingR} fill="none" stroke="url(#sleepRingGrad)" strokeWidth="5"
                          strokeDasharray={`${sleepDash} ${sleepRingC - sleepDash}`} strokeLinecap="round"
                          transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                      </svg>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      <div>
                        <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>—</div>
                        <div style={{ fontSize: 10, color: 'var(--accent-primary, #89cef5)', marginTop: 4, minHeight: 14 }}>기록하기</div>
                      </div>
                      <svg width="52" height="52" viewBox="0 0 52 52">
                        <circle cx="26" cy="26" r={sleepRingR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                      </svg>
                    </div>
                  )}
                </div>}
              </div>
            );
          })()}

          {/* Goal Progress Card */}
          {homeCards.goal && getGoal()?.status === 'active' && (
            <div style={{ padding: '12px 0 0' }}>
              <GoalProgressCard onTap={() => setActiveTab('my')} colorMode={colorMode} />
            </div>
          )}



          </div>{/* end first screen wrapper */}

          {/* Weather Bottom Sheet — rendered via portal */}
          {weatherSheet && createPortal(
            <>
              <div onClick={() => setWeatherSheet(false)} style={{
                position: 'fixed', inset: 0, zIndex: 200,
                background: 'rgba(4,44,83,0.18)',
                backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
                opacity: 1, transition: 'opacity 200ms',
              }} />
              <div ref={weatherSheetRef} style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
                height: '62%',
                background: 'rgba(255,255,255,0.65)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '30px 30px 0 0',
                boxShadow: '0 -8px 28px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
                maxWidth: 430, margin: '0 auto',
                display: 'flex', flexDirection: 'column',
                animation: 'weatherSheetSlideUp 280ms cubic-bezier(0.32,0.72,0,1) forwards',
              }}>
                <style>{`
                  @keyframes weatherSheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
                `}</style>
                {/* Handle */}
                <div
                  onTouchStart={(e) => { weatherDragY.current = e.touches[0].clientY; }}
                  onTouchMove={(e) => {
                    if (weatherDragY.current === null) return;
                    const delta = e.touches[0].clientY - weatherDragY.current;
                    if (delta > 0) { weatherDragDelta.current = delta; if (weatherSheetRef.current) weatherSheetRef.current.style.transform = `translateY(${delta}px)`; }
                  }}
                  onTouchEnd={() => {
                    if (weatherDragDelta.current > 120) { setWeatherSheet(false); }
                    else if (weatherSheetRef.current) { weatherSheetRef.current.style.transition = 'transform 0.2s ease'; weatherSheetRef.current.style.transform = 'translateY(0)'; setTimeout(() => { if (weatherSheetRef.current) weatherSheetRef.current.style.transition = ''; }, 200); }
                    weatherDragY.current = null; weatherDragDelta.current = 0;
                  }}
                  style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 20px', cursor: 'grab' }}>
                  <div style={{ width: 47, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.15)' }} />
                </div>
                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <SkinWeather skinResult={getLatestRecord()} />
                </div>
              </div>
            </>,
            document.body,
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
                {photoQuality.issues.includes('face_yawed') && <span>얼굴이 측면으로 돌아가 있어요. 카메라를 정면으로 향해서 촬영해보세요.<br/></span>}
                {photoQuality.issues.includes('face_tilted') && <span>얼굴이 기울어져 있어요. 양쪽 눈이 수평이 되도록 자세를 잡아보세요.<br/></span>}
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
                // Key landmark indices for dots (~50 points, facedot.png 패턴)
                const dotIndices = [
                  // 이마
                  10, 67, 297, 109, 338, 151, 108, 337, 69, 299,
                  // 눈썹
                  70, 63, 105, 66, 300, 293, 334, 296,
                  // 눈
                  33, 133, 159, 145, 263, 362, 386, 374,
                  // 코
                  6, 4, 1, 2, 98, 327,
                  // 볼
                  93, 132, 116, 323, 361, 345,
                  // 입
                  0, 13, 14, 17, 61, 291, 78, 308,
                  // 턱
                  152, 148, 377, 172, 397, 176, 400, 234, 454,
                ];
                return (
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                    viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none" fill="none">
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

            {/* ── AI 분석 fallback 안내 (CV-only 모드) ── */}
            {result?.analysisMode === 'cv_only' && (
              <div className="glass-card" style={{
                animation: 'fadeUp 0.5s ease-out 0.65s both',
                background: 'rgba(96,165,250,0.10)',
                border: '1px solid rgba(96,165,250,0.35)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>ℹ️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      AI 정밀 분석이 일시 지연됐어요
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
                      네트워크 또는 분석 서버 일시 지연으로 AI 정밀 분석 대신 기본 분석(CV)으로 처리됐어요.
                      잠시 후 다시 측정하면 보통 정상 복귀됩니다.
                    </div>
                    <button
                      onClick={() => { setResult(null); setStage('landing'); }}
                      style={{
                        padding: '8px 14px', borderRadius: 10,
                        background: 'rgba(96,165,250,0.18)',
                        color: '#1d4ed8',
                        border: '1px solid rgba(96,165,250,0.3)',
                        fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                    >다시 측정하기</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── 결과 이상치 안내 (baseline 대비 큰 변동) ── */}
            {result?.outlierWarning && (
              <div className="glass-card" style={{
                animation: 'fadeUp 0.5s ease-out 0.7s both',
                background: 'rgba(245,158,11,0.10)',
                border: '1px solid rgba(245,158,11,0.35)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>⚠️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      오늘 결과가 평소와 크게 달라요
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
                      {result.outlierReason}.<br />
                      조명·각도·메이크업 차이일 가능성이 있어요.
                      같은 조건에서 한 번 더 측정하면 더 정확한 비교가 가능합니다.
                    </div>
                    <button
                      onClick={() => { setResult(null); setStage('landing'); }}
                      style={{
                        padding: '8px 14px', borderRadius: 10,
                        background: 'rgba(245,158,11,0.18)',
                        color: '#b45309',
                        border: '1px solid rgba(245,158,11,0.3)',
                        fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                    >다시 측정하기</button>
                  </div>
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
              <AiCommentCard
                aiNotes={result.aiNotes}
                aiDetails={result.aiDetails}
                accent={activeThemeColors.accent}
                analysisMode={result.analysisMode}
                makeupDetected={result.makeupDetected}
                animationDelay="0"
              />
              {changes && (() => {
                const skipKeys = ['overallScore', 'skinAge'];
                const improved = Object.values(changes).filter(c => c.improved && Math.abs(c.diff) >= 1 && !skipKeys.includes(c.key));
                const worsened = Object.values(changes).filter(c => !c.improved && Math.abs(c.diff) >= 1 && !skipKeys.includes(c.key));
                if (improved.length === 0 && worsened.length === 0) return null;

                return (
                  <div style={{
                    marginTop: 14, padding: '14px 16px', borderRadius: 14,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>지표별 변화</div>
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

            {/* ── Trend card (7일 추세) ── */}
            <TrendCard
              accent={activeThemeColors.accent}
              changes={changes}
              animationDelay="0.95s"
            />

            {/* ── Before & After slider (변화 비교) ── */}
            <div style={{ animation: 'fadeUp 0.5s ease-out 1s both' }}>
              <BeforeAfterSlider />
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
                <div className="glass-card" style={{ padding: '24px', animation: 'fadeUp 0.5s ease-out 1.15s both', boxShadow: 'none', borderRadius: 30 }}>
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
                    <button onClick={() => setFabChatOpen(true)} style={{
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
              <button onClick={() => setFabChatOpen(true)} style={{
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
      {showTabBar && activeTab !== 'home' && activeTab !== 'home2' && <div className="tab-bar-spacer" />}
      {showTabBar && activeTab === 'home' && stage === 'landing' && <div className="tab-bar-spacer" />}


      {/* ===== 고정 인사이트 카드 (홈 화면만, 접히지 않았을 때) ===== */}
      {homeCards.insight && showTabBar && activeTab === 'home' && stage === 'landing' && getLatestRecord() && !insightCollapsed && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(76px + env(safe-area-inset-bottom, 0px) + 32px)',
          left: 20, right: 20,
          zIndex: 90,
          animation: 'insightFloat 3s ease-in-out infinite',
        }}>
          {/* 접기 버튼 */}
          <div onClick={() => setInsightCollapsed(true)} style={{
            position: 'absolute', top: 18, right: 18, zIndex: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #8B95A1)" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          <AiInsightCard
            onOpenChat={() => setFabChatOpen(true)}
            onCollapse={() => setInsightCollapsed(true)}
            greeting={(() => { const h = new Date().getHours(); if (h >= 5 && h < 11) return '좋은 아침이에요'; if (h >= 11 && h < 17) return '오늘도 잘 지내고 있나요'; if (h >= 17 && h < 22) return '오늘 하루도 수고했어요'; return '조용한 시간이에요'; })() + (getProfile().nickname ? `, ${getProfile().nickname}` : '')}
            dateInfo={`${new Date().getMonth() + 1}월 ${new Date().getDate()}일 · ${(() => { const recs = getRecords(); if (!recs.length) return '오늘부터 시작'; const d = Math.floor((Date.now() - new Date(recs[recs.length - 1].date).getTime()) / 86400000); return d > 0 ? `LUA와 ${d}일째` : '오늘부터 시작'; })()}`}
          />
        </div>
      )}

      {/* ===== FAB (인사이트 카드가 없거나 접혔을 때) ===== */}
      {showTabBar && (!(homeCards.insight && activeTab === 'home' && stage === 'landing' && getLatestRecord()) || insightCollapsed) && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(76px + env(safe-area-inset-bottom, 0px) + 36px)',
          right: 21,
          zIndex: 90,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
        <div
          onClick={() => { if (insightCollapsed && activeTab === 'home' && stage === 'landing') { setInsightCollapsed(false); } else { setFabChatOpen(true); localStorage.setItem('fab_hint_dismissed', '1'); } }}
          style={{
            position: 'relative',
            width: 58, height: 58, borderRadius: '50% 50% 8px 50%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(150,215,248,0.5) 100%)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 90,
            animation: 'fabFloat 3s ease-in-out infinite',
          }}
        >
          {/* 말풍선 힌트 */}
          {!fabChatOpen && !localStorage.getItem('fab_hint_dismissed') && (
            <div onClick={(e) => { e.stopPropagation(); localStorage.setItem('fab_hint_dismissed', '1'); }} style={{
              position: 'absolute', bottom: '100%', right: 0, marginBottom: 10,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(240,240,240,0.85) 100%)',
              backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '30px 30px 4px 30px', padding: '9px 14px', whiteSpace: 'nowrap',
              border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              animation: 'fabHintIn 0.5s ease-out 1.5s both, fabHintOut 0.4s ease-in 10s both',
              fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 600, letterSpacing: -0.2,
            }}>
              피부 고민을 물어봐 ✨
            </div>
          )}
          {/* 빛 흐름 레이어 */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            borderRadius: '50% 50% 8px 50%', overflow: 'hidden', pointerEvents: 'none',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: '-100%', width: '300%', height: '100%',
              background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0.2) 55%, transparent 70%)',
              animation: 'fabShine 3.5s ease-in-out infinite',
            }} />
          </div>
          <svg width="28" height="28" viewBox="0 0 24 24" style={{ position: 'relative', zIndex: 1, animation: 'fabStarTwinkle 2.5s ease-in-out infinite', filter: 'drop-shadow(0 1px 2px rgba(100,180,230,0.5))' }}>
            <defs>
              <linearGradient id="global-fab-star" x1="0.15" y1="0.05" x2="0.85" y2="0.95">
                <stop offset="0%" stopColor="#D6EEFB" />
                <stop offset="45%" stopColor="#a8d8f5" />
                <stop offset="100%" stopColor="#6bb8e8" />
              </linearGradient>
              <linearGradient id="global-fab-star-edge" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="#c8e8fa" />
                <stop offset="100%" stopColor="#5aaad8" />
              </linearGradient>
            </defs>
            {/* 별 외곽선 — 두께감 */}
            <path fill="url(#global-fab-star-edge)" stroke="rgba(90,170,216,0.3)" strokeWidth="0.6" d="M10.48,23.25c-.15.41-.5.71-.86.75-.27.03-.78-.29-.9-.59l-1.53-4.02c-.48-1.26-1.41-2.1-2.67-2.58l-3.91-1.48c-.29-.11-.59-.51-.6-.76-.01-.39.23-.79.6-.93l3.9-1.49c1.27-.48,2.19-1.31,2.68-2.59l1.57-4.14c.08-.2.52-.44.74-.46.24-.02.77.21.86.46l1.57,4.14c.5,1.32,1.47,2.15,2.78,2.63l3.7,1.37c.31.11.66.55.67.83.02.42-.29.82-.68.97l-3.8,1.44c-1.26.48-2.2,1.32-2.67,2.58l-1.45,3.86Z"/>
            {/* 별 메인 — 약간 축소해서 테두리 보이게 */}
            <g transform="translate(0.3,0.3) scale(0.975)">
              <path fill="url(#global-fab-star)" d="M10.48,23.25c-.15.41-.5.71-.86.75-.27.03-.78-.29-.9-.59l-1.53-4.02c-.48-1.26-1.41-2.1-2.67-2.58l-3.91-1.48c-.29-.11-.59-.51-.6-.76-.01-.39.23-.79.6-.93l3.9-1.49c1.27-.48,2.19-1.31,2.68-2.59l1.57-4.14c.08-.2.52-.44.74-.46.24-.02.77.21.86.46l1.57,4.14c.5,1.32,1.47,2.15,2.78,2.63l3.7,1.37c.31.11.66.55.67.83.02.42-.29.82-.68.97l-3.8,1.44c-1.26.48-2.2,1.32-2.67,2.58l-1.45,3.86Z"/>
            </g>
            {/* 작은 별 */}
            <path fill="url(#global-fab-star-edge)" stroke="rgba(90,170,216,0.3)" strokeWidth="0.4" d="M21.48,6.29c-1.03.59-.9,2.91-2.01,2.98-1.23.08-.99-1.68-1.94-2.78-.77-.88-2.68-.63-2.74-1.78-.07-1.27,2.01-1.1,2.74-1.91.87-.95.73-2.72,1.78-2.8,1.29-.1.98,1.81,1.95,2.77.87.86,2.67.71,2.73,1.8.07,1.08-1.29,1.02-2.51,1.72Z"/>
            <g transform="translate(0.15,0.15) scale(0.988)">
              <path fill="url(#global-fab-star)" d="M21.48,6.29c-1.03.59-.9,2.91-2.01,2.98-1.23.08-.99-1.68-1.94-2.78-.77-.88-2.68-.63-2.74-1.78-.07-1.27,2.01-1.1,2.74-1.91.87-.95.73-2.72,1.78-2.8,1.29-.1.98,1.81,1.95,2.77.87.86,2.67.71,2.73,1.8.07,1.08-1.29,1.02-2.51,1.72Z"/>
            </g>
          </svg>
        </div>
        </div>
      )}

      {/* ===== HOME EDIT PAGE ===== */}
      {showHomeEdit && (
        <HomeEditPage
          cards={homeCards}
          onToggle={toggleHomeCard}
          onClose={() => setShowHomeEdit(false)}
        />
      )}

      {/* ===== WATER MODAL ===== */}
      {showWaterModal && (
        <WaterIntakeModal
          onClose={() => setShowWaterModal(false)}
          onUpdate={() => { setShowWaterModal(false); refreshWaterSleep(); }}
        />
      )}

      {/* ===== SLEEP MODAL ===== */}
      {showSleepModal && (
        <SleepInputModal
          onClose={() => setShowSleepModal(false)}
          onUpdate={() => { setShowSleepModal(false); refreshWaterSleep(); }}
        />
      )}

      {/* ===== LUA CHAT SHEET (Global) ===== */}
      <LuaChatSheet open={fabChatOpen} onClose={() => setFabChatOpen(false)} />

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

// ===== Water Intake Modal (noa style) =====
const SLEEP_QUALITIES = ['깊은 수면', '보통', '얕은 수면'];

function WaterIntakeModal({ onClose, onUpdate }) {
  const today = new Date().toISOString().slice(0, 10);
  const getWater = () => { try { return JSON.parse(localStorage.getItem('lua_water') || '{}'); } catch { return {}; } };
  const saved = getWater();
  const [cups, setCups] = useState(saved.date === today ? (saved.cups || 0) : 0);

  const cupMl = 250;
  const goalMl = 2000;
  const totalCups = Math.ceil(goalMl / cupMl);
  const fillPct = Math.min(cups / totalCups, 1);
  const currentMl = cups * cupMl;
  const goalReached = cups >= totalCups;

  const save = (n) => {
    localStorage.setItem('lua_water', JSON.stringify({ date: today, cups: n }));
  };

  const addCup = () => {
    const next = cups + 1;
    setCups(next);
    save(next);
  };

  const removeCup = () => {
    if (cups <= 0) return;
    const next = cups - 1;
    setCups(next);
    save(next);
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />

        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 20 }}>수분</div>

        {/* 물병 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ position: 'relative', width: 120, height: 160 }}>
            <svg width="120" height="160" viewBox="0 0 120 160">
              <defs>
                <clipPath id="bottleClip"><path d="M42 12 Q42 4 50 4 L70 4 Q78 4 78 12 L78 24 Q96 32 96 48 L96 140 Q96 152 84 152 L36 152 Q24 152 24 140 L24 48 Q24 32 42 24 Z" /></clipPath>
                <linearGradient id="waterFillGrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#4A9BD9" /><stop offset="100%" stopColor="#89CEF5" /></linearGradient>
              </defs>
              <path d="M42 12 Q42 4 50 4 L70 4 Q78 4 78 12 L78 24 Q96 32 96 48 L96 140 Q96 152 84 152 L36 152 Q24 152 24 140 L24 48 Q24 32 42 24 Z" fill="none" stroke="rgba(91,163,212,0.3)" strokeWidth="2" />
              <g clipPath="url(#bottleClip)">
                <rect x="20" y={152 - (fillPct * 148)} width="80" height={fillPct * 148} fill="url(#waterFillGrad)" opacity="0.7" style={{ transition: 'y 0.5s ease, height 0.5s ease' }} />
              </g>
              <text x="60" y="100" textAnchor="middle" fontSize="14" fontWeight="600" fill={fillPct > 0.5 ? '#fff' : 'var(--text-muted)'} fontFamily="var(--font-display)">{Math.round(fillPct * 100)}%</text>
            </svg>
          </div>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{currentMl.toLocaleString()}</span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 4 }}>ml</span>
          </div>
          <div style={{ fontSize: 12, color: goalReached ? '#22C55E' : 'var(--text-muted)', marginTop: 4, fontWeight: goalReached ? 600 : 400 }}>
            {goalReached ? '목표 달성!' : `목표 ${goalMl.toLocaleString()}ml · ${(goalMl - currentMl).toLocaleString()}ml 남음`}
          </div>
        </div>

        {/* 카운터 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 28 }}>
          <button onClick={removeCup} style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none',
            background: cups > 0 ? 'var(--bg-input, #F2F3F5)' : 'transparent',
            fontSize: 22, fontWeight: 600, color: cups > 0 ? 'var(--text-primary)' : 'transparent',
            cursor: cups > 0 ? 'pointer' : 'default', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>−</button>
          <div style={{ textAlign: 'center', minWidth: 60 }}>
            <span style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{cups}</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 2 }}>잔</span>
          </div>
          <button onClick={addCup} style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none',
            background: 'rgba(91,163,212,0.15)',
            fontSize: 22, fontWeight: 600, color: '#5BA3D4',
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>+</button>
        </div>

        <button onClick={onUpdate} style={{
          width: '100%', padding: '14px 0', borderRadius: 'var(--btn-radius)',
          border: 'none', background: goalReached ? '#22C55E' : 'var(--accent-primary, #89cef5)',
          color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>완료</button>
      </div>
    </div>
  );
}

// ===== Sleep Input Modal (noa style) =====
function SleepInputModal({ onClose, onUpdate }) {
  const today = new Date().toISOString().slice(0, 10);
  const getSleep = () => { try { return JSON.parse(localStorage.getItem('lua_sleep') || '{}'); } catch { return {}; } };
  const saved = getSleep();
  const [hours, setHours] = useState(saved.date === today && saved.hours ? saved.hours : 7);
  const [quality, setQuality] = useState(saved.date === today ? (saved.quality || null) : null);
  const [bedtime, setBedtime] = useState(saved.date === today ? (saved.bedtime || null) : null);
  const [wakeTime, setWakeTime] = useState(saved.date === today ? (saved.wakeTime || null) : null);
  const [mode, setMode] = useState(saved.date === today && saved.bedtime ? 'time' : 'simple');

  const calcFromTime = (bed, wake) => {
    if (!bed || !wake) return;
    const [bh, bm] = bed.split(':').map(Number);
    const [wh, wm] = wake.split(':').map(Number);
    let bedMin = bh * 60 + bm;
    let wakeMin = wh * 60 + wm;
    if (wakeMin <= bedMin) wakeMin += 24 * 60;
    setHours(Math.round(((wakeMin - bedMin) / 60) * 2) / 2);
  };

  const handleSave = () => {
    localStorage.setItem('lua_sleep', JSON.stringify({
      date: today, hours, quality,
      bedtime: bedtime || null, wakeTime: wakeTime || null,
    }));
    onUpdate?.();
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />

        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 6 }}>수면</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24 }}>
          {quality ? `${hours}시간 · ${quality}` : `${hours}시간`}
        </div>

        {/* 모드 토글 */}
        <div style={{ display: 'flex', background: 'rgba(91,106,175,.08)', borderRadius: 10, padding: 3, marginBottom: 20 }}>
          {[{ key: 'simple', label: '간단 입력' }, { key: 'time', label: '시간 입력' }].map(m => (
            <button key={m.key} onClick={() => setMode(m.key)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: mode === m.key ? 600 : 400,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: mode === m.key ? 'rgba(255,255,255,.95)' : 'transparent',
              color: mode === m.key ? '#5B6AAF' : 'var(--text-muted)',
              boxShadow: mode === m.key ? '0 1px 4px rgba(91,106,175,.15)' : 'none',
              transition: 'all 0.15s ease',
            }}>{m.label}</button>
          ))}
        </div>

        {/* 간단 입력 */}
        {mode === 'simple' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <div style={{ textAlign: 'center', minWidth: 56 }}>
              <span style={{ fontSize: 32, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{hours}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 2 }}>시간</span>
            </div>
            <div style={{ flex: 1 }}>
              <input type="range" min="2" max="12" step="0.5" value={hours}
                onChange={e => setHours(parseFloat(e.target.value))}
                style={{
                  width: '100%', height: 6, appearance: 'none', WebkitAppearance: 'none',
                  background: `linear-gradient(90deg, #5B6AAF ${((hours - 2) / 10) * 100}%, rgba(91,106,175,.15) ${((hours - 2) / 10) * 100}%)`,
                  borderRadius: 3, outline: 'none',
                }} />
            </div>
          </div>
        )}

        {/* 시간 입력 */}
        {mode === 'time' && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>잠든 시간</div>
                <input type="time" value={bedtime || ''} onChange={e => { setBedtime(e.target.value); if (e.target.value && wakeTime) calcFromTime(e.target.value, wakeTime); }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14, fontWeight: 500, border: '1px solid rgba(91,106,175,.2)', background: 'rgba(91,106,175,.04)', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', height: 42 }} />
              </div>
              <div style={{ fontSize: 16, color: '#5B6AAF', paddingBottom: 12, fontWeight: 500 }}>→</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>일어난 시간</div>
                <input type="time" value={wakeTime || ''} onChange={e => { setWakeTime(e.target.value); if (bedtime && e.target.value) calcFromTime(bedtime, e.target.value); }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14, fontWeight: 500, border: '1px solid rgba(91,106,175,.2)', background: 'rgba(91,106,175,.04)', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', height: 42 }} />
              </div>
            </div>
            {bedtime && wakeTime && (
              <div style={{ textAlign: 'center', padding: '10px 0', borderRadius: 10, background: 'rgba(91,106,175,.05)' }}>
                <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{hours}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>시간 수면</span>
              </div>
            )}
          </div>
        )}

        {/* 수면의 질 */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>수면의 질</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {SLEEP_QUALITIES.map(q => {
            const active = quality === q;
            return (
              <button key={q} onClick={() => setQuality(active ? null : q)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: active ? 600 : 400,
                  border: `1.5px solid ${active ? 'rgba(91,106,175,.4)' : 'rgba(91,106,175,.12)'}`,
                  background: active ? 'rgba(91,106,175,.1)' : 'var(--bg-input, #F2F3F5)',
                  color: active ? '#5B6AAF' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.15s ease', fontFamily: 'inherit',
                }}>{q}</button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--bg-input, #F2F3F5)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={handleSave} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: '#5B6AAF',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ===== Home Edit Page =====
function HomeEditPage({ cards, onToggle, onClose }) {
  const items = [
    { key: 'metrics', label: '피부 지표', desc: 'V라인 · 모공 · 유수분 · 홍조', icon: '📊' },
    { key: 'water', label: '수분 섭취', desc: '하루 물 섭취량 기록', icon: '💧' },
    { key: 'sleep', label: '수면', desc: '수면 시간 · 수면의 질 기록', icon: '🌙' },
    { key: 'insight', label: 'lua 인사이트', desc: 'AI 피부 조언 카드', icon: '✨' },
    { key: 'goal', label: '피부 목표', desc: '목표 달성 진행률', icon: '🎯' },
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000,
      width: '100%', maxWidth: 430, margin: '0 auto',
      background: 'linear-gradient(to bottom, #ace2fc, #ffffff)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      animation: 'homeEditSlideIn 0.3s ease',
    }}>
      <style>{`
        @keyframes homeEditSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>

      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top,0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div onClick={onClose} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>홈 화면 편집</span>
      </div>

      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          홈 화면에 표시할 카드를 선택하세요
        </div>
      </div>

      <div style={{ flex: 1, padding: '8px 0' }}>
        {items.map(item => (
          <div key={item.key} onClick={() => onToggle(item.key)} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '14px 28px', cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
            </div>
            <div style={{
              width: 48, height: 28, borderRadius: 14,
              background: cards[item.key] ? '#89cef5' : 'rgba(0,0,0,0.08)',
              position: 'relative', cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}>
              <div style={{
                position: 'absolute',
                top: 2, left: cards[item.key] ? 22 : 2,
                width: 24, height: 24, borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                transition: 'left 0.2s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

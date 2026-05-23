import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import GlobalStyles from './design/GlobalStyles';
import { compressImage, clearCompressCache, analyzePixels, pixelsToScores, generateDemoScores, checkPhotoQuality, generateSmartAdvice, QUALITY_ISSUE_LABELS } from './engine/PixelAnalysis';
import { detectLandmarks } from './engine/FaceLandmarker';
import { callVisionAI, hybridMerge, hasBaseline, getAiFallbackStats, clearAiFallbackStats } from './engine/HybridAnalysis';
import { estimateAge, preload as preloadAge } from './engine/FaceAgeEstimator';
import { preload as preloadLandmarker } from './engine/FaceLandmarker';
import { AnimatedNumber, ScoreRing, MetricBar, Tag, DetailPage } from './components/UIComponents';
import TroubleBreakdownCard from './components/TroubleBreakdownCard';
import MeasurementGuide, { isMeasureGuideDismissed } from './components/MeasurementGuide';
import BaselineCompleteModal from './components/BaselineCompleteModal';
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
import WeatherChip, { WeatherIcon } from './components/WeatherChip';
import { getWeatherData } from './storage/WeatherStorage';
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
// ConsentModal는 MyPage > 설정 > 정보에서 자율적으로 접근.
// 변호사 검토는 "첫 이용 시 동의 UI 필수"라 명시했으나, 김준 결정(UX 이탈 우려)에 따라 첫 진입 자동 표시는 보류.
// 동의 이력 인프라(ConsentLog)와 약관 텍스트는 유지.


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
  const [expandedSections, setExpandedSections] = useState({
    briefing: true, change: true, analysis: false, indicators: false, care: false, meta: false,
  });
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
  const DEFAULT_ORDER = ['metrics', 'weather', 'water', 'sleep', 'insight', 'goal'];
  const [homeCards, setHomeCards] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lua_home_cards') || 'null') || { metrics: false, weather: false, water: false, sleep: false, insight: true, goal: true }; }
    catch { return { metrics: false, weather: false, water: false, sleep: false, insight: true, goal: true }; }
  });
  const [homeCardOrder, setHomeCardOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lua_home_order') || 'null') || DEFAULT_ORDER; }
    catch { return DEFAULT_ORDER; }
  });
  const toggleHomeCard = (key) => {
    const next = { ...homeCards, [key]: !homeCards[key] };
    setHomeCards(next);
    localStorage.setItem('lua_home_cards', JSON.stringify(next));
  };
  const reorderHomeCards = (newOrder) => {
    setHomeCardOrder(newOrder);
    localStorage.setItem('lua_home_order', JSON.stringify(newOrder));
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
  const [autoInsight, setAutoInsight] = useState(null);
  const [autoInsightLoading, setAutoInsightLoading] = useState(false);
  const [baselineCompleteOpen, setBaselineCompleteOpen] = useState(false);
  const [baselineCompleteAvg, setBaselineCompleteAvg] = useState(null);
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
  // 매일 첫 진입 시 자동 체크 실행 — autoCheck=true 제품들 일괄 체크
  useEffect(() => {
    (async () => {
      try {
        const { runAutoCheckIfNeeded } = await import('./storage/TrackerStorage');
        const result = runAutoCheckIfNeeded();
        if (result.ran && result.count > 0) {
          console.log(`[AutoCheck] ${result.count}개 제품 자동 체크 완료`);
        }
      } catch {}
    })();
  }, []);

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
    // theme-color: 배터리 영역이 배경과 자연스럽게 이어지도록
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      if (showSplash) {
        meta.content = '#ffffff';
      } else if (colorMode === 'light') {
        const hasOverlay = activeTab !== 'home';
        meta.content = hasOverlay ? '#C5E3FF' : '#58aefe';
      } else {
        meta.content = '#0a1222';
      }
    }
  }, [colorMode, activeTab, showSplash]);

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
    setSaved(false); setExpandedSections({ briefing: true, change: true, analysis: false, indicators: false, care: false, meta: false }); setShowSaveToast(false); setPhotoQuality(null); refreshLandingData();
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

  // 표준 측정 가이드 modal — 진짜 카메라 진입 전 한 단계 추가.
  const [measureGuideOpen, setMeasureGuideOpen] = useState(false);

  // 가이드 dismiss 후 실제 카메라 진입
  const proceedToCamera = useCallback(() => {
    setMeasureGuideOpen(false);
    setActiveTab('home');
    if (window.isSecureContext && navigator.mediaDevices?.getUserMedia) {
      setStage('camera');
    } else {
      nativeCameraRef.current?.click();
    }
  }, []);

  // Smart camera opener: 가이드 dismiss됐으면 바로 카메라, 아니면 가이드 모달
  const openCamera = useCallback(() => {
    if (isMeasureGuideDismissed()) {
      proceedToCamera();
    } else {
      setMeasureGuideOpen(true);
    }
  }, [proceedToCamera]);

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
    setStage('analyzing'); setProgress(0); setSaved(false); setConditionBriefing(null); setBriefingLoading(false); setAutoInsight(null); setAutoInsightLoading(false);
    const pi = setInterval(() => { setProgress(p => {
      if (p >= 92) { clearInterval(pi); return 92; }
      // Slow start, steady middle, slow finish
      const increment = p < 30 ? Math.random() * 3 + 1
        : p < 60 ? Math.random() * 4 + 2
        : p < 80 ? Math.random() * 2 + 1
        : Math.random() * 1 + 0.3;
      return p + increment;
    }); }, 600);

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
      console.error(' AI 분석 실패 → CV-only fallback', {
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

      // 🎉 3회 평균 baseline 완성 시 축하 modal 트리거 (애플 setup 완료 톤)
      if (finalScores?.measureDebug?.baselineJustCompleted) {
        const avg = finalScores.measureDebug.baselineCompletedAvg?.overallScore || finalScores.overallScore;
        setBaselineCompleteAvg(avg);
        // 결과 stage 진입 후 살짝 텀 두고 modal — 측정 결과를 먼저 보여준 다음 축하
        setTimeout(() => setBaselineCompleteOpen(true), 1100);
      }

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
          nickname: (() => { try { return getProfile()?.nickname || null; } catch { return null; } })(),
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

      // 자동 인사이트 — 측정 데이터 + 등록 제품 + 라이프스타일 cross-check
      // 백그라운드 비동기. 실패 silent.
      setAutoInsightLoading(true);
      (async () => {
        try {
          const [{ getProductsWithUsageContext }, { getRecentTrend, getChanges }, { getMemoryContext }] = await Promise.all([
            import('./storage/TrackerStorage'),
            import('./storage/SkinStorage'),
            import('./storage/UserMemoryStorage'),
          ]);
          const products = (() => { try { return getProductsWithUsageContext(); } catch { return []; } })();
          const recentTrend = (() => { try { return getRecentTrend(7); } catch { return null; } })();
          const changes = (() => { try { return getChanges(); } catch { return null; } })();
          const memory = (() => { try { return getMemoryContext(); } catch { return null; } })();
          const resp = await fetch('/api/measure-insight', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              current: finalScores,
              previous: prevRecord || null,
              changes,
              products,
              lifestyle: memory?.lifestyle || [],
              recentTrend,
              nickname: (() => { try { return getProfile()?.nickname || null; } catch { return null; } })(),
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.hasInsight) {
              setAutoInsight(data);
              if (recordId) updateRecord(recordId, { autoInsight: data });
            }
          }
        } catch { /* silent */ }
        setAutoInsightLoading(false);
      })();
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
    const pi = setInterval(() => { setProgress(p => {
      if (p >= 92) { clearInterval(pi); return 92; }
      const increment = p < 30 ? Math.random() * 3 + 1
        : p < 60 ? Math.random() * 4 + 2
        : p < 80 ? Math.random() * 2 + 1
        : Math.random() * 1 + 0.3;
      return p + increment;
    }); }, 600);
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
    if (age <= 20) return '놀라운 피부! 최고의 컨디션이에요 ';
    if (age <= 24) return '건강하고 탄력 넘치는 피부 ';
    if (age <= 28) return '관리 잘 되고 있는 좋은 피부 ';
    if (age <= 33) return '조금만 더 신경 쓰면 완벽 ';
    return '지금부터 관리하면 충분히 좋아져요 ';
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

  // 시그니처 카드 한 줄 코멘트 생성
  const getSignatureComment = (r) => {
    if (!r) return '';
    const best = [
      { v: r.moisture, t: '수분의 결이 깊어졌어요' },
      { v: r.poreScore, t: '모공이 또렷이 잡혔어요' },
      { v: r.skinTone, t: '피부톤이 고르게 정돈됐어요' },
      { v: r.elasticityScore, t: '탄력의 윤곽이 살아있어요' },
      { v: r.textureScore, t: '피부결이 매끈하게 다듬어졌어요' },
      { v: r.wrinkleScore, t: '주름 없이 깨끗한 결이에요' },
    ].filter(m => m.v >= 65).sort((a, b) => b.v - a.v);
    if (best.length > 0) return best[0].t;
    if (r.overallScore >= 55) return '꾸준히 가꾸면 빛날 피부예요';
    return '오늘의 피부, 기록으로 남겨두세요';
  };

  const toggleSection = (id) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  const isFirstMeasurement = !changes;

  const showTabBar = activeTab !== 'home' || stage === 'landing' || stage === 'result';

  return (
    <div className="app-container">
      <GlobalStyles />
      <style>{`@keyframes landingPearlReveal { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }`}</style>
      {/* 약관 모달은 MyPage > 설정 > 정보에서 자율적으로 (김준 결정) */}
      {showSplash && <SplashScreen exiting={splashExiting} onAnimationEnd={() => setShowSplash(false)} />}

      {/* 표준 측정 가이드 modal — 정확도 향상 핵심 */}
      {measureGuideOpen && (
        <MeasurementGuide
          onStart={proceedToCamera}
          onClose={() => setMeasureGuideOpen(false)}
        />
      )}

      {/* 🎉 3회 baseline 완성 축하 modal */}
      {baselineCompleteOpen && (
        <BaselineCompleteModal
          avgScore={baselineCompleteAvg}
          onClose={() => setBaselineCompleteOpen(false)}
        />
      )}
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
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 8 }}>
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
          backdropFilter: 'none',
          padding: '16px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderRadius: 16,
          border: '0.5px solid rgba(255,255,255,0.6)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}></span>
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

      {/* ===== 탭별 배경 (PC에서도 전체 커버) ===== */}
      {(activeTab === 'history' || activeTab === 'care1' || activeTab === 'discover' || activeTab === 'my') && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none',
          background: 'linear-gradient(180deg, #C5E3FF 0%, #F1F7FD 100%)',
        }} />
      )}

      {/* ===== HISTORY PAGE (gallery + insights merged) ===== */}
      {activeTab === 'history' && (
        <HistoryPage onBack={goToLanding} onMeasure={openCamera} onOpenConsult={() => setFabChatOpen(true)} onAddProduct={() => { setActiveTab('home'); setStage('routineTracker'); }} initialMode={historyInitMode} />
      )}

      {activeTab === 'care1' && (
        <RoutineTracker colorMode={colorMode} themeColors={activeThemeColors} onBack={() => setActiveTab('home')} />
      )}

      {activeTab === 'discover' && (
        <DiscoverPage onMeasure={openCamera} onOpenConsult={() => setFabChatOpen(true)} />
      )}

      {activeTab === 'my' && (
        <MyPage colorMode={colorMode} setColorMode={setColorMode} onThemeChange={setActiveThemeId} onMeasure={openCamera} />
      )}

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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#ADEBB3"><path d="M12 2a1 1 0 011 1v10.586l2.293-2.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L11 13.586V3a1 1 0 011-1zM5 20a1 1 0 110 2H3a1 1 0 01-1-1v-4a1 1 0 112 0v3h1zm16 2a1 1 0 110-2h1v-3a1 1 0 112 0v4a1 1 0 01-1 1h-2z"/></svg>
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
          <div style={{ height: 'calc(100svh - 72px)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {/* Header with Logo + Weather Chip */}
          {/* Header with Logo + Weather + Scan Chip */}
          <div style={{ padding: '8px 28px 16px', position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <WeatherChip onTap={() => setWeatherSheet(true)} />
            <div onClick={() => setShowHomeEdit(true)} style={{
              width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              WebkitTapHighlightColor: 'transparent',
              marginRight: 0,
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path strokeWidth="0" d="M0 0h24v24H0z" fill="none" /><path d="M4 6l16 0" /><path d="M4 12l16 0" /><path d="M4 18l16 0" /></svg>
            </div>
          </div>

          {/* Background aura — very subtle (hidden in light mode) */}
          {colorMode !== 'light' && (
            <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '120%', height: '50%', background: `radial-gradient(ellipse at 50% 40%, ${activeThemeColors.accent}06 0%, transparent 60%)`, pointerEvents: 'none' }} />
          )}


          {/* ② 피부 분석 버튼 */}
          <div
            style={{
              flex: 1,
              margin: '0 20px',
              padding: '0 24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40,
            }}
          >
            <div onClick={openCamera} style={{ cursor: 'pointer' }}>
              <EternalPearl size={250} animated colors={activeThemeColors} theme={colorMode} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div onClick={openCamera} style={{ height: 28, overflow: 'hidden', cursor: 'pointer' }}>
                <div style={{ animation: 'heroTextSlide 21s ease-in-out infinite' }}>
                  {['탭 하여 피부를 분석하세요', 'AI가 10개 지표를 정밀 분석해줘요', '당신의 피부를 더 깊이 이해해요', '탭 하여 피부를 분석하세요'].map((text, i) => (
                    <div key={i} style={{ height: 28, lineHeight: '28px', fontSize: (i === 0 || i === 3) ? 20 : i === 2 ? 19 : 18, fontWeight: 600, letterSpacing: -0.3, color: '#ffffff', textShadow: 'none' }}>{text}</div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 28 }}>
                {['정면 셀카', '밝은 자연광', '맨 얼굴'].map(tag => (
                  <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.7)', textShadow: '0 1px 8px rgba(0,0,0,0.15)'}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="16 8.5 10.5 14.5 8 12"/></svg>
                    {tag}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ③ 홈 카드 — homeCardOrder 순서대로 렌더링 */}
          {homeCardOrder.map(cardKey => {
            if (!homeCards[cardKey]) return null;

            // 피부 지표
            if (cardKey === 'metrics') {
              const latest = getLatestRecord();
              const prev = (() => { const recs = getRecords(); return recs.length >= 2 ? recs[1] : null; })();
              if (getRecords().length === 0) return null;
              const metrics = [
                { key: 'moisture', label: '수분', icon: <DropletIcon size={14} /> },
                { key: 'wrinkleScore', label: '주름', icon: <RulerIcon size={14} /> },
                { key: 'elasticityScore', label: '탄력', icon: <DiamondIcon size={14} /> },
                { key: 'poreScore', label: '모공', icon: <MicroscopeIcon size={14} /> },
              ];
              return (
                <div key={cardKey} style={{
                  margin: '11px 20px 0', borderRadius: 20, padding: 20,
                  background: 'transparent', border: 'none',
                  backdropFilter: 'none', WebkitBackdropFilter: 'none',
                  boxShadow: 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(240,168,136,0.3))' }}><defs><linearGradient id="sparkCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFD4C0"/><stop offset="100%" stopColor="#F0A888"/></linearGradient></defs><path d="M14.504 8.522l-1.758 -4.032a.814 .814 0 0 0 -1.492 0l-1.759 4.032c-.19 .436 -.537 .784 -.973 .973l-4.032 1.759a.814 .814 0 0 0 0 1.492l4.033 1.758c.436 .19 .784 .538 .973 .974l1.759 4.033a.814 .814 0 0 0 1.492 0l1.758 -4.033c.19 -.436 .538 -.784 .974 -.974l4.033 -1.758a.814 .814 0 0 0 0 -1.492l-4.033 -1.759a1.88 1.88 0 0 1 -.974 -.973" fill="url(#sparkCard)" opacity="0.6"/></svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>피부</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
                    {metrics.map((m) => {
                      const val = latest?.[m.key] ?? null;
                      const prevVal = prev?.[m.key] ?? null;
                      const diff = val !== null && prevVal !== null ? val - prevVal : null;
                      return (
                        <div key={m.key} style={{ textAlign: 'left', padding: '0 4px' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                            <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{val !== null ? val : '—'}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>점</span>
                          </div>
                          <div style={{ fontSize: 10, marginTop: 4, minHeight: 14, color: diff === null ? 'var(--text-muted)' : diff > 0 ? 'var(--accent-primary, #6598ef)' : diff < 0 ? '#e05545' : 'var(--text-muted)' }}>
                            {m.label}{diff !== null && diff !== 0 ? ` ${Math.abs(diff)}${diff > 0 ? '▲' : '▼'}` : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // 날씨
            if (cardKey === 'weather') {
              const _w = getWeatherData();
              const humInfo = (v) => { if (v < 30) return { color: '#f59e0b', label: '매우낮음' }; if (v < 40) return { color: '#F0B870', label: '낮음' }; if (v <= 60) return { color: '#34d399', label: '적정' }; if (v <= 70) return { color: '#38bdf8', label: '높음' }; return { color: '#ADEBB3', label: '매우높음' }; };
              const airInfo = (v) => { if (v <= 30) return { color: '#34d399', label: '좋음' }; if (v <= 50) return { color: '#ADEBB3', label: '보통' }; if (v <= 80) return { color: '#F0B870', label: '나쁨' }; return { color: '#ef4444', label: '매우나쁨' }; };
              const uvInfo = (v) => { if (v <= 2) return { color: '#34d399', label: '낮음' }; if (v <= 5) return { color: '#F0B870', label: '보통' }; if (v <= 7) return { color: '#f97316', label: '높음' }; return { color: '#ef4444', label: '매우높음' }; };
              const cb = { flex: 1, borderRadius: 16, padding: '14px 12px', background: '#ffffff' };
              return (
                <div key={cardKey} onClick={() => setWeatherSheet(true)} style={{
                  margin: '10px 20px 0', cursor: 'pointer', borderRadius: 20, padding: 20,
                  background: 'transparent', border: 'none',
                  backdropFilter: 'none', WebkitBackdropFilter: 'none',
                  boxShadow: 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(101,152,239,0.3))' }}><defs><linearGradient id="weatherCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8E4F8"/><stop offset="100%" stopColor="#6AB4E0"/></linearGradient></defs><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="url(#weatherCard)" opacity="0.6"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>날씨</span>
                      </div>
                      {_w ? (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{_w.temp}°</span>
                          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{_w.condition}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>—</div>
                      )}
                    </div>
                    {_w && <WeatherIcon emoji={_w.conditionIcon} size={36} color="#6598ef" />}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { label: '습도', val: _w?.humidity, unit: '%', info: _w ? humInfo(_w.humidity) : null },
                      { label: '미세먼지', val: _w?.airQuality, unit: 'AQI', info: _w ? airInfo(_w.airQuality) : null },
                      { label: '자외선', val: _w?.uv, unit: '/10', info: _w ? uvInfo(_w.uv) : null },
                    ].map(d => (
                      <div key={d.label} style={cb}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.label}</span>
                          {d.info && <span style={{ fontSize: 9, fontWeight: 600, color: d.info.color, background: `${d.info.color}15`, padding: '2px 6px', borderRadius: 6 }}>{d.info.label}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                          <span style={{ fontSize: 24, fontWeight: 700, color: d.info ? d.info.color : 'var(--text-muted)', filter: 'brightness(0.7)' }}>{d.val ?? '—'}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // 수분
            if (cardKey === 'water') {
              const cupMl = 250, waterGoal = 8, waterMl = waterCups * cupMl;
              const rR = 22, rC = 2 * Math.PI * rR, fill = Math.min(waterCups / waterGoal, 1), dash = rC * fill;
              const cs = { borderRadius: 20, padding: 20, cursor: 'pointer', background: 'transparent', border: 'none', backdropFilter: 'none', WebkitBackdropFilter: 'none', boxShadow: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 120 };
              // Check if sleep is next in order for grid pairing
              const myIdx = homeCardOrder.indexOf('water');
              const sleepIdx = homeCardOrder.indexOf('sleep');
              const paired = homeCards.sleep && sleepIdx === myIdx + 1;
              if (paired) {
                // Render water+sleep together
                const sR = 22, sC = 2 * Math.PI * sR, sFill = sleepHours ? Math.min(sleepHours / 8, 1) : 0, sDash = sC * sFill;
                return (
                  <div key="water_sleep" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '12px 20px 0' }}>
                    <div onClick={() => setShowWaterModal(true)} style={cs}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(91,163,212,0.3))' }}><defs><linearGradient id="dropCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8E0F5"/><stop offset="100%" stopColor="#5BA3D4"/></linearGradient></defs><path d="M12 2.5c0 0-7.5 8-7.5 13a7.5 7.5 0 0015 0c0-5-7.5-13-7.5-13z" fill="url(#dropCard)" opacity="0.6"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>수분</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                            <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{waterCups > 0 ? waterMl.toLocaleString() : '—'}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ml</span>
                          </div>
                          <div style={{ fontSize: 10, color: waterCups > 0 ? (waterCups >= waterGoal ? '#22C55E' : 'var(--text-muted)') : 'var(--accent-primary, #6598ef)', marginTop: 4, minHeight: 14 }}>
                            {waterCups > 0 ? (waterCups >= waterGoal ? '목표 달성!' : `${((waterGoal - waterCups) * cupMl).toLocaleString()}ml 남음`) : '기록하기'}
                          </div>
                        </div>
                        <svg width="52" height="52" viewBox="0 0 52 52">
                          <defs><linearGradient id="waterRingGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#5BA3D4" /><stop offset="100%" stopColor="#B8E0F5" /></linearGradient></defs>
                          <circle cx="26" cy="26" r={rR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                          <circle cx="26" cy="26" r={rR} fill="none" stroke="url(#waterRingGrad)" strokeWidth="5" strokeDasharray={`${dash} ${rC - dash}`} strokeLinecap="round" transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                        </svg>
                      </div>
                    </div>
                    <div onClick={() => setShowSleepModal(true)} style={cs}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
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
                            <div style={{ fontSize: 10, color: sleepHours >= 7 ? '#22C55E' : sleepHours >= 5 ? 'var(--text-muted)' : '#E05050', marginTop: 4, minHeight: 14 }}>{sleepHours >= 7 ? '충분' : sleepHours >= 5 ? '보통' : '부족'}</div>
                          </div>
                          <svg width="52" height="52" viewBox="0 0 52 52">
                            <defs><linearGradient id="sleepRingGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#5B6AAF" /><stop offset="100%" stopColor="#C8D0F0" /></linearGradient></defs>
                            <circle cx="26" cy="26" r={sR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                            <circle cx="26" cy="26" r={sR} fill="none" stroke="url(#sleepRingGrad)" strokeWidth="5" strokeDasharray={`${sDash} ${sC - sDash}`} strokeLinecap="round" transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                          </svg>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                          <div>
                            <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>—</div>
                            <div style={{ fontSize: 10, color: 'var(--accent-primary, #6598ef)', marginTop: 4, minHeight: 14 }}>기록하기</div>
                          </div>
                          <svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r={sR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" /></svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              // Water alone
              return (
                <div key={cardKey} style={{ margin: '12px 20px 0' }}>
                  <div onClick={() => setShowWaterModal(true)} style={cs}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1.5px rgba(91,163,212,0.3))' }}><defs><linearGradient id="dropCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#B8E0F5"/><stop offset="100%" stopColor="#5BA3D4"/></linearGradient></defs><path d="M12 2.5c0 0-7.5 8-7.5 13a7.5 7.5 0 0015 0c0-5-7.5-13-7.5-13z" fill="url(#dropCard)" opacity="0.6"/></svg>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#b1b8ba' }}>수분</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>{waterCups > 0 ? (waterCups * 250).toLocaleString() : '—'}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ml</span>
                        </div>
                        <div style={{ fontSize: 10, color: waterCups > 0 ? (waterCups >= 8 ? '#22C55E' : 'var(--text-muted)') : 'var(--accent-primary, #6598ef)', marginTop: 4, minHeight: 14 }}>
                          {waterCups > 0 ? (waterCups >= 8 ? '목표 달성!' : `${((8 - waterCups) * 250).toLocaleString()}ml 남음`) : '기록하기'}
                        </div>
                      </div>
                      <svg width="52" height="52" viewBox="0 0 52 52">
                        <defs><linearGradient id="waterRingGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#5BA3D4" /><stop offset="100%" stopColor="#B8E0F5" /></linearGradient></defs>
                        <circle cx="26" cy="26" r={rR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                        <circle cx="26" cy="26" r={rR} fill="none" stroke="url(#waterRingGrad)" strokeWidth="5" strokeDasharray={`${dash} ${rC - dash}`} strokeLinecap="round" transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            }

            // 수면 (water가 바로 앞에 있으면 이미 paired로 렌더링됨 → skip)
            if (cardKey === 'sleep') {
              const waterIdx = homeCardOrder.indexOf('water');
              const sleepIdx = homeCardOrder.indexOf('sleep');
              if (homeCards.water && waterIdx === sleepIdx - 1) return null; // already rendered with water
              const sR = 22, sC = 2 * Math.PI * sR, sFill = sleepHours ? Math.min(sleepHours / 8, 1) : 0, sDash = sC * sFill;
              const cs = { borderRadius: 20, padding: 20, cursor: 'pointer', background: 'transparent', border: 'none', backdropFilter: 'none', WebkitBackdropFilter: 'none', boxShadow: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 120 };
              return (
                <div key={cardKey} style={{ margin: '12px 20px 0' }}>
                  <div onClick={() => setShowSleepModal(true)} style={cs}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
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
                          <div style={{ fontSize: 10, color: sleepHours >= 7 ? '#22C55E' : sleepHours >= 5 ? 'var(--text-muted)' : '#E05050', marginTop: 4, minHeight: 14 }}>{sleepHours >= 7 ? '충분' : sleepHours >= 5 ? '보통' : '부족'}</div>
                        </div>
                        <svg width="52" height="52" viewBox="0 0 52 52">
                          <defs><linearGradient id="sleepRingGrad2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#5B6AAF" /><stop offset="100%" stopColor="#C8D0F0" /></linearGradient></defs>
                          <circle cx="26" cy="26" r={sR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
                          <circle cx="26" cy="26" r={sR} fill="none" stroke="url(#sleepRingGrad2)" strokeWidth="5" strokeDasharray={`${sDash} ${sC - sDash}`} strokeLinecap="round" transform="rotate(-90 26 26)" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                        </svg>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                        <div>
                          <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>—</div>
                          <div style={{ fontSize: 10, color: 'var(--accent-primary, #6598ef)', marginTop: 4, minHeight: 14 }}>기록하기</div>
                        </div>
                        <svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r={sR} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" /></svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // 피부 목표
            if (cardKey === 'goal') {
              if (getGoal()?.status !== 'active') return null;
              return (
                <div key={cardKey} style={{ padding: '12px 0 0' }}>
                  <GoalProgressCard onTap={() => setActiveTab('my')} colorMode={colorMode} />
                </div>
              );
            }

            // insight는 fixed overlay로 별도 처리
            return null;
          })}



          </div>{/* end first screen wrapper */}

          {/* Weather Bottom Sheet — rendered via portal */}
          {weatherSheet && createPortal(
            <>
              <div onClick={() => setWeatherSheet(false)} style={{
                position: 'fixed', inset: 0, zIndex: 200,
                background: 'rgba(4,44,83,0.18)',
                backdropFilter: 'none', WebkitBackdropFilter: 'none',
                opacity: 1, transition: 'opacity 200ms',
              }} />
              <div ref={weatherSheetRef} style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
                height: '62%',
                background: '#ffffff',
                backdropFilter: 'none', WebkitBackdropFilter: 'none',
                border: 'none',
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
                  <div style={{ width: 47, height: 4, borderRadius: 2, background: '#ececec' }} />
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
        // Quality check mapping
        const q = photoQuality || { passed: true, issues: [], brightness: 128, sharpness: 10, yawAsymmetry: 0, rollTilt: 0, faceRatio: 0.1 };
        // 3-level: good / moderate / warning
        const frontal = q.issues.includes('face_yawed') ? { status: 'warning', label: '재촬영 권장' }
          : q.issues.includes('face_tilted') ? { status: 'moderate', label: '보통' }
          : { status: 'good', label: '양호' };
        const lighting = q.issues.includes('too_dark') ? (q.brightness < 120 ? { status: 'warning', label: '재촬영 권장' } : { status: 'moderate', label: '보통' })
          : q.issues.includes('too_bright') ? (q.brightness > 175 ? { status: 'warning', label: '재촬영 권장' } : { status: 'moderate', label: '보통' })
          : { status: 'good', label: '양호' };
        const sharp = q.issues.includes('blurry') ? (q.sharpness < 6 ? { status: 'warning', label: '재촬영 권장' } : { status: 'moderate', label: '보통' })
          : { status: 'good', label: '양호' };
        const regions = q.issues.includes('no_face') ? { count: 0, status: 'warning' }
          : q.issues.includes('face_too_small') ? { count: 5, status: 'moderate' }
          : { count: 7, status: 'good' };
        const hasWarning = [frontal, lighting, sharp, regions].some(r => r.status === 'warning');
        const hasModerate = [frontal, lighting, sharp, regions].some(r => r.status === 'moderate');
        const allGood = !hasWarning && !hasModerate;
        // critical(측정 불가능 수준) 있으면 차단. warning만 있으면 진행 가능.
        const isBlocked = q.passable === false;

        const checkIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="#1976D2"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.707 8.707l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L11 13.586l4.293-4.293a1 1 0 111.414 1.414z"/></svg>;
        const modIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="#999"><path d="M12 1.67L1.21 21.5h21.57L12 1.67zm1 14.83h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>;
        const warnIcon = <svg width="12" height="12" viewBox="0 0 24 24" fill="#A32D2D"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>;
        const statusIcon = (s) => s === 'good' ? checkIcon : s === 'moderate' ? modIcon : warnIcon;

        const QualityRow = ({ label, value, icon, isLast }) => (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 0',
            borderBottom: isLast ? 'none' : '0.5px solid rgba(4, 44, 83, 0.08)',
          }}>
            <span style={{ color: '#185FA5', fontSize: 11, fontWeight: 400, letterSpacing: 0.2 }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {icon}
              <span style={{ color: '#042C53', fontSize: 11, fontWeight: 500 }}>{value}</span>
            </div>
          </div>
        );

        return (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200 }}>
          {/* Full-screen photo */}
          <img src={image} alt="selfie" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
          }} />

          {/* Cinematic vignette */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 50% 44%, transparent 30%, rgba(0,0,0,0.3) 100%)',
          }} />

          {/* Back button */}
          <button onClick={reset} style={{
            position: 'absolute', top: 'calc(12px + env(safe-area-inset-top, 0px))', left: 12,
            width: 32, height: 32, borderRadius: '50%',
            background: '#ffffff', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#042C53" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M5 12l6-6"/><path d="M5 12l6 6"/></svg>
          </button>

          {/* Status chip */}
          <div style={{
            position: 'absolute', top: 'calc(56px + env(safe-area-inset-top, 0px))',
            left: '50%', transform: 'translateX(-50%)',
            padding: '6px 11px', background: 'rgba(4, 44, 83, 0.78)',
            borderRadius: 14, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10,
          }}>
            {allGood
              ? <svg width="10" height="10" viewBox="0 0 24 24" fill="#7EC8E3"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.707 8.707l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L11 13.586l4.293-4.293a1 1 0 111.414 1.414z"/></svg>
              : <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#A32D2D' }} />
            }
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 500 }}>
              {allGood ? '촬영 품질 검토 완료' : '일부 항목을 확인해주세요'}
            </span>
          </div>

          {/* Bottom gradient — sky blue */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
            background: 'linear-gradient(180deg, transparent 0%, rgba(135, 206, 235, 0.45) 100%)',
            pointerEvents: 'none',
          }} />

          {/* Bottom: Quality indicators + CTA */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '18px 20px calc(22px + env(safe-area-inset-bottom, 0px))',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            {/* Quality indicators — inline, same style as camera conditions */}
            <div style={{ display: 'flex', gap: 18, justifyContent: 'center' }}>
              {[
                { label: '정렬', s: frontal.status, v: frontal.label },
                { label: '조명', s: lighting.status, v: lighting.label },
                { label: '화질', s: sharp.status, v: sharp.label },
              ].map(({ label, s, v }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: 500 }}>{label}</span>
                  {s === 'good' ? <svg width="10" height="10" viewBox="0 0 24 24" fill="#7EC8E3"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.707 8.707l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L11 13.586l4.293-4.293a1 1 0 111.414 1.414z"/></svg>
                   : s === 'moderate' ? <svg width="10" height="10" viewBox="0 0 24 24" fill="#999"><path d="M12 1.67L1.21 21.5h21.57L12 1.67zm1 14.83h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                   : <svg width="10" height="10" viewBox="0 0 24 24" fill="#A32D2D"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>}
                  <span style={{
                    fontSize: 10, fontWeight: 400,
                    color: s === 'good' ? 'rgba(126,200,227,0.9)' : s === 'moderate' ? 'rgba(255,255,255,0.5)' : 'rgba(163,45,45,0.9)',
                  }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Critical 안내 — 측정 차단 사유 명확히 */}
            {isBlocked && q.critical?.length > 0 && (
              <div style={{
                width: '100%', padding: '12px 14px', marginBottom: 12,
                background: 'rgba(220,80,80,0.18)',
                border: '1px solid rgba(220,80,80,0.32)',
                borderRadius: 12,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ flexShrink: 0, display: 'flex' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#6598ef" stroke="none"><path d="M12 1.67c.955 0 1.845 .467 2.39 1.247l.105 .16l8.114 13.548a2.914 2.914 0 0 1 -2.307 4.363l-.195 .012h-16.214a2.914 2.914 0 0 1 -2.513 -4.4l8.114 -13.548a2.914 2.914 0 0 1 2.506 -1.382zm.01 13.33l-.127 .007a1 1 0 0 0 0 1.986l.117 .007l.127 -.007a1 1 0 0 0 0 -1.986l-.117 -.007zm-.01 -7a1 1 0 0 0 -.993 .883l-.007 .117v4l.007 .117a1 1 0 0 0 1.986 0l.007 -.117v-4l-.007 -.117a1 1 0 0 0 -.993 -.883z" /></svg></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
                    {QUALITY_ISSUE_LABELS[q.critical[0]]?.title || '재촬영이 필요해요'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.92)', lineHeight: 1.5 }}>
                    {QUALITY_ISSUE_LABELS[q.critical[0]]?.advice || '다시 촬영해주세요.'}
                  </div>
                </div>
              </div>
            )}

            {/* CTA buttons */}
            <div style={{ width: '100%' }}>
              <button onClick={isBlocked ? undefined : startAnalysis} disabled={isBlocked} style={{
                width: '100%', height: 50, borderRadius: 14, border: 'none',
                background: isBlocked ? 'rgba(255,255,255,0.25)' : '#7EC8E3',
                color: isBlocked ? 'rgba(255,255,255,0.5)' : '#fff',
                fontSize: 15, fontWeight: 600,
                cursor: isBlocked ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                marginBottom: 8,
              }}>
                {isBlocked ? '재촬영이 필요해요'
                  : allGood ? 'AI 피부 분석 시작'
                  : '이대로 분석하기'}
              </button>
              <button onClick={allGood ? () => fileRef.current?.click() : () => setStage('camera')} style={{
                width: '100%', height: 40, borderRadius: 14,
                border: 'none',
                background: 'transparent',
                color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {allGood ? '다른 사진 선택' : '다시 촬영하기'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ===== ANALYZING ===== */}
      {stage === 'analyzing' && (() => {
        return (
        <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200 }}>
          {/* Full-screen photo */}
          {image && (
            <img src={image} alt="" style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', display: 'block',
            }} />
          )}

          {/* Cinematic vignette */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 50% 44%, rgba(0,0,0,0.1) 20%, rgba(0,0,0,0.5) 100%)',
          }} />

          {/* Circular progress ring */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 220, height: 220, pointerEvents: 'none',
          }}>
            <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)' }}>
              {/* Track */}
              <circle cx="110" cy="110" r="106" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
              {/* Progress fill */}
              <circle cx="110" cy="110" r="106" fill="none"
                stroke="rgba(126,200,227,0.7)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 106}`}
                strokeDashoffset={`${2 * Math.PI * 106 * (1 - Math.min(progress, 100) / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
              />
            </svg>
          </div>

          {/* Status chip */}
          <div style={{
            position: 'absolute', top: 'calc(56px + env(safe-area-inset-top, 0px))',
            left: '50%', transform: 'translateX(-50%)',
            padding: '6px 11px', background: 'rgba(4, 44, 83, 0.78)',
            borderRadius: 14, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10,
          }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#7EC8E3',
              animation: 'pulseChip 1.5s ease-in-out infinite',
            }} />
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 500 }}>
              {getProgressText(progress)}
            </span>
          </div>

          {/* Bottom gradient */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%',
            background: 'linear-gradient(180deg, transparent 0%, rgba(135, 206, 235, 0.45) 100%)',
            pointerEvents: 'none',
          }} />

          {/* Bottom progress UI */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '18px 20px calc(22px + env(safe-area-inset-bottom, 0px))',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}>
            {/* Title */}
            <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: 0, letterSpacing: -0.3 }}>
              피부 분석중
            </p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: 0 }}>
              수분 · 탄력 · 피부결을 분석하고 있어요
            </p>

            {/* Progress bar */}
            <div style={{ width: '100%', maxWidth: 320 }}>
              <div style={{ height: 2, borderRadius: 1, background: '#ffffff', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{
                  height: '100%', borderRadius: 1,
                  background: '#7EC8E3',
                  width: `${Math.min(progress, 100)}%`,
                  transition: 'width 0.4s',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{getProgressText(progress)}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{Math.round(Math.min(progress, 99))}%</span>
              </div>
            </div>

            {/* Tip */}
            <p key={getProgressTip(progress)} style={{
              color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center',
              margin: '8px 0 0', letterSpacing: -0.2, lineHeight: 1.5,
              animation: 'fadeIn 0.6s ease',
            }}>
              {getProgressTip(progress)}
            </p>
          </div>
        </div>
        );
      })()}

      {/* ===== RESULT ===== */}
      {stage === 'result' && result && (() => {
        const sigScore = result.overallScore;
        const sigLevel = sigScore >= 85 ? 'S' : sigScore >= 70 ? 'A' : sigScore >= 55 ? 'B' : sigScore >= 40 ? 'C' : 'D';
        const sigComment = getSignatureComment(result);
        const sigDate = new Date().toLocaleDateString('sv-SE').replace(/-/g, '.');
        const sigChange = changes?.overallScore;
        return (
        <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)' }}>

          {/* ═══════ Nav Bar ═══════ */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 20,
            padding: '48px 14px 8px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
            background: 'transparent',
          }}>
            <button onClick={reset} style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#042C53" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M5 12l6-6"/><path d="M5 12l6 6"/></svg>
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleSave} disabled={saved} style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {saved ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#042C53"><path d="M14 2a5 5 0 015 5v14a1 1 0 01-1.555.832L12 18.202l-5.445 3.63A1 1 0 015 21V7a5 5 0 015-5h4z"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#042C53" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4h6a2 2 0 012 2v14l-5-3-5 3V6a2 2 0 012-2"/></svg>
                )}
              </button>
              <button onClick={handleShare} style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#042C53" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15a2 2 0 100-4 2 2 0 000 4z"/><path d="M18 6a2 2 0 100-4 2 2 0 000 4z"/><path d="M18 22a2 2 0 100-4 2 2 0 000 4z"/><path d="M7.7 14.3l8.6 4.4"/><path d="M16.3 5.7l-8.6 4.4"/></svg>
              </button>
            </div>
          </div>

          {/* ═══════ 시그니처 카드 (공유친화카드) ═══════ */}
          <div style={{ padding: '0 16px 16px' }}>
            <div role="region" aria-label="피부 측정 결과 시그니처 카드" style={{
              borderRadius: 16,
              boxShadow: '0 4px 16px rgba(4, 44, 83, 0.1)',
              overflow: 'hidden',
              aspectRatio: '4 / 5',
              position: 'relative',
              animation: 'fadeUp 0.6s ease-out 0.1s both',
            }}>
              {/* 셀카 영역 (카드 꽉 채움) */}
              <div ref={photoContainerRef} style={{
                position: 'absolute', inset: 0,
              }}>
                {image ? (
                  <img src={image} alt={`${sigDate} 측정 셀카`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#DCEEFB' }} />
                )}
              </div>

              {/* 헤더: SKIN REPORT + 날짜 (사진 위 오버레이) */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px',
                background: 'linear-gradient(180deg, rgba(4, 44, 83, 0.35) 0%, transparent 100%)',
              }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#FFFFFF', letterSpacing: 2 }}>SKIN REPORT</span>
                <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.85)' }}>{sigDate}</span>
              </div>

              {/* 시그니처 핫존 (하단 그라데이션 + 정보) */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
                background: 'linear-gradient(180deg, transparent 0%, rgba(4, 44, 83, 0.7) 80%)',
                padding: '60px 14px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
              }}>
                {/* 시그니처 한 줄 */}
                <div style={{
                  fontSize: 16, fontWeight: 300, fontStyle: 'italic',
                  color: '#FFFFFF', letterSpacing: 0.3, lineHeight: 1.4,
                  marginBottom: 8, textAlign: 'center',
                }}>
                  "{sigComment}"
                </div>
                {/* 점수 + 레벨 */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                  <span style={{
                    fontSize: 34, fontWeight: 400, color: '#FFFFFF',
                    letterSpacing: -0.5, lineHeight: 1,
                  }}>{result.overallScore}</span>
                  <span style={{
                    fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.7)',
                    letterSpacing: 2,
                  }}>LEVEL {sigLevel}</span>
                </div>
                {/* 태그 3개 */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 14, fontWeight: 500, padding: '3px 12px', borderRadius: 8,
                    background: '#ffffff', color: '#FFFFFF',
                  }}>{result.skinType}</span>
                  <span style={{
                    fontSize: 14, fontWeight: 500, padding: '3px 12px', borderRadius: 8,
                    background: '#ffffff', color: '#FFFFFF',
                  }}>{result.skinAge}세</span>
                  {sigChange ? (
                    sigChange.diff !== 0 ? (
                      <span style={{
                        fontSize: 14, fontWeight: 500, padding: '3px 12px', borderRadius: 8,
                        background: sigChange.improved ? 'rgba(100,200,255,0.25)' : 'rgba(255,150,150,0.25)',
                        color: '#FFFFFF',
                      }}>{sigChange.diff > 0 ? '↑' : '↓'}{Math.abs(sigChange.diff)}</span>
                    ) : (
                      <span style={{
                        fontSize: 14, fontWeight: 500, padding: '3px 12px', borderRadius: 8,
                        background: '#ffffff', color: '#FFFFFF',
                      }}>유지</span>
                    )
                  ) : (
                    <span style={{
                      fontSize: 14, fontWeight: 500, padding: '3px 12px', borderRadius: 8,
                      background: '#ffffff', color: '#FFFFFF',
                    }}>첫 측정</span>
                  )}
                </div>
                {/* LUA 로고 */}
                <div>
                  <span style={{
                    fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)',
                    letterSpacing: 3,
                  }}>LUA</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════ Divider 1: 자세히 알아보기 ═══════ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '28px 24px 20px' }}>
            <div style={{ flex: 1, height: 0.5, background: 'rgba(4, 44, 83, 0.15)' }} />
            <span style={{ fontSize: 10, fontWeight: 500, color: '#185FA5', letterSpacing: 1.5, whiteSpace: 'nowrap' }}>자세히 알아보기 ↓</span>
            <div style={{ flex: 1, height: 0.5, background: 'rgba(4, 44, 83, 0.15)' }} />
          </div>

          {/* ═══════ Section 1: 컨디션 브리핑 ═══════ */}
          <div style={{ margin: '0 14px 10px', background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 4px rgba(4, 44, 83, 0.04)', overflow: 'hidden' }}>
            <button onClick={() => toggleSection('briefing')} style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: expandedSections.briefing ? '14px 16px 8px' : '14px 16px',
              background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#042C53' }}>컨디션 브리핑</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round"
                style={{ transition: 'transform 0.3s ease', transform: expandedSections.briefing ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {expandedSections.briefing && (
              <div style={{ padding: '0 16px 16px', animation: 'fadeUp 0.3s ease-out' }}>
                {conditionBriefing && (() => {
                  const score = result.conditionScore ?? result.overallScore;
                  const grade = score >= 85 ? { letter: 'S', label: '최상' }
                    : score >= 70 ? { letter: 'A', label: '우수' }
                    : score >= 55 ? { letter: 'B', label: '양호' }
                    : score >= 40 ? { letter: 'C', label: '보통' }
                    : { letter: 'D', label: '관리필요' };
                  return (
                    <>
                      {/* Grade + label */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 28, fontWeight: 300, color: '#042C53' }}>{grade.letter}</span>
                        <span style={{ fontSize: 10, color: '#185FA5' }}>컨디션 등급</span>
                      </div>
                      {/* Briefing text */}
                      <p style={{ fontSize: 11, fontWeight: 400, color: '#042C53', lineHeight: 1.6, margin: '0 0 12px' }}>{conditionBriefing}</p>
                      {/* 5 condition metrics grid */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginBottom: 10 }}>
                        {[
                          { label: '수분', value: result.moisture },
                          { label: '유분밸런스', value: result.oilBalance },
                          { label: '피부톤', value: result.skinTone },
                          { label: '트러블', value: Math.max(0, Math.round(100 - result.troubleCount * 8.5)) },
                          { label: '다크서클', value: result.darkCircleScore },
                        ].map(m => (
                          <div key={m.label} style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#042C53' }}>{m.value}</div>
                            <div style={{ fontSize: 8, color: '#185FA5', marginTop: 2 }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                      {/* Today's change badges */}
                      {changes && getTodayRecords().length > 1 && (() => {
                        const keyMetrics = ['moisture', 'oilBalance', 'skinTone', 'darkCircleScore'];
                        const badges = keyMetrics
                          .map(k => changes[k])
                          .filter(c => c && Math.abs(c.diff) >= 2);
                        if (badges.length === 0) return null;
                        return (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ═══════ Section: 기준점 구축 진행 안내 — 첫 3회 측정 사용자 ═══════ */}
          {result?.measureDebug?.baselineBuild?.stage === 'building' && (() => {
            const b = result.measureDebug.baselineBuild;
            const remaining = Math.max(0, b.target - b.count);
            const isComplete = b.count >= b.target;
            return (
              <div style={{
                margin: '0 14px 10px',
                background: 'linear-gradient(135deg, rgba(101,152,239,0.12), rgba(101,152,239,0.05))',
                border: '1px solid rgba(101,152,239,0.32)',
                borderRadius: 14, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(101,152,239,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#6598ef"><path d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0 -20zm0 4a6 6 0 1 0 0 12a6 6 0 0 0 0 -12zm0 3a3 3 0 1 1 0 6a3 3 0 0 1 0 -6z"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6598ef', letterSpacing: 0.3, marginBottom: 2 }}>기준점 구축 중</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#042C53', letterSpacing: -0.2 }}>
                      {b.count}회 완료 · {remaining}회 더 측정해주세요
                    </div>
                  </div>
                </div>

                {/* Progress dots */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {Array.from({ length: b.target }).map((_, i) => (
                    <div key={i} style={{
                      flex: 1, height: 6, borderRadius: 3,
                      background: i < b.count
                        ? 'linear-gradient(90deg, #6598ef, #8ac4fe)'
                        : 'rgba(101,152,239,0.18)',
                      transition: 'background 0.4s',
                    }} />
                  ))}
                </div>

                <div style={{
                  fontSize: 12, color: '#374E66', lineHeight: 1.6,
                  background: 'rgba(255,255,255,0.55)',
                  padding: '8px 10px', borderRadius: 10,
                  wordBreak: 'keep-all',
                  marginBottom: 12,
                }}>
                  💡 정확한 기준점을 위해 <strong>같은 조명·환경·시간대</strong>에서 측정해주세요. 완성되면 추후 모든 측정이 안정적으로 추적돼요.
                </div>

                {/* 큰 CTA — 다음 측정 시작 (애플 setup 흐름) */}
                <button
                  onClick={() => openCamera()}
                  style={{
                    width: '100%', padding: '14px',
                    background: 'linear-gradient(135deg, #6598ef, #8ac4fe)',
                    border: 'none', borderRadius: 14,
                    color: '#fff', fontSize: 15, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: '0 6px 18px rgba(101,152,239,0.32)',
                    letterSpacing: -0.2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1 -2 2H3a2 2 0 0 1 -2 -2V8a2 2 0 0 1 2 -2h4l2 -3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {remaining === 1 ? '마지막 측정 시작' : `${b.count + 1}회차 측정 시작`}
                </button>

                {/* isDifferentPerson 안내 — building 끊긴 경우 */}
                {result.measureDebug.isDifferentPerson && (
                  <div style={{
                    marginTop: 10, padding: '8px 10px', borderRadius: 10,
                    background: 'rgba(255,180,80,0.16)',
                    border: '1px solid rgba(255,180,80,0.32)',
                    fontSize: 11.5, color: '#A86A0F', lineHeight: 1.55,
                  }}>
                    ⚠️ 이번 측정은 동일인 인식이 약했어요. 다음 측정 시 정면·자연광에서 시도해주세요.
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══════ Section: AI 자동 인사이트 (컨디션 브리핑 다음) ═══════ */}
          {(autoInsight || autoInsightLoading) && (() => {
            if (autoInsightLoading && !autoInsight) {
              return (
                <div style={{
                  margin: '0 14px 10px',
                  background: 'linear-gradient(135deg, rgba(88,174,254,0.10), rgba(138,196,254,0.08))',
                  border: '1px solid rgba(88,174,254,0.25)',
                  borderRadius: 14, padding: '14px 16px',
                  display: 'flex', gap: 10, alignItems: 'center',
                }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(88,174,254,0.3)',
                    borderTopColor: '#58aefe',
                    animation: 'autoInsightSpin 0.9s linear infinite',
                  }} />
                  <span style={{ fontSize: 12, color: '#3D7CA8', fontWeight: 600 }}>AI가 변화 원인 분석 중…</span>
                  <style>{`@keyframes autoInsightSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
                </div>
              );
            }
            const sev = autoInsight.severity;
            const palette = sev === 'attention'
              ? { bg: 'rgba(255,180,80,0.14)', border: 'rgba(255,180,80,0.35)', accent: '#C26A0F', dot: '#F0A030' }
              : sev === 'good'
              ? { bg: 'rgba(160,220,170,0.16)', border: 'rgba(140,200,150,0.38)', accent: '#2E7D44', dot: '#5BB872' }
              : { bg: 'rgba(88,174,254,0.10)', border: 'rgba(88,174,254,0.28)', accent: '#3D7CA8', dot: '#58aefe' };
            return (
              <div style={{
                margin: '0 14px 10px',
                background: palette.bg,
                border: `1px solid ${palette.border}`,
                borderRadius: 14, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: palette.dot, flexShrink: 0 }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: palette.accent, letterSpacing: 0.3 }}>AI 자동 인사이트</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#042C53', marginBottom: 6, lineHeight: 1.4 }}>
                  {autoInsight.headline}
                </div>
                {autoInsight.cause && (
                  <div style={{ fontSize: 12.5, color: '#374E66', lineHeight: 1.6, marginBottom: 8, wordBreak: 'keep-all' }}>
                    {autoInsight.cause}
                  </div>
                )}
                {autoInsight.action && (
                  <div style={{
                    fontSize: 12, color: palette.accent, fontWeight: 600,
                    background: 'rgba(255,255,255,0.55)',
                    padding: '8px 10px', borderRadius: 10,
                    lineHeight: 1.55, wordBreak: 'keep-all',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#6598ef" stroke="none" style={{ verticalAlign: 'middle', marginRight: 4 }}><path d="M4 11a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1zm16 0a1 1 0 0 1 .117 1.993l-.117 .007h-1a1 1 0 0 1 -.117 -1.993l.117 -.007h1zm-2.834 -6.304l.094 .083l.7 .7a1 1 0 0 1 -1.32 1.497l-.094 -.083l-.7 -.7a1 1 0 0 1 1.218 -1.567l.102 .07zm-11.332 0a1 1 0 0 1 .083 1.32l-.083 .094l-.7 .7a1 1 0 0 1 -1.497 -1.32l.083 -.094l.7 -.7a1 1 0 0 1 1.414 0zM12 2a1 1 0 0 1 .993 .883l.007 .117v1a1 1 0 0 1 -1.993 .117l-.007 -.117v-1a1 1 0 0 1 1 -1zm2 12h-4a2 2 0 0 0 -2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2 -2v-2a2 2 0 0 0 -2 -2zm-2 -10a6 6 0 0 1 6 6a6 6 0 0 1 -3 5.2v.8a2 2 0 0 0 -2 2h-2a2 2 0 0 0 -2 -2v-.8a6 6 0 0 1 -3 -5.2a6 6 0 0 1 6 -6z" /></svg>{autoInsight.action}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ═══════ Section: 측정 정보 (컨디션 브리핑 바로 아래) ═══════ */}
          <div style={{ margin: '0 14px 10px', background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 4px rgba(4, 44, 83, 0.04)', overflow: 'hidden' }}>
            <button onClick={() => toggleSection('meta')} style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: expandedSections.meta ? '14px 16px 8px' : '14px 16px',
              background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#042C53' }}>측정 정보</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round"
                style={{ transition: 'transform 0.3s ease', transform: expandedSections.meta ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {expandedSections.meta && (
              <div style={{ padding: '0 16px 16px', animation: 'fadeUp 0.3s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11 }}>
                  <span style={{ color: '#6B7F99' }}>피부 타입</span>
                  <span style={{ color: '#042C53', fontWeight: 500 }}>{result.skinType}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11 }}>
                  <span style={{ color: '#6B7F99' }}>분석 모드</span>
                  <span style={{
                    fontSize: 10, fontWeight: 500,
                    color: result.analysisMode === 'hybrid' ? '#185FA5' : '#6B7F99',
                    background: result.analysisMode === 'hybrid' ? 'rgba(24,95,165,0.1)' : 'rgba(107,127,153,0.1)',
                    padding: '2px 8px', borderRadius: 8,
                  }}>{result.analysisMode === 'hybrid' ? 'AI + CV 하이브리드' : 'CV 비전 분석'}</span>
                </div>
                {result.confidence != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11 }}>
                    <span style={{ color: '#6B7F99' }}>측정 신뢰도</span>
                    <span style={{
                      fontWeight: 500,
                      color: result.confidence >= 70 ? '#4ecb71' : result.confidence >= 50 ? '#d4900a' : '#f06050',
                    }}>{result.confidence}%</span>
                  </div>
                )}
                {result.concerns?.length > 0 && (
                  <div style={{ padding: '6px 0' }}>
                    <div style={{ fontSize: 10, color: '#6B7F99', marginBottom: 4 }}>관심 사항</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {result.concerns.map((concern, i) => (
                        <span key={i} style={{
                          fontSize: 10, fontWeight: 500,
                          color: i === 0 ? '#e05545' : '#d4900a',
                          background: i === 0 ? 'rgba(240,96,80,0.08)' : 'rgba(245,166,35,0.08)',
                          padding: '3px 8px', borderRadius: 12,
                        }}>{concern}</span>
                      ))}
                    </div>
                  </div>
                )}
                {result?.analysisMode === 'cv_only' && (
                  <div style={{
                    marginTop: 8, padding: '8px 10px', borderRadius: 10,
                    background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#1d4ed8', marginBottom: 2 }}>AI 정밀 분석이 일시 지연됐어요</div>
                    <div style={{ fontSize: 9, color: '#6B7F99', lineHeight: 1.5 }}>네트워크 또는 분석 서버 일시 지연으로 기본 분석(CV)으로 처리됐어요. 잠시 후 다시 측정하면 보통 정상 복귀됩니다.</div>
                  </div>
                )}
                {/* 측정 정확도 디버그 (베타 임시) — 디바이스·얼굴 매칭·정규화 통계 */}
                {result?.measureDebug && (() => {
                  const d = result.measureDebug;
                  const matchEmoji = d.faceMatch === 'same' ? '✓ 동일인'
                    : d.faceMatch === 'different' ? '✗ 다른 사람'
                    : d.faceMatch === 'ambiguous' ? '? 모호'
                    : '— 비교 안 함';
                  const sameDevText = d.sameDevice === true ? '같은 폰' : d.sameDevice === false ? '다른 폰' : '첫 측정';
                  return (
                    <div style={{
                      marginTop: 8, padding: '8px 10px', borderRadius: 10,
                      background: 'rgba(100,116,139,0.06)', border: '1px solid rgba(100,116,139,0.15)',
                      fontSize: 9, color: '#6B7F99', lineHeight: 1.6,
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>측정 정확도 디버그 (베타 임시)</div>
                      <div>디바이스: {d.device} ({sameDevText})</div>
                      <div>얼굴 매칭: {matchEmoji}{d.faceDistance != null ? ` · distance ${d.faceDistance}` : ''}</div>
                      {d.normalize && (
                        <div>정규화: 밝기 {d.normalize.before.brightness}→{d.normalize.after.brightness} · exposure {d.normalize.factors.exposure}</div>
                      )}
                      {d.baselineBuild?.stage === 'building' && (
                        <div style={{ color: '#6598ef', fontWeight: 600 }}>
                          기준 구축 중 ({d.baselineBuild.count}/{d.baselineBuild.target}) — {d.baselineBuild.target}회 측정 평균으로 정확한 기준점 만들어요
                        </div>
                      )}
                    </div>
                  );
                })()}
                {result?.outlierWarning && (
                  <div style={{
                    marginTop: 8, padding: '8px 10px', borderRadius: 10,
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#b45309', marginBottom: 2 }}>오늘 결과가 평소와 크게 달라요</div>
                    <div style={{ fontSize: 9, color: '#6B7F99', lineHeight: 1.5 }}>{result.outlierReason}. 조명/각도/메이크업 차이일 가능성이 있어요.</div>
                  </div>
                )}
                <p style={{ fontSize: 9, color: '#6B7F99', textAlign: 'center', marginTop: 10, marginBottom: 4, lineHeight: 1.4 }}>AI 추정치이며 의료 진단이 아닙니다</p>
                {/* 쿠팡 파트너스 안내는 맞춤 제품 추천(화장대) 아래로 이동 */}
              </div>
            )}
          </div>

          {/* ═══════ Section 2: 지난 측정 대비 변화 ═══════ */}
          {!isFirstMeasurement && (
          <div style={{ margin: '0 14px 10px', background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 4px rgba(4, 44, 83, 0.04)', overflow: 'hidden' }}>
            <button onClick={() => toggleSection('change')} style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: expandedSections.change ? '14px 16px 8px' : '14px 16px',
              background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#042C53' }}>지난 측정 대비 변화</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round"
                style={{ transition: 'transform 0.3s ease', transform: expandedSections.change ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {expandedSections.change && (
              <div style={{ padding: '0 16px 16px', animation: 'fadeUp 0.3s ease-out' }}>
                {changes && (() => {
                  const skipKeys = ['overallScore', 'skinAge'];
                  const allChanges = Object.values(changes)
                    .filter(c => Math.abs(c.diff) >= 1 && !skipKeys.includes(c.key))
                    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
                  const top3 = allChanges.slice(0, 3);
                  if (top3.length === 0) return <div style={{ fontSize: 11, color: '#6B7F99' }}>큰 변화가 없어요</div>;
                  return (
                    <div style={{ marginBottom: 12 }}>
                      {top3.map(c => (
                        <div key={c.key} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 0', borderBottom: '1px solid rgba(4,44,83,0.06)',
                        }}>
                          <span style={{ fontSize: 11, color: '#042C53' }}>{c.icon} {c.label}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, color: '#6B7F99' }}>{Math.round(c.from ?? 0)}</span>
                            <span style={{ fontSize: 10, color: '#6B7F99' }}>→</span>
                            <span style={{ fontSize: 10, color: '#042C53', fontWeight: 500 }}>{Math.round(c.to ?? 0)}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 500,
                              color: c.improved ? '#4ecb71' : '#f0a050',
                            }}>
                              {c.diff > 0 ? '↑' : '↓'}{Math.abs(Math.round(c.diff))}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <TrendCard
                  accent={activeThemeColors.accent}
                  changes={changes}
                  animationDelay="0"
                />
                <div style={{ marginTop: 10 }}>
                  <BeforeAfterSlider />
                </div>
              </div>
            )}
          </div>
          )}

          {/* ═══════ Divider 2: 더 자세히 ═══════ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 24px 14px' }}>
            <div style={{ flex: 1, height: 0.5, background: 'rgba(4, 44, 83, 0.15)' }} />
            <span style={{ fontSize: 10, fontWeight: 500, color: '#185FA5', letterSpacing: 1.5, whiteSpace: 'nowrap' }}>더 자세히</span>
            <div style={{ flex: 1, height: 0.5, background: 'rgba(4, 44, 83, 0.15)' }} />
          </div>

          {/* ═══════ Section 3: lua의 정밀 판독 ═══════ */}
          <div style={{ margin: '0 14px 10px', background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 4px rgba(4, 44, 83, 0.04)', overflow: 'hidden' }}>
            <button onClick={() => toggleSection('analysis')} style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: expandedSections.analysis ? '14px 16px 8px' : '14px 16px',
              background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#042C53' }}>lua의 정밀 판독</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round"
                style={{ transition: 'transform 0.3s ease', transform: expandedSections.analysis ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {expandedSections.analysis && (
              <div style={{ padding: '0 16px 16px', animation: 'fadeUp 0.3s ease-out' }}>
                <p style={{ fontSize: 11, color: '#042C53', lineHeight: 1.7, margin: '0 0 12px' }}>{result.advice}</p>
                <AiCommentCard
                  aiNotes={result.aiNotes}
                  aiDetails={result.aiDetails}
                  accent={activeThemeColors.accent}
                  analysisMode={result.analysisMode}
                  makeupDetected={result.makeupDetected}
                  animationDelay="0"
                />
                {result.makeupDetected && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(244,163,187,0.1), rgba(244,163,187,0.05))',
                    border: '1px solid rgba(244,163,187,0.2)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}></span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#f4a3bb', marginBottom: 1 }}>메이크업이 감지되었어요</div>
                      <div style={{ fontSize: 10, color: '#6B7F99', lineHeight: 1.4 }}>클렌징 후 다시 측정하면 더 정확한 피부 상태를 확인할 수 있어요</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══════ Section 4: 전체 지표 ═══════ */}
          <div style={{ margin: '0 14px 10px', background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 4px rgba(4, 44, 83, 0.04)', overflow: 'hidden' }}>
            <button onClick={() => toggleSection('indicators')} style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: expandedSections.indicators ? '14px 16px 8px' : '14px 16px',
              background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#042C53' }}>전체 지표</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round"
                style={{ transition: 'transform 0.3s ease', transform: expandedSections.indicators ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {expandedSections.indicators && (
              <div style={{ padding: '0 16px 16px', animation: 'fadeUp 0.3s ease-out' }}>
                {/* Condition metrics */}
                <div style={{ fontSize: 10, fontWeight: 500, color: '#185FA5', marginBottom: 8 }}>컨디션 지표</div>
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
                {/* 5종 분류 시각화 — 백엔드 troubleBreakdown 데이터 노출 */}
                <TroubleBreakdownCard breakdown={result.troubleBreakdown} />
                <MetricBar label="다크서클" value={result.darkCircleScore} unit="점" icon={<EyeIcon size={18} />} color="#C8B8E8" delay={240}
                  description={result.darkCircleScore >= 70 ? '눈 밑 밝음' : result.darkCircleScore >= 45 ? '아이크림 추천' : '다크서클 집중 관리'}
                  onClick={() => openDetail('darkCircles')} />
                {/* Aging metrics */}
                <div style={{ fontSize: 10, fontWeight: 500, color: '#185FA5', margin: '14px 0 8px' }}>노화 지표</div>
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
            )}
          </div>

          {/* ═══════ Section 5: 맞춤 케어 제안 ═══════ */}
          <div style={{ margin: '0 14px 10px', background: '#FFFFFF', borderRadius: 14, boxShadow: '0 1px 4px rgba(4, 44, 83, 0.04)', overflow: 'hidden' }}>
            <button onClick={() => toggleSection('care')} style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: expandedSections.care ? '14px 16px 8px' : '14px 16px',
              background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#042C53' }}>맞춤 케어 제안</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="2" strokeLinecap="round"
                style={{ transition: 'transform 0.3s ease', transform: expandedSections.care ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {expandedSections.care && (
              <div style={{ padding: '0 16px 16px', animation: 'fadeUp 0.3s ease-out' }}>
                {/* Product recommendations */}
                {(() => {
                  const weakCats = getWeakestCategories(result);
                  if (weakCats.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#042C53', marginBottom: 8 }}>맞춤 추천 제품</div>
                      {weakCats.slice(0, 2).map((cat) => {
                        const meta = CATEGORY_META[cat];
                        if (!meta) return null;
                        const products = getProductsByCategory(cat).slice(0, 2);
                        if (products.length === 0) return null;
                        return (
                          <div key={cat} style={{
                            marginBottom: 8, borderRadius: 12,
                            background: '#F8FBFE',
                            border: '1px solid rgba(4,44,83,0.06)',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '10px 12px',
                            }}>
                              <span style={{ fontSize: 14, display: 'inline-flex' }}><PastelIcon emoji={meta.icon} size={14} /></span>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#042C53' }}>{meta.label}</div>
                                <div style={{ fontSize: 9, color: '#6B7F99' }}>{meta.ingredient}</div>
                              </div>
                            </div>
                            {products.map((product, pi) => (
                              <a key={product.id} href={product.link} target="_blank" rel="noopener noreferrer"
                                className="product-item-card"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '8px 12px 8px 20px',
                                  marginLeft: 12, marginRight: 12,
                                  borderTop: '1px solid rgba(4,44,83,0.04)',
                                  textDecoration: 'none', color: 'inherit',
                                  transition: 'background 0.2s',
                                }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: '#555555',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {product.brand} {product.name}
                                  </div>
                                  <div style={{ display: 'flex', gap: 4, marginTop: 2, alignItems: 'center' }}>
                                    {product.tags?.slice(0, 2).map((tag, ti) => (
                                      <span key={ti} style={{
                                        fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 5,
                                        background: 'rgba(24,95,165,0.1)', color: '#185FA5',
                                      }}>{tag}</span>
                                    ))}
                                    <span style={{ fontSize: 8, color: '#6B7F99' }}>{product.volume}</span>
                                  </div>
                                </div>
                                <div style={{
                                  padding: '4px 10px', borderRadius: 12, flexShrink: 0,
                                  background: '#1E90E8',
                                  fontSize: 10, fontWeight: 600, color: '#fff',
                                }}>구매</div>
                              </a>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {/* Treatment recommendations */}
                {(() => {
                  const treatments = result ? getRecommendedTreatments(result, 3) : [];
                  if (treatments.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: '#042C53', marginBottom: 8 }}>맞춤 추천 시술</div>
                      {(() => {
                        const grouped = {};
                        treatments.forEach(t => {
                          if (!grouped[t.category]) grouped[t.category] = [];
                          grouped[t.category].push(t);
                        });
                        return Object.entries(grouped).map(([cat, items]) => {
                          const catMeta = TREATMENT_CATEGORIES[cat];
                          return (
                            <div key={cat} style={{
                              marginBottom: 8, borderRadius: 12,
                              background: '#F8FBFE',
                              border: '1px solid rgba(4,44,83,0.06)',
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '10px 12px',
                              }}>
                                <span style={{ fontSize: 14, display: 'inline-flex' }}><PastelIcon emoji={catMeta?.icon || ''} size={14} /></span>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#042C53' }}>{catMeta?.label}</div>
                                  {items[0]?.weakestMetric && (
                                    <div style={{ fontSize: 9, fontWeight: 400, color: '#ef4444', marginTop: 1 }}>
                                      {items[0].weakestMetric.label} {items[0].weakestMetric.value}점
                                    </div>
                                  )}
                                </div>
                              </div>
                              {items.map((t, ti) => (
                                <div key={t.id} style={{
                                  padding: '8px 12px 8px 20px',
                                  marginLeft: 12, marginRight: 12,
                                  borderTop: '1px solid rgba(4,44,83,0.04)',
                                }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: '#555555' }}>
                                    {t.name}
                                  </div>
                                  <div style={{ fontSize: 10, color: '#6B7F99', marginTop: 2, lineHeight: 1.3 }}>
                                    {t.mechanism.length > 35 ? t.mechanism.slice(0, 35) + '...' : t.mechanism}
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 9, color: '#6B7F99' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a3 3 0 013-3h12a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3z"/><path d="M3 10h18"/></svg>
                                      {t.costRange}
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                                      {t.downtime}
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19.933 13.041a8 8 0 11-9.925-8.788c3.899-1 7.935 1.007 9.425 4.747"/><path d="M20 4v5h-5"/></svg>
                                      {t.frequency}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        });
                      })()}
                      <button onClick={() => setFabChatOpen(true)} style={{
                        width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
                        background: 'rgba(30,144,232,0.1)', color: '#185FA5',
                        fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        marginTop: 8,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v12a1 1 0 01-1 1H6l-3 3z"/></svg>
                        시술에 대해 루아에게 물어보기
                      </button>
                      <div style={{ fontSize: 8, color: '#6B7F99', textAlign: 'center', marginTop: 6, lineHeight: 1.4 }}>
                        <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><ShieldIcon size={10} /></span> 의료 행위가 아닌 정보 제공 목적입니다. 시술은 전문 의료진과 상담 후 결정하세요.
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ═══════ 다시 측정하기 (항상 표시) ═══════ */}
          <div style={{ padding: '12px 14px 20px', animation: 'fadeUp 0.5s ease-out 0.5s both' }}>
            <button onClick={reset} style={{
              width: '100%', padding: 12, borderRadius: 12, fontFamily: 'inherit',
              background: '#FFFFFF', border: 'none',
              color: '#042C53', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(4, 44, 83, 0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19.933 13.041a8 8 0 11-9.925-8.788c3.899-1 7.935 1.007 9.425 4.747"/><path d="M20 4v5h-5"/></svg>
              다시 측정하기
            </button>
          </div>

          {/* Bottom action bar spacer */}
          <div style={{ height: 70 }} />

          {/* ═══════ Fixed Bottom Action Bar ═══════ */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
            background: '#FFFFFF', borderTop: '0.5px solid rgba(4, 44, 83, 0.08)',
            padding: '12px 14px', display: 'flex', gap: 8,
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          }}>
            <button onClick={() => setFabChatOpen(true)} style={{
              flex: 1, height: 44, borderRadius: 12, border: 'none',
              background: 'rgba(30, 144, 232, 0.1)', color: '#185FA5',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v12a1 1 0 01-1 1H6l-3 3z"/></svg>
              lua에게 물어보기
            </button>
            <button onClick={handleSave} disabled={saved} style={{
              flex: 1, height: 44, borderRadius: 12, border: 'none',
              background: saved ? 'rgba(74,222,128,0.15)' : '#1E90E8',
              color: saved ? '#4ade80' : '#FFFFFF',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: saved ? 'none' : '0 2px 8px rgba(30, 144, 232, 0.25)',
            }}>
              {saved ? '기록 완료 ' : '이 결과 기록하기'}
            </button>
          </div>
        </div>
        );
      })()}

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
          <div onClick={(e) => { e.stopPropagation(); setInsightCollapsed(true); }} style={{
            position: 'absolute', top: 6, right: 6, zIndex: 2,
            width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #8B95A1)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"><path d="M6 9l6 6 6-6"/></svg>
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
            width: 58, height: 58,
            background: 'none', border: 'none',
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
              backdropFilter: 'none', WebkitBackdropFilter: 'none',
              borderRadius: '30px 30px 4px 30px', padding: '9px 14px', whiteSpace: 'nowrap',
              border: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              animation: 'fabHintIn 0.5s ease-out 1.5s both, fabHintOut 0.4s ease-in 10s both',
              fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 600, letterSpacing: -0.2,
            }}>
              피부 고민을 물어봐
            </div>
          )}
          {/* luastar — 글로우 + mask 분리 */}
          <div style={{
            position: 'relative', width: 34, height: 34, zIndex: 1,
            animation: 'fabStarTwinkle 2.5s ease-in-out infinite',
            filter: 'drop-shadow(0 0 10px rgba(160,200,240,0.9)) drop-shadow(0 0 25px rgba(160,200,240,0.7)) drop-shadow(0 0 50px rgba(160,200,240,0.5)) drop-shadow(0 0 80px rgba(160,200,240,0.3))',
          }}>
            <img src="/luastar.svg" alt="" style={{
              width: '100%', height: '100%',
              filter: 'brightness(0) invert(1)',
            }} />
          </div>
        </div>
        </div>
      )}

      {/* ===== HOME EDIT PAGE ===== */}
      {showHomeEdit && (
        <HomeEditPage
          cards={homeCards}
          order={homeCardOrder}
          onToggle={toggleHomeCard}
          onReorder={reorderHomeCards}
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
            <div style={{ fontSize: 64, marginBottom: 16, animation: 'celebrate-bounce 0.6s ease' }}></div>
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
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ececec', margin: '0 auto 20px' }} />

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
          border: 'none', background: goalReached ? '#22C55E' : 'var(--accent-primary, #6598ef)',
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
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ececec', margin: '0 auto 20px' }} />

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
function HomeEditPage({ cards, order, onToggle, onReorder, onClose }) {
  const META = {
    metrics: { label: '피부 지표', desc: '수분 · 주름 · 탄력 · 모공', icon: '' },
    weather: { label: '날씨', desc: '기온 · 습도 · 자외선', icon: '' },
    water: { label: '수분 섭취', desc: '하루 물 섭취량 기록', icon: '' },
    sleep: { label: '수면', desc: '수면 시간 · 수면의 질 기록', icon: '' },
    insight: { label: 'lua 인사이트', desc: 'AI 피부 조언 카드', icon: '' },
    goal: { label: '피부 목표', desc: '목표 달성 진행률', icon: '' },
  };

  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const startY = useRef(0);
  const rowRefs = useRef([]);

  const handleTouchStart = (idx, e) => {
    setDragIdx(idx);
    startY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e) => {
    if (dragIdx === null) return;
    const y = e.touches[0].clientY;
    for (let i = 0; i < rowRefs.current.length; i++) {
      const el = rowRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom && i !== dragIdx) {
        setOverIdx(i);
        return;
      }
    }
  };
  const handleTouchEnd = () => {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      const newOrder = [...order];
      const [moved] = newOrder.splice(dragIdx, 1);
      newOrder.splice(overIdx, 0, moved);
      onReorder(newOrder);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <>
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'linear-gradient(to bottom, #58aefe, #d7e9fa)' }} />
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000,
      width: '100%', maxWidth: 430, margin: '0 auto',
      background: 'linear-gradient(to bottom, #58aefe, #d7e9fa)',
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>홈 화면 편집</span>
      </div>

      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          카드를 길게 눌러 순서를 변경하세요
        </div>
      </div>

      <div style={{ flex: 1, padding: '8px 0' }} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {order.map((key, idx) => {
          const item = META[key];
          if (!item) return null;
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx;
          return (
            <div
              key={key}
              ref={el => rowRefs.current[idx] = el}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px 14px 12px',
                background: isDragging ? 'rgba(101,152,239,0.1)' : isOver ? 'rgba(101,152,239,0.05)' : 'transparent',
                borderTop: isOver ? '2px solid #6598ef' : '2px solid transparent',
                transition: 'background 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* 드래그 핸들 */}
              <div
                onTouchStart={(e) => handleTouchStart(idx, e)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 4px',
                  cursor: 'grab', touchAction: 'none', flexShrink: 0,
                }}
              >
                <div style={{ width: 16, height: 2, borderRadius: 1, background: 'rgba(0,0,0,0.15)' }} />
                <div style={{ width: 16, height: 2, borderRadius: 1, background: 'rgba(0,0,0,0.15)' }} />
                <div style={{ width: 16, height: 2, borderRadius: 1, background: 'rgba(0,0,0,0.15)' }} />
              </div>
              <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
              </div>
              <div onClick={(e) => { e.stopPropagation(); onToggle(key); }} style={{
                width: 48, height: 28, borderRadius: 14,
                background: cards[key] ? '#6598ef' : 'rgba(0,0,0,0.08)',
                position: 'relative', cursor: 'pointer',
                transition: 'background 0.2s ease', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute',
                  top: 2, left: cards[key] ? 22 : 2,
                  width: 24, height: 24, borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  transition: 'left 0.2s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}

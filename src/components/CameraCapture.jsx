/**
 * CameraCapture — Face ID style guided camera capture UI
 *
 * Real-time face detection with oval guide overlay, condition indicators,
 * analysis zone labels, and scanning animation.
 *
 * When camera is unavailable (HTTP on mobile, permission denied, etc.),
 * shows an error screen with fallback options instead of silently redirecting.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getVideoLandmarker, detectLandmarksImage } from '../engine/FaceLandmarker';
import { LockIcon, CameraIcon } from './icons/PastelIcons';

// Landmark indices for key facial points
const NOSE_TIP = 1;
const LEFT_EAR = 234;
const RIGHT_EAR = 454;
const FOREHEAD = 10;
const CHIN = 152;

// Key landmark indices to render as dots (~50 points, matching facedot.png)
const KEY_LANDMARKS = [
  // 이마 (forehead)
  10, 67, 297, 109, 338, 151, 108, 337, 69, 299,
  // 눈썹 (eyebrows)
  70, 63, 105, 66, 300, 293, 334, 296,
  // 눈 (eyes)
  33, 133, 159, 145, 263, 362, 386, 374,
  // 코 (nose)
  6, 4, 1, 2, 98, 327,
  // 볼 (cheeks)
  93, 132, 116, 323, 361, 345,
  // 입 (mouth)
  0, 13, 14, 17, 61, 291, 78, 308,
  // 턱 (jawline & chin)
  152, 148, 377, 172, 397, 176, 400, 234, 454,
];

// ===== v3: Beauty Lines + Active Measurement =====

// Layer 1: Beauty Lines — ~27 dots on facial beauty lines
// grade 1 = bright (40%), grade 2 = normal (50%), grade 3 = dim (10%)
const BEAUTY_LINES = [
  // 이마 — 5 dots (v1에서 선별)
  { lm: 10, grade: 3 },
  { lm: 67, grade: 2 },
  { lm: 297, grade: 2 },
  { lm: 109, grade: 2 },
  { lm: 338, grade: 3 },
  // 눈썹 아치 좌 (camera-left) — 3 dots
  { lm: 300, grade: 2 },
  { lm: 293, grade: 1 },
  { lm: 334, grade: 2 },
  // 눈썹 아치 우 (camera-right) — 3 dots
  { lm: 70, grade: 2 },
  { lm: 63, grade: 1 },
  { lm: 105, grade: 2 },
  // 아이라인 꼬리 좌 — 3 dots (작은 점, 세로 높이 동일)
  { lm: 446, grade: 3 },
  { lm: 464, grade: 3 },
  { lm: 454, grade: 3 },
  // 아이라인 꼬리 우 — 3 dots (작은 점, 세로 높이 동일)
  { lm: 226, grade: 3 },
  { lm: 244, grade: 3 },
  { lm: 234, grade: 3 },
  // 눈밑 바깥 좌 (camera-left) — 2 dots
  { lm: 448, grade: 3 },
  { lm: 449, grade: 3 },
  // 눈밑 바깥 우 (camera-right) — 2 dots
  { lm: 228, grade: 3 },
  { lm: 229, grade: 3 },
  // 콧대 + 콧끝 — 3 dots
  { lm: 6, grade: 1 },
  { lm: 4, grade: 2 },
  { lm: 1, grade: 1 },
  // 콧볼 좌우 — 작은 점
  { lm: 98, grade: 3 },
  { lm: 327, grade: 3 },
  // 광대 헤일로 좌 (camera-left) — 3 dots
  { lm: 345, grade: 1 },
  { lm: 323, grade: 2 },
  { lm: 361, grade: 3 },
  // 광대 헤일로 우 (camera-right) — 3 dots
  { lm: 116, grade: 1 },
  { lm: 93, grade: 2 },
  { lm: 132, grade: 3 },
  // 입꼬리 — 양쪽 끝만 작은 점
  { lm: 57, grade: 3 },
  { lm: 287, grade: 3 },
  { lm: 78, grade: 3 },
  { lm: 308, grade: 3 },
  // 턱선 V라인 — 4 dots (좌우 대칭 2+2)
  { lm: 172, grade: 2 },
  { lm: 176, grade: 3 },
  { lm: 397, grade: 2 },
  { lm: 400, grade: 3 },
];

// Pre-compute animation params for each beauty dot (stable across renders)
const BEAUTY_DOT_PARAMS = BEAUTY_LINES.map(dot => ({
  ...dot,
  period: 4.5 + Math.random() * 1.5,
  phase: Math.random() * 6,
  coreR: dot.grade === 1 ? 1.35 : dot.grade === 2 ? 1.1 : 1.0,
  glowR: dot.grade === 1 ? 6 : dot.grade === 2 ? 5 : 4.5,
}));

// Layer 2: Active Measurement — 7 zones with highlight dots
const ANALYSIS_ZONES = [
  { id: 'forehead', label: '이마', anchor: 10, offsetY: -0.02, dots: [10, 67, 297, 109, 338] },
  { id: 'under_eye_left', label: '왼눈가', anchor: 33, offsetX: -0.07, dots: [111, 117, 118] },
  { id: 'under_eye_right', label: '오른눈가', anchor: 263, offsetX: 0.07, dots: [340, 346, 347] },
  { id: 't_zone', label: 'T존', anchor: 4, offsetY: 0.0, dots: [6, 4, 197] },
  { id: 'cheek_left', label: '왼볼', anchor: 132, offsetX: -0.025, dots: [116, 93, 132, 123] },
  { id: 'cheek_right', label: '오른볼', anchor: 361, offsetX: 0.025, dots: [345, 323, 361, 352] },
  { id: 'chin', label: '턱선', anchor: 152, offsetY: 0.022, dots: [152, 175, 396] },
];

// Brightness sampling landmarks (14 points across face)
const BRIGHTNESS_LANDMARKS = [
  10, 67, 297, 1, 4, 93, 323, 132, 361, 152, 130, 359, 58, 288,
];

// Status messages (Korean)
const STATUS_TEXT = {
  'initializing': '카메라 초기화 중...',
  'no-face': '얼굴을 화면에 맞춰주세요',
  'aligning': '타원 안에 얼굴을 맞춰주세요',
  'too-far': '좀 더 가까이 오세요',
  'too-close': '조금 뒤로 가세요',
  'bad-light': '더 밝은 곳으로 이동하세요',
  'ready': '좋아요! 촬영 버튼을 눌러주세요',
  'capturing': '촬영 중...',
  'captured': '분석 준비 중...',
};

// ===== Error Screen (camera unavailable) =====
function CameraErrorScreen({ reason, onFallback, onClose, onRetry, colorMode }) {
  const isInsecure = reason === 'insecure';
  const isDenied = reason === 'denied';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg-primary)', zIndex: 200,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 24, marginBottom: 24,
        background: 'var(--context-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36,
      }}>
        {isInsecure ? <LockIcon size={36} /> : isDenied ? '' : <CameraIcon size={36} />}
      </div>

      <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        {isInsecure ? '보안 연결이 필요합니다' :
         isDenied ? '카메라 권한이 거부되었습니다' :
         '카메라를 사용할 수 없습니다'}
      </h2>

      <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 24, maxWidth: 320, textAlign: 'left' }}>
        {isInsecure ? (
          <p style={{ margin: 0, textAlign: 'center' }}>모바일에서 카메라를 사용하려면 HTTPS 연결이 필요합니다.<br />앨범에서 사진을 선택해주세요.</p>
        ) : isDenied ? (
          <>
            <p style={{ margin: '0 0 12px', textAlign: 'center' }}>브라우저 설정에서 카메라 권한을 허용한 후 [다시 시도]를 눌러주세요.</p>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, padding: '10px 14px', background: 'var(--context-bg)', borderRadius: 10 }}>
              <div><strong style={{ color: 'var(--text-secondary)' }}>iPhone Safari</strong>: 주소창 좌측 「ⓐⓐ」 → 웹사이트 설정 → 카메라 → 허용</div>
              <div style={{ marginTop: 4 }}><strong style={{ color: 'var(--text-secondary)' }}>Android Chrome</strong>: 주소창 좌측  → 권한 → 카메라 허용</div>
              <div style={{ marginTop: 4 }}><strong style={{ color: 'var(--text-secondary)' }}>PC 브라우저</strong>: 주소창 좌측 자물쇠/카메라 아이콘 → 허용</div>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, textAlign: 'center' }}>이 기기에서 카메라에 접근할 수 없습니다.<br />앨범에서 사진을 선택해주세요.</p>
        )}
      </div>

      <button onClick={onFallback} style={{
        width: '100%', maxWidth: 300, padding: 16, borderRadius: 12, border: 'none',
        background: 'var(--accent-primary)',
        color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 12,
      }}>
        앨범에서 사진 선택
      </button>

      {isDenied && (
        <button onClick={onRetry} style={{
          width: '100%', maxWidth: 300, padding: 14, borderRadius: 12,
          background: 'var(--bg-secondary)',
          border: 'var(--item-border)',
          color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
        }}>
          다시 시도
        </button>
      )}

      <button onClick={onClose} style={{
        background: 'none', border: 'none',
        color: 'var(--text-dim)',
        fontSize: 14, cursor: 'pointer', padding: '8px 16px',
      }}>
        돌아가기
      </button>
    </div>
  );
}

// ===== Main CameraCapture Component =====
export default function CameraCapture({ onCapture, onClose, onFallback, colorMode, autoCapture = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const brightnessCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const landmarkerRef = useRef(null);
  const lastDetectRef = useRef(0);
  const landmarksRef = useRef(null);
  const flashRef = useRef(null);

  // Status: use BOTH state (for React UI) and ref (for RAF loop drawing)
  const statusRef = useRef('initializing');
  const [status, setStatusState] = useState('initializing');
  const setStatus = useCallback((valOrFn) => {
    if (typeof valOrFn === 'function') {
      setStatusState(prev => {
        const next = valOrFn(prev);
        statusRef.current = next;
        return next;
      });
    } else {
      statusRef.current = valOrFn;
      setStatusState(valOrFn);
    }
  }, []);

  const [conditions, setConditions] = useState({ face: false, position: false, distance: false, light: false });
  const [hasLandmarks, setHasLandmarks] = useState(false);
  const [mediapipeReady, setMediapipeReady] = useState(false);
  const [cameraError, setCameraError] = useState(null); // null | 'insecure' | 'denied' | 'unavailable'
  const [cameraReady, setCameraReady] = useState(false);
  const [activeZoneIdx, setActiveZoneIdx] = useState(-1);
  const [scanProgress, setScanProgress] = useState(0);
  const scanStartRef = useRef(null);
  const [ellipse, setEllipse] = useState({ cx: 0, cy: 0, rx: 0, ry: 0 });
  const labelFirstShownRef = useRef(null); // timestamp when labels first appeared
  const [scanStopped, setScanStopped] = useState(false);
  // autoCapture: baseline 첫 3회 단계에서 ready 안정 시 자동 캡처. null이면 카운트다운 X.
  const [autoCountdown, setAutoCountdown] = useState(null); // null | 3 | 2 | 1

  // Cleanup: stop stream, cancel RAF
  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Store drawOverlay in a ref so RAF loop always calls the latest version
  const drawOverlayRef = useRef(null);

  // Store ellipse dimensions for HTML overlay positioning
  const ellipseRef = useRef({ cx: 0, cy: 0, rx: 0, ry: 0 });

  // drawOverlay — v3: Beauty Lines + Active Measurement
  drawOverlayRef.current = function drawOverlay(ctx, W, H, landmarks, videoW, videoH) {
    ctx.clearRect(0, 0, W, H);
    const now = performance.now() / 1000;

    // objectFit: cover coordinate mapping
    const vidAspect = videoW / videoH;
    const dispAspect = W / H;
    let mapScale, mapOffX, mapOffY;
    if (dispAspect > vidAspect) {
      mapScale = W / videoW; mapOffX = 0; mapOffY = (H - videoH * mapScale) / 2;
    } else {
      mapScale = H / videoH; mapOffX = (W - videoW * mapScale) / 2; mapOffY = 0;
    }
    function mapX(nx) { return nx * videoW * mapScale + mapOffX; }
    function mapY(ny) { return ny * videoH * mapScale + mapOffY; }

    // Ellipse dimensions
    const cx = W * 0.5;
    const cy = H * 0.44;
    const baseSize = Math.min(W, H);
    const rx = baseSize * 0.34;
    const ry = Math.min(rx * 1.35, H * 0.40);
    ellipseRef.current = { cx, cy, rx, ry };
    if (Math.abs(ellipse.rx - rx) > 1 || Math.abs(ellipse.ry - ry) > 1) {
      setEllipse({ cx, cy, rx, ry });
    }

    // --- Background darkening (cinematic vignette) ---
    ctx.save();
    const vignette = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.5, cx, cy, Math.max(W, H) * 0.7);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.6, 'rgba(0,0,0,0.1)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // --- Ellipse guide (dotted, medical-instrument feel) ---
    // Reset label timer when conditions break (face lost, too far, etc.)
    const curStatus = statusRef.current;
    if (curStatus !== 'ready') {
      labelFirstShownRef.current = null;
    }
    const labelsDone = labelFirstShownRef.current && (now - labelFirstShownRef.current) >= 3;
    const scanComplete = labelsDone && curStatus === 'ready';
    if (scanComplete && !scanStopped) setScanStopped(true);
    if (!scanComplete && scanStopped) setScanStopped(false);
    ctx.save();
    ctx.strokeStyle = scanComplete ? 'rgba(255, 255, 255, 0.6)' : 'rgba(30, 144, 232, 0.55)';
    ctx.lineWidth = scanComplete ? 1.6 : 1.2;
    ctx.setLineDash(scanComplete ? [3, 4] : [2, 5]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // --- Corner markers ---
    const markerLen = 14, pad = 16;
    const mL = cx - rx - pad, mR = cx + rx + pad;
    const mT = cy - ry - pad, mB = cy + ry + pad;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(mL, mT + markerLen); ctx.lineTo(mL, mT); ctx.lineTo(mL + markerLen, mT); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mR - markerLen, mT); ctx.lineTo(mR, mT); ctx.lineTo(mR, mT + markerLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mL, mB - markerLen); ctx.lineTo(mL, mB); ctx.lineTo(mL + markerLen, mB); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mR - markerLen, mB); ctx.lineTo(mR, mB); ctx.lineTo(mR, mB - markerLen); ctx.stroke();
    ctx.restore();

    if (!landmarks) return;

    // --- Helper: draw glow dot ---
    const drawGlowDot = (x, y, coreR, glowR, opacity, isActive) => {
      // Glow
      const grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      if (isActive) {
        grad.addColorStop(0, `rgba(255,255,255,${opacity})`);
        grad.addColorStop(0.4, `rgba(200,232,255,${opacity * 0.9})`);
        grad.addColorStop(1, 'rgba(30,144,232,0)');
      } else {
        grad.addColorStop(0, `rgba(232,244,255,${opacity})`);
        grad.addColorStop(0.5, `rgba(168,216,240,${opacity * 0.6})`);
        grad.addColorStop(1, 'rgba(30,144,232,0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
      // Core
      ctx.fillStyle = isActive ? `rgba(255,255,255,${opacity})` : `rgba(232,244,255,${opacity})`;
      ctx.beginPath();
      ctx.arc(x, y, coreR, 0, Math.PI * 2);
      ctx.fill();
    };

    // --- Layer 1: Beauty Lines (always visible, breathing) ---
    for (const dot of BEAUTY_DOT_PARAMS) {
      if (dot.lm >= landmarks.length) continue;
      const lm = landmarks[dot.lm];
      const x = mapX(lm.x), y = mapY(lm.y);
      // Breathing: sin wave with per-dot random period/phase
      const t = ((now + dot.phase) % dot.period) / dot.period;
      const opacity = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2));
      drawGlowDot(x, y, dot.coreR, dot.glowR, opacity, false);
    }

    // --- Zone labels (pill shape, fade out after 5s) ---
    if (!labelFirstShownRef.current) labelFirstShownRef.current = now;
    const labelAge = now - labelFirstShownRef.current;
    const labelOpacity = labelAge < 2.5 ? 1 : labelAge < 3 ? 1 - (labelAge - 2.5) / 0.5 : 0;

    if (labelOpacity > 0) {
      for (const zone of ANALYSIS_ZONES) {
        if (zone.anchor >= landmarks.length) continue;
        const lm = landmarks[zone.anchor];
        const zx = mapX(lm.x + (zone.offsetX || 0));
        const zy = mapY(lm.y + (zone.offsetY || 0));

        ctx.save();
        ctx.globalAlpha = labelOpacity;
        ctx.translate(zx, zy);
        ctx.scale(-1, 1);
        ctx.font = '400 10px "Pretendard Variable", Pretendard, -apple-system, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(zone.label).width;
        const bw = tw + 20, bh = 20;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
        ctx.fill();
        ctx.fillStyle = '#042C53';
        ctx.fillText(zone.label, 0, 0.5);
        ctx.restore();
      }
    }

  };

  // Evaluate face conditions from landmarks
  function evaluateConditions(landmarks) {
    if (!landmarks || landmarks.length < 468) {
      return { face: false, position: false, distance: false, light: false };
    }

    const cond = { face: true, position: false, distance: false, light: false };

    const nose = landmarks[NOSE_TIP];
    cond.position = Math.abs(nose.x - 0.5) < 0.08 && Math.abs(nose.y - 0.44) < 0.08;

    const earW = Math.abs(landmarks[RIGHT_EAR].x - landmarks[LEFT_EAR].x);
    const faceH = Math.abs(landmarks[CHIN].y - landmarks[FOREHEAD].y);
    cond.distance = earW > 0.25 && earW < 0.60 && faceH > 0.25 && faceH < 0.65;

    const bCanvas = brightnessCanvasRef.current;
    const video = videoRef.current;
    if (bCanvas && video && video.readyState >= 2) {
      const bCtx = bCanvas.getContext('2d', { willReadFrequently: true });
      const sw = 160, sh = 120;
      bCanvas.width = sw;
      bCanvas.height = sh;
      bCtx.drawImage(video, 0, 0, sw, sh);
      const imgData = bCtx.getImageData(0, 0, sw, sh);
      const pixels = imgData.data;
      let total = 0, count = 0;
      for (const idx of BRIGHTNESS_LANDMARKS) {
        if (idx >= landmarks.length) continue;
        const lm = landmarks[idx];
        const px = Math.min(Math.max(Math.round(lm.x * sw), 0), sw - 1);
        const py = Math.min(Math.max(Math.round(lm.y * sh), 0), sh - 1);
        const off = (py * sw + px) * 4;
        total += pixels[off] * 0.299 + pixels[off + 1] * 0.587 + pixels[off + 2] * 0.114;
        count++;
      }
      const avg = count > 0 ? total / count : 128;
      cond.light = avg >= 50 && avg <= 245;
    } else {
      cond.light = true;
    }

    return cond;
  }

  function getStatusFromConditions(cond) {
    if (!cond.face) return 'no-face';
    if (!cond.light) return 'bad-light';
    if (!cond.distance) {
      const lm = landmarksRef.current;
      if (lm) {
        const earW = Math.abs(lm[RIGHT_EAR].x - lm[LEFT_EAR].x);
        if (earW >= 0.70) return 'too-close';
        if (earW <= 0.18) return 'too-far';
      }
      return 'too-far';
    }
    if (!cond.position) return 'aligning';
    return 'ready';
  }

  // Start camera + MediaPipe
  const initCamera = useCallback(async (cancelled) => {
    // 1. Check secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      setCameraError('insecure');
      return;
    }

    // 2. Check getUserMedia support
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('unavailable');
      return;
    }

    // 3. Request camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      if (cancelled?.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setCameraError(null);
    } catch (e) {
      console.warn('[CameraCapture] camera error:', e.name, e.message);
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setCameraError('denied');
      } else {
        setCameraError('unavailable');
      }
      return;
    }

    if (cancelled?.current) return;
    setStatus('no-face');

    // 4. Load MediaPipe (non-blocking)
    try {
      const lm = await getVideoLandmarker();
      if (!cancelled?.current && lm) {
        landmarkerRef.current = lm;
        setMediapipeReady(true);
      }
    } catch (e) {
      console.warn('[CameraCapture] MediaPipe load failed:', e);
    }
  }, [setStatus]);

  // RAF loop — started when camera is ready
  useEffect(() => {
    if (!cameraReady) return;

    function loop() {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      // Match canvas to display size × devicePixelRatio for Retina sharpness
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const W = Math.round(rect.width);
      const H = Math.round(rect.height);
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const vidW = video.videoWidth || 640;
      const vidH = video.videoHeight || 480;

      const now = performance.now();
      if (landmarkerRef.current && now - lastDetectRef.current > 66) {
        lastDetectRef.current = now;
        try {
          const result = landmarkerRef.current.detectForVideo(video, now);
          if (result?.faceLandmarks?.length) {
            landmarksRef.current = result.faceLandmarks[0];
            setHasLandmarks(true);
          } else {
            landmarksRef.current = null;
            setHasLandmarks(false);
          }
        } catch (_) { /* graceful */ }

        const cond = evaluateConditions(landmarksRef.current);
        setConditions(cond);
        const newStatus = getStatusFromConditions(cond);
        setStatus(prev => (prev === 'capturing' || prev === 'captured') ? prev : newStatus);
      }

      if (drawOverlayRef.current) {
        drawOverlayRef.current(ctx, W, H, landmarksRef.current, vidW, vidH);
      }

      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [cameraReady, setStatus]);

  // Init on mount
  useEffect(() => {
    const cancelledRef = { current: false };
    initCamera(cancelledRef);

    function handleVisibility() {
      if (document.visibilityState === 'visible' && !streamRef.current && !cameraError) {
        initCamera(cancelledRef);
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelledRef.current = true;
      cleanup();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Retry camera (after permission denied)
  const handleRetry = useCallback(() => {
    setCameraError(null);
    setCameraReady(false);
    initCamera({ current: false });
  }, [initCamera]);

  // Capture photo
  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    setStatus('capturing');
    video.pause();

    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const capCtx = captureCanvas.getContext('2d');
    // Mirror the capture to match selfie view
    capCtx.translate(video.videoWidth, 0);
    capCtx.scale(-1, 1);
    capCtx.drawImage(video, 0, 0);
    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.92);

    if (flashRef.current) {
      flashRef.current.style.animation = 'none';
      void flashRef.current.offsetHeight;
      flashRef.current.style.animation = 'captureFlash 0.4s ease-out forwards';
    }

    setStatus('captured');
    let captureLandmarks = null;
    try {
      const imgEl = new Image();
      imgEl.src = dataUrl;
      await new Promise(r => { imgEl.onload = r; imgEl.onerror = r; });
      captureLandmarks = await detectLandmarksImage(imgEl);
    } catch (e) {
      console.warn('[CameraCapture] post-capture detection failed:', e);
    }

    setTimeout(() => {
      cleanup();
      onCapture(dataUrl, captureLandmarks);
    }, 600);
  }, [cleanup, onCapture, setStatus]);

  // ===== Auto-capture (baseline 첫 3회 자동 측정) =====
  // ready 상태로 진입 → 0.5초 안정 확인 → 3·2·1 카운트다운 (각 0.8초) → 자동 캡처.
  // 도중에 ready 깨지면(얼굴 이탈·각도 무너짐) 즉시 cancel + 카운트다운 초기화.
  // handleCapture를 ref로 보관 — deps에 넣으면 매 렌더마다 effect 재실행되어 cancel 루프 발생 가능.
  const handleCaptureRef = useRef(handleCapture);
  useEffect(() => { handleCaptureRef.current = handleCapture; }, [handleCapture]);
  useEffect(() => {
    if (!autoCapture) return;
    if (status !== 'ready') {
      setAutoCountdown(null);
      return;
    }
    let cancelled = false;
    let intervalId = null;
    const stableTimer = setTimeout(() => {
      if (cancelled) return;
      let n = 3;
      setAutoCountdown(n);
      intervalId = setInterval(() => {
        if (cancelled) return;
        n -= 1;
        if (n <= 0) {
          clearInterval(intervalId);
          setAutoCountdown(null);
          handleCaptureRef.current?.();
        } else {
          setAutoCountdown(n);
        }
      }, 800);
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(stableTimer);
      if (intervalId) clearInterval(intervalId);
      setAutoCountdown(null);
    };
  }, [autoCapture, status]);

  // ===== Error screen =====
  if (cameraError) {
    return (
      <CameraErrorScreen
        reason={cameraError}
        onFallback={() => { cleanup(); onFallback(); }}
        onClose={() => { cleanup(); onClose(); }}
        onRetry={handleRetry}
        colorMode={colorMode}
      />
    );
  }

  const isReady = status === 'ready';
  const isCapturing = status === 'capturing' || status === 'captured';
  const canCapture = isReady || !mediapipeReady;
  const accentOk = 'var(--accent-primary)';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', zIndex: 200,
    }}>
      {/* Camera preview — full screen */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: 'scaleX(-1)',
          }}
        />

        {/* Overlay canvas */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            transform: 'scaleX(-1)',
            pointerEvents: 'none',
          }}
        />

        {/* Scan line — clipped to ellipse, stops when scan complete */}
        {hasLandmarks && ellipse.rx > 0 && !scanStopped && (
          <div style={{
            position: 'absolute',
            left: ellipse.cx - ellipse.rx,
            top: ellipse.cy - ellipse.ry,
            width: ellipse.rx * 2,
            height: ellipse.ry * 2,
            borderRadius: '50%',
            overflow: 'hidden',
            pointerEvents: 'none',
          }}>
            <div style={{
              position: 'absolute', left: 0, right: 0,
              height: 60,
              background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0) 100%)',
              animation: 'luaScan 3s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          </div>
        )}

        {/* Flash overlay */}
        <div
          ref={flashRef}
          style={{
            position: 'absolute', inset: 0,
            background: '#fff', opacity: 0,
            pointerEvents: 'none',
          }}
        />

        {/* Back button */}
        <button
          onClick={() => { cleanup(); onClose(); }}
          aria-label="뒤로 가기"
          style={{
            position: 'absolute', top: 'calc(12px + env(safe-area-inset-top, 0px))', left: 12,
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.92)', border: 'none',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#042C53" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
        </button>

        {/* Status chip */}
        <div
          aria-live="polite"
          style={{
            position: 'absolute', top: 'calc(56px + env(safe-area-inset-top, 0px))',
            left: '50%', transform: 'translateX(-50%)',
            padding: '6px 11px',
            background: 'rgba(0, 0, 0, 0.78)',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', gap: 6,
            zIndex: 10,
          }}
        >
          {hasLandmarks && status === 'ready' ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#58aefe" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: hasLandmarks ? '#58aefe' : 'rgba(255,255,255,0.4)' }} />
          )}
          <span style={{ color: '#fff', fontSize: 10, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {!hasLandmarks ? '타원 안에 얼굴을 맞춰주세요' :
             isCapturing ? '결과 정리 중' :
             autoCapture && autoCountdown != null ? '자세 유지해주세요' :
             status === 'ready' ? '얼굴 인식 완료' :
             '타원 안에 얼굴을 맞춰주세요'}
          </span>
        </div>

        {/* Album fallback button */}
        <button
          onClick={() => { cleanup(); onFallback(); }}
          aria-label="앨범에서 사진 선택"
          style={{
            position: 'absolute', top: 'calc(12px + env(safe-area-inset-top, 0px))', right: 12,
            padding: '7px 12px', borderRadius: 16,
            background: 'rgba(255,255,255,0.92)', border: 'none',
            color: '#042C53', fontSize: 11, fontWeight: 500, cursor: 'pointer',
            zIndex: 10, fontFamily: 'inherit',
          }}
        >
          앨범에서 선택
        </button>
      </div>

      {/* Brightness sampling canvas (hidden) */}
      <canvas ref={brightnessCanvasRef} style={{ display: 'none' }} />

      {/* Bottom gradient overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
        background: 'linear-gradient(180deg, transparent 0%, rgba(88, 174, 254, 0.45) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Auto-capture countdown — 화면 중앙 큰 숫자 (baseline 자동 측정 모드) */}
      {autoCapture && autoCountdown != null && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 11,
        }}>
          <div
            key={autoCountdown}
            style={{
              fontSize: 120, fontWeight: 700, color: '#fff',
              fontFamily: 'var(--font-display), Pretendard, sans-serif',
              textShadow: '0 2px 12px rgba(0,0,0,0.3)',
              animation: 'countdownPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
            }}
          >{autoCountdown}</div>
          <style>{`@keyframes countdownPop { 0% { transform: scale(0.55); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }`}</style>
        </div>
      )}

      {/* Bottom controls */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'transparent',
        padding: '18px 20px calc(22px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>

        {/* Condition indicators — inline compact */}
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
          {[
            { key: 'face', label: '얼굴' },
            { key: 'position', label: '위치' },
            { key: 'distance', label: '거리' },
            { key: 'light', label: '조명' },
          ].map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: conditions[key] ? '#58aefe' : 'rgba(255,255,255,0.2)',
                transition: 'all 0.3s',
              }} />
              <span style={{
                color: conditions[key] ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                fontSize: 10, fontWeight: 500, transition: 'color 0.3s',
              }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Capture button — minimal ring */}
        <button
          onClick={handleCapture}
          disabled={isCapturing}
          style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'transparent',
            border: `2px solid ${canCapture ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.15)'}`,
            cursor: canCapture && !isCapturing ? 'pointer' : 'default',
            transition: 'all 0.3s',
            opacity: isCapturing ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0,
          }}
        >
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: canCapture ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.08)',
            transition: 'all 0.3s',
          }} />
        </button>
      </div>
    </div>
  );
}

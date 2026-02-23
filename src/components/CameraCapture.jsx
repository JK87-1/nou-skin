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

// Landmark indices for key facial points
const NOSE_TIP = 1;
const LEFT_EAR = 234;
const RIGHT_EAR = 454;
const FOREHEAD = 10;
const CHIN = 152;

// Key landmark indices to render as dots (~27 points)
const KEY_LANDMARKS = [
  10, 67, 109, 108, 69, 151, 337, 299, 297, 338,
  1, 4, 5,
  234, 454,
  152, 148, 377,
  93, 132, 58, 172,
  323, 361, 288, 397,
];

// Analysis zone definitions with landmark anchor and display config
const ANALYSIS_ZONES = [
  { label: '이마', anchor: 10, offsetY: -0.03, color: 'rgba(255,200,80,0.55)' },
  { label: 'T존', anchor: 4, offsetY: 0.01, color: 'rgba(255,160,60,0.5)' },
  { label: '왼볼', anchor: 93, offsetX: -0.03, color: 'rgba(100,180,255,0.5)' },
  { label: '오른볼', anchor: 323, offsetX: 0.03, color: 'rgba(100,180,255,0.5)' },
  { label: '턱선', anchor: 152, offsetY: 0.02, color: 'rgba(180,130,255,0.5)' },
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
function CameraErrorScreen({ reason, onFallback, onClose, onRetry }) {
  const isInsecure = reason === 'insecure';
  const isDenied = reason === 'denied';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#111', zIndex: 200,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%', marginBottom: 24,
        background: 'rgba(255,140,66,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36,
      }}>
        {isInsecure ? '🔒' : isDenied ? '🚫' : '📷'}
      </div>

      <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
        {isInsecure ? '보안 연결이 필요합니다' :
         isDenied ? '카메라 권한이 거부되었습니다' :
         '카메라를 사용할 수 없습니다'}
      </h2>

      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.6, marginBottom: 32, maxWidth: 300 }}>
        {isInsecure
          ? '모바일에서 카메라를 사용하려면 HTTPS 연결이 필요합니다. 앨범에서 사진을 선택해주세요.'
          : isDenied
          ? '브라우저 설정에서 카메라 권한을 허용한 후 다시 시도해주세요.'
          : '이 기기에서 카메라에 접근할 수 없습니다. 앨범에서 사진을 선택해주세요.'}
      </p>

      <button onClick={onFallback} style={{
        width: '100%', maxWidth: 300, padding: 16, borderRadius: 14, border: 'none',
        background: 'linear-gradient(135deg, #FFB347, #FF8C42)',
        color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 12,
      }}>
        앨범에서 사진 선택
      </button>

      {isDenied && (
        <button onClick={onRetry} style={{
          width: '100%', maxWidth: 300, padding: 14, borderRadius: 14,
          background: 'transparent', border: '1.5px solid rgba(255,255,255,0.3)',
          color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
        }}>
          다시 시도
        </button>
      )}

      <button onClick={onClose} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
        fontSize: 14, cursor: 'pointer', padding: '8px 16px',
      }}>
        돌아가기
      </button>
    </div>
  );
}

// ===== Main CameraCapture Component =====
export default function CameraCapture({ onCapture, onClose, onFallback }) {
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

  // drawOverlay reads statusRef (always fresh) — assigned to ref each render
  drawOverlayRef.current = function drawOverlay(ctx, W, H, landmarks, videoW, videoH) {
    ctx.clearRect(0, 0, W, H);

    // objectFit: cover coordinate mapping — video normalized coords → display coords
    const vidAspect = videoW / videoH;
    const dispAspect = W / H;
    let mapScale, mapOffX, mapOffY;
    if (dispAspect > vidAspect) {
      mapScale = W / videoW;
      mapOffX = 0;
      mapOffY = (H - videoH * mapScale) / 2;
    } else {
      mapScale = H / videoH;
      mapOffX = (W - videoW * mapScale) / 2;
      mapOffY = 0;
    }
    function mapX(nx) { return nx * videoW * mapScale + mapOffX; }
    function mapY(ny) { return ny * videoH * mapScale + mapOffY; }

    // Oval guide — fixed egg-shaped proportions based on display size
    const cx = W * 0.5;
    const cy = H * 0.44;
    const baseSize = Math.min(W, H);
    const rx = baseSize * 0.34;
    const ry = Math.min(rx * 1.35, H * 0.40);

    const curStatus = statusRef.current;
    let guideColor = 'rgba(255,255,255,0.6)';
    let glowColor = null;
    if (landmarks) {
      if (curStatus === 'ready') {
        guideColor = 'rgba(76,175,80,0.9)';
        glowColor = 'rgba(76,175,80,0.3)';
      } else {
        guideColor = 'rgba(255,193,7,0.8)';
      }
    }

    // Layer 1: Vignette mask
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Layer 2: Ellipse guide border
    ctx.save();
    if (glowColor) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 20;
    }
    ctx.strokeStyle = guideColor;
    ctx.lineWidth = 3;
    if (!landmarks) ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (!landmarks) return;

    // Layer 3: Analysis zone labels
    // Note: canvas has CSS scaleX(-1) for selfie mirror, so we counter-flip
    // each label with ctx.scale(-1,1) so text reads normally.
    ctx.font = '600 12px Pretendard, system-ui, sans-serif';
    for (const zone of ANALYSIS_ZONES) {
      if (zone.anchor >= landmarks.length) continue;
      const lm = landmarks[zone.anchor];
      const zx = mapX(lm.x + (zone.offsetX || 0));
      const zy = mapY(lm.y + (zone.offsetY || 0));

      ctx.save();
      ctx.translate(zx, zy);
      ctx.scale(-1, 1);  // counter CSS scaleX(-1) for readable text
      ctx.fillStyle = zone.color;
      const textW = ctx.measureText(zone.label).width + 18;
      const boxW = Math.max(textW, 42);
      const boxH = 24;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);
        ctx.fill();
      } else {
        ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
      }
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zone.label, 0, 0);
      ctx.restore();
    }

    // Layer 4: Landmark dots
    const dotColor = curStatus === 'ready' ? 'rgba(76,175,80,0.8)' : 'rgba(255,193,7,0.7)';
    for (const idx of KEY_LANDMARKS) {
      if (idx >= landmarks.length) continue;
      const lm = landmarks[idx];
      ctx.beginPath();
      ctx.arc(mapX(lm.x), mapY(lm.y), 2.5, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
    }

    // Layer 5: Under-eye dots — computed from pupil position
    // Right eye: upper 159, lower 145, inner 133, outer 33
    // Left eye:  upper 386, lower 374, inner 362, outer 263
    if (landmarks.length >= 468) {
      const eyes = [
        { upper: 159, lower: 145, inner: 133, outer: 33 },   // right eye
        { upper: 386, lower: 374, inner: 362, outer: 263 },   // left eye
      ];
      const underEyeDots = [];
      for (const eye of eyes) {
        const inn = landmarks[eye.inner], out = landmarks[eye.outer];
        // Use eye corners as stable anchor (unaffected by blinking)
        const ecx = (inn.x + out.x) / 2;
        const stableY = (inn.y + out.y) / 2;
        const eyeW = Math.abs(out.x - inn.x);
        // Fixed offset below eye corners — blink-proof
        const dotY = stableY + eyeW * 0.55;
        // 3 dots: center, inner(-spread), outer(+spread)
        const spread = eyeW * 0.22;
        underEyeDots.push(
          { x: ecx - spread, y: dotY },
          { x: ecx, y: dotY },
          { x: ecx + spread, y: dotY },
        );
      }
      for (const dot of underEyeDots) {
        ctx.beginPath();
        ctx.arc(mapX(dot.x), mapY(dot.y), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
      }

      // '눈밑' label next to right eye under-dots
      const rEyeCenter = underEyeDots[1]; // right eye center dot
      const labelX = mapX(rEyeCenter.x);
      const labelY = mapY(rEyeCenter.y + 0.02);
      ctx.save();
      ctx.translate(labelX, labelY);
      ctx.scale(-1, 1);
      ctx.font = '600 12px Pretendard, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,140,180,0.5)';
      const tw = ctx.measureText('눈밑').width + 18;
      const bw = Math.max(tw, 42), bh = 24;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 8);
        ctx.fill();
      } else {
        ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      }
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('눈밑', 0, 0);
      ctx.restore();
    }
  };

  // Evaluate face conditions from landmarks
  function evaluateConditions(landmarks) {
    if (!landmarks || landmarks.length < 468) {
      return { face: false, position: false, distance: false, light: false };
    }

    const cond = { face: true, position: false, distance: false, light: false };

    const nose = landmarks[NOSE_TIP];
    cond.position = Math.abs(nose.x - 0.5) < 0.15 && Math.abs(nose.y - 0.44) < 0.15;

    const earW = Math.abs(landmarks[RIGHT_EAR].x - landmarks[LEFT_EAR].x);
    const faceH = Math.abs(landmarks[CHIN].y - landmarks[FOREHEAD].y);
    cond.distance = earW > 0.18 && earW < 0.70 && faceH > 0.20 && faceH < 0.80;

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

      // Match canvas to display size (not video resolution) for correct proportions
      const rect = canvas.getBoundingClientRect();
      const W = canvas.width = Math.round(rect.width);
      const H = canvas.height = Math.round(rect.height);
      const ctx = canvas.getContext('2d');
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
    captureCanvas.getContext('2d').drawImage(video, 0, 0);
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

  // ===== Error screen =====
  if (cameraError) {
    return (
      <CameraErrorScreen
        reason={cameraError}
        onFallback={() => { cleanup(); onFallback(); }}
        onClose={() => { cleanup(); onClose(); }}
        onRetry={handleRetry}
      />
    );
  }

  const isReady = status === 'ready';
  const isCapturing = status === 'capturing' || status === 'captured';
  const canCapture = isReady || !mediapipeReady;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', zIndex: 200,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Camera preview */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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

        {/* Scanline animation */}
        {hasLandmarks && (
          <div style={{
            position: 'absolute',
            left: '16%', right: '16%',
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(76,175,80,0.6), transparent)',
            animation: 'scanLine 2.5s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
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
          style={{
            position: 'absolute', top: 'calc(16px + env(safe-area-inset-top, 0px))', left: 16,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(0,0,0,0.35)', border: 'none',
            color: '#fff', fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <span>←</span>
        </button>

        {/* Album fallback button */}
        <button
          onClick={() => { cleanup(); onFallback(); }}
          style={{
            position: 'absolute', top: 'calc(16px + env(safe-area-inset-top, 0px))', right: 16,
            padding: '8px 14px', borderRadius: 20,
            background: 'rgba(0,0,0,0.35)', border: 'none',
            color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            zIndex: 10,
          }}
        >
          앨범에서 선택
        </button>
      </div>

      {/* Brightness sampling canvas (hidden) */}
      <canvas ref={brightnessCanvasRef} style={{ display: 'none' }} />

      {/* Bottom controls */}
      <div style={{
        background: 'rgba(0,0,0,0.85)',
        padding: '16px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      }}>
        {/* Status text */}
        <p style={{
          color: isReady ? '#4CAF50' : '#fff',
          fontSize: 15, fontWeight: 600, textAlign: 'center',
          margin: 0, minHeight: 20,
          transition: 'color 0.3s',
        }}>
          {STATUS_TEXT[status] || ''}
        </p>

        {/* Condition indicators */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          {[
            { key: 'face', label: '얼굴' },
            { key: 'position', label: '위치' },
            { key: 'distance', label: '거리' },
            { key: 'light', label: '조명' },
          ].map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: conditions[key] ? '#4CAF50' : 'transparent',
                border: `2px solid ${conditions[key] ? '#4CAF50' : 'rgba(255,255,255,0.3)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s',
              }}>
                {conditions[key] && (
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>&#10003;</span>
                )}
              </div>
              <span style={{ color: conditions[key] ? '#4CAF50' : 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600 }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Capture button */}
        <button
          onClick={handleCapture}
          disabled={isCapturing}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: canCapture
              ? 'linear-gradient(135deg, #FFB347, #FF8C42)'
              : 'rgba(255,255,255,0.15)',
            border: `4px solid ${canCapture ? '#fff' : 'rgba(255,255,255,0.2)'}`,
            cursor: canCapture && !isCapturing ? 'pointer' : 'default',
            transition: 'all 0.3s',
            opacity: isCapturing ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: canCapture ? 'rgba(255,255,255,0.3)' : 'transparent',
          }} />
        </button>
      </div>
    </div>
  );
}

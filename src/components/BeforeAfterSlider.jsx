import { useState, useRef, useCallback, useEffect } from 'react';
import { getComparisonPhotos, getTotalChanges } from '../storage/SkinStorage';

export default function BeforeAfterSlider() {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const [photos, setPhotos] = useState(null);
  const [totalChanges, setTotalChanges] = useState(null);

  useEffect(() => {
    getComparisonPhotos().then(setPhotos);
    setTotalChanges(getTotalChanges());
  }, []);

  const getPosition = useCallback((clientX) => {
    if (!containerRef.current) return 50;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(2, Math.min(98, pct));
  }, []);

  const handleTouchStart = useCallback((e) => {
    setIsDragging(true);
    setSliderPos(getPosition(e.touches[0].clientX));
  }, [getPosition]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    setSliderPos(getPosition(e.touches[0].clientX));
  }, [isDragging, getPosition]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    setSliderPos(getPosition(e.clientX));
  }, [getPosition]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setSliderPos(getPosition(e.clientX));
  }, [isDragging, getPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Passive: false for iOS Safari
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e) => {
      if (isDragging) {
        e.preventDefault();
        setSliderPos(getPosition(e.touches[0].clientX));
      }
    };
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => el.removeEventListener('touchmove', onMove);
  }, [isDragging, getPosition]);

  if (!photos) return null;

  const formatDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    return `${y}.${m}.${d}`;
  };

  const scoreDiff = totalChanges?.overallScore || null;
  const ageDiff = totalChanges?.skinAge || null;
  const period = totalChanges?.period || 0;

  return (
    <div style={{ padding: '0 20px', marginBottom: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Before & After</span>
        {period > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{period}일간의 변화</span>
        )}
      </div>

      {/* Slider Container */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1',
          borderRadius: 20,
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* After image (full background) */}
        <img
          src={photos.after.dataUrl}
          alt=""
          draggable={false}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />

        {/* Before image (clipped) */}
        <div style={{
          position: 'absolute', inset: 0,
          clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
          WebkitClipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
        }}>
          <img
            src={photos.before.dataUrl}
            alt=""
            draggable={false}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Vertical divider line */}
        <div style={{
          position: 'absolute',
          left: `${sliderPos}%`,
          top: 0, bottom: 0,
          width: 2,
          background: '#fff',
          transform: 'translateX(-1px)',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          zIndex: 10,
        }} />

        {/* Draggable handle */}
        <div style={{
          position: 'absolute',
          left: `${sliderPos}%`,
          top: '50%',
          width: 36, height: 36,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          transform: 'translate(-50%, -50%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 11,
          pointerEvents: 'none',
          transition: isDragging ? 'none' : 'left 0.08s ease-out',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M8 4l-5 8 5 8M16 4l5 8-5 8" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* BEFORE label */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 8, padding: '4px 10px',
          zIndex: 5, pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: 0.8 }}>BEFORE</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)' }}>{formatDate(photos.before.date)}</div>
        </div>

        {/* AFTER label */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(240,144,112,0.75)', backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 8, padding: '4px 10px',
          zIndex: 5, pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: 0.8 }}>AFTER</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>{formatDate(photos.after.date)}</div>
        </div>

        {/* Score change overlay */}
        {totalChanges && (ageDiff !== 0 || scoreDiff !== 0) && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-modal-overlay)', backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: 14, padding: '8px 20px',
            display: 'flex', gap: 20, alignItems: 'center',
            zIndex: 5, pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}>
            {ageDiff !== null && ageDiff !== 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 16, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
                  color: ageDiff <= 0 ? '#4ade80' : '#f0a050',
                }}>{ageDiff > 0 ? '+' : ''}{ageDiff}세</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>피부나이</div>
              </div>
            )}
            {scoreDiff !== null && scoreDiff !== 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 16, fontWeight: 700, fontFamily: 'Outfit, sans-serif',
                  color: scoreDiff >= 0 ? '#4ade80' : '#f0a050',
                }}>{scoreDiff > 0 ? '+' : ''}{scoreDiff}점</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>종합점수</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

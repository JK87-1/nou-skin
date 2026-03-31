import { useState, useRef, useCallback } from 'react';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'];

function getDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDaysForWeek(weekOffset) {
  const now = new Date();
  const days = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + weekOffset * 7 + i);
    days.push({
      date: d.getDate(),
      dateKey: getDateKey(d),
      dayLabel: DAY_LABELS[d.getDay()],
      isToday: d.toDateString() === now.toDateString(),
      month: d.getMonth(),
      year: d.getFullYear(),
    });
  }
  return days;
}

export default function WeekDateHeader({ selectedDate, onSelectDate, weeklyData }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [slideDir, setSlideDir] = useState(null); // 'left' | 'right' | null
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const mouseStartX = useRef(0);
  const mouseDragging = useRef(false);

  const days = getDaysForWeek(weekOffset);
  const centerDay = days[3];

  const triggerSlide = useCallback((direction) => {
    setSlideDir(direction);
    setTimeout(() => {
      if (direction === 'left') setWeekOffset(o => o + 1);
      else setWeekOffset(o => o - 1);
      setSlideDir(null);
      setDragX(0);
    }, 200);
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
    setDragX(0);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      setDragX(dx * 0.4);
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback((e) => {
    setIsDragging(false);
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      triggerSlide(dx > 0 ? 'right' : 'left');
    } else {
      setDragX(0);
    }
  }, [triggerSlide]);

  // Mouse handlers (desktop)
  const handleMouseDown = useCallback((e) => {
    mouseStartX.current = e.clientX;
    mouseDragging.current = true;
    setIsDragging(true);
    setDragX(0);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!mouseDragging.current) return;
    const dx = e.clientX - mouseStartX.current;
    setDragX(dx * 0.4);
  }, []);

  const handleMouseUp = useCallback((e) => {
    if (!mouseDragging.current) return;
    mouseDragging.current = false;
    setIsDragging(false);
    const dx = e.clientX - mouseStartX.current;
    if (Math.abs(dx) > 50) {
      triggerSlide(dx > 0 ? 'right' : 'left');
    } else {
      setDragX(0);
    }
  }, [triggerSlide]);

  const handleMouseLeave = useCallback(() => {
    if (mouseDragging.current) {
      mouseDragging.current = false;
      setIsDragging(false);
      setDragX(0);
    }
  }, []);

  const slideTransform = slideDir === 'left'
    ? 'translateX(-100%)'
    : slideDir === 'right'
      ? 'translateX(100%)'
      : `translateX(${dragX}px)`;

  const slideOpacity = slideDir ? 0 : 1;

  return (
    <div style={{ padding: '16px 20px 12px', overflow: 'hidden' }}>
      {/* Month / Year */}
      <div style={{
        fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
        fontFamily: 'Pretendard, sans-serif', marginBottom: 16,
        transform: slideDir ? slideTransform : 'none',
        opacity: slideDir ? 0.5 : 1,
        transition: slideDir ? 'transform 0.2s ease, opacity 0.2s ease' : 'none',
      }}>
        {centerDay.year}년 {MONTH_NAMES[centerDay.month]}
      </div>

      {/* Swipeable Week Strip */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          display: 'flex', justifyContent: 'space-around',
          transform: slideTransform,
          opacity: slideOpacity,
          transition: slideDir
            ? 'transform 0.2s ease, opacity 0.2s ease'
            : isDragging
              ? 'none'
              : 'transform 0.15s ease, opacity 0.15s ease',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        {days.map((d) => {
          const isSelected = d.dateKey === selectedDate;
          const dayData = weeklyData?.find(w => w.date === d.dateKey);
          const completed = dayData?.completed;
          const partial = dayData?.partial;
          return (
            <div
              key={d.dateKey}
              onClick={() => onSelectDate(d.dateKey)}
              style={{ textAlign: 'center', minWidth: 36, cursor: 'pointer' }}
            >
              <div style={{
                fontSize: 11, fontWeight: 600, marginBottom: 8,
                color: d.isToday ? 'var(--text-primary)' : 'var(--text-dim)',
              }}>{d.dayLabel}</div>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: d.isToday || isSelected ? 700 : 400,
                color: d.isToday
                  ? '#fff'
                  : isSelected
                    ? 'var(--accent-primary)'
                    : completed
                      ? 'var(--accent-primary)'
                      : 'var(--text-muted)',
                background: d.isToday
                  ? '#81E4BD'
                  : isSelected
                    ? 'rgba(129,228,189,0.15)'
                    : completed
                      ? 'rgba(129,228,189,0.08)'
                      : 'transparent',
                border: partial && !d.isToday && !isSelected && !completed
                  ? '1.5px solid rgba(129,228,189,0.4)' : 'none',
                transition: 'background 0.2s, color 0.2s',
              }}>{d.date}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

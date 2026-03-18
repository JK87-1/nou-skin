/**
 * 피부 여정 (Daily Journey) — 7일 가로 스크롤 썸네일
 * 과거 사진은 소프트 블러, 호버/탭 시 해제
 * 오늘 칸은 + 아이콘 (미진단 시) 또는 사진 (진단 완료 시)
 */
import { useState, useEffect } from 'react';
import { getRecords, getAllThumbnailsAsync, getTodayRecord } from '../storage/SkinStorage';

export default function DailyJourney({ onTodayTap, onPastTap }) {
  const [thumbs, setThumbs] = useState({});
  const records = getRecords();
  const todayRecord = getTodayRecord();
  const today = new Date();

  useEffect(() => {
    getAllThumbnailsAsync().then(setThumbs);
  }, []);

  // 최근 7일 생성
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    // 다중 측정 시 최신 기록 사용
    const record = records.filter(r => r.date === key).pop() || null;
    days.push({
      date: key,
      dayLabel: i === 0 ? '오늘' : dayNames[d.getDay()],
      isToday: i === 0,
      record,
      thumb: (record ? thumbs[String(record.id)] : null) || thumbs[key] || null,
    });
  }

  if (records.length === 0) return null;

  return (
    <div style={{ padding: '0 20px', marginTop: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span className="section-label">SKIN JOURNEY</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>최근 7일</span>
      </div>
      <div className="journey-scroll">
        {days.map((day) => (
          <div
            key={day.date}
            className="journey-item"
            onClick={() => {
              if (day.isToday) onTodayTap?.();
              else if (day.record) onPastTap?.(day.record);
            }}
          >
            {day.isToday && !todayRecord ? (
              /* 오늘 미진단: + 아이콘 */
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                border: '2px dashed #F0A878',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(240,144,112,0.06)',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="#F0A878" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            ) : day.thumb ? (
              /* 사진 있음 */
              <img
                src={day.thumb}
                alt=""
                className={`journey-thumb${day.isToday ? ' today-border' : ' blurred'}`}
              />
            ) : day.record ? (
              /* 기록은 있지만 사진 없음 */
              <div className={`journey-thumb${day.isToday ? ' today-border' : ''}`} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(240,144,112,0.1), rgba(240,144,112,0.05))',
                fontSize: 16, fontWeight: 700, color: '#F0A878',
                fontFamily: "'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif",
              }}>
                {day.record.overallScore}
              </div>
            ) : (
              /* 기록 없음 */
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--bg-card)',
                border: '2px solid var(--border-light)',
              }} />
            )}
            <span className={`journey-day${day.isToday ? ' today' : ''}`}>{day.dayLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

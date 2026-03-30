import { useState } from 'react';
import { getLatestRecord, getRecords } from '../storage/SkinStorage';
import { getProfile } from '../storage/ProfileStorage';
import { getFoodRecords } from '../storage/FoodStorage';
import { getBodyRecords } from '../storage/BodyStorage';
import { getWeatherData } from '../storage/WeatherStorage';
import SkinWeather from '../components/SkinWeather';

const fadeUp = (delay = 0) => ({ animation: `breatheIn 0.5s ease ${delay}s both` });

export default function HomePage({ onMeasure, onTabChange }) {
  const [profile] = useState(getProfile);
  const latest = getLatestRecord();
  const records = getRecords();
  const streak = calcStreak(records);
  const nickname = profile.nickname || '사용자';
  const today = new Date();
  const [weatherSheet, setWeatherSheet] = useState(false);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', paddingBottom: 80 }}>
      {/* LUA Beta */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '14px 0 4px' }}>
        <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: 6, fontFamily: "'Fredoka', sans-serif", background: 'linear-gradient(120deg, #F9E84A, #FFB347, #FF8FAB)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>LUA</span>
        <span style={{ fontSize: 9, color: '#fff', background: 'linear-gradient(120deg, #F9E84A, #FFB347, #FF8FAB)', padding: '2px 8px', borderRadius: 'var(--chip-radius)', fontWeight: 500 }}>Beta</span>
      </div>

      {/* Header */}
      <div style={{ padding: '8px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Profile photo */}
        <div style={{
          width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
          background: 'var(--bg-secondary)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {profile.profileImage ? (
              <img src={profile.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <circle cx="12" cy="10" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </div>

        {/* Greeting + Today date */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>안녕하세요, {nickname}님</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            {today.getMonth() + 1}월 {today.getDate()}일 {['일', '월', '화', '수', '목', '금', '토'][today.getDay()]}요일
          </div>
        </div>

        {/* Weather chip button */}
        {(() => {
          const w = getWeatherData();
          const temp = w?.temp ?? '—';
          return (
            <div onClick={() => setWeatherSheet(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px 7px 8px',
              background: '#fff', borderRadius: 50, cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              WebkitTapHighlightColor: 'transparent',
            }}>
              <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
                <defs>
                  <radialGradient id="sun-home" cx="40%" cy="38%" r="55%">
                    <stop offset="0%" stopColor="#FFF9D0" />
                    <stop offset="50%" stopColor="#FFF3B0" />
                    <stop offset="100%" stopColor="#FFE082" />
                  </radialGradient>
                </defs>
                {[0,45,90,135,180,225,270,315].map(a => {
                  const r1 = 10.5, r2 = 15.5, rad = a * Math.PI / 180;
                  return <line key={a} x1={18+Math.cos(rad)*r1} y1={18+Math.sin(rad)*r1} x2={18+Math.cos(rad)*r2} y2={18+Math.sin(rad)*r2} stroke="#FFE082" strokeWidth="2" strokeLinecap="round" />;
                })}
                <circle cx="18" cy="18" r="9" fill="url(#sun-home)" />
                <ellipse cx="15.5" cy="15.5" rx="3.5" ry="2.5" fill="white" opacity="0.35" />
              </svg>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{temp}°</span>
            </div>
          );
        })()}
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* ── Streak Week Row (Part 1) ── */}
        <StreakWeekRow skinRecords={records} foodRecords={getFoodRecords()} bodyRecords={getBodyRecords()} />

        {/* ── Streak Card (Part 2) ── */}
        <StreakCard streak={streak} maxStreak={calcMaxStreak(records)} />

        {/* Today's Insight */}
        <div style={{
          marginTop: 14,
          background: 'linear-gradient(120deg, #FFF9E0, #FFE8D0, #FFD6E0)',
          borderRadius: 'var(--card-border-radius)',
          padding: '18px 20px',
          ...fadeUp(0.15),
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#9B4E10', marginBottom: 6 }}>오늘의 인사이트</div>
          <div style={{ fontSize: 13, color: '#7A3800', lineHeight: 1.7 }}>
            {getInsightText(latest)}
          </div>
        </div>

        {/* Today Summary */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '20px 0 10px', ...fadeUp(0.2) }}>
          오늘 기록
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, ...fadeUp(0.25) }}>
          <StatBox label="피부 점수" value={latest ? latest.overallScore : ''} unit="/ 100" accent="#FFB347" />
          <StatBox label="칼로리" value="" unit="kcal" accent="#FF8FAB" />
          <StatBox label="몸무게" value="" unit="kg" accent="#F9E84A" />
          <StatBox label="연속 기록" value={streak} unit="일" accent="#FFB347" />
        </div>

        {/* Quick Actions */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '24px 0 10px', ...fadeUp(0.3) }}>
          빠른 기록
        </div>
        <button onClick={onMeasure} style={{ ...btnStyle, ...fadeUp(0.35) }}>
          피부 측정하기
        </button>
        <button onClick={() => onTabChange('food')} style={{ ...btnStyle, marginTop: 10, background: 'var(--bg-card)', color: 'var(--text-secondary)', border: 'none', ...fadeUp(0.4) }}>
          식단 사진 찍기
        </button>
      </div>

      {/* Weather Bottom Sheet */}
      {weatherSheet && (
        <>
          <div onClick={() => setWeatherSheet(false)} style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.4)',
            animation: 'weatherFadeIn 0.3s ease',
          }} />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
            background: 'var(--bg-secondary)',
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            borderTop: '1px solid var(--border-light)',
            maxHeight: '85vh',
            animation: 'weatherSlideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
            overflow: 'hidden',
          }}>
            <style>{`
              @keyframes weatherFadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes weatherSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>
            <div onClick={() => setWeatherSheet(false)} style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', cursor: 'pointer' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-subtle)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 20px 8px' }}>
              <button onClick={() => setWeatherSheet(false)} style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--bg-card-hover)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, fontFamily: 'inherit',
              }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 'calc(85vh - 80px)', WebkitOverflowScrolling: 'touch' }}>
              <SkinWeather skinResult={latest} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StreakWeekRow({ skinRecords, foodRecords, bodyRecords }) {
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const today = new Date();
  const todayDay = today.getDay();

  // Build date sets for each category
  const skinDates = new Set(skinRecords.map(r => {
    const d = new Date(r.date || r.timestamp);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }));

  // foodRecords is { 'YYYY-MM-DD': [...], ... }
  const foodDates = new Set(Object.keys(foodRecords).filter(k => foodRecords[k]?.length > 0));

  const bodyDates = new Set(bodyRecords.map(r => r.date));

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - todayDay + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const isToday = i === todayDay;
    const hasSkin = skinDates.has(dateStr);
    const hasFood = foodDates.has(dateStr);
    const hasBody = bodyDates.has(dateStr);
    const count = (hasSkin ? 1 : 0) + (hasFood ? 1 : 0) + (hasBody ? 1 : 0);
    weekDays.push({ label: dayLabels[i], isToday, count });
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 16, ...fadeUp(0.05),
    }}>
      {weekDays.map((d, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{d.label}</div>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: d.count > 0
              ? 'linear-gradient(135deg, #F9E84A, #FFB347, #FF8FAB)'
              : d.isToday
                ? 'rgba(255,179,71,0.1)'
                : 'var(--bg-card)',
          }}>
            {d.count > 0 ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2c0 0-5 6-5 11a5 5 0 0010 0c0-5-5-11-5-11z"
                  fill={d.count === 3 ? '#7A3800' : d.count === 2 ? 'rgba(122,56,0,0.7)' : 'rgba(122,56,0,0.45)'}
                />
              </svg>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function StreakCard({ streak, maxStreak }) {
  // Ring chart
  const maxDays = 30;
  const pct = Math.min(1, streak / maxDays);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = circ * pct;

  return (
    <div style={{
      marginTop: 14,
      background: 'linear-gradient(135deg, rgba(249,232,74,0.18) 0%, rgba(255,179,71,0.15) 50%, rgba(255,143,171,0.15) 100%)',
      border: 'none',
      borderRadius: 20,
      padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 16,
      ...fadeUp(0.1),
    }}>
      {/* Ring Chart */}
      <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
        <svg viewBox="0 0 72 72" style={{ width: 72, height: 72 }}>
          <defs>
            <linearGradient id="streakGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F9E84A" />
              <stop offset="50%" stopColor="#FFB347" />
              <stop offset="100%" stopColor="#FF8FAB" />
            </linearGradient>
          </defs>
          <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,179,71,0.15)" strokeWidth="6" />
          <circle cx="36" cy="36" r={r} fill="none" stroke="url(#streakGrad)" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${fill} ${circ - fill}`}
            strokeDashoffset={circ * 0.25}
            transform="rotate(-90 36 36)"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{streak}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Days</div>
        </div>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>
          {streak > 0 ? `${streak}일 연속 기록 중` : '오늘 첫 기록을 시작하세요'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 3 }}>
          {streak > 0 ? '꾸준한 기록이 변화의 시작이에요' : '매일 기록하면 변화를 확인할 수 있어요'}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 20,
            background: 'var(--bg-card)', color: 'var(--text-muted)', fontWeight: 500,
          }}>최장 연속</span>
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 20,
            background: 'linear-gradient(120deg, #F9E84A, #FFB347)',
            color: '#7A3800', fontWeight: 600,
          }}>{maxStreak}일</span>
        </div>
      </div>
    </div>
  );
}

function calcMaxStreak(records) {
  if (!records || records.length === 0) return 0;
  const dates = [...new Set(records.map(r => {
    const d = new Date(r.date || r.timestamp);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }))].sort((a, b) => a - b);

  let max = 1, cur = 1;
  const day = 86400000;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] - dates[i - 1] === day) {
      cur++;
      if (cur > max) max = cur;
    } else {
      cur = 1;
    }
  }
  return max;
}

function StatBox({ label, value, unit }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 'var(--card-border-radius)',
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4, fontFamily: 'var(--font-display)' }}>
        {value} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)' }}>{unit}</span>
      </div>
    </div>
  );
}

function calcStreak(records) {
  if (!records || records.length === 0) return 0;
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = 86400000;
  const dates = [...new Set(records.map(r => {
    const d = new Date(r.date || r.timestamp);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }))].sort((a, b) => b - a);

  for (let i = 0; i < dates.length; i++) {
    const expected = today.getTime() - i * day;
    if (dates[i] === expected) streak++;
    else break;
  }
  return streak;
}

function getInsightText(latest) {
  if (!latest) return '피부 측정을 시작하면 매일 맞춤 인사이트를 받을 수 있어요.';
  if (latest.moisture < 50) return '수분 섭취가 부족해요. 피부 수분도에 영향을 줄 수 있어요.';
  if (latest.oilBalance > 70) return '유분이 높은 편이에요. 가벼운 보습제를 추천해요.';
  if (latest.overallScore >= 80) return '피부 컨디션이 좋아요! 꾸준히 유지해보세요.';
  return '오늘도 꾸준한 관리가 피부를 바꿔요. 화이팅!';
}

const btnStyle = {
  width: '100%', padding: '14px 0',
  background: 'linear-gradient(120deg, #F9E84A, #FFB347, #FF8FAB)',
  border: 'none', borderRadius: 'var(--btn-radius)',
  fontSize: 14, fontWeight: 600,
  color: '#7A3800', cursor: 'pointer', fontFamily: 'inherit',
};

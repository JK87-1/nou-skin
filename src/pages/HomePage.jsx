import { useState, useEffect } from 'react';
import { getLatestRecord, getRecords, getChanges } from '../storage/SkinStorage';
import { getProfile } from '../storage/ProfileStorage';
import { getTodayNutrition, getFoodGoal } from '../storage/FoodStorage';
import { getBodyRecords } from '../storage/BodyStorage';
import { getWeatherData } from '../storage/WeatherStorage';
import { getTodayProgress } from '../storage/RoutineCheckStorage';
import SkinWeather from '../components/SkinWeather';

const fadeUp = (delay = 0) => ({ animation: `breatheIn 0.5s ease ${delay}s both` });
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export default function HomePage({ onMeasure, onTabChange, onOpenRoutine }) {
  const [profile] = useState(getProfile);
  const latest = getLatestRecord();
  const records = getRecords();
  const changes = getChanges();
  const today = new Date();
  const weather = getWeatherData();
  const nutrition = getTodayNutrition();
  const foodGoal = getFoodGoal();
  const bodyRecords = getBodyRecords();
  const latestWeight = bodyRecords.length > 0 ? bodyRecords[bodyRecords.length - 1] : null;
  const prevWeight = bodyRecords.length > 1 ? bodyRecords[bodyRecords.length - 2] : null;
  const weightDiff = latestWeight && prevWeight ? (latestWeight.weight - prevWeight.weight).toFixed(1) : null;
  const skinDiff = changes?.overallScore ? (changes.overallScore.diff > 0 ? `+${changes.overallScore.diff}` : `${changes.overallScore.diff}`) : null;

  // Routine progress
  const skinRoutine = getTodayProgress('skin');
  const foodRoutine = getTodayProgress('food');
  const bodyRoutine = getTodayProgress('body');
  const totalRoutine = skinRoutine.total + foodRoutine.total + bodyRoutine.total;
  const doneRoutine = skinRoutine.done + foodRoutine.done + bodyRoutine.done;
  const routinePct = totalRoutine > 0 ? Math.round((doneRoutine / totalRoutine) * 100) : 0;

  const [weatherSheet, setWeatherSheet] = useState(false);
  const [coachMsg, setCoachMsg] = useState(null);

  // Weather warning text
  const getWeatherWarning = () => {
    if (!weather) return '';
    if (weather.humidity < 40) return '건조함 주의';
    if (weather.airQuality > 80) return '미세먼지 주의';
    if (weather.uv > 6) return '자외선 강함';
    return '';
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', paddingBottom: 80 }}>

      {/* 1. Header */}
      <div style={{ padding: '8px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Profile photo */}
        <div style={{
          width: 55, height: 55, borderRadius: '50%', overflow: 'hidden',
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

        {/* LUA Beta */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: 5, fontFamily: "'Fredoka', sans-serif", color: '#81E4BD' }}>LUA</span>
          <span style={{ fontSize: 8, color: '#fff', background: '#81E4BD', padding: '1px 6px', borderRadius: 8, fontWeight: 500 }}>Beta</span>
        </div>

        {/* Weather chip button */}
        {(() => {
          const temp = weather?.temp ?? '—';
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

      <div style={{ padding: '0 16px' }}>

        {/* Today's Insight */}
        <div style={{
          padding: 20, borderRadius: 16, marginBottom: 12,
          background: '#f9f9f9', ...fadeUp(0.03),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
                <defs>
                  <linearGradient id="hi-g1" x1="20%" y1="0%" x2="80%" y2="100%">
                    <stop offset="0%" stopColor="#FFF3B0" />
                    <stop offset="100%" stopColor="#FFE082" />
                  </linearGradient>
                  <linearGradient id="hi-g2" x1="20%" y1="0%" x2="80%" y2="100%">
                    <stop offset="0%" stopColor="#FFF9D0" />
                    <stop offset="100%" stopColor="#FFF3B0" />
                  </linearGradient>
                </defs>
                <path d="M18 2 L21 12 L31 15.5 L21 19 L18 29 L15 19 L5 15.5 L15 12 Z" fill="url(#hi-g1)" />
                <path d="M28 3 L29 6.5 L32.5 7.5 L29 8.5 L28 12 L27 8.5 L23.5 7.5 L27 6.5 Z" fill="url(#hi-g2)" />
                <path d="M8 24 L9 27 L12 28 L9 29 L8 32 L7 29 L4 28 L7 27 Z" fill="url(#hi-g2)" />
                <ellipse cx="15" cy="12" rx="3" ry="2" fill="white" opacity="0.3" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#8B95A1' }}>오늘의 인사이트</div>
              <div style={{ fontSize: 14, color: '#4E5968', marginTop: 4, lineHeight: 1.5 }}>
                {getInsightText(latest)}
              </div>
            </div>
          </div>
        </div>

        {/* Skincare Tracker Card */}
        <div onClick={onOpenRoutine} style={{
          padding: 20, borderRadius: 16, marginBottom: 12,
          background: '#f9f9f9', cursor: 'pointer',
          ...fadeUp(0.04),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
                <defs>
                  <linearGradient id="lot-g1" x1="30%" y1="0%" x2="70%" y2="100%">
                    <stop offset="0%" stopColor="#FFF0F3" />
                    <stop offset="100%" stopColor="#FFD0DA" />
                  </linearGradient>
                  <linearGradient id="lot-g2" x1="30%" y1="0%" x2="70%" y2="100%">
                    <stop offset="0%" stopColor="#FFE0E8" />
                    <stop offset="100%" stopColor="#FFC0CC" />
                  </linearGradient>
                </defs>
                <rect x="13" y="3" width="10" height="4" rx="1.5" fill="url(#lot-g2)" />
                <rect x="16.5" y="1" width="3" height="3" rx="1" fill="url(#lot-g2)" />
                <rect x="14" y="0.5" width="8" height="1.5" rx="0.75" fill="url(#lot-g2)" />
                <rect x="11" y="7" width="14" height="20" rx="4" fill="url(#lot-g1)" />
                <rect x="13" y="13" width="10" height="8" rx="2" fill="white" opacity="0.3" />
                <rect x="12.5" y="9" width="3" height="12" rx="1.5" fill="white" opacity="0.2" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>스킨케어 트래커</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>제품 등록 · 루틴 관리 · 효과 분석</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* 2. AI Coach Card — same layout as Insight */}
        <div style={{
          padding: 20, borderRadius: 16, marginBottom: 12,
          background: '#f9f9f9', ...fadeUp(0.05),
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
                <defs>
                  <linearGradient id="coach-g1" x1="20%" y1="0%" x2="80%" y2="100%">
                    <stop offset="0%" stopColor="#B8F0D8" />
                    <stop offset="100%" stopColor="#81E4BD" />
                  </linearGradient>
                </defs>
                <circle cx="18" cy="18" r="14" fill="url(#coach-g1)" />
                <text x="18" y="23" textAnchor="middle" fontSize="16">✨</text>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: '#8B95A1' }}>LUA AI 코치</div>
              <div style={{ fontSize: 14, color: '#4E5968', marginTop: 4, lineHeight: 1.5 }}>
                {getCoachMessage(latest, nutrition, foodGoal, latestWeight, doneRoutine, totalRoutine, weather)}
              </div>
              {/* Tags */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {getCoachTags(latest, nutrition, foodGoal, doneRoutine, totalRoutine).map((tag, i) => (
                  <span key={i} style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 8,
                    background: 'rgba(129,228,189,0.12)', color: 'var(--text-muted)', fontWeight: 500,
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Today Stats (3 cards) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12, ...fadeUp(0.1) }}>
          <StatCard
            icon="🔬" label="피부"
            value={latest ? latest.overallScore : ''} unit="점"
            change={skinDiff ? `${skinDiff}점` : null}
            changePositive={skinDiff ? parseFloat(skinDiff) >= 0 : null}
          />
          <StatCard
            icon="🍽️" label="식단"
            value={nutrition.kcal > 0 ? nutrition.kcal.toLocaleString() : ''} unit="kcal"
            change={nutrition.kcal > 0 ? `목표 ${foodGoal.kcal.toLocaleString()}` : null}
            changePositive={null}
          />
          <StatCard
            icon="⚖️" label="몸무게"
            value={latestWeight ? latestWeight.weight : ''} unit="kg"
            change={weightDiff ? `${weightDiff}kg` : null}
            changePositive={weightDiff ? parseFloat(weightDiff) <= 0 : null}
          />
        </div>

        {/* 4. Routine Summary Bar */}
        <div onClick={() => onTabChange('routine')} style={{
          borderRadius: 14, padding: '11px 13px', marginBottom: 12,
          background: '#f9f9f9', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
          ...fadeUp(0.15),
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>오늘 루틴</span>
              <span style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 600 }}>{doneRoutine} / {totalRoutine} 완료</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--bar-track)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, width: `${routinePct}%`,
                background: 'var(--accent-primary)',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              {totalRoutine === 0
                ? '루틴을 추가해보세요'
                : doneRoutine >= totalRoutine
                  ? '오늘 루틴 모두 완료! 🎉'
                  : getIncompleteText()
              }
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* 5. Quick Action Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, ...fadeUp(0.2) }}>
          <QuickAction icon="🔬" label="피부 측정" onTap={onMeasure} />
          <QuickAction icon="🤳" label="얼굴 사진" onTap={() => onTabChange('album')} />
          <QuickAction icon="🍽️" label="식단 기록" onTap={() => onTabChange('food')} />
          <QuickAction icon="⚖️" label="몸무게" onTap={() => onTabChange('body')} />
        </div>
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

  function getIncompleteText() {
    const names = [];
    if (skinRoutine.done < skinRoutine.total) names.push('피부');
    if (foodRoutine.done < foodRoutine.total) names.push('식단');
    if (bodyRoutine.done < bodyRoutine.total) names.push('바디');
    return names.length > 0 ? `${names.join(' · ')} 루틴이 남았어요` : '';
  }
}

// ===== Stat Card =====
function StatCard({ icon, label, value, unit, change, changePositive }) {
  const changeColor = changePositive === null ? 'var(--text-muted)' : changePositive ? '#0F6E56' : '#C4580A';
  return (
    <div style={{
      borderRadius: 12, padding: '10px 8px', background: '#f9f9f9',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
        {value || '—'}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{unit}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      {change && (
        <div style={{ fontSize: 9, color: changeColor, marginTop: 3, fontWeight: 600 }}>{change}</div>
      )}
    </div>
  );
}

// ===== Quick Action =====
function QuickAction({ icon, label, onTap }) {
  return (
    <div onClick={onTap} style={{
      borderRadius: 12, padding: '11px 10px', background: '#f9f9f9',
      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
    }}>
      <div style={{ fontSize: 20, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
    </div>
  );
}

// ===== AI Coach Message =====
function getCoachMessage(latest, nutrition, foodGoal, weight, routineDone, routineTotal, weather) {
  if (!latest && nutrition.kcal === 0 && !weight) {
    return '오늘 첫 기록을 시작해보세요! 피부 측정, 식단 기록, 몸무게 중 하나를 기록하면 맞춤 코칭을 받을 수 있어요 ✨';
  }

  const parts = [];

  if (weather?.humidity < 40) {
    parts.push('오늘 공기가 건조해요. 수분 크림과 물 섭취를 신경 써주세요 💧');
  } else if (weather?.uv > 6) {
    parts.push('자외선이 강해요. 선크림을 꼭 바르세요 ☀️');
  }

  if (latest) {
    if (latest.overallScore >= 80) parts.push('피부 컨디션이 좋아요! 이 루틴을 유지해보세요.');
    else if (latest.moisture < 50) parts.push('수분도가 낮아요. 보습에 집중해보세요.');
  }

  if (nutrition.kcal > 0 && foodGoal.kcal) {
    const ratio = nutrition.kcal / foodGoal.kcal;
    if (ratio > 1.2) parts.push('칼로리가 목표를 넘었어요. 저녁은 가볍게!');
    else if (ratio < 0.5) parts.push('아직 식사가 부족해요. 균형 잡힌 식단을 챙겨보세요.');
  }

  if (routineTotal > 0 && routineDone >= routineTotal) {
    parts.push('오늘 루틴을 모두 완료했어요! 대단해요 🎉');
  }

  return parts.length > 0 ? parts.slice(0, 2).join(' ') : '오늘도 건강한 하루를 만들어봐요! 꾸준함이 가장 큰 변화를 만들어요 ✨';
}

function getCoachTags(latest, nutrition, foodGoal, routineDone, routineTotal) {
  const tags = [];
  if (latest?.moisture < 50) tags.push('수분 부족');
  if (latest?.oilBalance > 70) tags.push('유분 관리');
  if (nutrition.kcal > 0 && nutrition.protein < (foodGoal.protein || 80) * 0.7) tags.push('단백질 부족');
  if (routineTotal > 0 && routineDone < routineTotal) tags.push(`루틴 ${routineTotal - routineDone}개 남음`);
  return tags.length > 0 ? tags : ['기록을 시작해보세요'];
}

function getInsightText(latest) {
  if (!latest) return '피부 측정을 시작하면 매일 맞춤 인사이트를 받을 수 있어요.';
  if (latest.moisture < 50) return '수분 섭취가 부족해요. 피부 수분도에 영향을 줄 수 있어요.';
  if (latest.oilBalance > 70) return '유분이 높은 편이에요. 가벼운 보습제를 추천해요.';
  if (latest.overallScore >= 80) return '피부 컨디션이 좋아요! 꾸준히 유지해보세요.';
  return '오늘도 꾸준한 관리가 피부를 바꿔요. 화이팅!';
}

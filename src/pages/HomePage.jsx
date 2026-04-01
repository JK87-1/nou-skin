import { useState, useEffect } from 'react';
import { getLatestRecord, getRecords, getChanges } from '../storage/SkinStorage';
import { getProfile, saveProfile, SKIN_TYPES, SKIN_CONCERNS, GENDER_OPTIONS } from '../storage/ProfileStorage';
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
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountPage, setShowAccountPage] = useState(false);
  const [userProfile, setUserProfile] = useState(getProfile);

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
        {/* Menu icon */}
        <div onClick={() => setShowSettings(true)} style={{
          width: 40, height: 40, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
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

        {/* Profile photo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 12, ...fadeUp(0.02),
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', overflow: 'hidden',
            background: 'var(--bg-secondary)', flexShrink: 0,
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
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              {profile.nickname || '사용자'}님
            </div>
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

      {/* Settings Drawer */}
      <SettingsDrawer open={showSettings} onClose={() => setShowSettings(false)}
        onAccount={() => { setShowSettings(false); setShowAccountPage(true); }} />

      {/* Account Page */}
      {showAccountPage && (
        <AccountPage
          profile={userProfile}
          onUpdate={(key, val) => { const next = saveProfile({ [key]: val }); setUserProfile(next); }}
          onClose={() => setShowAccountPage(false)}
        />
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

// ===== Settings Drawer =====
function SettingsDrawer({ open, onClose, onAccount }) {
  const menuItems = [
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, label: '계정', action: onAccount },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, label: '개인정보 보호' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>, label: '화면' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, label: '알림' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4z"/></svg>, label: '공지사항' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, label: '정보' },
    { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, label: '문의하기' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.5)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
      }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 2001,
        width: '80%', maxWidth: 320,
        background: 'var(--bg-primary, #fff)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {/* Close button */}
        <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={onClose} style={{
            width: 36, height: 36, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        </div>

        {/* Menu items */}
        <div style={{ flex: 1, padding: '12px 0' }}>
          {menuItems.map((item) => (
            <div key={item.label} onClick={() => item.action ? item.action() : null} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 28px', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              color: 'var(--text-primary)',
            }}>
              {item.icon}
              <span style={{ fontSize: 15, fontWeight: 500 }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div style={{ padding: '16px 28px 40px', borderTop: '1px solid var(--border-light, #eee)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>버전 1.0.0</div>
          <div onClick={() => {}} style={{
            fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer',
          }}>로그아웃</div>
        </div>
      </div>
    </>
  );
}

// ===== Account Page (Full screen) =====
function AccountPage({ profile, onUpdate, onClose }) {
  const currentYear = new Date().getFullYear();
  const age = profile.birthYear ? currentYear - parseInt(profile.birthYear) : null;

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none',
    background: 'var(--bg-input, #F2F3F5)', fontSize: 14,
    color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      background: 'var(--bg-primary, #fff)',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      animation: 'slideInRight 0.3s ease',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 1,
        background: 'var(--bg-primary, #fff)',
        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div onClick={onClose} style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>계정</div>
      </div>

      <div style={{ padding: '0 24px 40px' }}>
        {/* Profile photo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div onClick={() => document.getElementById('account-photo-input')?.click()} style={{
            position: 'relative', width: 80, height: 80, borderRadius: '50%', cursor: 'pointer',
            overflow: 'hidden', background: 'var(--bg-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {profile.profileImage ? (
              <img src={profile.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <circle cx="12" cy="10" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
              </svg>
            )}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 24,
              background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#fff" strokeWidth="1.5" />
                <circle cx="12" cy="13" r="3" stroke="#fff" strokeWidth="1.5" />
              </svg>
            </div>
            <input id="account-photo-input" type="file" accept="image/*" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = 200; canvas.height = 200;
                  const ctx = canvas.getContext('2d');
                  const size = Math.min(img.width, img.height);
                  const sx = (img.width - size) / 2, sy = (img.height - size) / 2;
                  ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
                  onUpdate('profileImage', canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = ev.target.result;
              };
              reader.readAsDataURL(file);
            }} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Nickname */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>닉네임</div>
          <input value={profile.nickname || ''} onChange={e => onUpdate('nickname', e.target.value)}
            placeholder="닉네임" maxLength={20} style={inputStyle} />
        </div>

        {/* 기본 정보 */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '24px 0 12px' }}>기본 정보</div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>생년월일</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input value={profile.birthYear || ''} onChange={e => onUpdate('birthYear', e.target.value)}
              placeholder="예: 1995" type="number" min={1940} max={currentYear} style={{ ...inputStyle, flex: 1 }} />
            {age > 0 && <span style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>만 {age}세</span>}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>성별</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {GENDER_OPTIONS.map(g => (
              <button key={g} onClick={() => onUpdate('gender', g)} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                background: profile.gender === g ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                color: profile.gender === g ? '#fff' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{g}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>키 (cm)</div>
            <input value={profile.height || ''} onChange={e => onUpdate('height', e.target.value)}
              placeholder="165" type="number" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>현재 몸무게 (kg)</div>
            <input value={profile.currentWeight || ''} onChange={e => onUpdate('currentWeight', e.target.value)}
              placeholder="60" type="number" step="0.1" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>목표 몸무게 (kg)</div>
          <input value={profile.goalWeight || ''} onChange={e => onUpdate('goalWeight', e.target.value)}
            placeholder="55" type="number" step="0.1" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>활동 수준</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['거의 없음', '가벼운 활동', '보통', '활발한 활동', '매우 활발'].map(level => (
              <button key={level} onClick={() => onUpdate('activityLevel', level)} style={{
                padding: '8px 14px', borderRadius: 10, border: 'none',
                background: profile.activityLevel === level ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                color: profile.activityLevel === level ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{level}</button>
            ))}
          </div>
        </div>

        {/* 피부 정보 */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '24px 0 12px' }}>피부 정보</div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>피부 타입</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SKIN_TYPES.map(t => (
              <button key={t} onClick={() => onUpdate('skinType', t)} style={{
                padding: '8px 14px', borderRadius: 10, border: 'none',
                background: profile.skinType === t ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                color: profile.skinType === t ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>주요 피부 고민</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SKIN_CONCERNS.map(c => {
              const active = (profile.skinConcerns || []).includes(c);
              return (
                <button key={c} onClick={() => {
                  const list = active ? profile.skinConcerns.filter(x => x !== c) : [...(profile.skinConcerns || []), c];
                  onUpdate('skinConcerns', list);
                }} style={{
                  padding: '8px 14px', borderRadius: 10, border: 'none',
                  background: active ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                  color: active ? '#fff' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}>{c}</button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

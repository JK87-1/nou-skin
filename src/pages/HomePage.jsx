import { useState, useEffect, useMemo } from 'react';
import { getLatestRecord } from '../storage/SkinStorage';
import { getProfile, saveProfile, SKIN_TYPES, SKIN_CONCERNS, GENDER_OPTIONS } from '../storage/ProfileStorage';
import { getTodayNutrition, getFoodGoal } from '../storage/FoodStorage';
import { getWeatherData } from '../storage/WeatherStorage';
import { getTodayProgress } from '../storage/RoutineCheckStorage';
import {
  getTodayChecks, getLatestCheck, saveConditionCheck,
  shouldResetCheck, getMinutesSinceLastCheck,
} from '../storage/ConditionStorage';

const CONDITION_ITEMS = [
  { id: 'energy', icon: '\u26A1', label: '에너지' },
  { id: 'skin',   icon: '\u2728', label: '피부' },
  { id: 'mood',   icon: '\uD83D\uDE0A', label: '기분' },
  { id: 'gut',    icon: '\uD83C\uDF3F', label: '장 상태' },
];

const DOT_COLORS = ['#FFE0E0', '#FFB347', '#FFF3B0', '#B8F0E0', '#4DB8A0'];

// ===== AI 인사이트 생성 (로컬) =====
function generateInsight(check, skinResult, nutrition, weather) {
  const e = check?.energy || 3, s = check?.skin || 3, m = check?.mood || 3, g = check?.gut || 3;
  const avg = (e + s + m + g) / 4;

  // 인과관계 흐름 생성
  const flows = [];
  const descs = [];

  if (e <= 2 && g <= 2) {
    flows.push({ flow: ['장 불편', '영양 흡수 저하', '피로 + 피부 예민'], desc: '장 컨디션이 에너지와 피부에 영향을 줄 수 있어요' });
  }
  if (e <= 2 && nutrition?.kcal > 800) {
    flows.push({ flow: ['식후 혈당 변화', '에너지 저하', '집중력 감소'], desc: '식사 후 혈당 변화가 피로감의 원인일 수 있어요' });
  }
  if (s <= 2 && weather?.humidity < 40) {
    flows.push({ flow: ['낮은 습도', '수분 증발', '피부 예민'], desc: '건조한 환경이 피부 컨디션에 영향을 줘요' });
  }
  if (s <= 2 && skinResult?.moisture < 50) {
    flows.push({ flow: ['수분 부족', '피부 장벽 약화', '피부 예민'], desc: '피부 수분도가 낮아 예민해질 수 있어요' });
  }
  if (m <= 2 && e <= 2) {
    flows.push({ flow: ['수면 부족', '피로 누적', '기분 저하'], desc: '충분한 휴식이 기분 회복에 도움이 돼요' });
  }
  if (e >= 4 && s >= 4) {
    flows.push({ flow: ['충분한 휴식', '좋은 컨디션', '피부 회복'], desc: '현재 컨디션이 좋아서 피부도 안정적이에요' });
  }

  if (flows.length === 0) {
    if (avg >= 3.5) {
      flows.push({ flow: ['균형 잡힌 생활', '안정적 컨디션', '좋은 상태 유지'], desc: '전반적으로 균형 잡힌 상태예요' });
    } else {
      flows.push({ flow: ['컨디션 변화 감지', '원인 분석 중', '맞춤 케어 필요'], desc: '데이터를 더 모으면 정확한 분석이 가능해요' });
    }
  }

  return flows[0];
}

function generateHeroStatus(check) {
  if (!check) return { status: '오늘 컨디션을 체크해보세요', sub: '체크하면 AI가 원인을 분석해드려요' };
  const e = check.energy, s = check.skin, m = check.mood, g = check.gut;
  const avg = (e + s + m + g) / 4;

  const lowItems = [];
  if (e <= 2) lowItems.push('피로');
  if (s <= 2) lowItems.push('피부 예민');
  if (m <= 2) lowItems.push('기분 저하');
  if (g <= 2) lowItems.push('장 불편');

  const highItems = [];
  if (e >= 4) highItems.push('에너지 좋음');
  if (s >= 4) highItems.push('피부 좋음');
  if (m >= 4) highItems.push('기분 좋음');
  if (g >= 4) highItems.push('장 상태 좋음');

  let status, sub;
  if (avg >= 4) {
    status = '오늘 컨디션이 아주 좋아요';
    sub = highItems.slice(0, 2).join(' · ');
  } else if (avg >= 3) {
    status = '오늘 전반적으로 괜찮아요';
    sub = lowItems.length > 0 ? `${lowItems[0]}만 좀 신경 쓰면 돼요` : '무난한 하루를 보내고 있어요';
  } else {
    status = lowItems.length > 0 ? `지금 ${lowItems.slice(0, 2).join(' · ')} 느껴져요` : '컨디션이 좀 낮아요';
    sub = '원인을 분석해서 케어 방법을 알려드릴게요';
  }
  return { status, sub };
}

function generateAction(check) {
  if (!check) return '지금 → 컨디션 체크 시작 →';
  const e = check.energy, s = check.skin, g = check.gut;

  if (e <= 2 && g <= 2) return '지금 → 따뜻한 물 + 가벼운 산책 →';
  if (e <= 2) return '지금 → 10분 스트레칭 추천 →';
  if (s <= 2) return '지금 → 물 한 잔 + 수분크림 →';
  if (g <= 2) return '지금 → 따뜻한 차 한 잔 →';
  if (check.mood <= 2) return '지금 → 5분 심호흡 추천 →';
  return '지금 → 현재 루틴 유지 추천 →';
}

export default function HomePage({ onMeasure, onTabChange, onOpenRoutine }) {
  const [profile] = useState(getProfile);
  const latest = getLatestRecord();
  const weather = getWeatherData();
  const nutrition = getTodayNutrition();
  const skinRoutine = getTodayProgress('skin');
  const foodRoutine = getTodayProgress('food');
  const bodyRoutine = getTodayProgress('body');
  const totalRoutine = skinRoutine.total + foodRoutine.total + bodyRoutine.total;
  const doneRoutine = skinRoutine.done + foodRoutine.done + bodyRoutine.done;
  const routinePct = totalRoutine > 0 ? Math.round((doneRoutine / totalRoutine) * 100) : 0;

  const [showSettings, setShowSettings] = useState(false);
  const [showAccountPage, setShowAccountPage] = useState(false);
  const [userProfile, setUserProfile] = useState(getProfile);

  // Condition check state
  const latestCheck = getLatestCheck();
  const resetNeeded = shouldResetCheck();
  const [selections, setSelections] = useState(() => {
    if (!resetNeeded && latestCheck) {
      return { energy: latestCheck.energy, skin: latestCheck.skin, mood: latestCheck.mood, gut: latestCheck.gut };
    }
    return { energy: 0, skin: 0, mood: 0, gut: 0 };
  });
  const [justUpdated, setJustUpdated] = useState(false);
  const [todayChecks, setTodayChecks] = useState(getTodayChecks);
  const [minutesAgo, setMinutesAgo] = useState(getMinutesSinceLastCheck);

  // Update minutes ago every 60s
  useEffect(() => {
    const timer = setInterval(() => setMinutesAgo(getMinutesSinceLastCheck()), 60000);
    return () => clearInterval(timer);
  }, []);

  const activeCheck = justUpdated ? todayChecks[todayChecks.length - 1] : (resetNeeded ? null : latestCheck);
  const heroInfo = generateHeroStatus(activeCheck);
  const insight = useMemo(() => generateInsight(activeCheck, latest, nutrition, weather), [activeCheck, latest, nutrition, weather]);
  const actionText = generateAction(activeCheck);

  const anySelected = selections.energy > 0 || selections.skin > 0 || selections.mood > 0 || selections.gut > 0;

  const handleUpdate = () => {
    if (!anySelected) return;
    const saved = saveConditionCheck(selections);
    setTodayChecks(getTodayChecks());
    setJustUpdated(true);
    setMinutesAgo(0);
  };

  const handleSelect = (id, val) => {
    setSelections(prev => ({ ...prev, [id]: val }));
    setJustUpdated(false);
  };

  // Graph data
  const graphData = useMemo(() => {
    return todayChecks.map(c => {
      const d = new Date(c.timestamp);
      const h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const vals = [c.energy, c.skin, c.mood, c.gut].filter(v => v > 0);
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 3;
      let label;
      if (h < 10) label = '오전';
      else if (h < 13) label = '점심';
      else if (h < 17) label = '오후';
      else label = '저녁';
      return { time: `${h}:${m}`, label, avg };
    });
  }, [todayChecks]);

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 90 }}>

      {/* ===== 1. 히어로 영역 ===== */}
      <div style={{
        padding: '12px 14px 18px',
        position: 'relative',
      }}>
        {/* 상단 row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, position: 'relative' }}>
          <div onClick={() => setShowSettings(true)} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="1.8" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </div>
          <img src="/luaicon2.png" alt="lua" style={{ height: 30, objectFit: 'contain', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }} />
          <div onClick={onMeasure} style={{
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </div>

        {/* 상태 문장 */}
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0D3028', marginBottom: 3, lineHeight: 1.4 }}>
          {heroInfo.status}
        </div>
        <div style={{ fontSize: 10, color: '#2A6A58', marginBottom: 6 }}>
          {heroInfo.sub}
        </div>

        {/* 마지막 업데이트 */}
        <div style={{ fontSize: 9, color: 'rgba(13,48,40,0.45)' }}>
          {minutesAgo !== null
            ? minutesAgo < 1 ? '방금 업데이트됨' : `마지막 업데이트 ${minutesAgo}분 전`
            : '아직 체크 기록이 없어요'}
        </div>
      </div>

      {/* ===== 2. 실시간 컨디션 체크 카드 ===== */}
      <div style={{
        margin: '0 14px', marginTop: -8, position: 'relative', zIndex: 1,
        background: 'rgba(255,255,255,0.3)', borderRadius: 14, padding: '10px 12px',
        border: 'none',
        boxShadow: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>컨디션 체크</span>
          {anySelected && (
            <button onClick={handleUpdate} style={{
              background: 'linear-gradient(120deg, #B8F0E0, #4DB8A0)',
              color: '#0D3028', border: 'none', borderRadius: 9, padding: '7px 14px',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>체크 완료 →</button>
          )}
        </div>

        {/* 나쁨/좋음 라벨 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ width: 72 }} />
          <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ fontSize: 9, color: '#ccc' }}>나쁨</span>
            <span style={{ fontSize: 9, color: '#ccc' }}>좋음</span>
          </div>
        </div>

        {CONDITION_ITEMS.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{item.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', width: 42 }}>{item.label}</span>
            <div style={{ display: 'flex', gap: 8, flex: 1, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map(val => {
                const selected = selections[item.id] === val;
                return (
                  <div key={val} onClick={() => handleSelect(item.id, val)} style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: DOT_COLORS[val - 1],
                    cursor: 'pointer',
                    boxShadow: selected ? `0 0 0 2px #4DB8A0` : 'none',
                    transform: selected ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                    WebkitTapHighlightColor: 'transparent',
                  }} />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 14px' }}>

        {/* ===== 3. 실시간 AI 인사이트 카드 ===== */}
        <div style={{
          marginTop: 12,
          background: activeCheck ? 'rgba(78,184,160,0.08)' : 'rgba(0,0,0,0.02)',
          border: `1px solid ${activeCheck ? 'rgba(78,184,160,0.25)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 12, padding: '10px 12px',
          opacity: activeCheck ? 1 : 0.55,
        }}>
          {/* 상단 배지 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{
              fontSize: 9, fontWeight: 600, color: activeCheck ? '#4DB8A0' : '#aaa',
              background: activeCheck ? 'rgba(78,184,160,0.15)' : 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: 6,
            }}>실시간 분석</span>
            <span style={{ fontSize: 9, color: activeCheck ? '#4DB8A0' : '#ccc', fontWeight: 500 }}>
              {activeCheck ? '● LIVE' : '○ 대기중'}
            </span>
          </div>

          {/* 인과관계 흐름 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {(activeCheck ? insight.flow : ['컨디션 체크', '원인 분석', '맞춤 케어']).map((step, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: activeCheck ? '#0D3028' : '#bbb',
                  background: activeCheck
                    ? (i === 0 ? 'rgba(255,179,71,0.2)' : i === 2 ? 'rgba(78,184,160,0.2)' : 'rgba(255,243,176,0.4)')
                    : 'rgba(0,0,0,0.04)',
                  padding: '3px 8px', borderRadius: 8,
                }}>{step}</span>
                {i < 2 && <span style={{ fontSize: 10, color: '#ccc' }}>→</span>}
              </span>
            ))}
          </div>

          {/* 설명 */}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            {activeCheck ? insight.description : '위에서 컨디션을 체크하면 AI가 원인을 분석해드려요'}
          </div>
        </div>

        {/* ===== 4. 행동 추천 버튼 ===== */}
        <button style={{
          width: '100%', padding: 11, marginTop: 10,
          borderRadius: 12, border: 'none',
          background: activeCheck
            ? 'linear-gradient(120deg, #B8F0E0, #6ECFB8, #4DB8A0)'
            : 'linear-gradient(120deg, #eee, #e5e5e5)',
          color: activeCheck ? '#0D3028' : '#bbb',
          fontSize: 11, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
          textAlign: 'center',
          opacity: activeCheck ? 1 : 0.7,
        }}>{actionText}</button>

        {/* ===== 5. 오늘 컨디션 흐름 그래프 ===== */}
        <div style={{
            marginTop: 12, background: '#fff',
            border: '0.5px solid #eee', borderRadius: 12, padding: '9px 12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>오늘 컨디션 흐름</span>
              <span onClick={() => onTabChange('body')} style={{
                fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer',
              }}>자세히 →</span>
            </div>

            {graphData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: 9, color: '#bbb' }}>컨디션을 체크하면 흐름이 기록돼요</div>
              </div>
            ) : graphData.length === 1 ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: '50%',
                  background: graphData[0].avg >= 3.5 ? '#B8F0E0' : graphData[0].avg >= 2.5 ? '#FFF3B0' : '#FFE0E0',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0D3028' }}>{graphData[0].avg.toFixed(1)}</span>
                </div>
                <div style={{ fontSize: 9, color: '#999', marginTop: 4 }}>{graphData[0].time}</div>
                <div style={{ fontSize: 9, color: '#bbb', marginTop: 2 }}>체크가 더 쌓이면 흐름 그래프가 나타나요</div>
              </div>
            ) : (
              <>
                <svg width="100%" height="40" viewBox={`0 0 ${Math.max(graphData.length * 60, 200)} 40`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#B8F0E0" />
                      <stop offset="100%" stopColor="#4DB8A0" />
                    </linearGradient>
                  </defs>
                  <polyline
                    fill="none"
                    stroke="url(#line-grad)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={graphData.map((d, i) => {
                      const x = (i / (graphData.length - 1)) * (Math.max(graphData.length * 60, 200) - 20) + 10;
                      const y = 40 - (d.avg / 5) * 35;
                      return `${x},${y}`;
                    }).join(' ')}
                  />
                  {graphData.map((d, i) => {
                    const w = Math.max(graphData.length * 60, 200);
                    const x = (i / (graphData.length - 1)) * (w - 20) + 10;
                    const y = 40 - (d.avg / 5) * 35;
                    const color = d.avg >= 3.5 ? '#4DB8A0' : d.avg >= 2.5 ? '#FFF3B0' : '#FFE0E0';
                    return <circle key={i} cx={x} cy={y} r="3" fill={color} stroke="#fff" strokeWidth="1" />;
                  })}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  {graphData.map((d, i) => (
                    <span key={i} style={{ fontSize: 9, color: '#999' }}>{d.time}</span>
                  ))}
                </div>
              </>
            )}
          </div>

        {/* ===== 루틴 요약 ===== */}
        <div onClick={() => onTabChange('routine')} style={{
          borderRadius: 14, padding: '11px 13px', marginTop: 12,
          background: '#f9f9f9', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
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
                  ? '오늘 루틴 모두 완료!'
                  : getIncompleteText()
              }
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

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

// ===== Settings Drawer =====
function SettingsDrawer({ open, onClose, onAccount }) {
  const menuSections = [
    {
      title: '계정',
      items: [
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, label: '프로필 설정', action: onAccount },
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="22" x2="4" y2="2"/><path d="M4 3c3-1 6 1 9 0s6-2 8 0v10c-2-2-5 0-8 1s-6-1-9 0V3z"/></svg>, label: '목표 설정' },
      ],
    },
    {
      title: '앱 설정',
      items: [
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>, label: '카테고리' },
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>, label: '화면' },
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>, label: '데이터' },
      ],
    },
    {
      title: '정보',
      items: [
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, label: '공지사항' },
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, label: '앱 정보' },
        { icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, label: '문의하기' },
      ],
    },
  ];

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.5)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 0.3s ease',
      }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 2001,
        width: '80%', maxWidth: 320,
        background: 'var(--bg-primary, #fff)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', justifyContent: 'flex-end' }}>
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
        <div style={{ flex: 1, padding: '12px 0' }}>
          {menuSections.map((section) => (
            <div key={section.title}>
              <div style={{
                padding: '20px 28px 8px',
                fontSize: 11, fontWeight: 400, color: 'var(--text-dim)',
                letterSpacing: 0.5,
              }}>{section.title}</div>
              {section.items.map((item) => (
                <div key={item.label} onClick={() => item.action ? item.action() : null} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 28px', cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  color: 'var(--text-primary)',
                }}>
                  {item.icon}
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 28px 40px', borderTop: '1px solid var(--border-light, #eee)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>버전 1.0.0</div>
          <div onClick={() => {}} style={{ fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>로그아웃</div>
        </div>
      </div>
    </>
  );
}

// ===== Account Page =====
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

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>닉네임</div>
          <input value={profile.nickname || ''} onChange={e => onUpdate('nickname', e.target.value)}
            placeholder="닉네임" maxLength={20} style={inputStyle} />
        </div>

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

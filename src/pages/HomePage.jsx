import { useState, useEffect, useMemo } from 'react';
import SkinWeather from '../components/SkinWeather';
import { getLatestRecord } from '../storage/SkinStorage';
import { getProfile, saveProfile, SKIN_TYPES, SKIN_CONCERNS, GENDER_OPTIONS } from '../storage/ProfileStorage';
import { getTodayNutrition, getTodayFoods, getFoodGoal } from '../storage/FoodStorage';
import { getWeatherData } from '../storage/WeatherStorage';
import { getTodayProgress } from '../storage/RoutineCheckStorage';
import { getLatestWeight, getBodyRecords } from '../storage/BodyStorage';
import {
  getTodayChecks, getLatestCheck, saveConditionCheck,
  shouldResetCheck, getMinutesSinceLastCheck,
} from '../storage/ConditionStorage';

const ENERGY_LABELS = ['매우 낮음', '낮음', '보통', '좋음', '활기참'];
const MOOD_LABELS = ['우울', '기분 다운', '평온', '좋음', '행복'];
const WATER_LABELS = ['갈증', '약간 부족', '보통', '충분', '매우 충분'];

const STATUS_MAP = {
  1: { text: '저하', bg: 'rgba(255,143,171,.1)', color: '#C2185B' },
  2: { text: '약간 저하', bg: 'rgba(255,179,71,.1)', color: '#C4580A' },
  3: { text: '보통', bg: 'rgba(255,243,176,.4)', color: '#8A6A00' },
  4: { text: '안정', bg: 'rgba(78,184,160,.1)', color: '#0F6E56' },
  5: { text: '매우 안정', bg: 'rgba(78,184,160,.1)', color: '#0F6E56' },
};

const HERO_GRAD = {
  high: 'linear-gradient(160deg, #B8F0E0, #6ECFB8, #4DB8A0)',
  mid: 'linear-gradient(160deg, #FFF9E0, #FFE8C0, #FFD1A1)',
  low: 'linear-gradient(160deg, #FFE8D0, #FFD1A1, #FF8FAB)',
};

function getTier(energy, mood) {
  const avg = (energy + mood) / 2;
  if (avg >= 4) return 'high';
  if (avg >= 2.5) return 'mid';
  return 'low';
}

const TIER_STATUS = {
  high: '에너지 안정 상태, 집중 유지 가능',
  mid: '보통 상태, 가벼운 식사 추천',
  low: '에너지 저하, 식단 영향 가능성',
};

const TIER_INSIGHT = {
  high: { flow: ['균형 식단', '에너지 충전', '집중력 유지'], desc: '지금 상태가 좋아요. 규칙적인 식사 타이밍이 이 흐름을 유지하는 핵심이에요.' },
  mid: { flow: ['탄수화물 식사', '2시간 후', '졸림 가능성'], desc: '점심 이후 혈당 변화로 에너지가 출렁일 수 있어요. 단백질 간식이 도움이 돼요.' },
  low: { flow: ['불규칙 식사', '혈당 저하', '에너지·기분 영향'], desc: '식사 패턴이 에너지와 기분에 영향을 주고 있을 수 있어요. 지금 가볍게 드세요.' },
};

const TIER_CTA = {
  high: '지금 식단 기록하기',
  mid: '가벼운 단백질 간식 추천',
  low: '지금 바로 식단 기록하기',
};

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
  const [showWeather, setShowWeather] = useState(false);
  const [userProfile, setUserProfile] = useState(getProfile);

  // Condition check state
  const latestCheck = getLatestCheck();
  const resetNeeded = shouldResetCheck();
  const [selections, setSelections] = useState(() => {
    if (!resetNeeded && latestCheck) {
      return { energy: latestCheck.energy || 3, mood: latestCheck.mood || 3, water: latestCheck.water || 3 };
    }
    return { energy: 3, mood: 3, water: 3 };
  });
  const [justUpdated, setJustUpdated] = useState(false);
  const [todayChecks, setTodayChecks] = useState(getTodayChecks);
  const [minutesAgo, setMinutesAgo] = useState(getMinutesSinceLastCheck);
  const [bodyBriefing, setBodyBriefing] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lua_body_briefing') || '{}');
      if (saved.date === new Date().toISOString().slice(0, 10)) return saved.text || '';
    } catch {}
    return '';
  });
  const [briefingTime, setBriefingTime] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('lua_body_briefing') || '{}');
      if (saved.date === new Date().toISOString().slice(0, 10)) return saved.time || '';
    } catch {}
    return '';
  });
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Update minutes ago every 60s
  useEffect(() => {
    const timer = setInterval(() => setMinutesAgo(getMinutesSinceLastCheck()), 60000);
    return () => clearInterval(timer);
  }, []);

  const activeCheck = justUpdated ? todayChecks[todayChecks.length - 1] : (resetNeeded ? null : latestCheck);
  const tier = activeCheck ? getTier(activeCheck.energy || 3, activeCheck.mood || 3) : getTier(selections.energy, selections.mood);
  const liveTier = getTier(selections.energy, selections.mood);

  const handleUpdate = () => {
    const saved = saveConditionCheck({ ...selections, skin: 3, gut: 3 });
    setTodayChecks(getTodayChecks());
    setJustUpdated(true);
    setMinutesAgo(0);

    // Body briefing API 호출
    setBriefingLoading(true);
    const sliderTo100 = v => Math.round(((v - 1) / 4) * 100); // 1~5 → 0~100
    const foods = getTodayFoods();
    const dietSummary = foods.length > 0
      ? foods.map(f => f.name).filter(Boolean).join(', ')
      : '';
    const latestW = getLatestWeight();
    const bodyRecords = getBodyRecords();
    const prevWeight = bodyRecords.length >= 2 ? bodyRecords[bodyRecords.length - 2].weight : null;

    fetch('/api/condition-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'body',
        energy: sliderTo100(selections.energy),
        mood: sliderTo100(selections.mood),
        hydration: sliderTo100(selections.water),
        dietSummary,
        supplements: [],
        weight: latestW?.weight ?? null,
        previousWeight: prevWeight,
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.briefing) {
          const now = new Date();
          const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
          setBodyBriefing(data.briefing);
          setBriefingTime(time);
          localStorage.setItem('lua_body_briefing', JSON.stringify({ date: now.toISOString().slice(0, 10), text: data.briefing, time }));
        }
      })
      .catch(() => {})
      .finally(() => setBriefingLoading(false));
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
        padding: '14px 28px 22px',
        position: 'relative',
      }}>
        {/* 상단 row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, position: 'relative' }}>
          <div onClick={() => setShowWeather(true)} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
          </div>
          <img src="/luaicon2.png" alt="lua" style={{ height: 30, objectFit: 'contain', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }} />
          <div onClick={onMeasure} style={{
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.8)" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </div>

        {/* 상태 문장 */}
        <div style={{ fontSize: 15, fontWeight: 500, color: '#0D3028', marginBottom: 4 }}>
          {activeCheck ? TIER_STATUS[tier] : `안녕하세요, ${profile.nickname || '사용자'}`}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(13,48,40,0.45)' }}>
          {minutesAgo !== null
            ? minutesAgo < 1 ? '방금 업데이트' : `${minutesAgo}분 전 업데이트`
            : ''}
        </div>
      </div>

      {/* ===== 2. 컨디션 체크 카드 ===== */}
      <style>{`
        .lua-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 18px; height: 18px; border-radius: 50%;
          background: #fff; border: 1.5px solid rgba(0,0,0,0.12);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          cursor: pointer;
        }
        .lua-slider::-moz-range-thumb {
          width: 18px; height: 18px; border-radius: 50%;
          background: #fff; border: 1.5px solid rgba(0,0,0,0.12);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          cursor: pointer;
        }
      `}</style>
      <div style={{
        margin: '0 18px', marginTop: -10, position: 'relative', zIndex: 1,
        background: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '12px 13px',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.3)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(0,0,0,0.8)', marginBottom: 12 }}>지금 느낌은?</div>

        {/* 에너지 슬라이더 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>에너지</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F6E56' }}>{ENERGY_LABELS[selections.energy - 1]}</span>
          </div>
          <input type="range" min={1} max={5} step={1} value={selections.energy}
            onChange={e => handleSelect('energy', Number(e.target.value))}
            className="lua-slider"
            style={{
              width: '100%', height: 6, borderRadius: 3, appearance: 'none', outline: 'none',
              background: 'linear-gradient(90deg, rgba(255,255,0,0.5), rgba(255,255,255,0.5))',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            <span style={{ fontSize: 11, color: '#ccc' }}>매우 낮음</span>
            <span style={{ fontSize: 11, color: '#ccc' }}>보통</span>
            <span style={{ fontSize: 11, color: '#ccc' }}>활기참</span>
          </div>
        </div>

        {/* 기분 슬라이더 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>기분</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F6E56' }}>{MOOD_LABELS[selections.mood - 1]}</span>
          </div>
          <input type="range" min={1} max={5} step={1} value={selections.mood}
            onChange={e => handleSelect('mood', Number(e.target.value))}
            className="lua-slider"
            style={{
              width: '100%', height: 6, borderRadius: 3, appearance: 'none', outline: 'none',
              background: 'linear-gradient(90deg, rgba(255,255,0,0.5), rgba(255,255,255,0.5))',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            <span style={{ fontSize: 11, color: '#ccc' }}>우울</span>
            <span style={{ fontSize: 11, color: '#ccc' }}>평온</span>
            <span style={{ fontSize: 11, color: '#ccc' }}>행복</span>
          </div>
        </div>

        {/* 수분 슬라이더 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>수분</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F6E56' }}>{WATER_LABELS[selections.water - 1]}</span>
          </div>
          <input type="range" min={1} max={5} step={1} value={selections.water}
            onChange={e => handleSelect('water', Number(e.target.value))}
            className="lua-slider"
            style={{
              width: '100%', height: 6, borderRadius: 3, appearance: 'none', outline: 'none',
              background: 'linear-gradient(90deg, rgba(255,255,0,0.5), rgba(255,255,255,0.5))',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
            <span style={{ fontSize: 11, color: '#ccc' }}>갈증</span>
            <span style={{ fontSize: 11, color: '#ccc' }}>보통</span>
            <span style={{ fontSize: 11, color: '#ccc' }}>충분</span>
          </div>
        </div>

        {/* 업데이트 버튼 */}
        <button onClick={handleUpdate} style={{
          width: '100%', padding: '10px 0',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.7))',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          color: '#0D3028', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>업데이트 →</button>
      </div>

      <div style={{ padding: '0 18px' }}>

        {/* ===== 4. 인사이트 카드 ===== */}
        <div style={{
          marginTop: 12,
          background: 'rgba(255,255,255,0.35)',
          borderRadius: 16, padding: '14px 16px',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.35)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'rgba(0,0,0,0.8)' }}>인사이트</span>
            <span style={{ fontSize: 11, color: '#4DB8A0', fontWeight: 500 }}>
              {briefingLoading ? '● AI 분석 중...' : bodyBriefing && briefingTime ? `${briefingTime} 기준` : '● 분석 중'}
            </span>
          </div>
          {bodyBriefing ? (
            <div style={{ fontSize: 13, color: '#0D3028', lineHeight: 1.6 }}>
              {bodyBriefing}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                {(TIER_INSIGHT[activeCheck ? tier : liveTier].flow).map((step, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: '#0D3028',
                      background: i === 0 ? 'rgba(255,179,71,0.2)' : i === 2 ? 'rgba(78,184,160,0.2)' : 'rgba(255,243,176,0.4)',
                      padding: '3px 8px', borderRadius: 8,
                    }}>{step}</span>
                    {i < 2 && <span style={{ fontSize: 12, color: '#ccc' }}>→</span>}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {TIER_INSIGHT[activeCheck ? tier : liveTier].desc}
              </div>
            </>
          )}
        </div>

        {/* ===== 6. 에너지·기분 흐름 그래프 ===== */}
        <div style={{
          marginTop: 12, background: 'rgba(255,255,255,0.5)',
          borderRadius: 16, padding: '14px 16px',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.4)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'rgba(0,0,0,0.8)' }}>오늘 흐름</span>
            <span onClick={() => onTabChange('body')} style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>분석 탭 →</span>
          </div>
          {/* 범례 */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 2, borderRadius: 1, background: '#4DB8A0' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>에너지</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 2, borderRadius: 1, background: '#FFB347', backgroundImage: 'repeating-linear-gradient(90deg, #FFB347 0 3px, transparent 3px 5px)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>기분</span>
            </div>
          </div>

          {graphData.length < 2 ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 20, marginBottom: 6, opacity: 0.4 }}>📈</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {graphData.length === 0 ? '업데이트하면 흐름이 기록돼요' : '한 번 더 체크하면 그래프가 나타나요'}
              </div>
            </div>
          ) : (() => {
            const svgW = Math.max(graphData.length * 70, 220);
            const H = 56;
            const toY = (val) => Math.round(H - (val / 5) * (H - 12) - 6);
            const pad = 16;

            const energyPts = graphData.map((d, i) => {
              const x = (i / (graphData.length - 1)) * (svgW - pad * 2) + pad;
              return { x, y: toY(todayChecks[i]?.energy || 3) };
            });
            const moodPts = graphData.map((d, i) => {
              const x = (i / (graphData.length - 1)) * (svgW - pad * 2) + pad;
              return { x, y: toY(todayChecks[i]?.mood || 3) };
            });

            const makePath = (pts) => {
              let d = `M${pts[0].x} ${pts[0].y}`;
              for (let i = 1; i < pts.length; i++) {
                const cp = (pts[i].x + pts[i - 1].x) / 2;
                d += ` C${cp} ${pts[i - 1].y} ${cp} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
              }
              return d;
            };

            const makeAreaPath = (pts) => {
              let d = makePath(pts);
              d += ` L${pts[pts.length - 1].x} ${H} L${pts[0].x} ${H} Z`;
              return d;
            };

            return (
              <>
                <svg width="100%" height={H} viewBox={`0 0 ${svgW} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
                  <defs>
                    <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4DB8A0" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#4DB8A0" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* 에너지 영역 채움 */}
                  <path d={makeAreaPath(energyPts)} fill="url(#energyFill)" />
                  {/* 에너지 선 (민트 실선) */}
                  <path d={makePath(energyPts)} fill="none" stroke="#4DB8A0" strokeWidth="2" strokeLinecap="round" />
                  {/* 기분 선 (오렌지 점선) */}
                  <path d={makePath(moodPts)} fill="none" stroke="#FFB347" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
                  {/* 포인트 */}
                  {energyPts.map((p, i) => (
                    <circle key={`e${i}`} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#4DB8A0" strokeWidth="1.5" />
                  ))}
                  {moodPts.map((p, i) => (
                    <circle key={`m${i}`} cx={p.x} cy={p.y} r="3" fill="#fff" stroke="#FFB347" strokeWidth="1.5" />
                  ))}
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: 4 }}>
                  {graphData.map((d, i) => (
                    <span key={i} style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.time}</span>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Skin Weather Page */}
      {showWeather && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'linear-gradient(to bottom, #ace2fc, #dfed89)',
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setShowWeather(false)} style={{
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>날씨</span>
          </div>
          <SkinWeather />
        </div>
      )}

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

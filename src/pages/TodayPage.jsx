import { useState, useMemo } from 'react';
import { getProfile } from '../storage/ProfileStorage';
import { getTodayNutrition, getTodayFoods } from '../storage/FoodStorage';
import { getLatestWeight } from '../storage/BodyStorage';
import { getWeatherData } from '../storage/WeatherStorage';
import { getTodayProgress } from '../storage/RoutineCheckStorage';
import { getSupplementItems, getSupplementChecks } from '../storage/SupplementStorage';
import { getLatestCheck, getTodayChecks } from '../storage/ConditionStorage';

function getGreeting(nickname) {
  const h = new Date().getHours();
  const name = nickname ? `${nickname}님` : '';
  if (h >= 5 && h < 12) return { main: `좋은 아침이에요${name ? ', ' + name : ''}`, sub: '오늘 하루도 함께할게요' };
  if (h >= 12 && h < 18) return { main: `오후도 잘 보내고 있나요${name ? ', ' + name : ''}`, sub: '지금까지의 기록이에요' };
  if (h >= 18 && h < 22) return { main: `오늘 하루 수고했어요${name ? ', ' + name : ''}`, sub: '오늘의 기록을 정리해봤어요' };
  return { main: `늦은 밤이에요${name ? ', ' + name : ''}`, sub: '오늘 하루를 돌아볼까요' };
}

export default function TodayPage() {
  const profile = getProfile();
  const greeting = getGreeting(profile.nickname);
  const todayKey = new Date().toISOString().slice(0, 10);

  const data = useMemo(() => {
    const nutrition = getTodayNutrition();
    const foods = getTodayFoods().filter(f => !f.name?.startsWith('물 '));
    const allV2 = (() => { try { return JSON.parse(localStorage.getItem('lua_record_v2') || '{}'); } catch { return {}; } })();
    const todayRec = allV2[todayKey] || {};

    // Condition
    const allChecks = (() => { try { return JSON.parse(localStorage.getItem('nou_condition_checks') || '[]'); } catch { return []; } })();
    const dayChecks = allChecks.filter(c => (c.date || c.timestamp?.slice(0, 10)) === todayKey);
    const lastCheck = dayChecks.length > 0 ? dayChecks[dayChecks.length - 1] : null;
    const condAvg = lastCheck ? ((lastCheck.energy || 5) + (lastCheck.mood || 5)) / 2 : null;

    // Sleep
    const sleep = todayRec.sleep?.hours || null;

    // Water
    const waterCups = todayRec.water?.cups || 0;
    const waterSettings = (() => { try { return { cupMl: 250, goalMl: 2000, ...JSON.parse(localStorage.getItem('lua_water_settings') || '{}') }; } catch { return { cupMl: 250, goalMl: 2000 }; } })();

    // Steps
    const steps = todayRec.steps || 0;

    // Weight
    const weight = getLatestWeight();

    // Supplements
    const suppItems = getSupplementItems();
    const suppChecks = getSupplementChecks(todayKey);
    const suppDone = suppItems.filter(s => suppChecks[s.id]).length;

    // Routine
    const skinR = getTodayProgress('skin');
    const foodR = getTodayProgress('food');
    const bodyR = getTodayProgress('body');

    // Weather
    const weather = getWeatherData();

    return {
      eaten: Math.round(nutrition.kcal || 0),
      mealCount: foods.length,
      protein: Math.round(nutrition.protein || 0),
      carb: Math.round(nutrition.carb || 0),
      fat: Math.round(nutrition.fat || 0),
      condAvg,
      energy: lastCheck?.energy || null,
      mood: lastCheck?.mood || null,
      sleep,
      sleepQuality: todayRec.sleep?.quality || null,
      waterCups,
      waterGoalCups: Math.ceil(waterSettings.goalMl / waterSettings.cupMl),
      waterMl: waterCups * waterSettings.cupMl,
      steps,
      weight: weight?.weight || null,
      suppDone,
      suppTotal: suppItems.length,
      routineDone: skinR.done + foodR.done + bodyR.done,
      routineTotal: skinR.total + foodR.total + bodyR.total,
      weather,
    };
  }, [todayKey]);

  const sections = [];

  // Condition
  if (data.condAvg !== null) {
    sections.push({
      icon: '✦', color: '#F0D060', label: '컨디션',
      value: data.condAvg.toFixed(1), unit: '/10',
      sub: `에너지 ${data.energy} · 기분 ${data.mood}`,
      state: data.condAvg >= 7 ? 'good' : data.condAvg >= 4 ? 'normal' : 'low',
    });
  }

  // Sleep
  if (data.sleep) {
    sections.push({
      icon: '☽', color: '#5B6AAF', label: '수면',
      value: data.sleep % 1 === 0 ? data.sleep : data.sleep.toFixed(1), unit: '시간',
      sub: data.sleepQuality || (data.sleep >= 7 ? '충분한 수면' : data.sleep >= 5 ? '보통' : '부족'),
      state: data.sleep >= 7 ? 'good' : data.sleep >= 5 ? 'normal' : 'low',
    });
  }

  // Food
  if (data.eaten > 0) {
    sections.push({
      icon: '⬡', color: '#7BC67B', label: '식사',
      value: data.eaten.toLocaleString(), unit: 'kcal',
      sub: `${data.mealCount}끼 · 탄${data.carb}g 단${data.protein}g 지${data.fat}g`,
      state: 'normal',
    });
  }

  // Water
  if (data.waterCups > 0) {
    sections.push({
      icon: '◆', color: '#5BA3D4', label: '수분',
      value: data.waterMl.toLocaleString(), unit: 'ml',
      sub: data.waterCups >= data.waterGoalCups ? '목표 달성!' : `${data.waterGoalCups - data.waterCups}잔 남음`,
      state: data.waterCups >= data.waterGoalCups ? 'good' : 'normal',
    });
  }

  // Activity
  if (data.steps > 0) {
    sections.push({
      icon: '↗', color: '#E87835', label: '활동',
      value: data.steps.toLocaleString(), unit: '걸음',
      sub: null,
      state: 'normal',
    });
  }

  // Weight
  if (data.weight) {
    sections.push({
      icon: '◎', color: '#999', label: '체중',
      value: data.weight, unit: 'kg',
      sub: null,
      state: 'normal',
    });
  }

  // Supplements
  if (data.suppTotal > 0) {
    sections.push({
      icon: '◇', color: '#C8B040', label: '영양제',
      value: `${data.suppDone}/${data.suppTotal}`, unit: '',
      sub: data.suppDone === data.suppTotal ? '완료!' : `${data.suppTotal - data.suppDone}개 남음`,
      state: data.suppDone === data.suppTotal ? 'good' : 'normal',
    });
  }

  const recorded = sections.length;
  const h = new Date().getHours();

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ padding: '28px 24px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(0,0,0,0.3)', marginBottom: 4 }}>
          {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0D3028', lineHeight: 1.35, letterSpacing: -0.3 }}>
          {greeting.main}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.4)', marginTop: 4 }}>
          {greeting.sub}
        </div>
      </div>

      {/* Summary */}
      <div style={{ padding: '20px 24px 0' }}>
        {sections.length === 0 ? (
          <div style={{
            background: 'rgba(255,255,255,0.3)', borderRadius: 24,
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.4)',
            padding: '40px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>☀️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(0,0,0,0.6)', marginBottom: 4 }}>아직 기록이 없어요</div>
            <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.35)' }}>홈에서 오늘의 컨디션을 체크해보세요</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sections.map((s, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.3)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: 22, padding: '16px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: `${s.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: s.color,
                  }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(0,0,0,0.35)' }}>{s.label}</div>
                    {s.sub && <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)', marginTop: 1 }}>{s.sub}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#0D3028', fontFamily: 'var(--font-display)' }}>{s.value}</span>
                  {s.unit && <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)' }}>{s.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weather */}
      {data.weather && (
        <div style={{ padding: '12px 24px 0' }}>
          <div style={{
            background: 'rgba(255,255,255,0.2)', borderRadius: 22,
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{data.weather.conditionIcon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(0,0,0,0.35)' }}>날씨</div>
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)' }}>
                  습도 {data.weather.humidity}%{data.weather.uv >= 6 ? ` · UV ${data.weather.uv}` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#0D3028', fontFamily: 'var(--font-display)' }}>{data.weather.tempMax}°</span>
              <span style={{ fontSize: 16, fontWeight: 500, color: 'rgba(0,0,0,0.25)', fontFamily: 'var(--font-display)' }}>{data.weather.tempMin}°</span>
            </div>
          </div>
        </div>
      )}

      {/* Routine progress */}
      {data.routineTotal > 0 && (
        <div style={{ padding: '12px 24px 0' }}>
          <div style={{
            background: 'rgba(255,255,255,0.2)', borderRadius: 22,
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(0,0,0,0.35)' }}>루틴</div>
              <div style={{ fontSize: 11, color: data.routineDone === data.routineTotal ? '#22C55E' : 'rgba(0,0,0,0.3)', marginTop: 1 }}>
                {data.routineDone === data.routineTotal ? '오늘 루틴 완료!' : `${data.routineTotal - data.routineDone}개 남음`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#0D3028', fontFamily: 'var(--font-display)' }}>{data.routineDone}</span>
              <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)' }}>/{data.routineTotal}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

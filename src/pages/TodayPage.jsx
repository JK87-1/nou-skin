import { useState, useMemo, useEffect } from 'react';
import { IconChevronLeft, IconChevronRight, IconSparkles, IconTrendingUp, IconClock, IconMoon, IconDroplet, IconCoffee, IconApple, IconFlame, IconMoodSmile, IconPlus, IconChartBar, IconChevronDown } from '@tabler/icons-react';
import { getProfile } from '../storage/ProfileStorage';
import { getTodayFoods, getFoodRecords } from '../storage/FoodStorage';
import { getPhotoDB } from '../storage/PhotoDB';
import { groupTimelineItems, getGroupSummary, getGroupCountLabel, getItemBrief } from '../utils/timelineGrouping';
import { generateWaterAnalysis } from '../utils/waterRecommendation';
import { hapticLight } from '../utils/haptic';

function FoodPhoto({ photo, style }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    if (!photo) return;
    if (photo.startsWith('data:')) { setSrc(photo); return; }
    getPhotoDB(photo).then(url => { if (url) setSrc(url); });
  }, [photo]);
  if (!src) return null;
  return <img src={src} alt="" style={style} />;
}

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
const CAT_ICONS = {
  sleep: { Icon: IconMoon, color: '#534AB7' },
  water: { Icon: IconDroplet, color: '#378ADD' },
  caffeine: { Icon: IconCoffee, color: '#BA7517' },
  meal: { Icon: IconApple, color: '#639922' },
  activity: { Icon: IconFlame, color: '#D85A30' },
  condition: { Icon: IconMoodSmile, color: '#534AB7' },
};

function getDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayData(dateStr) {
  try {
    const recs = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
    const rec = recs[dateStr] || {};
    const drinks = JSON.parse(localStorage.getItem('lua_drink_records') || '{}');
    const checks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
    const foods = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
    const dayFoods = (foods[dateStr] || []).filter(f => !f.name?.startsWith('물 '));

    const cafItems = drinks[dateStr]?.caffeine || [];
    const cafMg = cafItems.reduce((s, d) => {
      const mgMap = { espresso: 150, americano: 150, latte: 150, drip: 130, coldbrew: 200, matcha: 70, green_tea: 30, black_tea: 50, energy_drink: 160 };
      return s + (mgMap[d.key] || 100) * (d.count || 0);
    }, 0);

    const dayChecks = checks.filter(c => (c.date || (c.timestamp && c.timestamp.slice(0, 10))) === dateStr);
    const lastCheck = dayChecks.length > 0 ? dayChecks[dayChecks.length - 1] : null;
    const condAvg = lastCheck ? ((lastCheck.energy || lastCheck.에너지 || 0) + (lastCheck.mood || lastCheck.기분 || 0) + (lastCheck.skin || lastCheck.피부 || 0) + (lastCheck.gut || lastCheck.소화 || 0)) / 4 : null;

    const waterCups = rec.water?.cups || 0;
    const waterMl = waterCups * 250;
    const sleep = rec.sleep?.hours || 0;
    const steps = rec.steps || 0;
    const totalKcal = dayFoods.reduce((s, f) => s + (f.kcal || 0), 0);

    return { sleep, waterMl, waterCups, cafMg, cafItems, steps, condAvg, totalKcal, dayFoods, lastCheck, rec, drinks: drinks[dateStr] || {} };
  } catch { return { sleep: 0, waterMl: 0, waterCups: 0, cafMg: 0, cafItems: [], steps: 0, condAvg: null, totalKcal: 0, dayFoods: [], lastCheck: null, rec: {}, drinks: {} }; }
}

// 타임라인 아이템 빌드
function buildTimeline(dateStr, data) {
  const items = [];

  // 수면 (기상만 표시)
  if (data.sleep > 0) {
    const rawWake = data.rec.sleep?.wakeTime;
    const wt = rawWake ? (rawWake.length <= 5 ? rawWake : rawWake.slice(11, 16)) : null;
    const sortWt = rawWake ? (rawWake.includes('T') ? rawWake : `${dateStr}T${rawWake}:00`) : `${dateStr}T07:00`;
    items.push({ id: 's1', time: wt || '07:00', category: 'sleep', content: `기상 · 수면 ${data.sleep}h`, sortTime: sortWt });
  }

  // 수분
  if (data.waterCups > 0) {
    const intakes = data.rec.water?.intakes;
    if (intakes && intakes.length > 0) {
      intakes.forEach((intake, i) => {
        const wt = intake.loggedAt ? intake.loggedAt.slice(11, 16) : '09:00';
        const c = intake.cups || 1;
        items.push({ id: `w${i}`, time: wt, category: 'water', content: `물 ${c * 250}ml (${c}잔)`, sortTime: `${dateStr}T${wt}`, intakeIndex: i });
      });
    } else {
      const wt = data.rec.water?.loggedAt ? data.rec.water.loggedAt.slice(11, 16) : '09:00';
      items.push({ id: 'w1', time: wt, category: 'water', content: `물 ${data.waterMl}ml (${data.waterCups}잔)`, sortTime: `${dateStr}T${wt}` });
    }
  }

  // 카페인
  data.cafItems.forEach((d, i) => {
    const t = d.drunkAt ? d.drunkAt.slice(11, 16) : `${String(9 + i).padStart(2, '0')}:30`;
    items.push({ id: `c${i}`, time: t, category: 'caffeine', content: `${d.name || d.key} · 카페인 ${(({ espresso: 150, americano: 150, latte: 150, drip: 130, coldbrew: 200, matcha: 70, green_tea: 30, black_tea: 50, energy_drink: 160 })[d.key] || 100) * (d.count || 1)}mg`, sortTime: `${dateStr}T${t}` });
  });

  // 식사
  data.dayFoods.forEach((f, i) => {
    const defaultTime = f.meal === '아침' ? '08:00' : f.meal === '점심' ? '12:30' : f.meal === '저녁' ? '19:00' : `${12 + i}:00`;
    const mealTime = f.loggedAt ? f.loggedAt.slice(11, 16) : defaultTime;
    items.push({ id: `m${i}`, time: mealTime, category: 'meal', content: `${f.meal || '식사'} · ${f.name || ''} ${f.kcal ? f.kcal + 'kcal' : ''}`.trim(), sortTime: `${dateStr}T${mealTime}`, photo: f.photo || null });
  });

  // 활동
  if (data.steps > 0) {
    const at = data.rec.stepsLoggedAt ? data.rec.stepsLoggedAt.slice(11, 16) : '18:00';
    items.push({ id: 'a1', time: at, category: 'activity', content: `${data.steps.toLocaleString()}보 걸음`, sortTime: `${dateStr}T${at}` });
  }

  // 컨디션
  if (data.lastCheck) {
    const ct = data.lastCheck.timestamp ? data.lastCheck.timestamp.slice(11, 16) : '20:00';
    items.push({ id: 'cond1', time: ct, category: 'condition', content: `컨디션 ${data.condAvg?.toFixed(1)}점`, sortTime: `${dateStr}T${ct}` });
  }

  items.sort((a, b) => a.sortTime.localeCompare(b.sortTime));
  return items;
}

// 7일 추세 데이터
function getWeeklyTrend(metric, todayStr) {
  const values = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = getDateKey(d);
    const data = getDayData(key);
    const dayLabel = i === 0 ? '오늘' : DAY_NAMES[d.getDay()].slice(0, 1);
    let value = 0;
    if (metric === 'water') value = data.waterMl;
    else if (metric === 'condition') value = data.condAvg || 0;
    else if (metric === 'sleep') value = data.sleep;
    values.push({ dayLabel, value, isToday: i === 0 });
  }
  const nonZero = values.filter(v => v.value > 0);
  const avg = nonZero.length > 0 ? nonZero.reduce((s, v) => s + v.value, 0) / nonZero.length : 0;
  const todayVal = values[values.length - 1].value;
  return { values, avg, todayVal };
}

function getRelativeDate(dateStr) {
  const today = getDateKey(new Date());
  if (dateStr === today) return '오늘';
  const diff = Math.ceil((new Date(today) - new Date(dateStr)) / 86400000);
  if (diff === 1) return '어제';
  return `${diff}일 전`;
}

// 타임라인 시간 수정 → localStorage 반영
function saveTimelineTime(dateStr, item, newTime) {
  try {
    if (item.category === 'sleep') {
      const all = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
      const rec = all[dateStr] || {};
      if (rec.sleep) {
        if (item.id === 's0') {
          rec.sleep.bedtime = `${dateStr}T${newTime}:00`;
        } else {
          rec.sleep.wakeTime = `${dateStr}T${newTime}:00`;
        }
        all[dateStr] = rec;
        localStorage.setItem('lua_record_v2', JSON.stringify(all));
      }
    } else if (item.category === 'caffeine') {
      const all = JSON.parse(localStorage.getItem('lua_drink_records') || '{}');
      const dayRec = all[dateStr] || {};
      const idx = parseInt(item.id.replace('c', ''));
      if (dayRec.caffeine?.[idx]) {
        dayRec.caffeine[idx].drunkAt = `${dateStr}T${newTime}:00`;
        all[dateStr] = dayRec;
        localStorage.setItem('lua_drink_records', JSON.stringify(all));
      }
    } else if (item.category === 'meal') {
      const all = JSON.parse(localStorage.getItem('lua_food_records') || '{}');
      const dayFoods = (all[dateStr] || []).filter(f => !f.name?.startsWith('물 '));
      const idx = parseInt(item.id.replace('m', ''));
      if (dayFoods[idx]) {
        dayFoods[idx].loggedAt = `${dateStr}T${newTime}:00`;
        all[dateStr] = all[dateStr].map(f => f.name?.startsWith('물 ') ? f : null).filter(Boolean);
        dayFoods.forEach(f => all[dateStr].push(f));
        localStorage.setItem('lua_food_records', JSON.stringify(all));
      }
    } else if (item.category === 'condition') {
      const checks = JSON.parse(localStorage.getItem('nou_condition_checks') || '[]');
      const dayChecks = checks.filter(c => (c.date || (c.timestamp && c.timestamp.slice(0, 10))) === dateStr);
      if (dayChecks.length > 0) {
        const last = dayChecks[dayChecks.length - 1];
        last.timestamp = `${dateStr}T${newTime}:00`;
        localStorage.setItem('nou_condition_checks', JSON.stringify(checks));
      }
    } else if (item.category === 'activity') {
      const all = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
      const rec = all[dateStr] || {};
      rec.stepsLoggedAt = `${dateStr}T${newTime}:00`;
      all[dateStr] = rec;
      localStorage.setItem('lua_record_v2', JSON.stringify(all));
    } else if (item.category === 'water') {
      const all = JSON.parse(localStorage.getItem('lua_record_v2') || '{}');
      const rec = all[dateStr] || {};
      if (!rec.water) rec.water = {};
      if (rec.water.intakes && item.intakeIndex != null) {
        rec.water.intakes[item.intakeIndex].loggedAt = `${dateStr}T${newTime}:00`;
      } else {
        rec.water.loggedAt = `${dateStr}T${newTime}:00`;
      }
      all[dateStr] = rec;
      localStorage.setItem('lua_record_v2', JSON.stringify(all));
    }
  } catch (e) { console.warn('[Timeline] save time failed:', e); }
}

export default function TodayPage() {
  const [selectedDate, setSelectedDate] = useState(() => getDateKey(new Date()));
  const [trendMetric, setTrendMetric] = useState('water');
  const [editingId, setEditingId] = useState(null);
  const [editTime, setEditTime] = useState('');
  const [ver, setVer] = useState(0); // force re-render after time edit
  const [expandedGroup, setExpandedGroup] = useState(null);
  const todayStr = getDateKey(new Date());
  const isToday = selectedDate === todayStr;

  const dt = new Date(selectedDate + 'T00:00:00');
  const dateLabel = `${dt.getMonth() + 1}월 ${dt.getDate()}일 ${DAY_NAMES[dt.getDay()]}`;
  const relativeLabel = getRelativeDate(selectedDate);

  const data = useMemo(() => getDayData(selectedDate), [selectedDate, ver]);
  const timeline = useMemo(() => buildTimeline(selectedDate, data), [selectedDate, data]);
  const groupedTimeline = useMemo(() => groupTimelineItems(timeline), [timeline]);
  const trend = useMemo(() => getWeeklyTrend(trendMetric, todayStr), [trendMetric, todayStr]);

  const goPrev = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(getDateKey(d));
  };

  // 현재 시각
  const nowHH = String(new Date().getHours()).padStart(2, '0');
  const nowMM = String(new Date().getMinutes()).padStart(2, '0');

  // AI 분석 메시지 (시간대별 수분 분석 포함)
  const waterAnalysis = useMemo(() => isToday && data.waterMl > 0 ? generateWaterAnalysis(data.waterMl) : null, [data.waterMl, isToday]);

  const aiPrimary = (() => {
    // 시간대별 수분 분석 우선
    if (waterAnalysis?.message) return waterAnalysis.message;
    if (data.cafMg > 300) return `카페인이 ${data.cafMg}mg으로 평소보다 많아요. 수분을 더 챙기면 좋을 듯해요.`;
    if (data.condAvg && data.condAvg < 5) return `오늘 컨디션이 ${data.condAvg.toFixed(1)}점이에요. 무리하지 말고 쉬어가세요.`;
    if (data.totalKcal > 0) return `오늘 ${data.totalKcal}kcal를 섭취했어요. 균형 잡힌 하루를 보내고 있네요.`;
    return null;
  })();
  const aiSecondary = (() => {
    // 수분 분석 보조 정보
    if (waterAnalysis) return `현재 ${data.waterMl.toLocaleString()}ml · 이 시간 권장 약 ${waterAnalysis.idealMl.toLocaleString()}ml`;
    if (data.condAvg && data.condAvg >= 7) return `컨디션 ${data.condAvg.toFixed(1)}점은 좋은 상태예요`;
    if (data.sleep >= 7) return `수면 ${data.sleep}시간은 충분한 휴식이에요`;
    if (data.waterMl >= 1500) return `수분 ${(data.waterMl / 1000).toFixed(1)}L, 잘 챙기고 있어요`;
    return null;
  })();

  // 추세 단위
  const trendUnit = trendMetric === 'water' ? 'ml' : trendMetric === 'condition' ? '점' : 'h';
  const trendAvgStr = trendMetric === 'water' ? `${Math.round(trend.avg).toLocaleString()}ml` : trendMetric === 'condition' ? `${trend.avg.toFixed(1)}점` : `${trend.avg.toFixed(1)}h`;
  const trendTodayStr = trendMetric === 'water' ? `${Math.round(trend.todayVal).toLocaleString()}ml` : trendMetric === 'condition' ? `${trend.todayVal.toFixed(1)}점` : `${trend.todayVal.toFixed(1)}h`;

  // 홈 카드 공통 스타일
  const _cs = {
    background: 'var(--card-bg)', borderRadius: 30,
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    border: 'var(--card-border)', boxShadow: 'var(--card-shadow)',
  };

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100 }}>

      {/* 1. 헤더 */}
      <div style={{ padding: '16px 20px 0' }}>
        {/* 날짜 네비 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div onClick={goPrev} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 12, background: 'rgba(0,0,0,0.03)' }}>
            <IconChevronLeft size={18} color="var(--text-muted)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(0,0,0,0.35)' }}>{dateLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0D3028', letterSpacing: -0.3 }}>{relativeLabel}</div>
          </div>
          <div onClick={() => { if (!isToday) { const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 1); setSelectedDate(getDateKey(d)); } }}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isToday ? 'default' : 'pointer', opacity: isToday ? 0.3 : 1, borderRadius: 12, background: 'rgba(0,0,0,0.03)' }}>
            <IconChevronRight size={18} color="var(--text-muted)" />
          </div>
        </div>

        {/* 미니 스탯 pill badges */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {[
            { label: '컨디션', value: data.condAvg ? data.condAvg.toFixed(1) : '—', color: data.condAvg ? (data.condAvg >= 7 ? '#22C55E' : data.condAvg >= 4 ? '#E8A135' : '#E05050') : 'var(--text-muted)' },
            { label: '수분', value: data.waterMl > 0 ? `${(data.waterMl / 1000).toFixed(1)}L` : '—', color: data.waterMl > 0 ? '#378ADD' : 'var(--text-muted)' },
            { label: '활동', value: data.steps > 0 ? Math.round(data.steps / 1000) + 'k' : '—', color: data.steps > 0 ? '#D85A30' : 'var(--text-muted)' },
            { label: '수면', value: data.sleep > 0 ? `${data.sleep}h` : '—', color: data.sleep > 0 ? (data.sleep >= 7 ? '#22C55E' : data.sleep >= 5 ? '#E8A135' : '#E05050') : 'var(--text-muted)' },
          ].map(s => (
            <div key={s.label} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 20,
              background: 'rgba(255,255,255,0.4)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.5)',
            }}>
              <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', fontWeight: 500 }}>{s.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 18px 0' }}>

        {/* 2. AI 분석 카드 */}
        {(aiPrimary || aiSecondary) && (
          <div style={{ ..._cs, padding: '18px 20px', marginBottom: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <IconSparkles size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>lua의 오늘 분석</span>
            </div>
            {aiPrimary && <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: aiSecondary ? 10 : 0 }}>{aiPrimary}</div>}
            {aiPrimary && aiSecondary && <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.05)', paddingTop: 10 }} />}
            {aiSecondary && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, display: 'flex', alignItems: 'center' }}>
                {aiSecondary}
                <IconTrendingUp size={13} color="var(--accent-primary)" style={{ marginLeft: 4, flexShrink: 0 }} />
              </div>
            )}
          </div>
        )}

        {/* 3. 타임라인 */}
        <div style={{ ..._cs, padding: '20px', marginBottom: 15 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <IconClock size={14} color="var(--text-muted)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>타임라인</span>
          </div>

          {groupedTimeline.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              아직 기록이 없어요
            </div>
          ) : (
            groupedTimeline.map((group, gi) => {
              const { Icon, color } = CAT_ICONS[group.category] || { Icon: IconClock, color: 'var(--text-muted)' };
              const isMulti = group.count >= 2;
              const isExpanded = expandedGroup === gi;

              if (!isMulti) {
                // 단일 항목 — 기존과 동일
                const item = group.items[0];
                return (
                  <div key={item.id} onClick={() => { setEditingId(item.id); setEditTime(item.time); }} style={{
                    display: 'flex', gap: 12, padding: '8px 0 8px 14px', marginBottom: 4,
                    borderLeft: `2px solid ${color}30`, cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)', minWidth: 38, fontWeight: 500 }}>{item.time}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 8, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={13} color={color} />
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, flex: 1 }}>{item.content}</span>
                      {item.photo && (
                        <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                          <FoodPhoto photo={item.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // 다중 항목 그룹
              return (
                <div key={`g${gi}`} style={{ borderLeft: `2px solid ${color}30`, marginBottom: 4 }}>
                  {/* 그룹 헤더 */}
                  <div onClick={() => { hapticLight(); setExpandedGroup(isExpanded ? null : gi); }} style={{
                    display: 'flex', gap: 12, padding: '8px 0 8px 14px', cursor: 'pointer',
                    minHeight: 44, alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)', minWidth: 38, fontWeight: 500 }}>{group.lastTime}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 8, background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={13} color={color} />
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{getGroupSummary(group)}</span>
                      <span style={{
                        fontSize: 10, color: 'var(--color-text-tertiary, rgba(0,0,0,0.3))',
                        background: '#F0F7FE', padding: '2px 6px', borderRadius: 6, marginLeft: 4,
                      }}>{getGroupCountLabel(group)}</span>
                    </div>
                    <IconChevronDown size={12} color="var(--color-text-tertiary, rgba(0,0,0,0.3))"
                      style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  </div>

                  {/* 펼침 상태 - 개별 항목 */}
                  {isExpanded && (
                    <div style={{ paddingLeft: 20, paddingBottom: 4 }}>
                      {group.items.map((item) => (
                        <div key={item.id} onClick={() => { setEditingId(item.id); setEditTime(item.time); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer', minHeight: 28 }}>
                          <span style={{ fontSize: 10, color: 'var(--color-text-secondary, rgba(0,0,0,0.4))', minWidth: 38 }}>{item.time}</span>
                          <span style={{ fontSize: 2, color: 'var(--color-text-tertiary, rgba(0,0,0,0.2))' }}>·</span>
                          <span style={{ fontSize: 10, color: 'var(--color-text-secondary, rgba(0,0,0,0.4))' }}>{getItemBrief(item)}</span>
                          {item.photo && (
                            <div style={{ width: 24, height: 24, borderRadius: 6, overflow: 'hidden', flexShrink: 0, marginLeft: 'auto' }}>
                              <FoodPhoto photo={item.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* 현재 시각 슬롯 */}
          {isToday && (
            <div style={{
              display: 'flex', gap: 12, alignItems: 'center',
              background: 'rgba(137,206,245,0.06)', borderLeft: '2px solid var(--accent-primary)',
              borderRadius: '0 12px 12px 0', padding: '10px 12px', marginTop: 6,
              cursor: 'pointer',
            }}>
              <span style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 600, minWidth: 38 }}>{nowHH}:{nowMM}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(137,206,245,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconPlus size={13} color="var(--accent-primary)" />
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>지금 무엇을 했나요?</span>
              </div>
            </div>
          )}
        </div>

        {/* 4. 7일 추세 */}
        <div style={{ ..._cs, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconChartBar size={14} color="var(--text-muted)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>최근 7일 추세</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'water', label: '수분' },
                { key: 'condition', label: '컨디션' },
                { key: 'sleep', label: '수면' },
              ].map(c => (
                <div key={c.key} onClick={() => setTrendMetric(c.key)} style={{
                  fontSize: 10, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                  background: trendMetric === c.key ? 'rgba(255,255,255,0.5)' : 'transparent',
                  color: trendMetric === c.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: trendMetric === c.key ? 600 : 400,
                  border: trendMetric === c.key ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
                }}>{c.label}</div>
              ))}
            </div>
          </div>

          {/* 막대 그래프 */}
          {(() => {
            const maxVal = Math.max(...trend.values.map(v => v.value), 1);
            return (
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 80, padding: '0 4px', marginBottom: 10, gap: 8 }}>
                {trend.values.map((v, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{
                      width: '100%', borderRadius: 6,
                      height: v.value > 0 ? `${Math.max((v.value / maxVal) * 100, 8)}%` : '4%',
                      background: v.isToday ? 'var(--accent-primary)' : 'rgba(0,0,0,0.05)',
                      transition: 'height 0.3s ease',
                    }} />
                    <span style={{ fontSize: 9, color: v.isToday ? 'var(--accent-primary)' : 'rgba(0,0,0,0.25)', fontWeight: v.isToday ? 600 : 400 }}>{v.dayLabel}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)', textAlign: 'center', fontWeight: 500 }}>
            평균 {trendAvgStr} · 오늘 {trendTodayStr}
          </div>
        </div>
      </div>

      {/* 시간 수정 모달 */}
      {editingId && (() => {
        const item = timeline.find(t => t.id === editingId);
        if (!item) return null;
        const { Icon, color } = CAT_ICONS[item.category] || { Icon: IconClock, color: 'var(--text-muted)' };
        return (
          <div onClick={() => setEditingId(null)} style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: 'var(--bg-modal, #fff)', borderRadius: 24,
              padding: '28px 24px 24px', width: '100%', maxWidth: 320,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={color} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.content}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>시간 수정</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <input type="time" autoFocus value={editTime} onChange={e => setEditTime(e.target.value)}
                  style={{
                    width: '100%', maxWidth: 200, padding: '12px 16px', borderRadius: 14,
                    border: '1.5px solid rgba(0,0,0,0.08)',
                    background: 'var(--bg-input, #F2F3F5)', fontSize: 28, fontWeight: 600,
                    color: 'var(--text-primary)', textAlign: 'center', outline: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                    WebkitAppearance: 'none', appearance: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setEditingId(null)} style={{
                  flex: 1, padding: '13px 0', borderRadius: 14,
                  border: 'none', background: 'var(--bg-input, #F2F3F5)',
                  color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>취소</button>
                <button onClick={() => {
                  if (editTime && editTime !== item.time) {
                    saveTimelineTime(selectedDate, item, editTime);
                    setVer(v => v + 1);
                  }
                  setEditingId(null);
                }} style={{
                  flex: 1, padding: '13px 0', borderRadius: 14,
                  border: 'none', background: 'var(--accent-primary)',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>저장</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

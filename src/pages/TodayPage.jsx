import { useState, useMemo, useEffect } from 'react';
import { IconChevronLeft, IconChevronRight, IconSparkles, IconTrendingUp, IconClock, IconMoon, IconDroplet, IconCoffee, IconApple, IconFlame, IconMoodSmile, IconPlus, IconChartBar } from '@tabler/icons-react';
import { getProfile } from '../storage/ProfileStorage';
import { getTodayFoods, getFoodRecords } from '../storage/FoodStorage';

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

  // 수면 (기상)
  if (data.sleep > 0) {
    const bedtime = data.rec.sleep?.bedtime;
    items.push({ id: 's1', time: bedtime ? bedtime.slice(11, 16) : '07:00', category: 'sleep', content: `기상 · 수면 ${data.sleep}h`, sortTime: bedtime || `${dateStr}T07:00` });
  }

  // 수분
  if (data.waterCups > 0) {
    items.push({ id: 'w1', time: '09:00', category: 'water', content: `물 ${data.waterMl}ml (${data.waterCups}잔)`, sortTime: `${dateStr}T09:00` });
  }

  // 카페인
  data.cafItems.forEach((d, i) => {
    const t = d.drunkAt ? d.drunkAt.slice(11, 16) : `${String(9 + i).padStart(2, '0')}:30`;
    items.push({ id: `c${i}`, time: t, category: 'caffeine', content: `${d.name || d.key} · 카페인 ${(({ espresso: 150, americano: 150, latte: 150, drip: 130, coldbrew: 200, matcha: 70, green_tea: 30, black_tea: 50, energy_drink: 160 })[d.key] || 100) * (d.count || 1)}mg`, sortTime: `${dateStr}T${t}` });
  });

  // 식사
  data.dayFoods.forEach((f, i) => {
    const mealTime = f.meal === '아침' ? '08:00' : f.meal === '점심' ? '12:30' : f.meal === '저녁' ? '19:00' : `${12 + i}:00`;
    items.push({ id: `m${i}`, time: mealTime, category: 'meal', content: `${f.meal || '식사'} · ${f.name || ''} ${f.kcal ? f.kcal + 'kcal' : ''}`.trim(), sortTime: `${dateStr}T${mealTime}` });
  });

  // 활동
  if (data.steps > 0) {
    items.push({ id: 'a1', time: '18:00', category: 'activity', content: `${data.steps.toLocaleString()}보 걸음`, sortTime: `${dateStr}T18:00` });
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

export default function TodayPage() {
  const [selectedDate, setSelectedDate] = useState(() => getDateKey(new Date()));
  const [trendMetric, setTrendMetric] = useState('water');
  const todayStr = getDateKey(new Date());
  const isToday = selectedDate === todayStr;

  const dt = new Date(selectedDate + 'T00:00:00');
  const dateLabel = `${dt.getMonth() + 1}월 ${dt.getDate()}일 ${DAY_NAMES[dt.getDay()]}`;
  const relativeLabel = getRelativeDate(selectedDate);

  const data = useMemo(() => getDayData(selectedDate), [selectedDate]);
  const timeline = useMemo(() => buildTimeline(selectedDate, data), [selectedDate, data]);
  const trend = useMemo(() => getWeeklyTrend(trendMetric, todayStr), [trendMetric, todayStr]);

  const goPrev = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(getDateKey(d));
  };

  // 현재 시각
  const nowHH = String(new Date().getHours()).padStart(2, '0');
  const nowMM = String(new Date().getMinutes()).padStart(2, '0');

  // AI 분석 메시지
  const aiPrimary = (() => {
    if (data.waterMl > 0 && data.waterMl < 1000) return `오늘 수분 섭취가 ${data.waterMl}ml로 아직 부족해요. 한 잔 더 챙겨보세요.`;
    if (data.cafMg > 300) return `카페인이 ${data.cafMg}mg으로 평소보다 많아요. 수분을 더 챙기면 좋을 듯해요.`;
    if (data.condAvg && data.condAvg < 5) return `오늘 컨디션이 ${data.condAvg.toFixed(1)}점이에요. 무리하지 말고 쉬어가세요.`;
    if (data.totalKcal > 0) return `오늘 ${data.totalKcal}kcal를 섭취했어요. 균형 잡힌 하루를 보내고 있네요.`;
    return null;
  })();
  const aiSecondary = (() => {
    if (data.condAvg && data.condAvg >= 7) return `컨디션 ${data.condAvg.toFixed(1)}점은 좋은 상태예요`;
    if (data.sleep >= 7) return `수면 ${data.sleep}시간은 충분한 휴식이에요`;
    if (data.waterMl >= 1500) return `수분 ${(data.waterMl / 1000).toFixed(1)}L, 잘 챙기고 있어요`;
    return null;
  })();

  // 추세 단위
  const trendUnit = trendMetric === 'water' ? 'ml' : trendMetric === 'condition' ? '점' : 'h';
  const trendAvgStr = trendMetric === 'water' ? `${Math.round(trend.avg).toLocaleString()}ml` : trendMetric === 'condition' ? `${trend.avg.toFixed(1)}점` : `${trend.avg.toFixed(1)}h`;
  const trendTodayStr = trendMetric === 'water' ? `${Math.round(trend.todayVal).toLocaleString()}ml` : trendMetric === 'condition' ? `${trend.todayVal.toFixed(1)}점` : `${trend.todayVal.toFixed(1)}h`;

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100 }}>

      {/* 1. Sticky 헤더 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        padding: '16px 16px 14px',
      }}>
        {/* 날짜 네비 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div onClick={goPrev} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconChevronLeft size={20} color="var(--text-muted)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dateLabel}</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{relativeLabel}</div>
          </div>
          <div onClick={() => { if (!isToday) { const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 1); setSelectedDate(getDateKey(d)); } }}
            style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isToday ? 'default' : 'pointer', opacity: isToday ? 0.3 : 1 }}>
            <IconChevronRight size={20} color="var(--text-muted)" />
          </div>
        </div>

        {/* 미니 스탯 4개 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[
            { label: '컨디션', value: data.condAvg ? data.condAvg.toFixed(1) : '—' },
            { label: '수분', value: data.waterMl > 0 ? `${(data.waterMl / 1000).toFixed(1)}L` : '—' },
            { label: '활동', value: data.steps > 0 ? Math.round(data.steps / 1000) + 'k' : '—' },
            { label: '수면', value: data.sleep > 0 ? `${data.sleep}h` : '—' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface-light, rgba(255,255,255,0.08))', padding: '8px 4px', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 16px 0' }}>

        {/* 2. AI 분석 카드 */}
        {(aiPrimary || aiSecondary) && (
          <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: 'var(--card-border)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <IconSparkles size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>lua의 오늘 분석</span>
            </div>
            {aiPrimary && <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: aiSecondary ? 8 : 0 }}>{aiPrimary}</div>}
            {aiPrimary && aiSecondary && <div style={{ borderTop: '0.5px solid var(--border-light)', paddingTop: 8 }} />}
            {aiSecondary && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, display: 'flex', alignItems: 'center' }}>
                {aiSecondary}
                <IconTrendingUp size={13} color="var(--accent-primary)" style={{ marginLeft: 4, flexShrink: 0 }} />
              </div>
            )}
          </div>
        )}

        {/* 3. 타임라인 */}
        <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: 'var(--card-border)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <IconClock size={14} color="var(--text-muted)" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>타임라인</span>
          </div>

          {timeline.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              아직 기록이 없어요
            </div>
          ) : (
            timeline.map((item, i) => {
              const { Icon, color } = CAT_ICONS[item.category] || { Icon: IconClock, color: 'var(--text-muted)' };
              return (
                <div key={item.id} style={{
                  display: 'flex', gap: 10, paddingLeft: 12, padding: '6px 0 6px 12px', marginBottom: 8,
                  borderLeft: '2px solid #B5D4F4', cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 38 }}>{item.time}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={13} color={color} />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{item.content}</span>
                  </div>
                </div>
              );
            })
          )}

          {/* 현재 시각 슬롯 */}
          {isToday && (
            <div style={{
              display: 'flex', gap: 10, alignItems: 'center',
              background: 'var(--surface-light, rgba(255,255,255,0.08))', borderLeft: '2px solid var(--accent-primary)',
              borderRadius: 6, padding: '8px 10px', marginTop: 4,
              cursor: 'pointer',
            }}>
              <span style={{ fontSize: 11, color: 'var(--accent-primary)', fontWeight: 500, minWidth: 38 }}>{nowHH}:{nowMM}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconPlus size={13} color="var(--accent-primary)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>지금 무엇을 했나요?</span>
              </div>
            </div>
          )}
        </div>

        {/* 4. 7일 추세 */}
        <div style={{ background: 'var(--card-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: 'var(--card-border)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconChartBar size={14} color="var(--text-muted)" />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>최근 7일 추세</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'water', label: '수분' },
                { key: 'condition', label: '컨디션' },
                { key: 'sleep', label: '수면' },
              ].map(c => (
                <div key={c.key} onClick={() => setTrendMetric(c.key)} style={{
                  fontSize: 10, padding: '3px 8px', borderRadius: 8, cursor: 'pointer',
                  background: trendMetric === c.key ? 'var(--surface-light, rgba(255,255,255,0.15))' : 'transparent',
                  color: trendMetric === c.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: trendMetric === c.key ? 'none' : '0.5px solid var(--border-light)',
                }}>{c.label}</div>
              ))}
            </div>
          </div>

          {/* 막대 그래프 */}
          {(() => {
            const maxVal = Math.max(...trend.values.map(v => v.value), 1);
            return (
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 70, padding: '0 4px', marginBottom: 8, gap: 6 }}>
                {trend.values.map((v, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{
                      width: '100%', borderRadius: '4px 4px 0 0',
                      height: v.value > 0 ? `${Math.max((v.value / maxVal) * 100, 8)}%` : '4%',
                      background: v.isToday ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)',
                      transition: 'height 0.3s ease',
                    }} />
                    <span style={{ fontSize: 9, color: v.isToday ? 'var(--accent-primary)' : 'var(--text-dim)', fontWeight: v.isToday ? 500 : 400 }}>{v.dayLabel}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            평균 {trendAvgStr} · 오늘 {trendTodayStr}
          </div>
        </div>
      </div>

      {/* 5. FAB */}
      <div style={{
        position: 'fixed', bottom: 90, right: 20, zIndex: 50,
        width: 48, height: 48, borderRadius: '50%',
        background: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer',
      }}>
        <IconPlus size={22} color="var(--bg-primary, #fff)" />
      </div>
    </div>
  );
}

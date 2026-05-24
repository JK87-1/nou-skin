import { useState, useEffect, useCallback } from 'react';
import { generateAlerts, getSeasonalTip, getScheduledNotifications } from '../data/EnvironmentAlertData';
import { getWeatherData, saveWeatherData, isStale, getUserLocation, saveUserLocation } from '../storage/WeatherStorage';
import { scheduleWeatherNotifications, clearWeatherTimers } from '../utils/weatherNotificationScheduler';
import { MicroscopeIcon, PastelIcon } from './icons/PastelIcons';
import { WeatherIcon } from './WeatherChip';

// ===== Fallback dummy data =====
const DUMMY_WEATHER = {
  location: '서울',
  date: (() => {
    const d = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`;
  })(),
  temp: 5, tempMin: -1, tempMax: 9,
  condition: '맑음', conditionIcon: '☀️',
  humidity: 35, wind: 8, uv: 3, uvLabel: '보통',
  airQuality: 45, airLabel: '보통',
  fineDust: 45, ultraFineDust: 28,
  forecast: [
    { time: '09시', icon: '☀️', temp: 1, uv: 2, rain: 0 },
    { time: '12시', icon: '☀️', temp: 7, uv: 4, rain: 5 },
    { time: '15시', icon: '⛅', temp: 8, uv: 3, rain: 10 },
    { time: '18시', icon: '⛅', temp: 5, uv: 1, rain: 20 },
    { time: '21시', icon: '🌙', temp: 2, uv: 0, rain: 15 },
  ],
  weekForecast: [
    { day: '월', icon: '☀️', min: -2, max: 8, humidity: 30 },
    { day: '화', icon: '⛅', min: 0, max: 10, humidity: 45 },
    { day: '수', icon: '🌧', min: 3, max: 11, humidity: 75 },
    { day: '목', icon: '⛅', min: 1, max: 9, humidity: 40 },
    { day: '금', icon: '☀️', min: -1, max: 7, humidity: 32 },
  ],
};

// ===== Helper functions =====
function formatTimeAMPM(t) {
  const m = t.match(/(\d+)/);
  if (!m) return t;
  const h = parseInt(m[1], 10);
  if (h === 0) return '12AM';
  if (h < 12) return `${h}AM`;
  if (h === 12) return '12PM';
  return `${h - 12}PM`;
}
function uvColor(val) {
  if (val <= 2) return '#A8D4FA';   // 밝은 하늘 — 좋음
  if (val <= 5) return '#6598EF';   // 블루 — 보통
  if (val <= 7) return '#4A7ACD';   // 딥블루 — 주의
  return '#3558A8';                 // 네이비 — 위험
}

function uvToSpf(val) {
  if (val <= 2) return { spf: '15', label: '낮음' };
  if (val <= 5) return { spf: '30', label: '보통' };
  if (val <= 7) return { spf: '50', label: '높음' };
  return { spf: '50+', label: '매우 높음' };
}

function humidityInfo(val) {
  if (val < 30) return { color: '#3558A8', label: '매우 낮음' };   // 네이비 — 위험
  if (val < 40) return { color: '#4A7ACD', label: '낮음' };        // 딥블루 — 주의
  if (val <= 60) return { color: '#A8D4FA', label: '적정' };       // 밝은 하늘 — 좋음
  if (val <= 70) return { color: '#4A7ACD', label: '높음' };       // 딥블루 — 주의
  return { color: '#3558A8', label: '매우 높음' };                 // 네이비 — 위험
}

function airInfo(val) {
  if (val <= 30) return { color: '#A8D4FA', label: '좋음' };       // 밝은 하늘
  if (val <= 50) return { color: '#6598EF', label: '보통' };       // 블루
  if (val <= 80) return { color: '#4A7ACD', label: '나쁨' };       // 딥블루
  return { color: '#3558A8', label: '매우나쁨' };                  // 네이비
}

function weekHumidityTag(h) {
  if (h < 40) return { label: '건조주의', color: '#4A7ACD' };      // 딥블루 — 주의
  if (h <= 70) return { label: '적정', color: '#A8D4FA' };         // 밝은 하늘 — 좋음
  return { label: '습함', color: '#4A7ACD' };                     // 딥블루 — 주의
}

// Meteocons animated weather icons — CDN
const METEOCONS_BASE = 'https://cdn.meteocons.com/3.0.0-next.10/svg/fill';
const METEOCONS_MAP = {
  '☀️': 'clear-day',
  '🌙': 'clear-night',
  '⛅': 'partly-cloudy-day',
  '🌤': 'partly-cloudy-day',
  '☁️': 'overcast',
  '🌧': 'overcast-rain',
  '🌨': 'overcast-snow',
  '🌦': 'partly-cloudy-day-rain',
  '⛈': 'thunderstorms-day-rain',
  '🌫': 'fog',
};

function WeatherIconFilled({ emoji, size = 24 }) {
  const name = METEOCONS_MAP[emoji] || 'overcast';
  const url = `${METEOCONS_BASE}/${name}.svg`;
  // 큰 사이즈에서는 object 태그 사용 (img는 iOS에서 SVG 애니메이션/렌더링 깨짐)
  if (size >= 40) {
    return (
      <object
        data={url}
        type="image/svg+xml"
        width={size}
        height={size}
        style={{ display: 'inline-block', flexShrink: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      />
    );
  }
  return <img src={url} width={size} height={size} alt="" style={{ display: 'inline-block', flexShrink: 0 }} />;
}

// ===== Main Component =====
export default function SkinWeather({ skinResult }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openAlert, setOpenAlert] = useState(-1);

  const skinProfile = skinResult ? {
    moisture: skinResult.moisture ?? 50,
    oil: skinResult.oilBalance ?? 50,
    sensitivity: skinResult.textureScore ? (100 - skinResult.textureScore) : 50,
    pigment: skinResult.pigmentationScore ?? 50,
    elasticity: skinResult.elasticityScore ?? 50,
  } : null;

  const fetchWeather = useCallback(async (lat, lon) => {
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      saveWeatherData(data);
      setWeather(data);
    } catch {
      // Try cached data
      const cached = getWeatherData();
      setWeather(cached || DUMMY_WEATHER);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Check cache first
    const cached = getWeatherData();
    if (cached && !isStale()) {
      setWeather(cached);
      setLoading(false);
      return;
    }

    // Get fresh location (re-check GPS each time cache is stale)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          saveUserLocation(pos.coords.latitude, pos.coords.longitude, '');
          fetchWeather(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // Denied — use saved location or default Seoul
          const saved = getUserLocation();
          if (saved) {
            fetchWeather(saved.lat, saved.lon);
          } else {
            saveUserLocation(37.5665, 126.978, '서울');
            fetchWeather(37.5665, 126.978);
          }
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    } else {
      fetchWeather(37.5665, 126.978);
    }
  }, [fetchWeather]);

  const alerts = weather && skinProfile ? generateAlerts(weather, skinProfile) : [];
  const seasonal = getSeasonalTip();
  const notifications = weather ? getScheduledNotifications(weather, skinProfile) : [];
  const highCount = alerts.filter(a => a.priority === 'high').length;

  // 날씨 알림 로컬 스케줄링 — 앱이 열려있을 때 시간대별 알림 자동 발송
  useEffect(() => {
    if (notifications.length > 0) {
      scheduleWeatherNotifications(notifications);
    }
    return () => clearWeatherTimers();
  }, [weather]); // weather가 바뀔 때 재스케줄링

  return (
    <div style={{ padding: '0 20px 24px' }}>
      <style>{`
        @keyframes weatherSlideIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes swShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes swFadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes swFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes swSlideInRight { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes swPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
        .sw-hide-scroll::-webkit-scrollbar { display: none; }
        .sw-hide-scroll { scrollbar-width: none; }
      `}</style>

      {/* ── Loading Skeleton ── */}
      {loading && (
        <div style={{ animation: 'swFadeInUp 0.3s ease both' }}>
          {[180, 80, 120].map((h, i) => (
            <div key={i} style={{
              height: h, borderRadius: 24, marginBottom: 12,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
              backgroundSize: '200% 100%',
              animation: 'swShimmer 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {weather && !loading && <>

      {/* ── Weather Overview ── */}
      <div style={{ marginBottom: 16, animation: 'swFadeInUp 0.5s ease 0.05s both' }}>
        {/* 날짜 */}
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16, textAlign: 'center' }}>{weather.date} · {weather.condition}</div>

        {/* 온도 + 상태 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 16px' }}>
          <span style={{ fontSize: 80, fontWeight: 500, color: '#fff', lineHeight: 1, letterSpacing: -3 }}>{weather.temp}°</span>
          <WeatherIconFilled emoji={weather.conditionIcon} size={80} />
        </div>
        <div style={{ padding: '0 16px', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{weather.tempMax}° / {weather.tempMin}°</span>
        </div>

        {/* ── Environment Indicators ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-around', marginBottom: 20,
        padding: '0 16px', animation: 'swFadeInUp 0.5s ease 0.1s both',
      }}>
        {/* Humidity */}
        {(() => {
          const hi = humidityInfo(weather.humidity);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6.8 11a6 6 0 1 0 10.396 0l-5.197 -8l-5.2 8z" /></svg>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{weather.humidity}<span style={{ fontSize: 11, fontWeight: 400 }}>%</span></div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>습도 · {hi.label}</div>
              </div>
            </div>
          );
        })()}

        {/* Air Quality */}
        {(() => {
          const ai = airInfo(weather.airQuality);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 9.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8.5 4.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M8.5 14.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M3.5 19.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M13.5 9.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18.5 4.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M13.5 19.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M18.5 14.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{weather.airQuality}<span style={{ fontSize: 10, fontWeight: 400, marginLeft: 2 }}>AQI</span></div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>미세먼지 · {ai.label}</div>
              </div>
            </div>
          );
        })()}

        {/* UV */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h1m16 0h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7m-9.7 5.7a4 4 0 1 1 8 0" /><path d="M12 4v-1" /><path d="M13 16l2 5h1l2 -5" /><path d="M6 16v3a2 2 0 1 0 4 0v-3" /></svg>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{weather.uv}<span style={{ fontSize: 11, fontWeight: 400 }}>/10</span></div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>자외선 · {weather.uvLabel}</div>
          </div>
        </div>
      </div>

        {/* 시간별 예보 */}
        {(() => {
          const fc = weather.forecast || [];
          const temps = fc.map(f => f.temp);
          const minT = Math.min(...temps);
          const maxT = Math.max(...temps);
          const range = maxT - minT || 1;
          const graphH = 32;
          const count = fc.length;
          // SVG 포인트 계산 — 각 시간대 중앙에 정렬
          const points = fc.map((f, i) => {
            const x = ((i + 0.5) / count) * 100;
            const y = graphH - ((f.temp - minT) / range) * (graphH - 4) - 2;
            return { x, y };
          });
          // 부드러운 곡선 path 생성
          const curvePath = points.reduce((acc, p, i) => {
            if (i === 0) return `M${p.x},${p.y}`;
            const prev = points[i - 1];
            const cpx1 = prev.x + (p.x - prev.x) * 0.4;
            const cpx2 = p.x - (p.x - prev.x) * 0.4;
            return `${acc} C${cpx1},${prev.y} ${cpx2},${p.y} ${p.x},${p.y}`;
          }, '');

          return (
            <div style={{
              background: 'rgba(34,113,208,0.05)',
              borderRadius: 16, padding: '14px 16px',
            }}>
              {/* 시간 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                {fc.map((f, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                    {formatTimeAMPM(f.time)}
                  </div>
                ))}
              </div>
              {/* 아이콘 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                {fc.map((f, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    <WeatherIconFilled emoji={f.icon} size={26} />
                  </div>
                ))}
              </div>
              {/* 온도 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                {fc.map((f, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 600, color: '#fff' }}>
                    {f.temp}°
                  </div>
                ))}
              </div>
              {/* 온도 그래프 */}
              <div style={{ marginBottom: 10 }}>
                <svg width="100%" viewBox={`0 0 ${count * 60} 40`} style={{ display: 'block' }}>
                  {(() => {
                    const w = count * 60;
                    const h = 40;
                    const pad = 6;
                    const pts = fc.map((f, i) => ({
                      x: (i + 0.5) / count * w,
                      y: h - pad - ((f.temp - minT) / range) * (h - pad * 2),
                    }));
                    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
                    return <>
                      <path d={d} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
                      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#fff" />)}
                    </>;
                  })()}
                </svg>
              </div>
              {/* 비 확률 */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {fc.map((f, i) => (
                  <div key={i} style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)" stroke="none"><path d="M6.8 11a6 6 0 1 0 10.396 0l-5.197 -8l-5.2 8z" /></svg>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{f.rain ?? 0}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Skin Alerts ── */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 16, animation: 'swFadeInUp 0.5s ease 0.15s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>내 피부 맞춤 알림</span>
            {highCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#fff',
                background: '#3558A8', borderRadius: 10, padding: '2px 7px',
                minWidth: 18, textAlign: 'center',
              }}>{highCount}</span>
            )}
          </div>

          {alerts.map((alert, i) => {
            const isOpen = openAlert === i;
            return (
              <div key={alert.id} style={{
                marginBottom: 8,
                background: 'rgba(255,255,255,0.42)',
                backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(255,255,255,0.4)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                borderRadius: 18, overflow: 'hidden',
                animation: `swFadeInUp 0.4s ease ${i * 0.08}s both`,
                transition: 'background 0.3s, border-color 0.3s',
              }}>
                {/* Header */}
                <div
                  onClick={() => setOpenAlert(isOpen ? -1 : i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 16, cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                    background: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22,
                  }}><PastelIcon emoji={alert.icon} size={22} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{alert.title}</span>
                      {alert.priority === 'high' && (
                        <div style={{
                          width: 7, height: 7, borderRadius: '50%', background: '#3558A8', flexShrink: 0,
                          animation: 'swPulse 2s ease-in-out infinite',
                        }} />
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{alert.subtitle}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: alert.color, marginRight: 4 }}>
                    {alert.matchScore}
                  </div>
                  <span style={{
                    fontSize: 12, color: 'var(--text-dim)', transition: 'transform 0.3s',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>▾</span>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div style={{ padding: '0 16px 16px' }}>
                    <div style={{
                      padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 12,
                      fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10,
                    }}>
                      {alert.description}
                    </div>
                    {alert.tips.map((tip, j) => (
                      <div key={j} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10,
                        marginBottom: 4,
                        animation: `swSlideInRight 0.3s ease ${j * 0.08}s both`,
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0, display: 'inline-flex' }}>{tip.icon}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tip.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No skin data message */}
      {!skinResult && (
        <div style={{
          padding: 16, borderRadius: 18,
          marginBottom: 16, textAlign: 'center',
          animation: 'swFadeInUp 0.5s ease 0.15s both',
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}><MicroscopeIcon size={24} /></div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>피부 측정 후 맞춤 알림을 받아보세요</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>분석 결과를 기반으로 오늘 환경에 맞는 케어 팁을 드려요</div>
        </div>
      )}

      {/* ── 5-Day Forecast ── */}
      {weather.weekForecast && weather.weekForecast.length > 0 && (
        <div style={{ marginBottom: 16, animation: 'swFadeInUp 0.5s ease 0.2s both' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
            5일간 피부 환경 예보
          </div>
          <div style={{
            background: 'rgba(34,113,208,0.05)', borderRadius: 16,
            padding: 6,
          }}>
            {weather.weekForecast.map((day, i) => {
              const ht = weekHumidityTag(day.humidity);
              const range = 25;
              const barLeft = ((day.min + 10) / range) * 100;
              const barWidth = Math.max(8, ((day.max - day.min) / range) * 100);
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px',
                  borderBottom: i < weather.weekForecast.length - 1 ? '1px solid var(--border-separator)' : 'none',
                  animation: `swFadeInUp 0.3s ease ${i * 0.06}s both`,
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', width: 22, flexShrink: 0 }}>{day.day}</span>
                  <span style={{ width: 30, textAlign: 'center', flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}><WeatherIcon emoji={day.icon} size={22} color="#6598ef" /></span>
                  {/* Temp range bar */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', width: 28, textAlign: 'right' }}>{day.min}°</span>
                    <div style={{
                      flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-card-hover)',
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', height: '100%', borderRadius: 2,
                        background: '#b7dafb',
                        left: `${Math.max(0, Math.min(barLeft, 85))}%`,
                        width: `${Math.min(barWidth, 100 - barLeft)}%`,
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, width: 28 }}>{day.max}°</span>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 600, color: '#fff',
                    background: `${ht.color}30`, padding: '2px 6px', borderRadius: 6,
                    flexShrink: 0,
                  }}>{ht.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Seasonal Guide ── */}
      <div style={{
        borderRadius: 18, padding: 18,
        marginBottom: 16, animation: 'swFadeInUp 0.5s ease 0.3s both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><PastelIcon emoji={seasonal.icon} size={18} /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{seasonal.title}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{seasonal.season} 시즌 가이드</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
          {seasonal.content}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {seasonal.keyPoints.map((kp, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center', padding: '12px 8px 10px',
              background: 'rgba(255,255,255,0.03)', borderRadius: 14,
            }}>
              <div style={{ fontSize: 18, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{kp.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>{kp.label}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.4 }}>{kp.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scheduled Notifications ── */}
      {notifications.length > 0 && (() => {
        let weatherEnabled = false;
        try {
          const ps = JSON.parse(localStorage.getItem('lua_push_settings') || '{}');
          weatherEnabled = !!ps.weatherEnabled;
        } catch {}
        const nowHour = new Date().getHours();
        const parseNotifHour = (timeStr) => {
          const match = timeStr.match(/(\d+):(\d+)/);
          if (!match) return 0;
          const h = parseInt(match[1]);
          if (timeStr.includes('오후') && h !== 12) return h + 12;
          if (timeStr.includes('오전') && h === 12) return 0;
          return h;
        };
        const nextIdx = notifications.findIndex(n => parseNotifHour(n.time) > nowHour);
        return (
        <div style={{ marginBottom: 8, animation: 'swFadeInUp 0.5s ease 0.4s both', borderRadius: 18, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>오늘 예정된 알림</div>
            {weatherEnabled ? (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#6598EF', background: 'rgba(101,152,239,0.1)', padding: '3px 8px', borderRadius: 8 }}>알림 ON</span>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', background: 'rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: 8 }}>알림 OFF</span>
            )}
          </div>
          {!weatherEnabled && (
            <div style={{ padding: '10px 14px', borderRadius: 12, marginBottom: 10, background: 'rgba(101,152,239,0.08)', border: '1px solid rgba(101,152,239,0.12)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              마이 &gt; 알림 설정에서 피부 날씨 알림을 켜면 시간대별로 알림을 받을 수 있어요
            </div>
          )}
          {notifications.map((n, i) => {
            const h = parseNotifHour(n.time);
            const isPast = h <= nowHour;
            const isNext = i === nextIdx;
            return (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '12px 14px', borderRadius: 14,
              opacity: isPast ? 0.35 : isNext ? 1 : 0.6,
              background: isNext ? '#FFFFFF' : 'transparent',
              marginBottom: 4,
              animation: `swFadeInUp 0.3s ease ${0.4 + i * 0.06}s both`,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                background: isPast ? 'rgba(101,152,239,0.3)' : isNext ? '#6598EF' : 'rgba(255,255,255,0.15)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: isPast ? 'line-through' : 'none' }}>{n.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{n.body}</div>
              </div>
              <span style={{ fontSize: 10, color: isPast ? 'var(--text-dim)' : 'var(--text-muted)', flexShrink: 0 }}>{isPast ? '완료' : n.time}</span>
            </div>
            );
          })}
        </div>
        );
      })()}

      </>}
    </div>
  );
}

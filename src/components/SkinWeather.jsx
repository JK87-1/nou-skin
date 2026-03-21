import { useState, useEffect, useCallback } from 'react';
import { generateAlerts, getSeasonalTip, getScheduledNotifications } from '../data/EnvironmentAlertData';
import { getWeatherData, saveWeatherData, isStale, getUserLocation, saveUserLocation } from '../storage/WeatherStorage';
import { MicroscopeIcon, PastelIcon } from './icons/PastelIcons';

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
    { time: '09시', icon: '☀️', temp: 1, uv: 2 },
    { time: '12시', icon: '☀️', temp: 7, uv: 4 },
    { time: '15시', icon: '⛅', temp: 8, uv: 3 },
    { time: '18시', icon: '⛅', temp: 5, uv: 1 },
    { time: '21시', icon: '🌙', temp: 2, uv: 0 },
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
function uvColor(val) {
  if (val <= 2) return '#34d399';
  if (val <= 5) return '#F0B870';
  if (val <= 7) return '#f97316';
  return '#ef4444';
}

function humidityInfo(val) {
  if (val < 30) return { color: '#f59e0b', label: '매우 낮음' };
  if (val < 40) return { color: '#F0B870', label: '낮음' };
  if (val <= 60) return { color: '#34d399', label: '적정' };
  if (val <= 70) return { color: '#38bdf8', label: '높음' };
  return { color: '#ADEBB3', label: '매우 높음' };
}

function airInfo(val) {
  if (val <= 30) return { color: '#34d399', label: '좋음' };
  if (val <= 50) return { color: '#ADEBB3', label: '보통' };
  if (val <= 80) return { color: '#F0B870', label: '나쁨' };
  return { color: '#ef4444', label: '매우나쁨' };
}

function weekHumidityTag(h) {
  if (h < 40) return { label: '건조주의', color: '#f59e0b' };
  if (h <= 70) return { label: '적정', color: '#34d399' };
  return { label: '습함', color: '#38bdf8' };
}

// ===== Main Component =====
export default function SkinWeather({ skinResult }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openAlert, setOpenAlert] = useState(0);

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

  return (
    <div style={{ padding: '0 20px 24px' }}>
      <style>{`
        @keyframes swShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes swFadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes swFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes swSlideInRight { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes swPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.85); } }
        .sw-hide-scroll::-webkit-scrollbar { display: none; }
        .sw-hide-scroll { scrollbar-width: none; }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginBottom: 16, animation: 'swFadeInUp 0.5s ease both',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
            SKIN WEATHER
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>오늘의 피부 날씨</div>
        </div>
        {weather && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'var(--bg-card)', border: '1px solid var(--border-light)',
            borderRadius: 999, padding: '6px 14px', fontSize: 11, color: 'var(--text-secondary)',
          }}>
            📍 {weather.location}
          </div>
        )}
      </div>

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

      {/* ── Weather Overview Card ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(135,206,235,0.3), rgba(152,232,193,0.3), rgba(255,243,176,0.3))',
        borderRadius: 24, border: 'none', padding: 20,
        position: 'relative', overflow: 'hidden',
        marginBottom: 12, animation: 'swFadeInUp 0.5s ease 0.05s both',
      }}>
        {/* Glow */}
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 140, height: 140,
          background: 'radial-gradient(circle, rgba(135,206,235,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <span style={{ fontSize: 52, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{weather.temp}</span>
              <span style={{ fontSize: 20, color: 'var(--text-muted)', marginTop: 6 }}>°C</span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 14 }}>{weather.conditionIcon}</span> {weather.condition}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>최저 {weather.tempMin}° / 최고 {weather.tempMax}°</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{weather.date}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56, filter: 'drop-shadow(0 4px 12px rgba(56,189,248,0.2))', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {weather.conditionIcon}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>바람 {weather.wind}km/h</div>
          </div>
        </div>

        {/* Hourly forecast */}
        <div style={{
          borderTop: '1px solid var(--border-light)', paddingTop: 14, marginTop: 18,
          display: 'flex',
        }}>
          {(weather.forecast || []).map((f, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center',
              animation: `swFadeIn 0.3s ease ${i * 0.08}s both`,
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{f.time}</div>
              <div style={{ fontSize: 20, marginBottom: 2, display: 'flex', justifyContent: 'center' }}>{f.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{f.temp}°</div>
              {f.uv > 0 && (
                <div style={{ fontSize: 9, color: uvColor(f.uv), marginTop: 2 }}>UV {f.uv}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Environment Indicators ── */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 16,
        animation: 'swFadeInUp 0.5s ease 0.1s both',
      }}>
        {/* Humidity */}
        {(() => {
          const hi = humidityInfo(weather.humidity);
          return (
            <div style={{
              flex: 1, padding: 14, borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(135,206,235,0.2), rgba(152,232,193,0.2))', border: 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>습도</span>
                <span style={{
                  fontSize: 9, fontWeight: 600, color: hi.color,
                  background: `${hi.color}15`, padding: '2px 6px', borderRadius: 6,
                }}>{hi.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: hi.color, filter: 'brightness(0.7)' }}>{weather.humidity}</span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 2 }}>%</span>
              </div>
            </div>
          );
        })()}

        {/* Air Quality */}
        {(() => {
          const ai = airInfo(weather.airQuality);
          return (
            <div style={{
              flex: 1, padding: 14, borderRadius: 18,
              background: 'linear-gradient(135deg, rgba(152,232,193,0.2), rgba(255,243,176,0.2))', border: 'none',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>미세먼지</span>
                <span style={{
                  fontSize: 9, fontWeight: 600, color: ai.color,
                  background: `${ai.color}15`, padding: '2px 6px', borderRadius: 6,
                }}>{ai.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: ai.color, filter: 'brightness(0.7)' }}>{weather.airQuality}</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 3, marginLeft: 2 }}>AQI</span>
              </div>
            </div>
          );
        })()}

        {/* UV */}
        <div style={{
          flex: 1, padding: 14, borderRadius: 18,
          background: 'linear-gradient(135deg, rgba(152,232,193,0.08) 0%, rgba(255,243,176,0.18) 50%, rgba(255,223,140,0.2) 100%)', border: 'none',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>자외선</span>
            <span style={{
              fontSize: 9, fontWeight: 600, color: uvColor(weather.uv),
              background: `${uvColor(weather.uv)}15`, padding: '2px 6px', borderRadius: 6,
            }}>{weather.uvLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: uvColor(weather.uv), filter: 'brightness(0.7)' }}>{weather.uv}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-dim)', opacity: 0.35 }}>/10</span>
          </div>
        </div>
      </div>

      {/* ── Skin Alerts ── */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 16, animation: 'swFadeInUp 0.5s ease 0.15s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>내 피부 맞춤 알림</span>
            {highCount > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#fff',
                background: '#ef4444', borderRadius: 10, padding: '2px 7px',
                minWidth: 18, textAlign: 'center',
              }}>{highCount}</span>
            )}
          </div>

          {alerts.map((alert, i) => {
            const isOpen = openAlert === i;
            return (
              <div key={alert.id} style={{
                marginBottom: 8,
                background: isOpen
                  ? 'rgba(255,255,255,0.55)'
                  : 'rgba(255,255,255,0.5)',
                border: 'none',
                borderRadius: 20, overflow: 'hidden',
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
                          width: 7, height: 7, borderRadius: '50%', background: '#ef4444', flexShrink: 0,
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
                        <span style={{ fontSize: 16, flexShrink: 0, display: 'inline-flex' }}><PastelIcon emoji={tip.icon} size={16} /></span>
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
          background: 'rgba(240,144,112,0.06)', border: '1px solid rgba(240,144,112,0.1)',
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
            background: 'rgba(255,255,255,0.5)', borderRadius: 20,
            border: 'none', padding: 6,
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
                  <span style={{ fontSize: 22, width: 30, textAlign: 'center', flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>{day.icon}</span>
                  {/* Temp range bar */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', width: 28, textAlign: 'right' }}>{day.min}°</span>
                    <div style={{
                      flex: 1, height: 4, borderRadius: 2, background: 'var(--bg-card-hover)',
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute', height: '100%', borderRadius: 2,
                        background: 'linear-gradient(90deg, #87CEEB, #98E8C1, #FFF3B0)',
                        left: `${Math.max(0, Math.min(barLeft, 85))}%`,
                        width: `${Math.min(barWidth, 100 - barLeft)}%`,
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, width: 28 }}>{day.max}°</span>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 600, color: ht.color,
                    background: `${ht.color}12`, padding: '2px 6px', borderRadius: 6,
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
        background: 'rgba(255,182,193,0.2)',
        borderRadius: 22, border: 'none', padding: 18,
        marginBottom: 16, animation: 'swFadeInUp 0.5s ease 0.3s both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, fontSize: 18,
            background: 'transparent',
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
              <div style={{ fontSize: 18, marginBottom: 4, display: 'flex', justifyContent: 'center' }}><PastelIcon emoji={kp.icon} size={18} /></div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>{kp.label}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.4 }}>{kp.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scheduled Notifications ── */}
      {notifications.length > 0 && (
        <div style={{ marginBottom: 8, animation: 'swFadeInUp 0.5s ease 0.4s both', background: 'rgba(255,255,255,0.3)', borderRadius: 20, padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
            오늘 예정된 알림
          </div>
          {notifications.map((n, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '12px 14px', borderRadius: 14,
              opacity: i === 0 ? 1 : 0.5,
              background: i === 0 ? 'rgba(255,250,180,0.3)' : 'transparent',
              marginBottom: 4,
              animation: `swFadeInUp 0.3s ease ${0.4 + i * 0.06}s both`,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                background: i === 0 ? '#ADEBB3' : 'rgba(255,255,255,0.1)',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{n.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{n.body}</div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>{n.time}</span>
            </div>
          ))}
        </div>
      )}

      </>}
    </div>
  );
}

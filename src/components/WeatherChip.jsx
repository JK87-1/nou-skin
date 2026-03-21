import { useState, useEffect, useCallback } from 'react';
import { getWeatherData, saveWeatherData, isStale, getUserLocation, saveUserLocation } from '../storage/WeatherStorage';

function uvColor(val) {
  if (val <= 2) return '#34d399';
  if (val <= 5) return '#F0B870';
  if (val <= 7) return '#f97316';
  return '#ef4444';
}

function humidityColor(val) {
  if (val < 30) return '#f59e0b';
  if (val < 40) return '#F0B870';
  if (val <= 60) return '#34d399';
  if (val <= 70) return '#38bdf8';
  return '#ADEBB3';
}

function airColor(val) {
  if (val <= 30) return '#34d399';
  if (val <= 50) return '#ADEBB3';
  if (val <= 80) return '#F0B870';
  return '#ef4444';
}

const FALLBACK = {
  location: '서울', temp: 5, conditionIcon: '☀️',
  humidity: 35, uv: 3, airQuality: 45,
};

export default function WeatherChip({ onTap }) {
  const [weather, setWeather] = useState(null);

  const fetchWeather = useCallback(async (lat, lon) => {
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      saveWeatherData(data);
      setWeather(data);
    } catch {
      const cached = getWeatherData();
      setWeather(cached || FALLBACK);
    }
  }, []);

  useEffect(() => {
    // Use cache if fresh
    const cached = getWeatherData();
    if (cached && !isStale()) {
      setWeather(cached);
      return;
    }
    // Otherwise fetch
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          saveUserLocation(pos.coords.latitude, pos.coords.longitude, '');
          fetchWeather(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          const saved = getUserLocation();
          if (saved) fetchWeather(saved.lat, saved.lon);
          else {
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

  if (!weather) return null;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onTap?.(); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px 8px 10px',
        background: 'var(--bg-card)',
        border: 'var(--chip-border, 1px solid var(--border-light))',
        borderRadius: '50px', cursor: 'pointer',
        boxShadow: 'none',
        marginTop: 4,
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.2s',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
        <defs>
          <radialGradient id="sun-rg" cx="40%" cy="38%" r="55%">
            <stop offset="0%" stopColor="#FFF9D0" />
            <stop offset="50%" stopColor="#FFF3B0" />
            <stop offset="100%" stopColor="#FFE082" />
          </radialGradient>
        </defs>
        {/* 광선 — 중심에서 바깥으로 */}
        {[0,45,90,135,180,225,270,315].map(a => {
          const r1 = 10.5, r2 = 15.5;
          const rad = a * Math.PI / 180;
          return <line key={a}
            x1={18+Math.cos(rad)*r1} y1={18+Math.sin(rad)*r1}
            x2={18+Math.cos(rad)*r2} y2={18+Math.sin(rad)*r2}
            stroke="#FFE082" strokeWidth="2" strokeLinecap="round"
          />;
        })}
        {/* 해 본체 */}
        <circle cx="18" cy="18" r="9" fill="url(#sun-rg)" />
        {/* 하이라이트 */}
        <ellipse cx="15.5" cy="15.5" rx="3.5" ry="2.5" fill="white" opacity="0.35" />
      </svg>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1 }}>{weather.temp}°</span>
      <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#81E4BD' }} title="UV" />
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ADEBB3' }} title="습도" />
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#98FBCB' }} title="미세먼지" />
        </div>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1 }}>{weather.location}</span>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
    </div>
  );
}

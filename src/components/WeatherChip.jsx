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

// Tabler Icons filled — mapped by emoji
export function WeatherIcon({ emoji, size = 18, color = '#ffffff' }) {
  const s = { width: size, height: size, flexShrink: 0, display: 'inline-block' };
  const p = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  // 맑음 (낮) — tabler sun
  if (emoji === '☀️') return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" /></svg>;
  // 맑음 (밤) — tabler moon
  if (emoji === '🌙') return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" /></svg>;
  // 흐림 (낮) — tabler cloud-fog (cloud + line)
  if (emoji === '⛅' || emoji === '🌤') return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M7 16a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-12" /><path d="M5 20l14 0" /></svg>;
  // 흐림 (밤) — tabler cloud
  if (emoji === '☁️') return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878" /></svg>;
  // 비 — tabler cloud-rain
  if (emoji === '🌧') return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7" /><path d="M11 13v2m0 3v2m4 -5v2m0 3v2" /></svg>;
  // 눈 — tabler cloud-snow
  if (emoji === '🌨') return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7" /><path d="M11 15v.01m0 3v.01m0 3v.01m4 -4v.01m0 3v.01" /></svg>;
  // 이슬비 — cloud-rain (lighter)
  if (emoji === '🌦') return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7" /><path d="M13 14v2m0 3v2" /></svg>;
  // 천둥번개 — tabler cloud-storm
  if (emoji === '⛈') return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1" /><path d="M13 14l-2 4l3 0l-2 4" /></svg>;
  // 안개/연무/황사 — tabler mist
  if (emoji === '🌫') return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M5 5h3m4 0h9" /><path d="M3 10h11m4 0h1" /><path d="M5 15h5m4 0h7" /><path d="M3 20h9m4 0h3" /></svg>;
  // 기본 — cloud
  return <svg style={s} viewBox="0 0 24 24" {...p}><path d="M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878" /></svg>;
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
        padding: '8px 14px 8px 0',
        background: 'transparent',
        border: 'none',
        borderRadius: '50px', cursor: 'pointer',
        boxShadow: 'none',
        marginTop: 0,
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.2s',
      }}
    >
      <WeatherIcon emoji={weather.conditionIcon} size={26} color="#ffffff" />
      <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{weather.temp}°</span>
    </div>
  );
}

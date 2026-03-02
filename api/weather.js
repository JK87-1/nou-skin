const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE = 'https://api.openweathermap.org/data/2.5';
const GEO = 'https://api.openweathermap.org/geo/1.0';

// ── In-memory cache (30 min) ──
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

function cacheKey(lat, lon) {
  return `${Math.round(lat * 100)},${Math.round(lon * 100)}`;
}

// ── KST helper: all date/time must use UTC+9 ──
function toKST(unixTimestamp) {
  // Returns a Date object adjusted to KST — use getUTC*() methods on it
  return new Date(unixTimestamp * 1000 + 9 * 3600 * 1000);
}

function nowKST() {
  return new Date(Date.now() + 9 * 3600 * 1000);
}

// ── Condition mapping ──
const CONDITION_MAP = {
  Clear: { label: '맑음', dayIcon: '☀️', nightIcon: '🌙' },
  Clouds: { label: '흐림', dayIcon: '⛅', nightIcon: '☁️' },
  Rain: { label: '비', dayIcon: '🌧', nightIcon: '🌧' },
  Snow: { label: '눈', dayIcon: '🌨', nightIcon: '🌨' },
  Drizzle: { label: '이슬비', dayIcon: '🌦', nightIcon: '🌦' },
  Thunderstorm: { label: '천둥번개', dayIcon: '⛈', nightIcon: '⛈' },
  Mist: { label: '안개', dayIcon: '🌫', nightIcon: '🌫' },
  Fog: { label: '안개', dayIcon: '🌫', nightIcon: '🌫' },
  Haze: { label: '연무', dayIcon: '🌫', nightIcon: '🌫' },
  Smoke: { label: '연무', dayIcon: '🌫', nightIcon: '🌫' },
  Dust: { label: '황사', dayIcon: '🌫', nightIcon: '🌫' },
  Sand: { label: '황사', dayIcon: '🌫', nightIcon: '🌫' },
};

function getCondition(main, isNight) {
  const entry = CONDITION_MAP[main] || { label: main, dayIcon: '🌤', nightIcon: '🌙' };
  return { label: entry.label, icon: isNight ? entry.nightIcon : entry.dayIcon };
}

function uvLabel(uv) {
  if (uv <= 2) return '낮음';
  if (uv <= 5) return '보통';
  if (uv <= 7) return '높음';
  if (uv <= 10) return '매우높음';
  return '위험';
}

function airLabel(pm10) {
  if (pm10 <= 30) return '좋음';
  if (pm10 <= 50) return '보통';
  if (pm10 <= 80) return '나쁨';
  return '매우나쁨';
}

function formatKoreanDate(ts) {
  const d = toKST(ts);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${days[d.getUTCDay()]}요일`;
}

function formatHour(ts) {
  const d = toKST(ts);
  return `${String(d.getUTCHours()).padStart(2, '0')}시`;
}

function formatDay(ts) {
  const d = toKST(ts);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[d.getUTCDay()];
}

function kstDateKey(ts) {
  const d = toKST(ts);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!API_KEY) {
    return res.status(500).json({ error: 'OPENWEATHER_API_KEY not configured' });
  }

  const lat = parseFloat(req.query.lat) || 37.5665;
  const lon = parseFloat(req.query.lon) || 126.978;

  // Check cache
  const key = cacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    // Parallel API calls (+ reverse geocoding for Korean location name)
    const [weather, air, forecast, geo] = await Promise.all([
      fetchJSON(`${BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr`),
      fetchJSON(`${BASE}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`),
      fetchJSON(`${BASE}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr`),
      fetchJSON(`${GEO}/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`).catch(() => []),
    ]);

    const now = Math.floor(Date.now() / 1000);
    const isNight = now > weather.sys.sunset || now < weather.sys.sunrise;
    const mainCondition = weather.weather?.[0]?.main || 'Clear';
    const cond = getCondition(mainCondition, isNight);

    // Air quality
    const pm10 = air.list?.[0]?.components?.pm10 || 0;
    const pm25 = air.list?.[0]?.components?.pm2_5 || 0;

    // UV estimation — use KST hour
    const kstNow = nowKST();
    const hour = kstNow.getUTCHours();
    const solarFactor = hour >= 10 && hour <= 14 ? 1.0 : hour >= 8 && hour <= 16 ? 0.6 : 0.1;
    const cloudFactor = 1 - (weather.clouds?.all || 0) / 100 * 0.7;
    const month = kstNow.getUTCMonth();
    const seasonFactor = [0.4, 0.5, 0.7, 0.85, 0.95, 1.0, 1.0, 0.95, 0.8, 0.6, 0.45, 0.35][month];
    const estimatedUV = Math.round(11 * solarFactor * cloudFactor * seasonFactor);

    // 3-hour forecast (next 5 entries)
    const forecastList = (forecast.list || []).slice(0, 5).map((f) => {
      const fNight = f.dt > weather.sys.sunset || f.dt < weather.sys.sunrise;
      const fCond = getCondition(f.weather?.[0]?.main || 'Clear', fNight);
      const fKST = toKST(f.dt);
      const fHour = fKST.getUTCHours();
      const fSolar = fHour >= 10 && fHour <= 14 ? 1.0 : fHour >= 8 && fHour <= 16 ? 0.6 : 0.1;
      const fCloud = 1 - (f.clouds?.all || 0) / 100 * 0.7;
      return {
        time: formatHour(f.dt),
        icon: fCond.icon,
        temp: Math.round(f.main.temp),
        uv: Math.round(11 * fSolar * fCloud * seasonFactor),
      };
    });

    // 5-day forecast (aggregate by day, KST-based)
    const todayKey = kstDateKey(now);
    const dayMap = new Map();
    for (const f of forecast.list || []) {
      const dayKey = kstDateKey(f.dt);
      if (dayKey === todayKey) continue;
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, { dt: f.dt, temps: [], humidity: [], condition: f.weather?.[0]?.main || 'Clear' });
      }
      const d = dayMap.get(dayKey);
      d.temps.push(f.main.temp);
      d.humidity.push(f.main.humidity);
      // Use noon condition as representative
      const h = toKST(f.dt).getUTCHours();
      if (h >= 11 && h <= 14) d.condition = f.weather?.[0]?.main || d.condition;
    }
    const weekForecast = [...dayMap.values()].slice(0, 5).map((d) => {
      const c = getCondition(d.condition, false);
      return {
        day: formatDay(d.dt),
        icon: c.icon,
        min: Math.round(Math.min(...d.temps)),
        max: Math.round(Math.max(...d.temps)),
        humidity: Math.round(d.humidity.reduce((a, b) => a + b, 0) / d.humidity.length),
      };
    });

    // Location name — prefer Korean from reverse geocoding
    let locationName = weather.name || '알 수 없음';
    if (geo && geo.length > 0) {
      const g = geo[0];
      // Try Korean name from local_names, then fall back to weather.name
      locationName = g.local_names?.ko || g.name || locationName;
    }

    const result = {
      location: locationName,
      date: formatKoreanDate(weather.dt),
      temp: Math.round(weather.main.temp),
      tempMin: Math.round(weather.main.temp_min),
      tempMax: Math.round(weather.main.temp_max),
      condition: cond.label,
      conditionIcon: cond.icon,
      humidity: weather.main.humidity,
      wind: Math.round((weather.wind?.speed || 0) * 3.6),
      uv: estimatedUV,
      uvLabel: uvLabel(estimatedUV),
      airQuality: Math.round(pm10),
      airLabel: airLabel(Math.round(pm10)),
      fineDust: Math.round(pm10),
      ultraFineDust: Math.round(pm25),
      forecast: forecastList,
      weekForecast,
    };

    // Cache result
    cache.set(key, { data: result, timestamp: Date.now() });
    // Evict old entries
    if (cache.size > 50) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) cache.delete(oldest[0]);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Weather API error:', err);
    return res.status(500).json({ error: 'Failed to fetch weather data' });
  }
}

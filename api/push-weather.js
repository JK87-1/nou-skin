// 날씨 기반 피부 관리 푸시 알림 (매시 정각 실행)
// 시간대별 알림:
//   08시 — 오늘의 피부 날씨 (항상)
//   11시 — 선크림 리마인더 (UV >= 3)
//   13시 — 선크림 덧바르기 (UV >= 3)
//   14시 — 수분 보충 (습도 < 40%)
//   18시 — 귀가 클렌징 (AQI > 50)
//   21시 — 나이트 케어 (항상)
//
// 알림 스케줄(시간·조건·문구)은 화면 표시·네이티브 알림과 공유하는 단일 소스를 사용.
import { WEATHER_NOTIFICATION_SCHEDULE as NOTIFICATION_SCHEDULE } from '../src/data/weatherNotificationSchedule.js';

function getUVLabel(uv) {
  if (uv <= 2) return '낮음';
  if (uv <= 5) return '보통';
  if (uv <= 7) return '높음';
  if (uv <= 10) return '매우 높음';
  return '위험';
}

function getAirLabel(aqi) {
  if (aqi <= 50) return '좋음';
  if (aqi <= 100) return '보통';
  if (aqi <= 150) return '나쁨';
  return '매우 나쁨';
}

async function fetchWeather(lat, lon, apiKey) {
  // Current weather
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
  const weatherRes = await fetch(weatherUrl);
  if (!weatherRes.ok) return null;
  const weather = await weatherRes.json();

  // Air quality
  const airUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
  let airQuality = 0;
  let pm25 = 0;
  try {
    const airRes = await fetch(airUrl);
    if (airRes.ok) {
      const airData = await airRes.json();
      pm25 = airData.list?.[0]?.components?.pm2_5 || 0;
      // Convert PM2.5 to AQI-like scale
      if (pm25 <= 15) airQuality = Math.round(pm25 * 50 / 15);
      else if (pm25 <= 35) airQuality = Math.round(50 + (pm25 - 15) * 50 / 20);
      else if (pm25 <= 75) airQuality = Math.round(100 + (pm25 - 35) * 50 / 40);
      else airQuality = Math.round(150 + (pm25 - 75));
    }
  } catch {}

  // UV index
  let uv = 0;
  try {
    const uvUrl = `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const uvRes = await fetch(uvUrl);
    if (uvRes.ok) {
      const uvData = await uvRes.json();
      uv = Math.round(uvData.value || 0);
    }
  } catch {
    // Fallback: estimate UV from weather data
    // If daytime and clear sky, assume moderate UV
  }

  // Try OneCall 3.0 for UV if basic UV endpoint failed
  if (uv === 0) {
    try {
      const oneCallUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,daily,alerts&units=metric&appid=${apiKey}`;
      const oneCallRes = await fetch(oneCallUrl);
      if (oneCallRes.ok) {
        const oneCallData = await oneCallRes.json();
        uv = Math.round(oneCallData.current?.uvi || 0);
      }
    } catch {}
  }

  return {
    temp: weather.main?.temp || 0,
    humidity: weather.main?.humidity || 0,
    uv,
    uvLabel: getUVLabel(uv),
    airQuality,
    airLabel: getAirLabel(airQuality),
    pm25,
  };
}

export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const webpush = (await import('web-push')).default;
    const { Redis } = await import('@upstash/redis');

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:luaskin.co@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENWEATHER_API_KEY not configured' });
    }

    const isTest = req.query.test === '1';

    const now = new Date();
    const kstHour = (now.getUTCHours() + 9) % 24;
    const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = kstDate.toISOString().split('T')[0];

    // Find matching schedule entry for current hour
    const schedule = NOTIFICATION_SCHEDULE.find((s) => s.hour === kstHour);
    if (!schedule && !isTest) {
      return res.status(200).json({ sent: 0, message: `No weather notification scheduled for hour ${kstHour}` });
    }

    const hashes = await redis.smembers('push:subs');
    if (!hashes || hashes.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No subscriptions' });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const staleHashes = [];
    const errors = [];

    // Cache weather data per location to avoid duplicate API calls
    const weatherCache = {};

    for (const hash of hashes) {
      const sub = await redis.hgetall(`push:sub:${hash}`);
      if (!sub || !sub.endpoint) {
        staleHashes.push(hash);
        continue;
      }

      // Skip if weather not enabled
      if (sub.weatherEnabled !== 'true') {
        skipped++;
        continue;
      }

      // Check lat/lon
      const lat = parseFloat(sub.weatherLat);
      const lon = parseFloat(sub.weatherLon);
      if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
        skipped++;
        continue;
      }

      // Dedup: skip if already sent this hour today
      if (!isTest) {
        if (sub.lastWeatherDate === today && sub.lastWeatherHour === String(kstHour)) {
          skipped++;
          continue;
        }
      }

      // In test mode, use hour 8 as default if no schedule matches
      const activeSchedule = schedule || NOTIFICATION_SCHEDULE[0];

      // Fetch weather (with caching by rounded lat/lon)
      const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
      if (!weatherCache[cacheKey]) {
        weatherCache[cacheKey] = await fetchWeather(lat, lon, apiKey);
      }
      const weatherData = weatherCache[cacheKey];

      if (!weatherData) {
        skipped++;
        continue;
      }

      // Check condition
      if (!isTest && !activeSchedule.condition(weatherData)) {
        skipped++;
        continue;
      }

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      const nickname = sub.nickname || '';
      const greeting = nickname ? `${nickname}님, ` : '';

      const payload = JSON.stringify({
        type: 'weather',
        title: activeSchedule.title(weatherData),
        body: `${greeting}${activeSchedule.body(weatherData)}`,
        url: '/',
      });

      try {
        await webpush.sendNotification(pushSubscription, payload);
        sent++;

        if (!isTest) {
          await redis.hset(`push:sub:${hash}`, {
            lastWeatherDate: today,
            lastWeatherHour: String(kstHour),
          });
        }
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleHashes.push(hash);
        }
        failed++;
        errors.push({ hash, status: err.statusCode, message: err.body || err.message });
      }
    }

    // Clean up stale subscriptions
    for (const hash of staleHashes) {
      await redis.del(`push:sub:${hash}`);
      await redis.srem('push:subs', hash);
    }

    return res.status(200).json({
      sent,
      failed,
      skipped,
      cleaned: staleHashes.length,
      total: hashes.length,
      kstHour,
      today,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('push-weather error:', error);
    return res.status(500).json({ error: error.message });
  }
}

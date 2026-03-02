const WEATHER_KEY = 'lua_weather_data';
const LOCATION_KEY = 'lua_weather_location';
const STALE_MS = 30 * 60 * 1000; // 30분
const CACHE_VERSION = 2; // bump to invalidate old cache

/**
 * 날씨 데이터 + 타임스탬프 저장
 */
export function saveWeatherData(data) {
  try {
    localStorage.setItem(WEATHER_KEY, JSON.stringify({
      data,
      timestamp: Date.now(),
      v: CACHE_VERSION,
    }));
  } catch {
    // storage full or unavailable
  }
}

/**
 * 캐시된 날씨 데이터 반환 (30분 이내면 캐시 사용)
 * @returns {object|null} 날씨 데이터 또는 null (캐시 만료/없음)
 */
export function getWeatherData() {
  try {
    const raw = localStorage.getItem(WEATHER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.data || !parsed.timestamp) return null;
    if (parsed.v !== CACHE_VERSION) return null; // version mismatch → stale
    if (Date.now() - parsed.timestamp > STALE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * 캐시가 30분 초과인지 확인
 * @returns {boolean} true면 갱신 필요
 */
export function isStale() {
  try {
    const raw = localStorage.getItem(WEATHER_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    if (!parsed.timestamp) return true;
    if (parsed.v !== CACHE_VERSION) return true;
    return Date.now() - parsed.timestamp > STALE_MS;
  } catch {
    return true;
  }
}

/**
 * 사용자 위치 저장
 */
export function saveUserLocation(lat, lon, name) {
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({ lat, lon, name }));
  } catch {
    // storage full or unavailable
  }
}

/**
 * 저장된 위치 반환 (없으면 null)
 * @returns {{ lat: number, lon: number, name: string }|null}
 */
export function getUserLocation() {
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.lat || !parsed.lon) return null;
    return parsed;
  } catch {
    return null;
  }
}

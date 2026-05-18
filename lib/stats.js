// Upstash Redis 기반 일일 측정 통계 헬퍼.
// Vercel은 `_` prefix 파일을 endpoint로 노출하지 않습니다.

import { Redis } from '@upstash/redis';

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return _redis;
  } catch {
    return null;
  }
}

const TTL_SECONDS = 60 * 60 * 24 * 35; // 35일 보관

export function getKstDate(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 3600000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

function key(date, suffix) {
  return `stats:${date}:${suffix}`;
}

// fire-and-forget: 응답 흐름 방해 X
export function recordRequest(date) {
  const r = getRedis();
  if (!r) return;
  (async () => {
    try {
      const k = key(date, 'requests');
      await r.incr(k);
      await r.expire(k, TTL_SECONDS);
    } catch {}
  })();
}

export function recordOutcome(date, outcome, elapsedMs) {
  const r = getRedis();
  if (!r) return;
  (async () => {
    try {
      const suffix = outcome === 'success' ? 'success'
        : outcome === 'rate_limit' ? 'rate_limit'
        : 'failures';
      const k = key(date, suffix);
      await r.incr(k);
      await r.expire(k, TTL_SECONDS);

      if (outcome === 'success' && typeof elapsedMs === 'number') {
        const tk = key(date, 'response_time_total');
        await r.incrby(tk, Math.round(elapsedMs));
        await r.expire(tk, TTL_SECONDS);
      }
    } catch {}
  })();
}

// 어제 통계 조회 (헬스체크 cron용)
export async function readDailyStats(date) {
  const r = getRedis();
  if (!r) return null;
  try {
    const [requests, success, failures, rateLimit, responseTimeTotal] = await Promise.all([
      r.get(key(date, 'requests')),
      r.get(key(date, 'success')),
      r.get(key(date, 'failures')),
      r.get(key(date, 'rate_limit')),
      r.get(key(date, 'response_time_total')),
    ]);
    const reqN = Number(requests || 0);
    const succN = Number(success || 0);
    const failN = Number(failures || 0);
    const rateN = Number(rateLimit || 0);
    const totalTime = Number(responseTimeTotal || 0);
    const avgMs = succN > 0 ? Math.round(totalTime / succN) : 0;
    const successRate = (succN + failN) > 0 ? (succN / (succN + failN)) * 100 : null;
    return {
      date,
      requests: reqN,
      success: succN,
      failures: failN,
      rateLimit: rateN,
      avgResponseMs: avgMs,
      successRate,
    };
  } catch {
    return null;
  }
}

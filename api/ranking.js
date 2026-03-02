import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// ISO week string: "2026-W09"
function getISOWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Human-readable week label: "3월 1주차 (2.24 ~ 3.02)"
function getWeekLabel() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const month = now.getMonth() + 1;
  const weekNum = Math.ceil(now.getDate() / 7);
  const fmt = (d) => `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
  return `${month}월 ${weekNum}주차 (${fmt(mon)} ~ ${fmt(sun)})`;
}

async function rotateWeekIfNeeded() {
  const currentWeek = getISOWeek();
  const storedWeek = await redis.get('ranking:week');

  if (storedWeek !== currentWeek) {
    // New week — rotate current → prev
    const currentData = await redis.hgetall('ranking:current');
    if (currentData && Object.keys(currentData).length > 0) {
      await redis.del('ranking:prev');
      // Store previous week's ranking with ranks calculated
      const prevEntries = Object.entries(currentData).map(([id, val]) => {
        const data = typeof val === 'string' ? JSON.parse(val) : val;
        return { id, ...data };
      });
      prevEntries.sort((a, b) => (b.score || 0) - (a.score || 0));
      const prevWithRanks = {};
      prevEntries.forEach((entry, i) => {
        prevWithRanks[entry.id] = JSON.stringify({ ...entry, rank: i + 1 });
      });
      if (Object.keys(prevWithRanks).length > 0) {
        await redis.hset('ranking:prev', prevWithRanks);
      }
    }
    await redis.set('ranking:week', currentWeek);
  }
}

async function buildRanking(requestDeviceId) {
  const currentData = await redis.hgetall('ranking:current');
  const prevData = await redis.hgetall('ranking:prev');

  if (!currentData || Object.keys(currentData).length === 0) {
    return { ranking: [], weekLabel: getWeekLabel(), totalUsers: 0 };
  }

  // Parse and sort
  const users = Object.entries(currentData).map(([id, val]) => {
    const data = typeof val === 'string' ? JSON.parse(val) : val;
    return { id, ...data, score: Number(data.score) || 0 };
  });
  users.sort((a, b) => b.score - a.score);

  // Assign ranks and calculate change from previous week
  const ranking = users.map((user, i) => {
    const rank = i + 1;
    let change = 0;

    if (prevData) {
      const prevEntry = prevData[user.id];
      if (prevEntry) {
        const prev = typeof prevEntry === 'string' ? JSON.parse(prevEntry) : prevEntry;
        if (prev.rank) {
          change = prev.rank - rank; // positive = moved up
        }
      }
    }

    return {
      id: user.id,
      nickname: user.nickname || '사용자',
      score: user.score,
      xp: Number(user.xp) || 0,
      level: Number(user.level) || 1,
      rank,
      change,
      isMe: user.id === requestDeviceId,
    };
  });

  return {
    ranking,
    weekLabel: getWeekLabel(),
    totalUsers: ranking.length,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await rotateWeekIfNeeded();

    if (req.method === 'POST') {
      const { deviceId, nickname, score, xp, level } = req.body;
      if (!deviceId) {
        return res.status(400).json({ error: 'deviceId required' });
      }

      // Upsert user data
      await redis.hset('ranking:current', {
        [deviceId]: JSON.stringify({
          nickname: (nickname || '사용자').slice(0, 20),
          score: Math.max(0, Math.min(100, Number(score) || 0)),
          xp: Number(xp) || 0,
          level: Number(level) || 1,
          updatedAt: new Date().toISOString(),
        }),
      });

      const result = await buildRanking(deviceId);
      return res.status(200).json(result);
    }

    if (req.method === 'GET') {
      const deviceId = req.query.deviceId || '';
      const result = await buildRanking(deviceId);
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Ranking API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Vercel Serverless Function: 클라이언트 AI fallback 즉시 알림
//
// 클라이언트 HybridAnalysis.recordAiFallback() 에서 fire-and-forget POST.
// 1시간 내 같은 IP 중복 ping은 서버 측에서 추가로 차단 (메모리 캐시).
// 노션 "09. 진행 상황" 페이지에 빨간 callout 으로 즉시 기록.

const IP_DEBOUNCE_MS = 60 * 60 * 1000; // 1시간
const IP_LAST_PING = new Map();
const MAX_CACHE_SIZE = 500;

function maskIp(ip) {
  if (!ip) return 'unknown';
  // IPv4: 마지막 옥텟 마스킹 (예: 1.2.3.x)
  const v4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  if (v4) return `${v4[1]}.x`;
  // IPv6 or other: 앞 8자만
  return ip.slice(0, 8) + '...';
}

// 캘린더 DB에 page 추가 (진행 상황 페이지 callout 노이즈 제거)
async function notifyNotion(payload) {
  const token = process.env.NOTION_TOKEN;
  const calendarDbId = process.env.NOTION_CALENDAR_DB_ID;
  if (!token || !calendarDbId) {
    console.warn('Notion calendar env missing, skip notify');
    return;
  }

  const kstNow = new Date(Date.now() + 9 * 3600000);
  const kstDate = kstNow.toISOString().slice(0, 10);
  const kstTime = kstNow.toISOString().slice(11, 16);

  const title = `[🚨 AI fallback ${kstTime}] ${payload.reason || '미상'} · ${payload.maskedIp || ''}${payload.deviceTag ? ` · ${payload.deviceTag}` : ''}`.slice(0, 100);
  const detailLines = [
    `사유: ${payload.reason || '미상'}`,
    `모드: ${payload.mode || '미상'}`,
    `사용자: ${payload.maskedIp || '미상'}${payload.deviceTag ? ` · ${payload.deviceTag}` : ''}`,
    payload.userAgent ? `환경: ${payload.userAgent.slice(0, 80)}` : null,
  ].filter(Boolean).join('\n');

  const body = {
    parent: { database_id: calendarDbId },
    icon: { type: 'emoji', emoji: '🚨' },
    properties: {
      Name: { title: [{ type: 'text', text: { content: title } }] },
      Date: { date: { start: kstDate } },
    },
    children: [{
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: detailLines } }] },
    }],
  };

  try {
    const resp = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.warn('Notion calendar notify HTTP', resp.status, t.slice(0, 200));
    }
  } catch (e) {
    console.warn('Notion calendar notify failed:', e.message || e);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

  // IP debounce — 같은 IP 1시간 내 중복 알림 차단 (클라이언트 디바운스 우회 방지)
  const now = Date.now();
  const lastPing = IP_LAST_PING.get(ip);
  if (lastPing && (now - lastPing < IP_DEBOUNCE_MS)) {
    return res.status(200).json({ ok: true, debounced: true });
  }

  // Cache size limit (간단 LRU 흉내)
  if (IP_LAST_PING.size >= MAX_CACHE_SIZE) {
    const firstKey = IP_LAST_PING.keys().next().value;
    IP_LAST_PING.delete(firstKey);
  }
  IP_LAST_PING.set(ip, now);

  const body = req.body || {};
  const payload = {
    reason: String(body.reason || '').slice(0, 100),
    mode: String(body.mode || '').slice(0, 30),
    deviceTag: String(body.deviceTag || '').slice(0, 16),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 120),
    maskedIp: maskIp(ip),
  };

  // Fire notification but don't await — return 200 fast
  notifyNotion(payload).catch(() => {});

  return res.status(200).json({ ok: true });
}

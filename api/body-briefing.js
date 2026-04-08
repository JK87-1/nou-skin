// Vercel Serverless Function: AI 바디 브리핑 (GPT-4o-mini)
// 에너지/기분/수분 + 식단 + 영양제 + 몸무게 기반 2문장 컨디션 브리핑

const RATE_LIMIT = new Map();
const MAX_REQUESTS_PER_DAY = 50;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip);
  if (!entry || now > entry.resetAt) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + 86400000 });
    return true;
  }
  if (entry.count >= MAX_REQUESTS_PER_DAY) return false;
  entry.count++;
  return true;
}

function getTimeOfDay(hour) {
  if (hour < 6) return '새벽';
  if (hour < 11) return '아침';
  if (hour < 14) return '점심';
  if (hour < 18) return '오후';
  if (hour < 22) return '저녁';
  return '밤';
}

function buildPrompt(data) {
  const { energy, mood, hydration, dietSummary, supplements, weight, previousWeight, timeOfDay } = data;

  let weightChange = '';
  if (previousWeight != null && weight != null) {
    const diff = weight - previousWeight;
    if (Math.abs(diff) >= 0.1) {
      weightChange = `\n이전 대비 몸무게 변화: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}kg`;
    } else {
      weightChange = '\n몸무게 변화 없음';
    }
  }

  const supplementText = supplements && supplements.length > 0
    ? supplements.map(s => `${s.name}: ${s.taken ? '✅' : '❌'}`).join(', ')
    : '기록 없음';

  return `당신은 사용자의 건강을 매일 함께 챙기는 따뜻한 웰니스 파트너입니다. 친한 친구처럼 다정하고 개인적인 톤으로 브리핑하세요.

[규칙]
- 정확히 2문장으로 작성
- 첫 문장: 오늘 입력된 데이터를 기반으로 컨디션 상태를 따뜻하게 요약
- 두 번째 문장: 데이터에 기반한 실천 가능한 팁 또는 응원 한마디
- "~해요" 체, 친구처럼 다정하고 개인적인 톤
- 시간대(${timeOfDay}) 맥락 자연스럽게 반영
- 매번 다른 표현과 문장 구조를 사용하세요

[슬라이더 해석 기준 — 각 값은 0~100]
에너지 70+: 활력 넘치는 상태 / 에너지 40~69: 보통 / 에너지 ~39: 피곤하거나 지친 상태
기분 70+: 기분 좋은 상태 / 기분 40~69: 무난한 하루 / 기분 ~39: 기분이 다운된 상태
수분 70+: 수분 섭취 충분 / 수분 40~69: 보통 / 수분 ~39: 수분 섭취 부족

[데이터]
에너지: ${energy ?? '미입력'} | 기분: ${mood ?? '미입력'} | 수분 섭취: ${hydration ?? '미입력'}
오늘 식단: ${dietSummary || '기록 없음'}
영양제: ${supplementText}
몸무게: ${weight != null ? weight + 'kg' : '미입력'}${weightChange}

브리핑을 작성하세요:`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { energy, mood, hydration, dietSummary, supplements, weight, previousWeight } = req.body;

    const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
    const hour = kstNow.getUTCHours();
    const timeOfDay = getTimeOfDay(hour);

    const prompt = buildPrompt({
      energy, mood, hydration, dietSummary, supplements, weight, previousWeight, timeOfDay,
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI error:', err);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const briefing = data.choices?.[0]?.message?.content?.trim() || '';

    return res.status(200).json({ briefing, timeOfDay });
  } catch (error) {
    console.error('body-briefing error:', error);
    return res.status(500).json({ error: error.message });
  }
}

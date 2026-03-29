// Vercel Serverless Function: GPT Vision food analysis

const RATE_LIMIT = new Map();
const MAX_REQUESTS_PER_DAY = 30;

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

function buildFoodPrompt() {
  return `당신은 영양사 수준의 AI 식단 분석가입니다.
사진에 있는 음식을 분석하고 다음 정보를 JSON으로 반환하세요.

분석 규칙:
1. 사진에 보이는 모든 음식을 개별 항목으로 나열하세요.
2. 각 항목에 대해 음식명, 예상 칼로리, 영양소(탄수화물/단백질/지방)를 추정하세요.
3. 한국 기준 일반적인 1인분 기준으로 추정하세요.
4. 음식이 아닌 사진이면 "notFood": true를 반환하세요.

반드시 아래 형식의 JSON만 출력하세요. 다른 텍스트 없이 ---JSON_START--- 와 ---JSON_END--- 사이에 JSON만 넣으세요.

---JSON_START---
{
  "notFood": false,
  "items": [
    {
      "name": "음식명 (한글)",
      "kcal": 숫자,
      "carb": 숫자(g),
      "protein": 숫자(g),
      "fat": 숫자(g)
    }
  ],
  "totalKcal": 숫자,
  "summary": "한줄 요약"
}
---JSON_END---`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again tomorrow.' });
  }

  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: 1000,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'You are a professional nutritionist AI. Analyze food photos and estimate nutritional values. Output JSON between ---JSON_START--- and ---JSON_END--- markers only.',
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}`, detail: 'high' } },
              { type: 'text', text: buildFoodPrompt() },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: 'API call failed', detail: errText });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    // Parse JSON from markers
    const startMarker = '---JSON_START---';
    const endMarker = '---JSON_END---';
    const startIdx = text.indexOf(startMarker);
    const endIdx = text.indexOf(endMarker);

    if (startIdx === -1 || endIdx === -1) {
      return res.status(500).json({ error: 'Failed to parse response' });
    }

    const jsonStr = text.slice(startIdx + startMarker.length, endIdx).trim();
    const result = JSON.parse(jsonStr);

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Internal error', message: err.message });
  }
}

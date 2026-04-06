// Vercel Serverless Function: GPT-5.2 Vision 제품 사진 인식

const RATE_LIMIT = new Map();
const MAX_REQUESTS_PER_DAY = 20;

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

const SYSTEM_PROMPT = '한국 스킨케어 제품 사진을 분석하여 브랜드, 제품명, 카테고리, 성분을 추출하는 전문가입니다.';

const USER_PROMPT = `이 스킨케어 제품 사진에서 정보를 추출하세요.

[추출 항목]
1. brand: 브랜드명 (한글 또는 영문, 라벨에서 가장 잘 보이는 형태)
2. name: 제품명 (한글 또는 영문, 라벨에서 가장 잘 보이는 형태)
3. category: 클렌저, 토너, 세럼, 에센스, 크림, 선크림, 마스크팩, 기타 중 하나
4. ingredients: 핵심 활성 성분 3~5개 (한글, 예: 히알루론산, 나이아신아마이드)

[규칙]
- 라벨의 텍스트를 정확히 읽으세요
- 영문 브랜드명도 괜찮습니다 (예: COSRX, Innisfree, BOH)
- 성분은 전성분표가 보이면 주요 활성 성분만 추출
- 화장품이 아니거나 판독 불가 시: brand="알 수 없음", name="알 수 없음"

반드시 아래 형식의 JSON만 출력:
---JSON_START---
{"brand":"브랜드","name":"제품명","category":"카테고리","ingredients":["성분1","성분2","성분3"]}
---JSON_END---`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '오늘 제품 인식 횟수를 초과했어요. 내일 다시 시도해주세요.' });
  }

  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: '이미지가 없습니다.' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: 500,
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}`, detail: 'high' } },
              { type: 'text', text: USER_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('OpenAI error:', response.status, errText);
      return res.status(502).json({ error: 'AI 응답 실패' });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    // JSON 파싱
    const markerMatch = text.match(/---JSON_START---\s*([\s\S]*?)\s*---JSON_END---/);
    const jsonStr = markerMatch ? markerMatch[1] : (text.match(/\{[\s\S]*?\}/) || [''])[0];

    if (!jsonStr) {
      return res.status(502).json({ error: 'AI 응답을 파싱할 수 없습니다.' });
    }

    const parsed = JSON.parse(jsonStr);
    const validCategories = ['클렌저', '토너', '세럼', '에센스', '크림', '선크림', '마스크팩', '기타'];
    if (!validCategories.includes(parsed.category)) parsed.category = '기타';

    return res.status(200).json({
      brand: parsed.brand || '알 수 없음',
      name: parsed.name || '알 수 없음',
      category: parsed.category,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.slice(0, 5) : [],
    });
  } catch (err) {
    console.error('Product recognize error:', err);
    return res.status(502).json({ error: '제품 인식에 실패했어요.' });
  }
}

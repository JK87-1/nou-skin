// Vercel Serverless Function: 제품 검색 자동완성
// 사용자가 브랜드 또는 제품명 일부를 입력하면 GPT-5.2가 한국 화장품 시장에서
// 매칭되는 대표 제품 5~8개를 추천. 직접 입력 UX 개선용.

const RATE_LIMIT = new Map();
const MAX_REQUESTS_PER_DAY = 80;

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '오늘 검색 횟수 초과' });
  }

  try {
    const { query } = req.body || {};
    const q = String(query || '').trim();
    if (q.length < 2) {
      return res.status(400).json({ error: '검색어가 너무 짧아요 (2자 이상)' });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const prompt = `한국 화장품 시장에서 "${q}" 검색어와 매칭되는 대표 제품을 찾아주세요.

규칙:
1. 검색어는 브랜드명 일부일 수도, 제품명 일부일 수도 있어요. 양쪽 모두 매칭.
2. 한국에서 실제 유통되는 제품만 (해외 직구·단종 제외).
3. 같은 브랜드라면 카테고리 다양하게 (토너·세럼·크림·선크림 등 섞어서).
4. 최대 8개. 적게 매칭되면 적게 반환 OK.
5. 알 수 없으면 빈 배열 반환. 거짓 추측 금지.

각 제품의 category는 반드시 다음 중 하나:
클렌저 · 토너 · 에센스 · 세럼 · 크림 · 선크림 · 마스크팩 · 기타

timeSlot:
- "morning" (선크림·아침 비타민C 등 아침 전용)
- "night" (레티놀·고함량 산 등 저녁 권장)
- "both" (대부분 토너·세럼·크림)

ingredients는 핵심 활성 성분 2~5개. 보존제 등 부수 성분 제외.

응답은 다음 JSON만:
{
  "products": [
    {
      "brand": "토리든",
      "name": "다이브인 저분자 히알루론산 토너",
      "category": "토너",
      "timeSlot": "both",
      "ingredients": ["저분자 히알루론산", "판테놀"],
      "volume": "150ml"
    }
  ]
}

알 수 없거나 매칭 없으면: {"products": []}`;

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: 1200,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '당신은 한국 화장품 시장 전문가입니다. 실제 유통되는 제품만 정확히 추천하고, JSON으로만 응답합니다.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      return res.status(502).json({ error: 'OpenAI 호출 실패', detail: errText.slice(0, 200) });
    }

    const data = await upstream.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    let parsed = {};
    try { parsed = JSON.parse(content); } catch {}

    const ALLOWED_CAT = new Set(['클렌저','토너','에센스','세럼','크림','선크림','마스크팩','기타']);
    const ALLOWED_SLOT = new Set(['morning','night','both']);

    const products = Array.isArray(parsed.products) ? parsed.products
      .filter(p => p && typeof p === 'object' && typeof p.brand === 'string' && typeof p.name === 'string')
      .map(p => ({
        brand: String(p.brand).trim().slice(0, 40),
        name: String(p.name).trim().slice(0, 60),
        category: ALLOWED_CAT.has(p.category) ? p.category : '기타',
        timeSlot: ALLOWED_SLOT.has(p.timeSlot) ? p.timeSlot : 'both',
        ingredients: Array.isArray(p.ingredients)
          ? p.ingredients.filter(s => typeof s === 'string').map(s => s.trim()).filter(Boolean).slice(0, 8)
          : [],
        volume: typeof p.volume === 'string' ? p.volume.trim().slice(0, 20) : '',
      }))
      .slice(0, 8)
      : [];

    return res.status(200).json({ products });
  } catch (e) {
    return res.status(500).json({ error: 'Search failed', detail: String(e?.message || e).slice(0, 200) });
  }
}

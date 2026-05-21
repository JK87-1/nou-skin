// Vercel Serverless Function: 제품 성분 자동 검색
// 브랜드 + 제품명 → GPT-5.2가 일반적으로 알려진 핵심 성분 추정.
//
// 정확도 한계: 100% 보장 X. GPT가 학습한 정보 기반 추정. 베타 자가 보강용.
// 향후 화해/네이버 쇼핑 등 외부 DB 연계 시 fallback으로 유지.

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '오늘 성분 검색 횟수 초과' });
  }

  try {
    const { brand, name, category } = req.body || {};
    if (!brand && !name) {
      return res.status(400).json({ error: 'brand 또는 name 필요' });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const productLabel = [brand, name].filter(Boolean).join(' ').trim();

    const prompt = `다음 한국 화장품의 핵심 성분을 검색·추정해주세요.

제품: ${productLabel}
${category ? `카테고리: ${category}` : ''}

요구 사항:
1. 알려진 공식 정보가 있으면 그 성분 그대로. 없으면 카테고리·브랜드 노선 기반 일반적 추정.
2. 핵심 활성 성분 5~10개만 (전체 전성분 X). 보존제·점도조절제 등 부수 성분은 생략.
3. 한국어 성분명 우선 (예: "히알루론산"). 영문 병기 필요 시 괄호로.
4. 추정인 경우 confidence "estimated" 명시. 확실하면 "known".

응답 형식 — 반드시 다음 JSON만 출력:
{
  "ingredients": ["성분1", "성분2", ...],
  "confidence": "known" | "estimated",
  "note": "한 줄 설명 (선택)"
}`;

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: 600,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '당신은 한국 화장품 성분 전문가입니다. JSON으로만 응답하세요.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: '성분 검색 실패' });
    }

    const data = await upstream.json();
    const text = data.choices?.[0]?.message?.content || '';
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}
    if (!parsed || !Array.isArray(parsed.ingredients)) {
      // fallback: 텍스트에서 한국어 성분 추출
      const match = text.match(/"ingredients"\s*:\s*\[([^\]]+)\]/);
      if (match) {
        const items = match[1].split(',').map(s => s.replace(/["']/g, '').trim()).filter(Boolean);
        parsed = { ingredients: items, confidence: 'estimated', note: 'JSON parse fallback' };
      } else {
        return res.status(502).json({ error: '성분 파싱 실패' });
      }
    }

    res.status(200).json({
      product: productLabel,
      ingredients: parsed.ingredients.slice(0, 12),
      confidence: parsed.confidence === 'known' ? 'known' : 'estimated',
      note: parsed.note || '',
    });
  } catch (error) {
    console.error('product-ingredients error:', error);
    res.status(500).json({ error: error.message });
  }
}

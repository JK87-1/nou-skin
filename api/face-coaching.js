/**
 * /api/face-coaching — 얼굴형·비율 기반 메이크업·헤어 AI 코칭
 *
 * 입력: FaceProportion.analyzeProportion() 결과 객체
 * 출력: makeup·hair·eyebrow·accent 객체 (JSON)
 *
 * 의료 행위·시술 추천 X. 외모 코칭(메이크업·헤어) 한정.
 * 텍스트만 사용해 빠르고 저렴 (이미지 호출 X).
 */

const MODEL = 'gpt-5.2';
const AI_TIMEOUT_MS = 18000;
const MAX_RATE_PER_DAY = 30;
const RATE_BUCKET = new Map();

function checkRate(ip, today) {
  const key = `${ip}:${today}`;
  const n = RATE_BUCKET.get(key) || 0;
  if (n >= MAX_RATE_PER_DAY) return false;
  RATE_BUCKET.set(key, n + 1);
  return true;
}

function buildPrompt(proportion) {
  const p = proportion || {};
  const shape = p.shape || {};
  return `당신은 한국에서 활동하는 시니어 메이크업 아티스트이자 헤어스타일리스트입니다.
다음 얼굴 분석 결과를 보고, **메이크업·헤어·아이브로우 코칭**만 제공하세요.
의료 행위·시술 추천·외모 비하는 절대 금지. 이미 균형 잡힌 부분은 칭찬하고, 보완 영역은 부드럽게 안내.

[얼굴 분석]
- 얼굴형: ${shape.label || '미분류'} (${shape.type || 'unknown'})
  - 얼굴 높이/폭 비율: ${shape.heightWidth ?? '-'} (이상 1.4~1.5)
  - 광대 폭: ${shape.cheekboneWidth ?? '-'}, 이마 폭: ${shape.foreheadWidth ?? '-'}, 턱 폭: ${shape.jawWidth ?? '-'}
- 삼정(세로 3등분): 상정 ${p.thirds?.upper}% / 중정 ${p.thirds?.middle}% / 하정 ${p.thirds?.lower}% (이상 33.33%/each, 균형 ${p.thirds?.balance}/100)
- 오등분(가로): 얼굴폭/눈폭 비율 ${p.fifths?.ratio} (이상 5.0), 눈 간격/눈 폭 ${p.fifths?.eyeGapRatio} (이상 1.0)
- 황금비: ${p.golden?.ratio} (이상 1.618)
- 좌우 대칭: ${p.symmetry}/100

[출력 JSON 스키마 — 반드시 ---JSON_START--- 와 ---JSON_END--- 사이에 출력]
{
  "shapeInsight": "얼굴형 특징 1~2문장 (긍정 톤, 60자 내외)",
  "makeup": {
    "base": "베이스·파운데이션 톤·하이라이트 위치 (60~90자)",
    "contouring": "쉐이딩 위치·강도 (얼굴형에 맞춘 구체 부위, 60~90자)",
    "eye": "아이섀도·아이라인·속눈썹 방향 (눈 모양·간격 반영, 60~90자)",
    "blush": "블러셔 위치·색감 (광대 위치 반영, 50~80자)",
    "lip": "립 컬러·바르는 모양 (50~80자)"
  },
  "hair": {
    "best": ["추천 헤어스타일 2~3개 (각 15자 내외)"],
    "avoid": ["피하면 좋은 스타일 1~2개 (각 15자 내외)"],
    "rationale": "왜 이 스타일이 어울리는지 (얼굴형 근거, 80~120자)"
  },
  "eyebrow": {
    "shape": "추천 눈썹 모양 (예: '아치형', '일자형', '둥근 아치') (10자)",
    "tip": "그릴 때 핵심 팁 (50~80자)"
  },
  "accent": "오늘 시도해보면 좋은 한 가지 핵심 포인트 (40~60자)"
}

톤: 친근하고 구체적, 30대 한국 여성 사용자에게 말하듯. "~해보세요" 어조.
주의: 단정하지 말고 "어울립니다", "추천드려요" 같은 부드러운 표현.
설명·주석 없이 JSON만 출력.`;
}

async function callCoaching(apiKey, proportion) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a senior Korean makeup artist and hair stylist providing styling coaching (not medical advice). Output only the JSON between ---JSON_START--- and ---JSON_END--- markers, no extra text.',
          },
          { role: 'user', content: buildPrompt(proportion) },
        ],
        temperature: 0.55,
        max_completion_tokens: 1400,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error(`[face-coaching] OpenAI ${resp.status}: ${errText.slice(0, 200)}`);
      return null;
    }
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content || '';
    const marked = raw.match(/---JSON_START---([\s\S]*?)---JSON_END---/);
    let jsonStr = marked ? marked[1].trim() : (raw.match(/\{[\s\S]*\}/)?.[0] || '');
    if (!jsonStr) return null;
    try { return JSON.parse(jsonStr); } catch { return null; }
  } catch (e) {
    clearTimeout(timer);
    console.error('[face-coaching] error:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const today = new Date().toISOString().slice(0, 10);
    if (!checkRate(ip, today)) return res.status(429).json({ error: 'Rate limit exceeded. Try again tomorrow.' });

    const { proportion } = req.body || {};
    if (!proportion || !proportion.shape) return res.status(400).json({ error: 'proportion 객체가 필요합니다.' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    // 1회 시도 + 실패 시 1회 재시도
    let result = await callCoaching(apiKey, proportion);
    if (!result) result = await callCoaching(apiKey, proportion);
    if (!result) return res.status(502).json({ error: 'AI coaching generation failed' });

    return res.status(200).json({ content: [{ text: JSON.stringify(result) }] });
  } catch (e) {
    console.error('[face-coaching] handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}

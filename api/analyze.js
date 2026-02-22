// Vercel Serverless Function: OpenAI GPT-5.2 Vision skin analysis proxy
// Keeps OPENAI_API_KEY server-side only

const RATE_LIMIT = new Map(); // IP -> { count, resetAt }
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

function buildSkinPrompt(cvData) {
  return `당신은 피부과 전문의 수준의 AI 피부 분석가입니다.

첨부된 셀카의 피부 상태를 분석하세요.

컴퓨터 비전 사전 측정 (참고용, 당신의 시각적 판단이 우선):
- 수분 점수: ${cvData?.moisture?.avgScore?.toFixed(1) ?? 'N/A'}
- ITA° 피부톤 밝기: ${cvData?.labL?.toFixed(1) ?? 'N/A'}
- 적색 비율: ${((cvData?.redRatio ?? 0) * 100).toFixed(1)}%
- T/U존 광택: ${cvData?.tzoneShine?.toFixed(3) ?? 'N/A'} / ${cvData?.uzoneShine?.toFixed(3) ?? 'N/A'}
- 주름 에지 에너지: ${cvData?.wrinkle?.overall?.toFixed(1) ?? 'N/A'}
- 모공 분산: ${cvData?.pore?.overall?.toFixed(0) ?? 'N/A'}
- 턱선 에지: ${cvData?.elasticity?.overall?.toFixed(1) ?? 'N/A'}
- 색소 패널티: ${cvData?.pigmentation?.overallPenalty?.toFixed(2) ?? 'N/A'}
- 피부결 에너지 (mid): ${cvData?.texture?.overallMid?.toFixed(1) ?? 'N/A'}
- 다크서클 심각도: ${cvData?.darkCircle?.overall?.toFixed(3) ?? 'N/A'}

10개 지표를 각각 0~100점으로 평가하세요. 반드시 아래 JSON 형식만 응답:
{
  "moisture": 0~100,
  "skinTone": 0~100,
  "troubleCount": 정수 (0~20),
  "oilBalance": 0~100 (50=균형),
  "wrinkleScore": 0~100,
  "poreScore": 0~100,
  "elasticityScore": 0~100,
  "pigmentationScore": 0~100,
  "textureScore": 0~100,
  "darkCircleScore": 0~100,
  "skinAge": 정수 (10~65),
  "confidence": 0~100,
  "notes": "한국어 2줄 요약"
}`;
}

export default async function handler(req, res) {
  // CORS
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
    const { image, cvData } = req.body;

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
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${image}`,
                detail: 'high',
              },
            },
            {
              type: 'text',
              text: buildSkinPrompt(cvData),
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI API error:', response.status, errText);
      return res.status(502).json({ error: 'AI API error', status: response.status });
    }

    const data = await response.json();

    // Transform OpenAI response to match the format HybridAnalysis.js expects:
    // { content: [{ text: "..." }] }
    const aiText = data.choices?.[0]?.message?.content || '';
    res.status(200).json({ content: [{ text: aiText }] });
  } catch (error) {
    console.error('analyze handler error:', error);
    res.status(500).json({ error: error.message });
  }
}

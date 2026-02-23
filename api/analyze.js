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

const SKIN_PROMPT = `당신은 피부과 전문의 수준의 AI 피부 분석가입니다.

첨부된 셀카를 보고 피부 상태를 아래 채점 기준표에 따라 분석하세요.
오직 사진만 보고 판단하십시오.

## 채점 기준표 (각 지표 0~100, 높을수록 좋음):

**moisture (수분도):** 피부 표면 광택·촉촉함 관찰. 각질 들뜸=30이하, 약간 건조=40~55, 정상=55~75, 촉촉=75~90.
**skinTone (피부톤 균일도):** 얼굴 전체 색상 균일성. 뚜렷한 얼룩=30이하, 부분 불균일=40~60, 대체로 균일=60~80, 매우 균일=80~95.
**troubleCount (트러블 개수):** 염증성 여드름·뾰루지만 카운트. 잡티·기미 제외. 실제 보이는 개수를 정수로.
**oilBalance (유수분 밸런스):** 50=이상적 균형. T존 번들거림=70~85, 극도 지성=85+, 건조=30이하.
**wrinkleScore (주름):** 이마·눈가·팔자주름 관찰. 뚜렷한 깊은주름=25~40, 잔주름=50~65, 거의없음=75~95.
**poreScore (모공):** 코·볼 모공 크기. 육안확인 뚜렷=25~40, 약간보임=50~65, 거의안보임=75~95.
**elasticityScore (탄력):** 턱선·볼 처짐 정도. 뚜렷한 처짐=25~40, 약간 느슨=50~65, 탄탄함=75~95.
**pigmentationScore (색소침착):** 기미·잡티·검버섯. 넓은 범위=25~40, 부분적=50~65, 거의없음=75~95.
**textureScore (피부결):** 피부 표면 매끄러움. 거칠고 울퉁불퉁=25~40, 약간 거침=50~65, 매끈함=75~95.
**darkCircleScore (다크서클):** 눈 밑 어두움. 진한 색소형=25~40, 약간 어두움=50~65, 밝고 깨끗=75~95.
**skinAge:** 피부 나이 (실제 나이 아닌 피부 상태 기반, 10~65 정수).
**confidence:** 분석 신뢰도 — 조명·각도·해상도·얼굴 크기 고려 (0~100 정수).

## 규칙:
1. 조명이 과도하게 밝거나 어두우면 confidence를 낮추세요.
2. 정확한 정수를 주세요 (예: 63, 71, 48). 5 단위 반올림 금지.

반드시 아래 JSON 형식만 응답 (다른 텍스트 없이 JSON만):
{
  "moisture": 정수,
  "skinTone": 정수,
  "troubleCount": 정수,
  "oilBalance": 정수,
  "wrinkleScore": 정수,
  "poreScore": 정수,
  "elasticityScore": 정수,
  "pigmentationScore": 정수,
  "textureScore": 정수,
  "darkCircleScore": 정수,
  "skinAge": 정수,
  "confidence": 정수,
  "notes": "한국어 2줄 요약"
}`;

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
        max_completion_tokens: 800,
        temperature: 0,
        top_p: 1,
        seed: 12345,
        messages: [
          {
            role: 'system',
            content: 'You are a dermatologist-level AI skin analyzer. Always output ONLY valid JSON with no markdown fencing, no commentary. Be deterministic: identical images must produce identical scores.',
          },
          {
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
                text: SKIN_PROMPT,
              },
            ],
          },
        ],
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

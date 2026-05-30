/**
 * /api/skin-future — "케어 후 예상 피부" 시각화
 *
 * 입력: 정면 사진 base64 + 현재 측정 메트릭
 * 출력: AI가 생성한 "3개월 꾸준한 케어 후" 가상 이미지 (PNG base64)
 *
 * 의료 행위·시술 결과 시뮬레이션 X. 케어(보습·자외선·꾸준한 관리)의 일반 효과만.
 * 메이크업·헤어·표정·정체성은 변경 금지.
 *
 * 모델: gpt-image-1 (Responses API + image_generation tool로 reference 이미지 + 편집 prompt)
 * 비용·속도 추정: 1장당 ~₩40~80, 10~30초.
 */

const AI_TIMEOUT_MS = 90000;
const MAX_RATE_PER_DAY = 10;
const RATE_BUCKET = new Map();

function checkRate(ip, today) {
  const key = `${ip}:${today}`;
  const n = RATE_BUCKET.get(key) || 0;
  if (n >= MAX_RATE_PER_DAY) return false;
  RATE_BUCKET.set(key, n + 1);
  return true;
}

function buildEditPrompt(metrics) {
  const m = metrics || {};
  const improvements = [];

  // 약한 점수일수록 더 개선폭 명시 (보수적으로)
  if (typeof m.skinTone === 'number' && m.skinTone < 70) improvements.push('피부톤을 보다 균일하게 정돈');
  if (typeof m.moisture === 'number' && m.moisture < 70) improvements.push('수분감 있는 자연스러운 윤기');
  if (typeof m.pigmentation === 'number' && m.pigmentation < 75) improvements.push('잡티·색소를 30~50% 옅게');
  if (typeof m.troubleCount === 'number' && m.troubleCount > 2) improvements.push('트러블·여드름을 60% 정도 가라앉힘');
  if (typeof m.pores === 'number' && m.pores < 70) improvements.push('모공을 미세하게 작게');
  if (typeof m.redness === 'number' && m.redness < 70) improvements.push('붉은기·홍조 진정');
  if (typeof m.darkCircles === 'number' && m.darkCircles < 70) improvements.push('다크서클 살짝 옅게');
  if (typeof m.texture === 'number' && m.texture < 70) improvements.push('피부결을 매끄럽게');

  if (improvements.length === 0) improvements.push('전반적으로 살짝 더 건강한 피부 상태');

  return `이 사람의 "3개월 동안 꾸준한 스킨케어 후" 예상 모습을 자연스럽게 재현해주세요.

[필수 — 변경 금지]
- 인물 정체성·얼굴 골격·이목구비·표정·시선·자세
- 헤어스타일·헤어 컬러
- 메이크업 유무·메이크업 컬러
- 의상·배경·조명·구도
- 사진의 색온도·전반적 톤

[개선할 부분 — 자연스럽게]
${improvements.map((s, i) => `${i + 1}) ${s}`).join('\n')}

[톤]
- 과장된 보정 절대 금지. 필터·뷰티 앱 처리 느낌 금지.
- "꾸준한 관리로 얻을 수 있는 현실적인 변화" 수준.
- 피부 텍스처(모공·솜털)는 살짝 보존되어야 자연스러움.
- 의료 시술 결과(코·턱·얼굴형 변형)는 절대 X.

결과: 같은 사람이 3개월 후 거울 앞에서 본 모습. 사실적·자연스러움.`;
}

async function callImageEdit(apiKey, imageBase64, metrics) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    // Responses API + image_generation tool — input_image를 reference로 받고 prompt에 따라 편집 생성
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.2',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: buildEditPrompt(metrics) },
              { type: 'input_image', image_url: `data:image/jpeg;base64,${imageBase64}` },
            ],
          },
        ],
        tools: [{ type: 'image_generation', quality: 'high', size: '1024x1024' }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error(`[skin-future] OpenAI ${resp.status}: ${errText.slice(0, 300)}`);
      return { ok: false, status: resp.status, error: errText.slice(0, 300) };
    }

    const data = await resp.json();
    // Responses API의 output 배열에서 image_generation 결과 추출
    const imageOutput = (data?.output || []).find(o => o.type === 'image_generation_call');
    const b64 = imageOutput?.result;
    if (!b64) {
      console.error('[skin-future] image_generation result missing in response');
      return { ok: false, status: 502, error: 'no_image_in_response' };
    }
    return { ok: true, imageBase64: b64 };
  } catch (e) {
    clearTimeout(timer);
    console.error('[skin-future] error:', e.message);
    return { ok: false, status: 504, error: e.message };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    const today = new Date().toISOString().slice(0, 10);
    if (!checkRate(ip, today)) return res.status(429).json({ error: 'Rate limit exceeded. Try again tomorrow.' });

    const { image, metrics } = req.body || {};
    if (!image) return res.status(400).json({ error: '이미지(image base64)가 필요합니다.' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    let result = await callImageEdit(apiKey, image, metrics);
    if (!result.ok) {
      // 1회 재시도 (network 일시 오류 대응)
      console.log('[skin-future] retrying...');
      result = await callImageEdit(apiKey, image, metrics);
    }
    if (!result.ok) {
      return res.status(result.status || 502).json({ error: result.error || 'Image generation failed' });
    }

    return res.status(200).json({ imageBase64: result.imageBase64 });
  } catch (e) {
    console.error('[skin-future] handler error:', e);
    return res.status(500).json({ error: e.message });
  }
}

// Vercel: 이미지 생성은 오래 걸려 timeout 늘림 (Fluid Compute 기본 300s)
export const config = {
  maxDuration: 120,
};

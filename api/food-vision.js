// Vercel Serverless Function: GPT Vision-based food nutrition analysis from photo

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You are a Korean nutritionist. Analyze the food in the photo and estimate nutritional values for Korean portion sizes. Output ONLY valid JSON between ---JSON_START--- and ---JSON_END--- markers.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `이 음식 사진을 분석해서 영양 정보를 알려주세요.

vitamin: 1일 권장 비타민 섭취량 대비 이 음식이 제공하는 비율(%)
mineral: 1일 권장 미네랄 섭취량 대비 이 음식이 제공하는 비율(%)
fiber: 식이섬유 (g)
calcium: 칼슘 (mg)
iron: 철분 (mg)
sugar: 당류 (g)
bloodSugar: 식후 혈당 상승 예상 정도 ("낮음"/"보통"/"높음")
bloodSugarNote: 혈당 관련 한줄 설명
drowsiness: 식후 졸림 확률 ("낮음"/"보통"/"높음")
drowsinessNote: 졸림 관련 한줄 설명
skinImpact: 피부 트러블 영향 ("좋음"/"보통"/"주의")
skinImpactNote: 피부 영향 한줄 설명
tags: 이 음식의 특성을 나타내는 키워드 2~4개 (배열)

---JSON_START---
{
  "name": "인식된 음식명 (한글)",
  "servings": 1,
  "kcal": 숫자,
  "carb": 숫자(g),
  "protein": 숫자(g),
  "fat": 숫자(g),
  "vitamin": 숫자(%),
  "mineral": 숫자(%),
  "fiber": 숫자(g),
  "calcium": 숫자(mg),
  "iron": 숫자(mg),
  "sugar": 숫자(g),
  "bloodSugar": "낮음/보통/높음",
  "bloodSugarNote": "한줄 설명",
  "drowsiness": "낮음/보통/높음",
  "drowsinessNote": "한줄 설명",
  "skinImpact": "좋음/보통/주의",
  "skinImpactNote": "한줄 설명",
  "tags": ["키워드1", "키워드2", "키워드3"]
}
---JSON_END---`,
              },
              {
                type: 'image_url',
                image_url: { url: image, detail: 'low' },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'API call failed' });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

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

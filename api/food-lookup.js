// Vercel Serverless Function: GPT text-based + vision-based food nutrition lookup

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, servings = 1, image } = req.body;
    if (!name && !image) return res.status(400).json({ error: 'No food name or image provided' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const nutritionFields = `vitamin: 1일 권장 비타민 섭취량 대비 이 음식이 제공하는 비율(%)
mineral: 1일 권장 미네랄 섭취량 대비 이 음식이 제공하는 비율(%)
fiber: 식이섬유 (g)
calcium: 칼슘 (mg)
iron: 철분 (mg)
sugar: 당류 (g)
bloodSugar: 식후 혈당 상승 예상 정도 ("낮음"/"보통"/"높음")
bloodSugarNote: 혈당 관련 한줄 설명 (예: "통곡물이라 혈당이 천천히 올라요")
drowsiness: 식후 졸림 확률 ("낮음"/"보통"/"높음")
drowsinessNote: 졸림 관련 한줄 설명 (예: "탄수화물 비중이 높아 졸릴 수 있어요")
skinImpact: 피부 트러블 영향 ("좋음"/"보통"/"주의")
skinImpactNote: 피부 영향 한줄 설명 (예: "기름진 음식이라 피지 분비가 증가할 수 있어요")
tags: 이 음식의 특성을 나타내는 키워드 2~4개 (배열)
  - 식품 특성: "항염 식품", "오메가3 풍부", "발효 식품", "고단백", "저칼로리"
  - 몸 반응 예측: "혈당 안정 예상", "포만감 지속", "소화 부담 적음", "빠른 에너지 공급"
  - 식사 패턴: "가벼운 식사", "든든한 한 끼", "단일 식품 위주", "균형 잡힌 구성"
  - 컨디션 연결: "피부 수분에 좋음", "뇌 기능 지원", "면역력 도움", "장 건강에 좋음"
ingredients: 사진에 보이는 음식의 개별 재료 목록 (배열). 각 재료는 { "name": "재료명", "amount": "양(단위포함, 예: 120g, 2조각, 350ml)", "carb": 숫자(g), "protein": 숫자(g), "fat": 숫자(g) }`;

    const jsonTemplate = `---JSON_START---
{
  "name": "음식명 (한글)",
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
  "tags": ["키워드1", "키워드2", "키워드3"],
  "ingredients": [{"name": "재료명", "amount": "120g", "carb": 숫자, "protein": 숫자, "fat": 숫자}]
}
---JSON_END---`;

    let messages;
    if (image) {
      // Vision mode: analyze food from photo
      messages = [
        {
          role: 'system',
          content: 'You are a Korean nutritionist. Analyze the food in the photo and estimate nutritional values for Korean portion sizes. Output ONLY valid JSON between ---JSON_START--- and ---JSON_END--- markers.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `이 음식 사진을 분석해서 영양 정보를 알려주세요.\n\n${nutritionFields}\n\n${jsonTemplate}` },
            { type: 'image_url', image_url: { url: image, detail: 'low' } },
          ],
        },
      ];
    } else {
      // Text mode: analyze food by name
      messages = [
        {
          role: 'system',
          content: 'You are a Korean nutritionist. Given a food name and servings, return accurate nutritional estimates for Korean portion sizes. Output ONLY valid JSON between ---JSON_START--- and ---JSON_END--- markers.',
        },
        {
          role: 'user',
          content: `음식: "${name}" ${servings}인분의 영양 정보를 분석해주세요.\n\n${nutritionFields}\n\n${jsonTemplate}`,
        },
      ];
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: 1200,
        temperature: 0.2,
        messages,
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

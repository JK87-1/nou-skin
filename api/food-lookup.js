// Vercel Serverless Function: GPT text-based + vision-based food nutrition lookup

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, servings = 1, image, hint, portion } = req.body;
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
ingredients: 사진에 보이는 음식의 개별 재료 목록 (배열). 각 재료는 { "name": "재료명", "amount": "수량 단위 · 중량 (예: 2조각 · 30g, 1컵 · 200ml, 1줌 · 40g)", "kcal": 숫자, "carb": 숫자(g), "protein": 숫자(g), "fat": 숫자(g) }
  - name 규칙: 2~4글자의 세련되고 직관적인 표현. 괄호 설명 절대 금지. 슬래시(/) 금지. 해당 요리의 원래 문화권에서 사용하는 정확한 용어를 사용할 것 (일식은 일식 용어, 중식은 중식 용어, 양식은 양식 용어). 예: "다시/차 국물" → "녹차 육수", "밥(흰쌀)" → "흰밥", "구운 연어" → "구운 연어", "김가루" → "김가루", "간장/소금" → "간장"`;


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
  "ingredients": [{"name": "재료명", "amount": "4조각 · 40g", "kcal": 정수, "carb": 정수, "protein": 정수, "fat": 정수}]
}
---JSON_END---`;

    let messages;
    if (image) {
      // Vision mode: analyze food from photo
      messages = [
        {
          role: 'system',
          content: 'You are an expert food analyst and nutritionist with encyclopedic knowledge of cuisines worldwide — Korean, Japanese, Chinese, Western, Southeast Asian, and more. First, accurately identify what the food actually is without any bias toward a specific cuisine. A Japanese ochazuke should be identified as ochazuke, not as Korean porridge. A Thai pad thai should be identified as pad thai, not as Korean japchae. Always prioritize correct identification over assumption. Then estimate realistic portion sizes and calculate nutritional values. Food names should be written in Korean (e.g. 오차즈케, 파스타, 팟타이). If multiple dishes are visible, combine them into one analysis. Output ONLY valid JSON between ---JSON_START--- and ---JSON_END--- markers.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `이 음식 사진을 정밀하게 분석해주세요. 음식의 정확한 종류를 먼저 파악하세요 (한식, 일식, 중식, 양식 등 편견 없이). 사진에 보이는 모든 음식과 음료를 빠짐없이 식별하고, 각 재료의 양을 현실적으로 추정해주세요.${hint ? `\n\n사용자 힌트: 이 음식은 "${hint}"입니다. 이 정보를 참고하여 정확히 식별해주세요.` : ''}${portion && portion !== '전체' ? `\n\n중요: 사용자가 사진에 보이는 음식의 ${portion}만 먹었습니다. 전체 양을 먼저 파악한 뒤, ${portion}에 해당하는 양과 영양소만 계산해주세요.` : ''}\n\n중요 - 양 추정 규칙:\n- 사진에 실제로 보이는 양만 추정. 과대 추정 절대 금지. 애매하면 항상 적은 쪽으로.\n- 요거트볼의 요거트는 보통 100~120g 수준. 150g 이상은 거의 없음.\n- 토핑 과일은 장식용이므로 소량임. 딸기 조각 4개면 약 30~40g, 블루베리 몇 알이면 1스푼(10g) 수준.\n- 토핑류(그래놀라, 견과류)는 1줌(25~30g) 수준이 일반적.\n- 사진에 없는 재료를 추측하여 추가하지 말 것. 보이는 것만 분석.\n- 얼음, 물, 소금 등 0kcal 재료는 ingredients에 포함하지 말 것.\n- 사진에 여러 음식이 있을 경우 음식당 주요 재료 최대 5개만 표기.\n\namount 표기 규칙:\n- 직관적이고 실생활에서 쓰는 단위 사용: "1스푼", "1줌", "1컵", "4조각" 등\n- "약 12알", "약 3/4컵" 같은 애매한 표현 금지\n- 칼로리와 영양소는 정수로 표기 (소수점 없이)\n\n${nutritionFields}\n\n${jsonTemplate}` },
            { type: 'image_url', image_url: { url: image, detail: 'high' } },
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
        temperature: 0,
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(500).json({ error: 'API call failed', status: response.status, detail: errBody });
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

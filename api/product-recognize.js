// Vercel Serverless Function: GPT Vision product recognition

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'No image provided' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `한국 스킨케어 제품 라벨 인식 전문가. 사진 속 제품을 분석해 JSON으로 응답.

필수 규칙 (모든 출력은 한국어):
- brand: 반드시 **한국어 표기**로 출력.
  - 한국 브랜드면 한국 정식 표기 (예: "토리든", "코스알엑스", "닥터자르트")
  - 해외 브랜드면 **한국 공식 마케팅 표기**로 (예: "La Roche-Posay"→"라로슈포제", "CeraVe"→"세라비", "The Ordinary"→"디 오디너리", "Estée Lauder"→"에스티 로더", "SK-II"→"SK-II", "Kiehl's"→"키엘", "Bioderma"→"바이오더마", "Cetaphil"→"세타필", "Avene"→"아벤느", "Eucerin"→"유세린", "Anessa"→"아네사", "Curel"→"큐렐", "Hada Labo"→"하다라보")
  - 한국 공식 표기가 없으면 한국어 음역 표기. **로마자 알파벳 절대 출력 X** (SK-II처럼 약자만 있는 경우 예외).
- name: 제품명 **한국어**로. 영문 라벨이어도 한국 정식 출시명이 있으면 그것 우선, 없으면 한국어 음역. 용량(50ml 등)은 제외.
- category: 다음 중 정확히 하나 — [클렌저, 토너, 에센스, 세럼, 크림, 선크림, 마스크팩, 기타]
- ingredients: 핵심 성분 한국어 배열, 최대 5개 (예: ["히알루론산", "나이아신아마이드", "센텔라"])

라벨이 흐릿하거나 가려져 인식 불가 시 brand/name "알 수 없음" 반환.
응답은 오직 valid JSON, 코드블록·설명 없음.`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: '이 제품을 한국어 표기로 인식해주세요. 영문 라벨이어도 한국 공식 표기로 변환해서 답해주세요.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}`, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI error:', err);
      return res.status(502).json({ error: 'AI recognition failed' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      result = { brand: '알 수 없음', name: '알 수 없음', category: '기타', ingredients: [] };
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Product recognize error:', err);
    return res.status(500).json({ error: 'Recognition failed' });
  }
}

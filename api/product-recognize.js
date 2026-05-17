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
            content: `You are a skincare product recognition assistant. Analyze the product image and return JSON with:
- brand: brand name in Korean (or original if not Korean)
- name: product name in Korean (or original)
- category: one of [클렌저, 토너, 에센스, 세럼, 앰플, 크림, 선크림, 마스크, 기타]
- ingredients: array of key ingredient names in Korean (max 5)

If you cannot identify the product, return brand and name as "알 수 없음".
Return ONLY valid JSON, no markdown.`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: '이 화장품 제품을 인식해주세요.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}`, detail: 'low' } },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
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

// Vercel Serverless Function: GPT text-based food nutrition lookup

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, servings = 1 } = req.body;
    if (!name) return res.status(400).json({ error: 'No food name provided' });

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
        max_completion_tokens: 500,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You are a Korean nutritionist. Given a food name and servings, return accurate nutritional estimates for Korean portion sizes. Output ONLY valid JSON between ---JSON_START--- and ---JSON_END--- markers.',
          },
          {
            role: 'user',
            content: `음식: "${name}" ${servings}인분의 영양 정보를 알려주세요.

---JSON_START---
{
  "name": "음식명 (한글)",
  "servings": ${servings},
  "kcal": 숫자,
  "carb": 숫자(g),
  "protein": 숫자(g),
  "fat": 숫자(g)
}
---JSON_END---`,
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

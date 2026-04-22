/**
 * 혈당 그래프 이미지 분석 API
 * GPT-4o Vision으로 혈당 그래프에서 시간대별 수치 추출
 */

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
        model: 'gpt-4o',
        max_completion_tokens: 1500,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: `You are a medical data extraction AI. Analyze blood sugar (glucose) graph images and extract time-based readings.

Output ONLY valid JSON between ---JSON_START--- and ---JSON_END--- markers.

JSON format:
{
  "readings": [
    { "time": "06:00", "value": 95 },
    { "time": "08:00", "value": 142 },
    ...
  ],
  "unit": "mg/dL",
  "date": "2026-04-22 or null if not visible",
  "source": "device name if visible, else null"
}

Rules:
- Extract ALL visible data points from the graph
- Time format: "HH:MM" (24-hour)
- Values in mg/dL (convert from mmol/L if needed: multiply by 18)
- If the graph shows continuous data, sample every 30-60 minutes at key points (peaks, valleys, meals)
- Include at minimum: lowest point, highest point, and all major inflection points
- Sort readings by time ascending
- If you cannot read the graph clearly, return {"readings": [], "error": "Unable to read graph"}`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: '이 혈당 그래프 이미지에서 시간대별 혈당 수치를 추출해주세요.' },
              { type: 'image_url', image_url: { url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `OpenAI API error: ${response.status}`, detail: errText });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    // Parse JSON from markers
    const startMarker = '---JSON_START---';
    const endMarker = '---JSON_END---';
    const startIdx = text.indexOf(startMarker);
    const endIdx = text.indexOf(endMarker);

    let result;
    if (startIdx >= 0 && endIdx > startIdx) {
      const jsonStr = text.slice(startIdx + startMarker.length, endIdx).trim();
      result = JSON.parse(jsonStr);
    } else {
      // Try parsing the whole response as JSON
      const jsonMatch = text.match(/\{[\s\S]*"readings"[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(422).json({ error: 'Could not parse graph data', raw: text });
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

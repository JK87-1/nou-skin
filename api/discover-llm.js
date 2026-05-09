// Vercel Serverless Function: Weekly Discover Page LLM generation
// POST /api/discover-llm
// Body: { system, user } → OpenAI API → discover page JSON

const RATE_LIMIT = new Map();
const MAX_REQUESTS_PER_DAY = 20; // per IP

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const { system, user } = req.body || {};
  if (!system || !user) return res.status(400).json({ error: 'system and user prompts required' });

  try {
    const startTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano',
        max_tokens: 3000,
        temperature: 0.7,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI API error:', response.status, errText);
      return res.status(502).json({ error: 'LLM API error', status: response.status });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const durationMs = Date.now() - startTime;

    const usage = {
      promptTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      durationMs,
    };

    // Parse JSON object from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'No JSON in LLM response', raw: text.slice(0, 500) });
    }

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(502).json({ error: 'JSON parse failed', raw: text.slice(0, 500) });
    }

    return res.status(200).json({ result, usage });
  } catch (err) {
    console.error('discover-llm error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

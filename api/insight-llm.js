// Vercel Serverless Function: Claude Haiku LLM insight generation proxy
// POST /api/insight-llm
// Body: { system, user } → Claude API → 10 insights JSON

const RATE_LIMIT = new Map();
const MAX_REQUESTS_PER_DAY = 100; // per IP (server-side safety net)

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
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const { system, user } = req.body || {};
  if (!system || !user) return res.status(400).json({ error: 'system and user prompts required' });

  try {
    const startTime = Date.now();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2500,
        temperature: 0.7,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Claude API error:', response.status, errText);
      return res.status(502).json({ error: 'LLM API error', status: response.status });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const durationMs = Date.now() - startTime;

    // Extract token usage
    const usage = {
      promptTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      durationMs,
    };

    // Parse JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'No JSON array in LLM response', raw: text.slice(0, 500) });
    }

    let insights;
    try {
      insights = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(502).json({ error: 'JSON parse failed', raw: text.slice(0, 500) });
    }

    if (!Array.isArray(insights) || insights.length === 0) {
      return res.status(502).json({ error: 'Invalid insights array' });
    }

    return res.status(200).json({ insights, usage });
  } catch (err) {
    console.error('insight-llm error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

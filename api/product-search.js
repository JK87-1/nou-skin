// Vercel Serverless Function: 제품 검색 자동완성 (SSE 스트리밍)
// JSON-lines 응답을 OpenAI streaming으로 받아서 각 제품을 도착 즉시 클라이언트로 push.

const RATE_LIMIT = new Map();
const MAX_REQUESTS_PER_DAY = 100;

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

const ALLOWED_CAT = new Set(['클렌저', '토너', '에센스', '세럼', '크림', '선크림', '마스크팩', '기타']);
const ALLOWED_SLOT = new Set(['morning', 'night', 'both']);

function sanitizeProduct(p) {
  if (!p || typeof p !== 'object') return null;
  if (typeof p.brand !== 'string' || typeof p.name !== 'string') return null;
  return {
    brand: String(p.brand).trim().slice(0, 40),
    name: String(p.name).trim().slice(0, 60),
    category: ALLOWED_CAT.has(p.category) ? p.category : '기타',
    timeSlot: ALLOWED_SLOT.has(p.timeSlot) ? p.timeSlot : 'both',
    ingredients: Array.isArray(p.ingredients)
      ? p.ingredients.filter(s => typeof s === 'string').map(s => s.trim()).filter(Boolean).slice(0, 6)
      : [],
    volume: typeof p.volume === 'string' ? p.volume.trim().slice(0, 20) : '',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '오늘 검색 횟수 초과' });
  }

  try {
    const { query } = req.body || {};
    const q = String(query || '').trim();
    if (q.length < 2) {
      return res.status(400).json({ error: '검색어가 너무 짧아요 (2자 이상)' });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const prompt = `한국 화장품 "${q}" 매칭 제품 5개를 한 줄에 하나씩 JSON으로 출력.

각 줄: 단일 JSON 객체. JSON 배열 X, 코드블록 X, 설명 X, 한 줄에 하나만.

형식:
{"brand":"토리든","name":"다이브인 저분자 히알루론산 토너","category":"토너","timeSlot":"both","ingredients":["저분자 히알루론산","판테놀"],"volume":"300ml"}
{"brand":"토리든","name":"다이브인 저분자 히알루론산 세럼","category":"세럼","timeSlot":"both","ingredients":["저분자 히알루론산"],"volume":"50ml"}

규칙:
- 실제 유통 제품만. 알 수 없으면 출력 X.
- category: 클렌저|토너|에센스|세럼|크림|선크림|마스크팩|기타
- timeSlot: morning|night|both
- ingredients: 핵심 2~4개`;

    // SSE 헤더
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: 700,
        temperature: 0.1,
        stream: true,
        messages: [
          { role: 'system', content: '한국 화장품 시장 전문가. 한 줄에 단일 JSON 하나씩 출력. 코드블록 X, 설명 X.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '');
      res.write(`data: ${JSON.stringify({ error: 'OpenAI 호출 실패', detail: errText.slice(0, 200) })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    let jsonBuffer = '';
    let emitted = 0;
    const seen = new Set();

    const emitProduct = (raw) => {
      const trimmed = raw.trim();
      if (!trimmed || !trimmed.startsWith('{')) return;
      let parsed;
      try { parsed = JSON.parse(trimmed); } catch { return; }
      const p = sanitizeProduct(parsed);
      if (!p) return;
      const key = `${p.brand.toLowerCase()}|${p.name.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      emitted++;
      res.write(`data: ${JSON.stringify({ product: p })}\n\n`);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const sseLines = sseBuffer.split('\n');
      sseBuffer = sseLines.pop() || '';
      for (const line of sseLines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        let evt;
        try { evt = JSON.parse(dataStr); } catch { continue; }
        const delta = evt.choices?.[0]?.delta?.content;
        if (typeof delta !== 'string' || !delta) continue;
        jsonBuffer += delta;
        // JSON-lines: \n 단위로 emit
        const nlSplit = jsonBuffer.split('\n');
        jsonBuffer = nlSplit.pop() || '';
        for (const ln of nlSplit) emitProduct(ln);
      }
      if (emitted >= 8) break; // 안전망
    }

    // 끝에 남은 partial buffer fallback 처리
    if (jsonBuffer.trim()) {
      // 한 줄에 여러 객체가 붙어 왔거나 마지막 객체일 가능성
      // }뒤에 ,또는 줄바꿈 없이 끝났을 케이스: 단일 객체 가정
      emitProduct(jsonBuffer);
      // 또는 JSON 배열 형태로 통째 출력했을 경우
      try {
        const maybeArr = JSON.parse(jsonBuffer);
        if (Array.isArray(maybeArr)) {
          for (const it of maybeArr) {
            const p = sanitizeProduct(it);
            if (!p) continue;
            const key = `${p.brand.toLowerCase()}|${p.name.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            res.write(`data: ${JSON.stringify({ product: p })}\n\n`);
          }
        } else if (maybeArr && Array.isArray(maybeArr.products)) {
          for (const it of maybeArr.products) {
            const p = sanitizeProduct(it);
            if (!p) continue;
            const key = `${p.brand.toLowerCase()}|${p.name.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            res.write(`data: ${JSON.stringify({ product: p })}\n\n`);
          }
        }
      } catch {}
    }

    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (e) {
    try {
      res.write(`data: ${JSON.stringify({ error: 'Search failed', detail: String(e?.message || e).slice(0, 200) })}\n\n`);
      res.write('data: [DONE]\n\n');
    } catch {}
    return res.end();
  }
}

// Vercel Serverless Function: 측정 후 자동 인사이트 (GPT-5.2)
//
// 측정 완료 직후 사용자 데이터 cross-check해 "이번 변화의 원인 + 권장 액션"을
// 자동 추론. 상담 안 들어가도 즉시 가치 체감.
//
// 입력: 현재 측정 + 이전 측정 + 변화량 + 등록 제품 + 라이프스타일 메모리 + 7일 추세
// 출력: { headline, cause, action, severity, hasInsight }

const RATE_LIMIT = new Map();
const MAX_REQUESTS_PER_DAY = 100; // 측정마다 호출되니 다소 여유

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

function summarizeProducts(products) {
  if (!Array.isArray(products) || products.length === 0) return '등록 제품 없음';
  const lines = products.slice(0, 12).map(p => {
    const days = p.daysSinceRegistered != null ? `${p.daysSinceRegistered}일째` : '';
    const used = p.usedToday ? '오늘✓' : '오늘✗';
    const recent = p.usedDaysIn7 != null ? `주${p.usedDaysIn7}/7` : '';
    const last = p.daysSinceLastUsed != null
      ? (p.daysSinceLastUsed === 0 ? '마지막=오늘' : `마지막=${p.daysSinceLastUsed}일 전`)
      : '미사용';
    const conf = p.ingredientsConfidence === 'known' ? '✓공식' : p.ingredientsConfidence === 'estimated' ? '~추정' : '';
    const ing = Array.isArray(p.ingredients) ? p.ingredients.slice(0, 5).join(',') : (typeof p.ingredients === 'string' ? p.ingredients.slice(0, 80) : '');
    return `- ${p.brand || ''} ${p.name || ''} [${p.category || ''}] ${days} · ${used} · ${recent} · ${last}${ing ? ` · 성분${conf ? `(${conf})` : ''}:${ing}` : ''}`;
  });
  return lines.join('\n');
}

function summarizeLifestyle(lifestyle) {
  if (!Array.isArray(lifestyle) || lifestyle.length === 0) return '라이프스타일 정보 없음';
  return lifestyle.map(l => {
    const days = l.daysSince === 0 ? '오늘' : l.daysSince === 1 ? '어제' : `${l.daysSince}일 전`;
    return `- ${l.label} (${l.count}회 언급, 마지막 ${days})`;
  }).join('\n');
}

function summarizeTrend(trend) {
  if (!trend || !Array.isArray(trend.notableTrends) || trend.notableTrends.length === 0) return '주목할 추세 없음';
  return trend.notableTrends.slice(0, 4).map(t => {
    const arrow = t.direction === 'improving' ? '↑' : '↓';
    return `- ${t.label}: ${t.first} → ${t.last} (${arrow})`;
  }).join('\n');
}

function summarizeChanges(changes, current, previous) {
  if (!previous) return '첫 측정 — 비교 대상 없음';
  if (!changes) return '변화 정보 없음';
  const lines = [];
  for (const [key, val] of Object.entries(changes)) {
    if (typeof val !== 'number' || val === 0) continue;
    const arrow = val > 0 ? '+' : '';
    lines.push(`${key}: ${arrow}${val}`);
  }
  return lines.length > 0 ? lines.join(' · ') : '큰 변화 없음';
}

function buildPrompt(ctx) {
  const { current, previous, changes, products, lifestyle, recentTrend, nickname } = ctx;
  const currentSummary = current ? `종합 ${current.overallScore}점 · 피부나이 ${current.skinAge}세 · 수분 ${current.moisture} · 유분 ${current.oilBalance} · 피부톤 ${current.skinTone} · 트러블 ${current.troubleCount}개${current.troubleBreakdown ? ` (화이트헤드 ${current.troubleBreakdown.whitehead || 0}·블랙헤드 ${current.troubleBreakdown.blackhead || 0}·구진 ${current.troubleBreakdown.papule || 0}·농포 ${current.troubleBreakdown.pustule || 0}·결절 ${current.troubleBreakdown.nodule || 0})` : ''} · 주름 ${current.wrinkleScore} · 탄력 ${current.elasticityScore} · 피부결 ${current.textureScore} · 모공 ${current.poreScore} · 색소 ${current.pigmentationScore} · 다크서클 ${current.darkCircleScore}` : '데이터 없음';

  return `당신은 사용자 피부를 깊이 이해하는 AI 뷰티 에이전트입니다. 이번 측정 결과를 사용자 데이터와 cross-check해 "이번 변화의 가장 가능성 큰 원인 + 즉시 실천 가능한 권장 액션 1가지"를 추론하세요.

[현재 측정]
${currentSummary}

[이전 측정 대비 변화]
${summarizeChanges(changes, current, previous)}

[최근 7일 추세]
${summarizeTrend(recentTrend)}

[등록 제품 사용 패턴]
${summarizeProducts(products)}

[라이프스타일 누적 단서 — 사용자가 이전 채팅에서 흘린 정보]
${summarizeLifestyle(lifestyle)}

[추론 룰 — 매우 중요]
1. 데이터를 cross-check해 가능성 큰 원인 1개 추정. 점수가 떨어진 메트릭 + 등록 제품 누락 + 라이프스타일 단서 + 추세 + 트러블 종류를 종합.
2. 단정 X. "~일 가능성이 커요", "~가 영향을 준 것 같아요" 부드럽게.
3. 라이프스타일 단서 있으면 적극 인용 ("어제 잠 5시간만 주무신다 하셨었는데").
4. 등록 제품 사용 패턴(✗·마지막=N일 전)과 측정 변화를 직접 연결.
5. 권장 액션은 매우 구체적·즉시 실천 가능 ("오늘 밤 시카 크림 1회 발라보세요").
6. 좋아진 변화면 칭찬·격려 ("이번 변화는 ~덕분이에요").

[severity 결정]
- 'attention': 큰 악화(메트릭 -5+ 또는 트러블 +3+), 명확한 원인 있음 — 사용자 행동 권유 강함
- 'neutral': 작은 변동 / 첫 측정 / 큰 변화 없음 — 일반 안내
- 'good': 큰 개선 → 칭찬·격려

[응답 형식 — 반드시 JSON만 출력. 다른 텍스트 금지]
{
  "headline": "10~16자 이내. 변화·원인의 핵심을 한 줄로 (예: '비타민C 공백이 트러블 원인')",
  "cause": "1~2문장. 데이터·라이프스타일 직접 인용해서 원인 추정. 60~120자 이내",
  "action": "1문장. 오늘 즉시 할 수 있는 구체 액션. 40~80자 이내",
  "severity": "attention" | "neutral" | "good"
}

${nickname ? `사용자 닉네임: "${nickname}" — 자연스러우면 한 번 "${nickname}님"으로 부르기, 어색하면 호칭 생략.` : '호칭 생략.'}
"여러분", "고객님", "사용자님" 절대 금지.`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  try {
    const ctx = req.body || {};
    if (!ctx.current) return res.status(400).json({ error: 'current 측정 데이터 필요' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const prompt = buildPrompt(ctx);

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: 600,
        temperature: 0.45,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '당신은 데이터 분석가이자 따뜻한 뷰티 에이전트입니다. JSON으로만 응답하세요.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: '인사이트 생성 실패' });
    }

    const data = await upstream.json();
    const text = data.choices?.[0]?.message?.content || '';
    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}
    if (!parsed || !parsed.headline) {
      return res.status(502).json({ error: '인사이트 파싱 실패' });
    }

    res.status(200).json({
      headline: String(parsed.headline).slice(0, 32),
      cause: String(parsed.cause || '').slice(0, 200),
      action: String(parsed.action || '').slice(0, 140),
      severity: ['good', 'neutral', 'attention'].includes(parsed.severity) ? parsed.severity : 'neutral',
      hasInsight: true,
    });
  } catch (error) {
    console.error('measure-insight error:', error);
    res.status(500).json({ error: error.message });
  }
}

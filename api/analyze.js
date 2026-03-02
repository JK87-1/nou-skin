// Vercel Serverless Function: OpenAI GPT-5.2 Vision skin analysis proxy
// Baseline image comparison for consistency + 3x API call median scoring

const RATE_LIMIT = new Map();
const MAX_REQUESTS_PER_DAY = 30;

const IMAGE_CACHE = new Map();
const CACHE_TTL_MS = 3600000;
const MAX_CACHE_SIZE = 50;

function hashImage(base64Str) {
  let h1 = 0, h2 = 0;
  const step = Math.max(1, Math.floor(base64Str.length / 5000));
  for (let i = 0; i < base64Str.length; i += step) {
    const c = base64Str.charCodeAt(i);
    h1 = ((h1 << 5) - h1 + c) | 0;
    h2 = ((h2 << 7) + h2 + c) | 0;
  }
  return `${(h1 >>> 0).toString(36)}_${(h2 >>> 0).toString(36)}_${base64Str.length}`;
}

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

function buildAnalysisPrompt() {
  return `당신은 피부과 전문의 수준의 AI 피부 분석가입니다.
반드시 아래 순서대로 단계적으로 분석한 후 최종 점수를 산출하세요.

[Step 0. 메이크업 감지]
사진에서 메이크업(파운데이션, BB크림, 컨실러, 아이메이크업, 립 등) 착용 여부를 먼저 판별하세요.
- 메이크업이 감지되면: 화장으로 가려진 부분은 보이는 그대로 평가하되, analysis.summary에 메이크업이 감지되었음을 명시하고, 클렌징 후 재측정을 권장하세요. JSON에 "makeupDetected":true를 포함하세요.
- 메이크업이 없으면: "makeupDetected":false로 설정하고 일반 분석을 진행하세요.

[Step 1. 부위별 정밀 분석]
이마, 눈가, 볼, 팔자, 턱/하관, 코 각각에 대해:
- 주름 유무 및 깊이
- 모공 상태
- 탄력/처짐
- 색상 이상(홍조, 색소침착)

[Step 2. 전체 피부 신호 분석]
- 색상 기반 노화 신호 (홍조, 다크서클, 톤 불균일이 노화인지 라이프스타일 영향인지 구분)
- 유수분 밸런스 상태
- 피부결/텍스처 품질

[Step 3. 종합 점수 산출]
Step 1~2의 분석을 종합하여 아래 10개 지표의 최종 점수(0-100)를 산출하세요.
(피부나이와 종합점수는 별도 산출하므로 JSON에 포함하지 마세요.)
반드시 분석 근거를 먼저 서술한 후 점수를 결정하세요.

채점 기준:
- 주름(wrinkles): 90-100 주름 전혀 없음(10-20대초), 70-89 눈가 잔주름만(20후반-30대), 50-69 팔자/이마주름(30후반-40대), 30-49 중등도(40후반-50대), 0-29 깊은주름(60대+)
- 모공(pores): 90-100 거의 안보임, 70-89 코주변만, 50-69 T존 전체, 30-49 볼까지 확대, 0-29 전체 확대
- 수분(moisture): 90-100 촉촉윤기, 70-89 정상, 50-69 약간건조, 30-49 건조, 0-29 심한건조
- 피부톤(skinTone): 90-100 매우균일, 70-89 양호, 50-69 부분홍조/칙칙, 30-49 색편차큼, 0-29 심한불균일
- 유분(oilBalance): 90-100 완벽균형, 70-89 약간유분기/건조, 50-69 T존번들거림, 30-49 전체유분과다, 0-29 극심한유분
- 트러블(troubleCount): 90-100 트러블없음, 70-89 1-2개소, 50-69 여러개산재, 30-49 염증성다수, 0-29 심한여드름
- 탄력(elasticity): 90-100 탱탱함, 70-89 양호, 50-69 약간처짐시작, 30-49 눈에띄는처짐, 0-29 심한처짐
- 피부결(texture): 90-100 매끈, 70-89 대체로고움, 50-69 약간거침/요철, 30-49 거친피부결, 0-29 매우거침
- 색소(pigmentation): 90-100 잡티없음, 70-89 소량잡티, 50-69 기미/잡티산재, 30-49 기미뚜렷, 0-29 심한색소침착
- 다크서클(darkCircles): 90-100 없음, 70-89 미세한그림자, 50-69 눈에띄는다크, 30-49 진한다크, 0-29 매우심한다크

[Step 4. JSON 출력]
분석 완료 후 반드시 아래 형식의 JSON을 ---JSON_START--- 와 ---JSON_END--- 태그 사이에 출력하세요:
---JSON_START---
{"moisture":숫자,"skinTone":숫자,"oilBalance":숫자,"troubleCount":숫자,"wrinkles":숫자,"elasticity":숫자,"texture":숫자,"pores":숫자,"pigmentation":숫자,"darkCircles":숫자,"makeupDetected":true또는false,"analysis":{"summary":"정밀판독 2~3줄","details":["부위별 소견1","소견2","소견3"]}}
---JSON_END---

[analysis 작성 가이드 — 매우 중요]
- summary는 사용자에게 직접 보여지는 "AI 정밀 판독" 텍스트입니다
- 단순히 "피부가 건조합니다" 같은 뻔한 표현을 절대 쓰지 마세요
- 반드시 사진에서 실제로 관찰된 구체적 부위와 현상을 언급하세요
- 점수가 낮은 지표에 대해 "왜" 그런지 원인을 추론하세요
- 개선 방향을 구체적 성분명·방법과 함께 제시하세요

[다양성 규칙 — 필수 준수]
※ 매 분석마다 반드시 다른 관점·문장 구조·어휘로 작성하세요
※ 아래 8가지 접근법 중 하나를 랜덤하게 골라 작성 스타일을 바꾸세요:
  1) 부위 비교형: "왼쪽 볼과 오른쪽 볼의 차이가…" / "이마 대비 턱라인이…"
  2) 원인 추론형: "수면 패턴이 눈가에 영향을 준 것 같아요" / "자외선 누적으로…"
  3) 강점 부각형: "탄력이 눈에 띄게 좋은데, 여기에 수분만 더하면…"
  4) 계절 연결형: "요즘 같은 환절기에 이 정도면…" / "건조한 날씨 영향으로…"
  5) 성분 추천형: "지금 피부에 딱 맞는 조합은 OO+OO예요"
  6) 라이프스타일형: "충분한 수면과 수분 섭취가 여기서 드러나요"
  7) 변화 관찰형: "지난번보다 OO이 눈에 띄게 달라졌어요"
  8) 피부과학형: "진피층 콜라겐 밀도가…" / "멜라닌 분포 패턴이…"

※ 시작 패턴을 다양하게:
  - 부위로 시작: "눈가~" / "볼 쪽~" / "T존이~" / "이마와 턱의~"
  - 관찰로 시작: "전체적으로~" / "자세히 보면~" / "눈에 띄는 건~"
  - 감탄으로 시작: "피부결이 정말~" / "의외로~" / "인상적인 건~"
  - 진단으로 시작: "유수분 밸런스가~" / "색소 패턴을 보면~"
  - 긍정으로 시작: "잘 관리된 흔적이~" / "좋은 신호가~"

summary 예시 (매번 이것들과 다르게 쓸 것):
"T존 모공이 확장되고 볼 쪽 건조 라인이 보여, 유수분 불균형이 뚜렷해요. 눈가에 미세 잔주름이 시작되고 있어 레티놀+펩타이드 조합이 지금 시작하면 효과적이에요."
"왼쪽 볼에 색소 침착이 오른쪽보다 진한데, 자외선 노출이 한쪽에 집중된 패턴이에요. 비타민C 세럼과 SPF50+ 차단제를 반드시 병행하세요."
"전반적으로 피부결이 고르고 탄력도 양호하지만, 코 주변 모공과 다크서클이 전체 점수를 깎고 있어요. 나이아신아마이드+카페인 아이크림 조합을 추천해요."
"눈 밑 미세 혈관이 비쳐 보이는 혈관형 다크서클이에요. 카페인이 혈관을 수축시키고, 비타민K가 순환을 개선해줄 거예요. 이마 피부결은 실크처럼 매끈해서 관리를 잘 하고 계신 거예요."
"볼 쪽 수분 장벽이 약해진 흔적이 보여요. 세라마이드 크림으로 장벽을 복구하면 톤과 결이 동시에 좋아질 거예요. 반면 T존 유분은 잘 조절되고 있어요."
"인상적인 건 탄력 라인이에요. 하관이 탄탄하고 볼 볼륨도 잘 유지되고 있어요. 다만 코 양옆 모공이 살짝 넓어지는 중인데, BHA 토너로 주 2회 관리하면 충분히 조일 수 있어요."
"자세히 보면 이마 중앙에 얕은 수평 라인이 하나 보여요. 아직 깊지 않아서 레티놀 0.3%로 지금 시작하면 충분히 예방 가능해요. 전체적인 톤 균일도는 정말 좋은 편이에요."

details는 부위별로 관찰된 핵심 소견 3개를 작성하세요 (예: "이마: 수평 주름 1~2줄, 중등도", "볼: 홍조 없음, 모공 미세", "눈가: 잔주름 시작 단계")

[절대 금지사항]
※ summary와 details에 "동일 인물", "같은 사람", "다른 사람", "differentPerson" 판별 결과를 절대 포함하지 마세요
※ 인물 동일 여부는 JSON의 "differentPerson" 필드에만 표시하고, analysis 텍스트에는 피부 분석 내용만 작성하세요`;
}

const SCORE_KEYS = [
  'moisture', 'skinTone', 'troubleCount', 'oilBalance',
  'wrinkles', 'pores', 'elasticity',
  'pigmentation', 'texture', 'darkCircles',
];

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Time-based stabilization.
 * Allowed delta grows with days since baseline was created:
 *   same day: ±3, 1-2d: ±5, 3-5d: ±7, 1w: ±10, 2w: ±13, 1m+: ±15
 * Different person detection: average diff > 15 → skip stabilization.
 */
function getAllowedDelta(daysSinceBaseline) {
  if (daysSinceBaseline < 1) return 3;
  if (daysSinceBaseline <= 2) return 5;
  if (daysSinceBaseline <= 5) return 7;
  if (daysSinceBaseline <= 7) return 10;
  if (daysSinceBaseline <= 14) return 13;
  return 15;
}

function stabilizeScores(scores, baselineResult, baselineTimestamp) {
  if (!baselineResult) return scores;

  // Different person detection: average absolute diff across all metrics
  let totalDiff = 0, counted = 0;
  for (const key of SCORE_KEYS) {
    if (typeof scores[key] === 'number' && typeof baselineResult[key] === 'number') {
      totalDiff += Math.abs(scores[key] - baselineResult[key]);
      counted++;
    }
  }
  const avgDiff = counted > 0 ? totalDiff / counted : 0;
  if (avgDiff > 15) return scores; // Different person

  // Time-based allowed delta
  const now = Date.now();
  const elapsed = baselineTimestamp ? now - baselineTimestamp : 0;
  const daysSince = elapsed / 86400000;
  const maxDelta = getAllowedDelta(daysSince);

  const stabilized = { ...scores };
  for (const key of SCORE_KEYS) {
    const current = scores[key];
    const baseline = baselineResult[key];
    if (typeof current === 'number' && typeof baseline === 'number') {
      const diff = current - baseline;
      const clamped = Math.max(-maxDelta, Math.min(maxDelta, diff));
      stabilized[key] = baseline + clamped;
    }
  }
  return stabilized;
}

/**
 * Deterministic overallScore from 10 individual metrics.
 * Weighted average — no GPT randomness.
 */
function computeOverallScore(scores) {
  const weights = {
    wrinkles: 0.13, elasticity: 0.12, moisture: 0.12,
    pores: 0.10, texture: 0.10, skinTone: 0.09,
    pigmentation: 0.09, darkCircles: 0.09,
    oilBalance: 0.08, troubleCount: 0.08,
  };
  let sum = 0;
  for (const [key, w] of Object.entries(weights)) {
    sum += (typeof scores[key] === 'number' ? scores[key] : 50) * w;
  }
  return Math.round(sum);
}

/**
 * Deterministic skinAge from overallScore.
 * 100점→18세, 0점→60세, 1세 단위 반올림.
 */
function calculateSkinAge(overallScore) {
  const age = 60 - (overallScore / 100) * 42;
  return Math.round(age);
}

function parseAIResponse(text) {
  const markerMatch = text.match(/---JSON_START---\s*([\s\S]*?)\s*---JSON_END---/);
  const jsonStr = markerMatch ? markerMatch[1] : null;
  const raw = jsonStr || (text.match(/\{[\s\S]*\}/) || [])[0];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    for (const key of SCORE_KEYS) {
      if (typeof parsed[key] !== 'number') return null;
    }
    return parsed;
  } catch { return null; }
}

async function callGPT(apiKey, newImage, seed, baselineImage, baselineResult) {
  const userContent = [];

  if (baselineImage && baselineResult) {
    // ===== Dual-image comparison mode =====
    userContent.push({
      type: 'text',
      text: `[중요] 먼저 두 사진이 동일 인물인지 판별하세요.
- 동일 인물이면: 기준 점수(${JSON.stringify(baselineResult)})에 앵커하여 일관성 있게 분석하세요. 조명/각도 차이로 인한 점수 변동은 최소화하세요.
- 다른 인물이면: 기준 점수를 완전히 무시하고 두 번째 사진만 독립적으로 분석하세요. "differentPerson":true를 JSON에 포함하세요.
첫 번째 사진=기준 사진, 두 번째 사진=오늘 촬영한 사진입니다.`,
    });
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${baselineImage}`, detail: 'high' },
    });
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${newImage}`, detail: 'high' },
    });
  } else {
    // ===== Single image mode (first analysis) =====
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${newImage}`, detail: 'high' },
    });
  }

  // Always append the full analysis prompt
  userContent.push({ type: 'text', text: buildAnalysisPrompt() });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.2',
      max_completion_tokens: 2000,
      temperature: 0.3,
      top_p: 1,
      seed,
      messages: [
        {
          role: 'system',
          content: 'You are a dermatologist-level AI skin analyzer. Be consistent and deterministic. CRITICAL: First determine if the two photos show the SAME person or DIFFERENT people. If DIFFERENT people, completely ignore baseline scores and analyze the new photo independently — set "differentPerson":true in output. If SAME person, anchor to baseline scores and only deviate for genuine skin changes, not lighting/angle differences. Output JSON between ---JSON_START--- and ---JSON_END--- markers.',
        },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return parseAIResponse(text);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again tomorrow.' });
  }

  try {
    const { image, baselineImage, baselineResult, baselineTimestamp } = req.body;

    if (!image) return res.status(400).json({ error: 'No image provided' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    // Server-side cache
    const imgHash = hashImage(image);
    const cachedEntry = IMAGE_CACHE.get(imgHash);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
      return res.status(200).json({ content: [{ text: JSON.stringify(cachedEntry.scores) }] });
    }

    // 3x parallel API calls with different seeds → median
    const seeds = [12345, 67890, 24680];
    const results = await Promise.all(
      seeds.map(s => callGPT(apiKey, image, s, baselineImage || null, baselineResult || null))
    );
    const valid = results.filter(r => r !== null);

    if (valid.length === 0) {
      return res.status(502).json({ error: 'All AI calls failed' });
    }

    const merged = { ...valid[0] };
    if (valid.length >= 2) {
      for (const key of SCORE_KEYS) {
        merged[key] = median(valid.map(r => r[key]));
      }
    }
    // Pick analysis from a random valid response for diversity
    const analysisSource = valid[Math.floor(Math.random() * valid.length)];
    merged.analysis = analysisSource.analysis || { summary: '', details: [] };

    // If ANY GPT call detected a different person, skip stabilization
    const gptSaysDifferent = valid.some(r => r.differentPerson === true);
    if (gptSaysDifferent) merged.differentPerson = true;

    // Stabilize ALL metrics against baseline (skip for different person)
    const effectiveBaseline = gptSaysDifferent ? null : (baselineResult || null);
    const effectiveTimestamp = gptSaysDifferent ? null : (baselineTimestamp || null);
    const stabilized = stabilizeScores(merged, effectiveBaseline, effectiveTimestamp);
    for (const key of SCORE_KEYS) {
      merged[key] = stabilized[key];
    }
    // overallScore/skinAge: computed from stabilized metrics
    merged.overallScore = computeOverallScore(merged);
    merged.skinAge = calculateSkinAge(merged.overallScore);

    // Save to server cache
    if (IMAGE_CACHE.size >= MAX_CACHE_SIZE) {
      const firstKey = IMAGE_CACHE.keys().next().value;
      IMAGE_CACHE.delete(firstKey);
    }
    IMAGE_CACHE.set(imgHash, { scores: merged, timestamp: Date.now() });

    res.status(200).json({ content: [{ text: JSON.stringify(merged) }] });
  } catch (error) {
    console.error('analyze handler error:', error);
    res.status(500).json({ error: error.message });
  }
}

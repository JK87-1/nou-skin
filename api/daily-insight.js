// Vercel Serverless Function: AI Daily Insight (GPT-4o-mini)
// 어제 데이터 80% + 최근 7일 데이터 20% 기반 카테고리별 인사이트 생성
// v1.0

const RATE_LIMIT = new Map();
const MAX_REQUESTS_PER_DAY = 20;

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

function calcConfidence(yesterday, weekData) {
  let score = 0;
  // 어제 데이터 항목 수 (최대 3점)
  const yCount = Object.keys(yesterday || {}).length;
  if (yCount >= 5) score += 3;
  else if (yCount >= 3) score += 2;
  else if (yCount >= 1) score += 1;
  // 주간 데이터 일수 (최대 2점)
  const wDays = weekData?.daysWithData || 0;
  if (wDays >= 5) score += 2;
  else if (wDays >= 3) score += 1;
  return Math.max(1, Math.min(5, score));
}

function buildPrompt(yesterday, weekData, confidence) {
  const yLines = [];
  if (yesterday?.diet) yLines.push(`식단: ${yesterday.diet}`);
  if (yesterday?.calories) yLines.push(`칼로리: ${yesterday.calories}`);
  if (yesterday?.macros) yLines.push(`영양소: ${yesterday.macros}`);
  if (yesterday?.water) yLines.push(`수분: ${yesterday.water}`);
  if (yesterday?.steps) yLines.push(`걸음수: ${yesterday.steps}`);
  if (yesterday?.exercise) yLines.push(`운동: ${yesterday.exercise}`);
  if (yesterday?.sleep) yLines.push(`수면: ${yesterday.sleep}`);
  if (yesterday?.weight) yLines.push(`체중: ${yesterday.weight}`);
  if (yesterday?.bloodSugar) yLines.push(`혈당: ${yesterday.bloodSugar}`);
  if (yesterday?.condition) yLines.push(`컨디션: ${yesterday.condition}`);
  if (yesterday?.skin) yLines.push(`피부: ${yesterday.skin}`);

  const wLines = [];
  if (weekData?.avgSleep) wLines.push(`평균 수면: ${weekData.avgSleep}`);
  if (weekData?.avgSteps) wLines.push(`평균 걸음수: ${weekData.avgSteps}`);
  if (weekData?.avgCalories) wLines.push(`평균 칼로리: ${weekData.avgCalories}`);
  if (weekData?.avgWater) wLines.push(`평균 수분: ${weekData.avgWater}`);
  if (weekData?.weightTrend) wLines.push(`체중 추이: ${weekData.weightTrend}`);
  if (weekData?.avgEnergy) wLines.push(`평균 에너지: ${weekData.avgEnergy}`);
  if (weekData?.avgMood) wLines.push(`평균 기분: ${weekData.avgMood}`);
  if (weekData?.skinTrend) wLines.push(`피부 추이: ${weekData.skinTrend}`);
  if (weekData?.daysWithData) wLines.push(`데이터 기록 일수: ${weekData.daysWithData}일/7일`);

  const confidenceDesc = ['', '데이터 거의 없음', '데이터 부족', '데이터 보통', '데이터 충분', '데이터 매우 충분'][confidence];

  return `당신은 웰니스 전문가이자 퍼스널 헬스 코치입니다. 사용자의 건강 데이터를 분석하여 공감적이고 구체적인 인사이트를 제공합니다.

[규칙]
- 어제 데이터(80% 비중)와 최근 일주일 데이터(20% 비중)를 종합 분석
- 현재 데이터 신뢰도: ${confidenceDesc} (${confidence}/5)
- 정확히 아래 5개 카테고리의 인사이트를 JSON 배열로 생성
- 각 인사이트는 3-5문장, 구체적 수치와 과학적 근거를 포함
- 데이터가 부족한 카테고리는 일반적인 건강 정보 기반으로 작성하되, 추측임을 자연스럽게 표현
- 톤: 따뜻하고 공감적, "~해요" 체, 생리앱 '핌'처럼 친근하면서도 전문적
- 매번 다른 표현과 문장 구조 사용

[카테고리]
1. condition (오늘의 컨디션) - 전반적인 몸 상태, 에너지, 활력 예측
2. mood (기분) - 감정 상태, 심리적 웰빙, 스트레스
3. energy (에너지) - 체력, 피로도, 활동량과의 관계
4. skin (피부) - 피부 상태, 수분, 관리 팁
5. tip (오늘의 팁) - 오늘 실천할 수 있는 구체적 행동 1가지

[어제 데이터 — 80% 비중]
${yLines.length > 0 ? yLines.join('\n') : '기록 없음'}

[최근 7일 데이터 — 20% 비중]
${wLines.length > 0 ? wLines.join('\n') : '기록 없음'}

[응답 형식 — 반드시 이 JSON 형식으로만 응답]
[
  {"category":"condition","title":"제목(8자 이내)","body":"인사이트 본문(3-5문장)"},
  {"category":"mood","title":"제목","body":"본문"},
  {"category":"energy","title":"제목","body":"본문"},
  {"category":"skin","title":"제목","body":"본문"},
  {"category":"tip","title":"제목","body":"본문"}
]

JSON만 응답하세요. 다른 텍스트 없이.`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { yesterday, weekData } = req.body;
    const confidence = calcConfidence(yesterday, weekData);
    const prompt = buildPrompt(yesterday, weekData, confidence);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.75,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI error:', await response.text());
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || '';

    // Parse JSON from response (handle markdown code blocks)
    let insights;
    try {
      const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      insights = JSON.parse(jsonStr);
    } catch {
      return res.status(502).json({ error: 'Failed to parse AI response' });
    }

    return res.status(200).json({ insights, confidence });
  } catch (error) {
    console.error('daily-insight error:', error);
    return res.status(500).json({ error: error.message });
  }
}

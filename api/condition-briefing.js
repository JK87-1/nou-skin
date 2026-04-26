// Vercel Serverless Function: AI 컨디션 브리핑 (GPT-4o-mini)
// 매 측정 후 결과 페이지에 2-4문장 피부 컨디션 분석 제공

const RATE_LIMIT = new Map();
const MAX_REQUESTS_PER_DAY = 50;

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

function getTimeOfDay(hour) {
  if (hour < 6) return '새벽';
  if (hour < 11) return '아침';
  if (hour < 14) return '점심';
  if (hour < 18) return '오후';
  if (hour < 22) return '저녁';
  return '밤';
}

function buildBodyPrompt(data) {
  const { recentData, timeOfDay } = data;

  const dataLines = [];
  if (recentData?.diet) dataLines.push(`식단: ${recentData.diet}`);
  if (recentData?.water) dataLines.push(`수분: ${recentData.water}`);
  if (recentData?.steps) dataLines.push(`걸음수: ${recentData.steps}`);
  if (recentData?.exercise) dataLines.push(`운동: ${recentData.exercise}`);
  if (recentData?.sleep) dataLines.push(`수면: ${recentData.sleep}`);
  if (recentData?.bloodSugar) dataLines.push(`혈당: ${recentData.bloodSugar}`);
  if (recentData?.vitality) dataLines.push(`활력: ${recentData.vitality}`);

  return `아래는 이 사람이 최근 3시간 내에 기록한 웰니스 데이터야.
현재 상태를 짧게 진단하고, 지금 할 수 있는 웰니스 행동 1개를 제안해줘.
전체 1-2문장, 40자 이내로 짧고 핵심만.
시간대: ${timeOfDay}
"~해보세요" / "~좋을 것 같아요" / "~추천드려요" 등 존댓말. 행동 제안은 "~드려요"가 아닌 "~해보세요" 형태로.
매번 다른 표현과 문장 구조를 사용해.

[기록된 데이터]
${dataLines.join('\n')}

브리핑:`;
}

function buildSkinPrompt(data) {
  const { current, previous, timeOfDay, skinType, todayCount, stableSkinAge } = data;

  let comparison = '';
  if (previous) {
    const diffs = [];
    const metrics = [
      { key: 'moisture', label: '수분', unit: '%' },
      { key: 'skinTone', label: '피부톤', unit: '점' },
      { key: 'oilBalance', label: '유분', unit: '%' },
      { key: 'wrinkleScore', label: '주름', unit: '점' },
      { key: 'elasticityScore', label: '탄력', unit: '점' },
      { key: 'darkCircleScore', label: '다크서클', unit: '점' },
      { key: 'textureScore', label: '피부결', unit: '점' },
      { key: 'poreScore', label: '모공', unit: '점' },
    ];
    for (const m of metrics) {
      const diff = (current[m.key] ?? 0) - (previous[m.key] ?? 0);
      if (Math.abs(diff) >= 2) {
        diffs.push(`${m.label} ${diff > 0 ? '+' : ''}${diff}${m.unit}`);
      }
    }
    const prevTime = previous.timestamp
      ? new Date(previous.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '이전';
    comparison = diffs.length > 0
      ? `\n이전 측정(${prevTime}) 대비 변화: ${diffs.join(', ')}`
      : '\n이전 측정 대비 큰 변화 없음';
  }

  return `당신은 럭셔리 뷰티 브랜드의 퍼스널 스킨 컨시어지입니다. 세련되고 감각적인 언어로 피부 상태를 브리핑하세요.

[규칙]
- 2-3문장으로 짧고 핵심적으로 (최대 4문장 금지)
- 첫 문장: 실제 데이터에 기반한 칭찬이나 상태 요약으로 시작
- 시간대(${timeOfDay}) 맥락 자연스럽게 반영
- 마지막 문장: 즉시 실천 가능한 팁 1개
- "~해요" 체, 고급스럽고 따뜻한 톤
${todayCount > 1 ? `- 오늘 ${todayCount}회째 측정이므로 하루 변화를 자연스럽게 반영` : ''}
${stableSkinAge ? `- 안정 피부나이(주간평균): ${stableSkinAge}세, 현재 측정 피부나이: ${current.skinAge}세` : ''}

[데이터 기반 칭찬 — 실제 점수가 좋은 지표만 칭찬하세요. 억지 칭찬 금지]
수분 60+: "수분감이 돋보이는 촉촉한 피부예요" / "글로우가 살아있어요" / "촉촉한 물광이 느껴져요" / "수분 밸런스가 잘 잡혀있어요"
피부톤 65+: "안색이 화사하고 광채가 나요" / "맑고 투명한 톤이에요" / "피부에서 자연스러운 윤기가 나요" / "화장 안 해도 빛나는 톤이에요"
탄력 65+: "탄력 있는 탄탄한 피부 라인이에요" / "피부가 통통하고 탱탱해요" / "볼륨감 있는 피부예요"
피부결 65+: "매끈한 피부결이에요" / "결이 고와서 메이크업이 잘 먹겠어요" / "실크처럼 부드러운 피부결이에요"
유분 45~65: "유수분 밸런스가 이상적이에요" / "피지 조절이 잘 되고 있어요"
다크서클 65+: "눈 밑이 맑고 환해요" / "눈가가 밝고 생기 있어요"
트러블 0~2: "깨끗하고 맑은 피부 상태예요" / "잡티 없이 맑아요" / "피부가 깨끗하고 건강해요"
종합 80+: "오늘 피부 컨디션 정말 좋아요!" / "빛나는 피부예요" / "완벽에 가까운 피부 상태예요"
※ 점수가 낮은 지표는 솔직하되 부드럽게: "~가 조금 아쉽지만" / "~는 살짝 신경 쓰이지만" 정도로 짚고 팁과 연결
※ 반드시 매번 다른 표현과 문장 구조를 사용하세요. 이전에 썼던 문구를 절대 반복하지 마세요.
※ 시작 문장의 패턴을 다양하게: "오늘~" / "지금~" / 칭찬으로 시작 / 지표 언급으로 시작 / 감탄으로 시작 등

[점수 하락 시 — 위로하고 회복 동기를 부여하세요. 절대 비난하지 마세요]
※ 이전 대비 점수가 떨어진 지표가 있다면 자연스럽게 위로하세요:
- "피부도 컨디션이 있어요. 오늘은 조금 쉬어가는 날이에요."
- "일시적인 변화는 자연스러운 거예요. 오늘 저녁 케어만 잘 해주면 돼요."
- "어제보다 살짝 아쉽지만, 피부 회복력은 생각보다 빨라요."
- "수치가 변했지만, 꾸준한 관리가 쌓이면 다시 올라갈 거예요."
※ 하락 원인을 자연스럽게 추정하고 실천 팁을 제시: 수면, 스트레스, 수분 섭취, 자외선 등
※ "관리 필요", "주의" 같은 경고성 어투 대신 "~에 신경 쓰면 금방 돌아올 거예요" 같은 희망적 어투 사용

[현재 피부 데이터]
오늘의 컨디션: ${current.conditionScore ?? current.overallScore}점 | 전체 종합: ${current.overallScore}점
수분: ${current.moisture}% | 유분: ${current.oilBalance}% | 톤: ${current.skinTone}점
주름: ${current.wrinkleScore} | 탄력: ${current.elasticityScore} | 피부결: ${current.textureScore} | 모공: ${current.poreScore}
색소: ${current.pigmentationScore} | 다크서클: ${current.darkCircleScore} | 트러블: ${current.troubleCount}개
피부타입: ${skinType || '알 수 없음'}${comparison}
※ "오늘의 컨디션" 점수를 기반으로 브리핑하세요 (수분/유분/톤/다크서클/트러블 중심)

브리핑을 작성하세요:`;
}

// ── Daily Insight helpers ──

function calcInsightConfidence(yesterday, weekData) {
  let score = 0;
  const yCount = Object.keys(yesterday || {}).length;
  if (yCount >= 5) score += 3;
  else if (yCount >= 3) score += 2;
  else if (yCount >= 1) score += 1;
  const wDays = weekData?.daysWithData || 0;
  if (wDays >= 5) score += 2;
  else if (wDays >= 3) score += 1;
  return Math.max(1, Math.min(5, score));
}

function buildInsightPrompt(yesterday, weekData, confidence) {
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
- 톤: 따뜻하고 공감적, "~해요" 체, 친근하면서도 전문적
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
    const { type } = req.body;

    // Use KST (UTC+9) since Vercel runs in UTC
    const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
    const hour = kstNow.getUTCHours();
    const timeOfDay = getTimeOfDay(hour);

    let prompt, maxTokens;

    if (type === 'daily-insight') {
      // ── Daily Insight (5 category cards) ──
      const { yesterday, weekData } = req.body;
      const confidence = calcInsightConfidence(yesterday, weekData);
      prompt = buildInsightPrompt(yesterday, weekData, confidence);
      maxTokens = 1200;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.75,
        }),
      });

      if (!response.ok) {
        console.error('OpenAI error:', await response.text());
        return res.status(502).json({ error: 'AI service error' });
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content?.trim() || '';
      let insights;
      try {
        const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        insights = JSON.parse(jsonStr);
      } catch {
        return res.status(502).json({ error: 'Failed to parse AI response' });
      }

      return res.status(200).json({ insights, confidence });
    }

    // ── Body / Skin briefing ──
    if (type === 'body') {
      const { recentData } = req.body;
      prompt = buildBodyPrompt({ recentData, timeOfDay });
      maxTokens = 200;
    } else {
      const { current, previous, skinType, todayCount, stableSkinAge } = req.body;
      if (!current || !current.overallScore) {
        return res.status(400).json({ error: 'Current scores required' });
      }
      prompt = buildSkinPrompt({ current, previous, timeOfDay, skinType, todayCount: todayCount || 1, stableSkinAge });
      maxTokens = 200;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI error:', err);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const briefing = data.choices?.[0]?.message?.content?.trim() || '';

    return res.status(200).json({ briefing, timeOfDay });
  } catch (error) {
    console.error('condition-briefing error:', error);
    return res.status(500).json({ error: error.message });
  }
}

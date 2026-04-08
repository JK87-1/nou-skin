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
  const { energy, mood, hydration, dietSummary, supplements, weight, previousWeight, timeOfDay, routine } = data;

  let weightChange = '';
  if (previousWeight != null && weight != null) {
    const diff = weight - previousWeight;
    if (Math.abs(diff) >= 0.1) {
      weightChange = `\n이전 대비 몸무게 변화: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}kg`;
    } else {
      weightChange = '\n몸무게 변화 없음';
    }
  }

  const supplementText = supplements && supplements.length > 0
    ? supplements.map(s => `${s.name}: ${s.taken ? '✅' : '❌'}`).join(', ')
    : '기록 없음';

  return `당신은 사용자의 건강을 매일 함께 챙기는 따뜻한 웰니스 파트너입니다. 친한 친구처럼 다정하고 개인적인 톤으로 브리핑하세요.

[규칙]
- 정확히 2문장으로 작성
- 첫 문장: 오늘 입력된 데이터를 기반으로 컨디션 상태를 따뜻하게 요약
- 두 번째 문장: 데이터에 기반한 실천 가능한 팁 또는 응원 한마디
- "~해요" 체, 친구처럼 다정하고 개인적인 톤
- 시간대(${timeOfDay}) 맥락 자연스럽게 반영
- 매번 다른 표현과 문장 구조를 사용하세요

[슬라이더 해석 기준 — 각 값은 0~100]
에너지 70+: 활력 넘치는 상태 / 에너지 40~69: 보통 / 에너지 ~39: 피곤하거나 지친 상태
기분 70+: 기분 좋은 상태 / 기분 40~69: 무난한 하루 / 기분 ~39: 기분이 다운된 상태
수분 70+: 수분 섭취 충분 / 수분 40~69: 보통 / 수분 ~39: 수분 섭취 부족

[데이터]
에너지: ${energy ?? '미입력'} | 기분: ${mood ?? '미입력'} | 수분 섭취: ${hydration ?? '미입력'}
오늘 식단: ${dietSummary || '기록 없음'}
영양제: ${supplementText}
몸무게: ${weight != null ? weight + 'kg' : '미입력'}${weightChange}
루틴 체크: 스킨케어 ${routine?.skin ? `${routine.skin.done}/${routine.skin.total}` : '미설정'} | 식단 ${routine?.food ? `${routine.food.done}/${routine.food.total}` : '미설정'} | 바디케어 ${routine?.body ? `${routine.body.done}/${routine.body.total}` : '미설정'}

브리핑을 작성하세요:`;
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

    if (type === 'body') {
      const { energy, mood, hydration, dietSummary, supplements, weight, previousWeight, routine } = req.body;
      prompt = buildBodyPrompt({ energy, mood, hydration, dietSummary, supplements, weight, previousWeight, timeOfDay, routine });
      maxTokens = 150;
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

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
  const { energy, mood, hydration, recentData, timeOfDay } = data;

  const dataLines = [];
  dataLines.push(`슬라이더 — 에너지: ${energy ?? '미입력'} | 기분: ${mood ?? '미입력'} | 수분감: ${hydration ?? '미입력'} (각 0~100)`);
  if (recentData?.diet) dataLines.push(`식단: ${recentData.diet}`);
  if (recentData?.water) dataLines.push(`수분: ${recentData.water}`);
  if (recentData?.steps) dataLines.push(`걸음수: ${recentData.steps}`);
  if (recentData?.exercise) dataLines.push(`운동: ${recentData.exercise}`);
  if (recentData?.supplements) dataLines.push(`영양제: ${recentData.supplements}`);
  if (recentData?.weight) dataLines.push(`몸무게: ${recentData.weight}`);
  if (recentData?.bloodSugar) dataLines.push(`혈당: ${recentData.bloodSugar}`);
  if (recentData?.sleep) dataLines.push(`수면: ${recentData.sleep}`);

  return `아래는 이 사람이 최근 3시간 내에 기록한 웰니스 데이터야.
현재 상태를 1문장으로 진단하고, 지금 바로 할 수 있는 웰니스 행동 1-2가지를 제안해줘.
따뜻하고 구체적인 톤, 전체 2-3문장 이내.
시간대: ${timeOfDay}
"~해요" 체, 친구처럼 다정한 톤.
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
      const { energy, mood, hydration, recentData } = req.body;
      prompt = buildBodyPrompt({ energy, mood, hydration, recentData, timeOfDay });
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

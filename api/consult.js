// Vercel Serverless Function: GPT-5.2 skin consultation chat proxy

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

function buildSystemPrompt(context) {
  const month = new Date().getMonth() + 1;
  const season = month <= 2 || month === 12 ? '겨울' : month <= 5 ? '봄' : month <= 8 ? '여름' : '가을';

  const seasonalTips = {
    '겨울': '건조한 겨울철에는 세라마이드와 히알루론산이 포함된 고보습 제품이 필수예요. 실내 난방으로 피부 수분이 빠르게 증발하므로, 미스트와 수면팩을 적극 활용하세요.',
    '봄': '봄에는 꽃가루와 미세먼지로 피부가 예민해지기 쉬워요. 저자극 클렌징과 진정 성분(시카, 판테놀)을 추천해요.',
    '여름': '여름에는 자외선 차단이 가장 중요해요. SPF50+ 선크림을 2-3시간마다 덧발라주세요. 가벼운 수분 제품으로 유수분 밸런스를 맞추세요.',
    '가을': '가을에는 여름 동안 쌓인 자외선 데미지를 회복할 때예요. 비타민C 세럼과 각질 케어로 피부결을 정돈하세요.',
  };

  let ingredientAdvice = '';
  if (context.currentResult) {
    const r = context.currentResult;
    const tips = [];
    if (r.moisture < 60) tips.push('수분도가 낮으므로 히알루론산, 세라마이드, 스쿠알란 성분을 추천');
    if (r.wrinkleScore < 60) tips.push('주름 관리가 필요하므로 레티놀(저농도 시작), 펩타이드, 아데노신 성분을 추천');
    if (r.elasticityScore < 60) tips.push('탄력 개선을 위해 콜라겐 부스팅 성분(펩타이드, 바쿠치올)을 추천');
    if (r.pigmentationScore < 60) tips.push('색소 관리를 위해 나이아신아마이드, 비타민C, 알부틴 성분을 추천');
    if (r.poreScore < 60) tips.push('모공 관리를 위해 BHA(살리실산), 나이아신아마이드 성분을 추천');
    if (r.textureScore < 60) tips.push('피부결 개선을 위해 AHA(글리콜산), PHA 성분을 추천');
    if (r.darkCircleScore < 60) tips.push('다크서클 개선을 위해 비타민K, 카페인, 펩타이드 아이크림을 추천');
    if (r.oilBalance > 65) tips.push('유분 조절을 위해 나이아신아마이드, 티트리 성분을 추천');
    if (r.troubleCount > 5) tips.push('트러블 진정을 위해 시카(병풀추출물), 티트리, 살리실산 성분을 추천');
    ingredientAdvice = tips.length > 0 ? '\n\n[성분 추천 가이드]\n' + tips.join('\n') : '';
  }

  let historyContext = '';
  if (context.history && context.history.length > 0) {
    historyContext = '\n\n[최근 측정 히스토리]\n' + context.history.map(r =>
      `${r.date}: 종합 ${r.overallScore}점, 피부나이 ${r.skinAge}세, 수분 ${r.moisture}, 주름 ${r.wrinkleScore}, 탄력 ${r.elasticityScore}`
    ).join('\n');
  }

  let todayContext = '';
  if (context.todayRecords && context.todayRecords.length > 1) {
    todayContext = '\n\n[오늘의 측정 기록 — 하루 내 변화 패턴 분석에 활용하세요]\n';
    todayContext += context.todayRecords.map((r, i) => {
      const time = new Date(r.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      return `${i + 1}회(${time}): 종합 ${r.overallScore}점, 수분 ${r.moisture}, 유분 ${r.oilBalance}, 피부톤 ${r.skinTone}, 다크서클 ${r.darkCircleScore}`;
    }).join('\n');
    todayContext += `\n총 ${context.todayRecords.length}회 측정. 하루 내 변화가 보이면 원인(시간대, 환경, 활동)을 자연스럽게 분석해주세요.`;
  }
  if (context.stableSkinAge) {
    todayContext += `\n안정 피부나이(주간평균): ${context.stableSkinAge}세`;
  }

  let changeContext = '';
  if (context.changes) {
    const c = context.changes;
    const improved = [];
    const declined = [];
    for (const [key, val] of Object.entries(c)) {
      if (val.diff > 0 && !val.inverse) improved.push(`${val.label} +${val.diff}`);
      else if (val.diff < 0 && val.inverse) improved.push(`${val.label} ${val.diff}`);
      else if (val.diff !== 0) declined.push(`${val.label} ${val.diff > 0 ? '+' : ''}${val.diff}`);
    }
    if (improved.length > 0 || declined.length > 0) {
      changeContext = '\n\n[직전 대비 변화]';
      if (improved.length > 0) changeContext += `\n개선: ${improved.join(', ')}`;
      if (declined.length > 0) changeContext += `\n주의: ${declined.join(', ')}`;
    }
  }

  return `당신은 "나만의 피부상담사"입니다. 피부과학(Dermatology) 전문 지식을 갖추고, 친근하면서도 신뢰감 있는 말투로 상담하세요.

[전문 지식 기반]
당신은 다음 피부과학 원리를 기반으로 상담합니다:
- 피부 장벽(Skin Barrier): 세라마이드, 콜레스테롤, 지방산의 3:1:1 비율이 최적. 장벽 손상 시 TEWL(경표피 수분 손실) 증가
- 피부 턴오버: 정상 28일 주기. 나이가 들면 40-60일로 늘어남. AHA/BHA가 턴오버 촉진
- pH 밸런스: 건강한 피부 pH 4.5-5.5 (약산성). 알칼리성 세안제는 장벽 손상 유발
- 피부 마이크로바이옴: 과도한 세안이나 항균 성분은 유익균까지 제거할 수 있음
- 자외선 데미지: UVA(노화)와 UVB(화상) 구분. 광노화가 피부 노화의 80%를 차지
- 염증 반응: 만성 저등급 염증(inflammaging)이 노화를 가속화

[성분 상호작용 규칙 — 반드시 준수]
아래 조합은 반드시 경고하세요:
• 레티놀 + AHA/BHA → 과도한 자극, 장벽 손상 위험. 교대 사용 권장 (아침 산, 저녁 레티놀)
• 비타민C(L-아스코르빈산) + 나이아신아마이드 → 고농도에서 홍조 가능. 시간 간격 15분 이상 또는 다른 타임에 사용
• 레티놀 + 벤조일퍼옥사이드 → 레티놀 비활성화. 절대 동시 사용 금지
• AHA + BHA 동시 → 과각질 제거, 민감성 유발. 번갈아 사용 권장
• 비타민C + AHA/BHA → pH 충돌, 효능 감소. 비타민C는 아침, 산(Acid)은 저녁
• 나이아신아마이드 + 직접산(Direct Acid, pH 3.5 이하) → 나이아신으로 전환, 홍조 유발
시너지가 좋은 조합도 안내하세요:
• 비타민C + 비타민E + 페룰산 → 항산화 시너지 8배 증가
• 나이아신아마이드 + 히알루론산 → 보습 + 장벽 강화 시너지
• 세라마이드 + 콜레스테롤 + 지방산 → 장벽 회복 골든 트리오
• 레티놀 + 펩타이드 → 콜라겐 생성 시너지 (저녁 루틴)
• BHA + 나이아신아마이드 → 모공 케어 + 피지 조절 시너지

[성격 & 말투 — 핵심]
- "~해요", "~이에요" 체를 사용하세요
- 사용자의 말에 먼저 **공감하고 인정**한 뒤에 분석/제안으로 넘어가세요
- 예: "좋은 질문이에요!", "그 고민 이해해요", "맞아요, 그럴 수 있어요"
- 친한 언니/오빠 같은 느낌으로, 전문적이되 딱딱하지 않게
- 데이터를 인용할 때는 자연스럽게: "지금 피부 데이터를 보면 수분이 42점이라 좀 건조한 편이에요"
- 원인→결과→해결 순서로 **스토리처럼** 설명하세요. 단순 나열 금지.
- 마무리는 행동 유도형으로: "오늘 밤부터 해보세요!" 같은 실천 가능한 한마디

[응답 포맷 — 매우 중요, 반드시 준수]
- 모바일 채팅이므로 총 5-8줄 이내로 답변하세요
- **한 문단은 최대 2문장**. 문단 사이에 반드시 빈 줄(\n\n)을 넣으세요
- 이건 절대 규칙이에요: 3문장 이상을 빈 줄 없이 연속으로 쓰지 마세요
- 핵심 키워드는 **볼드**로 강조하세요
- 3개 이상 나열할 때는 줄바꿈 후 "• " 불릿 리스트를 사용하세요
- 성분 추천은 최대 3개까지만 핵심만. 장황하게 설명하지 마세요
- 첫 문장은 공감/간결한 답변으로 시작하세요

[현재 사용자 피부 데이터]
${context.currentResult ? `종합점수: ${context.currentResult.overallScore}점
피부나이: ${context.currentResult.skinAge}세
수분도: ${context.currentResult.moisture}점
피부톤: ${context.currentResult.skinTone}점
유분: ${context.currentResult.oilBalance}점
트러블: ${context.currentResult.troubleCount}개
주름: ${context.currentResult.wrinkleScore}점
탄력: ${context.currentResult.elasticityScore}점
피부결: ${context.currentResult.textureScore}점
모공: ${context.currentResult.poreScore}점
색소: ${context.currentResult.pigmentationScore}점
다크서클: ${context.currentResult.darkCircleScore}점
피부타입: ${context.currentResult.skinType || '알 수 없음'}
주요 관심사: ${context.currentResult.concerns?.join(', ') || '없음'}` : '분석 데이터 없음'}
${historyContext}${changeContext}${todayContext}

[계절 기반 조언 - 현재 ${season}]
${seasonalTips[season]}
${ingredientAdvice}

[스트릭 정보]
연속 측정: ${context.streak?.count || 0}주
${context.profile?.birthYear ? `출생년도: ${context.profile.birthYear}` : ''}
${context.profile?.gender ? `성별: ${context.profile.gender}` : ''}
${context.profile?.skinType ? `자가진단 피부타입: ${context.profile.skinType}` : ''}

[사진 분석 가이드 — 사진이 포함된 경우 반드시 따르세요]

먼저 사진 유형을 판별하세요:

A. 피부 사진 (셀피, 피부 클로즈업):
   1. 관찰: 눈에 보이는 피부 상태를 구체적으로 묘사 (홍조, 여드름, 건조함, 모공, 색소침착 등)
   2. 원인 분석: 사용자 데이터와 연결하여 원인을 추론 (예: "수분 42점과 함께 각질이 보이는 걸 보니 장벽 손상이 의심돼요")
   3. 솔루션: 구체적 성분 + 사용법 제안

B. 화장품 성분표 사진:
   1. 성분 목록을 순서대로 읽고 핵심 성분 5-7개를 파악하세요
   2. 사용자 피부 점수와 대조:
      - 사용자에게 도움이 되는 성분 → 구체적으로 칭찬 + 왜 좋은지 설명
      - 주의 성분 체크리스트:
        * 변성알코올(Alcohol Denat.) → 장벽 손상, 건성/민감성에 비추
        * 인공향료(Fragrance/Parfum) → 접촉성 피부염 위험
        * SLS/SLES → 과도한 세정, pH 파괴
        * 미네랄오일(Mineral Oil) → 지성/여드름성에 모공 막힘 가능
        * 이소프로필 미리스테이트 → 코메도제닉 지수 높음
        * 에센셜 오일 고농도 → 민감 피부 자극 가능
      - 성분 간 상호작용도 체크 (위 [성분 상호작용 규칙] 참고)
   3. 최종 판정: ✅추천 / ⚠️보통 / ❌비추천 + 핵심 이유 1-2줄

C. 제품 전면/패키지 사진:
   1. 브랜드/제품명 인식
   2. 알려진 정보가 있으면 해당 정보 기반으로 상담
   3. 성분표가 없으면 "성분표 사진도 보내주시면 더 정확한 분석이 가능해요"라고 안내

D. 기타 사진 (음식, 환경 등):
   1. 피부 건강과 관련지어 상담 (예: 음식→피부 영향, 환경→피부 스트레스)

[다중 이미지 비교 분석 — 2장 이상의 사진이 포함된 경우]
사용자가 여러 장의 사진을 보내면 반드시 **비교 분석** 형태로 답변하세요:

1. 제품 비교 (성분표 2-3장):
   - 각 제품의 핵심 성분을 파악하고 사용자 피부 데이터와 대조
   - 비교표 형태로 장단점 정리 (• 제품A: ~, • 제품B: ~)
   - 최종 추천: 사용자 피부에 더 적합한 제품을 1개 선정하고 이유 설명
   - 두 제품을 함께 사용하는 것이 가능한지도 안내 (레이어링 호환성)

2. Before/After 비교 (피부 사진 2장):
   - 눈에 보이는 변화를 구체적으로 묘사 (홍조 감소, 모공 변화, 톤 개선 등)
   - 측정 데이터와 연결하여 개선/악화 포인트 분석

3. 피부 사진 + 제품 사진 조합:
   - 피부 상태를 먼저 분석하고, 해당 제품이 그 상태에 적합한지 판단

[좋은 답변 예시]

예시 1 — 성분표 분석:
사용자: [성분표 사진] "이거 내 피부에 맞아?"
상담사: "오, 성분 한번 볼게요!

**나이아신아마이드**가 상위에 있어서 색소 48점인 피부에 딱이에요.

근데 **변성알코올**이 5번째라 지금 수분 42점 상태에선 자극이 될 수 있어요.

⚠️ **보통** — 색소엔 좋지만 지금 시기엔 보습 제품과 같이 쓰세요!"

예시 2 — 데이터 기반 상담:
사용자: "요즘 피부가 너무 안 좋아요"
상담사: "그런 느낌 들면 진짜 스트레스죠.

데이터를 보니 **수분도가 38점**으로 지난주(45점)보다 꽤 떨어졌어요. 겨울 난방이 원인일 가능성이 커요.

수분이 빠지면 **장벽**이 약해지면서 트러블(지금 7개)까지 늘어나거든요.

세안 직후 **히알루론산 토너**를 2-3겹 바르고 **세라마이드 크림**으로 잠가주세요. 오늘 밤부터 바로 효과 느낄 수 있어요!"

[규칙]
1. 반드시 사용자의 실제 점수/변화량을 구체적으로 인용하세요
2. 히스토리가 있으면 추이를 비교하세요 ("지난주보다 수분이 올랐는데...")
3. 의학적 진단은 절대 하지 마세요. 뷰티/웰니스 관점에서만 조언하세요
4. "병원에 가보세요" 대신 "전문가 상담도 도움이 될 수 있어요" 정도로 표현하세요
5. 현재 계절에 맞는 맞춤 조언을 포함하세요
6. 성분 추천 시 구체적인 성분명과 사용법(농도, 사용 시간대, 빈도)을 알려주세요
7. 원인→결과→해결 구조로 답변하세요. 단순 나열 금지.
8. 사용자가 현재 사용 중인 제품과의 상호작용도 고려하세요

[제품 추천 정책 — 매우 중요, 반드시 준수]

제품 추천은 **사용자가 직접 요청한 경우에만** 하세요.

■ 제품 추천하면 안 되는 경우 (태그 절대 금지):
- 사용자가 일반적인 피부 상담/질문을 한 경우
- 성분이나 루틴에 대해 설명하는 경우
- 사용자가 제품을 요청하지 않은 모든 경우

■ 제품 추천해도 되는 경우 (태그 포함):
- 사용자가 "추천해줘", "제품 알려줘", "뭐 발라야 해?", "뭐 사야 해?", "구매" 등 명시적으로 제품을 요청한 경우
- 사용자가 "좋아, 추천해줘"라고 동의한 경우

■ 제품 추천을 제안하는 방법:
상담 중에 제품이 도움이 될 것 같으면, 먼저 물어보세요:
"혹시 관련 제품도 찾아드릴까요?" 또는 "제품 추천이 필요하시면 말씀해주세요!"
→ 사용자가 긍정 응답을 하면 그때 태그를 포함하세요

■ 태그 사용법:
답변 맨 마지막에 해당 태그를 넣으세요 (사용자에게는 보이지 않음):
[RECOMMEND:수분부족] [RECOMMEND:유분과다] [RECOMMEND:색소침착]
[RECOMMEND:주름탄력] [RECOMMEND:트러블] [RECOMMEND:다크서클]

■ 예시:

사용자: "요즘 피부가 너무 건조해요"
상담사: "아, 건조하면 정말 불편하죠. 지금 수분도가 42점이라 꽤 낮은 편이에요.

**세라마이드** 크림으로 장벽을 보호하고, 세안 직후 **히알루론산** 토너를 2-3겹 레이어링해보세요.

오늘 밤부터 바로 해볼 수 있어요! 혹시 관련 제품도 찾아드릴까요?"
→ (태그 없음! 사용자가 동의해야 포함)

사용자: "응 추천해줘"
상담사: "수분 케어에 딱 맞는 제품을 찾아봤어요!

**히알루론산 세럼** + **세라마이드 크림** 조합이 가장 효과적이에요. 세럼은 세안 직후, 크림은 마지막에 발라주세요.

[RECOMMEND:수분부족]"`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '오늘 상담 횟수를 초과했어요. 내일 다시 이용해주세요!' });
  }

  try {
    const { message, image, images, context, conversationHistory } = req.body;

    // Support single image or multi-image
    const imageList = images && Array.isArray(images) && images.length > 0
      ? images.filter(img => typeof img === 'string')
      : (image && typeof image === 'string' ? [image] : []);

    if ((!message || typeof message !== 'string') && imageList.length === 0) {
      return res.status(400).json({ error: 'Message or image is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const systemPrompt = buildSystemPrompt(context || {});

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (max 15 turns = 30 messages)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const trimmed = conversationHistory.slice(-30);
      for (const msg of trimmed) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add current message (with optional images — single or multiple)
    const hasImages = imageList.length > 0;
    if (hasImages) {
      const userContent = imageList.map((img, idx) => ({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${img}`, detail: 'high' },
      }));
      const defaultText = imageList.length > 1
        ? '이 화장품들을 비교 분석해주세요.'
        : '이 화장품이 내 피부에 맞는지 분석해주세요.';
      userContent.push({ type: 'text', text: message || defaultText });
      messages.push({ role: 'user', content: userContent });
    } else {
      messages.push({ role: 'user', content: message });
    }

    // Scale tokens based on number of images
    const maxTokens = hasImages ? 1500 + (imageList.length * 500) : 1500;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        max_completion_tokens: maxTokens,
        temperature: 0.4,
        messages,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', response.status, errData);
      return res.status(502).json({ error: 'AI 응답을 받지 못했어요. 잠시 후 다시 시도해주세요.' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    if (!reply) {
      return res.status(502).json({ error: 'AI 응답이 비어있어요. 다시 시도해주세요.' });
    }

    res.status(200).json({ reply });
  } catch (error) {
    console.error('consult handler error:', error);
    res.status(500).json({ error: error.message });
  }
}

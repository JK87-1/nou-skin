const BEAUTY_TIPS = {
  moisture: {
    threshold: 60,
    label: '수분',
    tips: [
      '수분도가 낮아진 피부에는 히알루론산 세럼을 세안 직후 촉촉한 상태에서 바르면 효과가 2배예요!',
      '건조한 피부는 자는 동안 수분이 빠르게 증발해요. 오늘 밤 수면팩이나 두꺼운 크림으로 수분 증발을 막아보세요.',
      '세안 후 3분 안에 토너를 바르는 것이 수분 유지의 핵심이에요. 토너를 2-3겹 레이어링하면 더 효과적이에요.',
      '실내 습도가 40% 이하면 피부 수분이 급격히 줄어요. 가습기를 사용하거나, 미스트를 수시로 뿌려주세요.',
      '세라마이드 성분이 포함된 크림은 피부 장벽을 강화해 수분 증발을 막아줘요. 건조한 피부의 필수 성분이에요.',
      '수분 가득한 피부를 위해 하루 2L 물 마시기를 목표로 해보세요. 체내 수분이 곧 피부 수분이에요!',
      '커피나 녹차는 이뇨 작용으로 수분을 빼앗아요. 커피 한 잔 마실 때마다 물 한 잔을 함께 마셔보세요.',
      '오이, 수박, 토마토 같은 수분 많은 과일과 채소를 자주 먹으면 피부 수분도가 올라가요.',
      '뜨거운 물로 세안하면 피부 유분막이 벗겨져 건조해져요. 미지근한 물로 부드럽게 세안해보세요.',
      '에어컨이나 히터가 켜진 실내에서는 데스크 미스트를 곁에 두고 2시간마다 뿌려주세요.',
    ],
  },
  skinTone: {
    threshold: 60,
    label: '피부톤',
    tips: [
      '피부톤 균일도를 높이려면 비타민C 세럼을 아침에 사용하세요. 자외선 차단제와 함께 쓰면 시너지가 좋아요.',
      '자외선은 피부톤 불균일의 가장 큰 원인이에요. 실내에서도 SPF30+ 자외선 차단제를 꼭 발라주세요.',
      '나이아신아마이드는 멜라닌 전달을 억제해 피부톤을 균일하게 만들어줘요. 아침저녁 모두 사용 가능해요.',
      '선크림은 외출 30분 전에 바르고, 2시간마다 덧바르는 게 가장 효과적이에요. 스틱형이면 간편해요!',
      '토마토에 풍부한 라이코펜은 자외선 손상을 줄여줘요. 일주일에 3번 이상 토마토를 먹어보세요.',
      '운전할 때도 자외선이 유리창을 통과해요. 차 안에서도 선크림을 꼭 바르는 습관을 들여보세요.',
    ],
  },
  wrinkleScore: {
    threshold: 60,
    label: '주름',
    tips: [
      '주름 예방의 핵심은 자외선 차단이에요. 광노화가 주름의 80%를 차지한답니다. 오늘도 선크림 잊지 마세요!',
      '레티놀은 주름 개선에 가장 검증된 성분이에요. 저농도(0.025%)부터 시작해 피부를 적응시켜보세요.',
      '눈가 주름에는 펩타이드 아이크림이 효과적이에요. 약지로 톡톡 두드리듯 바르면 자극이 줄어요.',
      '콜라겐 생성을 촉진하는 아데노신 성분은 자극이 적어 민감한 피부에도 매일 사용할 수 있어요.',
      '옆으로 자는 습관은 한쪽 볼에 주름을 만들 수 있어요. 실크 베개커버를 사용하면 마찰을 줄일 수 있어요.',
      '빨대로 음료를 마시면 입가 주름이 생길 수 있어요. 가급적 컵으로 직접 마시는 걸 추천해요.',
      '하루 7-8시간 숙면은 피부 세포 재생의 골든타임이에요. 밤 10시~새벽 2시가 가장 중요해요.',
      '비타민C가 풍부한 키위, 딸기, 파프리카를 자주 먹으면 콜라겐 합성에 도움이 돼요.',
    ],
  },
  poreScore: {
    threshold: 60,
    label: '모공',
    tips: [
      '모공 관리의 첫걸음은 클렌징이에요. 오일 클렌징 후 폼 클렌징으로 이중 세안하면 모공 속 피지를 깨끗이 제거할 수 있어요.',
      'BHA(살리실산) 성분은 지용성이라 모공 속까지 침투해 피지를 녹여줘요. 주 2-3회 사용이 적당해요.',
      '나이아신아마이드는 피지 분비를 조절하고 모공을 조여주는 효과가 있어요. 꾸준히 사용하면 모공이 눈에 띄게 줄어요.',
      '메이크업을 한 날에는 클렌징을 특히 꼼꼼히 해주세요. 잔여물이 모공을 막아 블랙헤드의 원인이 돼요.',
      '얼음 찜질을 세안 후 30초~1분 해주면 모공이 일시적으로 축소되고 피부결이 매끄러워져요.',
      '기름진 음식과 단 음식은 피지 분비를 늘려요. 모공이 고민이라면 식단 조절도 함께 해보세요.',
    ],
  },
  elasticityScore: {
    threshold: 60,
    label: '탄력',
    tips: [
      '탄력 있는 피부를 위해 콜라겐 부스팅 성분(펩타이드, 바쿠치올)을 저녁 루틴에 추가해보세요.',
      '페이셜 마사지는 혈액순환을 촉진해 탄력 개선에 도움을 줘요. 크림 바를 때 위로 쓸어올리듯 마사지해보세요.',
      '항산화 성분(비타민C, 비타민E, 페룰산)은 콜라겐 분해를 막아 피부 탄력을 유지하는 데 핵심이에요.',
      '단백질이 풍부한 식단(달걀, 닭가슴살, 두부)은 콜라겐의 원료가 돼요. 매끼 단백질을 챙겨보세요.',
      '하루 30분 걷기나 가벼운 운동은 혈액순환을 개선해 피부에 영양 공급을 늘려줘요.',
      '고개를 숙이고 스마트폰을 보는 자세는 목과 턱선의 탄력을 떨어뜨려요. 눈높이로 들어서 보세요!',
      '콜라겐 보충제보다 비타민C를 함께 섭취하는 게 더 효과적이에요. 비타민C가 콜라겐 합성을 돕거든요.',
    ],
  },
  pigmentationScore: {
    threshold: 60,
    label: '색소',
    tips: [
      '색소 침착 개선에는 비타민C 세럼이 효과적이에요. 아침에 사용하고 자외선 차단제를 꼭 함께 발라주세요.',
      '알부틴과 코직산은 멜라닌 생성을 억제해 기미와 잡티를 옅게 만들어줘요. 저녁 루틴에 추가해보세요.',
      '각질 제거(AHA)를 주 1-2회 하면 색소가 침착된 오래된 각질이 탈락되어 피부톤이 밝아져요.',
      '트러블을 짜고 난 자리는 색소 침착이 잘 돼요. 자극 후에는 반드시 선크림을 꼼꼼히 발라주세요.',
      '모자나 양산은 자외선을 70% 이상 차단해줘요. 외출할 때 선크림과 함께 챙기면 색소 예방에 좋아요.',
    ],
  },
  textureScore: {
    threshold: 60,
    label: '피부결',
    tips: [
      '피부결 개선에는 AHA(글리콜산)가 효과적이에요. 저농도(5-8%)부터 주 2회 사용해보세요.',
      'PHA(폴리하이드록시산)는 AHA보다 자극이 적으면서 피부결을 매끄럽게 해줘요. 민감한 피부에도 사용 가능해요.',
      '충분한 보습이 피부결 개선의 기본이에요. 각질이 들뜨지 않도록 세안 직후 보습제를 꼭 바르세요.',
      '수건으로 얼굴을 세게 문지르면 피부결이 거칠어져요. 깨끗한 수건으로 톡톡 눌러서 물기를 제거하세요.',
      '일주일에 한 번 부드러운 스크럽이나 필링 젤로 각질 관리를 하면 피부가 한결 매끄러워져요.',
      '하루에 과일 2종류 이상 먹기! 비타민과 항산화 성분이 피부 세포 턴오버를 도와줘요.',
    ],
  },
  darkCircleScore: {
    threshold: 60,
    label: '다크서클',
    tips: [
      '다크서클 완화에는 카페인 성분 아이크림이 효과적이에요. 냉장 보관 후 사용하면 부기 완화에도 좋아요.',
      '비타민K는 눈가 혈액순환을 개선해 다크서클을 줄여줘요. 저녁 루틴에 비타민K 아이크림을 추가해보세요.',
      '충분한 수면은 다크서클 개선의 기본이에요. 7-8시간 수면과 베개를 살짝 높이면 눈가 부종이 줄어요.',
      '눈을 자주 비비면 색소 침착이 생겨 다크서클이 진해져요. 가려울 땐 차가운 수건을 올려보세요.',
      '자기 전에 짠 음식을 먹으면 아침에 눈이 부어요. 저녁 식단에서 나트륨을 줄여보세요.',
      '하루 10분 눈 주위 지압을 해보세요. 눈썹 뼈를 따라 부드럽게 누르면 혈액순환이 좋아져요.',
    ],
  },
  oilBalance: {
    threshold: 40,
    label: '유분',
    tips: [
      '유분이 과다하면 수분이 부족하다는 신호일 수 있어요. 가벼운 수분 에센스로 유수분 밸런스를 맞춰보세요.',
      '클레이 마스크를 주 1-2회 사용하면 과잉 피지를 흡착해 T존 유분을 조절할 수 있어요.',
      '유분기가 많은 피부도 보습이 필요해요. 오일프리 수분 크림을 사용하면 번들거림 없이 보습할 수 있어요.',
      '세안을 너무 자주 하면 오히려 피지가 더 많이 분비돼요. 아침저녁 2번이 적당해요.',
      '기름종이보다 미스트를 뿌린 뒤 가볍게 눌러주면 유분을 잡으면서 수분도 보충할 수 있어요.',
      '매운 음식, 튀긴 음식, 유제품은 피지 분비를 촉진할 수 있어요. 유분이 고민이면 식단을 체크해보세요.',
    ],
  },
  troubleCount: {
    threshold: 40,
    label: '트러블',
    tips: [
      '트러블 피부에는 시카(병풀추출물) 성분이 진정 효과가 뛰어나요. 자극 없이 염증을 가라앉혀줘요.',
      '트러블을 손으로 짜면 세균 감염과 흉터의 원인이 돼요. 패치를 붙이거나 스팟 트리트먼트를 사용하세요.',
      '살리실산(BHA) 스팟 트리트먼트는 트러블 부위에만 집중적으로 작용해 빠르게 진정시켜줘요.',
      '스마트폰 화면에는 세균이 가득해요. 통화할 때 얼굴에 닿지 않도록 이어폰을 사용하는 것도 방법이에요.',
      '베개커버, 수건은 자주 교체해주세요. 세균이 번식하면 트러블의 직접적인 원인이 돼요.',
      '스트레스를 받으면 코르티솔이 분비되어 트러블이 늘어요. 오늘 하루 좋아하는 일로 기분 전환해보세요!',
      '단 음식과 밀가루 음식은 혈당을 급격히 올려 피지 분비를 촉진해요. 간식을 견과류로 바꿔보세요.',
    ],
  },
};

const GENERAL_TIPS = [
  '피부가 전반적으로 건강한 상태예요! 현재 루틴을 유지하면서 자외선 차단에 신경 쓰면 더 좋아질 거예요.',
  '오늘 물을 충분히 마셨나요? 하루 2L의 수분 섭취는 피부 수분도에 직접적인 영향을 줘요.',
  '스트레스는 피부 노화를 촉진해요. 오늘 하루 5분 명상이나 심호흡으로 마음을 편안하게 해보세요.',
  '잠자기 전 스마트폰 블루라이트는 피부에도 좋지 않아요. 취침 1시간 전에는 스크린을 줄여보세요.',
  '베개커버를 일주일에 2번 이상 교체하면 트러블 예방에 큰 도움이 돼요.',
  '하루 30분 유산소 운동은 혈액순환을 개선해 피부에 산소와 영양을 공급해줘요. 오늘 산책 어때요?',
  '과일, 채소를 하루 5가지 이상 먹으면 피부에 필요한 비타민과 미네랄을 충분히 섭취할 수 있어요.',
  '잠자기 전 따뜻한 허브티 한 잔은 수면의 질을 높여 피부 재생을 도와줘요.',
  '하루에 한 번은 환기를 시켜주세요. 실내 공기 질이 좋아야 피부도 건강해져요.',
  '샤워 후 3분 이내에 바디로션을 바르면 수분이 날아가기 전에 잡아줄 수 있어요.',
  '손은 하루에도 수십 번 얼굴을 만져요. 손 씻기를 습관화하면 트러블 예방에 효과적이에요.',
  '외출 후 돌아오면 바로 클렌징하는 습관! 미세먼지와 노폐물이 피부에 오래 머물수록 안 좋아요.',
  '오메가3가 풍부한 연어, 호두, 아마씨는 피부 장벽을 강화하고 염증을 줄여줘요.',
  '너무 뜨거운 물로 샤워하면 피부 유분막이 벗겨져요. 미지근한 물로 짧게 샤워하는 게 좋아요.',
  '술은 피부를 탈수시키고 붓기와 주름의 원인이 돼요. 음주 후에는 수분 보충에 더 신경 써주세요.',
];

const SEASONAL_TIPS = {
  봄: [
    '봄바람은 건조해서 피부 수분을 빼앗아가요. 외출 시 미스트를 휴대하면 간편하게 수분 보충할 수 있어요.',
    '봄철 꽃가루와 미세먼지는 피부 자극의 원인이에요. 외출 후 꼼꼼한 클렌징이 더 중요한 계절이에요.',
    '봄부터 자외선이 강해지기 시작해요. SPF50 선크림으로 갈아타고, 모자도 챙겨보세요!',
    '환절기에는 피부가 예민해지기 쉬워요. 새로운 제품보다는 순한 기존 제품을 유지하는 게 안전해요.',
  ],
  여름: [
    '여름에는 땀과 피지가 늘어나요. 가벼운 수분 젤이나 로션으로 바꾸면 피부 부담이 줄어요.',
    '냉방 중인 실내는 사막보다 건조할 수 있어요. 에어컨 아래에서는 미스트를 자주 뿌려주세요.',
    '여름 자외선은 겨울의 3배예요. 선크림을 2시간마다 덧바르고, 긴 소매도 도움이 돼요.',
    '수박, 참외 같은 여름 과일은 수분이 90% 이상이에요. 맛있게 먹으면서 피부 수분도 채워보세요!',
    '땀을 많이 흘린 후에는 미지근한 물로 가볍게 세안하고 보습해주세요. 땀이 마르면 피부가 건조해져요.',
  ],
  가을: [
    '가을은 일교차가 커서 피부 장벽이 약해지기 쉬워요. 세라마이드 크림으로 장벽을 강화해보세요.',
    '가을부터 보습 레벨을 한 단계 올려야 해요. 토너→에센스→크림 3단계를 꼭 지켜보세요.',
    '가을 자외선도 무시 못 해요. 선크림은 사계절 필수! 날씨가 흐려도 꼭 바르세요.',
    '건조한 가을에는 립밤도 잊지 마세요. 입술이 트면 인상 전체가 건조해 보여요.',
    '환절기 피부 트러블이 늘었다면, 필링은 잠시 쉬고 진정 케어에 집중해보세요.',
  ],
  겨울: [
    '겨울철에는 핸드크림 잊지 마세요! 손은 얼굴 다음으로 나이가 드러나는 부위예요.',
    '겨울 실내 난방은 피부 수분을 앗아가요. 가습기를 사용하거나 젖은 수건을 걸어두세요.',
    '뜨거운 물 세안은 겨울에 특히 주의! 미지근한 물로 세안하고 즉시 보습하세요.',
    '겨울에는 크림을 한 겹 더 바르세요. 유분기 있는 크림이 수분 증발을 막아줘요.',
    '겨울철 입술이 자주 트나요? 립밤을 바른 뒤 랩을 올려 5분 두면 집중 보습 효과가 있어요.',
    '겨울에는 바디 보습도 중요해요. 정강이와 팔꿈치가 건조하지 않은지 체크해보세요.',
  ],
};

function findWeakestMetrics(skinData) {
  return Object.entries(BEAUTY_TIPS)
    .map(([key, config]) => {
      const value = skinData[key] ?? 50;
      return { key, value, threshold: config.threshold };
    })
    .filter((m) => m.value < m.threshold)
    .sort((a, b) => a.value - b.value);
}

function pickRuleBasedTip(skinData, lastTipCategory, goalMetrics) {
  const weak = findWeakestMetrics(skinData);

  // 30% chance to pick a seasonal or general lifestyle tip
  if (Math.random() < 0.3 || weak.length === 0) {
    const season = getSeason();
    const seasonalTips = SEASONAL_TIPS[season] || [];
    const pool = [...GENERAL_TIPS, ...seasonalTips];
    return {
      category: 'lifestyle',
      tip: pool[Math.floor(Math.random() * pool.length)],
    };
  }

  // Prioritize goal metrics: if user has active goals, 60% chance to pick from goal metrics
  if (goalMetrics && goalMetrics.length > 0 && Math.random() < 0.6) {
    const goalCandidates = goalMetrics
      .filter((key) => BEAUTY_TIPS[key] && key !== lastTipCategory)
      .slice(0, 3);
    if (goalCandidates.length > 0) {
      const key = goalCandidates[Math.floor(Math.random() * goalCandidates.length)];
      const tips = BEAUTY_TIPS[key].tips;
      return { category: key, tip: tips[Math.floor(Math.random() * tips.length)] };
    }
  }

  const candidates = weak.slice(0, 3);
  const nonRepeat = candidates.filter((c) => c.key !== lastTipCategory);
  const chosen =
    nonRepeat.length > 0
      ? nonRepeat[Math.floor(Math.random() * nonRepeat.length)]
      : candidates[0];

  const tips = BEAUTY_TIPS[chosen.key].tips;
  const tip = tips[Math.floor(Math.random() * tips.length)];

  return { category: chosen.key, tip };
}

function getSeason() {
  const month = ((new Date().getUTCMonth() + 9) % 12) + 1; // KST month
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}

function buildTipPrompt(skinData, profile) {
  return `당신은 뷰티 전문 상담사입니다. 사용자의 피부 데이터를 분석하여 맞춤형 뷰티 팁을 한 가지만 제공하세요.

[사용자 정보]
피부타입: ${profile.skinType || '알 수 없음'}
피부 고민: ${profile.skinConcerns || '없음'}
민감도: ${profile.sensitivity || '보통'}

[최근 피부 측정 데이터 (0-100점, 높을수록 좋음)]
종합점수: ${skinData.overallScore || '-'}점
피부나이: ${skinData.skinAge || '-'}세
수분도: ${skinData.moisture || '-'}점
피부톤: ${skinData.skinTone || '-'}점
주름: ${skinData.wrinkleScore || '-'}점
모공: ${skinData.poreScore || '-'}점
탄력: ${skinData.elasticityScore || '-'}점
색소: ${skinData.pigmentationScore || '-'}점
피부결: ${skinData.textureScore || '-'}점
다크서클: ${skinData.darkCircleScore || '-'}점
유분: ${skinData.oilBalance || '-'}점
트러블: ${skinData.troubleCount || '-'}점

현재 계절: ${getSeason()}

[규칙]
1. 가장 점수가 낮은 지표에 초점을 맞추되, 피부 타입과 계절을 고려하세요
2. 구체적인 성분명과 사용법을 포함하세요
3. 2-3문장으로 간결하게 작성하세요
4. 따뜻하고 격려하는 말투로 작성하세요 (~해요 체)
5. 푸시 알림이므로 줄바꿈 없이 한 문단으로 작성하세요
6. 절대 의학적 진단을 하지 마세요`;
}

async function generateAITip(skinData, profile) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_completion_tokens: 200,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: '당신은 한국어로 답변하는 뷰티 전문 상담사입니다. 푸시 알림용 짧은 팁을 작성합니다.',
          },
          { role: 'user', content: buildTipPrompt(skinData, profile) },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const webpush = (await import('web-push')).default;
    const { Redis } = await import('@upstash/redis');

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:luaskin.co@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );

    const isTest = req.query.test === '1';

    const now = new Date();
    const kstHour = (now.getUTCHours() + 9) % 24;
    const kstMinute = now.getUTCMinutes();
    const targetTime = `${String(kstHour).padStart(2, '0')}:${String(kstMinute).padStart(2, '0')}`;
    const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = kstDate.toISOString().split('T')[0];

    const hashes = await redis.smembers('push:subs');
    if (!hashes || hashes.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No subscriptions' });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const staleHashes = [];
    const errors = [];

    for (const hash of hashes) {
      const sub = await redis.hgetall(`push:sub:${hash}`);
      if (!sub || !sub.endpoint) {
        staleHashes.push(hash);
        continue;
      }

      if (!isTest) {
        // Skip if tip not enabled
        if (sub.tipEnabled !== 'true') {
          skipped++;
          continue;
        }
        // Match exact HH:MM
        const subTipTime = sub.tipTime || '20:00';
        if (subTipTime !== targetTime) {
          skipped++;
          continue;
        }
        // Dedup: skip if already sent today
        if (sub.lastTipDate === today) {
          skipped++;
          continue;
        }
      }

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      const nickname = sub.nickname || '';

      // Parse skin data
      let skinData = {};
      try {
        skinData = sub.skinData ? JSON.parse(sub.skinData) : {};
      } catch {
        skinData = {};
      }

      let profile = {
        skinType: sub.skinType || '',
        skinConcerns: sub.skinConcerns || '',
        sensitivity: sub.sensitivity || '',
      };

      let tipText;
      let tipCategory = 'general';

      // No skin data? Send general tip with CTA
      if (!sub.skinData || Object.keys(skinData).length === 0) {
        tipText = '피부 분석을 하면 나에게 딱 맞는 뷰티 팁을 받을 수 있어요! 지금 측정해보세요.';
      } else {
        // 70% rule-based, 30% AI
        const useAI = Math.random() >= 0.7;

        if (useAI) {
          // Check cache first
          const cached = await redis.get(`tip:ai:${hash}`);
          if (cached) {
            try {
              const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
              tipText = parsed.tip;
              tipCategory = parsed.category || 'ai';
            } catch {
              tipText = null;
            }
          }

          if (!tipText) {
            tipText = await generateAITip(skinData, profile);
            if (tipText) {
              tipCategory = 'ai';
              await redis.set(`tip:ai:${hash}`, JSON.stringify({ tip: tipText, category: 'ai', generatedAt: new Date().toISOString() }), { ex: 86400 });
            }
          }
        }

        // Fallback to rule-based if AI failed or not selected
        if (!tipText) {
          let goalKeys = null;
          try {
            goalKeys = sub.goalMetrics ? JSON.parse(sub.goalMetrics) : null;
          } catch { goalKeys = null; }
          const result = pickRuleBasedTip(skinData, sub.lastTipCategory || '', goalKeys);
          tipText = result.tip;
          tipCategory = result.category;
        }
      }

      const greeting = nickname ? `${nickname}님, ` : '';
      const payload = JSON.stringify({
        type: 'tip',
        title: '오늘의 뷰티 팁',
        body: `${greeting}${tipText}`,
        url: '/',
      });

      try {
        await webpush.sendNotification(pushSubscription, payload);
        sent++;

        // Update last tip info — skip dedup update in test mode
        if (!isTest) {
          await redis.hset(`push:sub:${hash}`, {
            lastTipCategory: tipCategory,
            lastTipDate: today,
          });
        } else {
          await redis.hset(`push:sub:${hash}`, { lastTipCategory: tipCategory });
        }
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleHashes.push(hash);
        }
        failed++;
        errors.push({ hash, status: err.statusCode, message: err.body || err.message });
      }
    }

    // Clean up stale subscriptions
    for (const hash of staleHashes) {
      await redis.del(`push:sub:${hash}`);
      await redis.srem('push:subs', hash);
    }

    return res.status(200).json({
      sent,
      failed,
      skipped,
      cleaned: staleHashes.length,
      total: hashes.length,
      targetTime,
      today,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('push-tips error:', error);
    return res.status(500).json({ error: error.message });
  }
}

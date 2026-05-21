/**
 * UserMemoryStorage — 사용자 관심사·자주 묻는 주제·라이프스타일 누적 (멀티턴 기억).
 *
 * "가장 똑똑한 나만의 뷰티 에이전트"의 핵심:
 * 1. 자주 묻는 주제 (metric 기반) — 다음 채팅에서 자연 인용
 * 2. 라이프스타일 단서 (수면·스트레스·환경·식이) — 사용자가 흘린 정보를 자동 저장,
 *    다음 채팅에서 "지난번에 잠 부족하시다 하셨었는데..." 식으로 회상
 *
 * localStorage 'nou_' prefix → AutoBackup 자동 백업.
 */

const MEMORY_KEY = 'nou_user_memory';
const MAX_RECENT_TOPICS = 10;
const MAX_LIFESTYLE_NOTES = 12;

// ===== 메시지에서 metric 키워드 추출 룰 (자주 묻는 주제) =====
const TOPIC_KEYWORDS = {
  moisture: ['수분', '건조', '촉촉', '보습', '히알', '세라마이드'],
  troubleCount: ['트러블', '뾰루지', '여드름', '뽀루지', '염증', '시카'],
  darkCircleScore: ['다크서클', '눈밑', '눈가', '눈 밑'],
  wrinkleScore: ['주름', '잔주름', '레티놀'],
  oilBalance: ['유분', '번들', '피지', '오일', '기름'],
  pigmentationScore: ['색소', '잡티', '기미', '주근깨', '비타민C', '나이아신'],
  poreScore: ['모공'],
  textureScore: ['피부결', '결', '각질'],
  elasticityScore: ['탄력', '처짐', '펩타이드'],
  skinTone: ['톤', '칙칙', '안색', '광채'],
  makeup: ['화장', '메이크업', '베이스', '파운데이션', '컨실러'],
  routine: ['루틴', '순서', '단계'],
  sun: ['자외선', '선크림', '햇빛', 'SPF'],
};

// ===== 라이프스타일 카테고리 추출 룰 =====
// 사용자가 채팅 중에 흘린 라이프스타일 단서를 자동 저장 → 회상에 활용.
// 패턴은 단어 + 맥락 동사 조합으로 false-positive 줄임.
const LIFESTYLE_RULES = [
  {
    key: 'sleep_short',
    label: '수면 부족',
    patterns: [
      /(잠|수면).{0,8}(부족|못|적|짧|모자|안 자|적게)/,
      /(\d|한|두|세|네|다섯)\s*시간.*(밖에|만|정도).*(자|잠)/,
      /(밤샘|새벽|불면|잠 안)/,
      /(못 잤|잠을 못|잤어요)/,
    ],
    advice: '수면이 부족하면 다크서클·트러블·탄력에 직접 영향',
  },
  {
    key: 'sleep_good',
    label: '수면 충분',
    patterns: [/(잘 자|푹 자|7시간|8시간|충분히 자)/],
    advice: '수면 충분하면 회복 속도 빠름',
  },
  {
    key: 'stress_high',
    label: '스트레스 높음',
    patterns: [
      /(스트레스|예민|불안|초조|긴장|피곤|지쳐)/,
      /(번아웃|과로|야근|시험|마감)/,
    ],
    advice: '스트레스는 코르티솔 분비로 트러블·유분 증가 유발',
  },
  {
    key: 'sun_exposure',
    label: '자외선 노출 많음',
    patterns: [
      /(햇빛|자외선|야외).{0,6}(많|오래|길)/,
      /(운전|골프|등산|해변|수영장|러닝)/,
      /(선크림 안|차단제 안)/,
    ],
    advice: '자외선 누적은 색소·주름 진행의 핵심 원인',
  },
  {
    key: 'indoor_dry',
    label: '실내 건조',
    patterns: [
      /(난방|히터|에어컨|건조한 실내|사무실 건조|기내|비행기)/,
      /(가습기 없)/,
    ],
    advice: '실내 건조는 TEWL 증가 → 수분 손실',
  },
  {
    key: 'diet_caffeine',
    label: '카페인 과다',
    patterns: [
      /(커피|아메리카노|에스프레소).{0,6}(많|매일|여러|N잔|마셔)/,
      /(카페인 과)/,
    ],
    advice: '카페인 과다는 이뇨 작용으로 수분 손실',
  },
  {
    key: 'diet_sugar',
    label: '단 음식·당분 섭취',
    patterns: [
      /(단 거|디저트|초콜릿|당 섭취|설탕 많)/,
      /(빵|쿠키|아이스크림).{0,4}(많|자주)/,
    ],
    advice: '과당화(AGE)로 탄력·피부톤 영향',
  },
  {
    key: 'exercise_yes',
    label: '운동 함',
    patterns: [
      /(운동|헬스|요가|필라테스|러닝|등산|수영|자전거).{0,6}(매일|주\s*\d|규칙|꾸준)/,
    ],
    advice: '운동은 혈류·산소 공급으로 피부톤·회복 도움',
  },
  {
    key: 'period',
    label: '생리 주기',
    patterns: [
      /(생리|월경|배란|호르몬|pms|PMS|마법|마법의|그날)/,
    ],
    advice: '호르몬 주기 따라 유분·트러블 변동',
  },
  {
    key: 'season_change',
    label: '환절기',
    patterns: [
      /(환절기|갑자기 추워|갑자기 더워|온도 차|일교차)/,
    ],
    advice: '환절기는 피부 장벽이 적응 못해 민감해짐',
  },
];

function emptyMemory() {
  return {
    topicCounts: {},       // { metric: count }
    recentTopics: [],      // [{ metric, at, snippet }, ...] 최근 10개
    lifestyle: {},         // { lifestyleKey: { count, firstAt, lastAt, snippets: [...] } }
    totalMessages: 0,
    firstMessageAt: null,
    lastMessageAt: null,
  };
}

export function getUserMemory() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    const parsed = raw ? JSON.parse(raw) : emptyMemory();
    // 호환: lifestyle 필드 없는 옛 메모리에 추가
    if (!parsed.lifestyle) parsed.lifestyle = {};
    return parsed;
  } catch {
    return emptyMemory();
  }
}

function saveUserMemory(m) {
  try { localStorage.setItem(MEMORY_KEY, JSON.stringify(m)); } catch {}
}

/**
 * 사용자 메시지에서 keyword·라이프스타일 추출 → 카운터 누적.
 * 메시지 전송 시점에 호출.
 */
export function recordUserMessage(message) {
  if (!message || typeof message !== 'string') return;
  const memory = getUserMemory();
  const now = Date.now();

  // 1) Topic (metric 키워드)
  const matched = [];
  for (const [metric, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(k => message.includes(k))) {
      memory.topicCounts[metric] = (memory.topicCounts[metric] || 0) + 1;
      matched.push(metric);
    }
  }
  for (const m of matched) {
    memory.recentTopics.unshift({
      metric: m,
      at: now,
      snippet: message.slice(0, 60),
    });
  }
  memory.recentTopics = memory.recentTopics.slice(0, MAX_RECENT_TOPICS);

  // 2) Lifestyle (자유 텍스트 패턴 매칭)
  for (const rule of LIFESTYLE_RULES) {
    if (rule.patterns.some(p => p.test(message))) {
      const entry = memory.lifestyle[rule.key] || { count: 0, firstAt: now, lastAt: now, snippets: [] };
      entry.count = (entry.count || 0) + 1;
      entry.lastAt = now;
      entry.label = rule.label;
      entry.advice = rule.advice;
      const snippet = message.slice(0, 80);
      if (!entry.snippets.includes(snippet)) {
        entry.snippets.unshift(snippet);
        entry.snippets = entry.snippets.slice(0, 3); // 최근 3개만
      }
      memory.lifestyle[rule.key] = entry;
    }
  }
  // lifestyle 최대 항목 수 — 너무 많이 쌓이지 않게
  const keys = Object.keys(memory.lifestyle);
  if (keys.length > MAX_LIFESTYLE_NOTES) {
    // 오래된 lastAt 기준 정리
    const sorted = keys.map(k => ({ k, lastAt: memory.lifestyle[k].lastAt || 0 }))
      .sort((a, b) => b.lastAt - a.lastAt);
    const next = {};
    for (const { k } of sorted.slice(0, MAX_LIFESTYLE_NOTES)) next[k] = memory.lifestyle[k];
    memory.lifestyle = next;
  }

  memory.totalMessages = (memory.totalMessages || 0) + 1;
  if (!memory.firstMessageAt) memory.firstMessageAt = now;
  memory.lastMessageAt = now;

  saveUserMemory(memory);
}

/**
 * 상담사 prompt 에 보낼 메모리 컨텍스트.
 * 핵심 관심사·라이프스타일·마지막 주제·경과 시간 추출.
 */
export function getMemoryContext() {
  const memory = getUserMemory();
  if (!memory.totalMessages || memory.totalMessages === 0) return null;

  const topTopics = Object.entries(memory.topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([metric, count]) => ({ metric, count }));

  const lastTopic = memory.recentTopics[0] || null;
  const daysSinceLastMessage = memory.lastMessageAt
    ? Math.floor((Date.now() - memory.lastMessageAt) / 86400000)
    : null;
  const daysSinceFirstMessage = memory.firstMessageAt
    ? Math.floor((Date.now() - memory.firstMessageAt) / 86400000)
    : null;

  // 라이프스타일 — 최근 14일 이내 + 카운트 2+ 또는 카운트 1이라도 최근 3일 이내
  const now = Date.now();
  const lifestyle = Object.entries(memory.lifestyle || {})
    .map(([key, entry]) => ({
      key,
      label: entry.label,
      advice: entry.advice,
      count: entry.count,
      daysSince: entry.lastAt ? Math.floor((now - entry.lastAt) / 86400000) : null,
      snippet: entry.snippets?.[0] || null,
    }))
    .filter(l => {
      if (l.daysSince == null) return false;
      if (l.count >= 2 && l.daysSince <= 14) return true;
      if (l.count >= 1 && l.daysSince <= 3) return true;
      return false;
    })
    .sort((a, b) => (b.count - a.count) || (a.daysSince - b.daysSince))
    .slice(0, 5);

  return {
    totalMessages: memory.totalMessages,
    topTopics,
    lastTopic,
    daysSinceLastMessage,
    daysSinceFirstMessage,
    lifestyle,
  };
}

export function clearUserMemory() {
  try { localStorage.removeItem(MEMORY_KEY); } catch {}
}

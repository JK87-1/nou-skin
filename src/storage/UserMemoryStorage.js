/**
 * UserMemoryStorage — 사용자 관심사·자주 묻는 주제 누적 (멀티턴 기억)
 *
 * 진짜 똑똑한 뷰티 에이전트의 핵심: 사용자가 자주 묻는 주제·관심 metric을 기억하고
 * 다음 채팅에서 자연스럽게 반영 ("지난번에 다크서클 물어보셨었죠").
 *
 * localStorage 'nou_' prefix → AutoBackup이 자동 백업.
 */

const MEMORY_KEY = 'nou_user_memory';
const MAX_RECENT_TOPICS = 10;

// 메시지에서 metric 키워드 추출 룰
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

function emptyMemory() {
  return {
    topicCounts: {},       // { metric: count }
    recentTopics: [],      // [{ metric, at, snippet }, ...] 최근 10개
    totalMessages: 0,
    firstMessageAt: null,
    lastMessageAt: null,
  };
}

export function getUserMemory() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    return raw ? JSON.parse(raw) : emptyMemory();
  } catch {
    return emptyMemory();
  }
}

function saveUserMemory(m) {
  try { localStorage.setItem(MEMORY_KEY, JSON.stringify(m)); } catch {}
}

/**
 * 사용자 메시지에서 keyword 추출 → 카운터 누적
 * 메시지 전송 시점에 호출
 */
export function recordUserMessage(message) {
  if (!message || typeof message !== 'string') return;
  const memory = getUserMemory();
  const now = Date.now();

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

  memory.totalMessages = (memory.totalMessages || 0) + 1;
  if (!memory.firstMessageAt) memory.firstMessageAt = now;
  memory.lastMessageAt = now;

  saveUserMemory(memory);
}

/**
 * 상담사 prompt 에 보낼 메모리 컨텍스트
 * 핵심 관심사·마지막 주제·경과 시간 추출
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

  return {
    totalMessages: memory.totalMessages,
    topTopics,
    lastTopic,
    daysSinceLastMessage,
    daysSinceFirstMessage,
  };
}

export function clearUserMemory() {
  try { localStorage.removeItem(MEMORY_KEY); } catch {}
}

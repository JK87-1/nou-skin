// Vercel Serverless Function: OpenAI GPT-5.2 Vision skin analysis proxy
// Baseline image comparison for consistency + 3x API call median scoring

import { recordRequest, recordOutcome, getKstDate } from '../lib/stats.js';

const RATE_LIMIT = new Map();
// 베타 기간 상향: 가족·사무실 공유 IP에 다수 사용자 몰릴 가능성 대비.
// 베타 후 device-id 기반 rate limit 도입 시 다시 낮출 예정.
const MAX_REQUESTS_PER_DAY = 200;

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

[Step 0. 메이크업 감지 — 보수적 판단]
사진에서 메이크업(파운데이션, BB크림, 컨실러, 아이메이크업, 립 등) 착용 여부를 먼저 판별하세요.

※ false-positive 회피 — 다음은 메이크업이 아닙니다:
- 자연 피부 자체의 매끈함·균일한 톤
- 면도·세안 직후의 깨끗한 피부 (특히 남성)
- 자연광·LED 조명에 의한 광택·윤기
- 카메라 자동 보정·뷰티 필터에 의한 스무딩
- 한국인·동아시아인 특유의 균일한 피부톤

※ 확실히 보이는 단서가 있을 때만 true:
- 입술의 비자연스러운 색조 (틴트·립스틱)
- 눈 주변 명확한 아이라이너·마스카라·아이섀도우 색조
- 베이스 두께감 (피부결 위에 명백히 얹힌 파운데이션 층, 모공 막힘)
- 컨실러로 인한 부분적 톤 불일치

※ 애매하거나 의심 정도면 반드시 false. 사용자 신뢰도가 false positive에 매우 민감합니다.

- 메이크업이 명백히 감지되면: 화장으로 가려진 부분은 보이는 그대로 평가하되, analysis.summary에 메이크업이 감지되었음을 명시하고, 클렌징 후 재측정을 권장하세요. JSON에 "makeupDetected":true를 포함하세요.
- 메이크업이 없거나 애매하면: "makeupDetected":false로 설정하고 일반 분석을 진행하세요.

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
  ※ T존(이마·코·턱) 확대 정도 + U존(볼·관자놀이) 침범 여부를 분리 평가. 코 양옆 모공이 볼까지 번지면 5점 추가 감점.
  ※ 모공 모양도 본다: 둥근 형태(정상) vs 세로로 늘어진 형태(노화·중력 신호) — 늘어진 모공이 보이면 점수에 반영.
- 수분(moisture): 90-100 촉촉윤기, 70-89 정상, 50-69 약간건조, 30-49 건조, 0-29 심한건조
- 피부톤(skinTone): 90-100 매우균일, 70-89 양호, 50-69 부분홍조/칙칙, 30-49 색편차큼, 0-29 심한불균일
- 유분(oilBalance): 90-100 완벽균형, 70-89 약간유분기/건조, 50-69 T존번들거림, 30-49 전체유분과다, 0-29 극심한유분
- 트러블(troubleCount): 95-100 정말 깨끗(어떤 트러블 신호도 보이지 않을 때만), 85-94 미세 트러블 1~2개(작은 화이트헤드/블랙헤드/comedone 포함), 70-84 보이는 트러블 3~5개(mixed papule/pustule), 50-69 6~10개 산재, 30-49 11~15개 염증성 다수, 0-29 15개+ 심한 여드름
  ※ 트러블 카운트 핵심 룰: 작은 화이트헤드, 블랙헤드, 미세 papule/comedone도 반드시 1점씩 카운트하세요. 빨갛지 않은 미세 트러블도 카운트 대상입니다.
  ※ 트러블이 사진에 보이는데 95+ 점수를 주지 마세요. 0~5점만 깎고 끝내는 것도 금지입니다. 실제 보이는 트러블 개수에 비례해 점수를 분명히 깎으세요.
  ※ 메이크업/조명 때문에 가려진 경우엔 보이는 그대로 평가하고 analysis.summary에 "조명/메이크업으로 일부 가려진 가능성"을 언급하세요.

[트러블 종류별 분류 — troubleBreakdown]
troubleCount(0-100 점수) 외에 별도로 실제 개수를 5종으로 분류하세요:
- whitehead (화이트헤드): 흰 점, 닫힌 면포(closed comedone). 살색~흰색 작은 융기, 염증 없음
- blackhead (블랙헤드): 검은 점, 열린 면포(open comedone). 모공 입구가 검게 변색된 형태
- papule (구진): 붉고 단단한 솟음. 농(고름) 없는 염증성 트러블, 직경 1~5mm
- pustule (농포): 붉은 base + 중앙에 흰/노란 농(고름) 동반. 곪은 여드름
- nodule (결절·낭종): 깊은 염증성 큰 덩어리, 5mm+. 단단하거나 낭종 형태
※ 각 종류별 개수를 정수로 산출. 사진에 보이는 그대로 보수적으로 카운트.
※ troubleBreakdown 합계가 raw troubleCount(round((100-troubleCount)/8.5))와 비슷한 범위여야 합니다. 분류가 애매한 트러블은 papule로 분류.
※ 의료 진단 아닌 시각 추정임을 인지하고, 명확히 구분 가능한 것만 분류. 애매하면 papule로.
- 탄력(elasticity): 90-100 탱탱함, 70-89 양호, 50-69 약간처짐시작, 30-49 눈에띄는처짐, 0-29 심한처짐
- 피부결(texture): 90-100 매끈, 70-89 대체로고움, 50-69 약간거침/요철, 30-49 거친피부결, 0-29 매우거침
  ※ 부위별로 본다: 이마·콧등·턱의 매끈함 vs 볼의 모공 거침. 부위 편차가 크면 (예: 볼만 거친 경우) 평균보다 5점 감점.
  ※ 표면 신호: 각질(flaking), 미세요철, 닭살(keratosis pilaris), 흉터 자국·여드름 흉터. 각질·요철이 보이면 점수 깎기.
  ※ 빛 반사 균일도: 매끈한 피부는 빛이 균일하게 퍼짐. 거친 피부는 빛이 산란해 얼룩진 광택.
- 색소(pigmentation): 90-100 잡티없음, 70-89 소량잡티, 50-69 기미/잡티산재, 30-49 기미뚜렷, 0-29 심한색소침착
  ※ 패턴 구분 (부위별 호발 영역):
    · 광대·관자놀이 좌우 대칭 갈색 반점 → 멜라스마(기미·hormonal), 30+점 감점
    · 볼·이마·코의 작은 점 다수 → 일광 색소(sun spot)·주근깨, 면적에 비례 감점
    · 트러블 자국 위치의 갈색·붉은 흔적 → PIH(여드름 자국), 5~15점 감점
    · 눈가 회청색 색조 → 안중모반(Hori's nevus), 별도 인지
  ※ 면적 + 진하기 + 분포(국소/광범위) 종합 평가. 한 부위만 진하면 평균, 광범위하면 강하게 감점.
- 다크서클(darkCircles): 90-100 없음, 70-89 미세한그림자, 50-69 눈에띄는다크, 30-49 진한다크, 0-29 매우심한다크

[Step 4. JSON 출력]
분석 완료 후 반드시 아래 형식의 JSON을 ---JSON_START--- 와 ---JSON_END--- 태그 사이에 출력하세요:
---JSON_START---
{"moisture":숫자,"skinTone":숫자,"oilBalance":숫자,"troubleCount":숫자,"troubleBreakdown":{"whitehead":숫자,"blackhead":숫자,"papule":숫자,"pustule":숫자,"nodule":숫자},"wrinkles":숫자,"elasticity":숫자,"texture":숫자,"pores":숫자,"pigmentation":숫자,"darkCircles":숫자,"makeupDetected":true또는false,"analysis":{"summary":"정밀판독 2~3줄","details":["부위별 소견1","소견2","소견3"]}}
---JSON_END---

[analysis 작성 가이드 — 매우 중요]
- summary는 사용자에게 직접 보여지는 "AI 정밀 판독" 텍스트입니다
- 단순히 "피부가 건조합니다" 같은 뻔한 표현을 절대 쓰지 마세요
- 반드시 사진에서 실제로 관찰된 구체적 부위와 현상을 언급하세요
- 점수가 낮은 지표에 대해 "왜" 그런지 원인을 추론하세요
- 개선 방향을 구체적 성분명·방법과 함께 제시하세요

[톤·문체 가이드 — 자연도 핵심]
- 친구가 거울 앞에서 함께 살펴봐주는 듯한 톤 (의사 진단서 X)
- 명령조("~하세요")는 권유체("~해보세요", "~하면 좋아요", "~면 충분해요")로 부드럽게
- 일방적 단정 대신 따뜻한 관찰: "~해 보여요", "~인 것 같아요", "~한 느낌이에요"
- 어미 다양화: ~요 / ~예요 / ~거예요 / ~답니다 / ~네요 (자주 같은 어미 반복 금지)
- 약어·전문 용어(TEWL, NMF, MMP, mTOR, AGEs 등)는 사용 금지. 풀어 쓰거나 친근 표현으로 대체
  나쁜 예: "TEWL이 급증하는 상태" / "MMP 활성화로 콜라겐 파괴"
  좋은 예: "피부 속 수분이 빠르게 빠지고 있어요" / "햇빛이 탄력을 무너뜨리는 중이에요"
- 특정 브랜드명·제품명은 금지 ("마트릭실 3000" X). 성분군만: "펩타이드 계열", "레티놀", "비타민C", "나이아신아마이드", "세라마이드" 등
- 숫자 데이터(예: "콜라겐 합성 8배 증가")는 신뢰 있을 때만, 과장은 금지
- 부담 주는 표현 지양: "절대", "반드시", "필수" → "추천해요", "도움돼요", "꼭 함께 해주면 더 좋아요"

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

summary 예시 (매번 이것들과 다르게 쓸 것 — 친구가 같이 살펴봐주는 자연스러운 톤):
"T존엔 살짝 모공이 보이고 볼 쪽은 조금 건조해 보여요. 유수분 밸런스가 흐트러진 것 같은데, 가벼운 수분 에센스 위에 펩타이드 크림 한 겹이면 충분히 잡혀요."
"왼쪽 볼 색이 오른쪽보다 살짝 진해 보여요. 운전이나 햇빛 노출이 한쪽에 더 갔던 패턴인 것 같아요. 비타민C 세럼이랑 자외선 차단제 꾸준히 발라주면 점점 균일해질 거예요."
"피부결이 고르고 탄력도 좋은 편이에요. 다만 코 주변 모공이랑 다크서클이 살짝 신경 쓰이는데, 나이아신아마이드 토너랑 카페인 아이크림 조합이 도움될 거예요."
"눈 밑에 미세한 혈관이 비쳐 보이네요. 혈관형 다크서클인 것 같아요. 카페인 아이크림이 부기 빼주고, 비타민K가 순환을 도와줄 거예요. 이마는 정말 매끈한 편이라 지금 루틴이 잘 맞고 있어요."
"볼 쪽 수분 장벽이 살짝 약해진 느낌이에요. 세라마이드 크림으로 잠을 잘 자게 해주면 톤이랑 결이 같이 살아날 거예요. T존 유분은 지금 딱 좋은 균형이에요."
"인상적인 건 탄력 라인이에요. 하관이 탄탄하고 볼 볼륨도 잘 잡혀 있어요. 코 양옆에 모공이 조금 보이는데, BHA 토너 주 2회면 충분히 관리돼요."
"자세히 보면 이마 중앙에 얕은 가로 라인이 하나 보이네요. 아직 깊지 않아서 레티놀 살짝 시작하면 충분히 예방돼요. 전체 톤은 정말 균일한 편이에요."

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

const BREAKDOWN_KEYS = ['whitehead', 'blackhead', 'papule', 'pustule', 'nodule'];

function normalizeBreakdown(bd) {
  const out = { whitehead: 0, blackhead: 0, papule: 0, pustule: 0, nodule: 0 };
  if (!bd || typeof bd !== 'object') return out;
  for (const k of BREAKDOWN_KEYS) {
    const v = bd[k];
    out[k] = (typeof v === 'number' && v >= 0) ? Math.round(v) : 0;
  }
  return out;
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Time-based stabilization.
 * Allowed delta grows with days since baseline was created:
 *   same day: ±3, 1-2d: ±5, 3-5d: ±7, 1w: ±10, 2w: ±13, 1m+: ±15
 * Different person detection: average diff > 25 → skip stabilization.
 * (15 → 25로 상향. 디바이스·조명 차이로 점수가 20점 가까이 튀어도 동일인 가능성 우선.)
 */
function getAllowedDelta(daysSinceBaseline) {
  if (daysSinceBaseline < 1) return 3;
  if (daysSinceBaseline <= 2) return 5;
  if (daysSinceBaseline <= 5) return 7;
  if (daysSinceBaseline <= 7) return 10;
  if (daysSinceBaseline <= 14) return 13;
  return 15;
}

function stabilizeScores(scores, baselineResult, baselineTimestamp, deviceInfo, metricSpreads) {
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
  if (avgDiff > 25) return scores; // Different person (15→25, 디바이스 차이 흡수)

  // Time-based allowed delta
  const now = Date.now();
  const elapsed = baselineTimestamp ? now - baselineTimestamp : 0;
  const daysSince = elapsed / 86400000;
  let maxDelta = getAllowedDelta(daysSince);

  // ===== 크로스 디바이스 anchor 강화 =====
  // face descriptor가 same(동일인 확정) + 다른 디바이스에서 측정 시
  // → 디바이스 차이가 점수에 미친 영향을 강하게 흡수해야 함.
  // → maxDelta를 1/3로 축소(±2~5만 허용) + baseline weighted average 적용.
  const crossDevice = deviceInfo?.faceMatch === 'same' && deviceInfo?.differentDevice === true;
  if (crossDevice) {
    maxDelta = Math.max(2, Math.round(maxDelta / 3));
  }

  const stabilized = { ...scores };
  for (const key of SCORE_KEYS) {
    const current = scores[key];
    const baseline = baselineResult[key];
    if (typeof current === 'number' && typeof baseline === 'number') {
      let workingCurrent = current;
      // 크로스 디바이스이면 weighted average — baseline 60% + new 40%
      if (crossDevice) {
        workingCurrent = Math.round(baseline * 0.6 + current * 0.4);
      }
      const diff = workingCurrent - baseline;
      // 해당 메트릭의 3x spread가 크면 (>12) maxDelta를 1/2로 — GPT가 흔들리는 메트릭은 더 강한 anchor
      const spread = metricSpreads?.[key];
      const adjustedMax = typeof spread === 'number' && spread > 12
        ? Math.max(2, Math.round(maxDelta / 2))
        : maxDelta;
      // 트러블만 비대칭: 트러블 점수가 떨어지는 방향(=실제 트러블 증가)은 자유 허용.
      // baseline에 anchor돼서 새로 생긴 트러블이 감지 안 되는 문제 방지.
      // 점수가 오르는 방향(=실제 트러블 감소)은 stabilization 유지.
      const lower = key === 'troubleCount' ? -100 : -adjustedMax;
      const upper = adjustedMax;
      const clamped = Math.max(lower, Math.min(upper, diff));
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
    parsed.troubleBreakdown = normalizeBreakdown(parsed.troubleBreakdown);
    return parsed;
  } catch { return null; }
}

async function callGPT(apiKey, newImage, seed, baselineImage, baselineResult, deviceInfo) {
  const userContent = [];

  const deviceHint = deviceInfo?.differentDevice
    ? '\n\n[중요] 두 사진은 서로 다른 디바이스(다른 폰·카메라)로 촬영됐을 가능성이 큽니다. 디바이스마다 색온도·노출·화이트밸런스가 다르므로 점수 차이가 크게 보여도 그건 디바이스 차이일 수 있어요. 점수가 아닌 **얼굴 윤곽·이목구비·특징**으로만 동일인 판별하세요.'
    : '';

  // Face descriptor 결과를 prompt에 명시 — 동일인 판단을 GPT가 결정론적으로 따르도록
  const faceMatchHint = deviceInfo?.faceMatch
    ? `\n\n[얼굴 임베딩 분석 결과 — 우선 참고]\nFace descriptor distance: ${deviceInfo.faceDistance ?? '?'}\n결론: ${deviceInfo.faceMatch === 'same' ? '**동일인 확정** (distance < 0.5). 점수 차이가 크더라도 동일인으로 처리하세요. differentPerson=false.' : deviceInfo.faceMatch === 'different' ? '**다른 사람 확정** (distance > 0.6). 점수가 비슷해도 다른 사람이에요. differentPerson=true.' : '**모호** (distance 0.5~0.6). 얼굴 특징으로 직접 판단하세요.'}`
    : '';

  if (baselineImage && baselineResult) {
    // ===== Dual-image comparison mode =====
    userContent.push({
      type: 'text',
      text: `[동일인 판별 — 매우 중요. 점수가 아닌 얼굴로 판별하세요]
첫 번째 사진=기준, 두 번째 사진=오늘. 다음 순서로 판별:

1) **얼굴 특징 기반 동일인 판별 (우선)**:
   - 눈 모양·크기·간격, 코 형태(콧대·콧방울), 입술 두께, 턱선·얼굴 윤곽, 광대·이마 비율
   - 눈썹 모양·털 흐름, 점·흉터 등 영구 특징
   - 위 특징이 일치하면 **동일인**. 점수 차이 무시.

2) **점수 차이는 보조 신호** (단독 판별 X):
   - 점수가 20점 이상 크게 달라도 디바이스·조명·메이크업 차이일 수 있음
   - 점수가 비슷해도 다른 사람일 수 있음

3) 명확히 다른 사람일 때만 "differentPerson":true:
   - 얼굴 윤곽·이목구비가 명확히 다른 경우만
   - 애매하면 false 우선 (동일인 가정)

판별 후:
- 동일인이면: 기준 점수(${JSON.stringify(baselineResult)})에 앵커. 조명/각도/디바이스 차이로 인한 점수 변동 최소화. 단 진짜 피부 변화는 반영.
- 다른 인물이면: 기준 점수 무시, 두 번째 사진만 독립 분석.${deviceHint}${faceMatchHint}`,
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
      max_completion_tokens: 2400,
      temperature: 0.3,
      top_p: 1,
      seed,
      messages: [
        {
          role: 'system',
          content: 'You are a dermatologist-level AI skin analyzer. Be consistent and deterministic. CRITICAL: Identify SAME vs DIFFERENT person by FACIAL FEATURES (eye shape, nose, lips, jawline, eyebrow shape, permanent marks like moles/scars) — NOT by score difference. Score differences of 20+ points across photos are USUALLY device/lighting differences, not person differences. Default to SAME person when uncertain. Only mark "differentPerson":true when facial features are clearly different. If DIFFERENT people, ignore baseline scores. If SAME person, anchor to baseline scores and minimize variation from lighting/angle/device differences. Output JSON between ---JSON_START--- and ---JSON_END--- markers.',
        },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    // 운영 로깅: OpenAI 실패 사유를 남겨 재발 시 vercel 로그로 즉시 진단.
    // (이전엔 조용히 null만 반환해 "All AI calls failed"의 원인을 알 수 없었음)
    const errText = await response.text().catch(() => '');
    console.error(`[analyze] OpenAI 호출 실패 ${response.status}: ${errText.slice(0, 200)}`);
    return null;
  }
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

  const startedAt = Date.now();
  const reqDate = getKstDate();
  recordRequest(reqDate);

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    recordOutcome(reqDate, 'rate_limit', Date.now() - startedAt);
    return res.status(429).json({ error: 'Rate limit exceeded. Try again tomorrow.' });
  }

  try {
    const { image, baselineImage, baselineResult, baselineTimestamp, currentDevice, differentDevice, baselineDevice, faceMatch, faceDistance } = req.body;
    const deviceInfo = {
      currentDevice: currentDevice || null,
      baselineDevice: baselineDevice || null,
      differentDevice: !!differentDevice,
      faceMatch: faceMatch || null, // 'same' | 'different' | 'ambiguous' | null
      faceDistance: typeof faceDistance === 'number' ? faceDistance : null,
    };

    if (!image) return res.status(400).json({ error: 'No image provided' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      recordOutcome(reqDate, 'failure', Date.now() - startedAt);
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Server-side cache
    const imgHash = hashImage(image);
    const cachedEntry = IMAGE_CACHE.get(imgHash);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
      recordOutcome(reqDate, 'success', Date.now() - startedAt);
      return res.status(200).json({ content: [{ text: JSON.stringify(cachedEntry.scores) }] });
    }

    // 3x parallel API calls with different seeds → median
    const seeds = [12345, 67890, 24680];
    let results = await Promise.all(
      seeds.map(s => callGPT(apiKey, image, s, baselineImage || null, baselineResult || null, deviceInfo))
    );
    let valid = results.filter(r => r !== null);

    // 전체 실패 시 1회 재시도 — 일시적 OpenAI 지연/오류로 3회 모두 실패한 경우 자동 복구.
    // (사용자가 직접 재측정하지 않아도 복구되어 CV-only로 빠지는 것을 막음)
    if (valid.length === 0) {
      console.warn('[analyze] 1차 3회 모두 실패 — 1회 재시도');
      results = await Promise.all(
        seeds.map(s => callGPT(apiKey, image, s, baselineImage || null, baselineResult || null, deviceInfo))
      );
      valid = results.filter(r => r !== null);
    }

    if (valid.length === 0) {
      recordOutcome(reqDate, 'failure', Date.now() - startedAt);
      return res.status(502).json({ error: 'All AI calls failed' });
    }

    const merged = { ...valid[0] };
    // 3x 결과 분산 (각 메트릭의 max-min). 분산 클수록 측정 노이즈 ↑.
    const metricSpreads = {};
    if (valid.length >= 2) {
      for (const key of SCORE_KEYS) {
        const vals = valid.map(r => r[key]).filter(v => typeof v === 'number');
        if (vals.length >= 2) {
          metricSpreads[key] = Math.max(...vals) - Math.min(...vals);
        }
        merged[key] = median(valid.map(r => r[key]));
      }
      const breakdown = { whitehead: 0, blackhead: 0, papule: 0, pustule: 0, nodule: 0 };
      for (const k of BREAKDOWN_KEYS) {
        breakdown[k] = median(valid.map(r => (r.troubleBreakdown && r.troubleBreakdown[k]) || 0));
      }
      merged.troubleBreakdown = breakdown;
    } else {
      merged.troubleBreakdown = normalizeBreakdown(merged.troubleBreakdown);
    }

    // 전체 측정 신뢰도 — 메트릭 평균 분산 기반
    const spreadVals = Object.values(metricSpreads);
    const avgSpread = spreadVals.length > 0 ? spreadVals.reduce((a, b) => a + b, 0) / spreadVals.length : 0;
    const maxSpread = spreadVals.length > 0 ? Math.max(...spreadVals) : 0;
    let confidence; // 'high' | 'medium' | 'low'
    if (avgSpread < 6 && maxSpread < 12) confidence = 'high';
    else if (avgSpread < 12 && maxSpread < 22) confidence = 'medium';
    else confidence = 'low';
    merged.measurementConfidence = confidence;
    merged.metricSpreads = metricSpreads;
    merged.avgSpread = +avgSpread.toFixed(1);
    merged.maxSpread = maxSpread;
    // Pick analysis from a random valid response for diversity
    const analysisSource = valid[Math.floor(Math.random() * valid.length)];
    merged.analysis = analysisSource.analysis || { summary: '', details: [] };

    // makeupDetected: majority vote — false-positive 회피.
    // valid 3: 2개 이상 true일 때만, valid 2: 둘 다 true일 때만, valid 1: 단일 결과.
    const makeupVotes = valid.filter(r => r.makeupDetected === true).length;
    merged.makeupDetected = valid.length >= 2
      ? makeupVotes > valid.length / 2
      : makeupVotes >= 1;

    // If ANY GPT call detected a different person, skip stabilization
    const gptSaysDifferent = valid.some(r => r.differentPerson === true);
    if (gptSaysDifferent) merged.differentPerson = true;

    // Stabilize ALL metrics against baseline (skip for different person)
    const effectiveBaseline = gptSaysDifferent ? null : (baselineResult || null);
    const effectiveTimestamp = gptSaysDifferent ? null : (baselineTimestamp || null);
    const stabilized = stabilizeScores(merged, effectiveBaseline, effectiveTimestamp, deviceInfo, metricSpreads);
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

    recordOutcome(reqDate, 'success', Date.now() - startedAt);
    res.status(200).json({ content: [{ text: JSON.stringify(merged) }] });
  } catch (error) {
    console.error('analyze handler error:', error);
    recordOutcome(reqDate, 'failure', Date.now() - startedAt);
    res.status(500).json({ error: error.message });
  }
}

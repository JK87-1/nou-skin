/**
 * api/precision-analyze.js — 정밀 측정 모드 AI 분석 (3 이미지 multi-view)
 *
 * 일반 /api/analyze 와 별개. 정면·좌측면·우측면 3장의 사진을 받아
 * 부위별 가중치 + 좌·우 대칭 + 임상 발견 + 시술 후보 안내까지 종합 분석.
 *
 * 입력 body:
 *   { imageFront, imageLeft, imageRight,
 *     baselineImage?, baselineResult?, baselineTimestamp?,
 *     currentDevice, faceMatch?, faceDistance? }
 *
 * 출력: 일반 메트릭 12종 + asymmetry + regional_scores + clinical_findings
 *      + treatment_candidates + detailed_analysis (의사 톤).
 *
 * 비용 주의: 3 이미지 detail:high → 토큰 많음. 일반 측정의 약 2~2.5배.
 *           정밀은 유료 프리미엄이라 비용 정당화됨.
 */

const AI_TIMEOUT_MS = 90000; // 3 이미지 + 긴 prompt → 일반보다 여유 있게
const MAX_RATE_PER_DAY = 20; // 정밀 측정 IP당 일 한도 (오남용 방지, 일반 30/일과 별개)

// ===== 1) 정밀 분석 prompt — 일반 측정과 명확히 차별화 =====
function buildPrecisionPrompt() {
  return `당신은 피부과 전문의 + 미용 임상 컨설턴트 수준의 AI 피부 분석가입니다.

이번 측정은 [정밀 측정 모드]입니다. 사용자가 유료로 이용하는 프리미엄 분석이므로,
일반 측정보다 훨씬 깊이 있고 임상적으로 의미 있는 결과를 제공해야 합니다.

[입력 사진 — 3장이 순서대로 들어왔습니다]
1번째 이미지: 정면 — 양쪽 볼·이마·코·턱·전체 대칭 분석에 우선 사용
2번째 이미지: 좌측면 (사용자의 왼쪽 얼굴) — 왼쪽 팔자주름·왼쪽 턱선·왼쪽 옆얼굴 색소·왼쪽 관자놀이 모공·왼쪽 광대 측면에 우선
3번째 이미지: 우측면 (사용자의 오른쪽 얼굴) — 위와 반대로 오른쪽 영역에 우선

[Step 0. 동일인 확인]
3장이 모두 같은 사람인지 얼굴 골격(눈·코·입 비율, 영구 marker)으로 판별.
명백히 다른 사람이면 differentPerson:true 표시. 같은 사람의 다른 각도라면 false.

[Step 1. 메이크업 감지]
각 사진별로 메이크업 착용 여부 보수적 판별. 메이크업이 있으면 makeupDetected:true.

[Step 2. 기본 12 메트릭 — 각도별 강점 활용]
각 메트릭을 가장 잘 보이는 각도에서 정량 산출. 평균이 아니라 "best view" 채택:
- 팔자주름(wrinkles 일부): 좌·우 측면이 정면보다 정확. 측면 우선.
- 모공(pores): 정면(전체 분포) + 측면(코 옆 모공) 종합.
- 색소·잡티(pigmentation): 측면에서 잘 드러나는 광대 잡티 + 정면 종합.
- 다크서클(darkCircles): 정면이 기본, 측면으로 깊이 추정.
- 탄력(elasticity)·턱선: 측면 우선.
- 수분·유분·피부톤·피부결·트러블·붉은기: 정면 + 측면 종합.

출력 키: moisture, skinTone, oilBalance, troubleCount(개수),
        wrinkles, elasticity, texture, pores, pigmentation, darkCircles, redness, oilMoistureBalance.
        troubleBreakdown: { whitehead, blackhead, papule, pustule, nodule } 개수.
        각 점수 0~100, troubleCount 0~20 정수.

[Step 3. 좌·우 비대칭 분석 ★ 정밀 측정의 핵심 ★]
일반 측정으로는 절대 잡지 못하는 정보입니다. 거울로도 사용자가 못 봅니다.
좌·우 측면 사진을 직접 비교해 다음을 산출:
- darkCircles: { left:0~100, right:0~100, diff:|차이|, severity: 'none'|'minor'|'moderate'|'severe' }
- pigmentation: { left, right, diff, severity }
- redness: { left, right, diff, severity }
- nasolabial: { left, right, diff, severity }  // 팔자주름 좌우 깊이
- pores: { left, right, diff, severity }
severity 기준: diff<3 none, <6 minor, <10 moderate, ≥10 severe.
summary 한 줄로 가장 두드러진 비대칭 1~2개 요약.

[Step 4. 부위별 세분화 측정]
얼굴을 8~10 부위로 나눠 각 부위 점수.
출력 키:
- forehead: { wrinkles, pigmentation, texture }
- left_cheek: { pores, pigmentation, texture, redness }
- right_cheek: { pores, pigmentation, texture, redness }
- nasolabial_left: { visibility:0~100, depth_label: 'mild'|'moderate'|'deep' }
- nasolabial_right: { visibility, depth_label }
- under_eye_left: { darkCircles, fineLines:0~100 }
- under_eye_right: { darkCircles, fineLines }
- chin: { texture, sagging_label: 'firm'|'mild_sag'|'moderate_sag'|'pronounced_sag' }
- nose: { pores, sebum:0~100 }

[Step 5. 임상 발견(clinical_findings) — 일반 측정이 못 잡는 패턴]
다음 유형의 패턴을 식별하고, 발견 시 배열에 추가:
- 편측성 색소(한쪽이 명백히 짙음) — UV 노출 비대칭 시사
- 멜라스마 의심(양 광대 대칭 갈색반) — 호르몬성·열성
- 광노화 패턴(이마 가로주름 + 일광색소 + 거친 피부결 조합)
- 자극성 트러블 패턴(턱·입 주변 군집 papule)
- 모세혈관 확장(특정 부위 만성 홍조)
- 색소성 다크서클 vs 그림자성 다크서클 구분
각 발견: { finding: "한 줄", severity: 'minor'|'moderate', regions: [부위명들] }
없으면 빈 배열.

[Step 6. 시술 후보(treatment_candidates) — 정보 제공 ONLY]
* 절대 금지: 진단, 처방, 강요 표현. "받으세요"·"필요합니다" 금지.
* 허용: "이런 패턴에서 일반적으로 고려되는 옵션입니다" 톤.
* 의료 자문이 아니라 카테고리별 일반 정보임을 명확히.

발견된 우선 카테고리별로 0~3개 옵션:
- 색소·미백: 레이저토닝·IPL·피코토닝·코스메슈티컬(나이아신아마이드·트라넥삼산)
- 탄력·주름: 인모드·울쎄라·써마지·고주파·실리프팅·필러·보톡스·레티놀
- 모공·피부결: 프락셀·MTS·앱셀·LDM·PDRN·BHA
- 수분·진정: 물광·스킨부스터·시카·PDRN·세라마이드
각 카테고리: { category, options:[...], rationale: "왜 이 패턴에 일반적으로 고려되는지" }
해당 없으면 카테고리 자체 생략.

[Step 7. 상세 분석(detailed_analysis) — 의사 톤 한국어 300~450자]
환자에게 직접 설명하는 톤. 다음 순서:
1) 가장 두드러진 1~2개 패턴 (예: "오른쪽 광대 잡티가 왼쪽보다 짙어 UV 노출 비대칭 가능성")
2) 즉시 케어 우선순위 (홈케어로 가능한 것)
3) 전문가 상담 권고 영역 (있다면)
의학적 단언 피하고 "~로 보입니다", "~할 가능성" 표현 사용.

[Step 8. analysis 객체 — 일반 측정 호환]
{ summary: "정밀판독 한 줄 요약", details: ["부위별 핵심 소견 3~5개"] }

[최종 JSON 출력 스키마]
{
  "differentPerson": boolean,
  "makeupDetected": boolean,
  "moisture": 숫자, "skinTone": 숫자, "oilBalance": 숫자, "troubleCount": 숫자,
  "troubleBreakdown": {"whitehead":숫자,"blackhead":숫자,"papule":숫자,"pustule":숫자,"nodule":숫자},
  "wrinkles": 숫자, "elasticity": 숫자, "texture": 숫자, "pores": 숫자,
  "pigmentation": 숫자, "darkCircles": 숫자, "redness": 숫자, "oilMoistureBalance": 숫자,
  "asymmetry": { "darkCircles":{...}, "pigmentation":{...}, "redness":{...}, "nasolabial":{...}, "pores":{...}, "summary":"..." },
  "regional_scores": { "forehead":{...}, "left_cheek":{...}, "right_cheek":{...},
                       "nasolabial_left":{...}, "nasolabial_right":{...},
                       "under_eye_left":{...}, "under_eye_right":{...},
                       "chin":{...}, "nose":{...} },
  "clinical_findings": [ ... ],
  "treatment_candidates": [ ... ],
  "detailed_analysis": "...",
  "analysis": { "summary":"...", "details":[...] }
}

반드시 ---JSON_START--- 와 ---JSON_END--- 마커 사이에만 JSON 출력.
주석·설명 금지. 메이크업 있을 때 색소·troubleCount는 보수적으로 평가.`;
}

// ===== 2) Rate limit (간단 in-memory, IP·날짜 기준) =====
const RATE_BUCKET = new Map();
function checkRate(ip, today) {
  const key = `${ip}:${today}`;
  const n = RATE_BUCKET.get(key) || 0;
  if (n >= MAX_RATE_PER_DAY) return false;
  RATE_BUCKET.set(key, n + 1);
  return true;
}

// ===== 3) callGPT — multi-image (3장) =====
async function callPrecisionGPT(apiKey, imageFront, imageLeft, imageRight, baselineImage, baselineResult, deviceInfo, seed) {
  const userContent = [];

  // baseline 있으면 첫 번째 이미지로 (이전 측정 anchor)
  if (baselineImage) {
    userContent.push({ type: 'text', text: '[참조] 이전 측정 baseline 사진입니다. 동일인 확인·변화 추적용. 점수 평가의 anchor로 활용하되, 새 3장의 사진이 우선합니다.' });
    userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${baselineImage}`, detail: 'low' } });
    if (baselineResult) {
      userContent.push({ type: 'text', text: `[참조] 이전 baseline 점수: ${JSON.stringify(baselineResult).slice(0, 400)}` });
    }
  }

  userContent.push({ type: 'text', text: '[새 측정 — 정밀 측정 모드] 다음 3장은 같은 사람의 정면·좌측면·우측면입니다.' });
  userContent.push({ type: 'text', text: '1번째: 정면' });
  userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageFront}`, detail: 'high' } });
  userContent.push({ type: 'text', text: '2번째: 좌측면 (사용자의 왼쪽 얼굴)' });
  userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageLeft}`, detail: 'high' } });
  userContent.push({ type: 'text', text: '3번째: 우측면 (사용자의 오른쪽 얼굴)' });
  userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageRight}`, detail: 'high' } });
  userContent.push({ type: 'text', text: buildPrecisionPrompt() });

  const body = {
    model: 'gpt-5.2',
    max_completion_tokens: 4000, // 정밀은 응답 길어짐(임상 발견·시술 후보·상세 분석)
    temperature: 0.25,
    top_p: 1,
    seed,
    messages: [
      {
        role: 'system',
        content: 'You are a dermatologist-level AI skin analyzer in precision (paid premium) mode. The user paid for this measurement, so the analysis must be substantially deeper than the standard mode — include left/right asymmetry, regional scores, clinical findings, and treatment category guidance. Never diagnose or prescribe; provide information only. Identify SAME vs DIFFERENT person by facial features (not by score deviation). Output only the JSON between ---JSON_START--- and ---JSON_END--- markers.',
      },
      { role: 'user', content: userContent },
    ],
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error(`[precision] OpenAI 호출 실패 ${response.status}: ${errText.slice(0, 200)}`);
    return null;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return parsePrecisionResponse(text);
}

// ===== 4) 응답 파서 =====
function parsePrecisionResponse(text) {
  try {
    let jsonStr = '';
    const marked = text.match(/---JSON_START---\s*([\s\S]*?)\s*---JSON_END---/);
    if (marked) {
      jsonStr = marked[1].trim();
    } else {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return null;
      jsonStr = m[0];
    }
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.moisture !== 'number') return null; // 최소 검증
    return parsed;
  } catch (e) {
    console.warn('[precision] parse failed:', e.message);
    return null;
  }
}

// ===== 5) Handler =====
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startedAt = Date.now();
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const today = new Date().toISOString().slice(0, 10);
  if (!checkRate(ip, today)) {
    return res.status(429).json({ error: 'Precision rate limit exceeded. Try again tomorrow.' });
  }

  try {
    const {
      imageFront, imageLeft, imageRight,
      baselineImage, baselineResult, baselineTimestamp,
      currentDevice, faceMatch, faceDistance,
    } = req.body;

    if (!imageFront || !imageLeft || !imageRight) {
      return res.status(400).json({ error: 'imageFront·imageLeft·imageRight 세 장이 모두 필요합니다.' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[precision] OPENAI_API_KEY 누락');
      return res.status(500).json({ error: 'API key not configured' });
    }

    const deviceInfo = {
      currentDevice: currentDevice || null,
      faceMatch: faceMatch || null,
      faceDistance: typeof faceDistance === 'number' ? faceDistance : null,
    };

    // 정밀은 3 이미지 + 긴 prompt라 단일 호출. 전체 실패 시 1회 재시도(일반 모드 ④와 동일 원리).
    let result = await Promise.race([
      callPrecisionGPT(apiKey, imageFront, imageLeft, imageRight, baselineImage || null, baselineResult || null, deviceInfo, 13579),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)),
    ]).catch(e => { console.warn('[precision] 1차 실패:', e.message); return null; });

    if (!result) {
      console.warn('[precision] 1차 전체 실패 — 1회 재시도');
      result = await Promise.race([
        callPrecisionGPT(apiKey, imageFront, imageLeft, imageRight, baselineImage || null, baselineResult || null, deviceInfo, 24680),
        new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), AI_TIMEOUT_MS)),
      ]).catch(e => { console.warn('[precision] 재시도 실패:', e.message); return null; });
    }

    if (!result) {
      return res.status(502).json({ error: 'All precision AI calls failed' });
    }

    // 측정 메타
    result.measureDebug = {
      mode: 'precision',
      device: currentDevice || null,
      faceMatch: faceMatch || null,
      faceDistance: typeof faceDistance === 'number' ? +faceDistance.toFixed(3) : null,
      elapsedMs: Date.now() - startedAt,
    };
    result.analysisMode = 'precision_hybrid';

    return res.status(200).json({ content: [{ text: JSON.stringify(result) }] });
  } catch (error) {
    console.error('[precision] handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}

const fs = require('fs');
const path = require('path');
const https = require('https');

const env = (() => {
  const text = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const e = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) e[m[1]] = m[2];
  }
  return e;
})();

function call(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.notion.com', path: p, method,
      headers: {
        Authorization: 'Bearer ' + env.NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (res.statusCode < 300) resolve(JSON.parse(raw || '{}'));
        else reject(new Error('HTTP ' + res.statusCode + ': ' + raw.slice(0, 300)));
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const callout = (emoji, title) => ({
  object: 'block', type: 'callout',
  callout: { icon: { type: 'emoji', emoji }, rich_text: [{ type: 'text', text: { content: title } }] },
});
const bullet = (t) => ({
  object: 'block', type: 'bulleted_list_item',
  bulleted_list_item: { rich_text: [{ type: 'text', text: { content: t } }] },
});

const TARGET_TITLES = [
  '트러블 종류별 분류 측정',
  '에이전트 자발 인사이트',
  '색소·피부결·모공 측정 정밀화',
  '채팅 Gemini 수준 4종 동시 개선',
  'Gemini Flash 완전 재현',
  '3종 페르소나 모델',
];

(async () => {
  // 1. 5/20 entries with JUN KIM created by today's automation — archive
  const all = await call('POST', '/v1/databases/' + env.NOTION_CALENDAR_DB_ID + '/query', { page_size: 100 });
  const today = all.results.filter(p => {
    const d = p.properties?.Date?.date?.start;
    if (d !== '2026-05-20') return false;
    const titleArr = p.properties?.Name?.title || [];
    const t = titleArr.map(x => x.plain_text).join('');
    return TARGET_TITLES.some(tt => t.includes(tt));
  });
  for (const page of today) {
    await call('PATCH', '/v1/pages/' + page.id, { archived: true });
    console.log('🗄  archived:', page.properties.Name.title.map(x => x.plain_text).join(''));
  }

  // 2. New consolidated entry
  const create = await call('POST', '/v1/pages', {
    parent: { database_id: env.NOTION_CALENDAR_DB_ID },
    properties: {
      Name: { title: [{ type: 'text', text: { content: '채팅 Gemini 전환 + 측정 정밀화 + 페르소나 모델 도입' } }] },
      Date: { date: { start: '2026-05-20' } },
      ...(env.NOTION_CALENDAR_STATUS_PROP ? { [env.NOTION_CALENDAR_STATUS_PROP]: { status: { name: '본사이트' } } } : {}),
    },
    children: [
      callout('📌', '오늘 핵심'),
      bullet('채팅 UI를 Gemini Flash 수준으로 끌어올림. AI 답변 평문화·SSE 스트리밍·iOS 키보드 sticky까지 4종 동시 정밀화.'),
      bullet('"lua 케어 / 클리닉 / 컨시어지" 3종 페르소나 모델 도입. 헤더에서 모델 선택해 톤·구조가 완전히 다른 상담 받을 수 있음.'),
      bullet('측정 정확도도 함께 정밀화 — 트러블 5종 분류 + 색소·피부결·모공 부위별 prompt 강화.'),

      callout('🎨', '채팅 UX — Gemini Flash 수준'),
      bullet('AI 답변 평문화: 흰색 버블·아바타·"lua" 라벨 모두 제거. heading bold·단락 간격 명확.'),
      bullet('사용자 메시지: 옅은 회색 캡슐(#F1F3F4). Gemini와 동일.'),
      bullet('답변 아래 액션 row: 👍 👎 🔄(다시 답변) 📋(복사) — 다시 답변·복사 실제 작동.'),
      bullet('SSE 스트리밍: 첫 토큰 1초 내, 글자가 흐르듯 출력. 체감 속도 대폭 향상.'),
      bullet('응답 응축: prompt에서 "주절주절" 금지. 3~5문장 + 액션 1~2개. max_token 2800→1000.'),
      bullet('글자 16px / 줄간격 1.6, composer 흰색 단순, send 검은색·sound-wave chip 전환.'),
      bullet('iOS 키보드 sticky: @capacitor/keyboard 이벤트로 sheet height 명시적 축소. dvh fallback도 함께.'),
      bullet('빈 상태 "오늘 피부는 어떤가요?" + 자동 인사 제거, 헤더 ⌄ chevron.'),

      callout('🤖', '페르소나 모델 (3종)'),
      bullet('루아 케어 (기본) — 친구톤·일상 상담. 3~5문장, 어려운 용어 풀어쓰기, 격려.'),
      bullet('루아 클리닉 — 피부과 전문의 톤. 기전·근거 명시, 전문어 짧게 병기, ## 헤딩 적극.'),
      bullet('루아 컨시어지 — 등록 제품 100% 활용. 사용 순서·시점·용량 디테일, 백화점 톤.'),
      bullet('헤더 "lua [페르소나] ⌄" 클릭 → 드롭다운 모달, 체크마크·태그라인.'),
      bullet('페르소나 전환 시 자동으로 새 채팅 + 환영 메시지 (Gemini 옵션 A 패턴).'),
      bullet('localStorage 영속화 — 앱 재시작 후에도 선택 유지.'),

      callout('🔬', '측정 정확도'),
      bullet('트러블 5종 분류: 화이트헤드·블랙헤드·구진·농포·결절 자동 카운트. GPT prompt + JSON schema + 3-call median.'),
      bullet('색소 정밀화: 멜라스마(광대·관자놀이)·일광색소(볼)·PIH(트러블 자국)·안중모반 패턴 구분.'),
      bullet('피부결: 부위별 편차(이마·코 vs 볼), 각질·닭살·흉터 자국, 빛 반사 균일도.'),
      bullet('모공: T존·U존 분리 평가, 모공 모양(원형/세로 늘어짐·노화 신호).'),
      bullet('자발 인사이트·멀티턴 기억 임계 절반으로 낮춤 (5회→2회, threshold 3~4).'),

      callout('🛠', '신규 파일·구조'),
      bullet('src/data/PersonaCatalog.js — 3개 페르소나 메타.'),
      bullet('src/storage/PersonaStorage.js — 활성 페르소나 localStorage.'),
      bullet('src/components/PersonaPicker.jsx — Gemini 스타일 드롭다운.'),
      bullet('LuaChatSheet·SkinConsultant 양쪽에 동일 페르소나 통합.'),
      bullet('api/consult.js: persona 받아 system prompt에 addon 병합.'),

      callout('🚀', '배포'),
      bullet('main 머지 6회, Vercel production 배포 6회, iOS Capacitor sync 6회.'),
      bullet('https://www.luaskin.co 전부 반영, https://nou-skin.vercel.app aliased.'),

      callout('🗓', '내일 이어서'),
      bullet('상담 기능 추가 업그레이드 (김준 요청).'),
      bullet('페르소나 추가 후보: 루아 코치(루틴 실천) · 루아 미니(초간단 답변).'),
      bullet('테스트·미세 정밀화 항목 정리.'),
    ],
  });
  console.log('✅ 새 통합 entry 생성됨:', create.url);
})().catch(e => { console.error('❌', e.message); process.exit(1); });

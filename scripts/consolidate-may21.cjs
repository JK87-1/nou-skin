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
const para = (t) => ({
  object: 'block', type: 'paragraph',
  paragraph: { rich_text: [{ type: 'text', text: { content: t } }] },
});

// 자동 entry 식별 keywords (title에 포함되면 우리 자동 entry로 판단)
const AUTO_PATTERNS = [
  '에이전트 컨텍스트', '변호사 검토', '약관 모달 자동',
  '케어 페이지', '당신의 피부에 맞는 제품', '추천 섹션',
  '제품 등록 시 GPT', '기존 등록 제품 성분', '트러블 5종 분류 UI',
  '상담사가 케어 추천', '등록 제품 성분 충돌', '가설+확인',
  '화장대 가이드', '화장대 \'표준 정렬\'', '마이 페이지 푸터',
  '측정 화면 호칭', '약관 노출 통합', '본 사이트 반영',
];

(async () => {
  // 1. 모든 페이지 query
  const all = await call('POST', '/v1/databases/' + env.NOTION_CALENDAR_DB_ID + '/query', { page_size: 100 });

  const target = all.results.filter(p => {
    const d = p.properties?.Date?.date?.start;
    if (d !== '2026-05-21') return false;
    const titleArr = p.properties?.Name?.title || [];
    const t = titleArr.map(x => x.plain_text).join('');
    // 박수진 entry는 보존 — 우리 자동 entry는 "본 사이트 반영" or 작업 키워드
    return AUTO_PATTERNS.some(k => t.includes(k));
  });

  console.log(`5/21 자동 entry ${target.length}개 archive 진행`);
  for (const page of target) {
    const t = page.properties.Name.title.map(x => x.plain_text).join('');
    await call('PATCH', '/v1/pages/' + page.id, { archived: true });
    console.log('🗄  archived:', t.slice(0, 60));
  }

  // 2. 새 통합 entry — 박수진 포맷
  const create = await call('POST', '/v1/pages', {
    parent: { database_id: env.NOTION_CALENDAR_DB_ID },
    properties: {
      Name: { title: [{ type: 'text', text: { content: '에이전트 컨텍스트·라이프스타일 학습 + 화장대 루틴 시스템 + 변호사 검토 반영' } }] },
      Date: { date: { start: '2026-05-21' } },
      ...(env.NOTION_CALENDAR_STATUS_PROP ? { [env.NOTION_CALENDAR_STATUS_PROP]: { status: { name: '본사이트' } } } : {}),
    },
    children: [
      callout('📌', '오늘 핵심'),
      bullet('상담 에이전트 — 가설 제시·라이프스타일 자동 학습으로 "나만의 에이전트" 정수에 한 발 더. 30일 추세·트러블 5종 인용·페르소나별 깊이 차별화까지.'),
      bullet('화장대 루틴 시스템 — 등록 제품을 표준 스킨케어 순서로 정렬 + 매일/가끔 우선순위 + 성분 충돌·시너지·과다 자동 감지.'),
      bullet('변호사 검토 결과 반영 — 약관 3종 교체, 사업자 정보 푸터, DPO 김준, 4단 동의 UI(현재 비활성).'),
      bullet('주요 버그 정정 — 컨디션 브리핑 "여러분" 호칭 금지, 쿠팡 안내 위치 정정, 화장대 가이드 1개만 노출.'),

      callout('🤖', '상담 에이전트 정수 진화'),
      bullet('가설 + 확인 대화 (A) — 답변에 "혹시 ~ 때문일까요?" 자발 가설 + 사용자 응답으로 진단 좁힘. 의사 수준 추론.'),
      bullet('라이프스타일 자동 학습 (B) — 사용자가 흘린 "잠 5시간 못 자" 같은 단서를 자동 저장(수면·스트레스·자외선·실내·식이·운동·생리·환절기 10종 패턴), 다음 채팅에서 "지난번에 잠 부족하시다 하셨었는데" 회상.'),
      bullet('컨텍스트 활용 깊이 — 트러블 5종 분류 자연 인용, 성분→메트릭 매핑(11개), 30일 장기 추세, 페르소나별 깊이 차별(케어 1~2개·클리닉 3~5개·컨시어지 등록 제품 중심).'),
      bullet('상담사가 케어 루틴 추천 결과(매일/가끔) 자연 인용. "오늘은 이 2개에 집중" 식 bridge 표현으로 화장대와 일관성.'),
      bullet('자동 성분 검색 — 등록 시 GPT-5.2가 핵심 성분 추정(known/estimated 신뢰도 표시). 기존 제품도 진입 시 백그라운드로 자동 보강.'),

      callout('🧴', '화장대 루틴 시스템'),
      bullet('당신의 피부에 맞는 루틴 — 등록 화장품을 표준 5단계(클렌저→토너→세럼·앰플→크림→선크림)로 자동 정렬.'),
      bullet('매일/가끔 우선순위 — 같은 단계 여러 제품이면 약점 매칭 강한 1~2개 "매일", 나머지 "가끔". 영양 과다 회피.'),
      bullet('과다 등록 가이드 — 앰플·세럼·크림 3종 이상이면 "각 단계 2개까지만 매일" 안내.'),
      bullet('성분 충돌·시너지·과다 감지 — 레티놀+산성/비타민C 등 4종 충돌, 히알루론산+세라마이드 등 3종 시너지 자동 안내. 단 1개만 노출(피로도 ↓).'),
      bullet('"표준 정렬" 라벨 + "내 피부 별 맞춤 추천은 상담으로" 안내로 화장대-상담 역할 분리 명확.'),
      bullet('지난 날짜 선택 가능 — 케어 페이지 주간 캘린더 Apple 스타일 carousel(좌우 스와이프 + 햅틱). 60일 retention.'),

      callout('🔬', '측정 화면·UX 정정'),
      bullet('트러블 5종 분류 UI 노출 — 화이트헤드·블랙헤드·구진·농포·결절 시각화 카드. 가장 많은 종류 + 케어 hint(BHA·시카 등).'),
      bullet('컨디션 브리핑 "여러분" → 닉네임/호칭 생략. 모든 prompt(consult·push-tips)에 호칭 룰 일관 적용.'),
      bullet('쿠팡 파트너스 안내를 측정 정보 → 화장대 추천 아래로 이동(전자상거래법 표시 의무 위치 정정).'),

      callout('⚖️', '변호사 검토 결과 반영'),
      bullet('약관 3종 교체 — 절대 면책 → 고의/중과실 명시, PIPA 제28조의8 정정, OpenAI 30일 보관 사실 정정, DPO 김준 기입.'),
      bullet('사업자 정보 푸터 — 주식회사 누, 박수진 대표, 855-88-03536, 왕십리로125 720호, 1577-8732. 마이 페이지 하단(중복 약관 링크 제거).'),
      bullet('4단 동의 UI(이용약관·처리방침·생체정보·국외 이전 + 만 14세 + 동의 이력 로그) 구현했으나 첫 진입 자동 표시는 김준 결정으로 보류. 인프라는 유지.'),
      bullet('생체정보·국외 이전 동의는 처리방침에 통합 노출. 본문 export는 유지(향후 활성화 대비).'),

      callout('🛠', '신규/대대적 파일'),
      bullet('src/utils/routineBuilder.js — 루틴 추천·충돌·시너지 공유 helper.'),
      bullet('src/utils/haptics.js — Capacitor 햅틱 wrapper.'),
      bullet('src/components/CareRecommendation.jsx — 루틴 추천 UI(매일/가끔·step·인사이트 카드).'),
      bullet('src/components/TroubleBreakdownCard.jsx — 트러블 5종 시각화.'),
      bullet('src/components/SiteFooter.jsx — 사업자 정보 expand 푸터.'),
      bullet('src/storage/ConsentLog.js, src/storage/PersonaStorage(이전 작업) — 영속화 인프라.'),
      bullet('api/product-ingredients.js — GPT 기반 성분 자동 검색.'),
      bullet('UserMemoryStorage 확장 — 라이프스타일 10종 정규식 패턴 학습.'),

      callout('🚀', '배포'),
      bullet('main 머지·Vercel production·iOS Capacitor sync 약 20회.'),
      bullet('https://www.luaskin.co 전부 반영.'),

      callout('🗓', '내일 이어서'),
      bullet('박수진 — 홈 화면(온보딩) 정밀화.'),
      bullet('상담 기능 추가 고도화 (자동 변화 알림·👍/👎 학습·TTS 등).'),
      bullet('베타 사용자 모집·발송 일정.'),
    ],
  });
  console.log('\n✅ 5/21 통합 entry:', create.url);
})().catch(e => { console.error('❌', e.message); process.exit(1); });

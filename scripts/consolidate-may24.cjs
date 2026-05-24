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

(async () => {
  // 5/24·5/25 자동 entry archive
  let cursor;
  const all = [];
  do {
    const resp = await call('POST', '/v1/databases/' + env.NOTION_CALENDAR_DB_ID + '/query', { page_size: 100, start_cursor: cursor });
    all.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);

  const targets = all.filter(p => {
    const d = p.properties?.Date?.date?.start;
    if (d !== '2026-05-24' && d !== '2026-05-25') return false;
    const t = (p.properties?.Name?.title || []).map(x => x.plain_text).join('');
    return t.startsWith('본 사이트 반영') || t.startsWith('데일리 진척') || t.startsWith('측정 정확도') || t.startsWith('애플 setup');
  });

  console.log(`5/24·5/25 자동 entry ${targets.length}건 archive`);
  for (const p of targets) await call('PATCH', '/v1/pages/' + p.id, { archived: true });

  // 5/24 통합 entry
  const r = await call('POST', '/v1/pages', {
    parent: { database_id: env.NOTION_CALENDAR_DB_ID },
    properties: {
      Name: { title: [{ type: 'text', text: { content: '상담 페르소나 3종 차별화 + 화장대·케어 UX 대전환 + 누끼 시스템 안정화' } }] },
      Date: { date: { start: '2026-05-24' } },
    },
    icon: { type: 'emoji', emoji: '🌟' },
    children: [
      callout('📌', '오늘 핵심'),
      bullet('상담사 루아의 세 페르소나(케어·클리닉·컨시어지)를 완전히 다른 사람처럼 차별화하고, 각자 독립된 대화 컨텍스트·빈 화면 인사를 가지도록 분리.'),
      bullet('화장대를 단순 리스트에서 "피부에 맞는 루틴 생성" CTA·실시간 새로고침·자동완성이 살아 있는 데이터 화면으로 재설계.'),
      bullet('제품 누끼 이미지 시스템을 localStorage 한도에서 해방시키고(IndexedDB), 자동완성 노출 속도를 1~2.5초 → 200~700ms로 단축.'),
      bullet('케어·화장대 양쪽에 iOS Mail 스타일 좌·우 스와이프(좌 삭제·우 ▲▼ 순서 변경) 적용. 부드러움·velocity·rubber-band까지.'),
      bullet('상담 추천 루틴을 채팅에서 카드 한 번으로 케어에 등록 + 등록 후 즉시 케어 화면 반영(이벤트 dispatch).'),

      callout('🤖', '상담 페르소나 시스템 대전환'),
      bullet('루아 케어 — 친한 친구 톤. 1~3문장 매우 짧게, 헤딩·의학 용어 절대 금지, "그랬구나~", "~해요" 친근체.'),
      bullet('루아 클리닉 — 피부과 전문의 진료. 6~12문장 + ## 진단/기전/처방/주의 4단 헤딩 필수. TEWL·MMP·필라그린 등 의학 용어 적극, 추측 시 "~보고된 바 있습니다" 명시.'),
      bullet('루아 컨시어지 — 백화점 VIP 컨시어지. 5~8문장 + ## 현재상태/맞춤권유/다음예측 3단. 측정·등록제품·메모리·라이프스타일 4가지 cross-reference 필수, "다른 사람이라면 X지만 사용자님은 Y" 개인화.'),
      bullet('페르소나 addon을 prompt 맨 끝으로 이동 — 길이·구조·톤에 마지막 결정권 부여. 메인 prompt 룰은 페르소나가 override.'),
      bullet('페르소나별 별도 세션(nou_consult_session_care/_clinic/_concierge) — 케어에서 한 대화가 클리닉에 새지 않음, 페르소나 전환 시 그 페르소나 이전 대화 자동 복원.'),
      bullet('페르소나 전환 시 대화 유지 — 톤만 바뀌고 컨텍스트는 그대로. 사용자가 같은 질문을 다른 페르소나로 다시 받을 수 있음.'),
      bullet('빈 채팅 진입 시 중앙에 Gemini 스파클 + 페르소나·시간대 기반 7~9개 풀에서 랜덤 큰 문구. 케어("오늘 피부는 어떤가요?")·클리닉("어떤 부분을 진료해드릴까요?")·컨시어지("오늘 어떤 인사이트를 도와드릴까요?") 각자 다른 인사.'),
      bullet('답변 길이 엄격 + 반복 질문 절대 금지 — 사용자가 이미 답한 정보 재질문 X, 루틴 추천 시 광범위 재질문 없이 즉시 구체 루틴 + [APPLY_ROUTINE] 블록 첨부.'),
      bullet('호칭·placeholder 정리 — [닉네임]님만의 → 사용자님의. NICKNAME_GUIDE에 "placeholder 그대로 출력 금지" 룰 추가.'),

      callout('🏠', '화장대 UX 재설계'),
      bullet('"제품 등록" 버튼을 등록 제품 grid 바로 위로 이동(큰 그림자·강조). 등록 제품 1개 이상이면 "✨ 피부에 맞는 루틴 생성하기" 큰 CTA 노출.'),
      bullet('CTA 클릭 시 expand하면서 CareRecommendation 표시. 우상단 새로고침(↻) 버튼 — 햅틱 + 360° spin + 즉시 재계산.'),
      bullet('등록·수정·삭제 시 product signature 비교해 자동 refreshKey 증가 — 새로고침 안 눌러도 실시간 반영.'),
      bullet('신규 제품 첫 등록 시 루틴 영역 자동 expand + 스크롤. 사용자 인지·탐색 부담 0.'),
      bullet('등록 한도 20 → 30개 상향.'),

      callout('🔍', '자동완성 — 모든 케이스에서 즉시·정확'),
      bullet('한국 인기 화장품 데이터셋(KOREAN_PRODUCTS) 160+개 구축 — 토리든·코스알엑스·닥터자르트·셀퓨전씨·앰플엔·메디힐·라네즈·설화수·이니스프리·라로슈포제·세타필·닥터지·메디큐브·바이오힐 보·VT·피지오겔·더마팩토리·라운드랩·시카팜·마녀공장·이솝·바르헤·바이오더마 등.'),
      bullet('Multi-token AND 매칭 — "피지오겔 토너"·"수분 세럼" 같이 여러 키워드 동시 검색. brand·name·category·ingredients 모두 검색 대상.'),
      bullet('Mode 분기 — brand input에 친 거면 "그 브랜드의 대표 제품 5개"로 GPT prompt, name input + brand 명시면 "X 브랜드 중 키워드 매칭". 다른 브랜드 결과 strict 필터.'),
      bullet('인기 brand boost +10 — 같은 매칭 점수일 때 토리든·라네즈·이니스프리 등 인기 브랜드 우선.'),
      bullet('Brand 다양성 dedup — 한 brand 최대 2개, 총 10개까지. 한 브랜드 도배 차단.'),
      bullet('SSE 스트리밍 — GPT 결과를 한 번에 5개 기다리지 않고 도착하는 대로 즉시 카드 추가. 첫 카드 200~400ms.'),
      bullet('GPT 모델 안정화 — gpt-5.2-mini 호출 실패 정정 후 검증된 gpt-5.2로 복귀.'),
      bullet('제품명 키워드만으로도 인기순 노출 — "히알루론산"·"레티놀"·"시카"·"토너" 등 입력 시 다양한 인기 브랜드 제품 즉시 노출.'),

      callout('🖼', '누끼 이미지 시스템 안정화'),
      bullet('IndexedDB로 imageThumb 분리 — localStorage 5MB 한도 부담 0. 첫 진입 시 기존 thumb 자동 마이그레이션 + 토스트 안내.'),
      bullet('Fast 모드 — /api/product-image에서 base64 proxy 건너뛰고 네이버 쇼핑 CDN URL 직접 반환. 자동완성 thumb 도착 1~2.5초 → 200~700ms.'),
      bullet('인기 화장품 50개 백그라운드 prefetch — 화장대 진입 1.5초 후 stagger(150ms) fetch로 localStorage 캐시 채움. 다음 검색은 0ms.'),
      bullet('3단 fallback fetch — brand+name → brand+카테고리 → brand만. 인디 브랜드도 cover.'),
      bullet('localStorage QuotaExceededError 자동 복구 — 가장 오래된 imageThumb 단계적 제거 + 친근 한국어 안내.'),
      bullet('compressProductThumb 100→80 size·0.5 quality로 신규 thumb 절반 축소.'),
      bullet('img onError fallback — 깨진 URL 시 카테고리 컬러 + 이모지 placeholder 자동 교체.'),

      callout('👆', '케어·화장대 좌·우 스와이프'),
      bullet('iOS Mail 스타일 SwipeableRow 컴포넌트 — 좌 스와이프 시 빨간 삭제 reveal, 깊이 쭉(-160px+) 시 즉시 삭제. 우 스와이프 시 ▲▼ 순서 변경 reveal.'),
      bullet('부드러움 5중 강화 — baseX 추적(정확 누적), rubber-band bounds(1/4 저항), velocity flick(>0.6 px/ms 즉시), spring overshoot(cubic-bezier(0.22,1.18,0.36,1)), translate3d GPU 합성 + lift shadow.'),
      bullet('한 번에 한 row만 열림(다른 row 열면 자동 닫힘) + 햅틱.'),
      bullet('케어 manual order(lua_care_manual_order) — 사용자 수동 순서가 자동 표준 정렬보다 우선. 새 항목은 자동 정렬로 뒤에 추가.'),
      bullet('화장대 그리드 카드도 스와이프 적용 — reorderProducts로 영구 순서 저장.'),
      bullet('삭제 robustness — 모든 storage(TrackerStorage products·myRoutines·manual order) 동시 클린업, type 매칭 실패해도 안전.'),

      callout('💬', '채팅 카드 → 케어 즉시 반영'),
      bullet('AI 응답 끝 [APPLY_ROUTINE] JSON 블록 + UI에서 "이 루틴 케어에 적용" 카드 노출 — 클릭 한 번으로 TrackerStorage 일괄 등록.'),
      bullet('Trigger 룰 강화 — 아침/저녁 2개 이상 안내·"루틴" 키워드 등장 시 무조건 첨부, 자가 체크 룰 포함.'),
      bullet('SSE 스트리밍 시 raw JSON 노출 차단 — 시작 태그 발견 즉시 hide.'),
      bullet('Toast에 "케어에서 확인" 액션 버튼 — 클릭 시 chat sheet 닫고 케어 페이지 자동 이동.'),
      bullet('등록 변경 시 lua:tracker-products-changed 이벤트 dispatch — HistoryPage·RoutineTracker가 listener로 즉시 화면 갱신. 새로고침 없이 반영.'),
      bullet('handleApplyRoutine 동기 잠금(applyingRef) — 카드 다중 클릭 차단.'),

      callout('🛡', '데이터 무결성 강화'),
      bullet('saveProduct 자동 dedup — 같은 brand+name 신규 등록 시 자동 거부, 기존 정보(thumb·성분) 보강만.'),
      bullet('normKey 다양한 구분자 제거 — 공백·하이픈·점·괄호·플러스 등. 표기 미세 차이로 중복 등록되던 케이스 차단.'),
      bullet('handleSaveProduct savingRef 동기 잠금 — fetch await 중 다중 클릭 차단.'),
      bullet('첫 마운트 dedupeProductsByName — 과거 중복 제품 자동 정리 + 토스트.'),
      bullet('saveProduct id 충돌 방지 — Date.now() → Date.now()_randomSuffix.'),
      bullet('imageThumb 자가치유 — 누끼 없는 등록 제품 백그라운드 fetch + IDB 저장, 화장대·케어 양쪽 자동 반영.'),

      callout('🎨', '제품 등록 완료·기타'),
      bullet('ProductRegisteredModal — 등록 후 BaselineCompleteModal과 같은 톤(circular checkmark·spring pop) 모달. 누끼 thumbnail + 브랜드 + 카테고리 + 시간대 + "지금 N개 등록됨" 카운트.'),
      bullet('상담 카드 적용 시 ingredients sanitize — string·array 둘 다 처리, timeSlot 누락 시 "both" fallback.'),
      bullet('CareRecommendation 쿠팡 안내 문구 제거.'),
      bullet('컨시어지 prompt placeholder "[닉네임]" → "사용자님" 정정.'),

      callout('🚀', '배포'),
      bullet('main 머지·Vercel production·iOS Capacitor sync 수십 회.'),
      bullet('https://www.luaskin.co · https://nou-skin.vercel.app 전부 반영.'),
    ],
  });
  console.log('\n✅ 5/24 통합 entry:', r.url);
})().catch(e => { console.error('❌', e.message); process.exit(1); });

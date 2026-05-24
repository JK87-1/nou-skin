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
  // 1) 모든 페이지 fetch
  let cursor = undefined;
  const all = [];
  do {
    const resp = await call('POST', '/v1/databases/' + env.NOTION_CALENDAR_DB_ID + '/query', { page_size: 100, start_cursor: cursor });
    all.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);

  // 2) 자동 "본 사이트 반영" entry 식별 (title이 "본 사이트 반영"으로 시작)
  const targets522 = all.filter(p =>
    p.properties?.Date?.date?.start === '2026-05-22' &&
    (p.properties?.Name?.title || []).map(x => x.plain_text).join('').startsWith('본 사이트 반영')
  );
  const targets523 = all.filter(p =>
    p.properties?.Date?.date?.start === '2026-05-23' &&
    (p.properties?.Name?.title || []).map(x => x.plain_text).join('').startsWith('본 사이트 반영')
  );

  // 3) Archive
  console.log(`5/22 자동 entry ${targets522.length}건 archive`);
  for (const p of targets522) await call('PATCH', '/v1/pages/' + p.id, { archived: true });
  console.log(`5/23 자동 entry ${targets523.length}건 archive`);
  for (const p of targets523) await call('PATCH', '/v1/pages/' + p.id, { archived: true });

  // 4) 5/22 통합 entry 생성
  const r522 = await call('POST', '/v1/pages', {
    parent: { database_id: env.NOTION_CALENDAR_DB_ID },
    properties: {
      Name: { title: [{ type: 'text', text: { content: '측정 정확도 Phase 1·2·3 패키지 — 디바이스 인지 + 얼굴 임베딩 + 정규화' } }] },
      Date: { date: { start: '2026-05-22' } },
    },
    icon: { type: 'emoji', emoji: '🔬' },
    children: [
      callout('📌', '오늘 핵심'),
      bullet('동일인이 폰을 바꾸면 점수가 20점이나 차이 나는 문제 해결을 위해 측정 엔진 3중 보강.'),
      bullet('얼굴 자체 특징(face descriptor 128차원 임베딩)으로 동일인 판단 — 디바이스·조명과 무관.'),
      bullet('사진 정규화로 카메라 자동 보정(노출·화이트밸런스) 차이를 흡수.'),
      bullet('크로스 디바이스에서는 baseline 점수에 60% 가중 — 새 점수 폭주 차단.'),

      callout('🔬', 'Phase 1 — 디바이스 인지 baseline'),
      bullet('디바이스 fingerprint(platform·iOS/Android·screen·dpr) 저장.'),
      bullet('다른 디바이스 측정 시 baseline 점수 60%·새 점수 40% 가중 평균.'),
      bullet('전체 점수 차이 임계값을 15 → 25로 상향 (자연 변동 흡수).'),

      callout('🧬', 'Phase 2 — 얼굴 임베딩 동일인 판단'),
      bullet('face-api 128차원 face descriptor 추출, Euclidean distance 0.5/0.6 임계.'),
      bullet('같은 사람이면 디바이스·조명 달라도 "same" 판정. GPT 동일인 판단 룰에도 반영.'),

      callout('📷', 'Phase 3 — 사진 정규화'),
      bullet('Gray-world 화이트밸런스 + auto-exposure 보정 (SOFTNESS 0.95, 중앙 45% 영역 sample).'),
      bullet('카메라별 자동 보정 차이를 입력 단계에서 흡수해 측정 변동 ↓.'),

      callout('📊', '테스트 결과'),
      bullet('A·B 사용자, A폰·B폰 4조합 측정 점수 차이 20점 → 2~7점 안정화.'),

      callout('🎨', '디자인·화면 (박수진)'),
      bullet('홈 랜딩 텍스트 슬라이드 전환 + FAB 버튼 리디자인 + 날씨 아이콘 추가.'),

      callout('🚀', '배포'),
      bullet('main 머지 · Vercel production 반영 · https://www.luaskin.co'),
    ],
  });
  console.log('✅ 5/22 통합 entry:', r522.url);

  // 5) 5/23 통합 entry 생성
  const r523 = await call('POST', '/v1/pages', {
    parent: { database_id: env.NOTION_CALENDAR_DB_ID },
    properties: {
      Name: { title: [{ type: 'text', text: { content: '애플 setup 스타일 baseline 3회 평균 + 측정 후 자동 인사이트 + 케어 자동 표준 정렬' } }] },
      Date: { date: { start: '2026-05-23' } },
    },
    icon: { type: 'emoji', emoji: '🌟' },
    children: [
      callout('📌', '오늘 핵심'),
      bullet('베타 론칭을 잠시 미루고 측정 정확도 4종 패키지 완성 — 가이드·품질·신뢰도·3회 평균.'),
      bullet('애플 setup 톤으로 첫 3회 측정 흐름을 능동 UX로 재설계 — 큰 CTA·진행 카드·완성 모달.'),
      bullet('측정 결과만 보여주던 화면을 "AI가 변화 원인·다음 행동을 자동 추론"하는 인사이트 카드로 확장.'),
      bullet('케어 페이지는 사용자가 신경 쓰지 않아도 표준 스킨케어 순서로 자동 정렬 + "오늘 모두 발랐어요" 일괄 체크.'),

      callout('🔬', '측정 정확도 Phase 1~4 패키지'),
      bullet('Phase 1 — 표준 측정 가이드 모달(자연광·세안·노메이크업·30cm·자연 표정).'),
      bullet('Phase 2 — 사진 품질 게이트: 흐림·역광·과다 노출 시 차단/경고 분리.'),
      bullet('Phase 3 — GPT 3회 분산 기반 신뢰도(high/medium/low). 분산 큰 메트릭은 baseline anchor 강화.'),
      bullet('Phase 4 — baseline 첫 3회 평균(1회 의존성 제거). built flag로 영구 마킹해 재초기화 방지.'),

      callout('🍎', '애플 setup 스타일 능동 UX'),
      bullet('첫 3회 측정을 명시적인 흐름으로: 결과 화면 큰 CTA("다음 측정 시작") + 진행 dots(●●○) + 회차 카드(1/3·2/3·3/3).'),
      bullet('3회 완성 시 축하 모달 (체크마크 spring pop + 평균 점수 뱃지 + 다음 행동 3가지).'),
      bullet('face descriptor "same" 우선권 — 중간에 GPT가 다른 사람 판정해도 baseline 구축이 끊기지 않음.'),
      bullet('"baseline 완성 후 다시 1/3" 버그 정정 (built flag 영구 마킹).'),
      bullet('마이 페이지에 "측정 기준 재설정" 추가 — 기존 사용자도 3회 평균 baseline 적용 가능.'),

      callout('💡', '측정 후 자동 인사이트'),
      bullet('새 API /api/measure-insight — GPT-5.2 JSON 출력 (headline·cause·action·severity).'),
      bullet('변화 원인 추론에 현재·이전·변화·등록 제품·라이프스타일·최근 추세를 cross-check.'),
      bullet('"수분 ↓ — 어제 늦게 잤고 보습 단계 빠진 것이 영향일 수 있어요" 같은 문장으로 다음 행동 자연 안내.'),

      callout('🧴', '케어 페이지 사용자 부담 제거'),
      bullet('"오늘 모두 발랐어요" 큰 CTA로 16개를 한 번에 체크/해제.'),
      bullet('autoCheck flag — 매일 같은 제품 반복 사용자를 위한 자동 체크 인프라(매일 1회).'),
      bullet('자동 표준 스킨케어 순서 정렬: 클렌저→토너→에센스→세럼→크림→선크림→마스크팩→기타.'),
      bullet('신규·재등록 제품도 카테고리 기반 자동 위치 결정. 각 항목에 순서 번호 뱃지.'),
      bullet('수동 ▲▼ 정렬 모드는 사용 부담 + iOS 신뢰성 문제로 제거(자동 정렬로 대체).'),

      callout('🛠', '신규 파일·인프라'),
      bullet('src/engine/FaceDescriptor.js — face-api 128차원 임베딩 추출·비교.'),
      bullet('src/engine/ImageNormalizer.js — gray-world + auto-exposure.'),
      bullet('src/utils/deviceFingerprint.js — 디바이스 hash.'),
      bullet('src/components/MeasurementGuide.jsx — 5조건 + baseline 구축 카드(박수진 Tabler SVG 정밀화).'),
      bullet('src/components/BaselineCompleteModal.jsx — 3회 완성 축하 모달.'),
      bullet('api/measure-insight.js — 측정 후 자동 인사이트.'),

      callout('🚀', '배포'),
      bullet('main 머지·Vercel production·iOS Capacitor sync 다수.'),
      bullet('https://www.luaskin.co · https://nou-skin.vercel.app 전부 반영.'),

      callout('🗓', '다음'),
      bullet('베타 사용자 측정 데이터 누적 → 디바이스별 보정 factor 학습(장기).'),
      bullet('상담 채팅 추가 고도화 (자동 변화 알림·👍/👎 학습·TTS).'),
    ],
  });
  console.log('✅ 5/23 통합 entry:', r523.url);
})().catch(e => { console.error('❌', e.message); process.exit(1); });

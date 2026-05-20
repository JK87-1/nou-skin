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
  const all = await call('POST', '/v1/databases/' + env.NOTION_CALENDAR_DB_ID + '/query', { page_size: 100 });
  const our = all.results.find(p => {
    const d = p.properties && p.properties.Date && p.properties.Date.date && p.properties.Date.date.start;
    const titleArr = (p.properties && p.properties.Name && p.properties.Name.title) || [];
    const t = titleArr.map(x => x.plain_text).join('');
    return d === '2026-05-20' && /채팅 UI 안정화/.test(t);
  });
  if (!our) { console.error('5/20 entry not found'); return; }

  await call('PATCH', '/v1/pages/' + our.id, {
    properties: {
      Name: { title: [{ type: 'text', text: { content: '채팅 UI 안정화 · 박수진 UI 우선권 정리 · 노션 캘린더 단일화 · 보안 사고 대응 · 뷰티 에이전트 진화(Proactive·정밀 추천·멀티턴 기억)' } }] },
    },
  });

  const blocks = [
    callout('🤖', '뷰티 에이전트 진화 — Phase 5 (1·2·3)'),
    bullet('1. Proactive Insights — 사용자가 안 물어도 먼저 짚어줌. SkinStorage.getRecentTrend(7) helper로 최근 7일 측정에서 주목할 변화(개선/하락) 자동 추출. 답변 안에 자연 한 줄로 끼워넣기.'),
    bullet('2. 제품 추천 정밀화 — 일반론 추천 금지, 4단계 검증(약점 metric, 등록 제품 성분 cross-check, 구체 행동 가이드, 재측정 시점 명시). 1주일 후 다시 측정해서 효과 확인 같은 데이터 드리븐 권유.'),
    bullet('3. 멀티턴 기억 — UserMemoryStorage 신규(13개 metric 키워드 매칭). 자주 묻는 주제·최근 관심·시작·마지막 채팅 경과일 누적. 다크서클 자주 물어보시는데 이번에 5점 올랐어요 식 자연 반영. 5회 이상부터 활성화.'),
  ];

  await call('PATCH', '/v1/blocks/' + our.id + '/children', { children: blocks });
  console.log('✅ 5/20 entry에 에이전트 진화 섹션 추가됨');
})().catch(e => { console.error('❌', e.message); process.exit(1); });

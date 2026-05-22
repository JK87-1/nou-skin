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

// 노션 child block을 create-payload 형식으로 정리 (id·created 등 제거)
function sanitizeBlock(b) {
  const type = b.type;
  if (!type) return null;
  const content = b[type];
  if (!content) return null;
  // 일부 block은 children 무지원·복잡. 우리가 쓰는 callout/paragraph/bulleted_list_item/heading은 단순.
  const supported = ['callout', 'paragraph', 'bulleted_list_item', 'numbered_list_item', 'heading_1', 'heading_2', 'heading_3', 'divider', 'quote', 'to_do'];
  if (!supported.includes(type)) return null;

  const out = { object: 'block', type, [type]: {} };
  if (type === 'divider') return out;
  // rich_text·icon·color만 보존
  if (content.rich_text) out[type].rich_text = content.rich_text.map(r => ({
    type: 'text',
    text: { content: r.text?.content || r.plain_text || '' },
    ...(r.annotations ? { annotations: r.annotations } : {}),
  }));
  if (content.icon) out[type].icon = content.icon;
  if (content.color) out[type].color = content.color;
  if (content.checked != null) out[type].checked = content.checked;
  return out;
}

(async () => {
  // 1) 5/20 entries 찾기
  const all = await call('POST', '/v1/databases/' + env.NOTION_CALENDAR_DB_ID + '/query', { page_size: 100 });
  const may20 = all.results.filter(p => p.properties?.Date?.date?.start === '2026-05-20');
  console.log('5/20 entries:', may20.length);
  for (const p of may20) {
    const t = (p.properties.Name.title || []).map(x => x.plain_text).join('');
    console.log(' -', t.slice(0, 60));
  }

  // 우리 두 entry (박수진 "진단서" 외)
  const targets = may20.filter(p => {
    const t = (p.properties.Name.title || []).map(x => x.plain_text).join('');
    return t.includes('채팅 UI 안정화') || t.includes('채팅 Gemini 전환');
  });
  if (targets.length !== 2) {
    console.error('통합 대상 entry 2개를 못 찾음:', targets.length);
    process.exit(1);
  }

  // 시간 순 정렬 — 오전 작업("채팅 UI 안정화...")이 먼저, 오후 작업("채팅 Gemini 전환...")이 나중
  targets.sort((a, b) => {
    const ta = (a.properties.Name.title || []).map(x => x.plain_text).join('');
    const tb = (b.properties.Name.title || []).map(x => x.plain_text).join('');
    if (ta.includes('채팅 UI 안정화')) return -1;
    if (tb.includes('채팅 UI 안정화')) return 1;
    return 0;
  });

  // 2) 각 entry의 children fetch
  const allChildren = [];
  for (const t of targets) {
    const child = await call('GET', '/v1/blocks/' + t.id + '/children?page_size=100', null);
    const cleaned = (child.results || []).map(sanitizeBlock).filter(Boolean);
    // 섹션 구분자 (entry 사이)
    if (allChildren.length > 0) {
      allChildren.push({ object: 'block', type: 'divider', divider: {} });
    }
    allChildren.push(...cleaned);
  }

  // 작성자 표시 — 본문 가장 위에
  const header = [
    {
      object: 'block', type: 'callout',
      callout: {
        icon: { type: 'emoji', emoji: '👤' },
        rich_text: [{ type: 'text', text: { content: '작성자: 김준 (JUN KIM) · 영역: 측정 정확도·상담 에이전트·디자인·법무·노션 운영' } }],
      },
    },
  ];

  // 3) 두 entry archive
  for (const t of targets) {
    await call('PATCH', '/v1/pages/' + t.id, { archived: true });
    const title = (t.properties.Name.title || []).map(x => x.plain_text).join('');
    console.log('🗄  archived:', title.slice(0, 60));
  }

  // 4) 새 통합 entry
  const create = await call('POST', '/v1/pages', {
    parent: { database_id: env.NOTION_CALENDAR_DB_ID },
    properties: {
      Name: { title: [{ type: 'text', text: { content: '채팅 Gemini 전환 + 측정 정밀화 + 페르소나 도입 + UI 안정화·노션 단일화·보안 대응 (5/19~20 통합)' } }] },
      Date: { date: { start: '2026-05-20' } },
      ...(env.NOTION_CALENDAR_STATUS_PROP ? { [env.NOTION_CALENDAR_STATUS_PROP]: { status: { name: '본사이트' } } } : {}),
    },
    children: [...header, ...allChildren].slice(0, 100), // Notion 100 blocks 한도
  });
  console.log('\n✅ 5/20 통합 entry:', create.url);
})().catch(e => { console.error('❌', e.message); process.exit(1); });

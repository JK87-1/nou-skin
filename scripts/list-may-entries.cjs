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

(async () => {
  const all = await call('POST', '/v1/databases/' + env.NOTION_CALENDAR_DB_ID + '/query', { page_size: 100 });
  for (const d of ['2026-05-20', '2026-05-21']) {
    console.log(`\n===== ${d} =====`);
    const items = all.results.filter(p => p.properties?.Date?.date?.start === d);
    for (const p of items) {
      const t = p.properties.Name.title.map(x => x.plain_text).join('');
      console.log(`- ${t.slice(0, 80)}`);
    }
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });

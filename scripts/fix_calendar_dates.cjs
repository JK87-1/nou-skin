#!/usr/bin/env node
// 백필 항목들의 Date 속성을 정확한 날짜로 설정
const fs = require("fs");
const path = require("path");
const https = require("https");

const envPath = path.join(__dirname, "..", ".env");
const env = {};
fs.readFileSync(envPath, "utf8").split("\n").forEach((l) => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
});

function call(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: "api.notion.com",
      path: endpoint,
      method,
      headers: {
        Authorization: `Bearer ${env.NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let chunks = "";
      res.on("data", (c) => (chunks += c));
      res.on("end", () => {
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${chunks}`));
        else resolve(JSON.parse(chunks));
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function getTitle(page) {
  let t = "";
  for (const x of page.properties?.Page?.title || []) t += x.plain_text || "";
  return t;
}

function dateFromTitle(title) {
  // [5/17 ...] or [5/18 ...] prefix
  const m = title.match(/\[(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const month = m[1].padStart(2, "0");
  const day = m[2].padStart(2, "0");
  return `2026-${month}-${day}`;
}

(async () => {
  let cursor = undefined;
  const allPages = [];
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await call(
      "POST",
      `/v1/databases/${env.NOTION_CALENDAR_DB_ID}/query`,
      body
    );
    allPages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  console.log(`총 ${allPages.length}개 entry 검사`);

  let updated = 0, skipped = 0;
  for (const p of allPages) {
    const title = getTitle(p);
    const date = dateFromTitle(title);

    // 이미 Date 설정된 거면 skip
    const existingDate = p.properties?.Date?.date?.start;

    if (!date) { skipped++; continue; }
    if (existingDate === date) { skipped++; continue; }

    try {
      await call("PATCH", `/v1/pages/${p.id}`, {
        properties: { Date: { date: { start: date } } },
      });
      updated++;
      console.log(`✅ ${date} ← ${title.slice(0, 70)}`);
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      console.error(`❌ ${title}: ${e.message}`);
    }
  }
  console.log(`\n업데이트 ${updated}건 / 건너뜀 ${skipped}건`);
})();

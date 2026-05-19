#!/usr/bin/env node
/**
 * clear-progress-page.cjs — 노션 "09. 진행 상황" 페이지의 자동 기록 callout 일괄 삭제
 *
 * 사용법: node scripts/clear-progress-page.cjs
 * 효과: 페이지 안의 모든 callout(자동 기록) block 을 archive=true 로 삭제
 *       (실제 페이지 자체는 그대로, 자동 기록만 비움)
 *
 * 일회성 cleanup 용. 이후 notion-progress.cjs 는 캘린더 DB에만 기록.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  const text = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function callNotion(method, pathStr, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: "api.notion.com",
      path: pathStr,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(raw));
        else reject(new Error(`HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const env = loadEnv();
  if (!env.NOTION_TOKEN || !env.NOTION_PAGE_ID) {
    console.error("❌ NOTION_TOKEN / NOTION_PAGE_ID 없음");
    process.exit(1);
  }

  console.log("📄 페이지 children 조회 중...");
  let cursor = undefined;
  const allBlocks = [];
  do {
    const pathStr = `/v1/blocks/${env.NOTION_PAGE_ID}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`;
    const resp = await callNotion("GET", pathStr, null, env.NOTION_TOKEN);
    allBlocks.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);

  // 자동 기록은 callout 타입. 다른 block 은 유지.
  const targets = allBlocks.filter((b) => b.type === "callout");
  console.log(`📊 전체 ${allBlocks.length} blocks 중 callout(자동 기록) ${targets.length}건 삭제 예정.`);

  if (targets.length === 0) {
    console.log("✅ 삭제할 callout 없음.");
    return;
  }

  let deleted = 0;
  for (const block of targets) {
    try {
      await callNotion("DELETE", `/v1/blocks/${block.id}`, null, env.NOTION_TOKEN);
      deleted++;
      if (deleted % 10 === 0) console.log(`   ... ${deleted}/${targets.length}`);
    } catch (e) {
      console.warn(`⚠️ 삭제 실패 ${block.id}:`, e.message);
    }
  }
  console.log(`✅ 삭제 완료: ${deleted}/${targets.length}`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});

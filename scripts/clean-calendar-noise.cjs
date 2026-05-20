#!/usr/bin/env node
/**
 * clean-calendar-noise.cjs — 캘린더 DB에서 노이즈 entries 일괄 삭제(archive)
 *
 * 삭제 대상 (제목 prefix 또는 키워드 기반):
 *  - "측정 정확도 — 시작" / "측정 정확도 — 작업 시작"
 *  - "측정 정확도 — 완료" (본사이트만 남김)
 *  - "디자인·화면 — 시작"
 *  - "자동 헬스체크" 중 ✅ 정상 (실패·임계초과는 유지)
 *
 * 유지:
 *  - 본 사이트 반영 (🌟)
 *  - 박수진 작성 작업물 (예: 피부 측정 카메라·홈 화면 카드 시스템 등)
 *  - 헬스체크 오류 ❌
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

function isNoise(title, icon) {
  // 헬스체크 정상 (✅) → 노이즈
  if (icon === "✅" && /자동 헬스체크/.test(title)) return true;
  // 우리 status icon이 시작(🟡) 또는 진행중(🔵)인 entries → 모두 노이즈
  if (icon === "🟡" || icon === "🔵") return true;
  // 완료(✅) 중 우리 영역 라벨 — 본사이트만 유지하므로 노이즈
  if (icon === "✅" && (/측정 정확도\s*—\s*완료/.test(title) || /디자인·화면\s*—\s*완료/.test(title))) return true;
  // 그 외 (본 사이트 🌟·박수진 작업·오류 ❌·보류 ⏸) → 유지
  return false;
}

async function main() {
  const env = loadEnv();
  if (!env.NOTION_TOKEN || !env.NOTION_CALENDAR_DB_ID) {
    console.error("❌ NOTION_TOKEN / NOTION_CALENDAR_DB_ID 없음");
    process.exit(1);
  }

  console.log("📅 캘린더 DB query 중...");
  const allPages = [];
  let cursor = undefined;
  do {
    const body = { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) };
    const resp = await callNotion("POST", `/v1/databases/${env.NOTION_CALENDAR_DB_ID}/query`, body, env.NOTION_TOKEN);
    allPages.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : undefined;
  } while (cursor);

  console.log(`📊 총 ${allPages.length} pages`);

  const targets = allPages.filter((p) => {
    const title = (p.properties?.Name?.title || []).map((t) => t.plain_text).join("");
    const icon = p.icon?.emoji || "";
    return isNoise(title, icon);
  });

  console.log(`🗑  삭제 대상 ${targets.length}건 (시작·완료 단계 + 정상 헬스체크)`);
  if (targets.length === 0) {
    console.log("✅ 삭제할 노이즈 없음.");
    return;
  }

  // 샘플 표시
  console.log("샘플:");
  for (const p of targets.slice(0, 5)) {
    const title = (p.properties?.Name?.title || []).map((t) => t.plain_text).join("");
    console.log(`  - ${p.icon?.emoji || ""} ${title.slice(0, 60)}`);
  }

  let deleted = 0;
  for (const page of targets) {
    try {
      await callNotion("PATCH", `/v1/pages/${page.id}`, { archived: true }, env.NOTION_TOKEN);
      deleted++;
      if (deleted % 20 === 0) console.log(`   ... ${deleted}/${targets.length}`);
    } catch (e) {
      console.warn(`⚠️ 삭제 실패 ${page.id}:`, e.message);
    }
  }
  console.log(`✅ 삭제 완료: ${deleted}/${targets.length}`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});

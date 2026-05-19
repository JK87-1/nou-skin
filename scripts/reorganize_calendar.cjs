#!/usr/bin/env node
// 17건 정리 → 1개 5/18 종합 페이지로 재구성
const fs = require("fs");
const path = require("path");
const https = require("https");

const env = {};
fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n").forEach((l) => {
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
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${chunks.slice(0,300)}`));
        else resolve(JSON.parse(chunks));
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// 5/17 작업 (JK)
const work517 = [
  "🔬 측정 정확도 강화 — 트러블 감지 + conditionScore 안정화 + GPT Vision 해상도 상향",
  "🔬 AI 자연도 강화 — 결과 어드바이스 + AI 리포트 친근 톤 재작성",
  "🔬 상담사 음성 인식 고도화 — gpt-4o-transcribe + 스킨케어 트래커 통합",
  "📱 Capacitor 인프라 복원 — iOS + Android 네이티브 빌드 준비",
  "🎨 결과 화면 카드 3종 추가 — 7일 추세 / AI 정밀 판독 / 변화 비교 슬라이더 (cross-area 합의)",
  "📧 support@luaskin.co 메일 셋업 — Google Workspace 보조 도메인, Apple Mail 동기화",
];

// 5/18 작업 (JK)
const work518 = [
  "🔬 측정 사진 quality 검증 — 얼굴 회전·기울임 감지 추가",
  "🔬 AI 분석 fallback UX — 친화적 안내 카드",
  "🔬 측정 결과 이상치 감지 — 친절 안내 카드",
  "📊 헬스체크 강화 — 응답 시간·성공률·한도 초과 임계 알림",
  "📜 약관·정책 변호사 검토 의뢰 통합 자료",
  "📣 회사명 확정 + 베타 카톡 안내문 + 첫 측정 가이드 + FAQ",
  "🛠 Vercel 배포 환경 fix — check-env fallback + Hobby plan 12 endpoint 한도 대응",
];

function bullet(text) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

function h2(text) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: [{ type: "text", text: { content: text } }] },
  };
}

const children = [
  h2("📅 5월 17일 (일)"),
  ...work517.map(bullet),
  { object: "block", type: "divider", divider: {} },
  h2("📅 5월 18일 (월)"),
  ...work518.map(bullet),
];

(async () => {
  // 1) 기존 17개 scattered 백필 + 잘못된 DB 잔여 정리
  console.log("🗑️  기존 백필 entry 정리...");
  // 올바른 DB에서 [JK], [SJ] 시작 entry 삭제
  const res = await call("POST", `/v1/databases/${env.NOTION_CALENDAR_DB_ID}/query`, {
    page_size: 100,
    filter: { property: "Date", date: { on_or_after: "2026-05-17", on_or_before: "2026-05-18" } },
  });
  let archived = 0;
  for (const p of res.results) {
    const t = (p.properties?.Name?.title || []).map((x) => x.plain_text).join("");
    if (t.startsWith("[JK]") || t.startsWith("[SJ]")) {
      await call("PATCH", `/v1/pages/${p.id}`, { archived: true });
      archived++;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  console.log(`  ✅ ${archived}건 정리\n`);

  // 2) 5/18 종합 페이지 1개 생성
  console.log("📝 5/18 종합 페이지 생성...");
  const page = await call("POST", "/v1/pages", {
    parent: { database_id: env.NOTION_CALENDAR_DB_ID },
    icon: { type: "emoji", emoji: "🔬" },
    properties: {
      Name: {
        title: [{
          type: "text",
          text: { content: "측정 신뢰성 강화 · 베타 발사 인프라 · 약관·정책 정비" },
        }],
      },
      Date: { date: { start: "2026-05-18" } },
    },
    children,
  });
  console.log(`  ✅ 생성됨: ${page.url}\n`);
})().catch((e) => {
  console.error("❌ 실패:", e.message);
  process.exit(1);
});

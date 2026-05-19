#!/usr/bin/env node
// 5/17, 5/18 작업을 캘린더에 정확히 표시되도록 통합
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
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${chunks}`));
        else resolve(JSON.parse(chunks));
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// 백필 데이터 (기존 17건 항목)
const work517 = [
  ["🎨", "[SJ] UX 구조 전면 개편 — 글라스모피즘 디자인 + 탭 재구성 + 채팅 시트"],
  ["🎨", "[SJ] 케어 루틴 + 화장대·발견·마이 디자인 통일"],
  ["🔬", "[JK] 측정 정확도 강화 — 트러블 감지 강화 + conditionScore 안정화 + GPT Vision 해상도 상향"],
  ["🔬", "[JK] AI 자연도 강화 — 결과 어드바이스 + AI 리포트 친근 톤 재작성"],
  ["🔬", "[JK] 상담사 음성 인식 고도화 — gpt-4o-transcribe + 스킨케어 트래커 통합"],
  ["📱", "[JK] Capacitor 인프라 복원 — iOS + Android 네이티브 빌드 준비"],
  ["🎨", "[JK] 결과 화면 카드 3종 추가 — 7일 추세 / AI 정밀 판독 / 변화 비교 슬라이더 (cross-area 합의)"],
  ["📧", "[JK] support@luaskin.co 메일 셋업 — Google Workspace 보조 도메인, Apple Mail 동기화"],
];

const work518 = [
  ["🔬", "[JK] 측정 사진 quality 검증 — 얼굴 회전·기울임 감지 추가"],
  ["🔬", "[JK] AI 분석 fallback UX — 친화적 안내 카드"],
  ["🔬", "[JK] 측정 결과 이상치 감지 — 친절 안내 카드"],
  ["📊", "[JK] 헬스체크 강화 — 응답 시간·성공률·한도 초과 임계 알림"],
  ["📜", "[JK] 약관·정책 변호사 검토 의뢰 통합 자료"],
  ["📣", "[JK] 회사명 확정 + 베타 카톡 안내문 + 첫 측정 가이드 + FAQ"],
  ["🛠", "[JK] Vercel 배포 환경 fix — check-env fallback + Hobby plan 12 endpoint 한도 대응"],
  ["🎨", "[SJ] 홈 화면 폴리시 — 제목·부제·태그·오브 간격·색상 정밀 조정 (20+ 커밋)"],
  ["🎨", "[SJ] 피부날씨 모달 정리 + 인사이트 카드·채팅 시트 스타일 보강"],
];

function buildContentBlocks(items, dayLabel) {
  const blocks = [
    {
      object: "block", type: "heading_2",
      heading_2: { rich_text: [{ type: "text", text: { content: `📋 ${dayLabel} 작업 (${items.length}건)` } }] },
    },
    {
      object: "block", type: "divider", divider: {},
    },
  ];
  for (const [emoji, title] of items) {
    blocks.push({
      object: "block", type: "bulleted_list_item",
      bulleted_list_item: { rich_text: [{ type: "text", text: { content: `${emoji} ${title}` } }] },
    });
  }
  return blocks;
}

(async () => {
  // 1) 기존 "2026-05-17 작업 종합" 페이지에 5/17 항목 추가
  const PAGE_517 = "3638cbee-b11d-8164-a77d-d20bdc74a3c3";
  console.log("📅 5/17 작업 종합 페이지에 8건 추가...");
  await call("PATCH", `/v1/blocks/${PAGE_517}/children`, {
    children: buildContentBlocks(work517, "5월 17일"),
  });
  console.log("  ✅ 완료\n");

  // 2) "2026-05-18 작업 종합" 새 페이지 생성 (Date=5/18로 세팅)
  console.log("📅 5/18 작업 종합 새 페이지 생성...");
  const new518 = await call("POST", "/v1/pages", {
    parent: { database_id: env.NOTION_CALENDAR_DB_ID },
    icon: { type: "emoji", emoji: "📅" },
    properties: {
      Page: { title: [{ type: "text", text: { content: "2026-05-18 작업 종합" } }] },
      Date: { date: { start: "2026-05-18" } },
    },
    children: buildContentBlocks(work518, "5월 18일"),
  });
  console.log(`  ✅ 페이지 ID: ${new518.id}\n`);

  // 3) 17개 백필 entry 아카이브 (삭제)
  console.log("🗑️  중복 백필 entry 17건 아카이브...");
  const res = await call("POST", `/v1/databases/${env.NOTION_CALENDAR_DB_ID}/query`, {
    page_size: 50,
    filter: { property: "Date", date: { on_or_after: "2026-05-17" } },
  });
  const toArchive = res.results.filter((r) => {
    const t = (r.properties?.Page?.title || []).map((x) => x.plain_text).join("");
    return t.startsWith("[5/17 ") || t.startsWith("[5/18 ");
  });
  for (const p of toArchive) {
    try {
      await call("PATCH", `/v1/pages/${p.id}`, { archived: true });
      const t = (p.properties?.Page?.title || []).map((x) => x.plain_text).join("");
      console.log(`  ✅ 삭제: ${t.slice(0, 60)}`);
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      console.error(`  ❌ ${e.message}`);
    }
  }

  console.log("\n✅ 완료. 캘린더 확인:");
  console.log("  · 5/17 셀: '2026-05-17 작업 종합' 클릭 → 8건 작업 확인");
  console.log("  · 5/18 셀: '2026-05-18 작업 종합' 클릭 → 9건 작업 확인");
})().catch((e) => {
  console.error("❌ 실패:", e.message);
  process.exit(1);
});

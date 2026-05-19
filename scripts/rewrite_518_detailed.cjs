#!/usr/bin/env node
// 5/18 종합 페이지를 박수진 대표님 스타일로 상세 재작성
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
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode}: ${chunks.slice(0,400)}`));
        else resolve(JSON.parse(chunks));
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const bullet = (text) => ({
  object: "block",
  type: "bulleted_list_item",
  bulleted_list_item: { rich_text: [{ type: "text", text: { content: text } }] },
});
const para = (text) => ({
  object: "block",
  type: "paragraph",
  paragraph: { rich_text: [{ type: "text", text: { content: text } }] },
});

const sections = [
  ["🔬 측정 정확도 & 안정화", [
    "트러블 감지 강화 — GPT 민감도 상향 + 좌우 비대칭 stabilization (5/17)",
    "conditionScore 변동 폭 안정화 — factor 1.8→0.8, troubleVal round-trip 제거 (5/17)",
    "CV-only path conditionScore도 amplification factor 0.8로 통일 (5/17)",
    "트러블 카운트 raw count baseline 클램프로 UI 흔들림 안정화 (5/17)",
    "GPT Vision 입력 이미지 해상도/품질 상향 (512→1024, q0.7→0.9) (5/17)",
    "측정 사진 quality 검증에 얼굴 회전·기울임 감지 추가 (5/18)",
    "측정 결과 이상치 감지 + 친절 안내 카드 (5/18)",
  ]],
  ["🤖 AI 자연도 · 상담사 강화", [
    "AI 리포트(GPT summary) 자연도 강화 — 친근한 톤으로 재작성 (5/17)",
    "generateAdvice(결과 화면 어드바이스) 톤 자연화 (5/17)",
    "피부 상담사가 스킨케어 트래커 등록 제품을 인지·분석하도록 통합 (5/17)",
    "상담사 음성 인식을 OpenAI gpt-4o-transcribe로 고도화 (5/17)",
    "AI 분석 fallback 시 사용자 친화 안내 카드 (5/18)",
  ]],
  ["🎨 결과 화면 카드 시스템", [
    "7일 추세 카드 추가 (cross-area 합의) — 측정 점수 시계열 시각화 (5/17)",
    "AI 정밀 판독 카드 리디자인 + 부위별 소견 노출 (cross-area 합의) (5/17)",
    "변화 비교 슬라이더 추가 — 이전/현재 측정 좌우 비교 (cross-area 합의) (5/17)",
    "백업 권장 안내창 2주 cooldown 적용 (5/17)",
  ]],
  ["📱 Capacitor 네이티브 인프라 복원", [
    "단계 1/2 — npm 설치 + 설정 + init 코드 (5/17)",
    "단계 2/2 — iOS 플랫폼 추가 + 권한 설정 (5/17)",
    "Android 플랫폼 디렉토리 추가 + 권한 명시 (5/17)",
    "PWA 설치 안내 모달을 네이티브 앱에서 숨김 처리 (5/17)",
  ]],
  ["🌐 베타 발사 인프라", [
    "support@luaskin.co 메일 셋업 — Google Workspace 보조 도메인 추가, Apple Mail 계정 동기화 (5/17)",
    "회사명 확정 (5/18)",
    "베타 카톡 안내문 + 첫 측정 가이드 + FAQ 작성 (5/18)",
    "약관·정책 변호사 검토 의뢰 통합 자료 정비 (5/18)",
    "헬스체크 강화 — 응답 시간·성공률·한도 초과 임계 알림 (5/18)",
    "PWA manifest lang='ko' / dir='ltr' 명시 (5/18)",
    "백업 fallback을 서버 endpoint 호출 → 클라이언트 <a download>로 전환 (5/18)",
  ]],
  ["🛠 Vercel 배포 환경 fix", [
    "OPENAI_API_KEY Preview scope 추가 (Vercel UI에서) (5/17)",
    "Preview 재배포 trigger 2회 — API key 환경 fix 검증 (5/17)",
    "check-env.cjs를 process.env fallback 지원하도록 수정 — Vercel 빌드 차단 해소 (5/18)",
    "Vercel Hobby plan 12 endpoint 한도 대응 (5/18)",
    "Production redeploy trigger (Vercel auto-deploy missed 케이스) (5/17)",
  ]],
  ["📊 노션 자동 기록 인프라", [
    "scripts/notion-progress.cjs — 작업 진행 자동 로그 (09. 진행 상황 + 루아 캘린더 동시 기록) (5/18)",
    "CLAUDE.md 협업 룰 #5 — 두 Claude Code 인스턴스가 자동 기록 (5/18)",
    "캘린더 Date 속성 추가 + 자동 KST 날짜 부여 (5/18)",
  ]],
];

const children = [];
for (const [header, items] of sections) {
  children.push(para(header));
  for (const item of items) children.push(bullet(item));
}

(async () => {
  // 1) 기존 5/18 종합 페이지 archive
  console.log("🗑️  기존 5/18 종합 페이지 정리...");
  const OLD_PAGE = "3658cbeeb11d811cb2ddf1f6ae396199";
  await call("PATCH", `/v1/pages/${OLD_PAGE}`, { archived: true });
  console.log("  ✅\n");

  // 2) 상세 버전 새로 생성
  console.log("📝 상세 버전 5/18 종합 페이지 생성...");
  const page = await call("POST", "/v1/pages", {
    parent: { database_id: env.NOTION_CALENDAR_DB_ID },
    icon: { type: "emoji", emoji: "🔬" },
    properties: {
      Name: {
        title: [{
          type: "text",
          text: { content: "측정 신뢰성·AI 자연도·결과 화면 카드·Capacitor·베타 발사 인프라·Vercel 환경·노션 자동화" },
        }],
      },
      Date: { date: { start: "2026-05-18" } },
    },
    children,
  });
  console.log(`  ✅ ${page.url}\n`);

  const total = sections.reduce((s, [, it]) => s + it.length, 0);
  console.log(`총 ${sections.length}개 섹션 · ${total}개 상세 항목`);
})().catch((e) => {
  console.error("❌ 실패:", e.message);
  process.exit(1);
});

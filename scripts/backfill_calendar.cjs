#!/usr/bin/env node
// 노션 캘린더 백필 (1회용) — 5/17, 5/18 주요 작업
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

// 백필 항목: [날짜 라벨, emoji, title]
const items = [
  // 5/17 - 일요일 Day 1
  ["5/17 (일)", "🎨", "[5/17 SJ] UX 구조 전면 개편 — 글라스모피즘 디자인 + 탭 재구성 + 채팅 시트"],
  ["5/17 (일)", "🎨", "[5/17 SJ] 케어 루틴 + 화장대·발견·마이 디자인 통일"],
  ["5/17 (일)", "🔬", "[5/17 JK] 측정 정확도 강화 — 트러블 감지 강화 + conditionScore 안정화 + GPT Vision 해상도 상향"],
  ["5/17 (일)", "🔬", "[5/17 JK] AI 자연도 강화 — 결과 어드바이스 + AI 리포트 친근 톤 재작성"],
  ["5/17 (일)", "🔬", "[5/17 JK] 상담사 음성 인식 고도화 — gpt-4o-transcribe + 스킨케어 트래커 통합"],
  ["5/17 (일)", "📱", "[5/17 JK] Capacitor 인프라 복원 — iOS + Android 네이티브 빌드 준비"],
  ["5/17 (일)", "🎨", "[5/17 JK] 결과 화면 카드 3종 추가 — 7일 추세 / AI 정밀 판독 / 변화 비교 슬라이더 (cross-area 합의)"],
  ["5/17 (일)", "📧", "[5/17 JK] support@luaskin.co 메일 셋업 — Google Workspace 보조 도메인, Apple Mail 동기화"],

  // 5/18 - 월요일 Day 2 (오늘)
  ["5/18 (월)", "🔬", "[5/18 JK] 측정 사진 quality 검증 — 얼굴 회전·기울임 감지 추가"],
  ["5/18 (월)", "🔬", "[5/18 JK] AI 분석 fallback UX — 친화적 안내 카드"],
  ["5/18 (월)", "🔬", "[5/18 JK] 측정 결과 이상치 감지 — 친절 안내 카드"],
  ["5/18 (월)", "📊", "[5/18 JK] 헬스체크 강화 — 응답 시간·성공률·한도 초과 임계 알림"],
  ["5/18 (월)", "📜", "[5/18 JK] 약관·정책 변호사 검토 의뢰 통합 자료"],
  ["5/18 (월)", "📣", "[5/18 JK] 회사명 확정 + 베타 카톡 안내문 + 첫 측정 가이드 + FAQ"],
  ["5/18 (월)", "🛠", "[5/18 JK] Vercel 배포 환경 fix — check-env fallback + Hobby plan 12 endpoint 한도 대응"],
  ["5/18 (월)", "🎨", "[5/18 SJ] 홈 화면 폴리시 — 제목·부제·태그·오브 간격·색상 정밀 조정 (20+ 커밋)"],
  ["5/18 (월)", "🎨", "[5/18 SJ] 피부날씨 모달 정리 + 인사이트 카드·채팅 시트 스타일 보강"],
];

(async () => {
  let ok = 0, fail = 0;
  for (const [day, emoji, title] of items) {
    try {
      await call("POST", "/v1/pages", {
        parent: { database_id: env.NOTION_CALENDAR_DB_ID },
        icon: { type: "emoji", emoji },
        properties: { Page: { title: [{ type: "text", text: { content: title } }] } },
      });
      ok++;
      console.log(`✅ ${day} ${emoji} ${title.slice(0, 60)}...`);
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      fail++;
      console.error(`❌ ${title}: ${e.message}`);
    }
  }
  console.log(`\n총 ${items.length}개 — ${ok}건 성공, ${fail}건 실패`);
})();

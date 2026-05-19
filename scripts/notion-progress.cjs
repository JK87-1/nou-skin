#!/usr/bin/env node
/**
 * notion-progress.js — 노션 "09. 진행 상황" 페이지에 작업 로그 자동 기록
 *
 * 사용법:
 *   node scripts/notion-progress.js "메시지" [상태] [부가정보]
 *
 * 예시:
 *   node scripts/notion-progress.js "calibrate 복구 시작" "진행중"
 *   node scripts/notion-progress.js "측정 변별력 회복" "완료" "https://nou-skin-xxx.vercel.app"
 *
 * 환경변수 (~/nou-skin/.env):
 *   NOTION_TOKEN, NOTION_PAGE_ID
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const https = require("https");

// 1) .env 로드
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

// 2) git 정보 수집 (각 항목 독립 실행)
function gitInfo() {
  const cwd = path.join(__dirname, "..");
  const safe = (cmd) => {
    try { return execSync(cmd, { cwd, stdio: ["pipe", "pipe", "pipe"] }).toString().trim(); }
    catch (_) { return "?"; }
  };
  const cfgName = safe("git config user.name");
  const logName = safe("git log -1 --format=%an");
  const author = (cfgName && cfgName !== "?") ? cfgName
               : (logName && logName !== "?") ? logName
               : (process.env.USER || "?");
  return {
    branch: safe("git rev-parse --abbrev-ref HEAD"),
    sha: safe("git rev-parse --short HEAD"),
    author,
  };
}

// 3) 영역 식별 (사람 친화적 이름)
function detectArea(branch, status) {
  if (status === "본사이트" || status === "반영") return { label: "본 사이트 반영", emoji: "🌟" };
  if (branch.startsWith("accuracy/")) return { label: "측정 정확도", emoji: "🔬" };
  if (branch.startsWith("ux/")) return { label: "디자인·화면", emoji: "🎨" };
  if (branch === "main") return { label: "본 사이트", emoji: "🌟" };
  return { label: "작업", emoji: "📝" };
}

// 4) 상태 → 한국어 라벨 + 아이콘
const STATUS = {
  "시작":   { icon: "🟡", label: "작업 시작" },
  "진행중": { icon: "🔵", label: "작업 진행중" },
  "완료":   { icon: "✅", label: "작업 완료" },
  "본사이트": { icon: "🌟", label: "본 사이트 반영" },
  "반영":   { icon: "🌟", label: "본 사이트 반영" },
  "보류":   { icon: "⏸",  label: "보류" },
  "오류":   { icon: "❌", label: "오류" },
};

// 5) Notion API 호출
function callNotion(method, endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: "api.notion.com",
      path: endpoint,
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let chunks = "";
      res.on("data", (c) => chunks += c);
      res.on("end", () => {
        try {
          const json = JSON.parse(chunks);
          if (res.statusCode >= 400) reject(new Error(`Notion ${res.statusCode}: ${JSON.stringify(json)}`));
          else resolve(json);
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// 6) 노션 블록 빌더 (사람 친화 포맷)
function buildBlocks({ author, area, statusInfo, message, extra }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short",
  });
  const timeStr = now.toLocaleTimeString("ko-KR", {
    timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit", hour12: true,
  });

  // 헤더: "측정 정확도 — 작업 완료"
  const headerText = `${area.label} — ${statusInfo.label}`;

  // 메타 한 줄: "👤 JUN KIM · 🗓 5월 16일 (토) 오후 5:20"
  const metaText = `👤 ${author}    🗓 ${dateStr} ${timeStr}`;

  // 메시지 (들여쓰기·정리)
  const bodyText = `📝 ${message}`;

  // 미리보기 (있을 때만)
  const linkText = extra ? `🔗 미리보기: ${extra}` : null;

  // 색상
  const color = statusInfo.label.includes("완료") || statusInfo.label.includes("반영")
    ? "green_background"
    : statusInfo.label === "오류"
    ? "red_background"
    : statusInfo.label === "보류"
    ? "yellow_background"
    : "gray_background";

  const richText = [
    { type: "text", text: { content: headerText }, annotations: { bold: true } },
    { type: "text", text: { content: "\n" + metaText }, annotations: { color: "gray" } },
    { type: "text", text: { content: "\n\n" + bodyText } },
  ];
  if (linkText) {
    richText.push({ type: "text", text: { content: "\n\n" + linkText }, annotations: { color: "blue" } });
  }

  return [
    {
      object: "block",
      type: "callout",
      callout: {
        icon: { type: "emoji", emoji: statusInfo.icon },
        rich_text: richText,
        color,
      },
    },
  ];
}

// 7) 캘린더 DB에 행 추가 (루아 캘린더)
async function addCalendarEntry({ env, author, area, statusInfo, message, extra }) {
  if (!env.NOTION_CALENDAR_DB_ID) return; // 캘린더 ID 없으면 skip
  const title = `${area.label} — ${message}`;
  const richTitle = [{ type: "text", text: { content: title } }];

  // 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
  const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const body = {
    parent: { database_id: env.NOTION_CALENDAR_DB_ID },
    icon: { type: "emoji", emoji: statusInfo.icon },
    properties: {
      Name: { title: richTitle },
      Date: { date: { start: kstDate } },
    },
    children: buildBlocks({ author, area, statusInfo, message, extra }),
  };

  try {
    await callNotion("POST", "/v1/pages", body, env.NOTION_TOKEN);
    return true;
  } catch (e) {
    console.error("⚠️ 캘린더 기록 실패:", e.message);
    return false;
  }
}

// 8) Main
async function main() {
  const env = loadEnv();
  if (!env.NOTION_TOKEN || !env.NOTION_PAGE_ID) {
    console.error("❌ NOTION_TOKEN 또는 NOTION_PAGE_ID 가 .env 에 없습니다.");
    process.exit(1);
  }

  const [, , message, status = "진행중", extra = ""] = process.argv;
  if (!message) {
    console.error("사용법: node scripts/notion-progress.cjs \"메시지\" [상태] [미리보기URL]");
    console.error("상태: 시작 | 진행중 | 완료 | 본사이트 | 보류 | 오류");
    process.exit(1);
  }

  const statusInfo = STATUS[status] || STATUS["진행중"];
  const { branch, author } = gitInfo();
  const area = detectArea(branch, status);
  const blocks = buildBlocks({ author, area, statusInfo, message, extra });

  try {
    // 캘린더 DB에만 기록 (진행 상황 페이지 callout 추가는 더 이상 안 함 — 노이즈 제거)
    const calendarOk = await addCalendarEntry({ env, author, area, statusInfo, message, extra });

    if (calendarOk) {
      console.log(`✅ 캘린더 기록: ${area.label} — ${statusInfo.label}`);
      console.log(`   ${author} · ${message}`);
    } else {
      console.error("❌ 캘린더 기록 실패 (NOTION_CALENDAR_DB_ID 확인 필요)");
      process.exit(1);
    }
  } catch (e) {
    console.error("❌ 노션 기록 실패:", e.message);
    process.exit(1);
  }
}

main();

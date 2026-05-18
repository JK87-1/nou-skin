#!/usr/bin/env node
/**
 * check-env.cjs — .env 포맷·필수 키 사전 검증
 *
 * dev/build/preview 시작 전에 자동 실행. 잘못된 .env 포맷으로
 * production에 invalid 키가 들어가는 사고를 막기 위함.
 *
 * 검증 항목:
 *  1. .env 파일 존재
 *  2. OPENAI_API_KEY 라인 존재, sk- 또는 sk-proj- 로 시작
 *  3. 값 안에 줄바꿈/공백/'=' 없음 (다른 변수가 끼어붙은 사고 방지)
 *  4. 값 길이 합리적 범위 (sk-proj-* 는 150자 이상)
 *  5. NOTION_TOKEN 라인 존재, ntn_ 로 시작
 *
 * 실패 시 exit 1 → dev/build 차단.
 */

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function fail(msg, hint) {
  console.error(`\n${RED}❌ .env 검증 실패${RESET}`);
  console.error(`   ${msg}`);
  if (hint) console.error(`   ${YELLOW}↳ ${hint}${RESET}`);
  console.error('');
  process.exit(1);
}

function warn(msg) {
  console.warn(`${YELLOW}⚠  ${msg}${RESET}`);
}

// .env 파일이 없으면 process.env 기반 검증 (Vercel/CI 빌드 환경 등)
const env = {};
if (fs.existsSync(ENV_PATH)) {
  const text = fs.readFileSync(ENV_PATH, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) {
      warn(`.env line ${i + 1}: '=' 없음 → 무시됨: "${line.slice(0, 40)}..."`);
      continue;
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    env[key] = { value, line: i + 1 };
  }
} else {
  // Vercel/CI 빌드: 환경 변수에서 직접 검증
  if (process.env.OPENAI_API_KEY) env.OPENAI_API_KEY = { value: process.env.OPENAI_API_KEY, line: 0 };
  if (process.env.NOTION_TOKEN) env.NOTION_TOKEN = { value: process.env.NOTION_TOKEN, line: 0 };
  console.log(`${YELLOW}ℹ${RESET}  .env 파일 없음 → 환경 변수(process.env)에서 직접 검증`);
}

// 1. OPENAI_API_KEY 존재
if (!env.OPENAI_API_KEY) {
  fail('OPENAI_API_KEY 라인이 .env에 없습니다.');
}
const openai = env.OPENAI_API_KEY;

// 2. 접두사
if (!openai.value.startsWith('sk-')) {
  fail(
    `OPENAI_API_KEY 값이 'sk-' 로 시작하지 않습니다. (line ${openai.line})`,
    `현재 값 앞부분: "${openai.value.slice(0, 30)}..."`
  );
}

// 3. 다른 변수가 끼어붙음 감지 (이번 사고 패턴)
if (/[A-Z_]+=/.test(openai.value)) {
  const match = openai.value.match(/([A-Z_]+)=/);
  fail(
    `OPENAI_API_KEY 값 안에 다른 변수(${match[1]})가 끼어붙어 있습니다. (line ${openai.line})`,
    `줄바꿈 누락 가능성. 각 변수를 별도 줄에 분리하세요.`
  );
}

// 4. 공백·줄바꿈·따옴표 (값 안에 있으면 안 됨)
if (/\s/.test(openai.value)) {
  fail(`OPENAI_API_KEY 값에 공백이 있습니다. (line ${openai.line})`);
}
if (openai.value.includes('"') || openai.value.includes("'")) {
  fail(`OPENAI_API_KEY 값에 따옴표가 있습니다. (line ${openai.line})`, '따옴표 없이 raw 문자열로 두세요.');
}

// 5. 길이
if (openai.value.length < 50) {
  fail(
    `OPENAI_API_KEY 길이가 비정상적으로 짧습니다 (${openai.value.length}자, line ${openai.line})`,
    'sk-* 키는 보통 50자 이상, sk-proj-* 키는 150자 이상입니다.'
  );
}
if (openai.value.startsWith('sk-proj-') && openai.value.length < 150) {
  warn(`OPENAI_API_KEY 길이(${openai.value.length}자)가 sk-proj-* 기준치보다 짧습니다.`);
}

// 6. NOTION_TOKEN (선택적이지만 있으면 형식 검사)
if (env.NOTION_TOKEN) {
  const notion = env.NOTION_TOKEN;
  if (!notion.value.startsWith('ntn_') && !notion.value.startsWith('secret_')) {
    warn(`NOTION_TOKEN 이 'ntn_' 또는 'secret_' 로 시작하지 않습니다. (line ${notion.line})`);
  }
  if (/[A-Z_]+=/.test(notion.value)) {
    const match = notion.value.match(/([A-Z_]+)=/);
    fail(
      `NOTION_TOKEN 값 안에 다른 변수(${match[1]})가 끼어붙어 있습니다. (line ${notion.line})`,
      '줄바꿈 누락 가능성.'
    );
  }
}

console.log(`${GREEN}✅ .env 검증 통과${RESET} — OPENAI_API_KEY (${openai.value.length}자, sk-proj 형식: ${openai.value.startsWith('sk-proj-')})${env.NOTION_TOKEN ? ', NOTION_TOKEN' : ''}`);

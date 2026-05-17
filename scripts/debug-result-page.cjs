#!/usr/bin/env node
/**
 * debug-result-page.cjs — 결과 페이지 빈 공간 자동 진단
 *
 * dev server (localhost:5174) + ?devresult=1 query로 mock data 결과 페이지 진입.
 * "전체 피부 분석" 카드의 DOM 구조 + 자식들의 bounding rect을 출력.
 * 빈 공간이 어느 element에서 오는지 정확히 식별.
 */

const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT = '/tmp/lua-debug-result.png';

(async () => {
  const mode = process.argv[2] || 'cv_only';
  const url = `http://localhost:5174/?devresult=1&mode=${mode}`;

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 412, height: 800, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('[browser]', msg.type(), msg.text()));
  page.on('pageerror', e => console.error('[pageerror]', e.message));

  console.log(`navigating to ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // 결과 페이지 로드 대기 — "전체 피부 분석" 텍스트가 보일 때까지
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('div')).some(d => d.textContent?.trim() === '전체 피부 분석'),
    { timeout: 15000 }
  );

  // 카드 찾기 + 트리 분석
  const analysis = await page.evaluate(() => {
    const headerDiv = Array.from(document.querySelectorAll('div')).find(
      d => d.textContent?.trim() === '전체 피부 분석'
    );
    if (!headerDiv) return { error: 'header not found' };
    // glass-card 부모로 거슬러 올라가기
    let card = headerDiv;
    while (card && !card.classList?.contains('glass-card')) card = card.parentElement;
    if (!card) return { error: 'glass-card parent not found' };

    const cardRect = card.getBoundingClientRect();
    const children = [];
    for (const child of card.children) {
      const r = child.getBoundingClientRect();
      const text = (child.textContent || '').slice(0, 80).replace(/\s+/g, ' ');
      children.push({
        tag: child.tagName,
        cls: child.className || '',
        top: r.top,
        bottom: r.bottom,
        height: r.height,
        text,
      });
    }
    return {
      cardRect: { top: cardRect.top, bottom: cardRect.bottom, height: cardRect.height },
      childCount: card.children.length,
      children,
      cardHTML: card.outerHTML.slice(0, 2000),
    };
  });

  console.log('\n=== ANALYSIS ===');
  console.log(JSON.stringify(analysis, null, 2));

  // 카드 영역 screenshot
  await page.evaluate(() => {
    const headerDiv = Array.from(document.querySelectorAll('div')).find(
      d => d.textContent?.trim() === '전체 피부 분석'
    );
    let card = headerDiv;
    while (card && !card.classList?.contains('glass-card')) card = card.parentElement;
    if (card) card.scrollIntoView({ block: 'start' });
  });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: SHOT, fullPage: true });
  console.log(`\nscreenshot: ${SHOT}`);

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

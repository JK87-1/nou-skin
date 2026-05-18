// Vercel Serverless Function: AI 분석 자동 헬스체크
//
// 매일 1회 Vercel Cron이 호출 → OpenAI 키·gpt-5.2 모델 유효성 확인 + 어제 측정 통계 조회 → 노션 기록.
// 수동 트리거: curl https://www.luaskin.co/api/healthcheck

import { readDailyStats, getKstDate } from '../lib/stats.js';

const NOTION_PAGE_ID_ENV = 'NOTION_PAGE_ID';
const NOTION_TOKEN_ENV = 'NOTION_TOKEN';

async function notifyNotion(message, status) {
  const token = process.env[NOTION_TOKEN_ENV];
  const pageId = process.env[NOTION_PAGE_ID_ENV];
  if (!token || !pageId) {
    console.warn('Notion env missing, skip notify');
    return;
  }

  const emoji = status === '오류' ? '❌' : '✅';
  const kstNow = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
  const body = {
    children: [{
      object: 'block',
      type: 'callout',
      callout: {
        icon: { type: 'emoji', emoji },
        color: status === '오류' ? 'red_background' : 'green_background',
        rich_text: [
          { type: 'text', text: { content: `자동 헬스체크 ${kstNow} KST\n${message}` } },
        ],
      },
    }],
  };

  try {
    const resp = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.warn('Notion notify HTTP', resp.status, t.slice(0, 200));
    }
  } catch (e) {
    console.warn('Notion notify failed:', e.message || e);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET/POST only' });
  }

  const startedAt = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    await notifyNotion('OPENAI_API_KEY 환경 변수 누락. Vercel 환경변수 설정을 확인하세요.', '오류');
    return res.status(500).json({ ok: false, error: 'OPENAI_API_KEY missing' });
  }

  try {
    const resp = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const elapsed = Date.now() - startedAt;

    if (!resp.ok) {
      const body = await resp.text();
      const snippet = body.slice(0, 200);
      await notifyNotion(`OpenAI 응답 ${resp.status}. OPENAI_API_KEY 무효 또는 결제 문제 가능성. 응답: ${snippet}`, '오류');
      return res.status(502).json({ ok: false, status: resp.status, body: snippet });
    }

    const data = await resp.json();
    const ids = (data.data || []).map(m => m.id);
    const hasGpt52 = ids.includes('gpt-5.2');

    if (!hasGpt52) {
      await notifyNotion('OpenAI 키는 유효하지만 gpt-5.2 모델 접근 불가. 모델 deprecation 또는 권한 변경 확인 필요.', '오류');
      return res.status(502).json({ ok: false, error: 'gpt-5.2 not available', available_gpt5: ids.filter(i => i.startsWith('gpt-5')) });
    }

    // 어제 측정 통계 조회 (Upstash Redis)
    const yesterday = getKstDate(-1);
    const stats = await readDailyStats(yesterday);

    let statsLine = '';
    const alerts = []; // 임계 초과 항목 누적

    if (stats && stats.requests > 0) {
      const rateStr = stats.successRate != null ? `${stats.successRate.toFixed(1)}%` : '-';
      const avgStr = stats.avgResponseMs > 0 ? `${(stats.avgResponseMs / 1000).toFixed(1)}초` : '-';
      statsLine = `\n어제(${yesterday}) 측정: ${stats.requests}건 · 성공 ${stats.success} · 실패 ${stats.failures}${stats.rateLimit > 0 ? ` · 한도초과 ${stats.rateLimit}` : ''} · 성공률 ${rateStr} · 평균 응답 ${avgStr}`;

      // 임계 초과 감지 (베타 운영 모니터링)
      if (stats.avgResponseMs > 25000) {
        alerts.push(`⏱ 평균 응답 시간 ${(stats.avgResponseMs / 1000).toFixed(1)}초 (임계 25초 초과)`);
      }
      if (stats.successRate != null && stats.successRate < 70) {
        alerts.push(`📉 성공률 ${stats.successRate.toFixed(1)}% (임계 70% 미만)`);
      }
      if (stats.requests >= 10 && stats.rateLimit > stats.requests * 0.1) {
        alerts.push(`🚦 한도초과 ${stats.rateLimit}건 (전체의 ${(stats.rateLimit / stats.requests * 100).toFixed(0)}%)`);
      }
    } else if (stats) {
      statsLine = `\n어제(${yesterday}) 측정 0건`;
    }

    if (alerts.length > 0) {
      await notifyNotion(`⚠️ 임계 초과 감지\n${alerts.join('\n')}\n\nOpenAI 키 유효 · 헬스체크 자체 응답 ${elapsed}ms${statsLine}`, '오류');
      return res.status(200).json({ ok: true, alerts, elapsed_ms: elapsed, gpt52: true, yesterday_stats: stats });
    }

    await notifyNotion(`OpenAI 키 유효 · gpt-5.2 사용 가능 · 응답 ${elapsed}ms${statsLine}`, '완료');
    return res.status(200).json({ ok: true, elapsed_ms: elapsed, gpt52: true, yesterday_stats: stats });
  } catch (e) {
    const msg = e.message || String(e);
    await notifyNotion(`헬스체크 실패 — 예외: ${msg.slice(0, 200)}`, '오류');
    return res.status(500).json({ ok: false, error: msg });
  }
}

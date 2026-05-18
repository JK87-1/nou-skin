// Vercel Serverless Function: 백업 JSON 파일 다운로드
//
// MyPage 백업 흐름에서 navigator.canShare({files}) 미지원 환경(PC Chrome 등)의 fallback.
// POST body(JSON 문자열) → Content-Disposition: attachment 헤더로 응답하여 브라우저가
// "lua-backup-YYYY-MM-DD.json" 으로 다운로드 트리거하게 함.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    // body는 raw JSON 문자열(또는 파싱된 객체) — 둘 다 지원
    let payload;
    if (typeof req.body === 'string') {
      payload = req.body;
    } else if (req.body && typeof req.body === 'object') {
      payload = JSON.stringify(req.body);
    } else {
      return res.status(400).json({ error: 'No backup payload' });
    }

    if (payload.length > 50 * 1024 * 1024) {
      return res.status(413).json({ error: 'Backup too large (>50MB)' });
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `lua-backup-${dateStr}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(payload);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

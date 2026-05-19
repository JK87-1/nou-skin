/**
 * 백업 다운로드 API
 *
 * iOS 인앱 브라우저(카카오톡, 네이버 등)에서는 Blob URL이나 <a download>가
 * 작동하지 않으므로, 서버에서 Content-Disposition: attachment 헤더로
 * 응답하여 네이티브 다운로드를 트리거합니다.
 *
 * POST /api/backup-download  (Content-Type: application/json)
 * Body: JSON string (backup data itself)
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // body is parsed JSON object from bodyParser
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'No data provided' });
    }

    // Re-serialize to JSON string for download
    const jsonStr = JSON.stringify(body);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `lua-backup-${dateStr}.json`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', Buffer.byteLength(jsonStr, 'utf8'));
    res.send(jsonStr);
  } catch (e) {
    res.status(500).json({ error: 'Backup download failed' });
  }
}

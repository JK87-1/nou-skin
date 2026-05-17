// Vercel Serverless Function: OpenAI Audio transcription (gpt-4o-transcribe)
// 상담사 음성 입력 → 텍스트 변환. 한국어 + 화장품 도메인 힌트 prompt 포함.

const RATE_LIMIT = new Map();
const MAX_REQUESTS_PER_DAY = 200; // 1회당 짧은 발화라 넉넉히
const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // 8MB raw (base64 디코딩 후 기준)

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip);
  if (!entry || now > entry.resetAt) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + 86400000 });
    return true;
  }
  if (entry.count >= MAX_REQUESTS_PER_DAY) return false;
  entry.count++;
  return true;
}

function mimeToExt(mime) {
  if (!mime || typeof mime !== 'string') return 'webm';
  const m = mime.toLowerCase();
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a';
  if (m.includes('wav')) return 'wav';
  if (m.includes('mp3') || m.includes('mpeg')) return 'mp3';
  if (m.includes('ogg')) return 'ogg';
  return 'webm';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '오늘 음성 인식 횟수를 초과했어요. 내일 다시 시도해주세요.' });
  }

  try {
    const { audio, mime } = req.body || {};
    if (!audio || typeof audio !== 'string') {
      return res.status(400).json({ error: 'audio (base64) is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const audioBuffer = Buffer.from(audio, 'base64');
    if (audioBuffer.length === 0) return res.status(400).json({ error: 'empty audio' });
    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      return res.status(413).json({ error: '오디오가 너무 길어요. 1분 이내로 짧게 다시 시도해주세요.' });
    }

    const ext = mimeToExt(mime);
    const filename = `audio.${ext}`;
    const blob = new Blob([audioBuffer], { type: mime || 'audio/webm' });

    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('model', 'gpt-4o-transcribe');
    formData.append('language', 'ko');
    // 도메인 힌트 — 화장품 브랜드/성분명을 자주 듣는 맥락에서 정확도 ↑
    formData.append('prompt', '피부과학·스킨케어 상담 대화입니다. 화장품 브랜드명, 성분명(레티놀, 나이아신아마이드, 히알루론산, 세라마이드, 비타민C, BHA, AHA, 펩타이드 등), 피부 관련 용어(다크서클, 색소침착, 트러블, 모공, 탄력, 주름 등)를 정확하게 받아써주세요.');
    formData.append('response_format', 'json');

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });

    if (!r.ok) {
      const errBody = await r.text().catch(() => '');
      console.error('transcribe upstream error:', r.status, errBody.slice(0, 300));
      return res.status(502).json({ error: '음성 변환에 실패했어요. 잠시 후 다시 시도해주세요.' });
    }

    const data = await r.json();
    const text = (data.text || '').trim();
    if (!text) {
      return res.status(200).json({ text: '', warning: 'no speech detected' });
    }

    res.status(200).json({ text });
  } catch (error) {
    console.error('transcribe handler error:', error);
    res.status(500).json({ error: error.message || 'transcription failed' });
  }
}

// Vercel: 큰 audio payload 허용
export const config = {
  api: {
    bodyParser: { sizeLimit: '12mb' },
  },
};

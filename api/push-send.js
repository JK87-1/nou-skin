// 저녁 발송용 메시지 (마무리 톤)
const EVENING_MESSAGES = [
  '오늘 하루 수고 많으셨어요. 잠들기 전 피부 상태 한 번만 체크해볼까요?',
  '오늘의 피부를 기록하면 내일의 변화가 보여요. 30초만 함께해요.',
  '하루를 마무리하는 짧은 기록, 피부가 좋아하는 습관이에요.',
  '오늘 하루 피부는 어땠나요? 짧게라도 남겨두면 패턴이 보여요.',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getEveningMessage() {
  // 저녁 발송은 마무리 톤 메시지 풀 사용 (등급 무관)
  return { message: pick(EVENING_MESSAGES), grade: null };
}

export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const webpush = (await import('web-push')).default;
    const { Redis } = await import('@upstash/redis');

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:luaskin.co@gmail.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );

    // Vercel Hobby plan은 daily cron만 가능 — KST 21시(UTC 12시)에 1일 1회 호출됨.
    // 시간 매칭 없이 활성 구독에 일괄 발송하고 KST 기준 today 단위로 dedup.
    const now = new Date();
    const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = kstDate.toISOString().split('T')[0];

    const hashes = await redis.smembers('push:subs');
    if (!hashes || hashes.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No subscriptions' });
    }

    const testMode = req.query.test === '1';

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const staleHashes = [];
    const errors = [];

    // 활성 사용자 = morning/evening 슬롯 중 어느 하나라도 OFF가 아닌 사용자.
    // (둘 다 명시적으로 'false'일 때만 스킵)
    function isActive(sub) {
      return !(sub.morningEnabled === 'false' && sub.eveningEnabled === 'false');
    }

    for (const hash of hashes) {
      const sub = await redis.hgetall(`push:sub:${hash}`);
      if (!sub || !sub.endpoint) {
        staleHashes.push(hash);
        continue;
      }

      if (!isActive(sub)) { skipped++; continue; }
      if (!testMode && sub.lastSentDate === today) { skipped++; continue; }

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      const nickname = sub.nickname || '';
      const greeting = nickname ? `${nickname}님, ` : '';
      const { message } = getEveningMessage();

      const payload = JSON.stringify({
        title: '오늘의 피부 마무리',
        body: `${greeting}${message}`,
        url: '/?scan=1&notif=1',
        type: 'reminder',
      });

      try {
        await webpush.sendNotification(pushSubscription, payload);
        sent++;
        if (!testMode) {
          await redis.hset(`push:sub:${hash}`, { lastSentDate: today });
        }
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleHashes.push(hash);
        }
        failed++;
        errors.push({ hash, status: err.statusCode, message: err.body || err.message });
      }
    }

    // Clean up stale subscriptions
    for (const hash of staleHashes) {
      await redis.del(`push:sub:${hash}`);
      await redis.srem('push:subs', hash);
    }

    return res.status(200).json({
      sent,
      failed,
      skipped,
      cleaned: staleHashes.length,
      total: hashes.length,
      today,
      testMode,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('push-send error:', error);
    return res.status(500).json({ error: error.message });
  }
}

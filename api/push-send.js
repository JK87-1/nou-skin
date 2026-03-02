// 등급별 개인화 메시지
const GRADE_MESSAGES = {
  // S/A등급 (70+): 유지 동기부여
  high: [
    '어제 피부 컨디션이 정말 좋았어요! 오늘도 그 빛나는 피부 확인해볼까요?',
    '최근 컨디션이 훌륭해요! 오늘도 유지되고 있는지 체크해봐요.',
    '요즘 피부 관리 잘하고 계시네요! 오늘의 컨디션도 확인해보세요.',
    '좋은 컨디션을 유지하는 비결, 오늘도 기록해둘까요?',
  ],
  // B등급 (55-69): 개선 기대감
  mid: [
    '어제보다 컨디션이 올랐을지도! 지금 확인해보세요.',
    '하루 사이에도 피부는 달라져요. 오늘의 변화를 확인해볼까요?',
    '꾸준히 측정하면 피부가 좋아지는 걸 느낄 수 있어요!',
    '오늘은 어떤 변화가 있을까요? 30초면 확인할 수 있어요.',
  ],
  // C/D등급 (~54): 변화 기대감
  low: [
    '오늘은 피부 컨디션이 달라졌을 거예요. 확인해볼까요?',
    '피부도 회복력이 있어요! 오늘의 컨디션을 체크해보세요.',
    '좋은 습관이 피부를 바꿔요. 오늘의 상태를 기록해둘까요?',
    '매일 측정이 피부 개선의 첫 걸음이에요. 오늘도 함께해요!',
  ],
  // skinData 없을 때
  default: [
    '오늘 피부는 좀 어때요? 한번 체크해봐요!',
    '잠깐이면 돼요! 오늘 피부 상태 기록해둘까요?',
    '어제보다 좋아졌을지도? 지금 측정해보세요!',
    '피부도 매일 달라져요. 오늘의 변화를 확인해보세요!',
    '30초면 충분해요! 오늘 피부 컨디션을 기록해봐요.',
    '꾸준히 측정하는 당신, 피부가 좋아질 수밖에 없어요!',
  ],
};

function getGrade(score) {
  if (score >= 85) return { letter: 'S', label: '최상' };
  if (score >= 70) return { letter: 'A', label: '우수' };
  if (score >= 55) return { letter: 'B', label: '양호' };
  if (score >= 40) return { letter: 'C', label: '보통' };
  return { letter: 'D', label: '관리필요' };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getPersonalizedMessage(skinData) {
  if (!skinData) return { message: pick(GRADE_MESSAGES.default), grade: null };

  let parsed = skinData;
  if (typeof skinData === 'string') {
    try { parsed = JSON.parse(skinData); } catch { return { message: pick(GRADE_MESSAGES.default), grade: null }; }
  }

  const score = parsed.conditionScore ?? parsed.overallScore;
  if (typeof score !== 'number') return { message: pick(GRADE_MESSAGES.default), grade: null };

  const grade = getGrade(score);
  const pool = score >= 70 ? GRADE_MESSAGES.high
    : score >= 55 ? GRADE_MESSAGES.mid
    : GRADE_MESSAGES.low;

  return { message: pick(pool), grade, score };
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

    const now = new Date();
    const kstHour = (now.getUTCHours() + 9) % 24;
    const kstMinute = now.getUTCMinutes();
    const targetTime = `${String(kstHour).padStart(2, '0')}:${String(kstMinute).padStart(2, '0')}`;

    // KST today string for dedup
    const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = kstDate.toISOString().split('T')[0];

    const hashes = await redis.smembers('push:subs');
    if (!hashes || hashes.length === 0) {
      return res.status(200).json({ sent: 0, message: 'No subscriptions' });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const staleHashes = [];
    const errors = [];

    for (const hash of hashes) {
      const sub = await redis.hgetall(`push:sub:${hash}`);
      if (!sub || !sub.endpoint) {
        staleHashes.push(hash);
        continue;
      }

      // Skip in test mode; otherwise match exact HH:MM
      if (req.query.test !== '1') {
        const subTime = sub.reminderTime || '08:00';
        if (subTime !== targetTime) {
          skipped++;
          continue;
        }

        // Dedup: skip if already sent today
        if (sub.lastReminderDate === today) {
          skipped++;
          continue;
        }
      }

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      const nickname = sub.nickname || '';
      const greeting = nickname ? `${nickname}님, ` : '';

      // 컨디션 개인화 메시지
      const { message, grade, score } = getPersonalizedMessage(sub.skinData);
      const gradeTag = grade ? ` [${grade.letter}등급]` : '';

      const payload = JSON.stringify({
        title: `오늘의 피부 컨디션${gradeTag}`,
        body: `${greeting}${message}`,
        url: '/?scan=1',
      });

      try {
        await webpush.sendNotification(pushSubscription, payload);
        sent++;

        // Mark as sent today (dedup) — skip in test mode
        if (req.query.test !== '1') {
          await redis.hset(`push:sub:${hash}`, { lastReminderDate: today });
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
      targetTime,
      today,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('push-send error:', error);
    return res.status(500).json({ error: error.message });
  }
}

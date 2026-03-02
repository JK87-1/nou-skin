import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function hashEndpoint(endpoint) {
  let h = 0;
  for (let i = 0; i < endpoint.length; i++) {
    h = ((h << 5) - h + endpoint.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      const { subscription, reminderTime, nickname, tipEnabled, tipTime, skinData, skinType, skinConcerns, sensitivity } = req.body;
      if (!subscription?.endpoint || !subscription?.keys) {
        return res.status(400).json({ error: 'Invalid subscription' });
      }

      const hash = hashEndpoint(subscription.endpoint);

      const fields = {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        reminderTime: reminderTime || '08:00',
        nickname: nickname || '',
        createdAt: new Date().toISOString(),
      };

      if (tipEnabled !== undefined) fields.tipEnabled = String(tipEnabled);
      if (tipTime) fields.tipTime = tipTime;
      if (skinData) {
        fields.skinData = typeof skinData === 'string' ? skinData : JSON.stringify(skinData);
        fields.skinDataUpdatedAt = new Date().toISOString();
      }
      if (skinType) fields.skinType = skinType;
      if (skinConcerns) fields.skinConcerns = typeof skinConcerns === 'string' ? skinConcerns : JSON.stringify(skinConcerns);
      if (sensitivity) fields.sensitivity = sensitivity;

      await redis.hset(`push:sub:${hash}`, fields);
      await redis.sadd('push:subs', hash);

      return res.status(200).json({ ok: true, hash });
    }

    if (req.method === 'PUT') {
      const { endpoint, tipEnabled, tipTime, skinData, skinType, skinConcerns, sensitivity, reminderTime, nickname, goalMetrics } = req.body;
      if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });

      const hash = hashEndpoint(endpoint);
      const exists = await redis.sismember('push:subs', hash);
      if (!exists) return res.status(404).json({ error: 'Subscription not found' });

      const updates = {};
      if (tipEnabled !== undefined) updates.tipEnabled = String(tipEnabled);
      if (tipTime) updates.tipTime = tipTime;
      if (reminderTime) updates.reminderTime = reminderTime;
      if (nickname !== undefined) updates.nickname = nickname;
      if (skinData) {
        updates.skinData = typeof skinData === 'string' ? skinData : JSON.stringify(skinData);
        updates.skinDataUpdatedAt = new Date().toISOString();
      }
      if (skinType) updates.skinType = skinType;
      if (skinConcerns) updates.skinConcerns = typeof skinConcerns === 'string' ? skinConcerns : JSON.stringify(skinConcerns);
      if (sensitivity) updates.sensitivity = sensitivity;
      if (goalMetrics) {
        updates.goalMetrics = typeof goalMetrics === 'string' ? goalMetrics : JSON.stringify(goalMetrics);
      }

      if (Object.keys(updates).length > 0) {
        await redis.hset(`push:sub:${hash}`, updates);
      }

      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });

      const hash = hashEndpoint(endpoint);

      // Check if tip is still enabled — if so, only clear reminder fields
      const sub = await redis.hgetall(`push:sub:${hash}`);
      if (sub && sub.tipEnabled === 'true') {
        await redis.hset(`push:sub:${hash}`, { reminderTime: '' });
        return res.status(200).json({ ok: true, kept: true });
      }

      await redis.del(`push:sub:${hash}`);
      await redis.srem('push:subs', hash);

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('push-subscribe error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Vercel Serverless Function: 네이버 쇼핑 API로 제품 누끼 이미지 검색
// 개선: 다중 쿼리 전략 + 결과 스코어링으로 정확도 향상

function clean(s) {
  return (s || '').replace(/<[^>]*>/g, '').trim();
}

/** 검색 결과와 입력 브랜드/제품명의 유사도 스코어링 */
function scoreResult(item, brand, name) {
  let score = 0;
  const ib = clean(item.brand).toLowerCase();
  const it = clean(item.title).toLowerCase();
  const sb = (brand || '').toLowerCase().trim();
  const sn = (name || '').toLowerCase().trim();

  // 브랜드 매칭
  if (sb && ib) {
    if (ib === sb) score += 40;
    else if (ib.includes(sb) || sb.includes(ib)) score += 25;
    else {
      // 공통 부분문자열 3자 이상이면 부분 점수
      for (let len = Math.min(sb.length, ib.length); len >= 3; len--) {
        let found = false;
        for (let i = 0; i <= sb.length - len; i++) {
          if (ib.includes(sb.substring(i, i + len))) { found = true; break; }
        }
        if (found) { score += 10; break; }
      }
    }
  }

  // 제품명 매칭
  if (sn && it) {
    if (it.includes(sn)) score += 40;
    else {
      // 제품명의 앞 60% 이상 매칭
      const partial = sn.slice(0, Math.max(3, Math.ceil(sn.length * 0.6)));
      if (it.includes(partial)) score += 20;
    }
  }

  // 화장품/뷰티 카테고리 보너스
  const cat = (item.category1 || '').toLowerCase();
  if (cat.includes('화장품') || cat.includes('뷰티') || cat.includes('스킨케어')) score += 10;

  return score;
}

/** 네이버 쇼핑 검색 (5개 결과) */
async function searchShop(query, clientId, clientSecret) {
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=5&sort=sim`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).filter(i => i.image);
  } catch { return []; }
}

/** 결과 목록에서 가장 높은 스코어 아이템 선택 */
function pickBest(items, brand, name) {
  if (!items.length) return { item: null, score: -1 };
  let bestItem = items[0], bestScore = scoreResult(items[0], brand, name);
  for (let i = 1; i < items.length; i++) {
    const s = scoreResult(items[i], brand, name);
    if (s > bestScore) { bestScore = s; bestItem = items[i]; }
  }
  return { item: bestItem, score: bestScore };
}

/** 이미지 프록시 (CORS 우회) */
async function proxyImage(imageUrl) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const ct = res.headers.get('content-type') || 'image/jpeg';
    return `data:${ct};base64,${base64}`;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query, brand, name } = req.body || {};
  const b = (brand || '').trim();
  const n = (name || '').trim();
  const q = query || `${b} ${n}`.trim();
  if (!q) return res.status(400).json({ error: 'query required' });

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(200).json({ image: null });

  // 자동완성 등 빠른 경로(fast=true)는 base64 proxy 건너뛰고 URL만 반환.
  // 등록 후 영구 저장용(fast 미지정)은 base64로 안정 저장.
  const fast = !!req.body?.fast;

  try {
    // 첫 검색: 원본 쿼리 1번만 (시간 ↓). 매칭 약하면 추가 시도.
    const items1 = await searchShop(q, clientId, clientSecret);
    let { item: best, score: bestScore } = pickBest(items1, b, n);

    // 매칭 점수 약하면 1번 추가 검색 — 화장품 키워드
    if (bestScore < 30) {
      const items2 = await searchShop(`${q} 화장품`, clientId, clientSecret);
      const cand = pickBest(items2, b, n);
      if (cand.score > bestScore) { best = cand.item; bestScore = cand.score; }
    }

    if (!best) return res.status(200).json({ image: null });

    // 빠른 경로: URL 그대로 반환 (네이버 쇼핑 CDN은 직접 img 태그 로드 가능 + CORS 문제 거의 없음)
    if (fast) {
      return res.status(200).json({
        image: best.image,
        brand: clean(best.brand) || null,
        title: clean(best.title) || null,
      });
    }

    // 안정 경로: base64 proxy (등록 영구 저장용)
    const image = await proxyImage(best.image);
    if (!image) {
      // proxy 실패해도 URL은 반환 — 클라이언트가 자체 처리
      return res.status(200).json({
        image: best.image,
        brand: clean(best.brand) || null,
        title: clean(best.title) || null,
      });
    }
    return res.status(200).json({
      image,
      brand: clean(best.brand) || null,
      title: clean(best.title) || null,
    });
  } catch {
    return res.status(200).json({ image: null });
  }
}

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

  try {
    // 전략 1+2: 원본 쿼리 & "화장품" 키워드 추가 (병렬 실행)
    const [items1, items2] = await Promise.all([
      searchShop(q, clientId, clientSecret),
      searchShop(`${q} 화장품`, clientId, clientSecret),
    ]);

    let allItems = [...items1, ...items2];
    let { item: best, score: bestScore } = pickBest(allItems, b, n);

    // 전략 3: 제품명만으로 검색 (브랜드 인식 오류 대응)
    if (bestScore < 30 && n && n !== q) {
      const items3 = await searchShop(n, clientId, clientSecret);
      const { item: candidate, score: candScore } = pickBest(items3, b, n);
      if (candScore > bestScore) { best = candidate; bestScore = candScore; }
    }

    // 전략 4: 브랜드 + 카테고리 (제품명 인식 오류 대응)
    if (bestScore < 20 && b) {
      const items4 = await searchShop(`${b} 스킨케어`, clientId, clientSecret);
      const { item: candidate, score: candScore } = pickBest(items4, b, n);
      if (candScore > bestScore) { best = candidate; bestScore = candScore; }
    }

    if (!best) return res.status(200).json({ image: null });

    const image = await proxyImage(best.image);
    if (!image) return res.status(200).json({ image: null });

    return res.status(200).json({
      image,
      brand: clean(best.brand) || null,
      title: clean(best.title) || null,
    });
  } catch {
    return res.status(200).json({ image: null });
  }
}

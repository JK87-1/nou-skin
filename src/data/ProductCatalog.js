// 쿠팡 파트너스 제품 카탈로그
// [RECOMMEND:카테고리] 태그 기반 추천 시스템

export const CATEGORY_META = {
  '수분부족': { icon: '💧', label: '수분 부족', ingredient: '히알루론산 · 세라마이드', metricKey: 'moisture' },
  '유분과다': { icon: '🛡️', label: '유분 과다', ingredient: '나이아신아마이드 · 티트리', metricKey: 'oilBalance', inverse: true },
  '색소침착': { icon: '✨', label: '색소 침착', ingredient: '비타민C · 글루타치온', metricKey: 'pigmentationScore' },
  '주름탄력': { icon: '🔬', label: '주름 · 탄력', ingredient: '레티놀 · 펩타이드', metricKey: 'wrinkleScore' },
  '트러블': { icon: '🎯', label: '트러블 케어', ingredient: '시카 · 살리실산', metricKey: 'troubleCount', inverse: true },
  '다크서클': { icon: '👁️', label: '다크서클', ingredient: '비타민K · 카페인', metricKey: 'darkCircleScore' },
};

export const PRODUCTS = [
  {
    id: 1,
    name: '히알루로닉 수분 세럼',
    brand: '제이엠솔루션',
    volume: '30ml',
    tags: ['히알루론산', '세럼'],
    categories: ['수분부족'],
    link: 'https://link.coupang.com/a/dT6KMk',
  },
  {
    id: 2,
    name: '히알루론산 촉촉 앰플',
    brand: '토니모리',
    volume: '100ml',
    tags: ['히알루론산', '대용량'],
    categories: ['수분부족'],
    link: 'https://link.coupang.com/a/dUktkR',
  },
  {
    id: 3,
    name: '샤비크 빙하크림 3.0',
    brand: '씨퓨리',
    volume: '70ml',
    tags: ['수분진정', '쿨링'],
    categories: ['수분부족', '트러블'],
    link: 'https://link.coupang.com/a/dT6Y4w',
  },
  {
    id: 4,
    name: '데일리 모이스쳐 페이셜 로션',
    brand: '피지오겔',
    volume: '200ml',
    tags: ['저자극', '보습'],
    categories: ['수분부족'],
    link: 'https://link.coupang.com/a/dT62dn',
  },
  {
    id: 5,
    name: '하이드라 앰플 크림',
    brand: '나인위시스',
    volume: '50ml',
    tags: ['앰플크림', '보습'],
    categories: ['수분부족'],
    link: 'https://link.coupang.com/a/dT64wc',
  },
  {
    id: 6,
    name: '글루타치온 미백 세럼',
    brand: '바르헤',
    volume: '50ml',
    tags: ['글루타치온', '미백'],
    categories: ['색소침착'],
    link: 'https://link.coupang.com/a/dT65V0',
  },
  {
    id: 7,
    name: '프리즈셀 글로우 파워 세럼',
    brand: 'NAD',
    volume: '30ml',
    tags: ['광채', '미백'],
    categories: ['색소침착'],
    link: 'https://link.coupang.com/a/dT68FI',
  },
  {
    id: 8,
    name: '텐 레볼루션 리얼 아이크림 포 페이스',
    brand: 'AHC',
    volume: '35ml',
    tags: ['펩타이드', '아이크림'],
    categories: ['주름탄력'],
    link: 'https://link.coupang.com/a/dT7aij',
  },
  {
    id: 9,
    name: '화이트 트러플 리바이탈라이징 세럼',
    brand: '달바',
    volume: '30ml',
    tags: ['트러플', '탄력'],
    categories: ['색소침착', '주름탄력'],
    link: 'https://link.coupang.com/a/dT7hfQ',
  },
  {
    id: 10,
    name: '액티브 솔루션 4종 마스크 팩 세트',
    brand: '제이엠솔루션',
    volume: '4종',
    tags: ['마스크팩', '집중케어'],
    categories: ['수분부족', '트러블'],
    link: 'https://link.coupang.com/a/dT9fAu',
  },
  {
    id: 11,
    name: '이드랑스 에센스 인 로션',
    brand: '아벤느',
    volume: '200ml',
    tags: ['민감피부', '에센스로션'],
    categories: ['수분부족'],
    link: 'https://link.coupang.com/a/dT9hJj',
  },
  {
    id: 12,
    name: 'DMT UV 썬스크린 SPF50+',
    brand: '피지오겔',
    volume: '30ml',
    tags: ['자외선차단', '민감피부'],
    categories: ['색소침착'],
    link: 'https://link.coupang.com/a/dT9nrG',
  },
  {
    id: 13,
    name: '이드랑스 부스트 세럼',
    brand: '아벤느',
    volume: '30ml',
    tags: ['수분부스팅', '세럼'],
    categories: ['수분부족'],
    link: 'https://link.coupang.com/a/dT9jTn',
  },
  {
    id: 14,
    name: '이드랑스 리치 보습 크림',
    brand: '아벤느',
    volume: '40ml',
    tags: ['고보습', '리치크림'],
    categories: ['수분부족'],
    link: 'https://link.coupang.com/a/dT9lkH',
  },
  {
    id: 15,
    name: '나이아신아마이드 20% 세럼',
    brand: '더마팩토리',
    volume: '30ml',
    tags: ['나이아신아마이드', '고농도'],
    categories: ['색소침착', '유분과다'],
    link: 'https://link.coupang.com/a/dT9qqr',
  },
  {
    id: 16,
    name: '히알루론 1% 세럼',
    brand: '더마팩토리',
    volume: '80ml',
    tags: ['히알루론산', '대용량'],
    categories: ['수분부족'],
    link: 'https://link.coupang.com/a/dT9sCZ',
  },
  {
    id: 17,
    name: '아쿠아티카 썬스크린 SPF50+',
    brand: '셀퓨전씨',
    volume: '50ml',
    tags: ['자외선차단', '촉촉'],
    categories: ['색소침착'],
    link: 'https://link.coupang.com/a/dT9v8I',
  },
  {
    id: 18,
    name: '슈퍼 레티알엔 PDRN 앰플',
    brand: '바이탈포션',
    volume: '33g',
    tags: ['레티놀', 'PDRN'],
    categories: ['주름탄력'],
    link: 'https://link.coupang.com/a/dT9Ad9',
  },
  {
    id: 19,
    name: '어글로우 롤온 아이 세럼',
    brand: '멜라트',
    volume: '30ml',
    tags: ['레티놀', '아이크림'],
    categories: ['다크서클', '주름탄력'],
    link: 'https://link.coupang.com/a/dT9DmO',
  },
  {
    id: 20,
    name: '순수 비타민C 7.5% 앰플',
    brand: '라뮤셀',
    volume: '40ml',
    tags: ['비타민C', '미백'],
    categories: ['색소침착'],
    link: 'https://link.coupang.com/a/dT9Ime',
  },
];

/** Get products by recommendation category */
export function getProductsByCategory(category) {
  return PRODUCTS.filter(p => p.categories.includes(category));
}

/** Get the best matching category for a skin result */
export function getWeakestCategories(result) {
  if (!result) return [];
  const scores = [
    { cat: '수분부족', score: result.moisture ?? 100 },
    { cat: '유분과다', score: result.oilBalance > 65 ? 100 - result.oilBalance : 100 },
    { cat: '색소침착', score: result.pigmentationScore ?? 100 },
    { cat: '주름탄력', score: Math.min(result.wrinkleScore ?? 100, result.elasticityScore ?? 100) },
    { cat: '트러블', score: result.troubleCount > 3 ? 100 - result.troubleCount * 8 : 100 },
    { cat: '다크서클', score: result.darkCircleScore ?? 100 },
  ];
  return scores
    .filter(s => s.score < 65)
    .sort((a, b) => a.score - b.score)
    .map(s => s.cat);
}

/** Calculate match score for a product given a skin metric value */
export function calcMatchScore(metricValue, inverse = false) {
  const val = inverse ? 100 - metricValue : metricValue;
  const raw = Math.round(100 - val * 0.3);
  return Math.min(98, Math.max(75, raw));
}

/**
 * NOU Skincare Data v1.0 — 성분 DB, 메트릭 매핑, 충돌 규칙, 루틴 템플릿
 */

// ── 성분 DB (17종) ──
export const INGREDIENTS = [
  {
    id: 'hyaluronicAcid', nameKo: '히알루론산', category: '보습',
    targetMetrics: ['moisture', 'texture'], skinTypes: ['all'],
    period: 'both', conflictsWith: [], concentration: '1~2%',
    descKo: '수분을 자기 무게의 1000배까지 끌어당기는 강력한 보습 성분. 피부 장벽을 강화하고 잔주름을 일시적으로 개선합니다.',
    priority: 8,
  },
  {
    id: 'niacinamide', nameKo: '나이아신아마이드', category: '브라이트닝',
    targetMetrics: ['skinTone', 'pores', 'oilBalance', 'pigmentation'], skinTypes: ['all'],
    period: 'both', conflictsWith: ['vitaminC'], concentration: '4~5%',
    descKo: '피부 장벽 강화, 모공 축소, 피지 조절, 미백까지 다기능 성분. 대부분의 피부 타입에 안전합니다.',
    priority: 9,
  },
  {
    id: 'retinol', nameKo: '레티놀', category: '안티에이징',
    targetMetrics: ['wrinkles', 'elasticity', 'texture', 'pores'], skinTypes: ['normal', 'oily', 'combination'],
    period: 'pm', conflictsWith: ['aha', 'bha', 'vitaminC'], concentration: '0.025~0.1%',
    descKo: '비타민A 유도체로 콜라겐 생성을 촉진하고 세포 턴오버를 가속합니다. 야간에만 사용하고 반드시 선크림과 병행하세요.',
    priority: 10,
  },
  {
    id: 'vitaminC', nameKo: '비타민C (아스코르브산)', category: '항산화',
    targetMetrics: ['skinTone', 'pigmentation', 'wrinkles'], skinTypes: ['all'],
    period: 'am', conflictsWith: ['niacinamide', 'retinol'], concentration: '10~20%',
    descKo: '강력한 항산화제로 멜라닌 생성을 억제하고 콜라겐 합성을 촉진합니다. 자외선 방어력을 높여주는 아침 필수 성분.',
    priority: 9,
  },
  {
    id: 'aha', nameKo: 'AHA (글리콜산)', category: '각질케어',
    targetMetrics: ['texture', 'skinTone', 'pigmentation'], skinTypes: ['normal', 'dry', 'combination'],
    period: 'pm', conflictsWith: ['retinol', 'bha'], concentration: '5~10%',
    descKo: '수용성 각질 제거 성분. 피부 표면의 죽은 세포를 녹여 매끈한 피부결과 밝은 톤을 만들어줍니다.',
    priority: 7,
  },
  {
    id: 'bha', nameKo: 'BHA (살리실산)', category: '각질케어',
    targetMetrics: ['pores', 'trouble', 'oilBalance'], skinTypes: ['oily', 'combination'],
    period: 'pm', conflictsWith: ['retinol', 'aha'], concentration: '1~2%',
    descKo: '지용성 각질 제거 성분. 모공 속까지 침투하여 피지와 각질을 제거합니다. 여드름 피부에 특히 효과적.',
    priority: 8,
  },
  {
    id: 'peptide', nameKo: '펩타이드', category: '안티에이징',
    targetMetrics: ['wrinkles', 'elasticity'], skinTypes: ['all'],
    period: 'both', conflictsWith: [], concentration: '다양',
    descKo: '아미노산 사슬로 콜라겐·엘라스틴 생성 신호를 보냅니다. 레티놀보다 순하면서 탄력 개선 효과가 있습니다.',
    priority: 7,
  },
  {
    id: 'ceramide', nameKo: '세라마이드', category: '보습',
    targetMetrics: ['moisture', 'texture'], skinTypes: ['all'],
    period: 'both', conflictsWith: [], concentration: '0.5~1%',
    descKo: '피부 장벽의 핵심 구성 성분. 각질세포 사이 시멘트 역할로 수분 증발을 막고 외부 자극으로부터 보호합니다.',
    priority: 7,
  },
  {
    id: 'cica', nameKo: '시카 (센텔라)', category: '진정',
    targetMetrics: ['trouble', 'texture'], skinTypes: ['all'],
    period: 'both', conflictsWith: [], concentration: '다양',
    descKo: '센텔라 아시아티카 추출물. 항염·재생 효과로 트러블과 피부 자극을 진정시킵니다. 민감성 피부에도 안전.',
    priority: 6,
  },
  {
    id: 'arbutin', nameKo: '알부틴', category: '브라이트닝',
    targetMetrics: ['pigmentation', 'skinTone'], skinTypes: ['all'],
    period: 'both', conflictsWith: [], concentration: '2~4%',
    descKo: '티로시나아제를 억제하여 멜라닌 생성을 줄입니다. 하이드로퀴논보다 순한 미백 성분으로 장기 사용에 적합.',
    priority: 6,
  },
  {
    id: 'tranexamicAcid', nameKo: '트라넥삼산', category: '브라이트닝',
    targetMetrics: ['pigmentation', 'skinTone'], skinTypes: ['all'],
    period: 'both', conflictsWith: [], concentration: '2~3%',
    descKo: '멜라닌 전달을 차단하여 기미·색소침착을 개선합니다. 자외선에 안정적이라 아침에도 사용 가능.',
    priority: 6,
  },
  {
    id: 'squalane', nameKo: '스쿠알란', category: '보습',
    targetMetrics: ['moisture'], skinTypes: ['dry', 'normal'],
    period: 'pm', conflictsWith: [], concentration: '순수',
    descKo: '피부 피지와 유사한 구조로 빠르게 흡수됩니다. 수분 증발을 막는 밀봉(occlusive) 효과가 뛰어납니다.',
    priority: 5,
  },
  {
    id: 'caffeine', nameKo: '카페인', category: '아이케어',
    targetMetrics: ['darkCircles'], skinTypes: ['all'],
    period: 'am', conflictsWith: [], concentration: '1~5%',
    descKo: '혈관 수축 효과로 눈 밑 붓기와 다크서클을 개선합니다. 항산화 작용도 겸합니다.',
    priority: 6,
  },
  {
    id: 'vitaminK', nameKo: '비타민K', category: '아이케어',
    targetMetrics: ['darkCircles'], skinTypes: ['all'],
    period: 'pm', conflictsWith: [], concentration: '1%',
    descKo: '혈액 응고 인자를 조절하여 눈 밑 혈관 울혈을 개선합니다. 혈관형 다크서클에 특히 효과적.',
    priority: 5,
  },
  {
    id: 'sunscreen', nameKo: '자외선차단제', category: '선케어',
    targetMetrics: ['pigmentation', 'wrinkles', 'skinTone', 'elasticity'], skinTypes: ['all'],
    period: 'am', conflictsWith: [], concentration: 'SPF50+ PA++++',
    descKo: '피부 노화의 80%는 자외선이 원인. 모든 스킨케어의 마지막 단계이자 가장 중요한 안티에이징 성분.',
    priority: 10,
  },
  {
    id: 'teaTree', nameKo: '티트리', category: '트러블케어',
    targetMetrics: ['trouble'], skinTypes: ['oily', 'combination'],
    period: 'pm', conflictsWith: [], concentration: '1~2%',
    descKo: '천연 항균·항염 성분. 여드름 유발 박테리아를 억제하고 염증을 줄여줍니다.',
    priority: 5,
  },
  {
    id: 'clay', nameKo: '클레이 (카올린)', category: '모공케어',
    targetMetrics: ['pores', 'oilBalance'], skinTypes: ['oily', 'combination'],
    period: 'pm', conflictsWith: [], concentration: '주 1~2회 마스크',
    descKo: '미세 입자가 모공 속 피지와 노폐물을 흡착하여 제거합니다. 주 1~2회 마스크 팩 형태로 사용.',
    priority: 4,
  },
];

// ── 메트릭 → 성분 매핑 ──
export const METRIC_INGREDIENTS = {
  moisture:       { threshold: 55, ingredients: ['hyaluronicAcid', 'ceramide', 'squalane'] },
  skinTone:       { threshold: 60, ingredients: ['vitaminC', 'niacinamide', 'arbutin', 'tranexamicAcid'] },
  trouble:        { threshold: 55, ingredients: ['bha', 'cica', 'teaTree', 'niacinamide'] },
  oilBalanceHigh: { threshold: 65, ingredients: ['bha', 'niacinamide', 'clay'] },        // >65 = 유분과다
  oilBalanceLow:  { threshold: 35, ingredients: ['ceramide', 'squalane', 'hyaluronicAcid'] }, // <35 = 건조
  wrinkles:       { threshold: 60, ingredients: ['retinol', 'peptide', 'vitaminC', 'sunscreen'] },
  pores:          { threshold: 60, ingredients: ['niacinamide', 'bha', 'clay', 'retinol'] },
  elasticity:     { threshold: 60, ingredients: ['retinol', 'peptide', 'vitaminC', 'sunscreen'] },
  pigmentation:   { threshold: 60, ingredients: ['vitaminC', 'arbutin', 'tranexamicAcid', 'niacinamide', 'sunscreen'] },
  texture:        { threshold: 55, ingredients: ['aha', 'retinol', 'hyaluronicAcid', 'ceramide'] },
  darkCircles:    { threshold: 55, ingredients: ['caffeine', 'vitaminK', 'peptide'] },
};

// ── 충돌 규칙 ──
export const CONFLICTS = [
  {
    pair: ['retinol', 'aha'],
    resolution: 'alternate', // 교대 사용 (다른 날)
    noteKo: '레티놀과 AHA는 같은 날 사용 시 자극이 심합니다. 교대로 사용하세요.',
  },
  {
    pair: ['retinol', 'bha'],
    resolution: 'alternate',
    noteKo: '레티놀과 BHA는 같은 날 사용 시 자극이 심합니다. 교대로 사용하세요.',
  },
  {
    pair: ['retinol', 'vitaminC'],
    resolution: 'split', // AM/PM 분리
    noteKo: '비타민C는 아침에, 레티놀은 저녁에 사용하세요. pH 차이로 효과가 감소할 수 있습니다.',
  },
  {
    pair: ['aha', 'bha'],
    resolution: 'pick_one', // 하나만 선택
    noteKo: 'AHA와 BHA를 동시에 사용하면 과도한 각질 제거로 피부 장벽이 손상됩니다. 하나만 선택하세요.',
  },
  {
    pair: ['vitaminC', 'niacinamide'],
    resolution: 'split',
    noteKo: '비타민C는 아침에, 나이아신아마이드는 저녁에 분리 사용이 안정적입니다.',
  },
];

// ── 스텝별 맞춤 성분 매핑 (피부타입 + 관심사 기반) ──
export const STEP_INGREDIENTS = {
  '클렌저': {
    base: {
      dry: ['ceramide', 'hyaluronicAcid'],
      oily: ['bha', 'teaTree'],
      combination: ['niacinamide', 'cica'],
      sensitive: ['cica', 'ceramide'],
      normal: ['niacinamide'],
    },
    concernBoost: {
      trouble: ['teaTree', 'cica'],
      moisture: ['hyaluronicAcid', 'ceramide'],
    },
  },
  '토너': {
    base: {
      dry: ['hyaluronicAcid', 'ceramide'],
      oily: ['niacinamide', 'bha'],
      combination: ['niacinamide', 'hyaluronicAcid'],
      sensitive: ['cica', 'hyaluronicAcid'],
      normal: ['hyaluronicAcid', 'niacinamide'],
    },
    concernBoost: {
      skinTone: ['niacinamide', 'tranexamicAcid'],
      pigmentation: ['arbutin', 'tranexamicAcid'],
      moisture: ['hyaluronicAcid', 'ceramide'],
      pores: ['niacinamide', 'bha'],
    },
  },
  '보습': {
    base: {
      dry: ['ceramide', 'squalane', 'hyaluronicAcid'],
      oily: ['niacinamide', 'hyaluronicAcid'],
      combination: ['ceramide', 'niacinamide'],
      sensitive: ['cica', 'ceramide'],
      normal: ['ceramide', 'hyaluronicAcid'],
    },
    concernBoost: {
      wrinkles: ['peptide', 'retinol'],
      elasticity: ['peptide'],
      moisture: ['ceramide', 'squalane'],
      texture: ['ceramide', 'hyaluronicAcid'],
    },
  },
  '선크림': {
    base: {
      dry: ['hyaluronicAcid'],
      oily: ['niacinamide'],
      combination: ['niacinamide'],
      sensitive: ['cica'],
      normal: [],
    },
    concernBoost: {
      pigmentation: ['niacinamide'],
      skinTone: ['niacinamide'],
    },
  },
  '메이크업 리무버': {
    base: {
      dry: ['squalane'],
      oily: [],
      combination: [],
      sensitive: ['cica'],
      normal: [],
    },
    concernBoost: {},
  },
  '페이셜 오일': {
    base: {
      dry: ['squalane'],
      normal: ['squalane'],
    },
    concernBoost: {
      wrinkles: ['retinol'],
      moisture: ['squalane'],
    },
  },
};

// ── 루틴 템플릿 ──
export const ROUTINE_TEMPLATE = {
  am: [
    {
      step: 1, nameKo: '클렌저', icon: '🫧', type: 'fixed',
      formBySkinType: { dry: '크림 클렌저', oily: '젤 클렌저', combination: '약산성 폼', normal: '약산성 폼', sensitive: '마이셀라 워터' },
      descKo: '밤 사이 분비된 피지와 노폐물을 부드럽게 제거합니다.',
    },
    {
      step: 2, nameKo: '토너', icon: '💧', type: 'fixed',
      formBySkinType: { dry: '보습 토너', oily: '수분 토너', combination: '밸런싱 토너', normal: '수분 토너', sensitive: '진정 토너' },
      descKo: 'pH 밸런스를 맞추고 다음 단계 흡수를 높여줍니다.',
    },
    {
      step: 3, nameKo: '세럼', icon: '✨', type: 'dynamic',
      descKo: '고농축 활성 성분이 피부 깊이 침투합니다.',
    },
    {
      step: 4, nameKo: '아이크림', icon: '👁️', type: 'conditional', condition: 'darkCircles',
      formBySkinType: { dry: '리치 아이크림', oily: '아이 세럼', combination: '아이 젤크림', normal: '아이크림', sensitive: '저자극 아이크림' },
      descKo: '눈가의 얇은 피부를 위한 전용 케어.',
    },
    {
      step: 5, nameKo: '보습', icon: '🧴', type: 'fixed',
      formBySkinType: { dry: '리치 크림', oily: '수분 젤', combination: '수분 로션', normal: '로션', sensitive: '시카 크림' },
      descKo: '수분을 가두고 피부 장벽을 보호합니다.',
    },
    {
      step: 6, nameKo: '선크림', icon: '☀️', type: 'fixed',
      formBySkinType: { dry: '톤업 선크림', oily: '선 세럼/선 젤', combination: '수분 선크림', normal: '데일리 선크림', sensitive: '물리 자외선차단' },
      descKo: 'SPF50+ PA++++ — 모든 스킨케어의 마침표. 실내에서도 필수.',
    },
  ],
  pm: [
    {
      step: 1, nameKo: '메이크업 리무버', icon: '🧹', type: 'fixed',
      formBySkinType: { dry: '클렌징 밤', oily: '클렌징 오일', combination: '클렌징 밀크', normal: '클렌징 밤', sensitive: '마이셀라 워터' },
      descKo: '메이크업과 자외선차단제를 1차로 녹여냅니다.',
    },
    {
      step: 2, nameKo: '클렌저', icon: '🫧', type: 'fixed',
      formBySkinType: { dry: '크림 클렌저', oily: '젤 클렌저', combination: '약산성 폼', normal: '약산성 폼', sensitive: '저자극 폼' },
      descKo: '2차 세안으로 잔여물을 깨끗이 제거합니다.',
    },
    {
      step: 3, nameKo: '각질케어', icon: '🧪', type: 'conditional', condition: 'exfoliation',
      descKo: '주 2~3회. 각질을 제거하여 다음 단계 흡수를 높입니다.',
    },
    {
      step: 4, nameKo: '토너', icon: '💧', type: 'fixed',
      formBySkinType: { dry: '보습 토너', oily: '수분 토너', combination: '밸런싱 토너', normal: '수분 토너', sensitive: '진정 토너' },
      descKo: 'pH 밸런스를 맞추고 다음 단계 흡수를 높여줍니다.',
    },
    {
      step: 5, nameKo: '세럼', icon: '✨', type: 'dynamic',
      descKo: '고농축 활성 성분이 피부 깊이 침투합니다.',
    },
    {
      step: 6, nameKo: '아이크림', icon: '👁️', type: 'conditional', condition: 'darkCircles',
      formBySkinType: { dry: '리치 아이크림', oily: '아이 세럼', combination: '아이 젤크림', normal: '아이크림', sensitive: '저자극 아이크림' },
      descKo: '눈가의 얇은 피부를 위한 전용 케어.',
    },
    {
      step: 7, nameKo: '보습', icon: '🧴', type: 'fixed',
      formBySkinType: { dry: '리치 나이트크림', oily: '수분 젤', combination: '수분 로션', normal: '나이트크림', sensitive: '시카 크림' },
      descKo: '수분을 가두고 밤새 피부 재생을 돕습니다.',
    },
    {
      step: 8, nameKo: '페이셜 오일', icon: '🫒', type: 'conditional', condition: 'dryness',
      formBySkinType: { dry: '로즈힙 오일', normal: '호호바 오일' },
      descKo: '건성 피부 전용. 수분 증발을 차단하는 마지막 밀봉 단계.',
    },
  ],
};

// ── 주간 플랜 ──
export const WEEKLY_PLAN = [
  { day: '월', nameKo: '기본 루틴', icon: '🌿', descKo: '기본 모닝/이브닝 루틴만 수행', type: 'basic' },
  { day: '화', nameKo: '레티놀 데이', icon: '⚡', descKo: '저녁에 레티놀 세럼 적용', type: 'retinol' },
  { day: '수', nameKo: '회복일', icon: '💧', descKo: '보습 집중. 활성 성분 휴식', type: 'recovery' },
  { day: '목', nameKo: '각질케어 데이', icon: '✨', descKo: '저녁에 AHA/BHA 적용', type: 'exfoliation' },
  { day: '금', nameKo: '레티놀 데이', icon: '⚡', descKo: '저녁에 레티놀 세럼 적용', type: 'retinol' },
  { day: '토', nameKo: '회복일', icon: '💧', descKo: '보습 집중. 활성 성분 휴식', type: 'recovery' },
  { day: '일', nameKo: '스페셜 케어', icon: '🧖', descKo: '시트 마스크 + 페이셜 마사지', type: 'special' },
];

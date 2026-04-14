const PROFILE_KEY = 'nou_profile';

const DEFAULTS = {
  nickname: '',
  profileImage: '',
  birthYear: '',
  gender: '',
  targetWeight: '',
  skinType: '',
  skinConcerns: [],
  sensitivity: '',
  reminderEnabled: false,
  reminderTime: '08:00',
  tipEnabled: false,
  tipTime: '20:00',
  selectedTitleLevel: null,
  activeTheme: null,
  colorMode: 'light',
  categories: [
    { key: 'food',      label: '식단',     color: '#FFD070', enabled: true,  group: 'cause' },
    { key: 'water',     label: '수분',     color: '#7BC8F0', enabled: false, group: 'cause' },
    { key: 'sleep',     label: '수면',     color: '#C8A0E0', enabled: false, group: 'cause' },
    { key: 'walk',      label: '산책',     color: '#A8D8A8', enabled: false, group: 'cause' },
    { key: 'exercise',  label: '운동',     color: '#90CCE8', enabled: false, group: 'cause' },
    { key: 'energy',    label: '에너지',   color: '#F0C878', enabled: false, group: 'result' },
    { key: 'body',      label: '몸무게',   color: '#D0D0D0', enabled: true,  group: 'result' },
    { key: 'face',      label: '얼굴',     color: '#80D0A8', enabled: false, group: 'result' },
    { key: 'skin',      label: '피부',     color: '#F8A8C0', enabled: false, group: 'result' },
    { key: 'bodyshape', label: '바디',     color: '#F0A8A8', enabled: false, group: 'result' },
  ],
};

export function getProfile() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveProfile(data) {
  const current = getProfile();
  const merged = { ...current, ...data };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
  return merged;
}

export function getDeviceId() {
  let id = localStorage.getItem('nou_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('nou_device_id', id);
  }
  return id;
}

export function getCategories() {
  const profile = getProfile();
  const saved = profile.categories || [];
  const defaultMap = Object.fromEntries(DEFAULTS.categories.map(c => [c.key, c]));
  // 1) 저장된 카테고리는 순서·활성·컬러 유지, 라벨은 기본 카테고리만 최신화
  const migrated = saved.map(c => {
    const def = defaultMap[c.key];
    return {
      ...c,
      label: def ? def.label : c.label,
      color: c.color || (def ? def.color : '#D0D0D0'),
      group: c.group || (def ? def.group : 'cause'),
    };
  });
  // 2) 저장본에 없는 신규 기본 카테고리는 뒤에 추가
  const savedKeys = new Set(migrated.map(c => c.key));
  DEFAULTS.categories.forEach(d => {
    if (!savedKeys.has(d.key)) migrated.push({ ...d });
  });
  // 3) 구형 'shape' 카테고리 제거
  const filtered = migrated.filter(c => c.key !== 'shape');
  // 4) 최소 1개는 활성화
  if (!filtered.some(c => c.enabled)) filtered[0].enabled = true;
  return filtered;
}

export function getCategoryColor(categoryKey) {
  const cats = getCategories();
  return cats.find(c => c.key === categoryKey)?.color || '#D0D0D0';
}

export function getEnabledCategories() {
  return getCategories().filter(c => c.enabled);
}

export function saveCategories(categories) {
  saveProfile({ categories });
  // 다른 마운트된 페이지에도 변경 알림 (탭 전환 없이 즉시 반영)
  try { window.dispatchEvent(new CustomEvent('lua:categories-changed')); } catch {}
}

export const SKIN_TYPES = ['건성', '지성', '복합성', '중성', '민감성'];
export const SKIN_CONCERNS = ['주름', '모공', '색소침착', '다크서클', '트러블', '건조', '유분과다', '탄력저하', '피부결'];
export const SENSITIVITY_OPTIONS = ['민감', '보통', '강함'];
export const GENDER_OPTIONS = ['여성', '남성', '기타'];

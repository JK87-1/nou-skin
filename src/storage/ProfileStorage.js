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
    { key: 'face', label: '얼굴', enabled: false },
    { key: 'skin', label: '피부', enabled: true },
    { key: 'food', label: '식단', enabled: true },
    { key: 'shape', label: '바디', enabled: false },
    { key: 'body', label: '몸무게', enabled: true },
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
  const labelMap = Object.fromEntries(DEFAULTS.categories.map(c => [c.key, c.label]));
  // 1) 저장된 카테고리는 순서·활성 상태 유지하며 라벨만 최신화
  const migrated = saved
    .filter(c => labelMap[c.key])
    .map(c => ({ ...c, label: labelMap[c.key] }));
  // 2) 저장본에 없는 신규 카테고리는 디폴트 상태로 뒤에 추가
  const savedKeys = new Set(migrated.map(c => c.key));
  DEFAULTS.categories.forEach(d => {
    if (!savedKeys.has(d.key)) migrated.push({ ...d });
  });
  // 3) 최소 1개는 활성화
  if (!migrated.some(c => c.enabled)) migrated[0].enabled = true;
  return migrated;
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

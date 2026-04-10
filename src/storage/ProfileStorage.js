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
    { key: 'skin', label: '피부', enabled: true },
    { key: 'food', label: '식단', enabled: true },
    { key: 'body', label: '바디', enabled: true },
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
  const cats = profile.categories || DEFAULTS.categories;
  // 최소 1개는 활성화
  const enabled = cats.filter(c => c.enabled);
  if (enabled.length === 0) cats[0].enabled = true;
  return cats;
}

export function getEnabledCategories() {
  return getCategories().filter(c => c.enabled);
}

export function saveCategories(categories) {
  saveProfile({ categories });
}

export const SKIN_TYPES = ['건성', '지성', '복합성', '중성', '민감성'];
export const SKIN_CONCERNS = ['주름', '모공', '색소침착', '다크서클', '트러블', '건조', '유분과다', '탄력저하', '피부결'];
export const SENSITIVITY_OPTIONS = ['민감', '보통', '강함'];
export const GENDER_OPTIONS = ['여성', '남성', '기타'];

const PROFILE_KEY = 'nou_profile';

const DEFAULTS = {
  nickname: '',
  profileImage: '',
  birthYear: '',
  gender: '',
  skinType: '',
  skinConcerns: [],
  sensitivity: '',
  reminderEnabled: false,
  reminderTime: '08:00',
  tipEnabled: false,
  tipTime: '20:00',
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

export const SKIN_TYPES = ['건성', '지성', '복합성', '중성', '민감성'];
export const SKIN_CONCERNS = ['주름', '모공', '색소침착', '다크서클', '트러블', '건조', '유분과다', '탄력저하', '피부결'];
export const SENSITIVITY_OPTIONS = ['민감', '보통', '강함'];
export const GENDER_OPTIONS = ['여성', '남성', '기타'];

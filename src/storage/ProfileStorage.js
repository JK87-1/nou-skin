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
  dietGoal: 'balance',
  categories: [
    { key: 'food',       label: '식단',     color: '#F5E6A3', enabled: true,  group: 'cause',
      subs: [{ key: 'meal', label: '식사', enabled: true }, { key: 'water', label: '수분', enabled: true }] },
    { key: 'activity',   label: '활동',     color: '#B8E0C8', enabled: true,  group: 'cause',
      subs: [{ key: 'steps', label: '걸음수', enabled: true }, { key: 'exercise', label: '운동', enabled: true }] },
    { key: 'supplement', label: '관리',     color: '#A8CFF0', enabled: true,  group: 'cause',
      subs: [{ key: 'supplement_pill', label: '영양제', enabled: true }, { key: 'skincare', label: '스킨케어', enabled: true }] },
    { key: 'sleep',      label: '휴식',     color: '#9AAFD4', enabled: true,  group: 'cause',
      subs: [{ key: 'meditation', label: '명상', enabled: true }, { key: 'sleep_log', label: '수면', enabled: true }] },
    { key: 'energy',     label: '에너지',   color: '#F5C870', enabled: true,  group: 'result',
      subs: [{ key: 'vitality', label: '활력', enabled: true }, { key: 'focus', label: '집중력', enabled: true }] },
    { key: 'mood',       label: '기분',     color: '#F0A070', enabled: true,  group: 'result',
      subs: [{ key: 'emotion', label: '감정', enabled: true }, { key: 'stress', label: '스트레스', enabled: true }] },
    { key: 'body',       label: '바디',     color: '#F09888', enabled: true,  group: 'result',
      subs: [{ key: 'weight', label: '몸무게', enabled: true }, { key: 'inbody', label: '인바디·눈바디', enabled: true }, { key: 'blood_sugar', label: '혈당', enabled: true }] },
    { key: 'skin',       label: '피부',     color: '#D8A0E0', enabled: true,  group: 'result',
      subs: [{ key: 'face', label: '얼굴', enabled: true }, { key: 'skin_condition', label: '피부상태', enabled: true }] },
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
  // 삭제된 카테고리 목록
  const REMOVED = ['shape', 'meditation', 'walk', 'exercise', 'water', 'face', 'bodyshape'];
  // 1) 저장된 카테고리는 순서·활성 유지, 라벨·컬러·그룹·subs는 기본값으로 최신화
  const migrated = saved
    .filter(c => !REMOVED.includes(c.key))
    .map(c => {
      const def = defaultMap[c.key];
      if (!def) return c;
      // subs 마이그레이션: 저장된 subs의 enabled 상태 유지, 새 sub 추가
      const savedSubMap = Object.fromEntries((c.subs || []).map(s => [s.key, s]));
      const subs = (def.subs || []).map(ds => ({
        ...ds,
        enabled: savedSubMap[ds.key]?.enabled ?? ds.enabled,
      }));
      return { ...c, label: def.label, color: c.color || def.color, group: def.group, subs };
    });
  // 2) 저장본에 없는 신규 기본 카테고리는 뒤에 추가
  const savedKeys = new Set(migrated.map(c => c.key));
  DEFAULTS.categories.forEach(d => {
    if (!savedKeys.has(d.key)) migrated.push({ ...d });
  });
  const filtered = migrated;
  // 4) 최소 1개는 활성화
  if (!filtered.some(c => c.enabled)) filtered[0].enabled = true;
  return filtered;
}

export function getCategoryColor(categoryKey) {
  const cats = getCategories();
  return cats.find(c => c.key === categoryKey)?.color || '#D0D0D0';
}

export function getEnabledCategories(group) {
  const cats = getCategories().filter(c => c.enabled);
  if (group) return cats.filter(c => c.group === group);
  return cats;
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

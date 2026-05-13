/**
 * 카테고리별 가이드 콘텐츠 데이터
 */

export const GUIDE_DATA = {
  water: {
    category: 'water',
    icon: 'ti-droplet',
    title: '수분 가이드',
    color: '#378ADD',
    btnBg: 'rgba(55, 138, 221, 0.08)',
    btnColor: '#185FA5',
    intro: '매일 마시는 양보다 **언제, 어떻게** 마시는지가 더 중요해요',
    principles: [
      { number: '01', title: '기상 직후 한 잔', desc: '밤새 부족한 수분을 채워줘요' },
      { number: '02', title: '식사 앞뒤 30분은 비우기', desc: '위가 음식을 분해할 시간을 줘요' },
      { number: '03', title: '갈증 느끼기 전에 마시기', desc: '갈증은 이미 부족하다는 신호예요' },
      { number: '04', title: '취침 2시간 전 마무리', desc: '새벽 화장실로 수면이 깨지지 않게' },
      { number: '05', title: '카페인 마시면 물도 함께', desc: '이뇨 작용을 보완해줘요' },
    ],
  },
  caffeine: {
    category: 'caffeine',
    icon: 'ti-coffee',
    title: '카페인 가이드',
    color: '#BA7517',
    btnBg: 'rgba(186, 117, 23, 0.08)',
    btnColor: '#854F0B',
    intro: '양보다 **시간**이 컨디션을 좌우해요',
    principles: [
      { number: '01', title: '기상 후 1시간은 기다리기', desc: '코르티솔이 자연스럽게 올라가는 시간' },
      { number: '02', title: '오후 2시 이후 자제하기', desc: '카페인 반감기는 5-6시간이에요' },
      { number: '03', title: '빈속 카페인은 피하기', desc: '위벽을 자극할 수 있어요' },
      { number: '04', title: '하루 200mg 이하 권장', desc: '컨디션과 수면에 영향을 줘요' },
      { number: '05', title: '마시면 물도 함께', desc: '이뇨 작용을 보완해주세요' },
    ],
    summary: { label: '권장 한도', mainValue: '200mg / 일', subInfo: '커피 2잔 이하' },
  },
  meal: {
    category: 'meal',
    icon: 'ti-apple',
    title: '식사 가이드',
    color: '#639922',
    btnBg: 'rgba(99, 153, 34, 0.08)',
    btnColor: '#3B6D11',
    intro: '무엇을 먹는지보다 **언제 어떻게** 먹는지가 더 중요해요',
    principles: [
      { number: '01', title: '같은 시간에 먹기', desc: '몸의 리듬이 안정돼요' },
      { number: '02', title: '첫 끼는 가볍게', desc: '위가 천천히 깨어나는 시간이에요' },
      { number: '03', title: '잠 3시간 전엔 마무리', desc: '소화가 끝난 채로 자야 깊게 잠들어요' },
      { number: '04', title: '천천히 꼭꼭 씹기', desc: '포만감 신호는 20분 후 도착해요' },
      { number: '05', title: '한 끼 안에 단백질·채소·탄수화물', desc: '균형이 컨디션을 만들어요' },
    ],
    summary: { label: '권장 간격', mainValue: '4-5시간', subInfo: '' },
  },
  sleep: {
    category: 'sleep',
    icon: 'ti-moon',
    title: '수면 가이드',
    color: '#534AB7',
    btnBg: 'rgba(83, 74, 183, 0.08)',
    btnColor: '#26215C',
    intro: '시간보다 **질과 일관성**이 우선이에요',
    principles: [
      { number: '01', title: '같은 시간에 자고 일어나기', desc: '일관성이 시간보다 중요해요' },
      { number: '02', title: '취침 2시간 전 빛 줄이기', desc: '멜라토닌이 자연스럽게 분비돼요' },
      { number: '03', title: '침실은 어둡고 시원하게', desc: '18-20도가 가장 좋은 온도예요' },
      { number: '04', title: '잠 5시간 전부터 카페인 끊기', desc: '반감기가 5-6시간이에요' },
      { number: '05', title: '못 자면 일어나서 다른 일 하기', desc: '침대에서 뒤척이면 뇌가 학습해요' },
    ],
    summary: { label: '권장 시간', mainValue: '7-9시간', subInfo: '' },
  },
  condition: {
    category: 'condition',
    icon: 'ti-mood-smile',
    title: '컨디션 가이드',
    color: '#534AB7',
    btnBg: 'rgba(83, 74, 183, 0.08)',
    btnColor: '#26215C',
    intro: '컨디션은 **하루의 결과**가 아니라 **하루의 시작**이에요',
    principles: [
      { number: '01', title: '아침 햇빛 10분', desc: '하루의 리듬이 정해져요' },
      { number: '02', title: '가벼운 움직임으로 시작', desc: '활성화는 점진적으로' },
      { number: '03', title: '한 시간에 한 번 일어나기', desc: '앉아 있는 게 흡연만큼 해롭다고 해요' },
      { number: '04', title: '감정도 데이터예요', desc: '컨디션은 몸과 마음의 합산이에요' },
      { number: '05', title: '잘 못한 날은 그냥 넘어가기', desc: '매일 7점이 아니어도 괜찮아요' },
    ],
  },
};

// 카테고리 키 → 카드 이름 매핑 (홈 카드 식별용)
export const CARD_CATEGORY_MAP = {
  water: 'water',
  caffeine: 'drink',
  meal: 'food',
  sleep: 'sleep',
  condition: 'condition',
};

/** 카페인 mg 매핑 (앱 전체 공통 상수) */
export const CAFFEINE_MG = {
  espresso: 150, americano: 150, latte: 150, drip: 130, coldbrew: 200,
  decaf: 5, matcha: 70, green_tea: 30, black_tea: 50, energy_drink: 160,
  choco_latte: 30, green_tea_latte: 80, chai_latte: 50,
};

export function getCaffeineMg(key) {
  return CAFFEINE_MG[key] || 100;
}

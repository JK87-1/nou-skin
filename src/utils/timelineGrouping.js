/**
 * 타임라인 항목 그룹화
 * 같은 카테고리가 2시간 이내 연속이면 하나로 묶음
 */

const GROUPABLE = new Set(['water', 'caffeine', 'meal']);

function timeToMin(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

export function groupTimelineItems(items) {
  if (!items || items.length === 0) return [];

  const result = [];
  let currentGroup = null;

  for (const item of items) {
    const isGroupable = GROUPABLE.has(item.category);

    if (!currentGroup) {
      currentGroup = {
        category: item.category,
        items: [item],
        firstTime: item.time,
        lastTime: item.time,
        count: 1,
        isGroupable,
      };
      continue;
    }

    const sameCategory = item.category === currentGroup.category;
    const gap = timeToMin(item.time) - timeToMin(currentGroup.lastTime);
    const withinLimit = gap <= 120;

    if (sameCategory && currentGroup.isGroupable && isGroupable && withinLimit) {
      currentGroup.items.push(item);
      currentGroup.lastTime = item.time;
      currentGroup.count += 1;
    } else {
      result.push(currentGroup);
      currentGroup = {
        category: item.category,
        items: [item],
        firstTime: item.time,
        lastTime: item.time,
        count: 1,
        isGroupable,
      };
    }
  }

  if (currentGroup) result.push(currentGroup);
  return result;
}

// 그룹의 합산 content 생성
export function getGroupSummary(group) {
  if (group.count === 1) return group.items[0].content;

  if (group.category === 'water') {
    let totalMl = 0, totalCups = 0;
    group.items.forEach(item => {
      const mlMatch = item.content.match(/(\d+)ml/);
      const cupMatch = item.content.match(/(\d+)잔/);
      if (mlMatch) totalMl += parseInt(mlMatch[1]);
      if (cupMatch) totalCups += parseInt(cupMatch[1]);
    });
    return `물 ${totalMl.toLocaleString()}ml`;
  }

  if (group.category === 'caffeine') {
    let totalMg = 0;
    group.items.forEach(item => {
      const mgMatch = item.content.match(/(\d+)mg/);
      if (mgMatch) totalMg += parseInt(mgMatch[1]);
    });
    return `카페인 ${totalMg}mg`;
  }

  if (group.category === 'meal') {
    let totalKcal = 0;
    group.items.forEach(item => {
      const kcalMatch = item.content.match(/(\d+)kcal/);
      if (kcalMatch) totalKcal += parseInt(kcalMatch[1]);
    });
    const names = group.items.map(item => {
      const parts = item.content.split('·').map(s => s.trim());
      return parts[0] || '';
    }).filter(Boolean);
    return totalKcal > 0 ? `식사 ${totalKcal.toLocaleString()}kcal` : names.join(', ');
  }

  return group.items[0].content;
}

// 그룹의 카운트 라벨
export function getGroupCountLabel(group) {
  if (group.category === 'water') {
    let totalCups = 0;
    group.items.forEach(item => {
      const cupMatch = item.content.match(/(\d+)잔/);
      if (cupMatch) totalCups += parseInt(cupMatch[1]);
    });
    return `${totalCups}잔`;
  }
  if (group.category === 'caffeine') return `${group.count}잔`;
  if (group.category === 'meal') return `${group.count}끼`;
  return `${group.count}개`;
}

// 개별 항목의 간략 표시 (펼침용)
export function getItemBrief(item) {
  if (item.category === 'water') {
    const mlMatch = item.content.match(/(\d+)ml/);
    return mlMatch ? `${mlMatch[1]}ml` : item.content;
  }
  if (item.category === 'caffeine') {
    const parts = item.content.split('·').map(s => s.trim());
    return parts.length > 1 ? parts[1] : item.content;
  }
  if (item.category === 'meal') {
    const parts = item.content.split('·').map(s => s.trim());
    return parts.length > 1 ? `${parts[0]} · ${parts[1]}` : item.content;
  }
  return item.content;
}

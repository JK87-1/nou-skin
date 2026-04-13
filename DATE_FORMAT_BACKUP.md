# 날짜 표기 백업 (2026-04-13 기준)

변경 전 복구용. 각 페이지별 UI에 표시되는 날짜 포맷 정리.

---

## RecordPage.jsx

| 위치 | 포맷 | 코드 |
|------|------|------|
| L31 | 요일 배열 | `const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];` |
| L296 | 썸네일 날짜 | `{new Date(slot.record.date).getMonth() + 1}/{new Date(slot.record.date).getDate()}` → `4/13` |
| L327 | 전체 날짜+요일 | `` `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_NAMES[d.getDay()]}요일` `` → `2026년 4월 13일 월요일` |
| L677 | 체중 날짜 | `{new Date(slot.record.date).getMonth() + 1}/{new Date(slot.record.date).getDate()}` → `4/13` |
| L1809 | 기록 리스트 | `{isToday ? '오늘' : \`${d.getMonth() + 1}/${d.getDate()}\`}` → `오늘` or `4/13` |
| L944 (Routine) | 진행률 | `{isToday ? '오늘' : \`...getMonth()+1}/${...getDate()}\`} 진행률` |

---

## ChangePage.jsx

| 위치 | 포맷 | 코드 |
|------|------|------|
| L239 | 비교 이전날짜 | `{new Date(oldest.date).getMonth() + 1}/{new Date(oldest.date).getDate()}` → `3/1` |
| L247 | 비교 최근날짜 | `{new Date(newest.date).getMonth() + 1}/{new Date(newest.date).getDate()}` → `4/13` |
| L359 | 비교 날짜+오늘 | `` `${d.getMonth() + 1}월 ${d.getDate()}일${isToday ? ' (오늘)' : ''}` `` → `4월 13일 (오늘)` |

---

## MyPage.jsx

| 위치 | 포맷 | 코드 |
|------|------|------|
| L434 | 식단 날짜 | `` `${d.getMonth() + 1}월 ${d.getDate()}일` `` → `4월 13일` |
| L501 | 체중 날짜 | `` `${d.getMonth() + 1}월 ${d.getDate()}일` `` → `4월 13일` |
| L574 | 캘린더 오버레이 | `` `${String(m+1).padStart(2,'0')}월 ${String(day).padStart(2,'0')}일` `` → `04월 13일` |
| L627 | formatShortDate | `` `${d.getMonth() + 1}월 ${d.getDate()}일` `` → `4월 13일` |
| L753-755 | 기록 카드 | `dayNum`, `${d.getMonth()+1}월`, `dayLabels[d.getDay()]+'요일'` → `13`, `4월`, `월요일` |
| L1586 | 캘린더 헤더 | `viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })` → `April 2026` |
| L1685 | 기록 상세 | `` `${y}년 ${m+1}월 ${d}일 ${dayLabels[day]}요일 ${time}` `` → `2026년 4월 13일 월요일 14:30` |

---

## RoutinePage.jsx

| 위치 | 포맷 | 코드 |
|------|------|------|
| L944 | 진행률 라벨 | `{isToday ? '오늘' : \`${m+1}/${d}\`} 진행률` → `오늘 진행률` or `4/13 진행률` |
| L1787 | 루틴 라벨 | `` `${m+1}/${d} ${label} 루틴` `` → `4/13 아침 루틴` |

---

## WeekDateHeader.jsx

| 위치 | 포맷 | 코드 |
|------|------|------|
| L41 | 헤더 타이틀 | `` `${centerDay.year}년 ${MONTH_NAMES[centerDay.month]}` `` → `2026년 4월` |
| L18-24 | 날짜 셀 | `date: d.getDate()`, `dayLabel: DAY_LABELS[d.getDay()]` → `13`, `월` |

---

## App.jsx

| 위치 | 포맷 | 코드 |
|------|------|------|
| L1041 | 랜딩 날짜 | `new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })` → `2026년 4월 13일` |

---

## HomePage.jsx

| 위치 | 포맷 | 코드 |
|------|------|------|
| L319 | 인사말 날짜 | `` `${y}. ${String(m+1).padStart(2,'0')}. ${String(d).padStart(2,'0')}  ${days[dow]}요일` `` → `2026. 04. 13  월요일` |

---

## DailyJourney.jsx

| 위치 | 포맷 | 코드 |
|------|------|------|
| L30 | 날짜 라벨 | `i === 0 ? '오늘' : dayNames[d.getDay()]` → `오늘` or `월` |

---

## SkinWeather.jsx

| 위치 | 포맷 | 코드 |
|------|------|------|
| L12 | 날짜 표시 | `` `${m+1}월 ${d}일 ${days[dow]}요일` `` → `4월 13일 월요일` |

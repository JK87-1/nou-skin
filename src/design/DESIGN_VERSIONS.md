# LUA Design Version History

---

## v1.0 — "Sky Glass" (2026-05-21 기준 현재 적용 버전)

### 컨셉
라이트모드: 투명 글래스모피즘 + 하늘빛 배경  
다크모드: 순수 블랙 + 미세 블러 카드 + 청량 블루 악센트

---

### 🌤️ Light Mode (Sky Glass)

**배경:**
- `--bg-primary`: transparent (하늘 그라데이션 또는 SVG 배경 위에 투명 레이어)
- body fallback: `#F7F8FA`
- 카드/컴포넌트가 배경 위에 반투명으로 떠있는 구조

**카드 영역:**
- `background: rgba(255,255,255,0.5)`
- `backdrop-filter: none` (blur 제거)
- `border: none` / `box-shadow: none`
- `border-radius: 20px`

**Glass Card:**
- 동일: `rgba(255,255,255,0.5)`, blur 없음, border 없음
- `padding: 24px`, `margin: 0 0 12px`

**텍스트 (Toss 팔레트):**
- primary: `#191F28`
- secondary: `#4E5968`
- muted: `#8B95A1`
- dim: `#B0B8C1`
- disabled: `#D1D6DB`

**버튼:**
- primary: `background: var(--accent-primary)` (solid), `border-radius: 16px`
- secondary: `rgba(255,255,255,0.4)` + blur, border `rgba(255,255,255,0.3)`
- ghost: `rgba(255,255,255,0.3)` + border `rgba(255,255,255,0.3)`

**탭바:**
- `background: rgba(255,255,255,0.70)` + blur 24px
- `border-top: rgba(255,255,255,0.3)`
- `border-radius: 30px 30px 0 0`

**세그먼트 컨트롤:**
- 배경: `rgba(255,255,255,0.3)`, radius `14px`
- 활성: `rgba(255,255,255,0.5)` + blur

**칩:**
- `background: rgba(255,255,255,0.3)`
- `border: none`
- `border-radius: 10px`
- `color: var(--text-secondary)`

**채팅 버블:**
- AI: `linear-gradient(135deg, #78D4B8, #6DD8A8)`, color `#FFFFFF`, radius `4px 20px 20px 20px`
- User: `#FFFFFF`, color `#191F28`, radius `20px 4px 20px 20px`

**폰트:**
- display: `'Pretendard Variable', 'Pretendard', 'Outfit', sans-serif`
- body: `'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif`

---

### 🌙 Dark Mode (Midnight Bloom)

**배경:**
- `--bg-primary`: `#000000`
- `--bg-secondary`: `#08080c`
- 상단 오라: `radial-gradient(ellipse at 50% 20%, rgba(240,144,112,0.06) 0%, rgba(255,207,170,0.03) 40%, transparent 70%)`

**카드 영역:**
- `--bg-card`: `rgba(255,255,255,0.04)`
- `backdrop-filter: blur(12px)`
- `border: none`
- `border-radius: 20px`

**Glass Card:**
- `background: var(--bg-card)` = `rgba(255,255,255,0.04)`
- `backdrop-filter: blur(16px)`
- `border: 1px solid rgba(255,255,255,0.08)`
- `border-radius: 30px`
- `box-shadow`: glass-inset + glass-accent-inset

**텍스트:**
- primary: `#f0f0f5`
- secondary: `#e0e0e8`
- muted: `#8888a0`
- dim: `#555568`

**악센트 (기본 테마: Morning Light → 다크는 Midnight Moon):**
- `--accent-primary`: `#89cef5` (sky blue)
- `--accent-secondary`: `#aed8f7`
- `--accent-gradient`: `linear-gradient(135deg, #89cef5, #5ab0e8)`

**버튼:**
- primary: `linear-gradient(135deg, #89cef5, #5ab0e8)`, radius `50px`
- secondary: `var(--bg-card)` + `1px solid rgba(255,255,255,0.08)`, radius `12px`

**탭바:**
- `background: rgba(8,8,14,0.88)` + saturate(140%) blur(24px)
- `border-top: 1px solid rgba(255,255,255,0.06)`
- `border-radius: 30px 30px 0 0`
- `box-shadow: 0 -1px 20px rgba(208,88,120,0.06), 0 8px 32px rgba(0,0,0,0.6)`

**세그먼트 컨트롤:**
- 배경: `var(--bg-card)` + `1px solid rgba(255,255,255,0.08)`, radius `50px`
- 활성: `rgba(137,206,245,0.15)`, color accent

**채팅 버블:**
- AI: `rgba(137,206,245,0.04)` + blur + `border-left: 2px solid rgba(137,206,245,0.1)`, radius `18px 18px 18px 6px`
- User: `linear-gradient(135deg, rgba(144,128,200,0.15), rgba(104,88,168,0.08))`, radius `18px 18px 6px 18px`

**폰트:**
- display: `'Outfit', sans-serif`
- body: system default

---

### 공통 요소

**카드 반경 (CSS vars):**
- `--card-border-radius`: light `20px` / dark `30px`
- `--btn-radius`: light `16px` / dark `50px`
- `--chip-radius`: light `10px` / dark `20px`
- `--segment-radius`: light `14px` / dark `50px`

**애니메이션:**
- scroll-reveal: `opacity 0→1, translateY 32px→0, 0.7s ease`
- orb breathing: `scale 0.92→1.0, shadow pulse, 4s ease-in-out infinite`
- typing dots: 1.4s stagger
- fab float: `translateY 0→-4px, scale 1→1.05`

**테마 시스템 (4개 테마):**
- Light: `morningLight` (#89cef5), `springBlossom` (#E890B0)
- Dark: `midnightMoon` (#9AC8E8), `mysticNight` (#B898D8)

**Design tokens (src/design/tokens.js):**
- Pearl palette: `#FFF0D4` → `#FFCFAA` → `#FFAA85` → `#81E4BD` → `#E87080` → `#D05878`
- Glow: `#81E4BD`, `#FFD4B8`, `#FFF5E8`
- Shadows: pearl `rgba(208,88,120,0.2)`, glow `rgba(240,144,112,0.15)`

---

### 원형 오브 (EternalPearl) — "Lemon Cloud Orb"

**파일:** `src/components/icons/EternalPearl.jsx`

**컨셉:** 구름처럼 부드럽게 퍼지는 화이트-레몬-옐로우 blob 오브

**구조 (3겹):**
1. **뒷배경 확대 오브** — `size × 1.3`, `opacity: 0.25`, radial mask로 가장자리 페이드아웃
2. **가장자리 글로우** — `orbSize × 1.08`, `radial-gradient(rgba(255,245,160,0.5) → transparent)`, `blur(8px)`
3. **메인 오브** — `orbSize` (= size × 0.85), `clipPath: circle(50%)`

**사이즈:**
- `size` prop (기본 280px)
- `orbSize` = size × 0.85 (기본 238px)

**메인 오브 배경:**
- `linear-gradient(135deg, #FFFFFF, #FFE500)`

**Blob 4개 (코어 컬러):**
| Blob | 크기 | 색상 | 속도 |
|------|------|------|------|
| blob-1 | 75% | `#FFFFFF → #FFF9B0` (화이트→밝은레몬) | 4s |
| blob-2 | 65% | `#FFE500 → #FFD600` (레몬→골드) | 5s |
| blob-3 | 55% | `#FFEB3B → #FDD835` (엠버→머스타드) | 3.5s |
| blob-4 | 60% | `#FFF176 → #FFEE58` (밝은옐로우) | 4.5s |

**Wave 4개 (연두 안개 테두리):**
| Wave | 형태 | 색상 | 속도 |
|------|------|------|------|
| 5a | 가로 80%×25% | `rgba(200,251,220,0.35)` 연두 | 8s |
| 5b | 세로 25%×80% | `rgba(200,251,220,0.3)` 연두 | 9s |
| 5c | 가로 80%×25% | `rgba(200,251,220,0.32)` 연두 | 7.5s |
| 5d | 세로 25%×80% | `rgba(200,251,220,0.3)` 연두 | 8.5s |

**Blob 공통 스타일:**
- `border-radius: 50%`
- `filter: blur(24px)` (코어) / `blur(18px)` (wave)
- `opacity: 0.85` (코어) / `0.6~0.7` (wave)
- `will-change: transform, opacity`
- `isolation: isolate`

**애니메이션 특성 (luaDrift 1~4):**
- 급격한 이동 (translate 최대 ±28%)
- 큰 스케일 변화 (0.7 ~ 1.4)
- opacity 변화 (0.55 ~ 1.0)
- 키프레임 6~7단계로 예측불가능한 유기적 움직임
- ease-in-out infinite

**애니메이션 특성 (luaWave 1~4):**
- 단방향 이동 (가로는 translateX, 세로는 translateY)
- scaleX/scaleY로 안개가 늘어났다 줄어드는 효과
- 3~4단계 키프레임
- 7.5~9초로 느린 호흡감

---

### 파일 위치
- CSS 변수 & 클래스: `src/styles.css`
- 디자인 토큰: `src/design/tokens.js`
- 글로벌 스타일: `src/design/GlobalStyles.jsx`
- 테마 정의: `src/data/BadgeData.js` (THEMES 배열)
- 원형 오브: `src/components/icons/EternalPearl.jsx`

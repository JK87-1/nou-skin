# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NOU Skin is a client-side AI skin analysis web app. Users take a selfie (or use demo mode), and the app analyzes 10 skin metrics using Canvas API pixel analysis + MediaPipe Face Mesh + optional GPT-5.2 Vision AI hybrid scoring. Korean language UI. Brand color: `#FF8C42`.

## Commands

- `npm run dev` — Start Vite dev server at http://localhost:5173
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build

No test framework or linter is configured.

## Architecture

Single-page React 18 app with Vite. No router — dual navigation: **tab-based** (`activeTab` state for 5 tabs) + **stage-based** (`stage` state for home tab sub-flow).

### Navigation

- **Tab bar** (TabBar.jsx): `home` | `routine` | `history` (gallery) | `analyze` (insights) | `my`
- **Home tab stages**: `landing` → `camera` → `upload` → `analyzing` → `result` → `detail`
- TabBar visible on landing, result, and non-home tabs

### Data Flow

```
Photo → detectLandmarks() [MediaPipe] + estimateAge() [face-api.js]
      → analyzePixels(dataUrl, landmarks) → pixelsToScores(pixelData, mlAge) → CV scores
      → callVisionAI(base64, pixelData) [/api/analyze → GPT-5.2]           → AI scores
      → hybridMerge(cv, ai) → result + auto-save + thumbnail

Fallbacks:
- AI call fails/timeout → CV-only scores (analysisMode: 'cv_only')
- Landmark detection fails → fixed-ratio regions
- ML age estimation fails → null → CV-only skinAge derivation
```

### Key Modules

- **`src/engine/FaceLandmarker.js`** — MediaPipe FaceLandmarker singleton. GPU→CPU fallback. 468 landmarks.
- **`src/engine/FaceAgeEstimator.js`** — @vladmandic/face-api wrapper for ML age estimation. Used to refine skinAge scoring.
- **`src/engine/PixelAnalysis.js`** — Core CV engine (v3.2). 512px canvas, 27 regions, gray-world normalization, YCbCr filtering. `pixelsToScores(pixelData, mlAge)` accepts optional ML age for calibration.
- **`src/engine/HybridAnalysis.js`** — GPT-5.2 Vision hybrid. `callVisionAI()` → `/api/analyze` (12s timeout). `hybridMerge()` with AI 0.95 / CV 0.05 weights. Sets `analysisMode: 'hybrid'`, preserves `aiNotes`.
- **`src/engine/LandmarkRegions.js`** — Converts 468 landmarks to 27 region bounding boxes.
- **`src/data/ScienceData.js`** — Detail page science data keyed by metric name.

### Pages & Components

- **`src/App.jsx`** — Main component. Tab + stage state machine. HybridAnalysis integration with CV fallback. Auto-saves results and thumbnails.
- **`src/pages/HistoryPage.jsx`** — Calendar + gallery (dual mode: `gallery` / `insights`). Displays thumbnails from SkinStorage.
- **`src/pages/RoutinePage.jsx`** — Morning/night skincare routine checklist.
- **`src/pages/MyPage.jsx`** — Profile page with skin type, journey stats.
- **`src/components/TabBar.jsx`** — 5-tab bottom navigation with center scan button.
- **`src/components/CameraCapture.jsx`** — Live camera with face guide overlay, objectFit cover coordinate mapping.
- **`src/components/SkinScoreCircle.jsx`** — Circular score display.
- **`src/components/AiInsightCard.jsx`** — AI insight card from latest analysis.
- **`src/components/DailyJourney.jsx`** — 7-day horizontal scroll thumbnails.

### Storage (localStorage)

- **`src/storage/SkinStorage.js`** — Records, streaks, changes, thumbnails (`nou_thumb_YYYY-MM-DD`), share text generation.
- **`src/storage/ProfileStorage.js`** — User profile (nickname, birthYear, skinType).
- **`src/storage/RoutineStorage.js`** — Routine checklist state.

## 협업 룰 (junkim × 박수진)

루아는 두 명이 같이 작업하는 프로젝트입니다.
다음 규칙을 모든 작업에 자동으로 따라주세요.

### 1. 브랜치 룰
- main에 직접 commit / push 금지
- 작업 시작 시 새 브랜치 생성:
  - 박수진 (UX/UI 작업): `ux/<작업이름>`
  - junkim (측정 정확도 작업): `accuracy/<작업이름>`
- main 머지는 사용자가 명시적으로 요청할 때만

### 2. 영역 경계
- 박수진 담당 (UX/UI):
  - src/pages/* (단, SkinMeasurePage.jsx 제외)
  - src/components/* (단, SkinScoreCircle.jsx 제외)
  - 스타일·색상·레이아웃·인터랙션
- junkim 담당 (측정 정확도·엔진):
  - src/engine/*
  - api/analyze.js
  - 측정 결과 스키마, 메트릭 정의
- 회색 지대 (만지기 전 사용자 확인):
  - src/App.jsx
  - src/pages/SkinMeasurePage.jsx
  - src/components/SkinScoreCircle.jsx
  - src/storage/SkinStorage.js
  - src/data/ScienceData.js

### 3. 메트릭·스키마 변경
- 11개 측정 메트릭 키 이름·범위 변경 금지 (사전 합의 없이는)
- SkinStorage 저장 키 구조 변경 금지 (사전 합의 없이는)
- App.jsx의 stage 이름 변경 금지 (사전 합의 없이는)

### 4. dev 서버 포트
- 박수진: localhost:5173 (기본)
- junkim: localhost:5174

위 규칙을 모든 코드 변경 작업에 자동 적용해주세요.

## 아이콘 & 컬러 규칙

### 아이콘
- 이모지(☀️💧🚫 등) 및 Apple SF Symbols 사용 금지
- 모든 아이콘은 **Tabler Icons** 사용 (https://tabler.io/icons)
- Filled 스타일 우선, 필요시 Outline 사용
- 패키지 설치 없이 **인라인 SVG**로 삽입 (공식 GitHub raw 소스에서 path 복사)
- 다중 path 아이콘은 반드시 개별 `<path>`로 분리 (단일 path에 합치면 깨짐)

### LUA 컬러 팔레트

**Sky Gradient (홈 배경 — 위→아래 5단계)**

| 토큰 | HEX | 용도 |
|---|---|---|
| Sky 100 | `#58aefe` | 그라디언트 최상단, **브랜드 컬러** (배경·로고·핵심 브랜드 표현) |
| Sky 200 | `#78bdfd` | 상단 25% |
| Sky 300 | `#98ccfc` | 중간 50% |
| Sky 400 | `#b7dafb` | 하단 75% |
| Sky 500 | `#d7e9fa` | 그라디언트 최하단 |

**Sub-page Gradient (화장대~마이 배경)**

| HEX | 용도 |
|---|---|
| `#C5E3FF` | 서브 그라디언트 상단 |
| `#F1F7FD` | 서브 그라디언트 하단 |

**Pearl Orb (원형 오브 코어 4색)**

| 이름 | 중심 → 가장자리 |
|---|---|
| Pearl White-Pink | `#FFFFFF` → `#FFB8C8` |
| Pearl Violet | `#D8A8F0` → `#C090E0` |
| Pearl Sky | `#90C4F8` → `#70B0F0` |
| Pearl Lavender | `#FFFFFF` → `#E0C8F0` |

**Pearl Orb (웨이브 글로우 4색)**

| 이름 | 컬러 |
|---|---|
| Glow Pink | `rgba(255,150,180)` |
| Glow Violet | `rgba(180,150,240)` |
| Glow Sky | `rgba(140,190,250)` |
| Glow Rose | `rgba(240,170,200)` |

### 컬러 사용 기준

**Brand `#58aefe` (Sky 100)** — 홈 배경 그라디언트, 로고, 핵심 브랜드 표현에만 사용. "루아다움"을 보여주는 소중한 컬러.

**Action `#6598ef`** — 사용자 인터랙션 요소 전용:
- 버튼 배경, 아이콘 fill, 체크박스 accent, 헤더 포인트 텍스트, 링크
- 버튼 그라디언트 → `#6598ef → #85b0f5`
- 테두리·배경 힌트 → `rgba(101,152,239, 0.18)`
- 그림자 → `rgba(101,152,239, 0.32)`

## Conventions

- Inline styles extensively in JSX; CSS classes for reusable patterns (glass-card, tab-bar, orb animations)
- Fonts: `Outfit` (display), `Noto Sans KR` / `Pretendard` (body)
- Metric keys: `skinAge`, `moisture`, `skinTone`, `troubleCount`, `oilBalance`, `wrinkleScore`, `poreScore`, `elasticityScore`, `pigmentationScore`, `textureScore`, `darkCircleScore`
- Score range: 0–100 (most metrics); `skinAge` 16–58; `troubleCount` 0–20
- Privacy: CV analysis is browser-side. AI hybrid sends compressed photo to `/api/analyze`; photo not stored.
- Vercel deployment: `api/analyze.js` requires `OPENAI_API_KEY` env var. Rate limited 30 req/IP/day.

## 협업 룰 (junkim × 박수진)

루아는 두 명이 같이 작업하는 프로젝트입니다.
다음 규칙을 모든 작업에 자동으로 따라주세요.

### 1. 브랜치 룰
- main에 직접 commit / push 금지
- 작업 시작 시 새 브랜치 생성:
  - 박수진 (UX/UI 작업): `ux/<작업이름>`
  - junkim (측정 정확도 작업): `accuracy/<작업이름>`
- main 머지는 사용자가 명시적으로 요청할 때만

### 2. 영역 경계
- 박수진 담당 (UX/UI):
  - src/pages/* (단, SkinMeasurePage.jsx 제외)
  - src/components/* (단, SkinScoreCircle.jsx 제외)
  - 스타일·색상·레이아웃·인터랙션
- junkim 담당 (측정 정확도·엔진):
  - src/engine/*
  - api/analyze.js
  - 측정 결과 스키마, 메트릭 정의
- 회색 지대 (만지기 전 사용자 확인):
  - src/App.jsx
  - src/pages/SkinMeasurePage.jsx
  - src/components/SkinScoreCircle.jsx
  - src/storage/SkinStorage.js
  - src/data/ScienceData.js

### 3. 메트릭·스키마 변경
- 11개 측정 메트릭 키 이름·범위 변경 금지 (사전 합의 없이는)
- SkinStorage 저장 키 구조 변경 금지 (사전 합의 없이는)
- App.jsx의 stage 이름 변경 금지 (사전 합의 없이는)

### 4. dev 서버 포트
- 박수진: localhost:5173 (기본)
- junkim: localhost:5174

### 5. 노션 진행 상황 자동 기록

루아 작업 진행은 노션 페이지 "09. 진행 상황"에 자동 기록합니다.
다음 시점에 `scripts/notion-progress.cjs` 를 실행해주세요:

**자동 실행 시점:**
- 새 브랜치 생성 후 작업 시작: `node scripts/notion-progress.cjs "<작업 설명>" "시작"`
- 브랜치에 push 완료 (작업 1차 끝): `node scripts/notion-progress.cjs "<완료된 내용>" "완료" "<Vercel preview URL>"`
- main 머지 완료 (사용자가 보는 사이트 반영): `node scripts/notion-progress.cjs "<머지된 기능>" "본사이트" "https://nou-skin.vercel.app"`
- 오류·보류: `node scripts/notion-progress.cjs "<상황 설명>" "오류"` 또는 `"보류"`

**상태 옵션:**
- `시작` 🟡 — 작업 시작
- `진행중` 🔵 — 중간 진척
- `완료` ✅ — 브랜치 작업 완료 (push)
- `본사이트` 🌟 — main 머지로 사용자 사이트에 반영됨
- `보류` ⏸ — 작업 멈춤
- `오류` ❌ — 문제 발생

**메시지 작성 룰 (사람이 읽기 쉽게):**
- 영문 기술 용어(branch, commit, sha, push, merge 등) 사용 금지
- 한국어로 작업 내용 한 줄 요약 (예: "주름 점수 보정표 복원했음")
- 사용자(junkim)가 비개발자임. 코드 내부 용어 노출 X

**스크립트가 자동 수집 (사용자에게 안 보임):**
- 현재 브랜치 · git author
- 영역(`accuracy/*` → 🔬 측정 정확도, `ux/*` → 🎨 디자인·화면)
- 한국 시간 타임스탬프

**사전 요구사항:**
- `~/nou-skin/.env` 에 `NOTION_TOKEN` 과 `NOTION_PAGE_ID` 존재 (이미 설정됨)
- `.env` 는 gitignore 처리되어 GitHub에 노출되지 않음
- 박수진 환경에서는 같은 `.env` 파일이 필요하니, junkim이 토큰을 별도 채널로 안전하게 전달

**기록 안 해도 되는 작업:**
- 단순 typo 수정, 디버그용 1회성 명령, 실험적 변경
- 즉, **사용자가 인지할 만한 진척이 있을 때만** 기록

위 규칙을 모든 코드 변경 작업에 자동 적용해주세요.

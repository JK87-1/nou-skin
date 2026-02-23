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

## Conventions

- Inline styles extensively in JSX; CSS classes for reusable patterns (glass-card, tab-bar, orb animations)
- Fonts: `Outfit` (display), `Noto Sans KR` / `Pretendard` (body)
- Metric keys: `skinAge`, `moisture`, `skinTone`, `troubleCount`, `oilBalance`, `wrinkleScore`, `poreScore`, `elasticityScore`, `pigmentationScore`, `textureScore`, `darkCircleScore`
- Score range: 0–100 (most metrics); `skinAge` 16–58; `troubleCount` 0–20
- Privacy: CV analysis is browser-side. AI hybrid sends compressed photo to `/api/analyze`; photo not stored.
- Vercel deployment: `api/analyze.js` requires `OPENAI_API_KEY` env var. Rate limited 30 req/IP/day.

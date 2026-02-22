# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NOU Skin is a client-side AI skin analysis web app. Users upload a selfie (or use demo mode), and the app analyzes 10 skin metrics using Canvas API pixel analysis + MediaPipe Face Mesh for accurate face region detection — no server or external API calls. All processing happens in the browser.

Korean language UI. Brand color: `#FF8C42` (orange gradient palette).

## Commands

- `npm run dev` — Start Vite dev server at http://localhost:5173
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build

No test framework or linter is configured.

## Architecture

Single-page React 18 app with Vite. No router — stage-based navigation via `useState` in App.jsx.

### Data Flow (Level 3: CV + AI Hybrid)

```
Photo upload → detectLandmarks() [MediaPipe] → analyzePixels(dataUrl, landmarks) [Canvas API]
             → compressImage()                → normalizeLighting() → pixelsToScores() → CV scores
                                                                                            ↓
             → callVisionAI(base64, pixelData) [/api/analyze → GPT-5.2 Vision]         → AI scores
                                                                                            ↓
                                                                              hybridMerge(cv, ai) → UI render
                                                                                       ↑
Demo mode → generateDemoScores() → fake pixel data ──────────────────────────────────────┘

Fallbacks:
- AI call fails/timeout → CV-only scores (analysisMode: 'cv_only')
- Landmark detection fails → null → fixed-ratio regions (v2.1 behavior)
```

### Stage Machine (App.jsx)

`landing` → `upload` (photo preview) → `analyzing` (progress animation) → `result` (scores + advice)

Any stage can transition to `detail` (science explanation page) and back.

### Key Modules

- **`src/engine/FaceLandmarker.js`** — Lazy singleton wrapper around MediaPipe FaceLandmarker. Loads WASM+model (~5.5MB) from CDN on first use. `detectLandmarks(imgElement)` returns 468 normalized landmarks or null.

- **`src/engine/LandmarkRegions.js`** — Converts 468 MediaPipe landmarks into 27 analysis-region bounding boxes (pixel coordinates). Maps to the same region names used by PixelAnalysis.js.

- **`src/engine/PixelAnalysis.js`** — Core CV analysis engine (v3.1). Accepts optional landmarks for accurate region placement (falls back to fixed ratios). Includes gray-world white-balance normalization, YCbCr skin pixel filtering, calibration table scoring. Deterministic (no jitter). 27 regions across 10 metrics. Derived: skinAge.

- **`src/engine/HybridAnalysis.js`** — GPT-5.2 Vision AI hybrid module. `callVisionAI()` sends compressed photo + CV data to `/api/analyze`. `hybridMerge()` combines AI + CV scores with per-metric weights (AI 0.95 / CV 0.05 for all metrics).

- **`src/data/ScienceData.js`** — Static data for detail pages: methodology descriptions, scientific references, score interpretation ranges, gut-brain-skin axis explanations. Keyed by metric name.

- **`src/components/UIComponents.jsx`** — Reusable UI components: `AnimatedNumber`, `ScoreRing` (SVG circular progress), `MetricBar` (animated bar chart), `Tag`, `DetailPage` (renders science data for a metric).

- **`src/App.jsx`** — Main component containing all stage rendering and state management. Calls `detectLandmarks` on photo upload and passes result to `analyzePixels`. Inline styles throughout (no CSS modules).

- **`src/styles.css`** — Global styles, animations (`fadeIn`, `slideUp`, `ripple`), button/card/tag classes. Mobile-first, max-width 430px.

## Conventions

- Inline styles are used extensively in JSX; CSS classes only for reusable patterns (buttons, cards, tags)
- Display font: `Outfit` (Google Fonts), body font: `Pretendard` / system fallback
- All skin metric keys: `skinAge`, `moisture`, `skinTone`, `trouble` (maps to `troubleCount` in scores), `oilBalance`, `wrinkles`, `pores`, `elasticity`, `pigmentation`, `texture`, `darkCircles`
- Score range: most metrics 0–100; `skinAge` is 16–58; `troubleCount` is 0–20
- Deterministic: same photo always produces same scores (no jitter in real analysis; demo mode uses random)
- Privacy: CV analysis is fully browser-side. AI hybrid mode sends compressed photo to `/api/analyze` (Vercel serverless → OpenAI API); photo is not stored.
- MediaPipe model loaded from CDN at runtime; if offline/blocked, falls back to fixed-ratio regions
- Vercel deployment: `api/analyze.js` requires `OPENAI_API_KEY` env var. Rate limited to 30 req/IP/day.

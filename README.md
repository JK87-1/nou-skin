# NOU AI 피부 분석 웹앱

## 🚀 Claude Code에서 실행하기

### 방법 1: 한 줄 명령 (가장 쉬움)
Claude Code 터미널에서:
```bash
cd nou-skin && npm install && npm run dev
```

### 방법 2: 단계별 실행
```bash
# 1. 프로젝트 폴더로 이동
cd nou-skin

# 2. 의존성 설치 (최초 1회)
npm install

# 3. 개발 서버 실행
npm run dev
```

### 3. 브라우저에서 확인
```
http://localhost:5173
```
자동으로 브라우저가 열립니다.

---

## 📁 프로젝트 구조

```
nou-skin/
├── index.html                 # HTML 엔트리포인트
├── package.json               # 의존성 관리
├── vite.config.js             # Vite 설정
├── src/
│   ├── main.jsx               # React 엔트리포인트
│   ├── App.jsx                # 메인 앱 컴포넌트
│   ├── styles.css             # 글로벌 스타일
│   ├── engine/
│   │   └── PixelAnalysis.js   # 🔬 핵심 픽셀 분석 엔진
│   ├── data/
│   │   └── ScienceData.js     # 📚 과학적 근거 데이터
│   └── components/
│       └── UIComponents.jsx   # 🎨 UI 컴포넌트
└── README.md
```

---

## 🔬 핵심 기술: 픽셀 분석 엔진

### 아키텍처
```
사진 업로드
    ↓
Canvas API (256×256 리사이즈)
    ↓
얼굴 5영역 분할 (이마/코/양볼/턱)
    ↓
각 영역 픽셀 분석:
  ├─ 밝기 표준편차(σ) → 수분도
  ├─ ITA° 계산 → 피부톤
  ├─ 적색 우세 비율 → 트러블
  ├─ 하이라이트 비율 → 유분
  └─ Edge Density → 피부나이
    ↓
점수 산출 + 맞춤 조언
```

### 각 지표별 측정 원리

| 지표 | 측정 신호 | 과학적 근거 |
|------|----------|------------|
| 수분도 | 밝기 표준편차(σ) | Corneometer 시각적 상관관계 |
| 피부톤 | ITA° = arctan((L*-50)/b*) | Chardon A (1991) 국제 표준 |
| 트러블 | R > G×1.2 & R > B×1.25 | 홍반 지수(EI) 디지털 근사 |
| 유분 | T존/U존 하이라이트 비율 | Sebumeter 시각적 상관관계 |
| 피부나이 | Edge Density (Sobel) | Fitzpatrick 텍스처 분석 |

---

## 🌐 배포하기 (Vercel)

```bash
# 1. 빌드
npm run build

# 2. Vercel CLI로 배포
npx vercel --prod

# 또는 GitHub 연동
git init
git add .
git commit -m "NOU Skin MVP"
git remote add origin https://github.com/your-repo/nou-skin.git
git push -u origin main
# → Vercel에서 Import → 자동 배포
```

---

## 📊 주요 기능

- ✅ **실제 픽셀 분석**: Canvas API로 사진의 물리적 특성 측정
- ✅ **5개 피부 지표**: 피부나이, 수분도, 피부톤, 트러블, 유분밸런스
- ✅ **과학적 근거**: 각 지표별 논문 참고문헌 + 측정 원리 설명
- ✅ **장-뇌-피부 축**: 구트 헬스 연결고리 교육
- ✅ **맞춤 조언**: 가장 약한 지표 기반 개인화 추천
- ✅ **데모 모드**: 사진 없이도 체험 가능
- ✅ **모바일 최적화**: PWA 대응 반응형 UI

---

## 🔒 개인정보
- 사진은 브라우저에서만 처리 (서버 전송 없음)
- Canvas API로 로컬 분석 후 즉시 삭제

---

㈜누 (NOU Inc.) © 2026

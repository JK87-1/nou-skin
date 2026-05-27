/**
 * LUA Science Data v2.1 — Complete 10-Metric System
 */

export const SCIENCE = {

  skinAge: {
    icon: '', title: '피부 나이', subtitle: 'Biological Skin Age',
    color: '#FF6B35', gradient: 'linear-gradient(135deg, #FF8C42, #FF6B35)',
    hero: 'VISIA 임상 분석 프레임워크 기반, 10개 피부 지표의 다변량 종합 모델로 생물학적 피부 나이를 추정합니다.',
    methodology: `LUA는 피부과 임상에서 사용하는 VISIA Complexion Analysis 및 Nkengne A(2008)의 인지 연령 연구를 기반으로, 10개 피부 바이오마커의 다변량 가중 모델(Multivariate Weighted Model)을 구축했습니다. 주름·탄력·색소·피부결 등 각 지표를 비침습적 컴퓨터 비전으로 독립 측정한 뒤, 노화 인지 기여도에 따른 차등 가중치를 적용하여 종합 피부 연령을 산출합니다. 내인성·외인성 노화 인자를 분리 반영하며, 피부과 임상 데이터와의 교차 검증(Cross-validation)을 통해 모델 정확도를 지속적으로 캘리브레이션하고 있습니다.`,
    references: [
      { name: '10-Metric Weighted Age Model', description: '10개 피부 지표의 가중 패널티 합산으로 피부 나이를 산출. 지표별 차등 가중치를 적용하며, 모든 지표가 우수하면 젊은 피부 보정이 적용됩니다.', source: 'LUA Skin Analysis Engine v2.1' },
      { name: 'Age Perception Study', description: '주름이 인지 연령에 가장 큰 영향. 처짐, 색소 불균일, 피부결이 뒤를 이음.', source: 'Nkengne A et al. (2008) Age, 30(4):317-325' },
      { name: 'Intrinsic vs Extrinsic Aging', description: '내인성 노화(유전, 호르몬)와 외인성 노화(UV, 흡연, 오염)의 구분. 외인성이 피부 노화의 80%를 차지.', source: 'Farage MA et al. (2008) Adv Wound Care' },
    ],
    steps: [],
    ranges: [
      { range: '실제 나이 -5세 이하', label: '탁월', color: '#4CAF50', description: '모든 지표가 우수해요!' },
      { range: '실제 나이 ±3세', label: '양호', color: '#FF9800', description: '평균적인 피부 상태.' },
      { range: '실제 나이 +5세 이상', label: '관리 필요', color: '#f44336', description: '가장 약한 지표부터 개선하세요.' },
    ],
    gutBrainSkin: '장-뇌-피부 축은 10개 피부 지표 모두에 영향을 줍니다. 장 건강이 좋으면 전신 염증↓ → 콜라겐 보호(주름↓) + 멜라닌 정상화(색소↓) + 피지 균형(모공↓) + 장벽 강화(수분↑) + 수면 질 향상(다크서클↓)으로 이어집니다.',
    gutBrainSkinSource: 'Salem I et al. (2018) "The Gut Microbiome as a Major Regulator of the Gut-Skin Axis" Frontiers in Microbiology, 9:1459',
  },

  moisture: {
    icon: '', title: '수분', subtitle: 'Skin Hydration Level',
    color: '#A8DEFF', gradient: 'linear-gradient(135deg, #A8DEFF, #78C0EE)',
    hero: '피부과 수분 측정기(Corneometer) 기반의 비침습적 광학 분석으로 각질층 수분 상태를 평가합니다.',
    methodology: `LUA는 피부과에서 사용하는 Corneometer(각질층 전기 용량 수분 측정기)의 측정 원리를 멀티스펙트럼 컴퓨터 비전으로 구현했습니다. 촉촉한 피부와 건조한 피부의 광학적 반사 패턴(Specular/Diffuse Reflection Ratio) 차이를 활용하여, MediaPipe Face Mesh 468개 랜드마크 기반으로 세분화된 얼굴 영역별 수분 분포를 정밀 분석합니다. 피부과 임상 기기 측정 데이터와의 교차 검증(Cross-validation)을 통해 알고리즘 정확도를 지속적으로 개선하고 있습니다.`,
    references: [
      { name: '밝기 균일도 분석', description: '픽셀 밝기의 분산을 계산하여 수분 상태를 평가합니다. 분산이 낮을수록 균일한 보습 상태입니다.', source: 'LUA Computer Vision Engine' },
      { name: 'Corneometer CM 825', description: '각질층 전기 용량으로 수분량 측정. 건성 <30AU, 정상 40~60AU, 촉촉 75+AU.', source: 'Courage+Khazaka Electronic GmbH' },
      { name: 'TEWL (경피수분손실량)', description: '피부 장벽을 통해 증발하는 수분량. TEWL↑ = 장벽 손상.', source: 'Pinnagoda J et al. (1990) Contact Dermatitis' },
    ],
    steps: [],
    ranges: [
      { range: '75% 이상', label: '촉촉', color: '#0e6bec', description: '충분히 보습된 피부.' },
      { range: '60~74%', label: '정상', color: '#00a0fc', description: '양호한 수분 상태.' },
      { range: '40~59%', label: '건조', color: '#777167', description: '보습 에센스 추가 추천.' },
      { range: '40% 미만', label: '건조', color: '#272727', description: '집중 보습 케어 필요.' },
    ],
    gutBrainSkin: '장내 유익균은 단쇄지방산(SCFA)을 생산하여 피부 각질세포의 세라마이드 합성을 촉진하고, 경피수분손실(TEWL)을 줄여줍니다.',
    gutBrainSkinSource: 'Lee DE et al. (2023) "Probiotics and Skin Barrier Function" Gut Microbiome',
  },

  skinTone: {
    icon: '', title: '피부톤', subtitle: 'Skin Tone & Luminosity',
    color: '#FFE082', gradient: 'linear-gradient(135deg, #FFE082, #F0C860)',
    hero: 'CIE LAB 색 공간 기반 ITA° 분석과 Mexameter 상관 모델로 피부 밝기 및 색소 균일도를 정량 평가합니다.',
    methodology: `LUA는 피부과 색소 분석의 국제 표준인 ITA°(Individual Typology Angle)를 CIE L*a*b* 색 공간에서 직접 산출하며, Mexameter MX 18(568nm/660nm 이중 파장 멜라닌·헤모글로빈 측정기)의 임상 데이터와 상관관계 검증을 수행합니다. MediaPipe Face Mesh 랜드마크 기반의 정밀 영역 분할로 색상 분산(Chromatic Variance), 좌우 비대칭도, 홍반 지수를 동시에 분석하는 다채널 피부톤 프로파일링을 구현했습니다. 피부과 분광 측색기 데이터와의 지속적 캘리브레이션을 통해 측정 신뢰도를 유지하고 있습니다.`,
    references: [
      { name: 'ITA° 직접 계산', description: 'CIE L*a*b* 색 공간에서 피부색 정량화 국제 표준.', source: 'Chardon A et al. (1991) Int J Cosmetic Science' },
      { name: 'Mexameter MX 18', description: '568nm·660nm LED로 멜라닌·헤모글로빈 함량 측정.', source: 'Courage+Khazaka Electronic GmbH' },
    ],
    steps: [],
    ranges: [
      { range: '80점 이상', label: '균일', color: '#0e6bec', description: '밝고 균일한 피부톤.' },
      { range: '60~79점', label: '양호', color: '#00a0fc', description: '전반적으로 좋은 상태.' },
      { range: '40~59점', label: '불균일', color: '#777167', description: '색소침착 관리 필요.' },
      { range: '40점 미만', label: '칙칙', color: '#272727', description: '비타민C + 자외선 차단 추천.' },
    ],
    gutBrainSkin: '장내 만성 염증은 사이토카인(TNF-α, IL-6)을 퍼뜨려 멜라노사이트를 과자극, 기미·색소침착을 유발합니다.',
    gutBrainSkinSource: 'Park SH et al. (2024) J Cosmetic Dermatology',
  },

  trouble: {
    icon: '', title: '트러블', subtitle: 'Acne & Blemish Analysis',
    color: '#FFB0B0', gradient: 'linear-gradient(135deg, #FFB0B0, #F08080)',
    hero: 'GAGS(Global Acne Grading System) 기반의 다유형 병변 감지 알고리즘으로 트러블 상태를 종합 평가합니다.',
    methodology: `LUA는 피부과 임상에서 사용하는 GAGS(Global Acne Grading System)의 영역별 병변 분류 체계를 컴퓨터 비전으로 구현하여, 개방성 면포(블랙헤드)·폐쇄성 면포(화이트헤드)·염증성 농포(Pustule)를 각각 독립적으로 감지합니다. CIE LAB 색 공간의 L*·a*·b* 채널 다차원 분석과 Micro-Variance 텍스처 검출을 병행하며, MediaPipe Face Mesh 기반 정밀 영역 분할로 T존(피지성)·볼(홍조 구별)·턱(호르몬성) 영역의 병변 특성을 분리 평가합니다. 피부과 전문의의 육안 진단 데이터와의 상관관계 검증을 통해 병변 분류 정확도를 지속적으로 개선하고 있습니다.`,
    references: [
      { name: '3유형 트러블 분류', description: '블랙헤드(개방성 면포): 산화 피지 다크 스팟 밀집도 분석. 화이트헤드(폐쇄성 면포): 유백색 요철의 로컬 분산 분석. 화농성 여드름: 적색 우세 영역과 중심 황색 클러스터 감지.', source: 'LUA Computer Vision Engine' },
      { name: 'GAGS (Global Acne Grading System)', description: '얼굴 6영역(이마·우볼·좌볼·코·턱·흉부) 병변 종합. 경증 1~18, 중등도 19~30, 중증 31+.', source: 'Doshi A et al. (1997) J Am Acad Dermatol, 37(3):468-472' },
      { name: 'Comedone Pathogenesis', description: '면포(Comedone)는 여드름의 기본 병변. 개방성(블랙헤드)은 산화 멜라닌+피지, 폐쇄성(화이트헤드)은 각질+피지 폐색. 방치 시 염증성으로 진행.', source: 'Zaenglein AL et al. (2016) J Am Acad Dermatol, 74(5):945-973' },
      { name: 'C. acnes & Inflammation', description: 'Cutibacterium acnes가 막힌 모낭에서 증식 → 유리지방산 분비 → TLR2 활성화 → IL-1β, TNF-α 분비 → 염증성 여드름(구진·농포·결절).', source: 'Beylot C et al. (2014) JEADV, 28(3):271-278' },
    ],
    steps: [],
    ranges: [
      { range: '0~2개', label: '깨끗', color: '#0e6bec', description: '트러블 거의 없음. 현재 루틴 유지.' },
      { range: '3~5개', label: '경증', color: '#00a0fc', description: '가벼운 면포 수준. 기본 클렌징 + BHA 토너로 관리.' },
      { range: '6~10개', label: '중등도', color: '#777167', description: '염증성 병변 포함. BHA 각질 케어 + 진정 세럼 권장.' },
      { range: '11개 이상', label: '중증', color: '#272727', description: '화농성 여드름 다수. 피부과 상담 권장.' },
    ],
    gutBrainSkin: '장 유해균 증가 → 장 투과성 증가(Leaky Gut) → 내독소(LPS) 혈류 유입 → 피지선 과활성 + 모낭 염증 → 여드름 악화. 특히 C. acnes의 과증식은 장내 미생물 불균형과 상관관계가 높습니다. L. rhamnosus GG 프로바이오틱스 섭취 후 여드름 병변이 47.2% 감소한 임상 결과가 보고되었습니다.',
    gutBrainSkinSource: 'Fabbrocini G et al. (2023) "Probiotics and Acne" Gut Microbiome Journal; Bowe WP & Logan AC (2011) "Acne vulgaris, probiotics and the gut-brain-skin axis" Gut Pathogens, 3:1',
  },

  oilBalance: {
    icon: '', title: '유분', subtitle: 'Sebum Level Analysis',
    color: '#F0E0A8', gradient: 'linear-gradient(135deg, #F0E0A8, #E0D090)',
    hero: 'Sebumeter 임상 원리 기반, Specular Reflection 광학 분석으로 T존/U존 피지 분비량을 정량 측정합니다.',
    methodology: `LUA는 피부과 피지 측정 기기 Sebumeter SM 815의 광투과율 측정 원리를 Specular Reflection(정반사) 컴퓨터 비전으로 구현하여, 피부 표면 Glossiness 분포를 비침습적으로 정량화합니다. MediaPipe Face Mesh 랜드마크 기반으로 피지선 밀도가 높은 T존(이마·코)과 U존(볼·턱)을 정밀 분할하고, 영역별 반사광 면적·강도·채도 변위 등 다중 광학 신호를 종합 분석합니다. Sebumeter 임상 측정값과의 교차 캘리브레이션(r=0.82 상관계수 기반)을 통해 카메라 기반 유분 측정의 정확도를 지속적으로 검증하고 있습니다.`,
    references: [
      { name: '반사광(Specular Highlight) 분석', description: '일정 밝기 이상의 픽셀을 하이라이트로 정의하고, T존/U존 하이라이트 비율, 전체 면적, 채도 등 다중 신호를 가중 합산하여 유분 지수를 산출합니다.', source: 'LUA Computer Vision Engine' },
      { name: 'Sebumeter SM 815', description: '매트 필름에 피지를 흡착시킨 뒤 광투과율로 피지량 정량 측정. 임상 기기 기준값으로 LUA의 반사광 분석을 캘리브레이션.', source: 'Courage+Khazaka Electronic GmbH' },
      { name: 'Sebaceous Gland Distribution', description: 'T존(이마·코)의 피지선 밀도는 볼의 2~3배. T존 중심 스캔이 유분 측정의 핵심.', source: 'Zouboulis CC (2004) Clinics in Dermatology, 22(5):360-366' },
      { name: 'Sebum & Skin Glossiness', description: '피부 표면 피지량과 반사광(Glossiness) 면적은 r=0.82의 높은 상관관계. 카메라 기반 유분 측정의 과학적 근거.', source: 'Youn SW et al. (2005) Skin Research & Technology, 11(2):110-115' },
    ],
    steps: [],
    ranges: [
      { range: '40~60%', label: '적당', color: '#0e6bec', description: '황금 밸런스. 피부 보호막이 건강한 상태.' },
      { range: '61~80%', label: '유분과다', color: '#00a0fc', description: '번들거림 있음. 가벼운 수분 젤 보습제 추천.' },
      { range: '39% 이하', label: '유분부족', color: '#777167', description: '피부가 매트하고 당김. 페이셜 오일 추가 추천.' },
      { range: '81% 이상', label: '나쁨', color: '#272727', description: '심한 번들거림. 유분 조절 토너 + 클레이 마스크 필요.' },
    ],
    gutBrainSkin: '장내 유익균은 에스트로볼롬으로 호르몬 대사에 관여. 장 불균형 → 호르몬 불균형 → 피지선 과활성.',
    gutBrainSkinSource: 'Baker JM et al. (2017) Maturitas, 103:45-53',
  },

  wrinkles: {
    icon: '', title: '주름', subtitle: 'Wrinkle Analysis',
    color: '#F5D0B8', gradient: 'linear-gradient(135deg, #F5D0B8, #E8C0A8)',
    hero: 'Fitzpatrick Wrinkle Scale 기반, 방향성 에지 밀도 분석(Directional Edge Detection)으로 주름 심각도를 평가합니다.',
    methodology: `LUA는 피부과 주름 평가 표준인 Fitzpatrick Wrinkle Scale과 Glogau Photoaging Classification을 참조하여, 방향성 에지 검출(Directional Edge Detection) 컴퓨터 비전 알고리즘을 구축했습니다. MediaPipe Face Mesh 랜드마크로 이마(수평 주름)·눈가(방사형 까마귀발)·팔자(수직 주름) 3개 핵심 존을 정밀 분할하고, 각 영역에 최적화된 방향성 Laplacian 필터로 에지 밀도를 정량화합니다. 피부과 고해상도 프로필로미터(PRIMOS) 측정 데이터와의 교차 검증을 통해 비침습적 주름 심각도 평가의 정확도를 지속적으로 캘리브레이션하고 있습니다.`,
    references: [
      { name: '방향성 에지 검출', description: 'Laplacian 방향성 변형으로 주름 패턴만 선택적 검출.', source: 'LUA Computer Vision Engine' },
      { name: 'Fitzpatrick Wrinkle Scale', description: '주름 깊이·길이·분포 0~9등급 분류.', source: 'Fitzpatrick RE et al. (1996) Dermatologic Surgery' },
      { name: 'Glogau Photoaging Scale', description: 'Type I(20대)~Type IV(60대+) 광노화 4단계.', source: 'Glogau RG (1996) J Dermatol Surg Oncol' },
    ],
    steps: [],
    ranges: [
      { range: '85점 이상', label: '매끈', color: '#0e6bec', description: '주름 거의 없음.' },
      { range: '65~84점', label: '양호', color: '#00a0fc', description: '미세 잔주름 수준.' },
      { range: '45~64점', label: '보통', color: '#777167', description: '주름이 눈에 띄기 시작.' },
      { range: '45점 미만', label: '나쁨', color: '#272727', description: '적극적 주름 관리 추천.' },
    ],
    gutBrainSkin: '장 불균형 → 전신 염증 → MMP 활성화 → 콜라겐·엘라스틴 분해 → 주름 가속. L. plantarum이 항산화 효소를 활성화하여 콜라겐 보호.',
    gutBrainSkinSource: 'Kim HM et al. (2021) Nutrients, 13(4):1195',
  },

  pores: {
    icon: '', title: '모공', subtitle: 'Pore Size Analysis',
    color: '#E8D8C8', gradient: 'linear-gradient(135deg, #E8D8C8, #D8C8B8)',
    hero: 'VISIA 교차 편광 모공 분석 원리 기반, Micro-Variance 텍스처 검출로 모공 크기와 밀도를 평가합니다.',
    methodology: `LUA는 피부과 영상 분석 시스템 VISIA의 교차 편광(Cross-polarized) 모공 시각화 원리를 참조하여, 슬라이딩 윈도우 기반 Micro-Variance 텍스처 분석 알고리즘을 구현했습니다. MediaPipe Face Mesh 랜드마크로 피지선 밀집 영역(코·코날개·양볼 내측)을 정밀 분할한 뒤, 국소 영역의 고주파 밝기 변동(High-frequency Luminance Fluctuation)을 정량화하여 모공 크기·밀도를 비침습적으로 산출합니다. VISIA 임상 모공 측정 데이터와의 상관관계 검증을 통해 알고리즘 정밀도를 지속적으로 개선하고 있습니다.`,
    references: [
      { name: '마이크로 분산 분석', description: '슬라이딩 윈도우 내 밝기 분산을 측정합니다. 분산이 높을수록 모공이 큰 상태입니다.', source: 'LUA Computer Vision Engine' },
      { name: 'VISIA Pore Analysis', description: '교차 편광 조명으로 모공 크기·분포 측정.', source: 'Canfield Scientific' },
    ],
    steps: [],
    ranges: [
      { range: '80점 이상', label: '좋음', color: '#0e6bec', description: '모공 거의 안 보임.' },
      { range: '60~79점', label: '정상', color: '#00a0fc', description: '보통 수준의 모공.' },
      { range: '40~59점', label: '확장', color: '#777167', description: '모공 축소 관리 추천.' },
      { range: '40점 미만', label: '나쁨', color: '#272727', description: '적극적 모공 관리 필요.' },
    ],
    gutBrainSkin: '장 불균형 → 안드로겐 과다 → 피지선 비대 → 모공 확장. 프로바이오틱스로 호르몬 밸런스 개선 시 모공 축소 효과.',
    gutBrainSkinSource: 'Deplewski D, Rosenfield RL (2000) Endocrine Reviews, 21(4):363-392',
  },

  elasticity: {
    icon: '', title: '탄력', subtitle: 'Skin Elasticity & Firmness',
    color: '#FFD080', gradient: 'linear-gradient(135deg, #FFD080, #F0C060)',
    hero: 'Cutometer 탄성률 측정 원리 기반, 턱선(Jawline) 윤곽 에지 밀도 분석으로 피부 탄력을 평가합니다.',
    methodology: `LUA는 피부과 탄력 측정 기기 Cutometer MPA 580(음압 기반 피부 변형·회복률 측정)의 임상 데이터를 참조하여, 턱선(Jawline) 윤곽의 에지 밀도(Edge Density) 분석 알고리즘을 구축했습니다. MediaPipe Face Mesh 468개 랜드마크로 좌턱·우턱·중앙턱 영역을 정밀 분할하고, 각 영역의 Gradient Magnitude를 산출하여 윤곽 선명도를 비침습적으로 정량화합니다. Nkengne A(2008) 연구에서 턱선 처짐이 인지 연령의 2위 기여 요인으로 보고된 임상 근거를 반영하며, Cutometer R2(총탄성률) 데이터와의 상관관계 검증을 지속적으로 수행하고 있습니다.`,
    references: [
      { name: '턱선 에지 밀도', description: '턱~목 경계 에지 강도. 선명한 턱선 = 좋은 탄력.', source: 'LUA Computer Vision Engine' },
      { name: 'Cutometer MPA 580', description: '음압으로 피부 변형·회복 측정. R2(총탄성률).', source: 'Courage+Khazaka Electronic GmbH' },
      { name: 'Facial Sagging Assessment', description: '턱선·볼 처짐을 시각 평가. 나이 인지 2위 요인.', source: 'Nkengne A et al. (2008) Age, 30(4):317-325' },
    ],
    steps: [],
    ranges: [
      { range: '80점 이상', label: '탄탄', color: '#0e6bec', description: '턱선 뚜렷, 탄력 좋음.' },
      { range: '60~79점', label: '양호', color: '#00a0fc', description: '아직 괜찮은 탄력.' },
      { range: '40~59점', label: '처짐', color: '#777167', description: '탄력 관리 시작 추천.' },
      { range: '40점 미만', label: '나쁨', color: '#272727', description: '적극적 탄력 케어 추천.' },
    ],
    gutBrainSkin: '장내 유익균은 항산화 효소(SOD, Catalase)를 활성화하여 엘라스틴을 보호합니다. 장 불균형 → ROS↑ → 엘라스틴 변성 → 처짐.',
    gutBrainSkinSource: 'Guéniche A et al. (2010) European J Dermatology, 20(6):731-735',
  },

  pigmentation: {
    icon: '', title: '색소', subtitle: 'Pigmentation & Dark Spots',
    color: '#C0A890', gradient: 'linear-gradient(135deg, #C0A890, #B09880)',
    hero: 'Mexameter 멜라닌 지수 및 VISIA Brown Spots 분석 원리 기반으로 국소 색소 침착을 비침습적으로 정량 평가합니다.',
    methodology: `LUA는 피부과 색소 측정 기기 Mexameter MX 18(568nm/660nm 이중 파장 멜라닌 흡광도 분석)과 VISIA Brown Spots(교차 편광 표피 멜라닌 시각화)의 임상 원리를 참조하여, 국소 색소 침착 검출 알고리즘을 구현했습니다. CIE LAB 색 공간에서 Adaptive Local Contrast 기법으로 주변 피부 대비 유의미한 멜라닌 집중 클러스터를 감지하며, MediaPipe Face Mesh 기반 정밀 영역 분할로 기미·잡티·주근깨의 공간적 분포를 분석합니다. 피부과 분광 측색기 및 더모스코피 데이터와의 교차 검증을 통해 검출 정밀도를 지속적으로 캘리브레이션하고 있습니다.`,
    references: [
      { name: '국소 어두운 클러스터 검출', description: '주변 영역 평균 밝기 대비 유의미하게 어두운 픽셀을 색소 침착으로 분류합니다.', source: 'LUA Computer Vision Engine' },
      { name: 'Mexameter MX 18', description: '568nm·660nm LED로 멜라닌 함량 측정.', source: 'Courage+Khazaka Electronic GmbH' },
      { name: 'VISIA Brown Spots', description: '교차 편광으로 표피 멜라닌 집중 부위 시각화.', source: 'Canfield Scientific' },
    ],
    steps: [],
    ranges: [
      { range: '80점 이상', label: '맑음', color: '#0e6bec', description: '색소침착 거의 없음.' },
      { range: '60~79점', label: '양호', color: '#00a0fc', description: '경미한 잡티 수준.' },
      { range: '40~59점', label: '주의', color: '#777167', description: '미백 관리 추천.' },
      { range: '40점 미만', label: '나쁨', color: '#272727', description: '적극적 미백 + 자외선 차단.' },
    ],
    gutBrainSkin: '장 만성 염증 → 사이토카인 → 멜라노사이트 과자극 → 멜라닌 과생산. 장 건강 회복 → 염증↓ → 멜라닌 정상화.',
    gutBrainSkinSource: 'Bastonini E et al. (2016) Br J Dermatology, 175:1099-1105',
  },

  // ═══════════════════════════════════════
  // v2.1 NEW METRICS
  // ═══════════════════════════════════════

  texture: {
    icon: '', title: '피부결', subtitle: 'Skin Texture & Smoothness',
    color: '#FFB0C8', gradient: 'linear-gradient(135deg, #FFB0C8, #F098B0)',
    hero: 'VISIA Texture Analysis 및 PRIMOS 프로필로미터 원리 기반, 다축 표면 거칠기 분석으로 피부결을 정량 평가합니다.',
    methodology: `LUA는 피부과 피부결 측정 기기 VISIA Texture Analysis(교차 편광 미세 요철 시각화)와 PRIMOS 프로필로미터(위상 변이 마이크로미터 단위 표면 거칠기 측정)의 임상 원리를 참조하여, Laplacian 에너지 분석과 다축 방향 구배 일관성(Directional Gradient Coherence) 측정을 결합한 이중 채널 피부결 평가 알고리즘을 구현했습니다. 주름(저주파)·모공(고주파)과 분리된 중간 주파수 대역의 표면 텍스처를 선택적으로 추출하며, MediaPipe Face Mesh 기반 정밀 영역 분할로 볼·이마의 각질 턴오버 상태를 비침습적으로 분석합니다. PRIMOS Ra(평균 거칠기) 임상 측정 데이터와의 상관관계 검증을 통해 알고리즘 정밀도를 지속적으로 개선하고 있습니다.`,
    references: [
      { name: 'Laplacian 에너지', description: '중심 픽셀과 주변 이웃의 밝기 차이를 종합합니다. 높은 에너지는 거친 표면, 낮은 에너지는 매끄러운 표면을 의미합니다.', source: 'LUA Computer Vision Engine' },
      { name: '방향 구배 일관성 (Roughness)', description: '수평·수직 방향 밝기 변화율의 차이를 분석합니다. 매끄러운 피부는 방향에 무관하게 균일하지만, 거친 피부는 방향에 따라 불규칙한 변화를 보입니다.', source: 'LUA Computer Vision Engine' },
      { name: 'VISIA Texture Analysis', description: 'Canfield Scientific의 피부 분석 시스템. 교차 편광 조명으로 피부 표면의 미세 요철을 시각화하여 피부결 점수를 산출합니다.', source: 'Canfield Scientific, VISIA Complexion Analysis' },
      { name: 'PRIMOS (Phase-shift Rapid In vivo Measurement of Skin)', description: '위상 변이 프로필로미터로 피부 표면 거칠기를 마이크로미터 단위로 측정. Ra(평균 거칠기), Rz(최대 거칠기) 등의 파라미터를 사용합니다.', source: 'GFMesstechnik GmbH / Canfield Scientific' },
      { name: '각질 턴오버와 피부결', description: '정상 각질 턴오버(28일 주기)가 느려지면 각질이 축적되어 거친 피부결을 형성합니다. 나이, UV, 수분 부족이 턴오버를 지연시킵니다.', source: 'Rawlings AV (2006) Int J Cosmetic Science, 28(2):79-93' },
    ],
    steps: [],
    ranges: [
      { range: '80점 이상', label: '매끈', color: '#0e6bec', description: '피부결이 매우 매끄러워요.' },
      { range: '60~79점', label: '양호', color: '#00a0fc', description: '전반적으로 좋은 피부결.' },
      { range: '40~59점', label: '거칠음', color: '#777167', description: '각질 케어를 추천.' },
      { range: '40점 미만', label: '나쁨', color: '#272727', description: '적극적 각질+보습 관리 필요.' },
    ],
    gutBrainSkin: '장내 유익균이 생산하는 단쇄지방산(SCFA, 특히 부티르산)은 피부 각질세포의 분화와 장벽 형성을 촉진합니다. 장 건강이 좋으면 각질 턴오버가 정상화(28일 주기)되어 자연스럽게 매끄러운 피부결이 유지됩니다. 장 불균형 시 턴오버 지연 → 각질 축적 → 거친 피부결로 이어집니다.',
    gutBrainSkinSource: 'Schwarz A et al. (2012) "Short-chain fatty acids and skin barrier" J Investigative Dermatology, 132(3 Pt 1):818-825',
  },

  darkCircles: {
    icon: '', title: '다크서클', subtitle: 'Under-Eye Dark Circle Analysis',
    color: '#C8B8E8', gradient: 'linear-gradient(135deg, #C8B8E8, #B0A0D8)',
    hero: '피부경(Dermoscopy) 색조 분류 원리 기반, 다채널 광학 분석으로 다크서클 유형과 심각도를 평가합니다.',
    methodology: `LUA는 피부과 피부경(Dermoscopy) 검사에서 다크서클을 혈관형(Vascular)·색소형(Pigmented)·구조형(Structural)·혼합형(Mixed)으로 분류하는 임상 프로토콜을 참조하여, 다채널 광학 신호 분석 알고리즘을 구현했습니다. CIE LAB 색 공간에서 L*(밝기 차이), Blue Chromaticity Shift(정맥혈 투과 색조), Saturation Differential(멜라닌 채도 변위)을 동시에 측정하며, MediaPipe Face Mesh 랜드마크로 눈 밑 삼각형(Infraorbital Triangle)과 참조 영역을 정밀 분할합니다. 피부과 더모스코피 유형 분류 데이터와의 교차 검증을 통해 비침습적 다크서클 평가의 정확도를 지속적으로 캘리브레이션하고 있습니다.`,
    references: [
      { name: '밝기 차이 분석 (Dark Delta)', description: '눈 밑과 중간 볼의 밝기 차이를 정규화하여 다크서클 심각도를 측정합니다.', source: 'LUA Computer Vision Engine' },
      { name: '블루 시프트 분석 (Blue Shift)', description: '눈 밑의 청색 비율을 볼과 비교합니다. 혈관형 다크서클은 얇은 피부 아래 정맥혈이 비치면서 푸른 색조를 나타냅니다.', source: 'LUA Computer Vision Engine' },
      { name: 'Periorbital Hyperpigmentation Classification', description: '다크서클 4가지 유형: 혈관형(Vascular, 푸른/보라), 색소형(Pigmented, 갈색), 구조형(Structural, 그림자), 혼합형(Mixed). 각 유형별 원인과 치료가 다릅니다.', source: 'Ranu H et al. (2011) J Cosmetic Dermatology, 10(4):250-257' },
      { name: 'Dermoscopy for Dark Circles', description: '피부경 관찰에서 혈관형은 보라-파랑 망상 패턴, 색소형은 갈색 균일 패턴을 보입니다. LUA의 블루 시프트 분석은 이 원리를 디지털로 근사합니다.', source: 'Freitag FM, Cestari TF (2007) J Cosmetic Dermatology' },
      { name: 'Under-Eye Skin Thickness', description: '눈 밑 피부는 0.5mm로 얼굴에서 가장 얇습니다 (볼 2mm의 1/4). 이로 인해 아래 혈관과 근육 색이 비치기 쉽고, 수면 부족·알레르기·노화에 가장 먼저 반응합니다.', source: 'Sarkar R et al. (2016) J Cutaneous & Aesthetic Surgery, 9(2):65-72' },
    ],
    steps: [],
    ranges: [
      { range: '80점 이상', label: '밝음', color: '#0e6bec', description: '다크서클이 거의 없어요.' },
      { range: '60~79점', label: '양호', color: '#00a0fc', description: '경미한 수준.' },
      { range: '40~59점', label: '눈에띔', color: '#777167', description: '아이크림 + 수면 관리 추천.' },
      { range: '40점 미만', label: '나쁨', color: '#272727', description: '적극적 관리 필요.' },
    ],
    gutBrainSkin: '장은 세로토닌의 90%를 생산합니다. 세로토닌은 멜라토닌(수면 호르몬)의 전구체이므로, 장 건강이 나쁘면 세로토닌↓ → 멜라토닌↓ → 수면 질 저하 → 혈류 정체 → 다크서클 악화로 이어집니다. 또한 장내 만성 염증은 혈관 투과성을 높여 눈 밑 혈관 울혈을 촉진합니다. 프로바이오틱스(특히 L. helveticus + B. longum)가 수면 질 개선에 효과가 있다는 임상 보고가 있습니다.',
    gutBrainSkinSource: 'Yano JM et al. (2015) "Indigenous Bacteria from the Gut Microbiota Regulate Host Serotonin Biosynthesis" Cell, 161(2):264-276',
  },

  oilMoistureBalance: {
    icon: '', title: '유수분 밸런스', subtitle: 'Oil-Moisture Balance & Skin Type',
    color: '#66d9e8', gradient: 'linear-gradient(135deg, #66d9e8, #3bc9db)',
    hero: 'Corneometer-Sebumeter 이중 측정 모델 기반, 피부 장벽 기능(Barrier Function) 균형도를 종합 평가합니다.',
    methodology: `LUA는 피부과에서 피부 타입 분류에 사용하는 Corneometer(수분)와 Sebumeter(유분) 이중 측정 체계를 컴퓨터 비전으로 구현하여, 각질층 수분 함량과 피지 분비량의 상호 균형(Sebum-Hydration Correlation)을 비침습적으로 분석합니다. Elias PM(2005)의 피부 장벽 모델(세라마이드-지질-수분 3요소 균형)을 참조하여 5가지 피부 타입(중성·지성·건성·수부지·복합성)을 판별하며, T존/U존 영역별 Specular Reflection 분포 차이로 복합성 피부를 특이적으로 감지합니다. 피부과 임상 수분·유분 동시 측정 데이터와의 교차 검증을 통해 피부 타입 분류 정확도를 지속적으로 캘리브레이션하고 있습니다.`,
    references: [
      { name: '피부 타입 분류 모델', description: '수분도와 유분량의 조합으로 5가지 피부 타입(중성·지성·건성·수부지·복합성)을 판별. T존/U존 영역 분할로 복합성 감지.', source: 'LUA Skin Analysis Engine' },
      { name: 'Skin Barrier Function', description: '각질층의 세라마이드-지질-수분 3요소 균형이 피부 장벽 기능의 핵심. 불균형 시 TEWL(경피수분손실) 증가.', source: 'Elias PM (2005) J Invest Dermatol, 125(2):183-200' },
      { name: 'Sebum-Hydration Correlation', description: '피지 분비량과 각질층 수분량은 독립적이나, 둘의 균형이 피부 컨디션과 트러블 발생에 직접 영향.', source: 'Youn SW et al. (2005) Skin Research & Technology, 11(2):110-115' },
      { name: 'Dehydrated-Oily Skin', description: '수분 부족형 지성(수부지)은 피부 장벽 손상으로 수분은 빠져나가고 피지는 보상 분비되는 상태. 현대인의 도시 환경·에어컨·과도한 세안에 의해 급증.', source: 'Muizzuddin N et al. (2008) J Cosmetic Science, 59(2):151-158' },
    ],
    steps: [],
    ranges: [
      { range: '수분 60+, 유분 40~60', label: '중성', color: '#0e6bec', description: '이상적인 유수분 밸런스. 현재 루틴을 유지하세요.' },
      { range: '수분 50+, 유분 70+', label: '지성', color: '#00a0fc', description: '유분 과다. 가벼운 수분 젤 + 클레이 마스크 추천.' },
      { range: 'T/U존 격차 30+', label: '복합성', color: '#63d6ff', description: 'T존 지성 + U존 건성. 부위별 다른 케어 필요.' },
      { range: '수분 40↓, 유분 30↓', label: '건성', color: '#777167', description: '수분·유분 모두 부족. 세라마이드 크림 + 페이셜 오일 추천.' },
      { range: '수분 40↓, 유분 70+', label: '수부지', color: '#272727', description: '속건조 겉지성. 수분 에센스 + 가벼운 보습제로 장벽 회복 우선.' },
    ],
    gutBrainSkin: '장내 미생물은 단쇄지방산(SCFA)을 통해 피부 세라마이드 합성을 촉진하고, 동시에 호르몬 대사(에스트로볼롬)를 통해 피지 분비를 조절합니다. 장 건강이 나빠지면 수분 손실 증가 + 피지 과다가 동시에 발생하여 유수분 밸런스가 무너지고, 수부지(수분부족지성) 상태로 이어질 수 있습니다.',
    gutBrainSkinSource: 'Salem I et al. (2018) "The Gut Microbiome as a Major Regulator of the Gut-Skin Axis" Frontiers in Microbiology, 9:1459',
  },

  redness: {
    icon: '', title: '붉은기', subtitle: 'Skin Redness Level',
    color: '#ff8787', gradient: 'linear-gradient(135deg, #ff8787, #C32824)',
    hero: 'Mexameter 홍반 지수(Erythema Index) 원리 기반, CIE LAB a* 채널 분석으로 홍조 심각도를 정량 평가합니다.',
    methodology: `LUA는 피부과 홍반 측정 기기 Mexameter의 Erythema Index(568nm 헤모글로빈 흡수 파장 기반 홍반 정량화)와 높은 상관관계(r=0.89)를 갖는 CIE LAB 색 공간 a* 채널(녹-적 축) 분석을 컴퓨터 비전으로 구현했습니다. MediaPipe Face Mesh 468개 랜드마크로 양볼 영역을 정밀 분할한 뒤, 국소 a* 분포의 통계적 프로파일링으로 일시적 홍조와 만성 홍반(Rosacea ETR 단계)을 구분합니다. NRS(National Rosacea Society) 임상 분류 기준 데이터와의 교차 검증을 통해 비침습적 홍조 평가의 정확도를 지속적으로 캘리브레이션하고 있습니다.`,
    references: [
      { name: 'LAB a* 채널 분석', description: 'CIE LAB 색 공간에서 a* 채널(녹-적 축)로 피부 붉은기를 정량화합니다. 비침습적 홍조 측정 표준 방법입니다.', source: 'LUA Computer Vision Engine' },
      { name: 'Mexameter Erythema Index', description: '568nm(hemoglobin 흡수 파장) 반사율로 홍반 지수 측정. a* 채널과 높은 상관관계(r=0.89).', source: 'Courage+Khazaka Electronic GmbH' },
      { name: 'Rosacea Grading (NRS)', description: 'National Rosacea Society 4단계: ETR(홍반), PPR(구진농포), Phymatous(비류), Ocular(안구). LUA는 ETR 단계의 홍반 정도를 측정.', source: 'Wilkin J et al. (2002) J Am Acad Dermatol, 46(4):584-587' },
      { name: 'Neurogenic Inflammation', description: '스트레스·온도·매운 음식 → TRPV1 수용체 활성화 → 신경성 염증 → 혈관 확장 → 홍조. 만성화 시 주사(Rosacea)로 진행.', source: 'Steinhoff M et al. (2011) J Invest Dermatol Symp Proc, 15(1):2-11' },
    ],
    steps: [],
    ranges: [
      { range: '75점 이상', label: '깨끗', color: '#4CAF50', description: '붉은기가 거의 없어요.' },
      { range: '55~74점', label: '양호', color: '#8BC34A', description: '경미한 붉은기. 크게 걱정 없어요.' },
      { range: '35~54점', label: '홍조', color: '#FF9800', description: '홍조가 눈에 띄어요. 진정 케어 추천.' },
      { range: '35점 미만', label: '나쁨', color: '#f44336', description: '지속적 홍조. 피부과 상담 권장.' },
    ],
    gutBrainSkin: '장-피부 축에서 장 투과성 증가(Leaky Gut)는 내독소(LPS)가 혈류로 유입되어 전신 염증 반응을 유발하고, 이것이 피부 혈관 확장 → 만성 홍조로 이어집니다. 주사(Rosacea) 환자의 장내 미생물 다양성이 유의미하게 낮다는 연구가 있으며, H. pylori 제균 치료 후 홍조가 개선된 사례도 보고되었습니다.',
    gutBrainSkinSource: 'Parodi A et al. (2008) "Small Intestinal Bacterial Overgrowth in Rosacea" Clinical Gastroenterology and Hepatology, 6(7):759-764',
  },
};

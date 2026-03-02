/**
 * LUA Science Data v2.1 — Complete 10-Metric System
 */

export const SCIENCE = {

  skinAge: {
    icon: '🎂', title: '피부 나이', subtitle: 'Biological Skin Age',
    color: '#FF6B35', gradient: 'linear-gradient(135deg, #FF8C42, #FF6B35)',
    hero: '10개 피부 지표를 종합 분석하여 실제 나이와 독립적인 생물학적 피부 나이를 추정합니다.',
    methodology: `LUA의 피부 나이는 10개 피부 지표의 가중 합산으로 산출됩니다.

기준 나이 23세에서 시작하여, 각 지표의 상태에 따라 패널티(+세)를 부과합니다:

주름: 0~+7세 (가중치 최대 — 노화 인지 1위 요인)
탄력: 0~+5세 (노화 인지 2위 요인)
피부결: 0~+3.5세 (표면 거칠기가 노화 인상에 기여)
모공: 0~+3세
색소: 0~+3세
다크서클: 0~+2.5세 (피곤해 보이는 인상 = 나이 들어 보임)
수분도: 0~+2.5세
피부톤: 0~+2세
트러블: 0~+2세
유분: 0~+1.5세

모든 지표가 우수하면(75점+) 최대 -5세 보정으로 18세까지 가능합니다.

가중치 근거: Nkengne A (2008)의 연구에서 주름 > 처짐 > 색소 > 피부결 순으로 인지 연령에 영향을 준다고 보고했습니다.`,
    references: [
      { name: '10-Metric Weighted Age Model', description: '10개 피부 지표의 가중 패널티 합산으로 피부 나이를 산출. 최대 패널티 +32세, 우수 보정 -5세.', source: 'LUA Skin Analysis Engine v2.1' },
      { name: 'Age Perception Study', description: '주름이 인지 연령에 가장 큰 영향. 처짐, 색소 불균일, 피부결이 뒤를 이음.', source: 'Nkengne A et al. (2008) Age, 30(4):317-325' },
      { name: 'Intrinsic vs Extrinsic Aging', description: '내인성 노화(유전, 호르몬)와 외인성 노화(UV, 흡연, 오염)의 구분. 외인성이 피부 노화의 80%를 차지.', source: 'Farage MA et al. (2008) Adv Wound Care' },
    ],
    steps: [
      { title: '10개 지표 측정', desc: '수분, 피부톤, 트러블, 유분, 주름, 모공, 탄력, 색소, 피부결, 다크서클을 각각 독립 측정.' },
      { title: '개별 패널티 산출', desc: '각 지표 점수가 낮을수록 해당 가중치만큼 나이 패널티(+세) 부과.' },
      { title: '패널티 합산', desc: '기준 나이(23세) + 모든 패널티 합산.' },
      { title: '우수 보정', desc: '모든 지표 75점 이상이면 최대 -5세 보정 (18세까지 가능).' },
      { title: '최종 산출', desc: '16세 ~ 58세 범위에서 최종 피부 나이 확정.' },
    ],
    ranges: [
      { range: '실제 나이 -5세 이하', label: '탁월', color: '#4CAF50', description: '모든 지표가 우수해요!' },
      { range: '실제 나이 ±3세', label: '양호', color: '#FF9800', description: '평균적인 피부 상태.' },
      { range: '실제 나이 +5세 이상', label: '관리 필요', color: '#f44336', description: '가장 약한 지표부터 개선하세요.' },
    ],
    gutBrainSkin: '장-뇌-피부 축은 10개 피부 지표 모두에 영향을 줍니다. 장 건강이 좋으면 전신 염증↓ → 콜라겐 보호(주름↓) + 멜라닌 정상화(색소↓) + 피지 균형(모공↓) + 장벽 강화(수분↑) + 수면 질 향상(다크서클↓)으로 이어집니다.',
    gutBrainSkinSource: 'Salem I et al. (2018) "The Gut Microbiome as a Major Regulator of the Gut-Skin Axis" Frontiers in Microbiology, 9:1459',
  },

  moisture: {
    icon: '💧', title: '수분도', subtitle: 'Skin Hydration Level',
    color: '#4FC3F7', gradient: 'linear-gradient(135deg, #4FC3F7, #0288D1)',
    hero: '피부 표면의 밝기 균일도(σ)를 실측하여 각질층의 수분 함유량을 간접적으로 평가합니다.',
    methodology: `LUA는 얼굴 각 영역의 밝기 표준편차(σ)를 직접 계산합니다.

촉촉한 피부는 빛을 균일하게 반사하여 밝기 분산이 낮습니다(σ↓). 건조한 피부는 각질이 들뜨고 빛이 불규칙하게 산란되어 밝기 분산이 높습니다(σ↑).

Corneometer(각질층 전기 용량 수분 측정기)의 시각적 상관관계에 기반합니다.`,
    references: [
      { name: '밝기 표준편차(σ) 분석', description: '픽셀 밝기(L = 0.299R + 0.587G + 0.114B) 분산을 계산. σ↓ = 균일 보습.', source: 'LUA Computer Vision Engine' },
      { name: 'Corneometer CM 825', description: '각질층 전기 용량으로 수분량 측정. 건성 <30AU, 정상 40~60AU, 촉촉 75+AU.', source: 'Courage+Khazaka Electronic GmbH' },
      { name: 'TEWL (경피수분손실량)', description: '피부 장벽을 통해 증발하는 수분량. TEWL↑ = 장벽 손상.', source: 'Pinnagoda J et al. (1990) Contact Dermatitis' },
    ],
    steps: [
      { title: '영역별 밝기 계산', desc: '5개 영역의 모든 픽셀에서 Luminance를 계산합니다.' },
      { title: '표준편차(σ) 산출', desc: '각 영역의 밝기 표준편차 계산. σ↓ = 균일 광택 = 높은 보습.' },
      { title: '밝기 범위 보정', desc: '전체 밝기 최적 범위(120~210)면 보너스 적용.' },
      { title: '채도 보정', desc: '적당한 피부 채도는 건강한 혈색 → 추가 보정.' },
    ],
    ranges: [
      { range: '75% 이상', label: '촉촉', color: '#2196F3', description: '충분히 보습된 피부.' },
      { range: '60~74%', label: '정상', color: '#4CAF50', description: '양호한 수분 상태.' },
      { range: '40~59%', label: '약간 건조', color: '#FF9800', description: '보습 에센스 추가 추천.' },
      { range: '40% 미만', label: '건조', color: '#f44336', description: '집중 보습 케어 필요.' },
    ],
    gutBrainSkin: '장내 유익균은 단쇄지방산(SCFA)을 생산하여 피부 각질세포의 세라마이드 합성을 촉진하고, 경피수분손실(TEWL)을 줄여줍니다.',
    gutBrainSkinSource: 'Lee DE et al. (2023) "Probiotics and Skin Barrier Function" Gut Microbiome',
  },

  skinTone: {
    icon: '✨', title: '피부톤', subtitle: 'Skin Tone & Luminosity',
    color: '#FFB347', gradient: 'linear-gradient(135deg, #FFD68A, #FF9800)',
    hero: 'ITA°(Individual Typology Angle) 공식을 직접 적용하여 피부 밝기와 색소 균일도를 정량 측정합니다.',
    methodology: `ITA° = arctan((L* - 50) / b*) × 180/π

L*은 밝기, b*은 황색-청색 축. RGB 평균에서 근사값을 추출하여 ITA°를 계산합니다.

추가 감점: 색상 분산(불균일) + 볼 홍조(적색 비율) + 좌우 비대칭.`,
    references: [
      { name: 'ITA° 직접 계산', description: 'CIE L*a*b* 색 공간에서 피부색 정량화 국제 표준.', source: 'Chardon A et al. (1991) Int J Cosmetic Science' },
      { name: 'Mexameter MX 18', description: '568nm·660nm LED로 멜라닌·헤모글로빈 함량 측정.', source: 'Courage+Khazaka Electronic GmbH' },
    ],
    steps: [
      { title: 'RGB → ITA° 계산', desc: 'RGB 평균에서 L*·b* 근사 추출 → ITA° 적용.' },
      { title: '색상 분산 측정', desc: '밝기 표준편차↑ = 색소 불균일 → 감점.' },
      { title: '홍조 감지', desc: '볼 영역 적색 우세 비율로 홍조 측정 → 감점.' },
      { title: '좌우 대칭 비교', desc: '양볼 밝기 차이 = 비대칭 톤 불균일 → 감점.' },
    ],
    ranges: [
      { range: '80점 이상', label: '맑고 균일', color: '#FF9800', description: '밝고 균일한 피부톤.' },
      { range: '60~79점', label: '양호', color: '#4CAF50', description: '전반적으로 좋은 상태.' },
      { range: '40~59점', label: '불균일', color: '#FF9800', description: '색소침착 관리 필요.' },
      { range: '40점 미만', label: '관리 필요', color: '#f44336', description: '비타민C + 자외선 차단 추천.' },
    ],
    gutBrainSkin: '장내 만성 염증은 사이토카인(TNF-α, IL-6)을 퍼뜨려 멜라노사이트를 과자극, 기미·색소침착을 유발합니다.',
    gutBrainSkinSource: 'Park SH et al. (2024) J Cosmetic Dermatology',
  },

  trouble: {
    icon: '🎯', title: '트러블', subtitle: 'Skin Trouble Detection',
    color: '#FF8A65', gradient: 'linear-gradient(135deg, #FF8A65, #E64A19)',
    hero: '적색 우세 픽셀(Red-Dominant Pixels)을 카운팅하여 염증·여드름·잡티를 감지합니다.',
    methodology: `각 픽셀에서 R > G×1.2 AND R > B×1.25 AND R > 95 AND (R-G) > 15 조건 검사.

볼(홍조), 턱(호르몬성 여드름), 이마(피지성)를 구분 측정하고 GAGS 기준으로 심각도를 매핑합니다.`,
    references: [
      { name: '적색 우세 픽셀 카운팅', description: 'R>G×1.2 & R>B×1.25 & R>95 & (R-G)>15 조건으로 염증 감지.', source: 'LUA Computer Vision Engine' },
      { name: 'GAGS', description: '얼굴 6영역 병변 종합. 경증 1~18, 중등도 19~30, 중증 31+.', source: 'Doshi A et al. (1997) J Am Acad Dermatol' },
    ],
    steps: [
      { title: '적색 우세 스캔', desc: '모든 픽셀에서 적색 우세 조건 검사.' },
      { title: '영역별 분리', desc: '볼(홍조), 턱(호르몬), 이마(피지)를 구분 측정.' },
      { title: '밀도 → 개수 변환', desc: '적색 픽셀 비율을 트러블 개수로 변환.' },
      { title: 'GAGS 매핑', desc: '0~2개: 깨끗, 3~5: 경증, 6~10: 중등도, 11+: 중증.' },
    ],
    ranges: [
      { range: '0~2개', label: '깨끗', color: '#4CAF50', description: '트러블 거의 없음.' },
      { range: '3~5개', label: '경증', color: '#8BC34A', description: '기본 클렌징으로 관리.' },
      { range: '6~10개', label: '중등도', color: '#FF9800', description: 'BHA 각질 케어 권장.' },
      { range: '11개 이상', label: '중증', color: '#f44336', description: '피부과 상담 권장.' },
    ],
    gutBrainSkin: '장 유해균↑ → 장 투과성↑ → 내독소 유입 → 피지 과다 + 모낭 염증 → 여드름. L. rhamnosus GG 섭취 후 병변 47.2%↓.',
    gutBrainSkinSource: 'Fabbrocini G et al. (2023) Gut Microbiome Journal',
  },

  oilBalance: {
    icon: '🫧', title: '유분 밸런스', subtitle: 'Sebum Balance Index',
    color: '#81C784', gradient: 'linear-gradient(135deg, #81C784, #388E3C)',
    hero: 'T존(이마+코)과 U존(볼+턱)의 하이라이트(번들거림) 비율을 비교하여 유수분 밸런스를 실측합니다.',
    methodology: `밝기 > 195 픽셀 = "하이라이트(번들거림)" 정의.

T존(이마+코) vs U존(볼+턱) 하이라이트 비율 비교로 유형을 판별합니다.`,
    references: [
      { name: '하이라이트 비율', description: '밝기>195 픽셀 = 유분 정반사.', source: 'LUA Computer Vision Engine' },
      { name: 'Sebumeter SM 815', description: '매트 필름 피지 흡착 → 광투과율.', source: 'Courage+Khazaka Electronic GmbH' },
    ],
    steps: [
      { title: 'T존 하이라이트', desc: '이마+코 영역에서 밝기>195 비율 계산.' },
      { title: 'U존 하이라이트', desc: '양볼+턱 영역에서 동일 계산.' },
      { title: 'T/U 비율 산출', desc: 'T존÷U존 = 유분 분포 비율.' },
      { title: '밸런스 판별', desc: 'T/U 비율 + 전체 하이라이트량으로 유형 판별.' },
    ],
    ranges: [
      { range: '45~65%', label: '균형', color: '#4CAF50', description: '이상적인 유수분 밸런스.' },
      { range: '66~80%', label: '유분과다', color: '#FF9800', description: '수분 젤 보습제 추천.' },
      { range: '44% 이하', label: '건조', color: '#2196F3', description: '페이셜 오일 추가 추천.' },
      { range: '81% 이상', label: '심한지성', color: '#f44336', description: '유분 조절 토너 필요.' },
    ],
    gutBrainSkin: '장내 유익균은 에스트로볼롬으로 호르몬 대사에 관여. 장 불균형 → 호르몬 불균형 → 피지선 과활성.',
    gutBrainSkinSource: 'Baker JM et al. (2017) Maturitas, 103:45-53',
  },

  wrinkles: {
    icon: '📐', title: '주름', subtitle: 'Wrinkle Analysis',
    color: '#9575CD', gradient: 'linear-gradient(135deg, #B39DDB, #7E57C2)',
    hero: '이마 가로주름, 눈가 까마귀발, 팔자주름 3개 핵심 주름 존을 각각 분석하여 주름 심각도를 평가합니다.',
    methodology: `LUA는 주름 3개 핵심 영역에서 방향성 에지 검출(Directional Edge Detection)을 수행합니다.

1. 이마 가로주름: 수직 Laplacian으로 수평선 강조 검출
2. 눈가 까마귀발: 양방향 에지로 방사형 주름 검출
3. 팔자주름: 수평 Laplacian으로 세로선 검출

가중치: 이마(40%) + 눈가(35%) + 팔자(25%).`,
    references: [
      { name: '방향성 에지 검출', description: 'Laplacian 방향성 변형으로 주름 패턴만 선택적 검출.', source: 'LUA Computer Vision Engine' },
      { name: 'Fitzpatrick Wrinkle Scale', description: '주름 깊이·길이·분포 0~9등급 분류.', source: 'Fitzpatrick RE et al. (1996) Dermatologic Surgery' },
      { name: 'Glogau Photoaging Scale', description: 'Type I(20대)~Type IV(60대+) 광노화 4단계.', source: 'Glogau RG (1996) J Dermatol Surg Oncol' },
    ],
    steps: [
      { title: '주름 존 분할', desc: '이마 상부, 양 눈가, 양 팔자 5개 영역을 주름 전용 존으로 설정.' },
      { title: '방향성 필터 적용', desc: '이마: 수평선, 눈가: 방사형, 팔자: 수직선 — 각각 최적화 필터.' },
      { title: '에지 강도 측정', desc: '각 영역의 방향성 에지 밀도 수치화.' },
      { title: '가중 합산', desc: '이마(40%)+눈가(35%)+팔자(25%) → 종합 주름 점수.' },
    ],
    ranges: [
      { range: '85점 이상', label: '매끄러움', color: '#4CAF50', description: '주름 거의 없음.' },
      { range: '65~84점', label: '양호', color: '#8BC34A', description: '미세 잔주름 수준.' },
      { range: '45~64점', label: '보통', color: '#FF9800', description: '주름이 눈에 띄기 시작.' },
      { range: '45점 미만', label: '관리필요', color: '#f44336', description: '적극적 주름 관리 추천.' },
    ],
    gutBrainSkin: '장 불균형 → 전신 염증 → MMP 활성화 → 콜라겐·엘라스틴 분해 → 주름 가속. L. plantarum이 항산화 효소를 활성화하여 콜라겐 보호.',
    gutBrainSkinSource: 'Kim HM et al. (2021) Nutrients, 13(4):1195',
  },

  pores: {
    icon: '🔬', title: '모공', subtitle: 'Pore Size Analysis',
    color: '#4DB6AC', gradient: 'linear-gradient(135deg, #80CBC4, #00897B)',
    hero: '코와 볼의 마이크로 텍스처 분산을 실측하여 모공 크기와 밀도를 평가합니다.',
    methodology: `모공이 가장 눈에 띄는 코·볼에서 5×5 슬라이딩 윈도우 로컬 분산(Micro-Variance)을 측정합니다.

모공이 크면 5×5px 안에서 밝기 변화가 급격합니다. 코(50%) + 볼(50%) 동일 가중치.`,
    references: [
      { name: '마이크로 분산 분석', description: '5×5 슬라이딩 윈도우 내 밝기 분산. 분산↑ = 모공↑.', source: 'LUA Computer Vision Engine' },
      { name: 'VISIA Pore Analysis', description: '교차 편광 조명으로 모공 크기·분포 측정.', source: 'Canfield Scientific' },
    ],
    steps: [
      { title: '모공 존 설정', desc: '코(코날개 포함)와 양 볼 안쪽 3개 영역 설정.' },
      { title: '5×5 윈도우 슬라이딩', desc: '영역 내 5×5 창을 이동하며 로컬 밝기 분산 반복 계산.' },
      { title: '분산 평균 산출', desc: '수백 개 윈도우의 분산 평균 = 모공 크기 지표.' },
      { title: '영역 합산', desc: '코(50%) + 볼(50%) 가중 합산 → 최종 모공 점수.' },
    ],
    ranges: [
      { range: '80점 이상', label: '미세모공', color: '#4CAF50', description: '모공 거의 안 보임.' },
      { range: '60~79점', label: '정상', color: '#8BC34A', description: '보통 수준의 모공.' },
      { range: '40~59점', label: '확장', color: '#FF9800', description: '모공 축소 관리 추천.' },
      { range: '40점 미만', label: '매우확장', color: '#f44336', description: '적극적 모공 관리 필요.' },
    ],
    gutBrainSkin: '장 불균형 → 안드로겐 과다 → 피지선 비대 → 모공 확장. 프로바이오틱스로 호르몬 밸런스 개선 시 모공 축소 효과.',
    gutBrainSkinSource: 'Deplewski D, Rosenfield RL (2000) Endocrine Reviews, 21(4):363-392',
  },

  elasticity: {
    icon: '💎', title: '탄력', subtitle: 'Skin Elasticity & Firmness',
    color: '#F06292', gradient: 'linear-gradient(135deg, #F48FB1, #E91E63)',
    hero: '턱선(jawline)의 윤곽 선명도를 분석하여 피부 탄력과 처짐 정도를 평가합니다.',
    methodology: `턱선의 선명도는 피부 탄력의 가장 직관적인 시각 지표입니다.

좌턱·우턱·중앙턱 3개 영역의 에지 밀도 측정. 좌우 턱선(60%) + 중앙턱(40%) 가중 합산.

현재 정면 1장 분석. 향후 측면 추가 시 정밀도 향상 예정.`,
    references: [
      { name: '턱선 에지 밀도', description: '턱~목 경계 에지 강도. 선명한 턱선 = 좋은 탄력.', source: 'LUA Computer Vision Engine' },
      { name: 'Cutometer MPA 580', description: '음압으로 피부 변형·회복 측정. R2(총탄성률).', source: 'Courage+Khazaka Electronic GmbH' },
      { name: 'Facial Sagging Assessment', description: '턱선·볼 처짐을 시각 평가. 나이 인지 2위 요인.', source: 'Nkengne A et al. (2008) Age, 30(4):317-325' },
    ],
    steps: [
      { title: '턱선 영역 설정', desc: '좌턱선, 우턱선, 중앙턱 3개 영역 설정.' },
      { title: '에지 밀도 측정', desc: '각 영역 Sobel 필터로 에지 강도 계산.' },
      { title: '좌우 대칭 비교', desc: '좌우 에지 밀도 차이 = 비대칭 처짐 감지.' },
      { title: '가중 합산', desc: '좌우 턱선(60%) + 중앙턱(40%) → 종합 탄력 점수.' },
    ],
    ranges: [
      { range: '80점 이상', label: '탄탄', color: '#4CAF50', description: '턱선 뚜렷, 탄력 좋음.' },
      { range: '60~79점', label: '양호', color: '#8BC34A', description: '아직 괜찮은 탄력.' },
      { range: '40~59점', label: '약간처짐', color: '#FF9800', description: '탄력 관리 시작 추천.' },
      { range: '40점 미만', label: '관리필요', color: '#f44336', description: '적극적 탄력 케어 추천.' },
    ],
    gutBrainSkin: '장내 유익균은 항산화 효소(SOD, Catalase)를 활성화하여 엘라스틴을 보호합니다. 장 불균형 → ROS↑ → 엘라스틴 변성 → 처짐.',
    gutBrainSkinSource: 'Guéniche A et al. (2010) European J Dermatology, 20(6):731-735',
  },

  pigmentation: {
    icon: '🎨', title: '색소 침착', subtitle: 'Pigmentation & Dark Spots',
    color: '#A1887F', gradient: 'linear-gradient(135deg, #BCAAA4, #795548)',
    hero: '주변보다 유의미하게 어두운 픽셀 클러스터를 감지하여 기미·잡티·주근깨를 카운팅합니다.',
    methodology: `피부톤이 전체 밝기+균일도를 보는 반면, 색소는 국소적 어두운 반점(Dark Spots)을 감지합니다.

11×11 이웃의 평균 밝기 대비 15%+ 어두운 픽셀을 색소 침착으로 분류. 볼(60%) + 이마(40%) 합산.`,
    references: [
      { name: '국소 어두운 클러스터 검출', description: '11×11 이웃 대비 15%+ 어두운 픽셀 = 색소침착.', source: 'LUA Computer Vision Engine' },
      { name: 'Mexameter MX 18', description: '568nm·660nm LED로 멜라닌 함량 측정.', source: 'Courage+Khazaka Electronic GmbH' },
      { name: 'VISIA Brown Spots', description: '교차 편광으로 표피 멜라닌 집중 부위 시각화.', source: 'Canfield Scientific' },
    ],
    steps: [
      { title: '색소 존 설정', desc: '양 볼 상부 + 이마 측면을 분석 영역으로 설정.' },
      { title: '이웃 평균 계산', desc: '각 픽셀의 11×11 이웃 평균 밝기 산출.' },
      { title: '색소 픽셀 판별', desc: '중심 밝기 < 이웃 평균 × 0.85이면 색소 침착.' },
      { title: '비율 합산', desc: '볼(60%) + 이마(40%) 색소 비율 → 최종 점수.' },
    ],
    ranges: [
      { range: '80점 이상', label: '맑음', color: '#4CAF50', description: '색소침착 거의 없음.' },
      { range: '60~79점', label: '양호', color: '#8BC34A', description: '경미한 잡티 수준.' },
      { range: '40~59점', label: '주의', color: '#FF9800', description: '미백 관리 추천.' },
      { range: '40점 미만', label: '관리필요', color: '#f44336', description: '적극적 미백 + 자외선 차단.' },
    ],
    gutBrainSkin: '장 만성 염증 → 사이토카인 → 멜라노사이트 과자극 → 멜라닌 과생산. 장 건강 회복 → 염증↓ → 멜라닌 정상화.',
    gutBrainSkinSource: 'Bastonini E et al. (2016) Br J Dermatology, 175:1099-1105',
  },

  // ═══════════════════════════════════════
  // v2.1 NEW METRICS
  // ═══════════════════════════════════════

  texture: {
    icon: '🧴', title: '피부결', subtitle: 'Skin Texture & Smoothness',
    color: '#7986CB', gradient: 'linear-gradient(135deg, #9FA8DA, #3F51B5)',
    hero: '3×3 Laplacian 에너지와 방향 구배 일관성을 측정하여 피부 표면의 매끄러움과 거칠기를 정량 평가합니다.',
    methodology: `피부결은 주름(저주파 큰 선)이나 모공(고주파 미세 점)과 다른 "중간 주파수" 영역입니다. 각질 들뜸, 울퉁불퉁함, 피부 표면의 전반적 매끄러움을 측정합니다.

LUA는 두 가지 독립적 분석을 수행합니다:

1. Laplacian 에너지 (60%): 각 픽셀에서 3×3 Laplacian(중심 ×8 - 주변 8개 합)의 절대값 평균을 계산합니다. 매끄러운 피부는 이웃 픽셀과 밝기가 비슷하여 에너지가 낮고, 거친 피부는 각질·요철로 인해 에너지가 높습니다.

2. 방향 구배 일관성 (40%): 수평 구배(|R-L|)와 수직 구배(|D-U|)의 차이를 측정합니다. 매끄러운 피부는 모든 방향에서 균일한 반면, 거친 피부는 방향에 따라 불규칙합니다.

볼(60%) + 이마(40%) 가중치. 볼은 피부결이 가장 눈에 띄는 영역입니다.

이는 VISIA의 Texture 항목과 같은 원리입니다.`,
    references: [
      { name: '3×3 Laplacian 에너지', description: '중심 픽셀과 8개 이웃의 밝기 차이 합. 높은 에너지 = 거친 표면, 낮은 에너지 = 매끄러운 표면. 중간 주파수를 선택적으로 캡처합니다.', source: 'LUA Computer Vision Engine' },
      { name: '방향 구배 일관성 (Roughness)', description: '수평·수직 방향 밝기 변화율의 차이. 매끄러운 피부는 방향에 무관하게 균일하지만, 거친 피부는 방향에 따라 불규칙한 변화를 보입니다.', source: 'LUA Computer Vision Engine' },
      { name: 'VISIA Texture Analysis', description: 'Canfield Scientific의 피부 분석 시스템. 교차 편광 조명으로 피부 표면의 미세 요철을 시각화하여 피부결 점수를 산출합니다.', source: 'Canfield Scientific, VISIA Complexion Analysis' },
      { name: 'PRIMOS (Phase-shift Rapid In vivo Measurement of Skin)', description: '위상 변이 프로필로미터로 피부 표면 거칠기를 마이크로미터 단위로 측정. Ra(평균 거칠기), Rz(최대 거칠기) 등의 파라미터를 사용합니다.', source: 'GFMesstechnik GmbH / Canfield Scientific' },
      { name: '각질 턴오버와 피부결', description: '정상 각질 턴오버(28일 주기)가 느려지면 각질이 축적되어 거친 피부결을 형성합니다. 나이, UV, 수분 부족이 턴오버를 지연시킵니다.', source: 'Rawlings AV (2006) Int J Cosmetic Science, 28(2):79-93' },
    ],
    steps: [
      { title: '피부결 존 설정', desc: '양 볼(넓은 영역)과 이마를 분석 영역으로 설정합니다. 볼은 피부결이 가장 눈에 띄는 곳입니다.' },
      { title: 'Laplacian 에너지 측정', desc: '각 픽셀에서 3×3 Laplacian(중심×8 - 이웃 합)의 절대값을 계산합니다. 에너지↑ = 거친 피부.' },
      { title: '구배 일관성 측정', desc: '수평·수직 방향 밝기 변화율의 차이를 계산합니다. 차이↑ = 불규칙한 표면.' },
      { title: '가중 합산', desc: 'Laplacian 에너지(60%) + 구배 일관성(40%)으로 종합. 볼(60%) + 이마(40%).' },
    ],
    ranges: [
      { range: '80점 이상', label: '매끈', color: '#4CAF50', description: '피부결이 매우 매끄러워요.' },
      { range: '60~79점', label: '양호', color: '#8BC34A', description: '전반적으로 좋은 피부결.' },
      { range: '40~59점', label: '거칠음', color: '#FF9800', description: '각질 케어를 추천.' },
      { range: '40점 미만', label: '관리필요', color: '#f44336', description: '적극적 각질+보습 관리 필요.' },
    ],
    gutBrainSkin: '장내 유익균이 생산하는 단쇄지방산(SCFA, 특히 부티르산)은 피부 각질세포의 분화와 장벽 형성을 촉진합니다. 장 건강이 좋으면 각질 턴오버가 정상화(28일 주기)되어 자연스럽게 매끄러운 피부결이 유지됩니다. 장 불균형 시 턴오버 지연 → 각질 축적 → 거친 피부결로 이어집니다.',
    gutBrainSkinSource: 'Schwarz A et al. (2012) "Short-chain fatty acids and skin barrier" J Investigative Dermatology, 132(3 Pt 1):818-825',
  },

  darkCircles: {
    icon: '👁️', title: '다크서클', subtitle: 'Under-Eye Dark Circle Analysis',
    color: '#78909C', gradient: 'linear-gradient(135deg, #90A4AE, #455A64)',
    hero: '눈 밑 삼각형 영역의 밝기·색조를 볼과 비교하여 다크서클의 심각도와 유형을 분석합니다.',
    methodology: `다크서클은 눈 밑(under-eye triangle)이 주변 볼보다 어둡고, 종종 푸르스름한 색조를 띠는 현상입니다.

LUA는 세 가지 독립적 신호를 측정합니다:

1. 밝기 차이 (Dark Delta, 50%): 눈 밑 영역의 평균 밝기를 중간 볼(reference)과 비교합니다. 차이가 클수록 다크서클이 심합니다. (cheek.L - eye.L) / cheek.L 로 정규화합니다.

2. 블루 시프트 (Blue Shift, 30%): 눈 밑의 B/R 비율을 볼의 B/R 비율과 비교합니다. 정상 피부는 R > G > B이지만, 혈관형 다크서클은 B가 G에 접근하거나 초과합니다. 이를 통해 혈관형(푸른) 다크서클을 특이적으로 감지합니다.

3. 채도 차이 (Saturation Diff, 20%): 눈 밑과 볼의 색 채도 차이를 측정합니다. 색소형 다크서클은 멜라닌 침착으로 채도 패턴이 달라집니다.

좌·우 눈을 독립적으로 분석하고 평균합니다. 비대칭(좌우 차이)도 추적합니다.`,
    references: [
      { name: '밝기 차이 분석 (Dark Delta)', description: '눈 밑과 중간 볼의 밝기(Luminance) 차이를 정규화. 값이 높을수록 다크서클이 심합니다. 0: 없음, 0.1: 경미, 0.2+: 뚜렷.', source: 'LUA Computer Vision Engine' },
      { name: '블루 시프트 분석 (Blue Shift)', description: '눈 밑의 B/R 비율을 볼과 비교. 혈관형 다크서클은 얇은 피부 아래 정맥혈이 비치면서 푸른 색조를 나타냅니다. B/R 비율↑ = 혈관형 다크서클.', source: 'LUA Computer Vision Engine' },
      { name: 'Periorbital Hyperpigmentation Classification', description: '다크서클 4가지 유형: 혈관형(Vascular, 푸른/보라), 색소형(Pigmented, 갈색), 구조형(Structural, 그림자), 혼합형(Mixed). 각 유형별 원인과 치료가 다릅니다.', source: 'Ranu H et al. (2011) J Cosmetic Dermatology, 10(4):250-257' },
      { name: 'Dermoscopy for Dark Circles', description: '피부경 관찰에서 혈관형은 보라-파랑 망상 패턴, 색소형은 갈색 균일 패턴을 보입니다. LUA의 블루 시프트 분석은 이 원리를 디지털로 근사합니다.', source: 'Freitag FM, Cestari TF (2007) J Cosmetic Dermatology' },
      { name: 'Under-Eye Skin Thickness', description: '눈 밑 피부는 0.5mm로 얼굴에서 가장 얇습니다 (볼 2mm의 1/4). 이로 인해 아래 혈관과 근육 색이 비치기 쉽고, 수면 부족·알레르기·노화에 가장 먼저 반응합니다.', source: 'Sarkar R et al. (2016) J Cutaneous & Aesthetic Surgery, 9(2):65-72' },
    ],
    steps: [
      { title: '눈 밑 영역 설정', desc: '좌·우 눈 밑 삼각형(under-eye triangle)과 비교용 중간 볼(reference) 영역을 각각 설정합니다.' },
      { title: '밝기 차이 측정', desc: '눈 밑과 볼의 평균 밝기(L)를 비교. 볼 대비 어두운 정도를 0~1로 정규화합니다.' },
      { title: '색조 분석', desc: '눈 밑의 B/R 비율을 볼과 비교하여 블루 시프트(혈관형 다크서클 지표)를 산출합니다.' },
      { title: '채도 차이', desc: '눈 밑과 볼의 색 채도(Saturation) 차이를 측정합니다.' },
      { title: '종합 심각도', desc: '밝기 차이(50%) + 블루 시프트(30%) + 채도 차이(20%) → 좌우 평균 → 최종 점수.' },
    ],
    ranges: [
      { range: '80점 이상', label: '밝음', color: '#4CAF50', description: '다크서클이 거의 없어요.' },
      { range: '60~79점', label: '양호', color: '#8BC34A', description: '경미한 수준.' },
      { range: '40~59점', label: '눈에띔', color: '#FF9800', description: '아이크림 + 수면 관리 추천.' },
      { range: '40점 미만', label: '심함', color: '#f44336', description: '적극적 관리 필요.' },
    ],
    gutBrainSkin: '장은 세로토닌의 90%를 생산합니다. 세로토닌은 멜라토닌(수면 호르몬)의 전구체이므로, 장 건강이 나쁘면 세로토닌↓ → 멜라토닌↓ → 수면 질 저하 → 혈류 정체 → 다크서클 악화로 이어집니다. 또한 장내 만성 염증은 혈관 투과성을 높여 눈 밑 혈관 울혈을 촉진합니다. 프로바이오틱스(특히 L. helveticus + B. longum)가 수면 질 개선에 효과가 있다는 임상 보고가 있습니다.',
    gutBrainSkinSource: 'Yano JM et al. (2015) "Indigenous Bacteria from the Gut Microbiota Regulate Host Serotonin Biosynthesis" Cell, 161(2):264-276',
  },
};

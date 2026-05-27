/**
 * LUA Science Data v2.1 — Complete 10-Metric System
 */

export const SCIENCE = {

  skinAge: {
    icon: '', title: '피부 나이', subtitle: 'Biological Skin Age',
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
    icon: '', title: '수분도', subtitle: 'Skin Hydration Level',
    color: '#A8DEFF', gradient: 'linear-gradient(135deg, #A8DEFF, #78C0EE)',
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
    hero: '블랙헤드·화이트헤드·화농성 여드름 3가지 트러블 유형을 각각 구분 감지하여 피부 트러블 상태를 종합 평가합니다.',
    methodology: `LUA는 트러블을 3가지 유형으로 구분하여 감지합니다.

■ 블랙헤드 (개방성 면포, Blackhead)
모공이 열린 상태에서 피지가 공기 중 산화되어 검게 변한 것입니다.
주로 코와 나비존(T존) 주변에서 작고 어두운 점(다크 스팟)들의 밀집도를 분석합니다.
LAB L* 채널에서 주변보다 유의미하게 어두운 미세 클러스터를 검출합니다.

■ 화이트헤드 (폐쇄성 면포, Whitehead)
각질이 모공을 막아 피지가 갇혀 있는 하얀 좁쌀 여드름입니다.
붉은기는 없지만, 피부 표면에 약간 튀어나온 미세한 음영(요철)과 옅은 유백색을 감지합니다.
로컬 분산(Micro-Variance)으로 주변 대비 밝기·텍스처 변화가 있는 돌기를 검출합니다.

■ 화농성 여드름 (염증성, Pustule)
세균(C. acnes)이 증식해 염증이 생기고 고름이 찬 상태입니다.
주변 피부에 비해 강한 붉은기(Redness)를 띠며, 중심부에 노란색 고름(Pustule) 픽셀이 뭉쳐 있는 것을 인식합니다.
적색 우세 조건(R > G×1.2, R > B×1.25, R > 95, R-G > 15) + 사이즈 필터로 일반 홍조와 구분합니다.

영역별로 볼(홍조 구분), 턱(호르몬성), 이마(피지성)를 분리 측정하고 GAGS 기준으로 심각도를 매핑합니다.`,
    references: [
      { name: '3유형 트러블 분류', description: '블랙헤드(개방성 면포): 산화 피지 다크 스팟 밀집도. 화이트헤드(폐쇄성 면포): 유백색 요철 로컬 분산. 화농성 여드름: 적색 우세 + 중심 황색 클러스터.', source: 'LUA Computer Vision Engine' },
      { name: 'GAGS (Global Acne Grading System)', description: '얼굴 6영역(이마·우볼·좌볼·코·턱·흉부) 병변 종합. 경증 1~18, 중등도 19~30, 중증 31+.', source: 'Doshi A et al. (1997) J Am Acad Dermatol, 37(3):468-472' },
      { name: 'Comedone Pathogenesis', description: '면포(Comedone)는 여드름의 기본 병변. 개방성(블랙헤드)은 산화 멜라닌+피지, 폐쇄성(화이트헤드)은 각질+피지 폐색. 방치 시 염증성으로 진행.', source: 'Zaenglein AL et al. (2016) J Am Acad Dermatol, 74(5):945-973' },
      { name: 'C. acnes & Inflammation', description: 'Cutibacterium acnes가 막힌 모낭에서 증식 → 유리지방산 분비 → TLR2 활성화 → IL-1β, TNF-α 분비 → 염증성 여드름(구진·농포·결절).', source: 'Beylot C et al. (2014) JEADV, 28(3):271-278' },
    ],
    steps: [
      { title: '블랙헤드 감지', desc: 'T존(코·나비존)에서 LAB L* 채널 기반 어두운 미세 스팟 클러스터를 검출합니다.' },
      { title: '화이트헤드 감지', desc: '피부 표면의 로컬 밝기·텍스처 분산으로 유백색 요철(좁쌀) 돌기를 검출합니다.' },
      { title: '화농성 여드름 감지', desc: '적색 우세 픽셀(R>G×1.2) + 사이즈 필터로 염증성 병변만 선별. 일반 홍조와 구분합니다.' },
      { title: '영역별 분류', desc: '이마(피지성)·볼(홍조 구분)·턱(호르몬성) 영역별로 분리 측정합니다.' },
      { title: 'GAGS 매핑', desc: '3유형 합산 → 0~2개: 깨끗, 3~5: 경증, 6~10: 중등도, 11+: 중증.' },
    ],
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
    icon: '', title: '유분 밸런스', subtitle: 'Sebum Balance Index',
    color: '#F0E0A8', gradient: 'linear-gradient(135deg, #F0E0A8, #E0D090)',
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
      { range: '45~65%', label: '균형', color: '#0e6bec', description: '이상적인 유수분 밸런스.' },
      { range: '66~80%', label: '유분과다', color: '#777167', description: '수분 젤 보습제 추천.' },
      { range: '44% 이하', label: '건조', color: '#777167', description: '페이셜 오일 추가 추천.' },
      { range: '81% 이상', label: '지성', color: '#272727', description: '유분 조절 토너 필요.' },
    ],
    gutBrainSkin: '장내 유익균은 에스트로볼롬으로 호르몬 대사에 관여. 장 불균형 → 호르몬 불균형 → 피지선 과활성.',
    gutBrainSkinSource: 'Baker JM et al. (2017) Maturitas, 103:45-53',
  },

  wrinkles: {
    icon: '', title: '주름', subtitle: 'Wrinkle Analysis',
    color: '#F5D0B8', gradient: 'linear-gradient(135deg, #F5D0B8, #E8C0A8)',
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
      { range: '80점 이상', label: '미세', color: '#0e6bec', description: '모공 거의 안 보임.' },
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
      { range: '80점 이상', label: '탄탄', color: '#0e6bec', description: '턱선 뚜렷, 탄력 좋음.' },
      { range: '60~79점', label: '양호', color: '#00a0fc', description: '아직 괜찮은 탄력.' },
      { range: '40~59점', label: '처짐', color: '#777167', description: '탄력 관리 시작 추천.' },
      { range: '40점 미만', label: '나쁨', color: '#272727', description: '적극적 탄력 케어 추천.' },
    ],
    gutBrainSkin: '장내 유익균은 항산화 효소(SOD, Catalase)를 활성화하여 엘라스틴을 보호합니다. 장 불균형 → ROS↑ → 엘라스틴 변성 → 처짐.',
    gutBrainSkinSource: 'Guéniche A et al. (2010) European J Dermatology, 20(6):731-735',
  },

  pigmentation: {
    icon: '', title: '색소 침착', subtitle: 'Pigmentation & Dark Spots',
    color: '#C0A890', gradient: 'linear-gradient(135deg, #C0A890, #B09880)',
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
      { range: '80점 이상', label: '맑음', color: '#0e6bec', description: '색소침착 거의 없음.' },
      { range: '60~79점', label: '양호', color: '#00a0fc', description: '경미한 잡티 수준.' },
      { range: '40~59점', label: '주의', color: '#777167', description: '미백 관리 추천.' },
      { range: '40점 미만', label: '심함', color: '#272727', description: '적극적 미백 + 자외선 차단.' },
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
      { range: '80점 이상', label: '밝음', color: '#0e6bec', description: '다크서클이 거의 없어요.' },
      { range: '60~79점', label: '양호', color: '#00a0fc', description: '경미한 수준.' },
      { range: '40~59점', label: '눈에띔', color: '#777167', description: '아이크림 + 수면 관리 추천.' },
      { range: '40점 미만', label: '심함', color: '#272727', description: '적극적 관리 필요.' },
    ],
    gutBrainSkin: '장은 세로토닌의 90%를 생산합니다. 세로토닌은 멜라토닌(수면 호르몬)의 전구체이므로, 장 건강이 나쁘면 세로토닌↓ → 멜라토닌↓ → 수면 질 저하 → 혈류 정체 → 다크서클 악화로 이어집니다. 또한 장내 만성 염증은 혈관 투과성을 높여 눈 밑 혈관 울혈을 촉진합니다. 프로바이오틱스(특히 L. helveticus + B. longum)가 수면 질 개선에 효과가 있다는 임상 보고가 있습니다.',
    gutBrainSkinSource: 'Yano JM et al. (2015) "Indigenous Bacteria from the Gut Microbiota Regulate Host Serotonin Biosynthesis" Cell, 161(2):264-276',
  },

  oilMoistureBalance: {
    icon: '', title: '유수분 밸런스', subtitle: 'Oil-Moisture Balance & Skin Type',
    color: '#66d9e8', gradient: 'linear-gradient(135deg, #66d9e8, #3bc9db)',
    hero: '수분도와 유분량의 상호 관계를 분석하여 피부 타입(중성·지성·건성·수부지·복합성)을 판별하고, 유수분 균형 점수를 산출합니다.',
    methodology: `LUA는 수분도(moisture)와 유분(oilBalance) 두 지표를 조합하여 피부 타입을 판별합니다.

■ 피부 타입 판별 기준

• 정상/중성(Normal): 수분 60점 이상 + 유분 40~60점
  → 가장 이상적인 상태. 유수분 밸런스가 완벽히 맞음.

• 지성(Oily): 수분 50점 이상 + 유분 70점 이상
  → 수분도 어느 정도 있지만, 유분 분비가 너무 과한 상태.

• 건성(Dry): 수분 40점 이하 + 유분 30점 이하
  → 유분과 수분이 모두 메말라 피부가 당기고 푸석한 상태.

• 수부지/수분부족지성(Dehydrated-Oily): 수분 40점 이하 + 유분 70점 이상
  → 현대인에게 가장 많음. 속은 건조한데 겉은 기름진 상태.

• 복합성(Combination): T존(이마·코)과 U존(볼·턱)의 유분 격차가 30점 이상
  → T존은 지성, U존은 건성인 상태.

■ 밸런스 점수 공식
100 - |수분 - 유분| × 1.2 - |55 - (수분+유분)/2| × 0.8

수분과 유분이 모두 45~65% 범위에서 균형을 이루면 높은 점수, 한쪽이 치우치거나 양쪽 모두 극단이면 낮은 점수입니다.`,
    references: [
      { name: '피부 타입 분류 모델', description: '수분도와 유분량의 조합으로 5가지 피부 타입(중성·지성·건성·수부지·복합성)을 판별. T존/U존 영역 분할로 복합성 감지.', source: 'LUA Skin Analysis Engine' },
      { name: 'Skin Barrier Function', description: '각질층의 세라마이드-지질-수분 3요소 균형이 피부 장벽 기능의 핵심. 불균형 시 TEWL(경피수분손실) 증가.', source: 'Elias PM (2005) J Invest Dermatol, 125(2):183-200' },
      { name: 'Sebum-Hydration Correlation', description: '피지 분비량과 각질층 수분량은 독립적이나, 둘의 균형이 피부 컨디션과 트러블 발생에 직접 영향.', source: 'Youn SW et al. (2005) Skin Research & Technology, 11(2):110-115' },
      { name: 'Dehydrated-Oily Skin', description: '수분 부족형 지성(수부지)은 피부 장벽 손상으로 수분은 빠져나가고 피지는 보상 분비되는 상태. 현대인의 도시 환경·에어컨·과도한 세안에 의해 급증.', source: 'Muizzuddin N et al. (2008) J Cosmetic Science, 59(2):151-158' },
    ],
    steps: [
      { title: '수분도 측정', desc: '피부 표면 밝기 균일도(σ)로 각질층 수분 함유량을 평가합니다.' },
      { title: '유분량 측정', desc: 'T존/U존 하이라이트 비율로 피지 분비량을 평가합니다.' },
      { title: '피부 타입 판별', desc: '수분·유분 조합 + T존/U존 격차로 5가지 피부 타입을 판별합니다.' },
      { title: '균형 점수 산출', desc: '수분-유분 차이 패널티 + 중앙 이탈 패널티를 종합하여 0~100점으로 환산.' },
    ],
    ranges: [
      { range: '수분 60+, 유분 40~60', label: '중성', color: '#4CAF50', description: '이상적인 유수분 밸런스. 현재 루틴을 유지하세요.' },
      { range: '수분 50+, 유분 70+', label: '지성', color: '#FF9800', description: '유분 과다. 가벼운 수분 젤 + 클레이 마스크 추천.' },
      { range: '수분 40↓, 유분 30↓', label: '건성', color: '#2196F3', description: '수분·유분 모두 부족. 세라마이드 크림 + 페이셜 오일 추천.' },
      { range: '수분 40↓, 유분 70+', label: '수부지', color: '#f44336', description: '속건조 겉지성. 수분 에센스 + 가벼운 보습제로 장벽 회복 우선.' },
      { range: 'T/U존 격차 30+', label: '복합성', color: '#FF9800', description: 'T존 지성 + U존 건성. 부위별 다른 케어 필요.' },
    ],
    gutBrainSkin: '장내 미생물은 단쇄지방산(SCFA)을 통해 피부 세라마이드 합성을 촉진하고, 동시에 호르몬 대사(에스트로볼롬)를 통해 피지 분비를 조절합니다. 장 건강이 나빠지면 수분 손실 증가 + 피지 과다가 동시에 발생하여 유수분 밸런스가 무너지고, 수부지(수분부족지성) 상태로 이어질 수 있습니다.',
    gutBrainSkinSource: 'Salem I et al. (2018) "The Gut Microbiome as a Major Regulator of the Gut-Skin Axis" Frontiers in Microbiology, 9:1459',
  },

  redness: {
    icon: '', title: '붉은기', subtitle: 'Skin Redness Level',
    color: '#ff8787', gradient: 'linear-gradient(135deg, #ff8787, #C32824)',
    hero: 'LAB 색 공간의 a* 채널을 분석하여 볼 영역의 붉은기(홍조) 정도를 정량 측정합니다.',
    methodology: `LUA는 CIE LAB 색 공간의 a* 채널을 활용합니다.

a* 값은 녹색(-) ~ 적색(+) 축으로, 값이 높을수록 피부가 붉습니다. 양볼(cheek) 영역의 평균 a* 값을 기준으로 붉은기 심각도를 판별합니다.

공식: 95 - max(0, cheekLabA - 5) × 3.5

a* ≤ 5: 붉은기 거의 없음 (95점)
a* 10: 경미한 홍조 (약 78점)
a* 15: 눈에 띄는 홍조 (약 60점)
a* 20+: 심한 홍조 (40점 이하)

민감성 피부, 주사(Rosacea), 알레르기, 자외선 손상, 온도 변화 등이 주요 원인입니다.`,
    references: [
      { name: 'LAB a* 채널 분석', description: 'CIE LAB 색 공간에서 a* 채널(녹-적 축)로 피부 붉은기를 정량화. 비침습적 홍조 측정 표준 방법.', source: 'LUA Computer Vision Engine' },
      { name: 'Mexameter Erythema Index', description: '568nm(hemoglobin 흡수 파장) 반사율로 홍반 지수 측정. a* 채널과 높은 상관관계(r=0.89).', source: 'Courage+Khazaka Electronic GmbH' },
      { name: 'Rosacea Grading (NRS)', description: 'National Rosacea Society 4단계: ETR(홍반), PPR(구진농포), Phymatous(비류), Ocular(안구). LUA는 ETR 단계의 홍반 정도를 측정.', source: 'Wilkin J et al. (2002) J Am Acad Dermatol, 46(4):584-587' },
      { name: 'Neurogenic Inflammation', description: '스트레스·온도·매운 음식 → TRPV1 수용체 활성화 → 신경성 염증 → 혈관 확장 → 홍조. 만성화 시 주사(Rosacea)로 진행.', source: 'Steinhoff M et al. (2011) J Invest Dermatol Symp Proc, 15(1):2-11' },
    ],
    steps: [
      { title: '볼 영역 추출', desc: 'MediaPipe 랜드마크로 좌·우 볼 영역을 정확히 분리합니다.' },
      { title: 'LAB 변환', desc: 'RGB → CIE LAB 색 공간 변환. a* 채널 값을 추출합니다.' },
      { title: 'a* 평균 산출', desc: '양볼 영역의 평균 a* 값을 계산합니다.' },
      { title: '붉은기 점수 산출', desc: 'a* 값이 높을수록 감점. 95점 기준에서 a* 초과분만큼 차감.' },
    ],
    ranges: [
      { range: '75점 이상', label: '깨끗', color: '#4CAF50', description: '붉은기가 거의 없어요.' },
      { range: '55~74점', label: '양호', color: '#8BC34A', description: '경미한 붉은기. 크게 걱정 없어요.' },
      { range: '35~54점', label: '홍조', color: '#FF9800', description: '홍조가 눈에 띄어요. 진정 케어 추천.' },
      { range: '35점 미만', label: '심함', color: '#f44336', description: '지속적 홍조. 피부과 상담 권장.' },
    ],
    gutBrainSkin: '장-피부 축에서 장 투과성 증가(Leaky Gut)는 내독소(LPS)가 혈류로 유입되어 전신 염증 반응을 유발하고, 이것이 피부 혈관 확장 → 만성 홍조로 이어집니다. 주사(Rosacea) 환자의 장내 미생물 다양성이 유의미하게 낮다는 연구가 있으며, H. pylori 제균 치료 후 홍조가 개선된 사례도 보고되었습니다.',
    gutBrainSkinSource: 'Parodi A et al. (2008) "Small Intestinal Bacterial Overgrowth in Rosacea" Clinical Gastroenterology and Hepatology, 6(7):759-764',
  },
};

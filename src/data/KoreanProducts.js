// 한국 화장품 시장에서 자주 등록되는 인기 브랜드·제품 데이터셋.
// 자동완성 즉시 매칭(0ms)용. 정확도 우선으로 검증된 제품만 큐레이션.
// 부족한 결과는 GPT 검색으로 보강됨.

export const KOREAN_PRODUCTS = [
  // ===== 토리든 =====
  { brand: '토리든', name: '다이브인 저분자 히알루론산 토너', category: '토너', timeSlot: 'both', ingredients: ['저분자 히알루론산', '판테놀'], volume: '300ml' },
  { brand: '토리든', name: '다이브인 저분자 히알루론산 세럼', category: '세럼', timeSlot: 'both', ingredients: ['저분자 히알루론산'], volume: '50ml' },
  { brand: '토리든', name: '다이브인 저분자 히알루론산 크림', category: '크림', timeSlot: 'both', ingredients: ['저분자 히알루론산', '세라마이드'], volume: '70ml' },
  { brand: '토리든', name: '다이브인 저분자 히알루론산 마스크', category: '마스크팩', timeSlot: 'both', ingredients: ['저분자 히알루론산'], volume: '27ml x 10매' },

  // ===== 코스알엑스 (COSRX) =====
  { brand: '코스알엑스', name: '어드밴스드 스네일 96 뮤신 파워 에센스', category: '에센스', timeSlot: 'both', ingredients: ['달팽이 점액 96%'], volume: '100ml' },
  { brand: '코스알엑스', name: 'BHA 블랙헤드 파워 리퀴드', category: '토너', timeSlot: 'night', ingredients: ['BHA(살리실산)', '베타인'], volume: '100ml' },
  { brand: '코스알엑스', name: 'AHA 7 화이트헤드 파워 리퀴드', category: '토너', timeSlot: 'night', ingredients: ['AHA(글리콜릭산)'], volume: '100ml' },
  { brand: '코스알엑스', name: '어드밴스드 스네일 92 올인원 크림', category: '크림', timeSlot: 'both', ingredients: ['달팽이 점액 92%', '판테놀'], volume: '100g' },
  { brand: '코스알엑스', name: '갈락토미세스 95 모이스처 에센스', category: '에센스', timeSlot: 'both', ingredients: ['갈락토미세스 발효 여과물 95%'], volume: '100ml' },
  { brand: '코스알엑스', name: '센텔라 블레미쉬 카밍 리퀴드', category: '에센스', timeSlot: 'both', ingredients: ['센텔라 아시아티카 추출물'], volume: '30ml' },

  // ===== 닥터자르트 =====
  { brand: '닥터자르트', name: '시카페어 크림', category: '크림', timeSlot: 'both', ingredients: ['센텔라 아시아티카', '판테놀'], volume: '50ml' },
  { brand: '닥터자르트', name: '시카페어 세럼', category: '세럼', timeSlot: 'both', ingredients: ['센텔라RX', '나이아신아마이드'], volume: '50ml' },
  { brand: '닥터자르트', name: '세라마이딘 크림', category: '크림', timeSlot: 'both', ingredients: ['세라마이드 콤플렉스'], volume: '50ml' },
  { brand: '닥터자르트', name: '세라마이딘 미스트', category: '토너', timeSlot: 'both', ingredients: ['세라마이드'], volume: '110ml' },
  { brand: '닥터자르트', name: '바이탈 하이드라 솔루션 바이옴 앰플 크림', category: '크림', timeSlot: 'both', ingredients: ['바이옴', '히알루론산'], volume: '50ml' },

  // ===== 셀퓨전씨 =====
  { brand: '셀퓨전씨', name: '레이저 선스크린 100 SPF50+', category: '선크림', timeSlot: 'morning', ingredients: ['징크옥사이드', '판테놀'], volume: '50ml' },
  { brand: '셀퓨전씨', name: '아쿠아티카 쿨링 썬스크린', category: '선크림', timeSlot: 'morning', ingredients: ['자외선 필터', '판테놀', '히알루론산'], volume: '50ml' },
  { brand: '셀퓨전씨', name: '익스퍼트 트리플 화이트 세럼', category: '세럼', timeSlot: 'both', ingredients: ['나이아신아마이드', '비타민C'], volume: '30ml' },
  { brand: '셀퓨전씨', name: '포스트 알파 화이트 크림', category: '크림', timeSlot: 'both', ingredients: ['알부틴', '나이아신아마이드'], volume: '50ml' },

  // ===== 앰플엔 =====
  { brand: '앰플엔', name: '펩타이드샷 앰플', category: '세럼', timeSlot: 'both', ingredients: ['펩타이드 콤플렉스'], volume: '30ml' },
  { brand: '앰플엔', name: '비타민샷 앰플', category: '세럼', timeSlot: 'morning', ingredients: ['비타민C', '나이아신아마이드'], volume: '30ml' },
  { brand: '앰플엔', name: '히알루론샷 앰플', category: '세럼', timeSlot: 'both', ingredients: ['히알루론산 5종'], volume: '30ml' },

  // ===== 메디힐 =====
  { brand: '메디힐', name: 'N.M.F 아쿠아 링거 마스크', category: '마스크팩', timeSlot: 'both', ingredients: ['N.M.F', '히알루론산'], volume: '27ml' },
  { brand: '메디힐', name: '티트리 케어 솔루션 에센셜 마스크', category: '마스크팩', timeSlot: 'both', ingredients: ['티트리 오일'], volume: '24ml' },
  { brand: '메디힐', name: '콜라겐 임팩트 에센셜 마스크', category: '마스크팩', timeSlot: 'both', ingredients: ['콜라겐', '엘라스틴'], volume: '24ml' },

  // ===== 라네즈 =====
  { brand: '라네즈', name: '워터뱅크 블루 히알루로닉 세럼', category: '세럼', timeSlot: 'both', ingredients: ['블루 히알루론산'], volume: '50ml' },
  { brand: '라네즈', name: '워터뱅크 블루 히알루로닉 크림', category: '크림', timeSlot: 'both', ingredients: ['블루 히알루론산', '미네랄'], volume: '50ml' },
  { brand: '라네즈', name: '크림 스킨 리파이너', category: '토너', timeSlot: 'both', ingredients: ['화이트 리프 차'], volume: '170ml' },
  { brand: '라네즈', name: '립 슬리핑 마스크', category: '마스크팩', timeSlot: 'night', ingredients: ['베리 콤플렉스'], volume: '20g' },

  // ===== 설화수 =====
  { brand: '설화수', name: '자음생 크림', category: '크림', timeSlot: 'both', ingredients: ['자음단', '진생'], volume: '60ml' },
  { brand: '설화수', name: '자음수', category: '토너', timeSlot: 'both', ingredients: ['자음단'], volume: '125ml' },
  { brand: '설화수', name: '윤조에센스', category: '에센스', timeSlot: 'both', ingredients: ['진생', '6가지 한방 원료'], volume: '60ml' },

  // ===== 이니스프리 =====
  { brand: '이니스프리', name: '그린티 시드 세럼', category: '세럼', timeSlot: 'both', ingredients: ['그린티 추출물'], volume: '80ml' },
  { brand: '이니스프리', name: '노세범 미네랄 파우더', category: '기타', timeSlot: 'morning', ingredients: ['미네랄'], volume: '5g' },
  { brand: '이니스프리', name: '비자 트러블 스팟 에센스', category: '세럼', timeSlot: 'night', ingredients: ['비자 추출물', '살리실산'], volume: '15ml' },
  { brand: '이니스프리', name: '한란 인리치드 크림', category: '크림', timeSlot: 'both', ingredients: ['한란'], volume: '50ml' },

  // ===== 에뛰드 =====
  { brand: '에뛰드', name: '순정 크림', category: '크림', timeSlot: 'both', ingredients: ['판테놀', '센텔라'], volume: '60ml' },
  { brand: '에뛰드', name: '술술잼 클렌징 폼', category: '클렌저', timeSlot: 'both', ingredients: ['아미노산'], volume: '150ml' },

  // ===== 헤라 =====
  { brand: '헤라', name: '블랙 쿠션', category: '기타', timeSlot: 'morning', ingredients: ['SPF34'], volume: '15g x 2' },
  { brand: '헤라', name: '에이지 리프팅 콘투어 크림', category: '크림', timeSlot: 'both', ingredients: ['콜라겐'], volume: '50ml' },

  // ===== 후 (Whoo) =====
  { brand: '후', name: '환유 골드 에디션 크림', category: '크림', timeSlot: 'both', ingredients: ['공진단', '금'], volume: '60ml' },
  { brand: '후', name: '비첩 자생 에센스', category: '에센스', timeSlot: 'both', ingredients: ['진생', '공진단'], volume: '50ml' },

  // ===== 오휘 =====
  { brand: '오휘', name: '더 퍼스트 제너츄어 자정 인텐시브 크림', category: '크림', timeSlot: 'night', ingredients: ['제너츄어 콤플렉스'], volume: '50ml' },
  { brand: '오휘', name: '에이지 리커버리 세럼', category: '세럼', timeSlot: 'both', ingredients: ['펩타이드'], volume: '45ml' },

  // ===== 아이오페 =====
  { brand: '아이오페', name: '더마톨로지 라이브 콜라겐 인텐시브 크림', category: '크림', timeSlot: 'both', ingredients: ['콜라겐'], volume: '50ml' },
  { brand: '아이오페', name: '레티놀 엑스퍼트 0.3%', category: '세럼', timeSlot: 'night', ingredients: ['레티놀 0.3%'], volume: '30ml' },

  // ===== 미샤 =====
  { brand: '미샤', name: '타임 레볼루션 더 퍼스트 트리트먼트 에센스', category: '에센스', timeSlot: 'both', ingredients: ['효모 발효 여과물'], volume: '150ml' },
  { brand: '미샤', name: '에어리 핏 선스크린', category: '선크림', timeSlot: 'morning', ingredients: ['징크옥사이드'], volume: '50ml' },

  // ===== 라로슈포제 =====
  { brand: '라로슈포제', name: '시카플라스트 밤 B5', category: '크림', timeSlot: 'both', ingredients: ['판테놀', '시카'], volume: '40ml' },
  { brand: '라로슈포제', name: '톨레리안 더블 리페어 모이스처라이저', category: '크림', timeSlot: 'both', ingredients: ['세라마이드', '나이아신아마이드'], volume: '75ml' },
  { brand: '라로슈포제', name: '안텔리오스 UV 무스 SPF50+', category: '선크림', timeSlot: 'morning', ingredients: ['멕소릴', 'UVA/UVB 필터'], volume: '50ml' },
  { brand: '라로슈포제', name: '에파클라 듀오 +M', category: '크림', timeSlot: 'night', ingredients: ['LHA', '나이아신아마이드'], volume: '40ml' },

  // ===== 세타필 =====
  { brand: '세타필', name: '데일리 페이셜 모이스처라이저', category: '크림', timeSlot: 'both', ingredients: ['글리세린', '히알루론산'], volume: '118ml' },
  { brand: '세타필', name: '젠틀 스킨 클렌저', category: '클렌저', timeSlot: 'both', ingredients: ['글리세린'], volume: '237ml' },

  // ===== 닥터지 (Dr.G) =====
  { brand: '닥터지', name: '레드 블레미쉬 클리어 수딩 크림', category: '크림', timeSlot: 'both', ingredients: ['센텔라', '판테놀'], volume: '70ml' },
  { brand: '닥터지', name: '레드 블레미쉬 클리어 수딩 토너', category: '토너', timeSlot: 'both', ingredients: ['센텔라'], volume: '200ml' },
  { brand: '닥터지', name: '그린 마일드 업 선 SPF50+', category: '선크림', timeSlot: 'morning', ingredients: ['징크옥사이드', '판테놀'], volume: '50ml' },

  // ===== 메디큐브 =====
  { brand: '메디큐브', name: '제로 모공 패드', category: '토너', timeSlot: 'night', ingredients: ['BHA', '나이아신아마이드'], volume: '155ml(70매)' },
  { brand: '메디큐브', name: '제로 칼라 카밍 크림', category: '크림', timeSlot: 'both', ingredients: ['센텔라', '판테놀'], volume: '50ml' },

  // ===== 어글로우 =====
  { brand: '어글로우', name: '롤온 아이 세럼', category: '세럼', timeSlot: 'both', ingredients: ['레티놀', '펩타이드'], volume: '15ml' },
  { brand: '어글로우', name: '바이옴 콜라겐 부스팅 크림', category: '크림', timeSlot: 'both', ingredients: ['콜라겐', '바이옴'], volume: '50ml' },

  // ===== 바이오힐 보 =====
  { brand: '바이오힐 보', name: '콜라겐 리프트 토너', category: '토너', timeSlot: 'both', ingredients: ['콜라겐'], volume: '150ml' },
  { brand: '바이오힐 보', name: '콜라겐 리프팅 크림', category: '크림', timeSlot: 'both', ingredients: ['콜라겐', '나이아신아마이드'], volume: '50ml' },

  // ===== CNP Laboratory =====
  { brand: 'CNP Laboratory', name: '프로폴리스 에너지 앰플', category: '세럼', timeSlot: 'both', ingredients: ['프로폴리스 추출물'], volume: '35ml' },
  { brand: 'CNP Laboratory', name: '프로폴리스 에너지 클렌징 폼', category: '클렌저', timeSlot: 'both', ingredients: ['프로폴리스'], volume: '150ml' },

  // ===== VT 코스메틱 =====
  { brand: 'VT', name: '시카 데일리 수딩 마스크', category: '마스크팩', timeSlot: 'both', ingredients: ['센텔라', '판테놀'], volume: '30매' },
  { brand: 'VT', name: '시카 수딩 토너', category: '토너', timeSlot: 'both', ingredients: ['센텔라'], volume: '300ml' },
  { brand: 'VT', name: '리들샷 100', category: '세럼', timeSlot: 'night', ingredients: ['스피큘'], volume: '50ml' },

  // ===== 토니모리 =====
  { brand: '토니모리', name: '히알루론산 촉촉 앰플', category: '세럼', timeSlot: 'both', ingredients: ['히알루론산'], volume: '100ml' },
  { brand: '토니모리', name: '갈색병 본 차이나 크림', category: '크림', timeSlot: 'both', ingredients: ['콜라겐'], volume: '50ml' },

  // ===== 한율 =====
  { brand: '한율', name: '어린쑥 진정 수분 토너', category: '토너', timeSlot: 'both', ingredients: ['어린쑥'], volume: '150ml' },
  { brand: '한율', name: '진정 솝베리 클렌징 폼', category: '클렌저', timeSlot: 'both', ingredients: ['솝베리'], volume: '150ml' },

  // ===== 마몽드 =====
  { brand: '마몽드', name: '로즈 워터 토너', category: '토너', timeSlot: 'both', ingredients: ['다마스크 장미수 91.4%'], volume: '250ml' },
  { brand: '마몽드', name: '레드 에너지 리커버리 세럼', category: '세럼', timeSlot: 'both', ingredients: ['붉은 꽃 콤플렉스'], volume: '50ml' },

  // ===== 페이스샵 =====
  { brand: '페이스샵', name: '더 데일리 라이스 워터 브라이트 라이트 클렌징 폼', category: '클렌저', timeSlot: 'both', ingredients: ['쌀 추출물'], volume: '300ml' },

  // ===== 네이처리퍼블릭 =====
  { brand: '네이처리퍼블릭', name: '수딩 & 모이스처 알로에 베라 92% 수딩 젤', category: '기타', timeSlot: 'both', ingredients: ['알로에 베라 92%'], volume: '300ml' },

  // ===== 스킨푸드 =====
  { brand: '스킨푸드', name: '캐롯 카로틴 모이스처 크림', category: '크림', timeSlot: 'both', ingredients: ['당근 추출물'], volume: '50ml' },
  { brand: '스킨푸드', name: '토마토 비타민 크림', category: '크림', timeSlot: 'both', ingredients: ['토마토 추출물', '비타민C'], volume: '50ml' },

  // ===== 에스트라 (ATOPALM) =====
  { brand: '에스트라', name: '아토베리어 365 크림', category: '크림', timeSlot: 'both', ingredients: ['MLE 콤플렉스'], volume: '80ml' },
  { brand: '에스트라', name: '리제덤 365 글로우 세럼', category: '세럼', timeSlot: 'both', ingredients: ['리제덤'], volume: '50ml' },

  // ===== 라카 (LAKA) =====
  { brand: '라카', name: '프루티 글램 틴트', category: '기타', timeSlot: 'both', ingredients: ['글리세린'], volume: '4.5g' },

  // ===== 닥터알엑스 (Dr.RX) / 디알엑스 — 잘 알려진 비건 브랜드는 skip =====

  // ===== 록시땅 =====
  { brand: '록시땅', name: '이모르뗄 크렘 디빈', category: '크림', timeSlot: 'both', ingredients: ['이모르뗄 에센셜 오일'], volume: '50ml' },

  // ===== 클리니크 =====
  { brand: '클리니크', name: '드라마티컬리 디퍼런트 모이스춰라이징 로션', category: '크림', timeSlot: 'both', ingredients: ['글리세린', '바셀린'], volume: '125ml' },

  // ===== 키엘 =====
  { brand: '키엘', name: '울트라 페이셜 크림', category: '크림', timeSlot: 'both', ingredients: ['스쿠알란', '글리세린'], volume: '50ml' },
  { brand: '키엘', name: '미드나잇 리커버리 컨센트레이트', category: '세럼', timeSlot: 'night', ingredients: ['스쿠알란', '라벤더 오일'], volume: '30ml' },

  // ===== 아벤느 =====
  { brand: '아벤느', name: '써멀 스프링 워터', category: '토너', timeSlot: 'both', ingredients: ['아벤느 온천수'], volume: '300ml' },

  // ===== 닥터마티노 =====
  { brand: '닥터마티노', name: '레티놀 글로우 앰플', category: '세럼', timeSlot: 'night', ingredients: ['레티놀'], volume: '30ml' },

  // ===== 일리윤 =====
  { brand: '일리윤', name: '세라마이드 아토 크림', category: '크림', timeSlot: 'both', ingredients: ['세라마이드'], volume: '500ml' },

  // ===== 바닐라코 =====
  { brand: '바닐라코', name: '클린 잇 제로 클렌징 밤', category: '클렌저', timeSlot: 'night', ingredients: ['아세로라 추출물'], volume: '100ml' },

  // ===== AHC =====
  { brand: 'AHC', name: '아이크림 포 페이스', category: '크림', timeSlot: 'both', ingredients: ['펩타이드'], volume: '30ml' },
  { brand: 'AHC', name: '하이드라 비타민 토너', category: '토너', timeSlot: 'both', ingredients: ['비타민', '히알루론산'], volume: '100ml' },
];

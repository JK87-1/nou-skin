// 한국 화장품 시장에서 자주 등록되는 인기 브랜드·제품 데이터셋.
// 자동완성 즉시 매칭(0ms)용. 정확도 우선으로 검증된 제품만 큐레이션.
// 부족한 결과는 GPT 검색으로 보강됨.
//
// 첫 화장대 진입 시 백그라운드로 인기 subset의 image URL을 prefetch해 캐시 → 자동완성 즉각 thumb 표시.

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

  // ===== 피지오겔 (Physiogel) =====
  { brand: '피지오겔', name: '데일리 모이스쳐 페이셜 로션', category: '크림', timeSlot: 'both', ingredients: ['DMS 콤플렉스', '글리세린'], volume: '200ml' },
  { brand: '피지오겔', name: '데일리 모이스쳐 페이셜 크림', category: '크림', timeSlot: 'both', ingredients: ['DMS 콤플렉스'], volume: '75ml' },
  { brand: '피지오겔', name: 'DMT UV 페이셜 선 SPF50+', category: '선크림', timeSlot: 'morning', ingredients: ['DMS 콤플렉스', '징크옥사이드'], volume: '40ml' },
  { brand: '피지오겔', name: '레드 수딩 AI 모이스쳐라이저', category: '크림', timeSlot: 'both', ingredients: ['글리세린', '판테놀'], volume: '80ml' },

  // ===== 더마팩토리 (Derma Factory) =====
  { brand: '더마팩토리', name: '히알루론 1% 세럼', category: '세럼', timeSlot: 'both', ingredients: ['히알루론산 1%'], volume: '30ml' },
  { brand: '더마팩토리', name: '나이아신아마이드 20% 세럼', category: '세럼', timeSlot: 'both', ingredients: ['나이아신아마이드 20%'], volume: '30ml' },
  { brand: '더마팩토리', name: '레티놀 0.3% 세럼', category: '세럼', timeSlot: 'night', ingredients: ['레티놀 0.3%'], volume: '30ml' },
  { brand: '더마팩토리', name: '센텔라 100% 토너', category: '토너', timeSlot: 'both', ingredients: ['센텔라 아시아티카 100%'], volume: '300ml' },

  // ===== 라운드랩 (Round Lab) =====
  { brand: '라운드랩', name: '독도 1025 토너', category: '토너', timeSlot: 'both', ingredients: ['미네랄', '판테놀'], volume: '300ml' },
  { brand: '라운드랩', name: '자작나무 수분 크림', category: '크림', timeSlot: 'both', ingredients: ['자작나무 수액', '히알루론산'], volume: '80ml' },
  { brand: '라운드랩', name: '자작나무 수분 선크림', category: '선크림', timeSlot: 'morning', ingredients: ['자작나무 수액'], volume: '50ml' },
  { brand: '라운드랩', name: '광동 약콩 수분 크림', category: '크림', timeSlot: 'both', ingredients: ['광동 약콩', '히알루론산'], volume: '80ml' },

  // ===== 시카팜 =====
  { brand: '시카팜', name: '시카팜 카밍 인텐시브 크림', category: '크림', timeSlot: 'both', ingredients: ['센텔라', '판테놀'], volume: '50ml' },
  { brand: '시카팜', name: '시카팜 수딩 토너', category: '토너', timeSlot: 'both', ingredients: ['센텔라'], volume: '200ml' },

  // ===== 셀바이오템 (Sel·Vio·Tem)? skip — 검증 안됨 =====

  // ===== 닥터알엑스 (Dr.RX) — Olive Young 자체 =====
  { brand: '웨이크메이크', name: '컬러풀 무드 인 액자 6스타일 컬러팔레트', category: '기타', timeSlot: 'both', ingredients: [], volume: '8.4g' },

  // ===== 어반디케이? skip 메이크업 위주 =====

  // ===== 미장센 (Mise-en-scène) — 헤어 위주 skip =====

  // ===== 닥터마티노 — 이미 있음 =====
  { brand: '닥터마티노', name: '레티놀 콜라겐 부스팅 크림', category: '크림', timeSlot: 'night', ingredients: ['레티놀', '콜라겐'], volume: '50ml' },

  // ===== 어글로우 추가 (Aglow) =====
  { brand: '어글로우', name: '슬리피 콜라겐 글로우 마스크', category: '마스크팩', timeSlot: 'night', ingredients: ['콜라겐', '히알루론산'], volume: '50ml' },

  // ===== 메디큐브 추가 (Medicube) =====
  { brand: '메디큐브', name: 'PDRN 핑크 원샷 앰플', category: '세럼', timeSlot: 'night', ingredients: ['PDRN', '나이아신아마이드'], volume: '15ml' },
  { brand: '메디큐브', name: 'Deep 모공 클렌징 폼', category: '클렌저', timeSlot: 'both', ingredients: ['BHA', '판테놀'], volume: '120ml' },
  { brand: '메디큐브', name: '에이지-알 부스팅 프로젝트 앰플', category: '세럼', timeSlot: 'night', ingredients: ['콜라겐', '펩타이드'], volume: '30ml' },

  // ===== 이드라 (Iddra) — skip 검증 안됨 =====

  // ===== 라쥬 (LaJou) — skip =====

  // ===== 셀퓨전씨 추가 =====
  { brand: '셀퓨전씨', name: '레이저 선스크린 50 SPF50+ (튜브)', category: '선크림', timeSlot: 'morning', ingredients: ['징크옥사이드', '판테놀'], volume: '50ml' },

  // ===== 메디힐 추가 =====
  { brand: '메디힐', name: '바이오 셀룰로오스 마스크', category: '마스크팩', timeSlot: 'both', ingredients: ['바이오 셀룰로오스'], volume: '25ml' },

  // ===== VT 추가 =====
  { brand: 'VT', name: 'Pro Cica Mild Foaming Cleanser', category: '클렌저', timeSlot: 'both', ingredients: ['센텔라', '판테놀'], volume: '150ml' },
  { brand: 'VT', name: '시카 데일리 수딩 패드', category: '토너', timeSlot: 'both', ingredients: ['센텔라', '나이아신아마이드'], volume: '170ml(60매)' },

  // ===== 닥터지 추가 (Dr.G) =====
  { brand: '닥터지', name: '레드 블레미쉬 클리어 수딩 액티브 앰플', category: '세럼', timeSlot: 'both', ingredients: ['센텔라', '나이아신아마이드'], volume: '30ml' },

  // ===== 닥터자르트 추가 =====
  { brand: '닥터자르트', name: '시카페어 타이거 그라스 캡슐 인 크림', category: '크림', timeSlot: 'both', ingredients: ['센텔라RX'], volume: '50ml' },

  // ===== 더샘 (the SAEM) =====
  { brand: '더샘', name: '셀로벗 베리어 시크릿 미라클 토너', category: '토너', timeSlot: 'both', ingredients: ['세라마이드'], volume: '200ml' },
  { brand: '더샘', name: '오버 액션 토끼 비비크림', category: '기타', timeSlot: 'morning', ingredients: ['SPF42'], volume: '50ml' },

  // ===== 네이처리퍼블릭 추가 =====
  { brand: '네이처리퍼블릭', name: '진생 로얄 실크 워터리 크림', category: '크림', timeSlot: 'both', ingredients: ['홍삼', '실크 펩타이드'], volume: '60ml' },

  // ===== 한율 추가 =====
  { brand: '한율', name: '히알루론 시카 인 캡슐 크림', category: '크림', timeSlot: 'both', ingredients: ['히알루론산', '센텔라'], volume: '50ml' },

  // ===== 클리오 (Clio) — 메이크업 위주, 스킨케어 일부 =====
  { brand: '클리오', name: '킬커버 매트 광채 쿠션', category: '기타', timeSlot: 'morning', ingredients: ['SPF50'], volume: '15g x 2' },

  // ===== 페리페라 (Peripera) — 메이크업 위주 — skip =====

  // ===== 어울이 시카 (Avoul Cica) — skip 검증 안됨 =====

  // ===== 시드물 (Sidmool) =====
  { brand: '시드물', name: '세이지 진정 보습 토너', category: '토너', timeSlot: 'both', ingredients: ['세이지', '히알루론산'], volume: '200ml' },

  // ===== 마녀공장 (Manyo Factory) =====
  { brand: '마녀공장', name: '퓨어 클렌징 오일', category: '클렌저', timeSlot: 'night', ingredients: ['올리브 오일', '시어버터'], volume: '200ml' },
  { brand: '마녀공장', name: '바이팜 이드라 모이스처라이징 토너', category: '토너', timeSlot: 'both', ingredients: ['바이팜', '히알루론산'], volume: '210ml' },
  { brand: '마녀공장', name: '바이팜 이드라 모이스처라이징 크림', category: '크림', timeSlot: 'both', ingredients: ['바이팜', '세라마이드'], volume: '50ml' },

  // ===== 셀퓨전씨 - 다른 라인업 =====
  { brand: '셀퓨전씨', name: '엑스퍼트 트리플 화이트 토너', category: '토너', timeSlot: 'both', ingredients: ['알부틴', '비타민C'], volume: '150ml' },

  // ===== 에스트라 추가 =====
  { brand: '에스트라', name: '아토베리어 365 모이스처라이저', category: '크림', timeSlot: 'both', ingredients: ['MLE 콤플렉스'], volume: '200ml' },
  { brand: '에스트라', name: '리제덤 365 RX 크림', category: '크림', timeSlot: 'both', ingredients: ['리제덤'], volume: '50ml' },

  // ===== 어떠한 (Otd) 등 마이너 — skip =====

  // ===== 토니모리 추가 =====
  { brand: '토니모리', name: '본 차이나 화이트닝 인텐스 세럼', category: '세럼', timeSlot: 'both', ingredients: ['나이아신아마이드'], volume: '50ml' },

  // ===== 록시땅 추가 =====
  { brand: '록시땅', name: '시어 풋 크림', category: '기타', timeSlot: 'both', ingredients: ['시어버터'], volume: '150ml' },

  // ===== 이솝 (Aesop) =====
  { brand: '이솝', name: '내추럴 모이스처라이징 페이셜 크림', category: '크림', timeSlot: 'both', ingredients: ['샌달우드', '카모마일'], volume: '60ml' },

  // ===== 비욘드 (Beyond) =====
  { brand: '비욘드', name: '레이스 시카 카밍 토너', category: '토너', timeSlot: 'both', ingredients: ['센텔라'], volume: '160ml' },

  // ===== 미장센 (Miselen / 메이크업 측 일부) — skip =====

  // ===== 바이오힐 보 추가 =====
  { brand: '바이오힐 보', name: '콜라겐 리프트 앰플', category: '세럼', timeSlot: 'both', ingredients: ['콜라겐', '펩타이드'], volume: '30ml' },

  // ===== 닥터마티노 추가 =====
  { brand: '닥터마티노', name: '글로우 비타민 앰플', category: '세럼', timeSlot: 'morning', ingredients: ['비타민C', '나이아신아마이드'], volume: '30ml' },

  // ===== 그 외 인기 — 어딘가 빠진 것 =====
  { brand: '아이오페', name: '바이오 에센스 인텐시브 컨디셔닝', category: '에센스', timeSlot: 'both', ingredients: ['효모 발효 추출물'], volume: '168ml' },
  { brand: '이니스프리', name: '레티놀 시카 안티에이징 앰플', category: '세럼', timeSlot: 'night', ingredients: ['레티놀', '센텔라'], volume: '20ml' },
  { brand: '라네즈', name: '네오 페이셜 마스크', category: '마스크팩', timeSlot: 'night', ingredients: ['콜라겐', '히알루론산'], volume: '17g' },

  // ===== 바르헤 (barhe) =====
  { brand: '바르헤', name: '글루타치온 화이트닝 크림 인 에센스', category: '에센스', timeSlot: 'both', ingredients: ['글루타치온', '나이아신아마이드'], volume: '50ml' },
  { brand: '바르헤', name: '글루타치온 미백 세럼', category: '세럼', timeSlot: 'both', ingredients: ['글루타치온', '비타민C'], volume: '50ml' },
  { brand: '바르헤', name: '콜라겐 부스팅 크림', category: '크림', timeSlot: 'both', ingredients: ['콜라겐', '펩타이드'], volume: '50ml' },

  // ===== 브이티 코스메틱 (브이티) — 추가 =====
  { brand: '브이티코스메틱', name: '브이티 피디알엔 광채 크림', category: '에센스', timeSlot: 'both', ingredients: ['PDRN', '나이아신아마이드'], volume: '50ml' },
  { brand: '브이티코스메틱', name: '브이티 시카 데일리 수딩 마스크', category: '마스크팩', timeSlot: 'both', ingredients: ['센텔라'], volume: '30매' },

  // ===== 바이오더마 (Bioderma) =====
  { brand: '바이오더마', name: '센시비오 H2O 미셀라 워터', category: '클렌저', timeSlot: 'both', ingredients: ['글리세린'], volume: '500ml' },
  { brand: '바이오더마', name: '아토덤 피피 PP밤', category: '크림', timeSlot: 'both', ingredients: ['아토덤'], volume: '30ml' },
  { brand: '바이오더마', name: '하이드라비오 H2O 미셀라 워터', category: '클렌저', timeSlot: 'both', ingredients: ['글리세린', '히알루론산'], volume: '500ml' },
];

// 사용자가 가장 자주 등록할 만한 인기 brand·제품 — 첫 화장대 진입 시 image URL 백그라운드 prefetch 대상.
// 캡처에서 보인 브랜드 + 데이터셋에서 카테고리 다양하게 핵심만 추림.
export const POPULAR_KOREAN_PRODUCTS = KOREAN_PRODUCTS.filter(p =>
  ['토리든', '코스알엑스', '닥터자르트', '셀퓨전씨', '앰플엔', '메디힐', '라네즈', '설화수',
   '이니스프리', '라로슈포제', '세타필', '닥터지', '메디큐브', '바이오힐 보', 'VT',
   '피지오겔', '더마팩토리', '라운드랩', 'CNP Laboratory', 'AHC',
   '에스트라', '마녀공장', '닥터마티노', '시카팜', '바이오힐 보'].includes(p.brand)
).slice(0, 50);

/**
 * 스킨케어 루틴 트래커 v1.0
 * 제품 등록 (사진 AI / 수동), 루틴 체크, 효과 분석
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  TRACKER_CATEGORIES, getProducts, saveProduct, deleteProduct, toggleFavorite,
  computeAllCorrelations, computeCorrelation, compressProductThumb, dedupeProductsByName, reorderProducts,
} from '../storage/TrackerStorage';
import CareRecommendation from '../components/CareRecommendation';
import ProductRegisteredModal from '../components/ProductRegisteredModal';
import SwipeableRow from '../components/SwipeableRow';
import { hapticLight, hapticSelection } from '../utils/haptics';
import { getAllProductThumbs, migrateThumbsFromLocalStorage } from '../storage/ImageStore';
import { PRODUCTS } from '../data/ProductCatalog';
import { KOREAN_PRODUCTS, POPULAR_KOREAN_PRODUCTS } from '../data/KoreanProducts';
import TossLineChart from '../components/TossLineChart';

// 네이버 쇼핑에서 제품 누끼 이미지 + 정확한 브랜드명 검색.
// fast=true (자동완성용): URL만 반환, base64 다운로드 없이 ~500ms 빠름.
// 미지정 (등록 영구 저장용): base64로 안정 저장.
async function fetchProductInfo(brand, name, opts = {}) {
  try {
    const query = `${brand} ${name}`.trim();
    if (!query) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.fast ? 4000 : 8000);
    const res = await fetch('/api/product-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, brand, name, fast: !!opts.fast }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      image: data.image || null,
      brand: data.brand || null,
      title: data.title || null,
    };
  } catch { return null; }
}

// 브랜드·제품명·성분 키워드로 카테고리 추론. 사용자가 카테고리 selector를 직접 안 눌러도 자동 매칭.
// 우선순위: 더 구체적인 키워드부터 (선크림·클렌저·마스크팩 > 에센스·세럼 > 토너·크림)
function inferCategory(brand, name, ingredients = []) {
  const ingText = Array.isArray(ingredients) ? ingredients.join(' ') : (ingredients || '');
  const text = `${brand || ''} ${name || ''} ${ingText}`.toLowerCase();
  const rules = [
    { cat: '선크림',   kw: ['선크림','썬크림','선스크린','썬스크린','sunscreen','sun screen','sun block','선블록','자외선','spf','pa+'] },
    { cat: '클렌저',   kw: ['클렌징','클렌저','폼클','세안','cleanser','cleansing','클린저','클렌징오일','클렌징밤','클렌징젤','클렌징워터','폼','버블'] },
    { cat: '마스크팩', kw: ['마스크','시트','sheet mask','sleeping mask','슬리핑마스크','슬리핑팩'] },
    { cat: '에센스',   kw: ['에센스','essence','부스터','퍼스트','first treatment','윤조'] },
    { cat: '세럼',     kw: ['세럼','앰플','serum','ampoule','ampule','컨센트레이트','concentrate'] },
    { cat: '토너',     kw: ['토너','toner','스킨','미스트','mist','토닉','tonic','후레쉬너','fresher'] },
    { cat: '크림',     kw: ['크림','cream','로션','lotion','모이스처','moisturizer','이멀젼','emulsion','밤','balm','아쿠아젤','수분젤'] },
  ];
  for (const r of rules) {
    for (const k of r.kw) {
      if (text.includes(k)) return r.cat;
    }
  }
  return '기타';
}

// 제품 사진 → API용 리사이즈.
// EXIF orientation을 항상 적용해서 세로로 찍은 모바일 사진이 가로로 보이는 일이 없게 함.
// createImageBitmap이 미지원이거나 실패하면 <img> 경로로 폴백.
async function resizeForApi(dataUrl, maxSize = 1024, quality = 0.85) {
  const drawAndEncode = (source, w, h) => {
    let dw = w, dh = h;
    if (dw > maxSize || dh > maxSize) {
      if (dw >= dh) { dh = Math.round((maxSize / dw) * dh); dw = maxSize; }
      else { dw = Math.round((maxSize / dh) * dw); dh = maxSize; }
    }
    const c = document.createElement('canvas');
    c.width = dw; c.height = dh;
    c.getContext('2d').drawImage(source, 0, 0, dw, dh);
    return c.toDataURL('image/jpeg', quality);
  };

  // 1순위: createImageBitmap + imageOrientation 'from-image' (EXIF 자동 적용)
  if (typeof createImageBitmap === 'function') {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      const out = drawAndEncode(bmp, bmp.width, bmp.height);
      bmp.close?.();
      return out;
    } catch { /* fallthrough */ }
  }

  // 폴백: <img> 태그 (모던 브라우저는 대부분 EXIF 자동 처리하나 보장은 안 됨)
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(drawAndEncode(img, img.width, img.height));
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ===== MiniLineChart — 토스 스타일 sparkline (TossLineChart compact 모드 wrapper) =====

function MiniLineChart({ data, accent, height = 60 }) {
  return <TossLineChart data={data} accent={accent} height={height} compact />;
}

// ===== Overlay wrapper =====

function SheetOverlay({ onClose, children }) {
  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'none',
        display: 'flex', alignItems: 'flex-end',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div style={{
        width: '100%', borderRadius: '20px 20px 0 0',
        maxHeight: '85dvh', overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        animation: 'slideUp 0.35s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

function SheetHandle() {
  return <div style={{ width: 36, height: 4, borderRadius: 2, margin: '0 auto 20px', background: 'var(--sheet-handle)' }} />;
}

// ===== 카테고리 셀렉터 =====

const CAT_KEYS = Object.keys(TRACKER_CATEGORIES);

function CategorySelector({ value, onChange, accent }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      {CAT_KEYS.map(key => {
        const cat = TRACKER_CATEGORIES[key];
        const active = value === key;
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            border: active ? `1.5px solid ${cat.color}` : 'var(--item-border)',
            background: active ? `${cat.color}18` : 'var(--item-bg)',
            borderRadius: 12, padding: '10px 4px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 18 }}>{cat.emoji}</span>
            <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? cat.color : 'var(--tag-color)' }}>{key}</span>
          </button>
        );
      })}
    </div>
  );
}

// ===== 시간대 셀렉터 =====

function TimeSlotSelector({ value, onChange, accent }) {
  const opts = [
    { key: 'morning', label: '아침' },
    { key: 'night', label: '저녁' },
    { key: 'both', label: '아침+저녁' },
  ];
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {opts.map(o => {
        const active = value === o.key;
        return (
          <button key={o.key} onClick={() => onChange(o.key)} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer',
            border: active ? `1.5px solid ${accent}` : 'var(--item-border)',
            background: active ? `${accent}18` : 'transparent',
            color: active ? accent : 'var(--tag-color)',
            fontSize: 13, fontWeight: active ? 600 : 400,
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

// ===== 제품 등록 메뉴 시트 =====

function AddProductSheet({ onClose, onPhoto, onManual, accent }) {
  return (
    <SheetOverlay onClose={onClose}>
      <div style={{ background: 'var(--sheet-bg)', padding: '24px 20px 40px' }}>
        <SheetHandle />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 20 }}>제품 등록</div>
        {[
          { emoji: '', label: '사진으로 등록', desc: 'AI가 제품명과 성분을 자동 인식해요', action: onPhoto },
          { emoji: '', label: '직접 입력', desc: '제품 정보를 수동으로 입력해요', action: onManual },
        ].map((opt, i) => (
          <div key={i} onClick={opt.action} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '16px 14px',
            borderRadius: 14, cursor: 'pointer', marginBottom: 8,
            background: 'var(--item-bg)',
            border: 'var(--item-border)',
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accent}15` }}>
              {opt.emoji}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </SheetOverlay>
  );
}

// ===== 사진 등록 플로우 =====

function PhotoRegistrationFlow({ onClose, onSave, saving, accent }) {
  const [step, setStep] = useState('capture');
  const [imageThumb, setImageThumb] = useState(null);
  const [form, setForm] = useState({ brand: '', name: '', category: '기타', timeSlot: 'both', ingredients: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cameraRef = useRef(null);
  const albumRef = useRef(null);
  // 사진 등록 흐름도 카테고리 자동 추론·자동완성 선택 시 보존 적용
  const categoryTouchedRef = useRef(false);

  useEffect(() => {
    if (categoryTouchedRef.current) return;
    if (!form.brand && !form.name) return;
    const guess = inferCategory(form.brand, form.name, form.ingredients);
    if (guess !== '기타' && guess !== form.category) {
      setForm(prev => ({ ...prev, category: guess }));
    }
  }, [form.brand, form.name]);

  // 자동완성 선택: 사진 thumb는 보존, brand·name·category·시간대·성분만 갱신
  const handlePickSuggestion = (s) => {
    const finalCat = (s.category && s.category !== '기타')
      ? s.category
      : inferCategory(s.brand, s.name, s.ingredients);
    setForm(prev => ({
      ...prev,
      brand: s.brand,
      name: s.name,
      category: finalCat,
      timeSlot: s.timeSlot || prev.timeSlot,
      ingredients: s.ingredients && s.ingredients.length > 0 ? s.ingredients : prev.ingredients,
    }));
    categoryTouchedRef.current = false;
  };

  // 다시 촬영: capture step으로 되돌리고 폼 초기화
  const handleRetake = () => {
    setStep('capture');
    setImageThumb(null);
    setForm({ brand: '', name: '', category: '기타', timeSlot: 'both', ingredients: [] });
    setError(null);
    categoryTouchedRef.current = false;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      setStep('loading');
      setLoading(true);
      setError(null);

      try {
        // 썸네일 저장
        const thumb = await compressProductThumb(dataUrl);
        setImageThumb(thumb);

        // API용 이미지 리사이즈 (정규화 없이)
        const compressed = await resizeForApi(dataUrl, 1024, 0.85);
        const base64 = compressed.split(',')[1];

        // 12초 타임아웃
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        let res;
        try {
          res = await fetch('/api/product-recognize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 }),
            signal: controller.signal,
          });
        } finally { clearTimeout(timer); }

        if (!res.ok) throw new Error('API error');
        const data = await res.json();

        let gptBrand = data.brand === '알 수 없음' ? '' : (data.brand || '');
        let gptName = data.name === '알 수 없음' ? '' : (data.name || '');

        // 네이버 쇼핑으로 브랜드명 + 제품명 보정 + 누끼 이미지
        if (gptBrand || gptName) {
          try {
            const info = await fetchProductInfo(gptBrand, gptName);
            if (info) {
              // 누끼 이미지로 교체
              if (info.image) {
                const naverThumb = await compressProductThumb(info.image);
                if (naverThumb) setImageThumb(naverThumb);
              }
              // 정확한 브랜드명으로 보정
              if (info.brand) gptBrand = info.brand;
              // 네이버 타이틀에서 제품명 추출 (브랜드 제거 + 용량 제거)
              if (info.title && info.brand) {
                const brandPattern = new RegExp(`^${info.brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i');
                let cleanName = info.title.replace(brandPattern, '');
                cleanName = cleanName.replace(/\s+\d+\s*(?:ml|g|oz|L|개|매|장|팩|세트|박스|ea|본품|리필).*$/i, '').trim();
                if (cleanName) gptName = cleanName;
              }
            }
          } catch { /* 네이버 실패 시 GPT 결과 유지 */ }
        }

        // GPT가 카테고리 못 줬거나 '기타'로 줬으면 키워드 추론으로 보강
        const recogCat = (data.category && data.category !== '기타')
          ? data.category
          : inferCategory(gptBrand, gptName, data.ingredients);
        setForm({
          brand: gptBrand,
          name: gptName,
          category: recogCat,
          timeSlot: 'both',
          ingredients: data.ingredients || [],
        });
      } catch {
        setError('제품 인식에 실패했어요. 정보를 직접 입력해주세요.');
        setForm({ brand: '', name: '', category: '기타', timeSlot: 'both', ingredients: [] });
      }
      setLoading(false);
      setStep('confirm');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.brand.trim() || !form.name.trim() || saving) return;
    onSave({ ...form, imageThumb });
  };

  return (
    <SheetOverlay onClose={onClose}>
      <div style={{ background: 'var(--sheet-bg)', padding: '24px 20px calc(40px + env(safe-area-inset-bottom, 0px))' }}>
        <SheetHandle />

        {/* 촬영 단계 */}
        {step === 'capture' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 8 }}>제품 사진 촬영</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 18 }}>
              아래 가이드대로 촬영하면 인식 정확도가 올라가요
            </p>

            {/* 촬영 가이드 카드 — 인식 실패를 줄이는 3가지 핵심 */}
            <div style={{
              background: 'var(--item-bg)', border: 'var(--item-border)',
              borderRadius: 14, padding: '14px 16px', marginBottom: 20,
            }}>
              {[
                { title: '라벨이 정면으로', desc: '브랜드·제품명이 비스듬하지 않게' },
                { title: '빛 반사 피하기', desc: '형광등·창가 직광은 글자를 가려요' },
                { title: '가까이 또렷하게', desc: '글씨가 또렷하게 보일 만큼 가깝게' },
              ].map((g, i, arr) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  paddingTop: i === 0 ? 0 : 10,
                  paddingBottom: i === arr.length - 1 ? 0 : 10,
                  borderBottom: i === arr.length - 1 ? 'none' : '1px solid rgba(0,0,0,0.05)',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: `${accent}18`, color: accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{g.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', letterSpacing: -0.1 }}>{g.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
            <input ref={albumRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: '카메라', ref: cameraRef, primary: true },
                { label: '앨범', ref: albumRef, primary: false },
              ].map((btn, i) => (
                <button key={i} onClick={() => btn.ref.current?.click()} style={{
                  flex: 1, padding: '16px 0', borderRadius: 14, cursor: 'pointer',
                  border: btn.primary ? 'none' : 'var(--item-border)',
                  background: btn.primary ? accent : 'var(--item-bg)',
                  color: btn.primary ? '#fff' : 'var(--text-primary)',
                  fontSize: 15, fontWeight: 600,
                }}>{btn.label}</button>
              ))}
            </div>
          </>
        )}

        {/* 로딩 */}
        {step === 'loading' && loading && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            {imageThumb && (
              <img src={imageThumb} alt="" style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover', marginBottom: 16 }} />
            )}
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              AI가 제품을 분석중이에요...
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', margin: '0 auto 16px',
              border: `3px solid ${accent}30`, borderTopColor: accent,
              animation: 'spin 1s linear infinite',
            }} />
            <button onClick={() => { setLoading(false); setError('인식을 취소했어요. 정보를 직접 입력해주세요.'); setStep('confirm'); }} style={{
              padding: '8px 20px', borderRadius: 10, border: 'var(--item-border)',
              background: 'transparent', color: 'var(--tag-color)', fontSize: 13, cursor: 'pointer',
            }}>직접 입력하기</button>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* 확인/수정 */}
        {step === 'confirm' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 16 }}>제품 정보 확인</div>

            {error && (
              <div style={{ fontSize: 12, color: '#F0B870', background: 'rgba(251,191,36,0.1)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
                {error}
              </div>
            )}

            {imageThumb && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <img src={imageThumb} alt="" style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover' }} />
              </div>
            )}

            {/* 성분 태그 (AI가 추출한 경우) */}
            {form.ingredients.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>인식된 성분</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {form.ingredients.map((ing, i) => (
                    <span key={i} style={{
                      fontSize: 11, color: accent, background: `${accent}12`,
                      borderRadius: 8, padding: '4px 10px', fontWeight: 500,
                    }}>{ing}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 폼 필드 — 자동완성 input 공용 컴포넌트로 통일.
                사진 인식 후 사용자가 brand/name 수정하면 자동완성 추천이 떠서 정확한 한국 제품 선택 가능 */}
            <ProductBrandNameInputs
              brand={form.brand}
              name={form.name}
              onBrandChange={v => setForm(prev => ({ ...prev, brand: v }))}
              onNameChange={v => setForm(prev => ({ ...prev, name: v }))}
              onPickSuggestion={handlePickSuggestion}
              accent={accent}
              brandPlaceholder="예: 코스알엑스"
              namePlaceholder="예: 히알루론산 세럼"
              helpText="브랜드·제품명을 수정하면 정확한 한국 제품이 자동으로 떠요"
            />

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>카테고리 <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>자동 매칭</span></div>
              <CategorySelector value={form.category} onChange={v => { categoryTouchedRef.current = true; setForm(p => ({ ...p, category: v })); }} accent={accent} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>사용 시간대</div>
              <TimeSlotSelector value={form.timeSlot} onChange={v => setForm(p => ({ ...p, timeSlot: v }))} accent={accent} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={handleRetake} disabled={saving} style={{
                flex: '0 0 38%', padding: '14px 0', borderRadius: 14,
                border: 'var(--item-border)', background: 'transparent',
                color: 'var(--tag-color)', fontSize: 14, fontWeight: 600,
                cursor: saving ? 'default' : 'pointer',
              }}>다시 촬영</button>
              <button type="button" onClick={handleSave} disabled={!form.brand.trim() || !form.name.trim() || saving} style={{
                flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
                cursor: (form.brand.trim() && form.name.trim() && !saving) ? 'pointer' : 'default',
                background: (!form.brand.trim() || !form.name.trim() || saving) ? ('var(--text-disabled)') : accent,
                color: (!form.brand.trim() || !form.name.trim() || saving) ? ('var(--text-dim)') : '#fff',
                fontSize: 15, fontWeight: 700, position: 'relative', zIndex: 1,
              }}>{saving ? '제품 이미지 검색 중...' : '등록하기'}</button>
            </div>
          </>
        )}
      </div>
    </SheetOverlay>
  );
}

// ===== 수동 등록 폼 =====

// ===== 제품 누끼 이미지 캐시 (localStorage, 30일) =====
const IMG_CACHE_KEY = 'lua_product_img_cache_v1';
const IMG_CACHE_TTL = 30 * 86400 * 1000;
function getImgFromCache(brand, name) {
  try {
    const cache = JSON.parse(localStorage.getItem(IMG_CACHE_KEY) || '{}');
    const key = `${(brand || '').toLowerCase()}|${(name || '').toLowerCase()}`;
    const hit = cache[key];
    if (!hit) return undefined;
    if (Date.now() - hit.at > IMG_CACHE_TTL) return undefined;
    return hit.image; // null도 valid cache (이미지 없음 확정)
  } catch { return undefined; }
}
function setImgCache(brand, name, image) {
  try {
    const cache = JSON.parse(localStorage.getItem(IMG_CACHE_KEY) || '{}');
    const key = `${(brand || '').toLowerCase()}|${(name || '').toLowerCase()}`;
    cache[key] = { image: image || null, at: Date.now() };
    // 최근 200개만 유지
    const entries = Object.entries(cache);
    if (entries.length > 200) {
      entries.sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
      const trimmed = Object.fromEntries(entries.slice(0, 200));
      localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(IMG_CACHE_KEY, JSON.stringify(cache));
    }
  } catch {}
}

// 인기 브랜드 set — 자동완성 정렬 boost용. 모듈 레벨로 상수 처리해서 매 렌더 재계산 방지.
const POPULAR_BRAND_SET = new Set(POPULAR_KOREAN_PRODUCTS.map(p => p.brand));

// ===== 자동완성 brand/name input 공용 컴포넌트 =====
// 수동 등록·사진 등록 두 흐름에서 동일하게 사용.
// 사용자가 brand·name input에 타이핑 → 한국 인기 95개 데이터셋 즉시 매칭 + 필요 시 GPT 보강.
// 추천 클릭 → onPickSuggestion 콜백으로 상위 form에 위임.
function ProductBrandNameInputs({
  brand, name,
  onBrandChange, onNameChange,
  onPickSuggestion,
  accent,
  brandPlaceholder = '예: 토리든, 코스알엑스, 셀퓨전씨',
  namePlaceholder = '예: 다이브인 저분자 히알루론산 토너',
  helpText = '브랜드명만 입력해도 관련 제품이 자동으로 떠요',
}) {
  const [activeField, setActiveField] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]); // [{brand,name,category,timeSlot,ingredients,volume,source,image,imgLoading}]
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const userSelectedRef = useRef(false);
  const lastQueryRef = useRef('');
  const cacheRef = useRef(new Map()); // query → results
  const abortRef = useRef(null); // 이전 GPT fetch 즉시 cancel
  const activeFieldRef = useRef(null);
  useEffect(() => { activeFieldRef.current = activeField; }, [activeField]);
  // brand 값을 최신 상태로 ref 유지 (useEffect 내부 fetch에서 활용)
  const brandRef = useRef(brand);
  useEffect(() => { brandRef.current = brand; }, [brand]);

  // 로컬 매칭 — KOREAN_PRODUCTS + ProductCatalog. 0ms 즉시 응답.
  // multi-token 매칭: 사용자가 "피지오겔 토너"·"수분 세럼" 같이 여러 키워드를 쳐도 매칭.
  // 각 토큰이 brand·name·category·ingredients 어디든 들어가면 점수.
  // 모든 토큰을 만족해야 매칭(AND).
  // 정렬: score 우선 → 인기 brand 우선 → brand 다양성 dedup(한 brand 최대 2개).
  const localMatch = (q) => {
    const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
    const tokens = (q || '')
      .toLowerCase()
      .split(/\s+/)
      .map(t => t.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter(Boolean);
    if (tokens.length === 0) return [];

    const scoreOne = (token, nb, nn, nc, ni) => {
      if (!token) return 0;
      if (nb === token) return 100;
      if (nb.startsWith(token)) return 80;
      if (nb.includes(token)) return 60;
      if (nn.includes(token)) return 40;
      if (nc.includes(token)) return 30;
      if (ni.includes(token)) return 20;
      return 0;
    };

    const scoreProduct = (brand, name, category, ingredients) => {
      const nb = norm(brand);
      const nn = norm(name);
      const nc = norm(category);
      const ni = norm(Array.isArray(ingredients) ? ingredients.join('') : (ingredients || ''));
      let total = 0;
      for (const t of tokens) {
        const s = scoreOne(t, nb, nn, nc, ni);
        if (s === 0) return 0; // AND: 모든 토큰 만족 필수
        total += s;
      }
      return total;
    };

    const scored = [];
    const seen = new Set();

    // 우선순위 1: 한국 인기 제품 데이터셋
    for (const p of KOREAN_PRODUCTS) {
      const s = scoreProduct(p.brand, p.name, p.category, p.ingredients);
      if (s === 0) continue;
      const key = `${p.brand}|${p.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // 인기 brand boost — 같은 점수일 때 인기 brand가 위로
      const popBoost = POPULAR_BRAND_SET.has(p.brand) ? 10 : 0;
      scored.push({ ...p, source: 'local', _score: s + popBoost });
    }

    // 우선순위 2: ProductCatalog (보조)
    for (const p of PRODUCTS) {
      const s = scoreProduct(p.brand, p.name, '기타', p.tags);
      if (s === 0) continue;
      const key = `${p.brand}|${p.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const popBoost = POPULAR_BRAND_SET.has(p.brand) ? 10 : 0;
      scored.push({
        brand: p.brand,
        name: p.name,
        category: inferCategory(p.brand, p.name, p.tags),
        timeSlot: 'both',
        ingredients: (p.tags || []).slice(0, 4),
        volume: p.volume || '',
        source: 'local',
        _score: s + popBoost - 5,
      });
    }

    scored.sort((a, b) => b._score - a._score);

    // brand 다양성 — 한 brand 최대 2개 (사용자가 인기순으로 다양한 brand 보고 싶음)
    const brandCount = new Map();
    const diverse = [];
    for (const p of scored) {
      const c = brandCount.get(p.brand) || 0;
      if (c >= 2) continue;
      brandCount.set(p.brand, c + 1);
      diverse.push(p);
      if (diverse.length >= 10) break;
    }

    return diverse.map(({ _score, ...rest }) => rest);
  };

  // GPT 검색 (디바운스). 입력 즉시 skeleton 표시 → GPT 응답 도착 시 swap.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSuggestions([]); setSearchError(''); setSearchLoading(false); return; }
    if (userSelectedRef.current) { userSelectedRef.current = false; return; }

    // 로컬 즉시 매칭
    const local = localMatch(q);

    // 캐시 확인 — 즉각 반환 (0ms)
    if (cacheRef.current.has(q)) {
      const gpt = cacheRef.current.get(q);
      setSuggestions(mergeSuggestions(local, gpt));
      setSearchLoading(false);
      setSearchError('');
      return;
    }

    // 입력 즉시: 로컬 매칭 + skeleton 카드들로 즉각 노출
    if (local.length > 0) {
      setSuggestions(local);
    } else {
      setSuggestions([]);
    }

    // 로컬 매칭이 충분(5개 이상)하면 GPT 호출 자체를 skip — 즉시 응답, 스켈레톤 안 보임.
    // 95개 한국 인기 데이터셋이 대부분 검색어를 커버하므로 체감 속도 대폭 개선.
    if (local.length >= 5) {
      setSearchLoading(false);
      setSearchError('');
      // 이전 진행 중인 GPT 호출이 있으면 cancel
      if (abortRef.current) { try { abortRef.current.abort(); } catch {} abortRef.current = null; }
      return;
    }

    setSearchLoading(true);
    setSearchError('');

    // 새 GPT 호출 전에 이전 fetch abort
    if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
    const controller = new AbortController();
    abortRef.current = controller;

    const t = setTimeout(async () => {
      lastQueryRef.current = q;
      const mode = activeFieldRef.current === 'brand' ? 'brand'
                 : activeFieldRef.current === 'name' ? 'name'
                 : 'any';
      const brandHint = brandRef.current?.trim() || '';
      try {
        const r = await fetch('/api/product-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, mode, brand: mode === 'name' ? brandHint : '' }),
          signal: controller.signal,
        });
        if (lastQueryRef.current !== q) return;
        if (!r.ok || !r.body) {
          setSearchError(local.length > 0 ? '' : 'AI 검색이 잠깐 안 돼요. 그대로 입력해도 등록돼요.');
          setSearchLoading(false);
          return;
        }
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        const gptProducts = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (lastQueryRef.current !== q) { try { reader.cancel(); } catch {}; return; }
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const ln of lines) {
            const trimmed = ln.trim();
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr || dataStr === '[DONE]') continue;
            let evt;
            try { evt = JSON.parse(dataStr); } catch { continue; }
            if (evt.error) {
              // raw OpenAI 에러 노출 X. 로컬 결과 있으면 에러 자체 숨김
              setSearchError(local.length > 0 ? '' : 'AI 검색이 잠깐 안 돼요. 그대로 입력해도 등록돼요.');
              continue;
            }
            if (evt.product) {
              // GPT가 category를 '기타'로 줬으면 키워드 추론으로 보강 (사용자가 카테고리 다시 누르지 않게)
              const ep = evt.product;
              const cat = (ep.category && ep.category !== '기타') ? ep.category : inferCategory(ep.brand, ep.name, ep.ingredients);
              const p = { ...ep, category: cat, source: 'gpt' };
              // strict 필터 — 사용자 의도 보호
              const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
              if (mode === 'brand') {
                // brand input — GPT 결과 중 검색어와 brand가 강하게 일치하는 것만
                const nq = norm(q);
                const nb = norm(p.brand);
                if (!(nb === nq || nb.startsWith(nq) || nq.startsWith(nb) || nb.includes(nq) || nq.includes(nb))) {
                  continue; // skip
                }
              } else if (mode === 'name' && brandHint) {
                // name input + brand 명시 — brand 정확히 일치 외에는 skip
                if (norm(p.brand) !== norm(brandHint)) continue;
              }
              gptProducts.push(p);
              // 도착 즉시 화면에 반영
              setSuggestions(prev => {
                const merged = mergeSuggestions(local, gptProducts);
                return merged;
              });
            }
          }
        }
        cacheRef.current.set(q, gptProducts);
        setSearchLoading(false);
      } catch (e) {
        // 의도된 cancel(다음 keystroke로 새 검색 시작)은 무시
        if (e?.name === 'AbortError') return;
        if (lastQueryRef.current !== q) return;
        setSearchError(local.length > 0 ? '' : '네트워크가 잠깐 불안정해요. 그대로 입력해도 돼요.');
        setSearchLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      // unmount/재실행 시 진행 중 fetch도 같이 cancel
      if (abortRef.current === controller) {
        try { controller.abort(); } catch {}
        abortRef.current = null;
      }
    };
  }, [searchQuery]);

  function mergeSuggestions(local, gpt) {
    const seen = new Set();
    const out = [];
    for (const list of [local, gpt]) {
      for (const p of list) {
        const key = `${(p.brand || '').toLowerCase()}|${(p.name || '').toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const cached = getImgFromCache(p.brand, p.name);
        out.push({
          ...p,
          image: cached !== undefined ? cached : null,
          imgLoading: cached === undefined,
        });
      }
    }
    return out.slice(0, 10);
  }

  // 진행 중 fetch 중복 방지
  const inflightRef = useRef(new Set());
  // suggestions가 바뀔 때마다 imgLoading=true인 것들에 대해 비동기 이미지 fetch.
  // fast=true 모드 — URL만 받아서 즉시 표시 (base64 다운로드 X). 등록 시점엔 별도로 안정 경로로 다시 받음.
  useEffect(() => {
    const targets = suggestions.filter(s => {
      const key = `${s.brand}|${s.name}`;
      return s.imgLoading && !inflightRef.current.has(key);
    });
    if (targets.length === 0) return;
    const fetchOne = async (s) => {
      const key = `${s.brand}|${s.name}`;
      inflightRef.current.add(key);
      try {
        const info = await fetchProductInfo(s.brand, s.name, { fast: true });
        const image = info?.image || null;
        setImgCache(s.brand, s.name, image);
        setSuggestions(prev => prev.map(p =>
          p.brand === s.brand && p.name === s.name
            ? { ...p, image, imgLoading: false }
            : p
        ));
      } catch {
        setSuggestions(prev => prev.map(p =>
          p.brand === s.brand && p.name === s.name
            ? { ...p, image: null, imgLoading: false }
            : p
        ));
      } finally {
        inflightRef.current.delete(key);
      }
    };
    // 첫 5개 우선 fetch (화면에 보이는 것), 나머지 background
    targets.slice(0, 8).forEach(fetchOne);
  }, [suggestions]);

  // 필드 입력 시 검색 query 업데이트
  // 사용자 의도 시그널: brand input에 친 거면 brand-only 검색, name이면 name 키워드 검색.
  // 검색 요청에 mode + brandHint 전달 → GPT가 다른 브랜드 섞지 않음.
  const onBrandFieldChange = (v) => { onBrandChange(v); setSearchQuery(v); };
  const onNameFieldChange = (v) => {
    onNameChange(v);
    const composed = brand ? `${brand} ${v}`.trim() : v.trim();
    setSearchQuery(composed);
  };

  const handleSuggestionClick = (s) => {
    userSelectedRef.current = true;
    onPickSuggestion(s);
    setSuggestions([]);
    setActiveField(null);
    setSearchQuery('');
  };

  const showSuggestions = activeField && (suggestions.length > 0 || searchLoading || searchError);

  const fields = [
    { label: '브랜드', key: 'brand', value: brand, onChange: onBrandFieldChange, placeholder: brandPlaceholder },
    { label: '제품명', key: 'name', value: name, onChange: onNameFieldChange, placeholder: namePlaceholder },
  ];

  return (
    <>
      {helpText && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16, letterSpacing: -0.1 }}>
          {helpText}
        </div>
      )}
      {fields.map(f => (
        <div key={f.key} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>{f.label}</div>
          <input
            type="text"
            autoComplete="off"
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            onFocus={() => setActiveField(f.key)}
            onBlur={() => setTimeout(() => setActiveField(null), 200)}
            placeholder={f.placeholder}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 16,
              border: 'var(--item-border)',
              background: 'var(--item-bg)',
              color: 'var(--text-primary)',
              outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        ))}

        {showSuggestions && (
          <div style={{
            marginTop: -4, marginBottom: 14,
            border: 'var(--item-border)', borderRadius: 12,
            background: 'var(--item-bg)',
            maxHeight: 300, overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}>
            <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
            {/* 입력 즉시 skeleton 카드 5개 (이미 매칭된 로컬 결과 아래로 누적) */}
            {searchLoading && (
              [...Array(Math.max(0, 5 - suggestions.length))].map((_, k) => (
                <div key={`sk-${k}`} style={{
                  padding: '11px 14px',
                  borderTop: (suggestions.length + k) > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  display: 'flex', gap: 12, alignItems: 'center',
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.05) 100%)',
                    backgroundSize: '200% 100%',
                    animation: `shimmer 1.2s ease-in-out infinite ${k * 0.08}s`,
                  }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{
                      width: '40%', height: 11, borderRadius: 4,
                      background: 'linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.05) 100%)',
                      backgroundSize: '200% 100%',
                      animation: `shimmer 1.2s ease-in-out infinite ${k * 0.08}s`,
                    }} />
                    <div style={{
                      width: '78%', height: 13, borderRadius: 4,
                      background: 'linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.05) 100%)',
                      backgroundSize: '200% 100%',
                      animation: `shimmer 1.2s ease-in-out infinite ${k * 0.08 + 0.04}s`,
                    }} />
                  </div>
                </div>
              ))
            )}
            {searchError && !searchLoading && (
              <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{searchError}</div>
            )}
            {suggestions.map((s, i) => (
              <button
                key={`${s.brand}-${s.name}-${i}`}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleSuggestionClick(s)}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '11px 14px',
                  background: 'transparent', border: 'none',
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  cursor: 'pointer', fontFamily: 'inherit',
                  color: 'var(--text-primary)',
                  display: 'flex', gap: 12, alignItems: 'center',
                }}
              >
                {/* 누끼 이미지 thumbnail */}
                <div style={{
                  width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                  background: '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  {s.image ? (
                    <img src={s.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : s.imgLoading ? (
                    <div style={{
                      width: '70%', height: '70%', borderRadius: 8,
                      background: 'linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.08) 50%, rgba(0,0,0,0.04) 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.2s ease-in-out infinite',
                    }} />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C8CDD3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="3" width="12" height="18" rx="2"/><line x1="9" y1="8" x2="15" y2="8"/>
                    </svg>
                  )}
                </div>
                {/* 텍스트 */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{s.brand}</span>
                    <span style={{
                      fontSize: 9.5, padding: '1px 5px', borderRadius: 4,
                      background: 'rgba(101,152,239,0.14)', color: '#6598ef', fontWeight: 600,
                    }}>{s.category}</span>
                    {s.source === 'gpt' && (
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 'auto' }}>AI 검색</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 13.5, color: 'var(--text-primary)', letterSpacing: -0.1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{s.name}</div>
                  {(s.volume || (s.ingredients && s.ingredients.length > 0)) && (
                    <div style={{
                      fontSize: 10.5, color: 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.volume && <span>{s.volume}</span>}
                      {s.volume && s.ingredients && s.ingredients.length > 0 && <span> · </span>}
                      {s.ingredients && s.ingredients.length > 0 && <span>{s.ingredients.slice(0, 3).join(', ')}</span>}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
    </>
  );
}

// ===== 수동 등록 폼 =====
// brand/name input + 추천 리스트는 공용 ProductBrandNameInputs.
// 카테고리·시간대·등록 버튼만 여기서.
function ManualRegistrationForm({ onClose, onSave, saving, accent }) {
  const [form, setForm] = useState({ brand: '', name: '', category: '기타', timeSlot: 'both' });
  // 사용자가 카테고리 selector를 직접 눌렀는지 추적. 누른 후엔 자동 추론으로 덮어쓰지 않음.
  const categoryTouchedRef = useRef(false);

  // brand·name 변경 시 카테고리 자동 추론 (사용자가 selector 직접 안 눌렀을 때만)
  useEffect(() => {
    if (categoryTouchedRef.current) return;
    const guess = inferCategory(form.brand, form.name);
    if (guess !== form.category) {
      setForm(prev => ({ ...prev, category: guess }));
    }
  }, [form.brand, form.name]);

  const handlePickSuggestion = (s) => {
    const finalCat = (s.category && s.category !== '기타')
      ? s.category
      : inferCategory(s.brand, s.name, s.ingredients);
    setForm({
      brand: s.brand,
      name: s.name,
      category: finalCat,
      timeSlot: s.timeSlot,
      imageThumb: s.image || null,
      ingredients: s.ingredients && s.ingredients.length > 0
        ? { known: [], estimated: s.ingredients, source: s.source === 'gpt' ? 'gpt' : 'catalog' }
        : null,
    });
    categoryTouchedRef.current = false; // 자동완성 카테고리 보존
  };

  const handleSave = () => {
    if (!form.brand.trim() || !form.name.trim() || saving) return;
    onSave(form);
  };

  const canSave = form.brand.trim() && form.name.trim() && !saving;

  return (
    <SheetOverlay onClose={onClose}>
      <div style={{ background: 'var(--sheet-bg)', padding: '24px 20px calc(40px + env(safe-area-inset-bottom, 0px))' }}>
        <SheetHandle />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 6 }}>제품 직접 입력</div>

        <ProductBrandNameInputs
          brand={form.brand}
          name={form.name}
          onBrandChange={v => setForm(p => ({ ...p, brand: v }))}
          onNameChange={v => setForm(p => ({ ...p, name: v }))}
          onPickSuggestion={handlePickSuggestion}
          accent={accent}
        />

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>카테고리 <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>자동 매칭</span></div>
          <CategorySelector value={form.category} onChange={v => { categoryTouchedRef.current = true; setForm(p => ({ ...p, category: v })); }} accent={accent} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>사용 시간대</div>
          <TimeSlotSelector value={form.timeSlot} onChange={v => setForm(p => ({ ...p, timeSlot: v }))} accent={accent} />
        </div>

        <button type="button" onClick={handleSave} disabled={!canSave} style={{
          width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
          cursor: canSave ? 'pointer' : 'default',
          background: canSave ? accent : ('var(--text-disabled)'),
          color: canSave ? '#fff' : ('var(--text-dim)'),
          fontSize: 15, fontWeight: 700, position: 'relative', zIndex: 1,
        }}>{saving ? '제품 이미지 검색 중...' : '등록하기'}</button>
      </div>
    </SheetOverlay>
  );
}

// ===== 제품 상세 시트 =====

function ProductDetailSheet({ product, onClose, onDelete, onEdit, onToggleFavorite, accent }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [memo, setMemo] = useState(product.memo || '');
  const [memoSaved, setMemoSaved] = useState(false);
  const [feeling, setFeeling] = useState(product.feeling || null);
  const [rating, setRating] = useState(product.rating || 0);
  const ratingRef = useRef(null);
  const lastRatingRef = useRef(product.rating || 0);

  // 별점 터치/드래그 핸들러
  const calcRating = (clientX) => {
    const el = ratingRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const starWidth = rect.width / 5;
    return Math.max(0, Math.min(5, Math.ceil(x / starWidth)));
  };
  const handleRatingInteraction = (clientX) => {
    const next = calcRating(clientX);
    if (next !== lastRatingRef.current && next >= 1) {
      lastRatingRef.current = next;
      setRating(next);
      hapticSelection();
      // 웹 사운드 (Capacitor/네이티브 아닐 때)
      try {
        if (!window.Capacitor?.isNativePlatform?.()) {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 600 + next * 80;
          gain.gain.value = 0.04;
          osc.start(); osc.stop(ctx.currentTime + 0.03);
        }
      } catch {}
    }
  };
  const onRatingTouchStart = (e) => { e.preventDefault(); handleRatingInteraction(e.touches[0].clientX); };
  const onRatingTouchMove = (e) => { e.preventDefault(); handleRatingInteraction(e.touches[0].clientX); };
  const onRatingTouchEnd = () => { if (rating > 0) onEdit({ id: product.id, rating }); };
  const onRatingClick = (star) => {
    const next = rating === star ? 0 : star;
    setRating(next);
    lastRatingRef.current = next;
    hapticSelection();
    onEdit({ id: product.id, rating: next });
  };

  const [form, setForm] = useState({
    brand: product.brand, name: product.name,
    category: product.category, timeSlot: product.timeSlot,
  });
  const cat = TRACKER_CATEGORIES[editing ? form.category : product.category] || TRACKER_CATEGORIES['기타'];
  const days = Math.max(0, Math.floor((Date.now() - new Date(product.startDate)) / 86400000));

  const handleSaveEdit = () => {
    if (!form.brand.trim() || !form.name.trim()) return;
    onEdit({ id: product.id, ...form });
    setEditing(false);
  };

  return (
    <SheetOverlay onClose={onClose}>
      <div style={{ background: 'var(--sheet-bg)', padding: '24px 20px calc(40px + env(safe-area-inset-bottom, 0px))' }}>
        <SheetHandle />

        {!editing ? (
          <>
            {/* 상단: 별점 (좌) · 수정/하트/삭제 (우) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              {/* 별점 */}
              <div
                ref={ratingRef}
                onTouchStart={onRatingTouchStart}
                onTouchMove={onRatingTouchMove}
                onTouchEnd={onRatingTouchEnd}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 2,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none', WebkitUserSelect: 'none',
                }}
              >
                {[1, 2, 3, 4, 5].map(star => {
                  const filled = star <= rating;
                  return (
                    <svg
                      key={star}
                      onClick={() => onRatingClick(star)}
                      width="20" height="20" viewBox="0 0 24 24"
                      style={{
                        transition: 'transform 0.15s ease',
                        transform: filled ? 'scale(1.05)' : 'scale(1)',
                        filter: filled ? 'drop-shadow(0 1px 2px rgba(120,189,253,0.4))' : 'drop-shadow(0 0.5px 0.5px rgba(0,0,0,0.1))',
                      }}
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <path
                        d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z"
                        fill={filled ? '#78bdfd' : 'rgba(0,0,0,0.1)'}
                        stroke="none"
                      />
                    </svg>
                  );
                })}
              </div>
              {/* 우측 아이콘 */}
              <div style={{ display: 'flex', gap: 0 }}>
                <div onClick={() => setEditing(true)} style={{ cursor: 'pointer', padding: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d0d0d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
                    <path d="M13.5 6.5l4 4" />
                  </svg>
                </div>
                <div onClick={() => onToggleFavorite?.(product.id)} style={{ cursor: 'pointer', padding: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
                  {product.favorite ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffdaf0" stroke="none">
                      <path d="M6.979 3.074a6 6 0 0 1 4.988 1.425l.037 .033l.034 -.03a6 6 0 0 1 4.733 -1.44l.246 .036a6 6 0 0 1 3.364 10.008l-.18 .185l-.048 .041l-7.45 7.379a1 1 0 0 1 -1.313 .082l-.094 -.082l-7.493 -7.422a6 6 0 0 1 3.176 -10.215z" />
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d0d0d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
                    </svg>
                  )}
                </div>
                <div onClick={() => setConfirmDelete(true)} style={{ cursor: 'pointer', padding: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d0d0d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                    <path d="M9 12l6 0" />
                  </svg>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              {product.imageThumb ? (
                <img src={product.imageThumb} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 14, background: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                  {cat.emoji}
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{product.brand}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{product.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: cat.color, background: `${cat.color}15`, borderRadius: 6, padding: '2px 7px' }}>{product.category}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {product.timeSlot === 'both' ? '아침·저녁' : product.timeSlot === 'morning' ? '아침' : '저녁'}
                  </span>
                </div>
              </div>
            </div>

            {/* 제품 요약 카드 */}
            {(() => { try {
              // 카테고리→기대 효과 메트릭 매핑
              const CAT_METRICS = {
                '토너': ['moisture', 'poreScore', 'skinTone'],
                '세럼': ['moisture', 'elasticityScore', 'textureScore'],
                '에센스': ['moisture', 'elasticityScore', 'skinTone'],
                '크림': ['moisture', 'wrinkleScore', 'elasticityScore'],
                '선크림': ['pigmentationScore', 'skinTone', 'wrinkleScore'],
                '클렌저': ['poreScore', 'troubleCount', 'textureScore'],
                '마스크팩': ['moisture', 'skinTone', 'elasticityScore'],
                '기타': ['moisture', 'skinTone'],
              };
              const METRIC_LABELS = {
                moisture: '수분', skinTone: '피부톤', troubleCount: '트러블',
                oilBalance: '유수분', wrinkleScore: '주름', poreScore: '모공',
                elasticityScore: '탄력', pigmentationScore: '색소',
                textureScore: '피부결', darkCircleScore: '다크서클',
              };
              const METRIC_ICONS = {
                moisture: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l-6.5 11a6.5 6.5 0 1 0 13 0z"/></svg>,
                skinTone: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18"/></svg>,
                troubleCount: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>,
                oilBalance: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18a6 6 0 0 1 12 0"/><path d="M12 12v-8"/></svg>,
                wrinkleScore: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8c2 -2 4 2 6 0s4 -2 6 0"/><path d="M4 16c2 -2 4 2 6 0s4 -2 6 0"/></svg>,
                poreScore: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/></svg>,
                elasticityScore: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l-4 4"/><path d="M17 7l4 -4"/><path d="M3 21l18 -18"/></svg>,
                pigmentationScore: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>,
                textureScore: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>,
                darkCircleScore: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6598ef" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="4"/><circle cx="15" cy="12" r="4"/></svg>,
              };

              // 실제 상관 데이터 있으면 사용, 없으면 카테고리 기반 추론
              let benefitKeys = CAT_METRICS[product.category] || CAT_METRICS['기타'];
              let correlation = null;
              try { correlation = computeCorrelation(product); } catch {}
              if (correlation?.metrics?.length > 0) {
                const improved = correlation.metrics.filter(m => m.improved).map(m => m.key);
                if (improved.length > 0) benefitKeys = improved;
              }

              // 요약 텍스트 생성
              const rawIngs = Array.isArray(product.ingredients) ? product.ingredients
                : (product.ingredients?.estimated || product.ingredients?.known || []);
              const ings = rawIngs.slice(0, 3);
              const benefitLabels = benefitKeys.map(k => METRIC_LABELS[k]).filter(Boolean);
              let summary = '';
              if (ings.length > 0) {
                summary = `${ings.slice(0, 2).join(', ')} 성분으로 ${benefitLabels.slice(0, 2).join('·')} 관리에 도움을 줘요.`;
              } else {
                summary = `${product.category} 제품으로 ${benefitLabels.slice(0, 2).join('·')} 케어에 도움을 줘요.`;
              }

              const displayIngs = rawIngs.slice(0, 5);

              return (
                <div style={{
                  padding: '12px 16px', marginBottom: 12,
                  background: 'rgba(0,0,0,0.02)', borderRadius: 14,
                }}>
                  {/* 요약 */}
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: 10 }}>
                    {summary}
                  </div>
                  {/* 효과 메트릭 아이콘 */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: displayIngs.length > 0 ? 10 : 0 }}>
                    {benefitKeys.map(k => (
                      <div key={k} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '3px 8px', borderRadius: 8,
                        background: 'rgba(101,152,239,0.08)',
                      }}>
                        {METRIC_ICONS[k]}
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#6598ef' }}>{METRIC_LABELS[k]}</span>
                      </div>
                    ))}
                  </div>
                  {/* 핵심 성분 태그 */}
                  {displayIngs.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {displayIngs.map((ing, i) => (
                        <span key={i} style={{
                          fontSize: 10, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.04)',
                          borderRadius: 6, padding: '3px 8px', fontWeight: 500,
                        }}>{ing}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            } catch { return null; } })()}

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', marginBottom: 16,
              background: 'rgba(0,0,0,0.02)', borderRadius: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#d0d0d0' }}>사용</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{days}일째</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.startDate} 시작</span>
            </div>

            {/* 메모 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                background: 'rgba(0,0,0,0.02)', borderRadius: 12,
                padding: '10px 14px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#d0d0d0', marginBottom: 4 }}>memo</div>
                <textarea
                  value={memo}
                  onChange={(e) => { setMemo(e.target.value); setMemoSaved(false); }}
                  onBlur={() => {
                    if (memo !== (product.memo || '')) {
                      onEdit({ id: product.id, memo });
                      setMemoSaved(true);
                      setTimeout(() => setMemoSaved(false), 1500);
                    }
                  }}
                  placeholder=""
                  style={{
                    width: '100%', minHeight: memo ? 48 : 22, padding: 0,
                    borderRadius: 0, border: 'none',
                    background: 'transparent',
                    fontSize: 13, color: 'var(--text-primary)',
                    fontFamily: 'inherit', resize: 'none', outline: 'none',
                    lineHeight: 1.5,
                  }}
                />
              </div>
              {memoSaved && (
                <div style={{ fontSize: 11, color: accent, marginTop: 4 }}>저장됨</div>
              )}
            </div>

            {/* 느낌 선택 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[
                { key: 'good', label: '잘 맞아요',
                  outline: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d0d0d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11v8a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1h3a4 4 0 0 0 4 -4v-1a2 2 0 0 1 4 0v5h3a2 2 0 0 1 2 2l-1 5a2 3 0 0 1 -2 2h-7a3 3 0 0 1 -3 -3" /></svg>,
                  filled: <svg width="18" height="18" viewBox="0 0 24 24" fill="#d0d0d0" stroke="none"><path d="M13 3a3 3 0 0 1 2.995 2.824l.005 .176v4h2a3 3 0 0 1 2.98 2.65l.015 .174l.005 .176l-.02 .196l-1.006 5.032c-.381 1.626 -1.502 2.796 -2.81 2.78l-.164 -.008h-8a1 1 0 0 1 -.993 -.883l-.007 -.117l.001 -9.536a1 1 0 0 1 .5 -.865a2.998 2.998 0 0 0 1.492 -2.397l.007 -.202v-1a3 3 0 0 1 3 -3z" /><path d="M5 10a1 1 0 0 1 .993 .883l.007 .117v9a1 1 0 0 1 -.883 .993l-.117 .007h-1a2 2 0 0 1 -1.995 -1.85l-.005 -.15v-7a2 2 0 0 1 1.85 -1.995l.15 -.005h1z" /></svg>,
                },
                { key: 'unsure', label: '아직 모르겠어요',
                  outline: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d0d0d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /></svg>,
                  filled: <svg width="18" height="18" viewBox="0 0 24 24" fill="#d0d0d0" stroke="none"><path d="M12 1.67a2.914 2.914 0 0 0 -2.492 1.403l-8.11 13.537a2.914 2.914 0 0 0 2.484 4.385h16.225a2.914 2.914 0 0 0 2.503 -4.371l-8.116 -13.546a2.917 2.917 0 0 0 -2.494 -1.408z" /></svg>,
                },
                { key: 'bad', label: '안 맞는 것 같아요',
                  outline: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d0d0d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 13v-8a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v7a1 1 0 0 0 1 1h3a4 4 0 0 1 4 4v1a2 2 0 0 0 4 0v-5h3a2 2 0 0 0 2 -2l-1 -5a2 3 0 0 0 -2 -2h-7a3 3 0 0 0 -3 3" /></svg>,
                  filled: <svg width="18" height="18" viewBox="0 0 24 24" fill="#d0d0d0" stroke="none"><path d="M13 21.008a3 3 0 0 0 2.995 -2.823l.005 -.177v-4h2a3 3 0 0 0 2.98 -2.65l.015 -.173l.005 -.177l-.02 -.196l-1.006 -5.032c-.381 -1.625 -1.502 -2.796 -2.81 -2.78l-.164 .008h-8a1 1 0 0 0 -.993 .884l-.007 .116l.001 9.536a1 1 0 0 0 .5 .866a2.998 2.998 0 0 1 1.492 2.396l.007 .202v1a3 3 0 0 0 3 3z" /><path d="M5 14.008a1 1 0 0 0 .993 -.883l.007 -.117v-9a1 1 0 0 0 -.883 -.993l-.117 -.007h-1a2 2 0 0 0 -1.995 1.852l-.005 .15v7a2 2 0 0 0 1.85 1.994l.15 .005h1z" /></svg>,
                },
              ].map(f => {
                const active = feeling === f.key;
                return (
                  <button key={f.key} onClick={() => {
                    const next = active ? null : f.key;
                    setFeeling(next);
                    onEdit({ id: product.id, feeling: next });
                  }} style={{
                    flex: 1, padding: '10px 0', borderRadius: 12,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'all 0.15s',
                  }}>
                    {active ? f.filled : f.outline}
                    <span style={{
                      fontSize: 10, fontWeight: active ? 600 : 400,
                      color: active ? 'var(--text-primary)' : '#d0d0d0',
                    }}>{f.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 삭제 확인 모달 */}
            {confirmDelete && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 24,
                animation: 'fadeIn 150ms ease-out',
              }}>
                <div style={{
                  background: '#fff', borderRadius: 20, padding: '28px 24px 20px',
                  width: '100%', maxWidth: 280, textAlign: 'center',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>제품 삭제</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 20 }}>
                    {product.name}을(를)<br />삭제할까요?
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirmDelete(false)} style={{
                      flex: 1, padding: '12px 0', borderRadius: 12,
                      border: '1px solid rgba(0,0,0,0.08)', background: '#fff',
                      fontSize: 14, fontWeight: 600, color: 'var(--text-muted)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>취소</button>
                    <button onClick={() => onDelete(product.id)} style={{
                      flex: 1, padding: '12px 0', borderRadius: 12,
                      border: 'none', background: '#333',
                      fontSize: 14, fontWeight: 600, color: '#fff',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>삭제</button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 20 }}>제품 정보 수정</div>

            {[
              { label: '브랜드', key: 'brand' },
              { label: '제품명', key: 'name' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>{f.label}</div>
                <input
                  type="text" autoComplete="off" value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 16,
                    border: 'var(--item-border)',
                    background: 'var(--item-bg)',
                    color: 'var(--text-primary)',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>카테고리</div>
              <CategorySelector value={form.category} onChange={v => setForm(p => ({ ...p, category: v }))} accent={accent} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>사용 시간대</div>
              <TimeSlotSelector value={form.timeSlot} onChange={v => setForm(p => ({ ...p, timeSlot: v }))} accent={accent} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditing(false)} style={{
                flex: 1, padding: '14px 0', borderRadius: 14,
                border: 'var(--item-border)',
                background: 'transparent', color: 'var(--tag-color)',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}>취소</button>
              <button onClick={handleSaveEdit} disabled={!form.brand.trim() || !form.name.trim()} style={{
                flex: 1, padding: '14px 0', borderRadius: 14, border: 'none',
                background: (form.brand.trim() && form.name.trim()) ? accent : ('var(--text-disabled)'),
                color: (form.brand.trim() && form.name.trim()) ? '#fff' : ('var(--text-dim)'),
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}>저장</button>
            </div>
          </>
        )}
      </div>
    </SheetOverlay>
  );
}

// ===== MAIN COMPONENT =====

export default function ProductPage({ themeColors, onBack }) {
  const [section, setSection] = useState('products');
  const [products, setProducts] = useState(() => getProducts());
  const [analyses, setAnalyses] = useState([]);

  // Sheets
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showPhotoFlow, setShowPhotoFlow] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const accent = themeColors?.accent || '#6598ef';
  const getCat = (cat) => TRACKER_CATEGORIES[cat] || TRACKER_CATEGORIES['기타'];

  // 효과 분석 로드
  useEffect(() => {
    if (section === 'analysis') setAnalyses(computeAllCorrelations());
  }, [section, products]);

  // 제품 저장 핸들러 (누끼 이미지 먼저 가져온 후 저장)
  const [saving, setSaving] = useState(false);
  const [justRegistered, setJustRegistered] = useState(null); // { product, totalCount } — 등록 완료 모달
  const [dedupeToast, setDedupeToast] = useState(null); // 첫 마운트 시 중복 정리됐을 때 알림

  // 루틴 생성 영역 상태
  const [routineExpanded, setRoutineExpanded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshSpinning, setRefreshSpinning] = useState(false);
  const routineRef = useRef(null);
  const addBtnRef = useRef(null);
  const [openSwipeRowId, setOpenSwipeRowId] = useState(null);

  // 화장대 카드 좌/우 스와이프 핸들러
  const handleProductSwipeDelete = (id) => {
    const updated = deleteProduct(id);
    setOpenSwipeRowId(null);
    getAllProductThumbs().then(map => {
      setProducts(updated.map(p => ({ ...p, imageThumb: map.get(String(p.id)) || null })));
    });
  };
  const handleProductSwipeMove = (id, direction) => {
    const ids = products.map(p => p.id);
    const idx = ids.indexOf(id);
    if (idx < 0) return;
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= ids.length) return;
    const reordered = [...ids];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    const updated = reorderProducts(reordered);
    // IDB thumb hydrate
    getAllProductThumbs().then(map => {
      setProducts(updated.map(p => ({ ...p, imageThumb: map.get(String(p.id)) || null })));
    });
  };

  // 등록·삭제·수정 시 펼친 루틴 자동 갱신 (refreshKey ↑) — 사용자가 명시적으로 새로고침 안 눌러도 즉시 반영
  const lastProductSignatureRef = useRef('');
  useEffect(() => {
    if (!routineExpanded) return;
    const sig = products.map(p => `${p.id}:${p.brand}:${p.name}:${p.category}:${p.timeSlot}`).join('|');
    if (sig !== lastProductSignatureRef.current) {
      lastProductSignatureRef.current = sig;
      setRefreshKey(k => k + 1);
    }
  }, [products, routineExpanded]);

  // 채팅 카드 등에서 saveProduct 호출 시 즉시 화장대 갱신
  useEffect(() => {
    const onChanged = async () => {
      const fresh = getProducts();
      const map = await getAllProductThumbs();
      setProducts(fresh.map(p => ({ ...p, imageThumb: map.get(String(p.id)) || null })));
    };
    window.addEventListener('lua:tracker-products-changed', onChanged);
    return () => window.removeEventListener('lua:tracker-products-changed', onChanged);
  }, []);

  // 첫 마운트 시 인기 한국 화장품 image URL을 백그라운드로 prefetch → 자동완성 캐시 채움
  const prefetchDoneRef = useRef(false);
  useEffect(() => {
    if (prefetchDoneRef.current) return;
    prefetchDoneRef.current = true;
    // 진입 직후 1.5초 뒤 시작 (사용자 첫 화면 우선)
    const startTimer = setTimeout(() => {
      const targets = POPULAR_KOREAN_PRODUCTS
        .filter(p => getImgFromCache(p.brand, p.name) === undefined)
        .slice(0, 40);
      // stagger 150ms — 네이버 API rate limit 회피
      targets.forEach((p, i) => {
        setTimeout(async () => {
          try {
            const info = await fetchProductInfo(p.brand, p.name, { fast: true });
            setImgCache(p.brand, p.name, info?.image || null);
          } catch {}
        }, i * 150);
      });
    }, 1500);
    return () => clearTimeout(startTimer);
  }, []);

  // 첫 마운트 시 중복 제품(같은 brand+name) 자동 정리 — 과거에 채팅 카드 다중 클릭 등으로 쌓인 데이터 cleanup
  const dedupeDoneRef = useRef(false);
  useEffect(() => {
    if (dedupeDoneRef.current) return;
    dedupeDoneRef.current = true;
    const { products: cleaned, removed } = dedupeProductsByName();
    if (removed > 0) {
      setProducts(cleaned);
      setDedupeToast(`중복 등록된 ${removed}개 자동 정리됐어요`);
      setTimeout(() => setDedupeToast(null), 3000);
    }

    // localStorage에 박혀 있던 imageThumb를 IndexedDB로 이전 + localStorage 공간 확보
    (async () => {
      try {
        const current = (removed > 0 ? cleaned : getProducts());
        const { migrated, cleaned: afterMig } = await migrateThumbsFromLocalStorage(
          current,
          (next) => {
            localStorage.setItem('nou_tracker_products', JSON.stringify(next));
          }
        );
        // thumb를 IDB에서 hydrate해 React state에 반영
        const map = await getAllProductThumbs();
        if (map.size > 0 || migrated > 0) {
          setProducts(prev => prev.map(p => ({ ...p, imageThumb: map.get(String(p.id)) || null })));
        }
        if (migrated > 0) {
          setDedupeToast(`저장 공간 정리 완료 (${migrated}개 이미지 이동)`);
          setTimeout(() => setDedupeToast(null), 2400);
        }
      } catch { /* IDB 미지원 환경 — 기존 동작 fallback */ }
    })();
  }, []);

  // ===== 기존 제품 성분 자동 보강 (백그라운드 순차) =====
  // ingredients가 비어있는 등록 제품에 대해 /api/product-ingredients를 순차 호출.
  // 첫 진입 시 1회만. rate limit·서버 부하 고려해 1초 간격.
  const [backfillProgress, setBackfillProgress] = useState(null); // null | { done, total }
  const backfillStartedRef = useRef(false);
  const thumbBackfillRef = useRef(false);

  // 누끼 이미지 없는 제품을 마운트 시 백그라운드로 보강 (채팅 카드 적용 등 thumb 없이 들어온 제품 cover)
  // 1차: brand+name 매칭. 2차 fallback: brand만으로 + 카테고리 키워드.
  useEffect(() => {
    if (thumbBackfillRef.current) return;
    const targets = products.filter(p => !p.imageThumb && (p.brand || p.name));
    if (targets.length === 0) return;
    thumbBackfillRef.current = true;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < targets.length; i++) {
        if (cancelled) return;
        const t = targets[i];
        let image = null;
        try {
          // 1차 — 정확 매칭
          const info1 = await fetchProductInfo(t.brand, t.name, { fast: true });
          if (info1?.image) image = info1.image;
        } catch {}
        // 2차 — brand + 카테고리 (1차 실패 시)
        if (!image && t.brand) {
          try {
            const info2 = await fetchProductInfo(t.brand, t.category || '', { fast: true });
            if (info2?.image) image = info2.image;
          } catch {}
        }
        // 3차 — brand만 (브랜드 인지도 있는 인디 브랜드 케어)
        if (!image && t.brand) {
          try {
            const info3 = await fetchProductInfo(t.brand, '', { fast: true });
            if (info3?.image) image = info3.image;
          } catch {}
        }
        if (image && !cancelled) {
          try {
            const { setProductThumb } = await import('../storage/ImageStore');
            await setProductThumb(t.id, image);
            setProducts(prev => prev.map(p => p.id === t.id ? { ...p, imageThumb: image } : p));
            window.dispatchEvent(new CustomEvent('lua:tracker-products-changed'));
          } catch {}
        }
        if (i < targets.length - 1) await new Promise(r => setTimeout(r, 200));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length]);

  useEffect(() => {
    if (backfillStartedRef.current) return;
    const targets = products.filter(p =>
      (!p.ingredients ||
        (typeof p.ingredients === 'string' && p.ingredients.trim().length === 0) ||
        (Array.isArray(p.ingredients) && p.ingredients.length === 0))
      && (p.brand || p.name)
    );
    if (targets.length === 0) return;
    backfillStartedRef.current = true;
    let cancelled = false;

    (async () => {
      setBackfillProgress({ done: 0, total: targets.length });
      for (let i = 0; i < targets.length; i++) {
        if (cancelled) return;
        const t = targets[i];
        try {
          const resp = await fetch('/api/product-ingredients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand: t.brand || '', name: t.name || '', category: t.category || '' }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data.ingredients) && data.ingredients.length > 0) {
              const next = saveProduct({
                ...t,
                ingredients: data.ingredients,
                ingredientsConfidence: data.confidence || 'estimated',
              });
              if (!cancelled) setProducts(next);
            }
          }
        } catch { /* skip on error */ }
        if (!cancelled) setBackfillProgress({ done: i + 1, total: targets.length });
        // 1초 간격 — rate limit·서버 부하 완화
        if (i < targets.length - 1) await new Promise(r => setTimeout(r, 1000));
      }
      // 완료 후 1.5초 뒤 chip 사라짐
      setTimeout(() => { if (!cancelled) setBackfillProgress(null); }, 1500);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 첫 마운트 1회만

  const savingRef = useRef(false); // 동기 잠금 — setSaving 비동기로 인한 중복 호출 차단
  const handleSaveProduct = async (formData) => {
    if (savingRef.current) return; // 진행 중인 등록 있으면 두 번째 클릭 무시
    savingRef.current = true;
    setSaving(true);
    try {
      // 1) 누끼 이미지 — 네이버 쇼핑 (수동 등록일 때만)
      if (!formData.imageThumb && formData.brand && formData.name) {
        try {
          const info = await fetchProductInfo(formData.brand, formData.name);
          if (info?.image) {
            const thumb = await compressProductThumb(info.image);
            if (thumb) formData = { ...formData, imageThumb: thumb };
          }
        } catch { /* 실패 시 기존 데이터 유지 */ }
      }

      // 2) 성분 자동 검색 — ingredients 비어 있고 브랜드·이름 있을 때만 (GPT 기반 추정)
      const hasIngredients = (typeof formData.ingredients === 'string' && formData.ingredients.trim().length > 0)
        || (Array.isArray(formData.ingredients) && formData.ingredients.length > 0);
      if (!hasIngredients && (formData.brand || formData.name)) {
        try {
          const resp = await fetch('/api/product-ingredients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brand: formData.brand || '',
              name: formData.name || '',
              category: formData.category || '',
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data.ingredients) && data.ingredients.length > 0) {
              formData = {
                ...formData,
                ingredients: data.ingredients,
                ingredientsConfidence: data.confidence || 'estimated', // 'known' | 'estimated'
              };
            }
          }
        } catch { /* 실패 시 ingredients 없이 저장 */ }
      }

      const updated = saveProduct(formData);
      // imageThumb는 IDB로 분리됐으니 직후 hydrate해서 React state엔 thumb 포함된 형태로
      const thumbMap = await getAllProductThumbs();
      const hydrated = updated.map(p => ({ ...p, imageThumb: thumbMap.get(String(p.id)) || null }));
      setProducts(hydrated);
      setShowPhotoFlow(false);
      setShowManualForm(false);
      // 방금 저장된 제품 찾기 — edit이면 같은 id, 신규면 마지막 push
      const savedProduct = formData.id
        ? hydrated.find(p => p.id === formData.id)
        : hydrated[hydrated.length - 1];
      if (savedProduct) {
        setJustRegistered({ product: savedProduct, totalCount: updated.length });
      }
      // 첫 등록 시 루틴 영역 자동 펼침
      if (!routineExpanded && updated.length >= 1) {
        setRoutineExpanded(true);
        setTimeout(() => {
          routineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 500);
      }
    } catch (err) {
      alert(err.message || '제품 저장에 실패했어요.');
    }
    setSaving(false);
    savingRef.current = false;
  };

  const handleEditProduct = (formData) => {
    const updated = saveProduct(formData);
    setProducts(updated);
    setSelectedProduct(updated.find(p => p.id === formData.id) || null);
  };

  const handleDeleteProduct = (id) => {
    const updated = deleteProduct(id);
    setProducts(updated);
    setSelectedProduct(null);
  };

  const sections = [
    { key: 'products', label: '내 제품' },
    { key: 'analysis', label: '효과 분석' },
  ];

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100, animation: 'breatheIn 0.5s ease both' }}>
      {/* Header */}
      <div style={{ padding: '10px 20px 0' }}></div>

      {/* 성분 자동 보강 진행 chip — 기존 제품 backfill */}
      {backfillProgress && (
        <div style={{
          position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(31,31,31,0.86)', color: '#fff',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 16, padding: '8px 14px',
          fontSize: 12, fontWeight: 500, letterSpacing: -0.1,
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)', zIndex: 950,
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'breatheIn 0.25s ease both',
        }}>
          <span style={{
            display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: '#6598ef',
            animation: 'ingredientSpin 0.9s linear infinite',
          }} />
          <span>{backfillProgress.done < backfillProgress.total
            ? `성분 검색 중 ${backfillProgress.done}/${backfillProgress.total}`
            : `완료 ✓`}</span>
        </div>
      )}
      <style>{`
        @keyframes ingredientSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Section Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: 4, margin: '20px 20px 16px',
        background: 'rgba(255,255,255,0.35)',
        border: '1px solid rgba(255,255,255,0.4)',
        borderRadius: 14,
      }}>
        {sections.map(s => {
          const active = section === s.key;
          return (
            <button key={s.key} onClick={() => setSection(s.key)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 0', borderRadius: 11, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13.5, letterSpacing: -0.2,
              fontWeight: active ? 700 : 500,
              background: active ? 'rgba(255,255,255,0.85)' : 'transparent',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
              color: active ? '#6598ef' : 'var(--text-secondary)',
              border: 'none',
              transition: 'background 0.18s ease, color 0.18s ease',
            }}>{s.label}</button>
          );
        })}
      </div>

      {/* ═══ SECTION 1: 내 제품 ═══ */}
      {section === 'products' && (
        <div style={{ padding: '0 20px', animation: 'fadeUp 0.3s ease-out' }}>
          {/* 등록 제품 grid */}
          <div style={{
            background: 'rgba(255,255,255,0.2)', borderRadius: 18,
            padding: '14px 14px 14px', marginBottom: 16,
          }}>
            {/* 헤더 — 배경 영역 안 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>등록된 제품</span>
              <span style={{
                fontSize: 10.5, fontWeight: 600, color: '#6598ef',
                background: 'rgba(101,152,239,0.14)',
                borderRadius: 8, padding: '2px 7px',
              }}>{products.length}</span>
            </div>
            {products.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>등록된 제품이 없어요</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>'제품 등록' 버튼으로 추가해보세요</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 0 0' }}>
              {products.map((p, pIdx) => {
                const cat = getCat(p.category);
                const days = Math.max(0, Math.floor((Date.now() - new Date(p.startDate)) / 86400000));
                return (
                <div key={p.id} style={{ borderRadius: 18, overflow: 'hidden' }}>
                <SwipeableRow
                  rowId={p.id}
                  openRowId={openSwipeRowId}
                  setOpenRowId={setOpenSwipeRowId}
                  onDelete={() => handleProductSwipeDelete(p.id)}
                  onMoveUp={pIdx > 0 ? () => handleProductSwipeMove(p.id, 'up') : null}
                  onMoveDown={pIdx < products.length - 1 ? () => handleProductSwipeMove(p.id, 'down') : null}
                >
                  <div onClick={() => setSelectedProduct(p)} style={{
                    background: 'rgba(255,255,255,0.42)', borderRadius: 18,
                    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                    padding: 14, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    position: 'relative',
                  }}>
                    {p.favorite && (
                      <div style={{ position: 'absolute', top: 14, right: 14 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffdaf0" stroke="#fff" strokeWidth="1">
                          <path d="M6.979 3.074a6 6 0 0 1 4.988 1.425l.037 .033l.034 -.03a6 6 0 0 1 4.733 -1.44l.246 .036a6 6 0 0 1 3.364 10.008l-.18 .185l-.048 .041l-7.45 7.379a1 1 0 0 1 -1.313 .082l-.094 -.082l-7.493 -7.422a6 6 0 0 1 3.176 -10.215z" />
                        </svg>
                      </div>
                    )}
                    {p.imageThumb ? (
                      <img
                        src={p.imageThumb}
                        alt=""
                        style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', marginBottom: 10, background: '#fff' }}
                        onError={(e) => {
                          // 깨진 URL이면 placeholder div로 교체
                          const parent = e.currentTarget.parentNode;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.style.cssText = 'width:44px;height:44px;border-radius:12px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;font-size:22px;background:rgba(101,152,239,0.08);';
                            fallback.textContent = cat.emoji || '';
                            parent.insertBefore(fallback, e.currentTarget);
                            e.currentTarget.remove();
                          }
                        }}
                      />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: 'rgba(101,152,239,0.08)' }}>
                        {cat.emoji}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#c0c8d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.4, minHeight: '2.8em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'keep-all' }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 8 }}>
                      {p.category} · {days}일째
                    </div>
                  </div>
                </SwipeableRow>
                </div>
                );
              })}
              </div>
            )}
            {/* 제품 등록 버튼 — 배경 영역 하단 */}
            <div
              ref={addBtnRef}
              onClick={() => setShowAddSheet(true)}
              style={{
                padding: '13px 24px', marginTop: 10, cursor: 'pointer',
                background: '#6598ef', borderRadius: 14,
                border: 'none',
                boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>제품 등록</span>
            </div>
          </div>

          {/* 루틴 생성 영역 — 등록 제품 있을 때만 노출 */}
          {products.length > 0 && (
            <div ref={routineRef} style={{ marginBottom: 20 }}>
              {!routineExpanded ? (
                <button
                  onClick={() => { hapticLight(); setRoutineExpanded(true); }}
                  style={{
                    width: '100%', padding: '16px 20px',
                    background: 'linear-gradient(135deg, #6598ef 0%, #8ac4fe 100%)',
                    border: 'none', borderRadius: 18,
                    cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                    color: '#fff',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                    <path d="M10.5 2l1.67 4.83l4.83 1.67l-4.83 1.67l-1.67 4.83l-1.67 -4.83l-4.83 -1.67l4.83 -1.67l1.67 -4.83z" />
                    <path d="M17.5 13l1 2.5l2.5 1l-2.5 1l-1 2.5l-1 -2.5l-2.5 -1l2.5 -1l1 -2.5z" />
                  </svg>
                  <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>피부에 맞는 루틴 생성하기</span>
                </button>
              ) : (
                <div style={{ animation: 'fadeUp 0.35s ease-out' }}>
                  <CareRecommendation products={products} refreshKey={refreshKey} />
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* ═══ SECTION 3: 효과 분석 ═══ */}
      {section === 'analysis' && (
        <div style={{ padding: '20px 20px 0', animation: 'fadeUp 0.3s ease-out' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>제품별 효과 분석</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: accent, background: `${accent}15`, borderRadius: 8, padding: '3px 8px' }}>데이터 기반</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              피부 측정 데이터와 제품 사용 기간을 교차 분석한 결과입니다
            </p>
          </div>

          {products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>등록된 제품이 없어요</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>제품을 등록하면 피부 변화와의 상관관계를 분석해드려요</div>
            </div>
          ) : analyses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>분석에 필요한 데이터가 부족해요</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>피부 측정을 2회 이상 하면 분석이 시작돼요</div>
            </div>
          ) : (
            analyses.map((a, idx) => {
              const cat = getCat(a.category);
              const confColor = a.confidence === '높음' ? '#85b0f5' : a.confidence === '보통' ? '#F0B870' : '#8888a0';
              return (
                <div key={a.productId} className="card" style={{ padding: 20, marginBottom: 16, animation: `breatheIn 0.5s ease ${idx * 0.15}s both` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{cat.emoji}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{a.productName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.brand}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: accent, background: `${accent}15`, borderRadius: 10, padding: '4px 10px' }}>{a.days}일</span>
                  </div>

                  {a.chart && (
                    <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 16, background: 'var(--item-bg)', padding: '12px 8px 4px' }}>
                      <MiniLineChart data={a.chart} accent={accent} height={60} />
                    </div>
                  )}

                  {a.metrics.length > 0 && (
                    <>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                        {a.metrics.map((m, mi) => (
                          <div key={mi} style={{
                            display: 'flex', alignItems: 'center', gap: 4, borderRadius: 10, padding: '6px 12px',
                            background: m.improved ? 'rgba(101,152,239,0.1)' : 'rgba(239,68,68,0.1)',
                            border: `1px solid ${m.improved ? 'rgba(101,152,239,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          }}>
                            <span style={{ fontSize: 12, color: 'var(--tag-color)' }}>{m.label}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: m.improved ? '#85b0f5' : '#ef4444' }}>
                              {m.improved ? '↑' : '↓'}{m.diff}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: confColor, background: `${confColor}15`, borderRadius: 8, padding: '3px 10px' }}>
                          신뢰도: {a.confidence}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                        {[
                          { label: '시작 시', value: a.metrics[0].before },
                          { label: '현재', value: a.metrics[0].after },
                        ].map((box, bi) => (
                          <div key={bi} style={{
                            flex: 1, borderRadius: 12, padding: '12px 14px', textAlign: 'center',
                            background: 'var(--item-bg)',
                            border: 'var(--item-border)',
                          }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{box.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: bi === 1 ? accent : ('var(--text-secondary)'), fontFamily: 'var(--font-display)' }}>{box.value}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div style={{
                    borderRadius: 12, padding: '14px 16px',
                    background: 'var(--context-bg)',
                    border: 'var(--context-border)',
                  }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}></span>
                      <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: 'var(--text-secondary)' }}>{a.insight}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ SHEETS ═══ */}
      {showAddSheet && (
        <AddProductSheet
          onClose={() => setShowAddSheet(false)}
          onPhoto={() => { setShowAddSheet(false); setShowPhotoFlow(true); }}
          onManual={() => { setShowAddSheet(false); setShowManualForm(true); }}
          accent={accent}
        />
      )}
      {showPhotoFlow && (
        <PhotoRegistrationFlow
          onClose={() => setShowPhotoFlow(false)}
          onSave={handleSaveProduct}
          saving={saving}
          accent={accent}
        />
      )}
      {showManualForm && (
        <ManualRegistrationForm
          onClose={() => setShowManualForm(false)}
          onSave={handleSaveProduct}
          saving={saving}
          accent={accent}
        />
      )}
      {selectedProduct && (
        <ProductDetailSheet
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onEdit={handleEditProduct}
          onDelete={handleDeleteProduct}
          onToggleFavorite={(id) => {
            const updated = toggleFavorite(id);
            setProducts(updated.map(p => ({ ...p })));
            setSelectedProduct(prev => prev ? { ...prev, favorite: !prev.favorite } : null);
          }}
          accent={accent}
        />
      )}
      {justRegistered && (
        <ProductRegisteredModal
          product={justRegistered.product}
          totalCount={justRegistered.totalCount}
          onClose={() => setJustRegistered(null)}
        />
      )}
      {dedupeToast && (
        <div style={{
          position: 'fixed', left: '50%', bottom: 'calc(110px + env(safe-area-inset-bottom,0px))',
          transform: 'translateX(-50%)',
          background: '#1F2937', color: '#fff',
          padding: '12px 18px', borderRadius: 22,
          fontSize: 13.5, fontWeight: 600, letterSpacing: -0.2,
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          zIndex: 10500, pointerEvents: 'none', maxWidth: '86vw', textAlign: 'center',
          animation: 'dedupeRise 220ms ease-out',
        }}>
          <style>{`@keyframes dedupeRise { from { opacity:0; transform: translate(-50%, 8px); } to { opacity:1; transform: translate(-50%, 0); } }`}</style>
          {dedupeToast}
        </div>
      )}
    </div>
  );
}

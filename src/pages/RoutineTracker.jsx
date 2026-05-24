/**
 * 스킨케어 루틴 트래커 v1.0
 * 제품 등록 (사진 AI / 수동), 루틴 체크, 효과 분석
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SunIcon, MoonIcon, LotionIcon, PastelIcon } from '../components/icons/PastelIcons';
import {
  TRACKER_CATEGORIES, getProducts, saveProduct, deleteProduct,
  getProductsForMode, getTrackerChecks, toggleTrackerCheck,
  getTrackerProgress, getTrackerWeekly,
  computeAllCorrelations, compressProductThumb,
} from '../storage/TrackerStorage';
import CareRecommendation from '../components/CareRecommendation';
import ProductRegisteredModal from '../components/ProductRegisteredModal';
import { PRODUCTS } from '../data/ProductCatalog';
import { KOREAN_PRODUCTS } from '../data/KoreanProducts';

// 네이버 쇼핑에서 제품 누끼 이미지 + 정확한 브랜드명 검색
async function fetchProductInfo(brand, name) {
  try {
    const query = `${brand} ${name}`.trim();
    if (!query) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('/api/product-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, brand, name }),
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

// 제품 사진 → API용 리사이즈 (정규화 없이 단순 축소)
function resizeForApi(dataUrl, maxSize = 1024, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w >= h) { h = Math.round((maxSize / w) * h); w = maxSize; }
        else { w = Math.round((maxSize / h) * w); h = maxSize; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ===== MiniLineChart =====

function MiniLineChart({ data, accent, height = 60 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data) - 2;
  const max = Math.max(...data) + 2;
  const range = max - min || 1;
  const w = 200;
  const pad = 4;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: height - ((v - min) / range) * (height - pad * 2) - pad,
  }));
  const line = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `${pts.map(p => `${p.x},${p.y}`).join(' ')} ${w},${height} 0,${height}`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <polygon points={area} fill={accent} fillOpacity="0.08" />
      <polyline points={line} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="3" fill={accent} />
      <line x1="0" y1={pts[0].y} x2={w} y2={pts[0].y} stroke={accent} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
    </svg>
  );
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
    { key: 'morning', label: ' 아침' },
    { key: 'night', label: ' 저녁' },
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

        setForm({
          brand: gptBrand,
          name: gptName,
          category: data.category || '기타',
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
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              제품 라벨이 잘 보이도록 촬영해주세요
            </p>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
            <input ref={albumRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: ' 카메라', ref: cameraRef },
                { label: ' 앨범', ref: albumRef },
              ].map((btn, i) => (
                <button key={i} onClick={() => btn.ref.current?.click()} style={{
                  flex: 1, padding: '16px 0', borderRadius: 14, cursor: 'pointer',
                  border: 'var(--item-border)',
                  background: 'var(--item-bg)',
                  color: 'var(--text-primary)',
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

            {/* 폼 필드 */}
            {[
              { label: '브랜드', key: 'brand', placeholder: '예: 코스알엑스' },
              { label: '제품명', key: 'name', placeholder: '예: 히알루론산 세럼' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>{f.label}</div>
                <input
                  type="text"
                  autoComplete="off"
                  value={form[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
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

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>카테고리</div>
              <CategorySelector value={form.category} onChange={v => setForm(p => ({ ...p, category: v }))} accent={accent} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>사용 시간대</div>
              <TimeSlotSelector value={form.timeSlot} onChange={v => setForm(p => ({ ...p, timeSlot: v }))} accent={accent} />
            </div>

            <button type="button" onClick={handleSave} disabled={!form.brand.trim() || !form.name.trim() || saving} style={{
              width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
              cursor: (form.brand.trim() && form.name.trim() && !saving) ? 'pointer' : 'default',
              background: (!form.brand.trim() || !form.name.trim() || saving) ? ('var(--text-disabled)') : accent,
              color: (!form.brand.trim() || !form.name.trim() || saving) ? ('var(--text-dim)') : '#fff',
              fontSize: 15, fontWeight: 700, position: 'relative', zIndex: 1,
            }}>{saving ? '제품 이미지 검색 중...' : '등록하기'}</button>
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

function ManualRegistrationForm({ onClose, onSave, saving, accent }) {
  const [form, setForm] = useState({ brand: '', name: '', category: '기타', timeSlot: 'both' });
  const [activeField, setActiveField] = useState(null); // 'brand' | 'name'
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]); // [{brand,name,category,timeSlot,ingredients,volume,source,image,imgLoading}]
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const userSelectedRef = useRef(false);
  const lastQueryRef = useRef('');
  const cacheRef = useRef(new Map()); // query → results

  // 로컬 매칭 — KOREAN_PRODUCTS + ProductCatalog. 0ms 즉시 응답.
  // 매칭 점수: brand 정확(100) > brand 시작(60) > brand 포함(40) > name 포함(20)
  const localMatch = (q) => {
    const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
    const lq = norm(q);
    if (lq.length < 1) return [];
    const scored = [];
    const seen = new Set();

    const score = (brand, name) => {
      const nb = norm(brand);
      const nn = norm(name);
      const nbn = nb + nn;
      if (nb === lq) return 100;
      if (nb.startsWith(lq)) return 80;
      if (nb.includes(lq)) return 60;
      if (nn.includes(lq)) return 40;
      if (nbn.includes(lq)) return 20;
      return 0;
    };

    // 우선순위 1: 한국 인기 제품 데이터셋
    for (const p of KOREAN_PRODUCTS) {
      const s = score(p.brand, p.name);
      if (s === 0) continue;
      const key = `${p.brand}|${p.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      scored.push({
        ...p,
        source: 'local',
        _score: s,
      });
    }

    // 우선순위 2: ProductCatalog (보조)
    for (const p of PRODUCTS) {
      const s = score(p.brand, p.name);
      if (s === 0) continue;
      const key = `${p.brand}|${p.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      scored.push({
        brand: p.brand,
        name: p.name,
        category: '기타',
        timeSlot: 'both',
        ingredients: (p.tags || []).slice(0, 4),
        volume: p.volume || '',
        source: 'local',
        _score: s - 5,
      });
    }

    scored.sort((a, b) => b._score - a._score);
    return scored.slice(0, 8).map(({ _score, ...rest }) => rest);
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
    setSearchLoading(true);
    setSearchError('');

    const t = setTimeout(async () => {
      lastQueryRef.current = q;
      try {
        const r = await fetch('/api/product-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        });
        if (lastQueryRef.current !== q) return;
        if (!r.ok || !r.body) {
          const data = await r.json().catch(() => ({}));
          setSearchError(data.error || '검색에 실패했어요');
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
              setSearchError(evt.error);
              continue;
            }
            if (evt.product) {
              const p = { ...evt.product, source: 'gpt' };
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
        if (lastQueryRef.current !== q) return;
        setSearchError('네트워크 오류로 검색이 안 됐어요');
        setSearchLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
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
  // suggestions가 바뀔 때마다 imgLoading=true인 것들에 대해 비동기 이미지 fetch
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
        const info = await fetchProductInfo(s.brand, s.name);
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
    targets.slice(0, 6).forEach(fetchOne);
  }, [suggestions]);

  // 필드 입력 시 검색 query 업데이트
  const onFieldChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === 'brand') setSearchQuery(value);
    else if (key === 'name') setSearchQuery(`${form.brand} ${value}`.trim());
  };

  const onSuggestionClick = (s) => {
    userSelectedRef.current = true;
    setForm({
      brand: s.brand,
      name: s.name,
      category: s.category,
      timeSlot: s.timeSlot,
      imageThumb: s.image || null,
      ingredients: s.ingredients && s.ingredients.length > 0
        ? { known: [], estimated: s.ingredients, source: s.source === 'gpt' ? 'gpt' : 'catalog' }
        : null,
    });
    setSuggestions([]);
    setActiveField(null);
    setSearchQuery('');
  };

  const handleSave = () => {
    if (!form.brand.trim() || !form.name.trim() || saving) return;
    onSave(form);
  };

  const canSave = form.brand.trim() && form.name.trim() && !saving;
  const showSuggestions = activeField && (suggestions.length > 0 || searchLoading || searchError);

  return (
    <SheetOverlay onClose={onClose}>
      <div style={{ background: 'var(--sheet-bg)', padding: '24px 20px calc(40px + env(safe-area-inset-bottom, 0px))' }}>
        <SheetHandle />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 6 }}>제품 직접 입력</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16, letterSpacing: -0.1 }}>
          브랜드명만 입력해도 관련 제품이 자동으로 떠요
        </div>

        {[
          { label: '브랜드', key: 'brand', placeholder: '예: 토리든, 코스알엑스, 셀퓨전씨' },
          { label: '제품명', key: 'name', placeholder: '예: 다이브인 저분자 히알루론산 토너' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>{f.label}</div>
            <input
              type="text"
              autoComplete="off"
              value={form[f.key]}
              onChange={e => onFieldChange(f.key, e.target.value)}
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
                onClick={() => onSuggestionClick(s)}
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
                  <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
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

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>카테고리</div>
          <CategorySelector value={form.category} onChange={v => setForm(p => ({ ...p, category: v }))} accent={accent} />
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

function ProductDetailSheet({ product, onClose, onDelete, onEdit, accent }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
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

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, borderRadius: 18, padding: '14px', textAlign: 'center', background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>사용 기간</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: accent, fontFamily: 'var(--font-display)' }}>{days}일</div>
              </div>
              <div style={{ flex: 1, borderRadius: 18, padding: '14px', textAlign: 'center', background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>시작일</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{product.startDate}</div>
              </div>
            </div>

            {product.ingredients?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tag-color)', marginBottom: 6 }}>핵심 성분</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {product.ingredients.map((ing, i) => (
                    <span key={i} style={{ fontSize: 11, color: accent, background: `${accent}12`, borderRadius: 8, padding: '4px 10px' }}>{ing}</span>
                  ))}
                </div>
              </div>
            )}

            {!confirmDelete ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setEditing(true)} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12,
                  border: `1px solid ${accent}30`,
                  background: 'transparent', color: accent, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>수정</button>
                <button onClick={() => setConfirmDelete(true)} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12,
                  border: '1px solid rgba(239,68,68,0.2)',
                  background: 'transparent', color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>삭제</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmDelete(false)} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: 'var(--item-border)',
                  background: 'transparent', color: 'var(--tag-color)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>취소</button>
                <button onClick={() => onDelete(product.id)} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                  background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>삭제 확인</button>
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

// 날짜 헬퍼 — selectedDate state용
function dateToStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayStrLocal() {
  return dateToStr(new Date());
}
function formatDateLabel(dateStr) {
  if (dateStr === todayStrLocal()) return '오늘';
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const diff = Math.floor((today.setHours(0,0,0,0) - new Date(dateStr + 'T00:00:00').getTime()) / 86400000);
  if (diff === 1) return '어제';
  if (diff === 2) return '그제';
  const days = ['일','월','화','수','목','금','토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

export default function RoutineTracker({ themeColors, onBack }) {
  const [section, setSection] = useState('products');
  const [products, setProducts] = useState(() => getProducts());
  const [routineMode, setRoutineMode] = useState(new Date().getHours() >= 18 ? 'night' : 'morning');
  const [selectedDate, setSelectedDate] = useState(() => todayStrLocal());
  const [checks, setChecks] = useState(() => getTrackerChecks());
  const [analyses, setAnalyses] = useState([]);

  // selectedDate 변경 시 checks 동기화
  useEffect(() => {
    setChecks(getTrackerChecks(selectedDate));
  }, [selectedDate]);

  const isToday = selectedDate === todayStrLocal();
  const canGoPrev = (() => {
    const d = new Date(selectedDate + 'T12:00:00');
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    return diff < 60; // 60일 retention
  })();
  const goPrev = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(dateToStr(d));
  };
  const goNext = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    const next = dateToStr(d);
    // 미래 불가
    if (next > todayStrLocal()) return;
    setSelectedDate(next);
  };
  const goToday = () => setSelectedDate(todayStrLocal());

  // Sheets
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showPhotoFlow, setShowPhotoFlow] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const accent = themeColors?.accent || '#6598ef';
  const getCat = (cat) => TRACKER_CATEGORIES[cat] || TRACKER_CATEGORIES['기타'];

  // 루틴 데이터 — selectedDate 기준
  const modeProducts = getProductsForMode(routineMode);
  const progress = getTrackerProgress(routineMode, selectedDate);
  const weekly = getTrackerWeekly();

  // 효과 분석 로드
  useEffect(() => {
    if (section === 'analysis') setAnalyses(computeAllCorrelations());
  }, [section, products]);

  // 제품 저장 핸들러 (누끼 이미지 먼저 가져온 후 저장)
  const [saving, setSaving] = useState(false);
  const [justRegistered, setJustRegistered] = useState(null); // { product, totalCount } — 등록 완료 모달

  // ===== 기존 제품 성분 자동 보강 (백그라운드 순차) =====
  // ingredients가 비어있는 등록 제품에 대해 /api/product-ingredients를 순차 호출.
  // 첫 진입 시 1회만. rate limit·서버 부하 고려해 1초 간격.
  const [backfillProgress, setBackfillProgress] = useState(null); // null | { done, total }
  const backfillStartedRef = useRef(false);

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

  const handleSaveProduct = async (formData) => {
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
      setProducts(updated);
      setShowPhotoFlow(false);
      setShowManualForm(false);
      // 방금 저장된 제품 찾기 — edit이면 같은 id, 신규면 마지막 push
      const savedProduct = formData.id
        ? updated.find(p => p.id === formData.id)
        : updated[updated.length - 1];
      if (savedProduct) {
        setJustRegistered({ product: savedProduct, totalCount: updated.length });
      }
    } catch (err) {
      alert(err.message || '제품 저장에 실패했어요.');
    }
    setSaving(false);
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

  const handleToggleCheck = (productId) => {
    const updated = toggleTrackerCheck(routineMode, productId, selectedDate);
    setChecks(updated);
  };

  const sections = [
    { key: 'products', label: '내 제품', icon: '' },
    { key: 'analysis', label: '효과 분석', icon: '' },
  ];

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 100, animation: 'breatheIn 0.5s ease both' }}>
      {/* Header */}
      <div style={{ padding: '52px 20px 0' }}></div>

      {/* 성분 자동 보강 진행 chip — 기존 제품 backfill */}
      {backfillProgress && (
        <div style={{
          position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(31,31,31,0.86)', color: '#fff',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 16, padding: '8px 14px',
          fontSize: 12, fontWeight: 500, letterSpacing: -0.1,
          boxShadow: '0 4px 18px rgba(0,0,0,0.18)', zIndex: 950,
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
      <div style={{ display: 'flex', gap: 8, padding: '20px 20px 16px' }}>
        {sections.map(s => {
          const active = section === s.key;
          return (
            <button key={s.key} onClick={() => setSection(s.key)} style={{
              flex: 1, padding: '12px 0', borderRadius: 18, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, textAlign: 'center',
              background: active ? 'rgba(255,255,255,0.42)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              backdropFilter: active ? 'blur(14px)' : 'none', WebkitBackdropFilter: active ? 'blur(14px)' : 'none',
              border: '1px solid rgba(255,255,255,0.4)',
              boxShadow: active ? '0 2px 12px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s',
            }}>{s.icon} {s.label}</button>
          );
        })}
      </div>

      {/* ═══ SECTION 1: 내 제품 ═══ */}
      {section === 'products' && (
        <div style={{ padding: '0 20px', animation: 'fadeUp 0.3s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>등록된 제품</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>{products.length}개</span>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.42)', borderRadius: 18,
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.4)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            padding: '6px 0', marginBottom: 16,
          }}>
            {products.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                등록된 제품이 없어요
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 10 }}>
              {products.map((p) => {
                const cat = getCat(p.category);
                const days = Math.max(0, Math.floor((Date.now() - new Date(p.startDate)) / 86400000));
                return (
                  <div key={p.id} onClick={() => setSelectedProduct(p)} style={{
                    background: 'rgba(255,255,255,0.42)', borderRadius: 18,
                    backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                    padding: 14, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                  }}>
                    {p.imageThumb ? (
                      <img src={p.imageThumb} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', marginBottom: 10 }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                        {cat.emoji}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.4, minHeight: '2.8em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 8 }}>
                      {p.category} · {days}일째
                    </div>
                  </div>
                );
              })}
              </div>
            )}
          </div>

          {/* Add Product Button */}
          <div onClick={() => setShowAddSheet(true)} style={{
            padding: '12px 24px', marginBottom: 16, cursor: 'pointer',
            background: '#6598ef', borderRadius: 18,
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>제품 등록</span>
          </div>

          {/* 측정 데이터 기반 맞춤 제품 추천 — 화장대 (내 제품) 아래 배치 */}
          <CareRecommendation />
        </div>
      )}

      {/* ═══ SECTION 2: 오늘의 루틴 (케어 페이지로 이동됨) ═══ */}
      {false && (
        <div>

          {modeProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                {routineMode === 'morning' ? '아침' : '저녁'} 루틴 제품이 없어요
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>제품을 등록하고 루틴을 관리해보세요</div>
              <button onClick={() => { setSection('products'); setShowAddSheet(true); }} style={{
                padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: accent, color: '#fff', fontSize: 13, fontWeight: 600,
              }}>제품 등록하기</button>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>오늘 진행률</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{progress.done}/{progress.total} 완료</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--progress-track)' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: `linear-gradient(90deg, ${accent}cc, ${accent})`,
                    width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>

              {/* Checklist */}
              <div className="card" style={{ padding: '4px 16px', marginBottom: 20 }}>
                {modeProducts.map((p, idx) => {
                  const cat = getCat(p.category);
                  const isChecked = !!checks[routineMode][p.id];
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
                      borderBottom: idx < modeProducts.length - 1 ? ('1px solid var(--border-separator)') : 'none',
                      opacity: isChecked ? 0.6 : 1, transition: 'opacity 0.2s',
                    }}>
                      <button onClick={() => handleToggleCheck(p.id)} style={{
                        width: 26, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0,
                        background: isChecked ? `linear-gradient(135deg, ${accent}cc, ${accent})` : 'var(--progress-track)',
                        ...(isChecked ? {} : { boxShadow: 'none' }),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                      }}>
                        {isChecked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </button>
                      {p.imageThumb ? (
                        <img src={p.imageThumb} alt="" style={{ width: 32, height: 32, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: `${cat.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{cat.emoji}</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textDecoration: isChecked ? 'line-through' : 'none' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{p.brand}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: cat.color, background: `${cat.color}12`, borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>{p.category}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Weekly Calendar */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>주간 루틴 현황</div>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              {weekly.map((day) => (
                <div key={day.dayLabel} style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
                    background: day.completed ? accent : day.isToday ? `${accent}20` : day.partial ? `${accent}10` : 'var(--item-bg)',
                    border: day.isToday && !day.completed ? `2px solid ${accent}` : 'none',
                  }}>
                    {day.completed ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      : day.partial ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} /> : null}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: day.isToday ? 600 : 400, color: day.isToday ? accent : ('var(--text-muted)') }}>{day.dayLabel}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SECTION 3: 효과 분석 ═══ */}
      {section === 'analysis' && (
        <div style={{ padding: '20px 20px 0', animation: 'fadeUp 0.3s ease-out' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>제품별 효과 분석</span>
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
    </div>
  );
}

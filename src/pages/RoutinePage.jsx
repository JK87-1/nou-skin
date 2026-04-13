/**
 * 스킨케어 루틴 트래커 v1.0
 * 제품 등록 (사진 AI / 수동), 루틴 체크, 효과 분석
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import WeekDateHeader from '../components/WeekDateHeader';
import { createPortal } from 'react-dom';
import { SunIcon, MoonIcon, LotionIcon, PastelIcon } from '../components/icons/PastelIcons';
import { getWeeklyRoutineStatus } from '../storage/RoutineCheckStorage';
import { getEnabledCategories, getCategoryColor, getCategories } from '../storage/ProfileStorage';
import { getRoutineItems, saveRoutineItem, deleteRoutineItem, updateRoutineItem, saveRoutineOrder, getChecks, toggleCheck, getTodayProgress, getAllRoutineItems, getStreak, CAT_LABEL, CAT_COLOR } from '../storage/RoutineCheckStorage';
import {
  TRACKER_CATEGORIES, getProducts, saveProduct, deleteProduct,
  getProductsForMode,
  getTrackerProgress, getTrackerProgressForDate, getTrackerWeekly,
  getTrackerChecksForDate, toggleTrackerCheckForDate,
  computeAllCorrelations, compressProductThumb,
} from '../storage/TrackerStorage';

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

// hex 컬러를 amount만큼 어둡게
function darkenColor(hex, amount = 0.4) {
  const h = hex.replace('#', '');
  const r = Math.round(parseInt(h.substring(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(h.substring(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(h.substring(4, 6), 16) * (1 - amount));
  return `rgb(${r},${g},${b})`;
}

function hexToRgba(hex, alpha = 0.2) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
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
    { key: 'morning', label: '☀️ 아침' },
    { key: 'night', label: '🌙 저녁' },
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
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>제품 등록</div>
        {[
          { emoji: '📷', label: '사진으로 등록', desc: 'AI가 제품명과 성분을 자동 인식해요', action: onPhoto },
          { emoji: '✏️', label: '직접 입력', desc: '제품 정보를 수동으로 입력해요', action: onManual },
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
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>제품 사진 촬영</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              제품 라벨이 잘 보이도록 촬영해주세요
            </p>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
            <input ref={albumRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: '📷 카메라', ref: cameraRef },
                { label: '🖼️ 앨범', ref: albumRef },
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
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>제품 정보 확인</div>

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

function ManualRegistrationForm({ onClose, onSave, saving, accent }) {
  const [form, setForm] = useState({ brand: '', name: '', category: '기타', timeSlot: 'both' });

  const handleSave = () => {
    if (!form.brand.trim() || !form.name.trim() || saving) return;
    onSave(form);
  };

  const canSave = form.brand.trim() && form.name.trim() && !saving;

  return (
    <SheetOverlay onClose={onClose}>
      <div style={{ background: 'var(--sheet-bg)', padding: '24px 20px calc(40px + env(safe-area-inset-bottom, 0px))' }}>
        <SheetHandle />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>제품 직접 입력</div>

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
              <div style={{ flex: 1, borderRadius: 12, padding: '14px', textAlign: 'center', background: 'var(--item-bg)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>사용 기간</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: accent, fontFamily: 'var(--font-display)' }}>{days}일</div>
              </div>
              <div style={{ flex: 1, borderRadius: 12, padding: '14px', textAlign: 'center', background: 'var(--item-bg)' }}>
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
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>제품 정보 수정</div>

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

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function RoutinePage({ themeColors, onBack, initialMode }) {
  const [enabledCats, setEnabledCats] = useState(() => getEnabledCategories());
  const [routineCat, setRoutineCat] = useState('all');
  useEffect(() => {
    const handler = () => {
      const cats = getEnabledCategories();
      setEnabledCats(cats);
      if (routineCat !== 'all' && !cats.find(c => c.key === routineCat)) setRoutineCat('all');
    };
    window.addEventListener('lua:categories-changed', handler);
    return () => window.removeEventListener('lua:categories-changed', handler);
  }, [routineCat]);
  const [pageMode, setPageMode] = useState(initialMode || 'routine');
  const [showManagement, setShowManagement] = useState(false);
  const [section, setSection] = useState('products');
  const [products, setProducts] = useState(() => getProducts());
  const [routineMode, setRoutineMode] = useState(new Date().getHours() >= 18 ? 'night' : 'morning');
  const [selectedDate, setSelectedDate] = useState(getTodayStr);
  const [headerTitle, setHeaderTitle] = useState('');
  const isToday = selectedDate === getTodayStr();
  const [checks, setChecks] = useState(() => getTrackerChecksForDate(selectedDate));
  const [analyses, setAnalyses] = useState([]);

  // Sheets
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showPhotoFlow, setShowPhotoFlow] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const accent = themeColors?.accent || '#89cef5';
  const getCat = (cat) => TRACKER_CATEGORIES[cat] || TRACKER_CATEGORIES['기타'];

  const handleSelectDate = (dateKey) => {
    setSelectedDate(dateKey);
    setChecks(getTrackerChecksForDate(dateKey));
  };

  // 루틴 데이터
  const modeProducts = getProductsForMode(routineMode);
  const progress = getTrackerProgressForDate(selectedDate, routineMode);
  const weekly = getTrackerWeekly();

  // 효과 분석 로드
  useEffect(() => {
    if (section === 'analysis') setAnalyses(computeAllCorrelations());
  }, [section, products]);

  // 제품 저장 핸들러 (누끼 이미지 먼저 가져온 후 저장)
  const [saving, setSaving] = useState(false);

  const handleSaveProduct = async (formData) => {
    setSaving(true);
    try {
      // 수동 등록일 때만 네이버 쇼핑에서 누끼 이미지 가져오기
      // (사진 등록은 PhotoRegistrationFlow에서 이미 보정 완료)
      if (!formData.imageThumb && formData.brand && formData.name) {
        try {
          const info = await fetchProductInfo(formData.brand, formData.name);
          if (info?.image) {
            const thumb = await compressProductThumb(info.image);
            if (thumb) formData = { ...formData, imageThumb: thumb };
          }
        } catch { /* 실패 시 기존 데이터 유지 */ }
      }

      const updated = saveProduct(formData);
      setProducts(updated);
      setShowPhotoFlow(false);
      setShowManualForm(false);
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
    const updated = toggleTrackerCheckForDate(selectedDate, routineMode, productId);
    setChecks(updated);
  };

  const sections = [
    { key: 'products', label: '내 제품', icon: '🧴' },
    { key: 'routine', label: '오늘의 루틴', icon: '✅' },
    { key: 'analysis', label: '효과 분석', icon: '📊' },
  ];

  if (showManagement) {
    return (
      <RoutineManagement
        enabledCats={enabledCats}
        initialTab={routineCat}
        onBack={() => setShowManagement(false)}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 100, animation: 'breatheIn 0.5s ease both' }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)', fontFamily: 'Pretendard, sans-serif' }}>{headerTitle}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div onClick={() => setShowAddSheet(true)} style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div onClick={() => setShowManagement(true)} style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </div>
        </div>
      </div>

      <WeekDateHeader
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        weeklyData={getWeeklyRoutineStatus()}
        hideTitle
        onTitleChange={setHeaderTitle}
      />

      {/* Category Tabs — 전체 + enabled categories */}
      {(() => {
        const allTabs = [{ key: 'all', label: '전체' }, ...enabledCats];
        const idx = allTabs.findIndex(t => t.key === routineCat);
        const pos = idx === 0 ? 'first' : idx === allTabs.length - 1 ? 'last' : 'mid';
        return (
          <>
            <div style={{ padding: '12px 10px 0' }}>
              <div className="segment-control" data-active={pos}>
                {allTabs.map(cat => (
                  <button key={cat.key} className={`segment-btn${routineCat === cat.key ? ' active' : ''}`}
                    onClick={() => setRoutineCat(cat.key)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {cat.key !== 'all' && cat.color && (
                        <span style={{ width: 8, height: 8, borderRadius: 3, background: cat.color, flexShrink: 0 }} />
                      )}
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="tab-content-panel" data-active={pos}>
              <RoutineChecklist
                key={routineCat}
                mode={routineCat}
                enabledCats={enabledCats}
                selectedDate={selectedDate}
              />
            </div>
          </>
        );
      })()}

      {/* Tracker mode — existing tracker content (hidden) */}
      {pageMode === '__tracker__' && <>
      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '20px 20px 4px', overflowX: 'auto' }}>
        {sections.map(s => {
          const active = section === s.key;
          return (
            <button key={s.key} onClick={() => setSection(s.key)} style={{
              border: active ? `1px solid ${accent}40` : 'var(--item-border)',
              background: active ? `${accent}18` : 'var(--item-bg)',
              color: active ? accent : ('var(--tag-color)'),
              borderRadius: 50, padding: '8px 18px', fontSize: 13, fontWeight: active ? 600 : 500,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.2s',
            }}><span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 4 }}><PastelIcon emoji={s.icon} size={14} /></span>{s.label}</button>
          );
        })}
      </div>

      {/* ═══ SECTION 1: 내 제품 ═══ */}
      {section === 'products' && (
        <div style={{ padding: '20px 20px 0', animation: 'fadeUp 0.3s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>등록된 제품</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: accent, background: `${accent}15`, borderRadius: 10, padding: '2px 8px', marginLeft: 8 }}>
                {products.length}개
              </span>
            </div>
          </div>


          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, alignItems: 'stretch' }}>
            {products.map((p, i) => {
              const cat = getCat(p.category);
              const days = Math.max(0, Math.floor((Date.now() - new Date(p.startDate)) / 86400000));
              return (
                <div key={p.id} onClick={() => setSelectedProduct(p)} className="card" style={{
                  padding: 14, cursor: 'pointer', minWidth: 0, boxSizing: 'border-box',
                  display: 'flex', flexDirection: 'column',
                  animation: `breatheIn 0.4s ease ${i * 0.06}s both`,
                }}>
                  {p.imageThumb ? (
                    <img src={p.imageThumb} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', marginBottom: 10, flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 10, background: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      {cat.emoji}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.4, minHeight: '2.8em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: cat.color, background: `${cat.color}15`, borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>{p.category}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
                      {p.timeSlot === 'both' ? '아침·저녁' : p.timeSlot === 'morning' ? '아침' : '저녁'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>{days}일째 사용중</div>
                </div>
              );
            })}

            {/* Add Product Card */}
            <div onClick={() => setShowAddSheet(true)} style={{
              padding: 14, cursor: 'pointer', minWidth: 0, boxSizing: 'border-box',
              borderRadius: 16,
              border: '2px dashed var(--border-subtle)',
              background: 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, minHeight: 180,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${accent}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke={accent} strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: accent }}>제품 등록</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SECTION 2: 오늘의 루틴 ═══ */}
      {section === 'routine' && (
        <div style={{ padding: '20px 20px 0', animation: 'fadeUp 0.3s ease-out' }}>
          <div className="segment-control" style={{ marginBottom: 20 }}>
            <button className={`segment-btn${routineMode === 'morning' ? ' active' : ''}`} onClick={() => setRoutineMode('morning')}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><SunIcon size={14} /></span> 모닝 케어</button>
            <button className={`segment-btn${routineMode === 'night' ? ' active' : ''}`} onClick={() => setRoutineMode('night')}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><MoonIcon size={14} /></span> 나이트 케어</button>
          </div>

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
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{isToday ? '오늘' : `${new Date(selectedDate + 'T00:00:00').getMonth() + 1}/${new Date(selectedDate + 'T00:00:00').getDate()}`} 진행률</span>
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
              const confColor = a.confidence === '높음' ? '#89cef5' : a.confidence === '보통' ? '#F0B870' : '#8888a0';
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
                            background: m.improved ? 'rgba(137,206,245,0.1)' : 'rgba(239,68,68,0.1)',
                            border: `1px solid ${m.improved ? 'rgba(137,206,245,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          }}>
                            <span style={{ fontSize: 12, color: 'var(--tag-color)' }}>{m.label}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: m.improved ? '#89cef5' : '#ef4444' }}>
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
                      <span style={{ fontSize: 18, flexShrink: 0 }}>🤖</span>
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
      </>}
    </div>
  );
}

// ===== Routine Management Component (루틴 관리) =====

function RoutineManagement({ enabledCats, initialTab, onBack }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'all');
  const isAll = activeTab === 'all';
  const catKey = isAll ? null : activeTab;
  const label = catKey ? (CAT_LABEL[catKey] || catKey) : '전체';

  // 아이템 로드
  const loadItems = useCallback(() => {
    const map = {};
    const _isAll = activeTab === 'all';
    const _catKey = _isAll ? null : activeTab;
    const keys = _isAll ? enabledCats.map(c => c.key) : [_catKey];
    keys.forEach(k => { map[k] = getRoutineItems(k); });
    return map;
  }, [activeTab, enabledCats]);

  const [itemsMap, setItemsMap] = useState(loadItems);

  useEffect(() => { setItemsMap(loadItems()); }, [loadItems]);

  // 추가 바텀 시트
  const [showAddSheet, setShowAddSheet] = useState(false);
  // 수정 바텀 시트
  const [editItem, setEditItem] = useState(null);
  // 액션 시트 (길게 누르기)
  const [actionItem, setActionItem] = useState(null);
  // 드래그 상태
  const [dragCat, setDragCat] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const longPressTimer = useRef(null);

  // 플랫 리스트 (카테고리별)
  const getCatItems = (ck) => {
    const items = (itemsMap[ck] || []).map(i => ({ ...i, category: ck }));
    const active = items.filter(i => i.active !== false);
    const inactive = items.filter(i => i.active === false);
    return { active, inactive };
  };

  // 토글 active
  const handleToggleActive = (cat, id) => {
    const items = itemsMap[cat] || [];
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newActive = item.active === false ? true : false;
    updateRoutineItem(cat, id, { active: newActive });
    setItemsMap(loadItems());
  };

  // 삭제
  const handleDelete = (cat, id, name) => {
    if (confirm(`"${name}"을 삭제할까요?\n연속 기록도 함께 삭제돼요.`)) {
      deleteRoutineItem(cat, id);
      setItemsMap(loadItems());
      setActionItem(null);
    }
  };

  // 드래그 순서 변경
  const handleDragStart = (cat, idx) => {
    setDragCat(cat);
    setDragIdx(idx);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (cat, dropIdx) => {
    if (dragCat !== cat || dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const items = [...(itemsMap[cat] || [])];
    // 활성 아이템만 대상
    const activeItems = items.filter(i => i.active !== false);
    const inactiveItems = items.filter(i => i.active === false);
    const [moved] = activeItems.splice(dragIdx, 1);
    activeItems.splice(dropIdx, 0, moved);
    const reordered = [...activeItems, ...inactiveItems];
    saveRoutineOrder(cat, reordered);
    setItemsMap(loadItems());
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // 터치 드래그
  const touchStartY = useRef(0);
  const touchItemRef = useRef(null);

  // 롱 프레스
  const handleTouchStart = (item) => {
    longPressTimer.current = setTimeout(() => {
      setActionItem(item);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // 아이템 렌더
  const renderItem = (item, idx, cat, isActive) => {
    const catLabel = CAT_LABEL[cat] || (enabledCats.find(c => c.key === cat)?.label) || cat;
    const catClr = getCategoryColor(cat);
    const isDragging = dragCat === cat && dragIdx === idx && isActive;
    const isDragOver = dragCat === cat && dragOverIdx === idx && isActive;

    return (
      <div
        key={`${cat}_${item.id}`}
        draggable={isActive}
        onDragStart={() => isActive && handleDragStart(cat, idx)}
        onDragOver={(e) => isActive && handleDragOver(e, idx)}
        onDrop={() => isActive && handleDrop(cat, idx)}
        onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
        onTouchStart={() => handleTouchStart({ ...item, category: cat })}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => { e.preventDefault(); setActionItem({ ...item, category: cat }); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', marginBottom: 5,
          background: 'rgba(255,255,255,.72)',
          borderRadius: 13,
          border: isDragOver ? '1.5px solid #60AADD' : '0.5px solid rgba(255,255,255,.95)',
          opacity: isActive ? 1 : 0.5,
          transform: isDragging ? 'scale(1.02)' : 'none',
          transition: 'all 0.15s ease',
          cursor: isActive ? 'default' : 'default',
          boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.03)',
        }}
      >
        {/* 컬러칩 */}
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          background: catClr,
          border: '2px solid rgba(255,255,255,0.8)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }} />

        {/* 이름 + 알림시간 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: '#1A3A4A',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{item.name}</div>
          {item.alarmTime && (
            <div style={{ fontSize: 10, color: '#9ABBC8', marginTop: 1 }}>
              🔔 {item.alarmTime}
            </div>
          )}
          {!item.alarmTime && item.time && (
            <div style={{ fontSize: 10, color: '#9ABBC8', marginTop: 1 }}>
              {item.time}
            </div>
          )}
        </div>

        {/* 토글 */}
        <div
          onClick={(e) => { e.stopPropagation(); handleToggleActive(cat, item.id); }}
          style={{
            width: 30, height: 17, borderRadius: 99, flexShrink: 0, cursor: 'pointer',
            position: 'relative',
            background: isActive
              ? 'linear-gradient(120deg, #90CCE8, #60AADD)'
              : 'rgba(100,180,220,.15)',
            border: isActive ? 'none' : '0.5px solid rgba(100,180,220,.2)',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{
            width: 13, height: 13, borderRadius: '50%', background: '#fff',
            position: 'absolute', top: 2,
            left: isActive ? 15 : 2,
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          }} />
        </div>

        {/* 드래그 핸들 */}
        {isActive && (
          <div style={{
            fontSize: 12, color: '#AACCD8', cursor: 'grab',
            marginLeft: 4, flexShrink: 0, userSelect: 'none',
          }}>⋮⋮</div>
        )}
      </div>
    );
  };

  // 카테고리별 섹션 렌더
  const renderCategorySection = (ck) => {
    const { active, inactive } = getCatItems(ck);
    const catLabel = CAT_LABEL[ck] || ck;

    return (
      <div key={ck} style={{ marginBottom: 16 }}>
        {isAll && (
          <div style={{
            fontSize: 10, color: '#9ABBC8', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '.05em',
            margin: '10px 0 5px',
          }}>{catLabel}</div>
        )}

        {active.map((item, idx) => renderItem(item, idx, ck, true))}

        {inactive.length > 0 && (
          <>
            <div style={{
              fontSize: 10, color: '#9ABBC8', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '.05em',
              margin: '12px 0 5px',
            }}>비활성</div>
            {inactive.map((item, idx) => renderItem(item, idx, ck, false))}
          </>
        )}
      </div>
    );
  };

  const allTabs = [{ key: 'all', label: '전체' }, ...enabledCats];
  const cats = isAll ? enabledCats.map(c => c.key) : [catKey];
  const hasAnyItems = cats.some(ck => (itemsMap[ck] || []).length > 0);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 100, animation: 'breatheIn 0.5s ease both' }}>
      {/* 1. 헤더 */}
      <div style={{
        padding: '16px 20px 0', display: 'flex', alignItems: 'center', position: 'relative',
      }}>
        <div onClick={onBack} style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>루틴 관리</span>
        <div style={{ flex: 1 }} />
        <div
          onClick={() => setShowAddSheet(true)}
          style={{
            width: 28, height: 28, borderRadius: 9, cursor: 'pointer',
            background: 'linear-gradient(120deg, #90CCE8, #60AADD)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1,
          }}
        >
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>+</span>
        </div>
      </div>

      {/* 2. 카테고리 탭 */}
      {(() => {
        const idx = allTabs.findIndex(t => t.key === activeTab);
        const pos = idx === 0 ? 'first' : idx === allTabs.length - 1 ? 'last' : 'mid';
        return (
          <div style={{ padding: '12px 10px 0' }}>
            <div className="segment-control" data-active={pos}>
              {allTabs.map(tab => (
                <button key={tab.key} className={`segment-btn${activeTab === tab.key ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {tab.key !== 'all' && tab.color && (
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: tab.color, flexShrink: 0 }} />
                    )}
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 3. 안내 텍스트 */}
      <div style={{ padding: '10px 18px 0' }}>
        <div style={{ fontSize: 10, color: '#9ABBC8', marginBottom: 8 }}>
          ⋮⋮ 드래그로 순서 변경 · 토글로 활성화
        </div>
      </div>

      {/* 4-5. 루틴 아이템 리스트 */}
      <div style={{ padding: '0 18px' }}>
        {!hasAnyItems ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ABBC8' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#5A9AAA' }}>아직 루틴이 없어요</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>아래 버튼으로 루틴을 추가해보세요</div>
          </div>
        ) : (
          cats.map(ck => renderCategorySection(ck))
        )}

        {/* 6. 루틴 추가 버튼 */}
        <button onClick={() => setShowAddSheet(true)} style={{
          width: '100%', padding: '9px 0', borderRadius: 12,
          background: 'rgba(100,180,220,.04)',
          border: '1.5px dashed rgba(100,180,220,.3)',
          color: '#5AAABB', fontSize: 11, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
        }}>+ {isAll ? '루틴' : label + ' 루틴'} 추가하기</button>
      </div>

      {/* 8. 루틴 추가/수정 바텀 시트 */}
      {(showAddSheet || editItem) && (
        <RoutineAddEditSheet
          enabledCats={enabledCats}
          defaultCategory={catKey}
          editData={editItem}
          onSave={(cat, item) => {
            if (editItem) {
              updateRoutineItem(cat, item.id, item);
            } else {
              saveRoutineItem(cat, { name: item.name, time: item.time, alarmTime: item.alarmTime, active: true });
            }
            setItemsMap(loadItems());
            setShowAddSheet(false);
            setEditItem(null);
          }}
          onClose={() => { setShowAddSheet(false); setEditItem(null); }}
        />
      )}

      {/* 9. 액션 시트 (길게 누르기) */}
      {actionItem && (
        <div onClick={() => setActionItem(null)} style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 16, padding: 0, width: 260,
            overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          }}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A3A4A' }}>{actionItem.name}</div>
            </div>
            <div
              onClick={() => {
                setEditItem(actionItem);
                setActionItem(null);
              }}
              style={{
                padding: '14px 20px', cursor: 'pointer', fontSize: 14, color: '#1A3A4A',
                borderBottom: '1px solid #f0f0f0',
              }}
            >수정하기</div>
            <div
              onClick={() => handleDelete(actionItem.category, actionItem.id, actionItem.name)}
              style={{
                padding: '14px 20px', cursor: 'pointer', fontSize: 14, color: '#E05050',
              }}
            >삭제하기</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Routine Add/Edit Bottom Sheet =====

function RoutineAddEditSheet({ enabledCats, defaultCategory, editData, onSave, onClose }) {
  const isEdit = !!editData;
  const [name, setName] = useState(editData?.name || '');
  const [category, setCategory] = useState(editData?.category || defaultCategory || '');
  const [timeSlot, setTimeSlot] = useState(editData?.time || '아침');
  const [alarmEnabled, setAlarmEnabled] = useState(!!editData?.alarmTime);
  const [alarmTime, setAlarmTime] = useState(editData?.alarmTime || '08:00');

  const timeLabels = ['아침', '점심', '저녁'];
  const catLabel = category ? (CAT_LABEL[category] || category) : '';

  const handleSave = () => {
    if (!name.trim() || !category) return;
    const item = {
      ...(editData || {}),
      name: name.trim(),
      time: timeSlot,
      alarmTime: alarmEnabled ? alarmTime : null,
    };
    onSave(category, item);
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#ccc', margin: '0 auto 20px', opacity: 0.5 }} />
        <div style={{ fontSize: 17, fontWeight: 700, color: '#1A3A4A', marginBottom: 20 }}>
          {isEdit ? '루틴 수정' : '루틴 추가'}
        </div>

        {/* 루틴 이름 */}
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="루틴 이름을 입력하세요"
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            background: '#F2F3F5', fontSize: 14, color: '#1A3A4A',
            fontFamily: 'inherit', outline: 'none', marginBottom: 16,
            boxSizing: 'border-box',
          }}
          autoFocus
        />

        {/* 카테고리 선택 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9ABBC8', marginBottom: 8 }}>카테고리</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {enabledCats.map(c => {
              const active = category === c.key;
              return (
                <button key={c.key} onClick={() => setCategory(c.key)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                  background: active ? 'linear-gradient(120deg, #90CCE8, #60AADD)' : '#F2F3F5',
                  color: active ? '#fff' : '#9ABBC8',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>{c.label}</button>
              );
            })}
          </div>
        </div>

        {/* 시간대 선택 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9ABBC8', marginBottom: 8 }}>시간대</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {timeLabels.map(t => {
              const active = timeSlot === t;
              return (
                <button key={t} onClick={() => setTimeSlot(t)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                  background: active ? 'linear-gradient(120deg, #90CCE8, #60AADD)' : '#F2F3F5',
                  color: active ? '#fff' : '#9ABBC8',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>{t}</button>
              );
            })}
          </div>
        </div>

        {/* 알림 시간 설정 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#9ABBC8' }}>알림 시간</div>
            <div
              onClick={() => setAlarmEnabled(!alarmEnabled)}
              style={{
                width: 30, height: 17, borderRadius: 99, cursor: 'pointer',
                position: 'relative',
                background: alarmEnabled ? 'linear-gradient(120deg, #90CCE8, #60AADD)' : 'rgba(100,180,220,.15)',
                border: alarmEnabled ? 'none' : '0.5px solid rgba(100,180,220,.2)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                width: 13, height: 13, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: alarmEnabled ? 15 : 2,
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </div>
          </div>
          {alarmEnabled && (
            <input
              type="time"
              value={alarmTime}
              onChange={e => setAlarmTime(e.target.value)}
              style={{
                width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                background: '#F2F3F5', fontSize: 14, color: '#1A3A4A',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />
          )}
        </div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 14,
            border: 'none', background: '#F2F3F5',
            color: '#9ABBC8', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={handleSave} style={{
            flex: 1, padding: '14px 0', borderRadius: 14,
            border: 'none', background: 'linear-gradient(120deg, #90CCE8, #60AADD)',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            opacity: (!name.trim() || !category) ? 0.4 : 1,
          }}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ===== Routine Checklist Component (v2 — 전체 + 카테고리 탭) =====

function RoutineChecklist({ mode, enabledCats, selectedDate }) {
  const isAll = mode === 'all';
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = selectedDate || today;
  const isToday = dateStr === today;
  const catKey = isAll ? null : mode; // skin | food | body | face
  const label = catKey ? (CAT_LABEL[catKey] || catKey) : '전체';

  // 아이템 & 체크 상태
  const [itemsMap, setItemsMap] = useState(() => {
    if (isAll) {
      const map = {};
      enabledCats.forEach(c => { map[c.key] = getRoutineItems(c.key); });
      return map;
    }
    return { [catKey]: getRoutineItems(catKey) };
  });
  const [checksMap, setChecksMap] = useState(() => {
    const map = {};
    const keys = isAll ? enabledCats.map(c => c.key) : [catKey];
    keys.forEach(k => { map[k] = getChecks(k, dateStr); });
    return map;
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTime, setNewTime] = useState('아침');
  const [aiCoach, setAiCoach] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const keys = isAll ? enabledCats.map(c => c.key) : [catKey];
    const map = {};
    keys.forEach(k => { map[k] = getChecks(k, dateStr); });
    setChecksMap(map);
  }, [dateStr]);

  // 모든 아이템 플랫 리스트 (category 필드 포함)
  const flatItems = [];
  const cats = isAll ? enabledCats.map(c => c.key) : [catKey];
  cats.forEach(ck => {
    (itemsMap[ck] || []).forEach(item => {
      flatItems.push({ ...item, category: ck });
    });
  });

  // 진행률
  const total = flatItems.length;
  const done = flatItems.filter(item => checksMap[item.category]?.[item.id]).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const progressLabel = isAll ? '오늘의 루틴' : `${label} 루틴`;

  const handleToggle = (cat, id) => {
    const updated = toggleCheck(cat, dateStr, id);
    setChecksMap(prev => ({ ...prev, [cat]: updated }));
  };

  const handleAdd = () => {
    if (!newName.trim() || !catKey) return;
    const updated = saveRoutineItem(catKey, { name: newName.trim(), time: newTime });
    setItemsMap(prev => ({ ...prev, [catKey]: updated }));
    setNewName('');
    setShowAdd(false);
  };

  const handleDelete = (cat, id) => {
    const updated = deleteRoutineItem(cat, id);
    setItemsMap(prev => ({ ...prev, [cat]: updated }));
  };

  // AI 코치 멘트 (카테고리 탭에서만)
  useEffect(() => {
    if (isAll || !catKey || flatItems.length === 0) return;
    setAiLoading(true);
    const maxStreak = flatItems.reduce((max, item) => Math.max(max, getStreak(item.category, item.id)), 0);
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '당신은 스킨케어/건강 코치입니다. 이모지 포함 1문장 격려 멘트를 생성하세요. 한국어로 답하세요.' },
          { role: 'user', content: `카테고리: ${label}, 완료율: ${completionRate}%, 최장연속일수: ${maxStreak}일, 루틴수: ${total}개` },
        ],
        max_tokens: 80,
      }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => {
        const msg = data.choices?.[0]?.message?.content?.trim();
        if (msg) setAiCoach(msg);
      })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); setAiLoading(false); });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [catKey]);

  const timeLabels = ['아침', '점심', '저녁'];
  const timePlaceholders = { skin: '예: 토너 바르기, 선크림', food: '예: 물 2L 마시기, 채소 먹기', body: '예: 스트레칭, 걷기 30분', face: '예: 얼굴 마사지, 표정 운동' };

  return (
    <div style={{ padding: '0 18px', animation: 'breatheIn 0.5s ease both' }}>
      {/* Progress bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {isToday ? progressLabel : `${new Date(dateStr + 'T00:00:00').getMonth() + 1}/${new Date(dateStr + 'T00:00:00').getDate()} ${label} 루틴`}
          </span>
          <span style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 600 }}>{done}/{total}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--bar-track)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3, width: `${pct}%`,
            background: 'var(--accent-primary)',
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Items grouped by time */}
      {flatItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>아직 {label} 루틴이 없어요</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>
            {isAll ? '각 카테고리 탭에서 루틴을 추가해보세요' : '+ 버튼으로 루틴을 추가해보세요'}
          </div>
          {!isAll && (
            <button onClick={() => setShowAdd(true)} style={{
              marginTop: 16, padding: '10px 24px', borderRadius: 'var(--btn-radius)',
              background: 'var(--accent-primary)', border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>루틴 추가하기</button>
          )}
        </div>
      ) : (
        <>
          {timeLabels.map(time => {
            const timeItems = flatItems.filter(i => i.time === time);
            if (timeItems.length === 0) return null;
            return (
              <div key={time} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#9ABBC8', marginBottom: 8 }}>{time}</div>
                {timeItems.map(item => {
                  const checked = !!checksMap[item.category]?.[item.id];
                  const catLbl = CAT_LABEL[item.category] || (enabledCats.find(c => c.key === item.category)?.label) || item.category;
                  const itemColor = getCategoryColor(item.category);
                  const streak = getStreak(item.category, item.id);
                  return (
                    <div key={`${item.category}_${item.id}`} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '14px 16px', marginBottom: 6,
                      background: 'var(--bg-card)', borderRadius: 14,
                      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4)',
                    }}>
                      {/* Color bar */}
                      <div style={{
                        width: 4, height: 22, borderRadius: 3, flexShrink: 0,
                        background: itemColor,
                      }} />
                      {/* Check circle */}
                      <div onClick={() => handleToggle(item.category, item.id)} style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                        border: checked ? 'none' : '2px solid var(--border-subtle)',
                        background: checked ? 'var(--accent-primary)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease',
                      }}>
                        {checked && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      {/* Name */}
                      <div style={{
                        flex: 1, fontSize: 14, fontWeight: 500, minWidth: 0,
                        color: checked ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: checked ? 'line-through' : 'none',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{item.name}</div>
                      {/* 전체 탭: 카테고리 뱃지 / 카테고리 탭: streak */}
                      {isAll ? (
                        <span style={{
                          fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 99, flexShrink: 0,
                          background: hexToRgba(itemColor, 0.2), color: darkenColor(itemColor, 0.4),
                        }}>{catLbl}</span>
                      ) : streak > 0 ? (
                        <span style={{ fontSize: 11, color: '#FF8C42', fontWeight: 600, flexShrink: 0 }}>
                          🔥 {streak}일
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* 카테고리 탭: 루틴 추가 버튼 */}
          {!isAll && (
            <button onClick={() => setShowAdd(true)} style={{
              width: '100%', padding: '9px 0', borderRadius: 12,
              background: 'rgba(100,180,220,.04)',
              border: '1.5px dashed rgba(100,180,220,.3)',
              color: '#5AAABB', fontSize: 11, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: 16,
            }}>+ {label} 루틴 추가하기</button>
          )}
        </>
      )}

      {/* AI 코치 카드 — 카테고리 탭에서만 */}
      {!isAll && flatItems.length > 0 && (
        <div style={{
          borderRadius: 16, padding: '14px 16px', marginBottom: 16,
          background: 'var(--bg-card)',
          border: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>🤖</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>AI 코치</div>
              {aiLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>분석 중...</div>
              ) : aiCoach ? (
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{aiCoach}</div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {(() => {
                    const maxStreak = flatItems.reduce((max, item) => Math.max(max, getStreak(item.category, item.id)), 0);
                    if (maxStreak > 7) return `🎯 ${label} 루틴을 ${maxStreak}일 연속 실천 중이에요! 대단해요!`;
                    if (done === total && total > 0) return `✨ 오늘 ${label} 루틴을 모두 완료했어요! 완벽해요!`;
                    return `💪 ${label} 루틴을 꾸준히 실천해보세요!`;
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add routine modal */}
      {showAdd && !isAll && (
        <div onClick={() => setShowAdd(false)} style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
            padding: '24px 24px 40px', width: '100%', maxWidth: 420,
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>{label} 루틴 추가</div>

            {/* Time selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {timeLabels.map(t => (
                <button key={t} onClick={() => setNewTime(t)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                  background: newTime === t ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                  color: newTime === t ? '#fff' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>{t}</button>
              ))}
            </div>

            {/* Name input */}
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={timePlaceholders[catKey] || '루틴을 입력하세요'}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: 'var(--bg-input, #F2F3F5)', fontSize: 14,
                color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
                marginBottom: 20,
              }}
              autoFocus
            />

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAdd(false)} style={{
                flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
                border: 'none', background: 'var(--bg-input, #F2F3F5)',
                color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>취소</button>
              <button onClick={handleAdd} style={{
                flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
                border: 'none', background: 'var(--accent-primary)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

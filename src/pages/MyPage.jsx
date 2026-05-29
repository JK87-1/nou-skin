import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  getProfile, saveProfile,
  SKIN_TYPES, SKIN_CONCERNS, SENSITIVITY_OPTIONS, GENDER_OPTIONS,
} from '../storage/ProfileStorage';
import { getRecords, getTotalChanges, getAllThumbnailsAsync, deleteRecord } from '../storage/SkinStorage';

import { clearBaseline, hasBaseline } from '../engine/HybridAnalysis';
import { clearAllRecords } from '../storage/SkinStorage';
import {
  isPushSupported, isStandalone, isIOS, getPermissionState,
  subscribeToPush, saveSubscriptionToServer,
  unsubscribeFromPush, updateReminderTime,
  updateTipSettings, updateWeatherSettings, syncSkinDataToServer,
} from '../utils/pushNotification';
import { getLatestRecord } from '../storage/SkinStorage';
import { getGoal, saveGoal, clearGoal, getDaysRemaining, getGoalProgress, getOverallProgress, METRIC_META } from '../storage/GoalStorage';
import { getAllPhotosRaw, restorePhotos } from '../storage/PhotoDB';
import { setProfileImage as setProfileImageIDB, getProfileImage as getProfileImageIDB } from '../storage/ImageStore';
import { hapticLight, hapticWarning, hapticSuccess } from '../utils/haptics';
import { getUserLocation, saveUserLocation } from '../storage/WeatherStorage';
import { Capacitor } from '@capacitor/core';
import { MoonIcon, SunIcon, CameraIcon, SaveIcon, PastelIcon } from '../components/icons/PastelIcons';
import { TERMS_OF_SERVICE, PRIVACY_POLICY, BIOMETRIC_CONSENT, OVERSEAS_TRANSFER_CONSENT, INQUIRY_FAQ, CONTACT_EMAIL } from '../legal/legalContent';
import SiteFooter from '../components/SiteFooter';

export default function MyPage({ colorMode, setColorMode, colorSkin, setColorSkin, onThemeChange, onMeasure, onViewRecord }) {
  const [profile, setProfile] = useState(getProfile);
  const [toast, setToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('저장되었습니다');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bioModal, setBioModal] = useState(false);
  const [contentMode, setContentMode] = useState('album'); // album | history | record
  const [albumView, setAlbumView] = useState('grid'); // grid | list
  const [listPage, setListPage] = useState(1);

  const records = getRecords();
  const recordCount = records.length;
  const [thumbs, setThumbs] = useState({});
  useEffect(() => { let cancelled = false; getAllThumbnailsAsync().then(t => { if (!cancelled) setThumbs(t); }); return () => { cancelled = true; }; }, []);
  const recentPhotos = useMemo(() => [...records].reverse().map(r => ({ date: r.date, record: r, thumb: thumbs[String(r.id)] || thumbs[r.date] })).filter(p => p.thumb), [records.length, thumbs]);
  const habitDays = (() => { let c = 0; for (let i = 0; i < localStorage.length; i++) { if (localStorage.key(i)?.startsWith('lua_habit_')) c++; } return c; })();

  const glass = { background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', borderRadius: 20 };

  const showToast = (msg) => {
    setToastMsg(msg);
    setToast(true);
    hapticLight();
    setTimeout(() => setToast(false), 2500);
  };
  const update = (key, value) => {
    // profileImage는 큰 dataURL이라 localStorage quota 위험 — state만 갱신, 영속화는 IDB(setProfileImageIDB).
    if (key === 'profileImage') {
      setProfile(prev => ({ ...prev, profileImage: value }));
      return;
    }
    const next = saveProfile({ [key]: value });
    setProfile(prev => ({ ...prev, ...next }));
  };

  const daysTogether = (() => { if (!records.length) return 0; const first = new Date(records[records.length - 1].date); return Math.max(1, Math.floor((Date.now() - first.getTime()) / 86400000)); })();
  const initial = (profile.nickname || '?')[0].toUpperCase();

  // 아바타 클릭 시 사진 등록 — MyPage 자체 ref·핸들러.
  // 큰 사이즈 사진은 IndexedDB(ImageStore)에 저장 — localStorage 5MB quota 회피.
  const profilePhotoRef = useRef(null);

  // 마운트 시 IDB에서 큰 사이즈 프로필 사진 load. localStorage의 옛 작은 사진을 덮어씌움.
  useEffect(() => {
    (async () => {
      try {
        const idbImg = await getProfileImageIDB();
        if (idbImg) setProfile(prev => ({ ...prev, profileImage: idbImg }));
      } catch {}
    })();
  }, []);

  const handleProfilePhoto = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        // 최고 화질 — 768×768 / quality 0.94. IDB라 용량 부담 X. retina @3x 약 256pt 표시까지 깨끗.
        const size = 768;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
        try {
          // IDB에 큰 사이즈 저장 (영속)
          await setProfileImageIDB(dataUrl);
          // localStorage엔 profileImage 필드만 in-memory 상태와 일치하게 정리 — 옛 큰 데이터 제거
          saveProfile({ profileImage: '' });
          setProfile(prev => ({ ...prev, profileImage: dataUrl }));
          showToast('프로필 사진이 변경되었어요');
        } catch {
          showToast('사진 저장에 실패했어요. 다시 시도해주세요.');
        }
      };
      img.onerror = () => showToast('이미지를 읽을 수 없어요. 다른 사진을 선택해주세요.');
      img.src = reader.result;
    };
    reader.onerror = () => showToast('파일을 읽을 수 없어요.');
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  return (
    <div className="ux-stagger" style={{ minHeight: '100dvh', paddingBottom: 64 }}>

      {/* ① 헤더 (noa style) */}
      <div style={{ padding: '12px 28px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 34 }} />
        <div onClick={() => setSettingsOpen(true)} style={{
          width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0f0f0f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path strokeWidth="0" d="M0 0h24v24H0z" fill="none" /><path d="M4 6l16 0" /><path d="M4 12l16 0" /><path d="M4 18l16 0" />
          </svg>
        </div>
      </div>

      {/* ② 프로필 영역 (noa style) */}
      <div style={{ margin: '0 16px 12px', padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          {/* Avatar — 클릭으로 사진 등록/변경. 사이즈 86→108 (1.25배) */}
          <div
            onClick={() => profilePhotoRef.current?.click()}
            style={{
              width: 88, height: 88, borderRadius: '50%', flexShrink: 0,
              background: '#ffffff', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {profile.profileImage ? (
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
                <img src={profile.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <circle cx="12" cy="10" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
              </svg>
            )}
            {/* + 배지 — 동그라미 가장자리 우하단 중간에 걸침 */}
            <div style={{
              position: 'absolute', right: -2, bottom: -2,
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--accent-primary, #6598ef)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
          </div>
          {/* 항상 페이지 레벨에 file input — 모달 닫혀 있어도 아바타 클릭으로 동작 */}
          <input ref={profilePhotoRef} type="file" accept="image/*" onChange={handleProfilePhoto} style={{ display: 'none' }} />

          {/* Stat Tab Grid (3 tabs) */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[
              { key: 'album', iconSrc: '/album.svg', label: '앨범', count: recentPhotos.length },
              { key: 'history', iconSvg: true, label: '변화', count: recordCount },
              { key: 'record', iconSrc: '/memo.svg', label: '기록', count: daysTogether },
            ].map(t => {
              const active = contentMode === t.key;
              const itemColor = active ? '#0f0f0f' : 'rgba(15,15,15,0.4)';
              return (
                <div key={t.key} onClick={() => setContentMode(t.key)} style={{
                  background: 'transparent', borderRadius: 10, padding: '10px 4px',
                  textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: itemColor, transition: 'color 0.2s' }}>{t.count}</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: itemColor, fontWeight: active ? 500 : 400, transition: 'color 0.2s' }}>{t.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Text below avatar */}
        <div style={{ paddingTop: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f0f0f' }}>{profile.nickname || 'user'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6, marginBottom: 20 }}>
            <div onClick={() => setBioModal(true)} style={{ fontSize: 12, color: 'rgba(15,15,15,0.4)', cursor: 'pointer' }}>
              {profile.bio || '자기소개'}
            </div>
            {contentMode === 'album' && recentPhotos.length > 0 && (
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.04)', borderRadius: 6, padding: 1.5, flexShrink: 0, marginLeft: 12 }}>
                <button onClick={() => setAlbumView('grid')} aria-label="그리드 보기" style={{
                  width: 24, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: albumView === 'grid' ? '#fff' : 'transparent',
                  border: 'none', borderRadius: 5, cursor: 'pointer',
                  boxShadow: albumView === 'grid' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  color: albumView === 'grid' ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.25)',
                  transition: 'all 0.2s',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 3a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2z"/><path d="M19 3a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2z"/><path d="M9 13a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2z"/><path d="M19 13a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2z"/></svg>
                </button>
                <button onClick={() => setAlbumView('list')} aria-label="리스트 보기" style={{
                  width: 24, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: albumView === 'list' ? '#fff' : 'transparent',
                  border: 'none', borderRadius: 5, cursor: 'pointer',
                  boxShadow: albumView === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  color: albumView === 'list' ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.25)',
                  transition: 'all 0.2s',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M21 6a1 1 0 0 1 -1 1h-10a1 1 0 1 1 0 -2h10a1 1 0 0 1 1 1"/><path d="M21 12a1 1 0 0 1 -1 1h-10a1 1 0 0 1 0 -2h10a1 1 0 0 1 1 1"/><path d="M21 18a1 1 0 0 1 -1 1h-10a1 1 0 0 1 0 -2h10a1 1 0 0 1 1 1"/><rect x="3" y="4" width="4" height="4" rx="1"/><rect x="3" y="10" width="4" height="4" rx="1"/><rect x="3" y="16" width="4" height="4" rx="1"/></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ⑤ 콘텐츠 영역 */}
      {contentMode === 'album' && (
        <div>
          {recentPhotos.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>측정한 셀카가 여기에 쌓여요</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>첫 측정을 시작해보세요</div>
                <button onClick={() => onMeasure?.()} style={{ background: 'var(--accent-primary, #6598ef)', color: '#fff', fontSize: 11, fontWeight: 500, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>첫 측정 시작</button>
            </div>
          ) : (<>
            {/* 그리드 뷰 */}
            {albumView === 'grid' && (
              <div className="photo-grid" style={{ padding: '0 16px 12px' }}>
                {recentPhotos.map((p) => {
                  const [, mm, dd] = (p.date || '').split('-');
                  const shortDate = mm && dd ? `${mm}월${dd}일` : '';
                  return (
                    <div key={p.record.id || p.date} role="button" aria-label={`${shortDate} 측정 결과 ${p.record.overallScore ?? ''}점`} className="photo-cell" onClick={() => onViewRecord?.(p.record, p.thumb)}>
                      <img src={p.thumb} alt={`${shortDate} 측정`} />
                      <span className="photo-cell-date">{shortDate}</span>
                      <span className="photo-cell-score">{p.record.overallScore ?? '--'}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 리스트 뷰 */}
            {albumView === 'list' && (() => {
              const perPage = 7;
              const totalPages = Math.ceil(recentPhotos.length / perPage);
              const pagePhotos = recentPhotos.slice((listPage - 1) * perPage, listPage * perPage);
              return (
              <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pagePhotos.map((p) => {
                  const [yyyy, mm, dd] = (p.date || '').split('-');
                  const shortDate = mm && dd ? `${mm}월 ${dd}일` : '';
                  const prev = recentPhotos.find(pp => pp.date < p.date);
                  const diff = prev && p.record.overallScore != null && prev.record.overallScore != null
                    ? p.record.overallScore - prev.record.overallScore : null;
                  return (
                    <div key={p.record.id || p.date} role="button" aria-label={`${shortDate} 측정 결과 ${p.record.overallScore ?? ''}점`} onClick={() => onViewRecord?.(p.record, p.thumb)} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '6px 8px',
                      cursor: 'pointer',
                    }}>
                      <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                        <img src={p.thumb} alt={`${shortDate} 측정`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)' }}>
                          {shortDate}{p.record.skinAge != null ? ` · 피부나이 ${p.record.skinAge}세` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, flexShrink: 0 }}>
                        <span style={{ fontSize: 20, fontWeight: 700, color: 'rgba(0,0,0,0.8)', letterSpacing: -0.5 }}>{p.record.overallScore ?? '--'}</span>
                        <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(0,0,0,0.25)' }}>점</span>
                        <span style={{ fontSize: 10, fontWeight: 600, minWidth: 20, marginLeft: 2, color: diff != null && diff !== 0 ? (diff > 0 ? '#6598ef' : '#e05545') : 'transparent' }}>
                          {diff != null && diff !== 0 ? (diff > 0 ? `+${diff}` : diff) : '\u00A0'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10 }}>
                    <button onClick={() => setListPage(p => Math.max(1, p - 1))} disabled={listPage === 1} style={{
                      width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 'none', borderRadius: 10,
                      cursor: listPage === 1 ? 'default' : 'pointer',
                      color: listPage === 1 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.25)',
                      transition: 'all 0.2s',
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6"/></svg>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                      <button key={n} onClick={() => setListPage(n)} style={{
                        minWidth: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent',
                        border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 12, fontWeight: n === listPage ? 700 : 400,
                        color: n === listPage ? '#6598ef' : 'rgba(0,0,0,0.25)',
                        transition: 'all 0.2s',
                      }}>{n}</button>
                    ))}
                    <button onClick={() => setListPage(p => Math.min(totalPages, p + 1))} disabled={listPage === totalPages} style={{
                      width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 'none', borderRadius: 10,
                      cursor: listPage === totalPages ? 'default' : 'pointer',
                      color: listPage === totalPages ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.25)',
                      transition: 'all 0.2s',
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                    </button>
                  </div>
                )}
              </div>
              );
            })()}
          </>)}
        </div>
      )}

      {contentMode === 'history' && (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 8 }}></div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>곧 만나요</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>측정 기록을 한 자리에 정돈해드릴게요</div>
        </div>
      )}

      {contentMode === 'record' && (
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            꾸준한 기록이 빛나는 변화를 만들어요
          </div>
        </div>
      )}


      {/* Bio 편집 모달 */}
      {bioModal && createPortal(
        <BioEditModal
          bio={profile.bio || ''}
          onSave={(v) => { update('bio', v); setBioModal(false); showToast('저장되었어요'); }}
          onClose={() => setBioModal(false)}
        />,
        document.body,
      )}

      {/* Settings Modal */}
      {settingsOpen && createPortal(
        <SettingsModal profile={profile} update={update} onClose={() => setSettingsOpen(false)} showToast={showToast} colorMode={colorMode} setColorMode={setColorMode} colorSkin={colorSkin} setColorSkin={setColorSkin} />,
        document.body,
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', background: 'var(--accent-primary, #6598ef)', color: '#fff', padding: '10px 24px', borderRadius: 20, fontSize: 13, fontWeight: 500, zIndex: 999, boxShadow: '0 6px 22px rgba(101,152,239,0.32)', animation: 'toastSpringIn 0.42s cubic-bezier(0.34, 1.7, 0.5, 1)' }}>{toastMsg}<style>{`@keyframes toastSpringIn { 0% { opacity: 0; transform: translate(-50%, 20px) scale(0.85); } 60% { opacity: 1; transform: translate(-50%, -4px) scale(1.04); } 100% { transform: translate(-50%, 0) scale(1); } }`}</style></div>
      )}
    </div>
  );
}

// ===== Bio Edit Modal =====
function BioEditModal({ bio, onSave, onClose }) {
  const [text, setText] = useState(bio);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,44,83,0.18)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none',
        border: 'none', borderRadius: '22px 22px 0 0',
        boxShadow: '0 -8px 28px rgba(0,0,0,0.08)', padding: '0 0 calc(env(safe-area-inset-bottom,0px))',
        maxWidth: 430, margin: '0 auto', animation: 'slideUp 0.3s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}><div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(101,152,239,0.4)' }} /></div>
        <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>자기소개</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <textarea value={text} onChange={e => setText(e.target.value.slice(0, 50))} placeholder="입력해주세요"
            style={{ width: '100%', minHeight: 80, background: '#ffffff', border: 'none', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }} />
          <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{text.length}/50</div>
          <button onClick={() => onSave(text)} style={{ width: '100%', marginTop: 12, padding: 14, borderRadius: 10, border: 'none', background: 'var(--accent-primary, #6598ef)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>두기</button>
        </div>
      </div>
    </>
  );
}

// ===== Settings Modal =====

function SettingsModal({ profile, update, onClose, showToast, colorMode, setColorMode, colorSkin, setColorSkin }) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingSkin, setEditingSkin] = useState(false);
  const [legalPage, setLegalPage] = useState(null); // 'terms' | 'privacy' | 'biometric' | null
  const [faqOpen, setFaqOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(-1);
  const [editField, setEditField] = useState(null); // 'nickname' | 'birthYear' | 'gender'
  const [editFieldValue, setEditFieldValue] = useState('');
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [baselineExists, setBaselineExists] = useState(() => hasBaseline());
  const [restoreConfirm, setRestoreConfirm] = useState(null);
  const [dataManageOpen, setDataManageOpen] = useState(false);
  const [backupStats, setBackupStats] = useState(null);
  const [baselineResetConfirm, setBaselineResetConfirm] = useState(false);
  const [allRecordsResetConfirm, setAllRecordsResetConfirm] = useState(false);
  const [allRecordsClearing, setAllRecordsClearing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupGuide, setBackupGuide] = useState(null);
  const fileInputRef = useRef(null);
  const profilePhotoRef = useRef(null);

  const handleProfilePhoto = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        // 최고 화질 — 768px / 0.94. IDB 저장이라 용량 부담 X.
        const size = 768;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
        try {
          await setProfileImageIDB(dataUrl);
          update('profileImage', dataUrl); // MyPage state 갱신 (update는 profileImage 키일 때 localStorage 저장 X)
          showToast('프로필 사진이 변경되었어요');
        } catch {
          showToast('사진 저장에 실패했어요. 다시 시도해주세요.');
        }
      };
      img.onerror = () => showToast('이미지를 읽을 수 없어요. 다른 사진을 선택해주세요.');
      img.src = reader.result;
    };
    reader.onerror = () => showToast('파일을 읽을 수 없어요.');
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  // ── Push notification state ──
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [tipEnabled, setTipEnabled] = useState(false);
  const [tipTime, setTipTime] = useState('20:00');
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [pushSubscribing, setPushSubscribing] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(null); // 'reminder' | 'tip' | null

  useEffect(() => {
    // Restore saved push settings from localStorage
    const saved = localStorage.getItem('lua_push_settings');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.reminderEnabled) setReminderEnabled(true);
        if (s.reminderTime) setReminderTime(s.reminderTime);
        if (s.tipEnabled) setTipEnabled(true);
        if (s.tipTime) setTipTime(s.tipTime);
        if (s.weatherEnabled) setWeatherEnabled(true);
      } catch {}
    }
  }, []);

  const savePushSettings = (re, rt, te, tt, we) => {
    localStorage.setItem('lua_push_settings', JSON.stringify({
      reminderEnabled: re, reminderTime: rt, tipEnabled: te, tipTime: tt, weatherEnabled: we !== undefined ? we : weatherEnabled,
    }));
  };

  const handleReminderToggle = async () => {
    if (!reminderEnabled) {
      if (!isPushSupported()) { showToast('이 브라우저에서는 알림을 지원하지 않아요'); return; }
      if (isIOS() && !isStandalone()) { showToast('홈 화면에 추가한 후 알림을 설정할 수 있어요'); return; }
      if (getPermissionState() === 'denied') { showToast('알림이 차단되어 있어요. 설정에서 허용해주세요'); return; }
      setPushSubscribing(true);
      try {
        const subscription = await subscribeToPush();
        if (!subscription) { showToast('알림 권한을 허용해주세요'); return; }
        const ok = await saveSubscriptionToServer(subscription, reminderTime, profile?.nickname);
        if (ok) { setReminderEnabled(true); savePushSettings(true, reminderTime, tipEnabled, tipTime); showToast('진단 리마인더가 설정되었어요!'); }
        else { showToast('알림 등록에 실패했어요'); }
      } catch { showToast('알림 설정 중 오류가 발생했어요'); }
      finally { setPushSubscribing(false); }
    } else {
      if (!tipEnabled && !weatherEnabled) await unsubscribeFromPush();
      setReminderEnabled(false);
      savePushSettings(false, reminderTime, tipEnabled, tipTime);
      showToast('진단 리마인더가 해제되었어요');
    }
  };

  const handleTipToggle = async () => {
    if (!tipEnabled) {
      if (!isPushSupported()) { showToast('이 브라우저에서는 알림을 지원하지 않아요'); return; }
      if (isIOS() && !isStandalone()) { showToast('홈 화면에 추가한 후 알림을 설정할 수 있어요'); return; }
      if (getPermissionState() === 'denied') { showToast('알림이 차단되어 있어요. 설정에서 허용해주세요'); return; }
      setPushSubscribing(true);
      try {
        let subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (!subscription) {
          subscription = await subscribeToPush();
          if (!subscription) { showToast('알림 권한을 허용해주세요'); return; }
          await saveSubscriptionToServer(subscription, reminderTime, profile?.nickname);
        }
        const ok = await updateTipSettings(true, tipTime);
        if (ok) {
          setTipEnabled(true); savePushSettings(reminderEnabled, reminderTime, true, tipTime);
          const latest = getLatestRecord();
          if (latest) syncSkinDataToServer(latest, profile).catch(() => {});
          showToast('뷰티 팁 알림이 설정되었어요!');
        } else { showToast('설정에 실패했어요'); }
      } catch { showToast('설정 중 오류가 발생했어요'); }
      finally { setPushSubscribing(false); }
    } else {
      await updateTipSettings(false, tipTime);
      if (!reminderEnabled && !weatherEnabled) await unsubscribeFromPush();
      setTipEnabled(false);
      savePushSettings(reminderEnabled, reminderTime, false, tipTime);
      showToast('뷰티 팁 알림이 해제되었어요');
    }
  };

  const handleReminderTimeChange = async (newTime) => {
    setReminderTime(newTime); setShowTimePicker('page');
    savePushSettings(reminderEnabled, newTime, tipEnabled, tipTime, weatherEnabled);
    if (reminderEnabled) await updateReminderTime(newTime, profile?.nickname);
  };

  const handleTipTimeChange = async (newTime) => {
    setTipTime(newTime); setShowTimePicker('page');
    savePushSettings(reminderEnabled, reminderTime, tipEnabled, newTime, weatherEnabled);
    if (tipEnabled) await updateTipSettings(true, newTime);
  };

  const handleWeatherToggle = async () => {
    if (!weatherEnabled) {
      // 네이티브 앱: 웹푸시 대신 OS 로컬 알림 사용
      if (Capacitor.isNativePlatform()) {
        setPushSubscribing(true);
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          let perm = await LocalNotifications.checkPermissions();
          if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
          if (perm.display !== 'granted') { showToast('알림 권한을 허용해주세요'); return; }
          // 알림 문구에 쓸 위치 저장 (없으면 현재 위치 요청)
          let loc = getUserLocation();
          if (!loc && navigator.geolocation) {
            try {
              const pos = await new Promise((resolve, reject) =>
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 }));
              saveUserLocation(pos.coords.latitude, pos.coords.longitude, '');
            } catch {}
          }
          setWeatherEnabled(true);
          savePushSettings(reminderEnabled, reminderTime, tipEnabled, tipTime, true);
          showToast('피부 날씨 알림이 설정되었어요!');
        } catch { showToast('설정 중 오류가 발생했어요'); }
        finally { setPushSubscribing(false); }
        return;
      }
      if (!isPushSupported()) { showToast('이 브라우저에서는 알림을 지원하지 않아요'); return; }
      if (isIOS() && !isStandalone()) { showToast('홈 화면에 추가한 후 알림을 설정할 수 있어요'); return; }
      if (getPermissionState() === 'denied') { showToast('알림이 차단되어 있어요. 설정에서 허용해주세요'); return; }
      setPushSubscribing(true);
      try {
        let subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (!subscription) {
          subscription = await subscribeToPush();
          if (!subscription) { showToast('알림 권한을 허용해주세요'); return; }
          await saveSubscriptionToServer(subscription, reminderTime, profile?.nickname);
        }
        // Get location from saved or request
        let loc = getUserLocation();
        if (!loc) {
          try {
            const pos = await new Promise((resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
            );
            loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          } catch {
            showToast('위치 권한이 필요해요. 설정에서 허용해주세요');
            return;
          }
        }
        const ok = await updateWeatherSettings(true, loc.lat, loc.lon);
        if (ok) {
          setWeatherEnabled(true);
          savePushSettings(reminderEnabled, reminderTime, tipEnabled, tipTime, true);
          showToast('피부 날씨 알림이 설정되었어요!');
        } else { showToast('설정에 실패했어요'); }
      } catch { showToast('설정 중 오류가 발생했어요'); }
      finally { setPushSubscribing(false); }
    } else {
      // 네이티브 앱: 예약된 로컬 알림 취소
      if (Capacitor.isNativePlatform()) {
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications');
          const pending = await LocalNotifications.getPending();
          const ours = (pending.notifications || []).filter((n) => n.id >= 71000 && n.id < 71100);
          if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
        } catch {}
        setWeatherEnabled(false);
        savePushSettings(reminderEnabled, reminderTime, tipEnabled, tipTime, false);
        showToast('피부 날씨 알림이 해제되었어요');
        return;
      }
      await updateWeatherSettings(false, 0, 0);
      if (!reminderEnabled && !tipEnabled) await unsubscribeFromPush();
      setWeatherEnabled(false);
      savePushSettings(reminderEnabled, reminderTime, tipEnabled, tipTime, false);
      showToast('피부 날씨 알림이 해제되었어요');
    }
  };

  const formatPushTime = (t) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour < 12 ? '오전' : '오후';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${ampm} ${h12}:${m.padStart(2, '0')}`;
  };

  const currentYear = new Date().getFullYear();
  const age = profile.birthYear ? currentYear - parseInt(profile.birthYear) : null;

  const toggleConcern = (c) => {
    const list = profile.skinConcerns.includes(c)
      ? profile.skinConcerns.filter(x => x !== c)
      : [...profile.skinConcerns, c];
    update('skinConcerns', list);
  };

  // SVG icons (noa style: stroke, 22x22, strokeWidth 1.5)
  const icons = {
    user: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    dna: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4m-7.07-14.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>,
    bell: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
    bulb: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6m-5 4h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg>,
    sun: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
    chart: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    target: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
    download: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    upload: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    globe: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
    lock: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    message: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    doc: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    help: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  };

  // Noa-style settings row
  const SettingsRow = ({ icon, label, right, onTap }) => (
    <div onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '11px 28px', cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
      color: 'var(--text-primary)',
    }}>
      {icon}
      <span style={{ fontSize: 15, fontWeight: 500, flex: 1 }}>{label}</span>
      {right && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{right}</span>}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </div>
  );

  const SectionHeader = ({ label }) => (
    <div style={{ padding: '18px 28px 6px', fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,0.35)', letterSpacing: 0.8 }}>{label}</div>
  );

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000,
      background: 'var(--sub-gradient)',
    }}>
    <div style={{
      position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      animation: 'settingsSlideIn 0.3s ease',
    }}>
      <style>{`
        @keyframes settingsSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .legal-table-scroll::-webkit-scrollbar { height: 4px; }
        .legal-table-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.04); border-radius: 2px; }
        .legal-table-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div onClick={onClose} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>설정</span>
      </div>

      <div style={{ flex: 1, padding: '8px 0' }}>

        {/* ===== Noa-style settings sections ===== */}

        <SectionHeader label="프로필" />
        <SettingsRow icon={icons.user} label="프로필" right={profile.nickname || '사용자'} onTap={() => setEditingProfile(true)} />
        <SettingsRow icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M19 3h-4a2 2 0 0 0 -2 2v12a4 4 0 0 0 8 0v-12a2 2 0 0 0 -2 -2" /><path d="M13 7.35l-2 -2a2 2 0 0 0 -2.828 0l-2.828 2.828a2 2 0 0 0 0 2.828l9 9" /><path d="M7.3 13h-2.3a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h12" /><path d="M17 17l0 .01" /></svg>} label="피부 타입" right={profile.skinType || '미설정'} onTap={() => setEditingSkin(true)} />
        <SettingsRow icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M20.984 12.536a9 9 0 1 0 -8.463 8.449" /><path d="M19 22v-6" /><path d="M22 19l-3 -3l-3 3" /><path d="M9 10h.01" /><path d="M15 10h.01" /><path d="M9.5 15c.658 .64 1.56 1 2.5 1s1.842 -.36 2.5 -1" /></svg>} label="개선 목표" right={(() => { const g = getGoal(); return g && g.status === 'active' ? '진행 중' : '미설정'; })()} onTap={() => setGoalModalOpen(true)} />

        <SectionHeader label="앱 설정" />
        <SettingsRow icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>} label="알림" right={reminderEnabled || tipEnabled || weatherEnabled ? '켜짐' : '꺼짐'} onTap={() => setShowTimePicker('page')} />
        <SettingsRow icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" /><path d="M7.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M11.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M15.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></svg>} label="스타일" right={colorSkin === 'pink' ? '오로라' : '스카이'} onTap={() => setShowTimePicker('style')} />

        {/* ── 알림 설정 서브페이지 ── */}
        {showTimePicker === 'page' && (
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1100,
            background: 'var(--sub-gradient)',
          }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: 430,
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            animation: 'settingsSlideIn 0.3s ease',
          }}>
            {/* Header */}
            <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
              <div onClick={() => setShowTimePicker(null)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </div>
              <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>알림</span>
            </div>

            <div style={{ padding: '50px 40px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 진단 리마인더 */}
              <div style={{ padding: '6px 0', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ width: 38, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.5)', borderRadius: 16 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" /><path d="M9 17v1a3 3 0 0 0 6 0v-1" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>진단 리마인더</div>
                    <div onClick={pushSubscribing ? undefined : handleReminderToggle} style={{
                      width: 39, height: 24, borderRadius: 10,
                      background: reminderEnabled ? 'var(--accent-primary, #6598ef)' : 'rgba(0,0,0,0.12)',
                      position: 'relative', flexShrink: 0,
                      cursor: pushSubscribing ? 'wait' : 'pointer',
                      transition: 'background 0.3s',
                      opacity: pushSubscribing ? 0.6 : 1,
                    }}>
                      <div style={{
                        position: 'absolute', top: 3, left: reminderEnabled ? 19 : 3,
                        width: 18, height: 18, borderRadius: 7,
                        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                        transition: 'left 0.3s',
                      }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    매일 설정한 시간에 피부 측정을 알려드려요
                  </div>
                  {reminderEnabled && (
                    <div onClick={() => setShowTimePicker('reminder')} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 12, marginTop: 10,
                      background: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                    }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>알림 시간</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary, #6598ef)' }}>{formatPushTime(reminderTime)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 뷰티 팁 */}
              <div style={{ padding: '6px 0', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ width: 38, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.5)', borderRadius: 16 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7" /><path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>뷰티 팁</div>
                    <div onClick={pushSubscribing ? undefined : handleTipToggle} style={{
                      width: 39, height: 24, borderRadius: 10,
                      background: tipEnabled ? 'var(--accent-primary, #6598ef)' : 'rgba(0,0,0,0.12)',
                      position: 'relative', flexShrink: 0,
                      cursor: pushSubscribing ? 'wait' : 'pointer',
                      transition: 'background 0.3s',
                      opacity: pushSubscribing ? 0.6 : 1,
                    }}>
                      <div style={{
                        position: 'absolute', top: 3, left: tipEnabled ? 19 : 3,
                        width: 18, height: 18, borderRadius: 7,
                        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                        transition: 'left 0.3s',
                      }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    내 피부 데이터에 맞는 뷰티 팁을 매일 받아보세요
                  </div>
                  {tipEnabled && (
                    <div onClick={() => setShowTimePicker('tip')} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 12, marginTop: 10,
                      background: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                    }}>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>알림 시간</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-primary, #6598ef)' }}>{formatPushTime(tipTime)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 피부 날씨 알림 */}
              <div style={{ padding: '6px 0', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ width: 38, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.5)', borderRadius: 16 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-12" /></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>피부 날씨 알림</div>
                    <div onClick={pushSubscribing ? undefined : handleWeatherToggle} style={{
                      width: 39, height: 24, borderRadius: 10,
                      background: weatherEnabled ? 'var(--accent-primary, #6598ef)' : 'rgba(0,0,0,0.12)',
                      position: 'relative', flexShrink: 0,
                      cursor: pushSubscribing ? 'wait' : 'pointer',
                      transition: 'background 0.3s',
                      opacity: pushSubscribing ? 0.6 : 1,
                    }}>
                      <div style={{
                        position: 'absolute', top: 3, left: weatherEnabled ? 19 : 3,
                        width: 18, height: 18, borderRadius: 7,
                        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                        transition: 'left 0.3s',
                      }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    날씨에 따라 선크림, 수분 보충 등을 알려드려요
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ── 스타일 설정 서브페이지 ── */}
        {showTimePicker === 'style' && (
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1100,
            background: 'var(--sub-gradient)',
          }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: 430,
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            animation: 'settingsSlideIn 0.3s ease',
          }}>
            {/* Header */}
            <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
              <div onClick={() => setShowTimePicker(null)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </div>
              <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>스타일</span>
            </div>

            {/* 테마 프리뷰 카드 */}
            <div style={{ padding: '40px 28px 0' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>테마</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { key: 'blue', label: '스카이', gradient: 'linear-gradient(180deg, #58aefe 0%, #98ccfc 40%, #d7e9fa 100%)' },
                  { key: 'pink', label: '오로라', gradient: 'radial-gradient(ellipse at 20% 20%, rgba(255,184,200,0.5), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(88,174,254,0.4), transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(216,168,240,0.3), transparent 60%), linear-gradient(135deg, #fff5f9 0%, #f0e6ff 50%, #e8f1ff 100%)' },
                ].map(t => {
                  const selected = colorSkin === t.key;
                  return (
                    <div key={t.key} onClick={() => setColorSkin(t.key)} style={{
                      flex: 1, cursor: 'pointer', transition: 'all 0.25s',
                      opacity: selected ? 1 : 0.55,
                      transform: selected ? 'scale(1)' : 'scale(0.97)',
                    }}>
                      <div style={{
                        height: 100, borderRadius: 16,
                        background: t.gradient,
                        border: selected ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent',
                        boxShadow: selected ? '0 2px 12px rgba(0,0,0,0.1)' : 'none',
                        position: 'relative', overflow: 'hidden',
                      }}>
                        {/* 미니 UI 미리보기 */}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, background: 'rgba(255,255,255,0.7)', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                          {[1,2,3,4,5].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(0,0,0,0.15)' }} />)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', marginTop: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: selected ? 600 : 500, color: selected ? 'var(--text-primary)' : 'var(--text-muted)' }}>{t.label}</div>
                      </div>
                      {selected && (
                        <div style={{ textAlign: 'center', marginTop: 4 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #6598ef)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
          </div>
        )}

        {/* TimePicker portal for reminder/tip */}
        {(showTimePicker === 'reminder' || showTimePicker === 'tip') && createPortal(
          <TimePicker
            value={showTimePicker === 'reminder' ? reminderTime : tipTime}
            onChange={showTimePicker === 'reminder' ? handleReminderTimeChange : handleTipTimeChange}
            onClose={() => setShowTimePicker('page')}
          />,
          document.body,
        )}

        <SectionHeader label="데이터" />
        <SettingsRow icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M7 21h10a2 2 0 0 0 2 -2v-14a2 2 0 0 0 -2 -2h-6.172a2 2 0 0 0 -1.414 .586l-3.828 3.828a2 2 0 0 0 -.586 1.414v10.172a2 2 0 0 0 2 2" /><path d="M13 6v2" /><path d="M16 6v2" /><path d="M10 7v1" /></svg>} label="데이터 관리" onTap={() => { setDataManageOpen(true); getAllPhotosRaw().then(p => setBackupStats({ lsCount: localStorage.length, photoCount: p ? p.length : 0 })).catch(() => setBackupStats({ lsCount: localStorage.length, photoCount: 0 })); }} />
        <SettingsRow
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12 8l0 4l2 2" /><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" /></svg>}
          label="측정 기록 관리"
          onTap={() => setDataManageOpen('records')}
        />

        <SectionHeader label="정보" />
        <SettingsRow icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>} label="이용약관" onTap={() => setLegalPage('terms')} />
        <SettingsRow icon={icons.lock} label="개인정보 처리방침" onTap={() => setLegalPage('privacy')} />
        <SettingsRow icon={icons.message} label="문의하기" onTap={() => { setOpenFaqIndex(-1); setFaqOpen(true); }} />

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const data = JSON.parse(text);
              const lsCount = data.localStorage ? Object.keys(data.localStorage).length : 0;
              const photoCount = data.photos ? data.photos.length : 0;
              const date = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString('ko-KR') : '알 수 없음';
              setRestoreConfirm({ ...data, stats: { lsCount, photoCount, date } });
            } catch { showToast('파일을 읽을 수 없어요'); }
            e.target.value = '';
          }}
        />

        <div onClick={() => showToast('로그아웃 기능 준비 중')} style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '11px 28px', marginTop: 14, cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          color: 'var(--text-primary)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span style={{ fontSize: 15, fontWeight: 500 }}>로그아웃</span>
        </div>

        {/* 정보 블록 */}
        <SiteFooter />
      </div>

      {/* ===== Legal Document Sub-Page ===== */}
      {legalPage && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1002, maxWidth: 430, margin: '0 auto',
          background: 'var(--sub-gradient)',
          display: 'flex', flexDirection: 'column',
          animation: 'settingsSlideIn 0.3s ease',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setLegalPage(null)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {legalPage === 'terms' ? '이용약관'
                : legalPage === 'privacy' ? '개인정보 처리방침'
                : legalPage === 'biometric' ? '생체정보 동의서'
                : legalPage === 'overseas' ? '국외 이전 동의'
                : '약관'}
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '25px 20px 40px', WebkitOverflowScrolling: 'touch' }}>
            {(() => {
              const legalTextMap = {
                terms: TERMS_OF_SERVICE,
                privacy: PRIVACY_POLICY,
                biometric: BIOMETRIC_CONSENT,
                overseas: OVERSEAS_TRANSFER_CONSENT,
              };
              const lines = (legalTextMap[legalPage] || TERMS_OF_SERVICE).split('\n');
              const elements = [];
              let i = 0;
              while (i < lines.length) {
                const line = lines[i];
                const key = `legal-${i}`;
                // 테이블 그룹 처리
                if (line.startsWith('|')) {
                  const tableLines = [];
                  while (i < lines.length && lines[i].startsWith('|')) {
                    tableLines.push(lines[i]);
                    i++;
                  }
                  const headerCells = tableLines[0].split('|').filter(c => c.trim()).map(c => c.trim());
                  const dataRows = tableLines.filter((l, idx) => idx > 1).map(l => {
                    const cells = l.split('|').slice(1); // 선두 빈 요소 제거
                    if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop(); // 후미 빈 요소 제거
                    const trimmed = cells.map(c => c.trim());
                    // 헤더 열 개수에 맞춰 부족하면 빈 셀 추가
                    while (trimmed.length < headerCells.length) trimmed.push('');
                    return trimmed;
                  }).filter(row => !row.every(c => /^-+$/.test(c) || c === ''));
                  elements.push(
                    <div key={key} style={{ overflowX: 'auto', margin: '10px 0', borderRadius: 5, border: 'none', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', minWidth: 360, borderCollapse: 'collapse', fontSize: 12, tableLayout: 'auto' }}>
                        <thead>
                          <tr style={{ background: 'var(--accent-bg, rgba(101,152,239,0.1))' }}>
                            {headerCells.map((c, j) => <th key={j} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid rgba(0,0,0,0.1)', borderRight: j < headerCells.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none', whiteSpace: 'nowrap' }}>{c}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {dataRows.map((row, ri) => (
                            <tr key={ri}>
                              {row.map((c, ci) => <td key={ci} style={{ padding: '7px 10px', color: 'var(--text-secondary)', borderBottom: ri < dataRows.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none', borderRight: ci < row.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none', whiteSpace: 'normal', wordBreak: 'keep-all', lineHeight: 1.5 }}>{c}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                  continue;
                }
                if (line.startsWith('## ')) { elements.push(<h2 key={key} style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '18px 0 8px' }}>{line.slice(3)}</h2>); i++; continue; }
                if (line.startsWith('# ') && !line.startsWith('## ')) { i++; continue; }
                if (line.startsWith('- ')) { const bp = line.slice(2).split(/(\*\*[^*]+\*\*)/g); elements.push(<div key={key} style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '3px 0', paddingLeft: 14, lineHeight: 1.6 }}>• {bp.map((p, j) => p.startsWith('**') && p.endsWith('**') ? <strong key={j} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{p.slice(2, -2)}</strong> : p)}</div>); i++; continue; }
                if (/^\d+\. /.test(line)) { elements.push(<div key={key} style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '3px 0', paddingLeft: 14, lineHeight: 1.6 }}>{line}</div>); i++; continue; }
                if (line === '') { elements.push(<div key={key} style={{ height: 6 }} />); i++; continue; }
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                elements.push(
                  <p key={key} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>
                    {parts.map((p, j) =>
                      p.startsWith('**') && p.endsWith('**')
                        ? <strong key={j} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{p.slice(2, -2)}</strong>
                        : p
                    )}
                  </p>
                );
                i++;
              }
              return elements;
            })()}
          </div>
        </div>
      )}

      {/* ===== Inquiry FAQ Sub-Page ===== */}
      {faqOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1002,
          background: 'var(--sub-gradient)',
          animation: 'settingsSlideIn 0.3s ease',
        }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setFaqOpen(false)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>문의하기</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '25px 16px 40px', WebkitOverflowScrolling: 'touch' }}>
            {INQUIRY_FAQ.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  style={{
                    marginBottom: 6,
                    background: 'transparent',
                    borderRadius: 12,
                    overflow: 'hidden',
                    transition: 'background 0.2s',
                  }}
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                    style={{
                      width: '100%', padding: '14px 16px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {idx + 1}. {item.q}
                    </span>
                    <svg
                      width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div style={{
                      padding: '0 16px 16px',
                      fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7,
                      whiteSpace: 'pre-line',
                    }}>
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ marginTop: 17, padding: '0 16px' }}>
              <button
                onClick={() => window.open(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('[루아 문의]')}`, '_blank')}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10,
                  border: 'none', background: 'var(--accent-bg, rgba(101,152,239,0.1))', color: 'var(--accent-primary, #6598ef)',
                  fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /><path d="M3 7l9 6l9 -6" /></svg>
                이메일로 문의하기
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* ===== Profile Edit Sub-Page ===== */}
      {editingProfile && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1002, maxWidth: 430, margin: '0 auto',
          background: 'var(--sub-gradient)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          animation: 'settingsSlideIn 0.3s ease',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setEditingProfile(false)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>프로필</span>
          </div>

          {/* Avatar */}
          <div style={{ textAlign: 'center', padding: '50px 0 30px' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div style={{
                width: 88, height: 88, borderRadius: '50%', overflow: 'hidden',
                background: profile.profileImage ? 'none' : 'linear-gradient(135deg, #DCEEFB, #C5DEF5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {profile.profileImage
                  ? <img src={profile.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 34, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: -0.6 }}>{(profile.nickname || '?')[0].toUpperCase()}</span>
                }
              </div>
              <div onClick={() => profilePhotoRef.current?.click()} style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--accent-primary, #6598ef)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </div>
            <input ref={profilePhotoRef} type="file" accept="image/*" onChange={handleProfilePhoto} style={{ display: 'none' }} />
          </div>

          {/* Inline Fields */}
          <div style={{ margin: '0 40px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* 이름 */}
            <div style={{ padding: '6px 0' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>이름</div>
              <input
                type="text"
                value={profile.nickname || ''}
                onChange={(e) => update('nickname', e.target.value.slice(0, 20))}
                placeholder="입력해주세요"
                maxLength={20}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 12,
                  padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>

            {/* 생년월일 */}
            <div style={{ padding: '6px 0' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>생년월일</div>
              <input
                type="tel"
                inputMode="numeric"
                value={(() => {
                  if (!profile.birthYear) return '';
                  const d = profile.birthYear.replace(/-/g, '');
                  if (d.length <= 4) return d;
                  if (d.length <= 6) return d.slice(0, 4) + '.' + d.slice(4);
                  return d.slice(0, 4) + '.' + d.slice(4, 6) + '.' + d.slice(6, 8);
                })()}
                placeholder="2000.01.01"
                maxLength={10}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                  let formatted = digits;
                  if (digits.length > 4) formatted = digits.slice(0, 4) + '.' + digits.slice(4);
                  if (digits.length > 6) formatted = digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6);
                  if (digits.length === 8) {
                    update('birthYear', digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6));
                  } else if (digits.length === 0) {
                    update('birthYear', '');
                  }
                  e.target.value = formatted;
                }}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 12,
                  padding: '12px 14px', fontSize: 13, color: 'var(--text-primary)',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>

            {/* 성별 */}
            <div style={{ padding: '6px 0' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>성별</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {GENDER_OPTIONS.map(g => {
                  const selected = profile.gender === g;
                  return (
                    <div key={g} onClick={() => update('gender', g)} style={{
                      flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                      fontSize: 13, fontWeight: 500,
                      background: selected ? 'rgba(101,152,239,0.1)' : 'rgba(255,255,255,0.5)',
                      color: selected ? 'var(--accent-primary, #6598ef)' : 'var(--text-secondary)',
                      border: 'none',
                      transition: 'all 0.2s',
                    }}>{g}</div>
                  );
                })}
              </div>
            </div>

            {/* 자기소개 */}
            <div style={{ padding: '6px 0' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>자기소개</div>
              <div style={{ position: 'relative' }}>
                <textarea
                  value={profile.bio || ''}
                  onChange={(e) => update('bio', e.target.value.slice(0, 50))}
                  style={{
                    width: '100%', minHeight: 50, boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.5)', border: 'none',
                    borderRadius: 12, padding: '12px 14px', fontSize: 12, color: 'var(--text-primary)',
                    lineHeight: 1.5, outline: 'none', fontFamily: 'inherit', resize: 'none',
                  }}
                />
                <span style={{
                  position: 'absolute', right: 12, bottom: 10,
                  fontSize: 10, color: (profile.bio?.length || 0) >= 45 ? 'var(--accent-primary)' : 'rgba(0,0,0,0.15)',
                  pointerEvents: 'none',
                }}>{(profile.bio?.length || 0)} / 50</span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ padding: '16px 40px calc(16px + env(safe-area-inset-bottom,0px))' }}>
            <button onClick={() => { showToast('저장되었어요'); setEditingProfile(false); }} style={{
              width: '100%', padding: 12, borderRadius: 10, border: 'none',
              background: 'var(--accent-bg, rgba(101,152,239,0.1))', color: 'var(--accent-primary, #6598ef)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>저장</button>
          </div>
        </div>
      )}

      {/* ===== Skin Type Sub-Page ===== */}
      {editingSkin && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1002, maxWidth: 430, margin: '0 auto',
          background: 'var(--sub-gradient)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          animation: 'settingsSlideIn 0.3s ease',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setEditingSkin(false)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>피부 타입</span>
          </div>

          {/* Skin type options */}
          <div style={{ padding: '50px 40px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { key: '중성', desc: '특별히 건조하거나 유분이 많지 않아요' },
              { key: '지성', desc: '전체적으로 유분이 많고 번들거림이 있어요' },
              { key: '복합성', desc: 'T존은 유분, 볼은 건조한 편이에요' },
              { key: '건성', desc: '세안 후 당기고 건조한 느낌이 자주 나요' },
              { key: '수부지', desc: '속은 건조한데 겉은 기름지는 느낌이에요' },
            ].map(opt => {
              const selected = profile.skinType === opt.key;
              return (
                <div key={opt.key} onClick={() => update('skinType', opt.key)} style={{
                  padding: '6px 0', cursor: 'pointer',
                  display: 'flex', alignItems: 'flex-start', gap: 16, transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 12, flexShrink: 0,
                    background: selected ? 'var(--accent-primary, #6598ef)' : 'rgba(255,255,255,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s',
                  }}>
                    {selected && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{opt.key}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>{opt.desc}</div>
                  </div>
                </div>
              );
            })}
            {/* 민감성 — 중복 선택 가능 */}
            <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '12px 0' }} />
            <div onClick={() => update('isSensitive', !profile.isSensitive)} style={{
              padding: '6px 0', cursor: 'pointer',
              display: 'flex', alignItems: 'flex-start', gap: 16, transition: 'all 0.2s',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 12, flexShrink: 0,
                background: profile.isSensitive ? 'var(--accent-primary, #6598ef)' : 'rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s',
              }}>
                {profile.isSensitive && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>민감성</div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'rgba(0,0,0,0.04)', padding: '1px 6px', borderRadius: 4 }}>중복 선택 가능</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>쉽게 자극받고 환절기에 트러블이 잘 나요</div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ padding: '16px 16px calc(16px + env(safe-area-inset-bottom,0px))' }}>
            <button onClick={() => { showToast('저장되었어요'); setEditingSkin(false); }} style={{
              width: '100%', padding: 12, borderRadius: 10, border: 'none',
              background: 'var(--accent-bg, rgba(101,152,239,0.1))', color: 'var(--accent-primary, #6598ef)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>저장</button>
          </div>
        </div>
      )}

      {/* Data Management Sub-Page */}
      {dataManageOpen === true && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1002, maxWidth: 430, margin: '0 auto',
          background: 'var(--sub-gradient)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          animation: 'settingsSlideIn 0.3s ease',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setDataManageOpen(false)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>데이터 관리</span>
          </div>

          <div style={{ padding: '50px 40px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 데이터 백업 */}
            <div
              onClick={async () => {
                try {
                  const lsData = {};
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    lsData[k] = localStorage.getItem(k);
                  }
                  const photos = await getAllPhotosRaw();
                  const json = JSON.stringify({ localStorage: lsData, photos, exportedAt: new Date().toISOString() });
                  const lsCount = Object.keys(lsData).length;
                  const photoCount = photos ? photos.length : 0;
                  const dateStr = new Date().toISOString().slice(0, 10);
                  const fileName = `lua-backup-${dateStr}.json`;
                  const blob = new Blob([json], { type: 'application/json' });

                  try {
                    const file = new File([blob], fileName, { type: 'application/json', lastModified: Date.now() });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({ files: [file] });
                      localStorage.setItem('nou_last_manual_backup', String(Date.now()));
                      showToast(`백업 완료! (${lsCount}개 항목, ${photoCount}장 사진)`);
                      return;
                    }
                  } catch (e) {
                    if (e.name === 'AbortError') return;
                  }

                  try {
                    const dlUrl = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = dlUrl;
                    a.download = fileName;
                    a.rel = 'noopener';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(dlUrl), 10000);
                  } catch (e) {
                    console.warn('backup download fallback failed:', e);
                    showToast('백업 다운로드 실패 — 다시 시도해주세요');
                    return;
                  }
                  localStorage.setItem('nou_last_manual_backup', String(Date.now()));
                  showToast(`백업 완료! (${lsCount}개 항목, ${photoCount}장 사진)`);
                } catch { showToast('백업 준비 중 오류가 발생했어요'); }
              }}
              style={{ padding: '6px 0', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 16 }}
            >
              <div style={{ width: 38, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.5)', borderRadius: 16 }}>
                {icons.download}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>데이터 백업</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                  {backupStats ? `${backupStats.lsCount}개 항목 · ${backupStats.photoCount}개 사진이 저장됩니다` : '현재 데이터를 파일로 저장해요'}
                </div>
              </div>
            </div>

            {/* 데이터 복원 */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: '6px 0', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 16 }}
            >
              <div style={{ width: 38, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.5)', borderRadius: 16 }}>
                {icons.upload}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>데이터 복원</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>백업 파일에서 데이터를 불러와요</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Records Management Sub-Page */}
      {dataManageOpen === 'records' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1002, maxWidth: 430, margin: '0 auto',
          background: 'var(--sub-gradient)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          animation: 'settingsSlideIn 0.3s ease',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setDataManageOpen(false)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>측정 기록 관리</span>
          </div>

          <div style={{ padding: '50px 40px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              onClick={() => { setDataManageOpen(false); setBaselineResetConfirm(true); }}
              style={{ padding: '6px 0', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 16 }}
            >
              <div style={{ width: 38, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.5)', borderRadius: 16 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/><polyline points="3 21 3 16 8 16"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>측정 기준 재설정</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>기준점을 처음부터 다시 측정해요</div>
              </div>
            </div>

            <div
              onClick={() => { setDataManageOpen(false); setAllRecordsResetConfirm(true); }}
              style={{ padding: '6px 0', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 16 }}
            >
              <div style={{ width: 38, height: 38, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.5)', borderRadius: 16 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#dc4444' }}>측정 기록 전체 삭제</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>모든 측정 기록과 사진을 삭제해요</div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Restore Confirmation Modal */}
      {restoreConfirm && (
        <div
          onClick={(e) => { e.stopPropagation(); if (!restoring) setRestoreConfirm(null); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            background: 'var(--bg-modal-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 360,
              background: 'var(--bg-modal)', borderRadius: 24, padding: 24,
              border: 'none',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              {restoring ? '복원 중...' : '백업 복원'}
            </div>
            {!restoring ? (
              <>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  기존 데이터를 백업 파일로 대체합니다.<br />
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {restoreConfirm.stats.lsCount}개 항목, {restoreConfirm.stats.photoCount}장 사진
                  </span>
                  <br />백업 날짜: {restoreConfirm.stats.date}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setRestoreConfirm(null)}
                    style={{
                      flex: 1, padding: 12, borderRadius: 14, border: 'none',
                      background: 'transparent', color: 'var(--text-muted)', fontSize: 14, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >취소</button>
                  <button
                    onClick={async () => {
                      setRestoring(true);
                      try {
                        // Restore localStorage
                        const lsData = restoreConfirm.localStorage;
                        for (const [key, value] of Object.entries(lsData)) {
                          localStorage.setItem(key, value);
                        }
                        // Restore IndexedDB photos
                        const photoCount = await restorePhotos(restoreConfirm.photos);
                        const lsCount = Object.keys(lsData).length;
                        setRestoring(false);
                        setRestoreConfirm(null);
                        showToast(`${lsCount}개 항목, ${photoCount}장 사진 복원 완료!`);
                        setTimeout(() => window.location.reload(), 1200);
                      } catch {
                        setRestoring(false);
                        showToast('복원 실패 — 다시 시도해주세요');
                      }
                    }}
                    style={{
                      flex: 1, padding: 12, borderRadius: 14, border: 'none',
                      background: 'var(--btn-primary-bg)',
                      color: '#fff', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >복원하기</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: 32, height: 32, border: 'none',
                  borderTopColor: '#81E4BD', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  margin: '0 auto 12px',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>데이터를 복원하고 있어요...</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Baseline Reset Confirm — 측정 기준 재설정 */}
      {baselineResetConfirm && (
        <div
          onClick={() => setBaselineResetConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            background: 'var(--bg-modal-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 360,
              background: 'var(--bg-modal)', borderRadius: 24, padding: 24,
              border: 'none',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              측정 기준 재설정
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.7 }}>
              지금까지의 측정 기준점(baseline)을 삭제해요.<br />
              <span style={{ color: 'var(--text-secondary)' }}>
                다음 <strong style={{ color: 'var(--accent-primary, #6598ef)' }}>3회 측정의 평균</strong>으로 더 정확한 새 기준이 만들어집니다.
              </span>
              <br /><br />
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                기존 측정 기록·사진은 그대로 유지돼요. 동일인 인식·디바이스 기억만 초기화됩니다.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setBaselineResetConfirm(false)}
                style={{
                  flex: 1, padding: 12, borderRadius: 14, border: 'none',
                  background: 'transparent', color: 'var(--text-muted)', fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >취소</button>
              <button
                onClick={() => {
                  hapticWarning();
                  try { clearBaseline(); } catch {}
                  // 측정 가이드 다시 보이도록
                  try {
                    const m = require('../components/MeasurementGuide');
                    if (m?.resetMeasureGuideDismiss) m.resetMeasureGuideDismiss();
                  } catch {}
                  try { localStorage.removeItem('nou_measure_guide_dismissed'); } catch {}
                  // 축하 modal 다시 노출 가능하게 flag 초기화
                  try { localStorage.removeItem('nou_baseline_complete_shown'); } catch {}
                  setBaselineResetConfirm(false);
                  showToast('측정 기준이 재설정됐어요. 다음 3회 측정으로 새 기준이 만들어져요.');
                }}
                style={{
                  flex: 1, padding: 12, borderRadius: 14, border: 'none',
                  background: 'var(--accent-primary, #6598ef)', color: '#fff',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(101,152,239,0.28)',
                }}
              >재설정</button>
            </div>
          </div>
        </div>
      )}

      {/* All Records Reset Confirm — 측정 기록 전체 삭제 (위험) */}
      {allRecordsResetConfirm && (
        <div
          onClick={() => !allRecordsClearing && setAllRecordsResetConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1002,
            background: 'var(--bg-modal-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 360,
              background: 'var(--bg-modal)', borderRadius: 24, padding: 24,
              border: 'none',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: '#dc4444', marginBottom: 6 }}>
              측정 기록 전체 삭제
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.7 }}>
              지금까지의 <strong style={{ color: 'var(--text-secondary)' }}>모든 측정 결과·사진·측정 기준</strong>이 영구히 삭제돼요.
              <br />
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>되돌릴 수 없어요. 등록한 화장품과 루틴 체크 기록·프로필은 유지됩니다.</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setAllRecordsResetConfirm(false)}
                disabled={allRecordsClearing}
                style={{
                  flex: 1, padding: 12, borderRadius: 14, border: 'none',
                  background: 'transparent', color: 'var(--text-muted)', fontSize: 14, fontWeight: 500,
                  cursor: allRecordsClearing ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >취소</button>
              <button
                onClick={async () => {
                  if (allRecordsClearing) return;
                  hapticWarning();
                  setAllRecordsClearing(true);
                  try {
                    await clearAllRecords();
                    try { clearBaseline(); } catch {}
                    try { localStorage.removeItem('nou_measure_guide_dismissed'); } catch {}
                    try { localStorage.removeItem('nou_baseline_complete_shown'); } catch {}
                    setBaselineExists(false);
                    setAllRecordsResetConfirm(false);
                    showToast('모든 측정 기록이 삭제됐어요');
                  } catch {
                    showToast('삭제 중 문제가 생겼어요. 다시 시도해주세요.');
                  } finally {
                    setAllRecordsClearing(false);
                  }
                }}
                disabled={allRecordsClearing}
                style={{
                  flex: 1, padding: 12, borderRadius: 14, border: 'none',
                  background: allRecordsClearing ? '#888' : '#dc4444', color: '#fff',
                  fontSize: 14, fontWeight: 600,
                  cursor: allRecordsClearing ? 'default' : 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 2px 8px rgba(220,68,68,0.28)',
                }}
              >{allRecordsClearing ? '삭제 중...' : '전체 삭제'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Setting Modal */}
      {goalModalOpen && (
        <GoalSettingModal
          onClose={() => setGoalModalOpen(false)}
          showToast={showToast}
        />
      )}
    </div>
    </div>
  );
}

// ===== Goal Setting Modal =====

function GoalSettingModal({ onClose, showToast }) {
  const [step, setStep] = useState(1);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [targets, setTargets] = useState({});
  const [duration, setDuration] = useState(90);
  const latestRecord = getLatestRecord();
  const existingGoal = getGoal();

  const sortedMetrics = METRIC_META.map((m) => ({
    ...m,
    value: latestRecord ? (latestRecord[m.key] ?? 0) : 0,
  })).sort((a, b) => a.value - b.value);

  const toggleMetric = (key) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 3) return prev;
      return [...prev, key];
    });
  };

  const applyPreset = (delta) => {
    const next = {};
    for (const key of selectedMetrics) {
      const current = latestRecord ? (latestRecord[key] ?? 0) : 50;
      next[key] = Math.min(100, current + delta);
    }
    setTargets(next);
  };

  const handleSave = () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + duration);

    const goal = {
      status: 'active',
      startDate: today.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      durationDays: duration,
      metrics: selectedMetrics.map((key) => {
        const meta = METRIC_META.find((m) => m.key === key);
        const startValue = latestRecord ? (latestRecord[key] ?? 0) : 50;
        return {
          key,
          label: meta.label,
          icon: meta.icon,
          startValue,
          targetValue: targets[key] || startValue,
          currentValue: startValue,
        };
      }),
      createdAt: today.toISOString(),
      completedAt: null,
    };

    saveGoal(goal);
    showToast('피부 목표가 설정되었어요!');
    onClose();
  };

  const handleReset = () => {
    if (confirm('현재 목표를 삭제할까요?')) {
      clearGoal();
      showToast('목표가 초기화되었어요');
      onClose();
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1002, maxWidth: 430, margin: '0 auto',
      background: 'var(--sub-gradient)',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      animation: 'settingsSlideIn 0.3s ease',
    }}>
      {/* Header — 피부타입 스타일 */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div onClick={onClose} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>피부 목표</span>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 6, padding: '16px 40px 0' }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: s <= step ? 'var(--accent-primary, #6598ef)' : 'rgba(255,255,255,0.5)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* STEP 1: Metric selection */}
      {step === 1 && (
        <div style={{ padding: '50px 40px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!latestRecord && (
            <div style={{
              padding: '12px 16px', borderRadius: 14, marginBottom: 8,
              background: 'rgba(101,152,239,0.08)', border: 'none',
            }}>
              <div style={{ fontSize: 13, color: 'var(--accent-primary, #6598ef)', lineHeight: 1.6 }}>
                먼저 피부 분석을 해야 현재 점수를 확인할 수 있어요. 분석 후 목표를 설정해보세요!
              </div>
            </div>
          )}
          {sortedMetrics.map((m, idx) => {
            const selected = selectedMetrics.includes(m.key);
            return (
              <div
                key={m.key}
                onClick={() => latestRecord && toggleMetric(m.key)}
                style={{
                  padding: '6px 0', cursor: latestRecord ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'flex-start', gap: 16, transition: 'all 0.2s',
                  opacity: latestRecord ? 1 : 0.5,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{m.label}</span>
                    {idx < 3 && latestRecord && (
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 6,
                        background: 'var(--accent-bg, rgba(101,152,239,0.1))', color: 'var(--accent-primary, #6598ef)',
                      }}>추천</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                    현재 {m.value}점
                  </div>
                </div>
                {selected && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #6598ef)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* STEP 2: Target setting */}
      {step === 2 && (
        <div style={{ padding: '30px 40px 0' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[
              { label: '조금 개선', delta: 10 },
              { label: '적극 개선', delta: 20 },
              { label: '최고 목표', delta: 30 },
            ].map((p) => (
              <button
                key={p.delta}
                onClick={() => applyPreset(p.delta)}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 14,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--accent-primary, #6598ef)', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >+{p.delta}<br/><span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{p.label}</span></button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {selectedMetrics.map((key) => {
              const meta = METRIC_META.find((m) => m.key === key);
              const current = latestRecord ? (latestRecord[key] ?? 0) : 50;
              const target = targets[key] || current;

              return (
                <div key={key} style={{
                  padding: '6px 0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{meta.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--accent-primary, #6598ef)', fontWeight: 600 }}>
                      {current} → {target}
                    </span>
                  </div>
                  {/* Slider */}
                  <div style={{ position: 'relative', height: 34, display: 'flex', alignItems: 'flex-end' }}>
                    {/* Track background */}
                    <div style={{
                      position: 'absolute', left: 0, right: 0, bottom: 8,
                      height: 4, borderRadius: 2,
                      background: 'rgba(101,152,239,0.12)',
                    }} />
                    {/* Filled portion */}
                    <div style={{
                      position: 'absolute', left: 0, bottom: 8,
                      height: 4, borderRadius: 2,
                      width: `calc(${target}% - ${target * 14 / 100}px + 7px)`,
                      background: 'linear-gradient(90deg, rgba(101,152,239,0.35), #6598ef)',
                    }} />
                    {/* Current position dot */}
                    <div style={{
                      position: 'absolute',
                      left: `calc(${current}% - ${current * 14 / 100}px + 7px)`,
                      bottom: 5,
                      transform: 'translate(-50%, 0)',
                      width: 10, height: 10, borderRadius: '50%',
                      background: 'var(--accent-primary, #6598ef)',
                      zIndex: 0,
                    }} />
                    {/* Current label */}
                    <div style={{
                      position: 'absolute',
                      left: `calc(${current}% - ${current * 14 / 100}px + 7px)`,
                      top: -8,
                      transform: 'translateX(-50%)',
                      fontSize: 9, fontWeight: 500, color: 'rgba(101,152,239,0.5)',
                      whiteSpace: 'nowrap',
                    }}>{current}</div>
                    {/* Range input (thumb on top) */}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={target}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        if (v > current) setTargets((prev) => ({ ...prev, [key]: v }));
                      }}
                      className="lua-goal-slider"
                      style={{ width: '100%', position: 'relative', zIndex: 2, height: 20, margin: 0 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>목표 기간</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[30, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 14,
                    border: duration === d ? '1px solid var(--accent-primary, #6598ef)' : '1px solid rgba(0,0,0,0.06)',
                    background: duration === d ? 'rgba(101,152,239,0.12)' : 'transparent',
                    color: duration === d ? 'var(--accent-primary, #6598ef)' : 'var(--text-muted)',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >{d}일</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Confirmation */}
      {step === 3 && (
        <div style={{ padding: '30px 40px 0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>목표 요약</span>
              <span style={{ fontSize: 12, color: 'var(--accent-primary, #6598ef)', fontWeight: 500 }}>{duration}일</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedMetrics.map((key) => {
                const meta = METRIC_META.find((m) => m.key === key);
                const current = latestRecord ? (latestRecord[key] ?? 0) : 50;
                const target = targets[key] || current;
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{meta.label}</span>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{current}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
                      <span style={{ color: 'var(--accent-primary, #6598ef)', fontWeight: 600 }}>{target}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {existingGoal && existingGoal.status === 'active' && (
            <div style={{
              marginTop: 12, padding: '10px 16px', borderRadius: 14,
              background: 'rgba(101,152,239,0.06)', border: 'none',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                기존 목표가 새 목표로 대체됩니다.
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Bottom buttons */}
      <div style={{ padding: '16px 16px calc(16px + env(safe-area-inset-bottom,0px))' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                flex: 1, padding: 12, borderRadius: 10, border: 'none',
                background: 'rgba(0,0,0,0.04)', color: 'var(--text-muted)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >이전</button>
          )}
          {step < 3 && (
            <button
              onClick={() => {
                if (step === 1 && selectedMetrics.length === 0) return;
                if (step === 1) {
                  const t = {};
                  for (const key of selectedMetrics) {
                    const v = latestRecord ? (latestRecord[key] ?? 0) : 50;
                    t[key] = v;
                  }
                  setTargets((prev) => ({ ...t, ...prev }));
                }
                setStep(step + 1);
              }}
              disabled={step === 1 && selectedMetrics.length === 0}
              style={{
                flex: 1, padding: 12, borderRadius: 10, border: 'none',
                background: (step === 1 && selectedMetrics.length === 0)
                  ? 'rgba(0,0,0,0.04)' : 'rgba(101,152,239,0.1)',
                color: (step === 1 && selectedMetrics.length === 0) ? 'var(--text-dim)' : '#6598ef',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >다음</button>
          )}
          {step === 3 && (
            <button
              onClick={handleSave}
              style={{
                flex: 1, padding: 12, borderRadius: 10, border: 'none',
                background: 'var(--accent-bg, rgba(101,152,239,0.1))',
                color: 'var(--accent-primary, #6598ef)', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >목표 시작하기</button>
          )}
        </div>

        {existingGoal && existingGoal.status === 'active' && step === 1 && (
          <button
            onClick={handleReset}
            style={{
              width: '100%', marginTop: 10, padding: 12, borderRadius: 12,
              border: 'none', background: 'transparent',
              color: 'var(--text-muted)', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >현재 목표 삭제</button>
        )}
      </div>
    </div>
  );
}

// ===== Sub-components =====

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function ChipGroup({ options, selected, onSelect }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <div
            key={opt}
            onClick={() => onSelect(active ? '' : opt)}
            style={{
              padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s',
              background: active ? '#ADEBB3' : 'var(--bg-card)',
              color: active ? '#fff' : 'var(--text-muted)',
              border: active ? '1px solid #ADEBB3' : '1px solid var(--border-subtle)',
            }}
          >
            {opt}
          </div>
        );
      })}
    </div>
  );
}

function JourneyStat({ value, unit, label, hasDivider }) {
  return (
    <div style={{ textAlign: 'center', position: 'relative' }}>
      {hasDivider && (
        <div style={{
          position: 'absolute', left: 0, top: '15%', height: '70%',
          width: 1, background: 'rgba(240,144,112,0.1)',
        }} />
      )}
      <div style={{
        fontFamily: 'inherit',
        fontSize: 28, fontWeight: 400, color: '#ADEBB3',
        lineHeight: 1, marginBottom: 6,
      }}>
        {value}{unit && <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 300, letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
}

function SettingsSection({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 400, color: 'var(--text-muted)',
        letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10,
      }}>{label}</div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 0,
        background: 'var(--bg-card)', borderRadius: 20, overflow: 'hidden',
        border: 'none',
      }}>
        {children}
      </div>
    </div>
  );
}

function SettingsMenuItem({ icon, label, desc, right, onTap }) {
  return (
    <div onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '16px 20px', cursor: 'pointer',
      borderTop: '1px solid var(--border-separator)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        background: 'transparent',
      }}><PastelIcon emoji={icon} size={20} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 300, marginTop: 2 }}>{desc}</div>}
      </div>
      {right === 'arrow' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
      {right === 'badge-new' && (
        <span style={{
          padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 500,
          background: 'rgba(74,222,128,0.12)', color: '#4ade80',
        }}>NEW</span>
      )}
    </div>
  );
}

function ReminderItem({ enabled, time, onToggle, onTimeChange, profile, tipEnabled, showToast }) {
  const [showPicker, setShowPicker] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const formatTime = (t) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour < 12 ? '오전' : '오후';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `매일 ${ampm} ${h12}:${m.padStart(2, '0')}`;
  };

  const handleToggle = async () => {
    if (!enabled) {
      if (!isPushSupported()) {
        showToast('이 브라우저에서는 알림을 지원하지 않아요');
        return;
      }
      if (isIOS() && !isStandalone()) {
        showToast('홈 화면에 추가한 후 알림을 설정할 수 있어요');
        return;
      }
      if (getPermissionState() === 'denied') {
        showToast('알림이 차단되어 있어요. 설정에서 허용해주세요');
        return;
      }

      setSubscribing(true);
      try {
        const subscription = await subscribeToPush();
        if (!subscription) {
          showToast('알림 권한을 허용해주세요');
          return;
        }
        const ok = await saveSubscriptionToServer(subscription, time, profile?.nickname);
        if (ok) {
          onToggle(true);
          showToast('매일 알림이 설정되었어요!');
        } else {
          showToast('알림 등록에 실패했어요. 다시 시도해주세요');
        }
      } catch (err) {
        console.error('Push subscribe error:', err);
        showToast('알림 설정 중 오류가 발생했어요');
      } finally {
        setSubscribing(false);
      }
    } else {
      if (!tipEnabled) {
        await unsubscribeFromPush();
      }
      onToggle(false);
      showToast('알림이 해제되었어요');
    }
  };

  const handleTimeChange = async (newTime) => {
    onTimeChange(newTime);
    setShowPicker(false);
    if (enabled) {
      await updateReminderTime(newTime, profile?.nickname);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border-separator)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 20px',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, flexShrink: 0,
          background: 'rgba(240,144,112,0.08)',
        }}></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>진단 리마인더</div>
          {enabled && (
            <div
              onClick={() => setShowPicker(true)}
              style={{ fontSize: 11, color: '#ADEBB3', fontWeight: 400, marginTop: 2, cursor: 'pointer' }}
            >
              {formatTime(time)} 
            </div>
          )}
          {!enabled && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 300, marginTop: 2 }}>꺼짐</div>
          )}
        </div>
        <div
          onClick={subscribing ? undefined : handleToggle}
          style={{
            width: 44, height: 26, borderRadius: 13,
            background: enabled ? '#ADEBB3' : 'rgba(255,255,255,0.15)',
            position: 'relative', flexShrink: 0, cursor: subscribing ? 'wait' : 'pointer',
            transition: 'background 0.3s',
            opacity: subscribing ? 0.6 : 1,
          }}
        >
          <div style={{
            position: 'absolute', top: 3,
            left: enabled ? 21 : 3,
            width: 20, height: 20, borderRadius: '50%',
            background: '#e0e0e8', boxShadow: 'none',
            transition: 'left 0.3s',
          }} />
        </div>
      </div>

      {showPicker && createPortal(
        <TimePicker
          value={time}
          onChange={handleTimeChange}
          onClose={() => setShowPicker(false)}
        />,
        document.body,
      )}
    </div>
  );
}

function BeautyTipItem({ enabled, time, onToggle, onTimeChange, profile, reminderEnabled, showToast }) {
  const [showPicker, setShowPicker] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const formatTime = (t) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour < 12 ? '오전' : '오후';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `매일 ${ampm} ${h12}:${m.padStart(2, '0')}`;
  };

  const handleToggle = async () => {
    if (!enabled) {
      if (!isPushSupported()) {
        showToast('이 브라우저에서는 알림을 지원하지 않아요');
        return;
      }
      if (isIOS() && !isStandalone()) {
        showToast('홈 화면에 추가한 후 알림을 설정할 수 있어요');
        return;
      }
      if (getPermissionState() === 'denied') {
        showToast('알림이 차단되어 있어요. 설정에서 허용해주세요');
        return;
      }

      setSubscribing(true);
      try {
        let subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (!subscription) {
          subscription = await subscribeToPush();
          if (!subscription) {
            showToast('알림 권한을 허용해주세요');
            return;
          }
          await saveSubscriptionToServer(subscription, profile.reminderTime || '08:00', profile?.nickname);
        }

        const ok = await updateTipSettings(true, time);
        if (ok) {
          onToggle(true);
          const latest = getLatestRecord();
          if (latest) {
            syncSkinDataToServer(latest, profile).catch(() => {});
          }
          showToast('뷰티 팁 알림이 설정되었어요!');
        } else {
          showToast('설정에 실패했어요. 다시 시도해주세요');
        }
      } catch (err) {
        console.error('Tip subscribe error:', err);
        showToast('설정 중 오류가 발생했어요');
      } finally {
        setSubscribing(false);
      }
    } else {
      await updateTipSettings(false, time);
      if (!reminderEnabled) {
        await unsubscribeFromPush();
      }
      onToggle(false);
      showToast('뷰티 팁 알림이 해제되었어요');
    }
  };

  const handleTimeChange = async (newTime) => {
    onTimeChange(newTime);
    setShowPicker(false);
    if (enabled) {
      await updateTipSettings(true, newTime);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border-separator)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 20px',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, flexShrink: 0,
          background: 'rgba(240,144,112,0.08)',
        }}></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>뷰티 팁 알림</div>
          {enabled ? (
            <div
              onClick={() => setShowPicker(true)}
              style={{ fontSize: 11, color: '#ADEBB3', fontWeight: 400, marginTop: 2, cursor: 'pointer' }}
            >
              {formatTime(time)} 
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 300, marginTop: 2 }}>
              내 피부에 맞는 뷰티 팁을 매일 받아보세요
            </div>
          )}
        </div>
        <div
          onClick={subscribing ? undefined : handleToggle}
          style={{
            width: 44, height: 26, borderRadius: 13,
            background: enabled ? '#ADEBB3' : 'rgba(255,255,255,0.15)',
            position: 'relative', flexShrink: 0,
            cursor: subscribing ? 'wait' : 'pointer',
            transition: 'background 0.3s',
            opacity: subscribing ? 0.6 : 1,
          }}
        >
          <div style={{
            position: 'absolute', top: 3,
            left: enabled ? 21 : 3,
            width: 20, height: 20, borderRadius: '50%',
            background: '#e0e0e8', boxShadow: 'none',
            transition: 'left 0.3s',
          }} />
        </div>
      </div>

      {showPicker && createPortal(
        <TimePicker
          value={time}
          onChange={handleTimeChange}
          onClose={() => setShowPicker(false)}
        />,
        document.body,
      )}
    </div>
  );
}

function TimePicker({ value, onChange, onClose }) {
  const currentH = parseInt(value.split(':')[0]);

  const times = [];
  for (let i = 0; i < 24; i++) {
    const ampm = i < 12 ? '오전' : '오후';
    const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
    times.push({ h24: i, label: `${ampm} ${h12}:00` });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430,
          background: 'var(--sub-gradient)',
          borderRadius: '20px 20px 0 0',
          padding: '16px 0 calc(16px + env(safe-area-inset-bottom, 0px))',
          maxHeight: '50vh', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '0 24px 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          알림 시간
        </div>
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {times.map((t) => (
            <div
              key={t.h24}
              onClick={() => onChange(`${String(t.h24).padStart(2, '0')}:00`)}
              style={{
                padding: '13px 24px',
                fontSize: 14, color: t.h24 === currentH ? '#6598ef' : 'var(--text-primary)',
                fontWeight: t.h24 === currentH ? 600 : 400,
                background: t.h24 === currentH ? 'rgba(101,152,239,0.08)' : 'transparent',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              {t.label}
              {t.h24 === currentH && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #6598ef)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DarkModeItem({ enabled, onToggle }) {
  return (
    <div
      onClick={() => onToggle(!enabled)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 20px', cursor: 'pointer',
        borderTop: '1px solid var(--border-separator)',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, flexShrink: 0,
        background: 'var(--bg-card-hover)',
      }}><MoonIcon size={17} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>다크모드</div>
      </div>
      <div style={{
        width: 44, height: 26, borderRadius: 13,
        background: enabled ? '#ADEBB3' : 'rgba(255,255,255,0.15)',
        position: 'relative', flexShrink: 0,
        transition: 'background 0.3s',
      }}>
        <div style={{
          position: 'absolute', top: 3,
          left: enabled ? 21 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: 'var(--text-secondary)', boxShadow: 'none',
          transition: 'left 0.3s',
        }} />
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 14,
  border: 'none', background: 'var(--bg-card-hover)',
  fontSize: 14, color: 'var(--text-primary)', outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s',
};

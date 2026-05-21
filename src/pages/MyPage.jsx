import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  getProfile, saveProfile,
  SKIN_TYPES, SKIN_CONCERNS, SENSITIVITY_OPTIONS, GENDER_OPTIONS,
} from '../storage/ProfileStorage';
import { getRecords, getTotalChanges, getAllThumbnailsAsync, deleteRecord } from '../storage/SkinStorage';
import { RecordDetailModal } from './HistoryPage';
import { clearBaseline, hasBaseline } from '../engine/HybridAnalysis';
import {
  isPushSupported, isStandalone, isIOS, getPermissionState,
  subscribeToPush, saveSubscriptionToServer,
  unsubscribeFromPush, updateReminderTime,
  updateTipSettings, syncSkinDataToServer,
} from '../utils/pushNotification';
import { getLatestRecord } from '../storage/SkinStorage';
import { getGoal, saveGoal, clearGoal, getDaysRemaining, getGoalProgress, getOverallProgress, METRIC_META } from '../storage/GoalStorage';
import { getAllPhotosRaw, restorePhotos } from '../storage/PhotoDB';
import { MoonIcon, SunIcon, CameraIcon, SaveIcon, PastelIcon } from '../components/icons/PastelIcons';
import { TERMS_OF_SERVICE, PRIVACY_POLICY, BIOMETRIC_CONSENT, OVERSEAS_TRANSFER_CONSENT, INQUIRY_FAQ, CONTACT_EMAIL } from '../legal/legalContent';
import SiteFooter from '../components/SiteFooter';

export default function MyPage({ colorMode, setColorMode, onThemeChange, onMeasure }) {
  const [profile, setProfile] = useState(getProfile);
  const [toast, setToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('저장되었습니다');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bioModal, setBioModal] = useState(false);
  const [contentMode, setContentMode] = useState('album'); // album | history | record
  const [selectedPhoto, setSelectedPhoto] = useState(null); // { record, thumb }

  const records = getRecords();
  const recordCount = records.length;
  const [thumbs, setThumbs] = useState({});
  useEffect(() => { getAllThumbnailsAsync().then(setThumbs); }, []);
  const recentPhotos = [...records].reverse().map(r => ({ date: r.date, record: r, thumb: thumbs[String(r.id)] || thumbs[r.date] })).filter(p => p.thumb);
  const habitDays = (() => { let c = 0; for (let i = 0; i < localStorage.length; i++) { if (localStorage.key(i)?.startsWith('lua_habit_')) c++; } return c; })();

  const glass = { background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', borderRadius: 20 };

  const showToast = (msg) => { setToastMsg(msg); setToast(true); setTimeout(() => setToast(false), 2500); };
  const update = (key, value) => { const next = saveProfile({ [key]: value }); setProfile(next); };

  const daysTogether = (() => { if (!records.length) return 0; const first = new Date(records[records.length - 1].date); return Math.max(1, Math.floor((Date.now() - first.getTime()) / 86400000)); })();
  const initial = (profile.nickname || '?')[0].toUpperCase();

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 100 }}>

      {/* ① 헤더 (noa style) */}
      <div style={{ padding: 'calc(env(safe-area-inset-top,0px) + 16px) 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          {/* Avatar */}
          <div style={{
            width: 86, height: 86, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            background: '#ffffff', border: '2px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {profile.profileImage ? (
              <img src={profile.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <circle cx="12" cy="10" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
              </svg>
            )}
          </div>

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
          <div onClick={() => setBioModal(true)} style={{ fontSize: 12, color: 'rgba(15,15,15,0.4)', marginTop: 6, marginBottom: 20, cursor: 'pointer' }}>
            {profile.bio || '자기소개'}
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
                <button onClick={() => onMeasure?.()} style={{ background: 'var(--accent-primary, #89cef5)', color: '#fff', fontSize: 11, fontWeight: 500, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>첫 측정 시작</button>
            </div>
          ) : (
            <div className="photo-grid" style={{ padding: '0 16px 12px' }}>
              {recentPhotos.map((p, i) => {
                const d = new Date(p.date);
                const shortDate = `${String(d.getMonth()+1).padStart(2,'0')}월${String(d.getDate()).padStart(2,'0')}일`;
                return (
                  <div key={i} className="photo-cell" onClick={() => setSelectedPhoto(p)} style={{ cursor: 'pointer' }}>
                    <img src={p.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{
                      position: 'absolute', bottom: 6, left: 6,
                      fontSize: 10, fontWeight: 600, color: '#fff',
                      textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      zIndex: 2, pointerEvents: 'none',
                    }}>{shortDate}</span>
                    <span className="photo-score-badge">{p.record.overallScore}</span>
                  </div>
                );
              })}
            </div>
          )}
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

      {/* 사진 상세 모달 (케어-앨범과 동일) */}
      {selectedPhoto && selectedPhoto.record && (
        <RecordDetailModal
          record={selectedPhoto.record}
          thumbnail={selectedPhoto.thumb}
          onClose={() => setSelectedPhoto(null)}
          onDelete={(id) => {
            deleteRecord(id);
            setSelectedPhoto(null);
            getAllThumbnailsAsync().then(setThumbs);
          }}
        />
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
        <SettingsModal profile={profile} update={update} onClose={() => setSettingsOpen(false)} showToast={showToast} colorMode={colorMode} setColorMode={setColorMode} />,
        document.body,
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent-primary, #89cef5)', color: '#fff', padding: '10px 24px', borderRadius: 20, fontSize: 13, fontWeight: 500, zIndex: 999, animation: 'fadeIn 0.2s ease' }}>{toastMsg}</div>
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
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}><div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(137,206,245,0.4)' }} /></div>
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
          <button onClick={() => onSave(text)} style={{ width: '100%', marginTop: 12, padding: 14, borderRadius: 10, border: 'none', background: 'var(--accent-primary, #89cef5)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>두기</button>
        </div>
      </div>
    </>
  );
}

// ===== Settings Modal =====

function SettingsModal({ profile, update, onClose, showToast, colorMode, setColorMode }) {
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
  const [restoring, setRestoring] = useState(false);
  const [backupGuide, setBackupGuide] = useState(null);
  const fileInputRef = useRef(null);

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
      background: 'linear-gradient(180deg, #C5E3FF 0%, #F1F7FD 100%)',
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
      <div style={{ padding: 'calc(env(safe-area-inset-top,0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
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

        <SectionHeader label="앱 설정" />
        <SettingsRow icon={icons.sun} label="화면 모드" />
        <SettingsRow icon={icons.globe} label="언어" />

        <SectionHeader label="데이터 관리" />
        <SettingsRow icon={icons.download} label="데이터 백업" onTap={async () => {
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
            setBackupGuide({ json, lsCount, photoCount });
          } catch { showToast('백업 준비 중 오류가 발생했어요'); }
        }} />
        <SettingsRow icon={icons.upload} label="데이터 복원" onTap={() => fileInputRef.current?.click()} />

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
          background: 'linear-gradient(180deg, #C5E3FF 0%, #F1F7FD 100%)',
          display: 'flex', flexDirection: 'column',
          animation: 'settingsSlideIn 0.3s ease',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top,0px) + 16px) 16px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setLegalPage(null)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
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
                    <div key={key} style={{ overflowX: 'auto', margin: '10px 0', borderRadius: 5, border: '1px solid rgba(0,0,0,0.08)', WebkitOverflowScrolling: 'touch' }} className="legal-table-scroll">
                      <table style={{ minWidth: 520, borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'rgba(91,168,214,0.1)' }}>
                            {headerCells.map((c, j) => <th key={j} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid rgba(0,0,0,0.1)', borderRight: j < headerCells.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none', whiteSpace: 'nowrap' }}>{c}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {dataRows.map((row, ri) => (
                            <tr key={ri}>
                              {row.map((c, ci) => <td key={ci} style={{ padding: '7px 12px', color: 'var(--text-secondary)', borderBottom: ri < dataRows.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none', borderRight: ci < row.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none', whiteSpace: 'nowrap' }}>{c}</td>)}
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
          background: 'linear-gradient(180deg, #C5E3FF 0%, #F1F7FD 100%)',
          animation: 'settingsSlideIn 0.3s ease',
        }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top,0px) + 16px) 16px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setFaqOpen(false)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              문의하기
            </span>
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
                  border: 'none', background: 'rgba(91,168,214,0.1)', color: '#5BA8D6',
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
          background: 'linear-gradient(180deg, #C5E3FF 0%, #F1F7FD 100%)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          animation: 'settingsSlideIn 0.3s ease',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top,0px) + 16px) 16px 12px', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setEditingProfile(false)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: -0.2 }}>프로필</span>
          </div>

          {/* Avatar */}
          <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
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
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--accent-primary, #89cef5)', border: '2px solid #EAF4FB',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </div>
            <div onClick={() => {}} style={{ fontSize: 10.5, color: 'var(--accent-primary, #89cef5)', fontWeight: 500, marginTop: 12, cursor: 'pointer' }}>
              {profile.profileImage ? '사진 변경' : '사진 추가'}
            </div>
          </div>

          {/* Fields */}
          <div style={{ margin: '0 16px', background: '#ffffff', borderRadius: 14, border: 'none' }}>
            {[
              { label: '이름', value: profile.nickname, key: 'nickname', placeholder: '입력해주세요' },
              { label: '생년월일', value: profile.birthYear ? (profile.birthYear.includes('-') ? profile.birthYear.replace(/-/g, '.') : `${profile.birthYear}년생`) : '', key: 'birthYear', placeholder: '선택 안 함' },
              { label: '성별', value: profile.gender || '', key: 'gender', placeholder: '선택 안 함' },
            ].map((f, i) => (
              <div key={f.key} onClick={() => { setEditField(f.key); setEditFieldValue(f.key === 'nickname' ? (profile.nickname || '') : f.key === 'birthYear' ? (profile.birthYear ? profile.birthYear.replace(/-/g, '.') : '') : (profile.gender || '')); }} style={{
                padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.2)' : 'none', cursor: 'pointer',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{f.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, color: f.value ? 'var(--text-muted)' : 'var(--text-dim, #B0B8C1)' }}>{f.value || f.placeholder}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C5DEF5" strokeWidth="1.8" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
                </div>
              </div>
            ))}
          </div>

          {/* Bio */}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>자기소개</div>
            <textarea
              value={profile.bio || ''}
              onChange={(e) => update('bio', e.target.value.slice(0, 50))}
              placeholder="입력해주세요"
              style={{
                width: '100%', minHeight: 50, boxSizing: 'border-box',
                background: '#ffffff', border: 'none',
                borderRadius: 12, padding: '12px 14px', fontSize: 12, color: 'var(--text-primary)',
                lineHeight: 1.5, outline: 'none', fontFamily: 'inherit', resize: 'none',
              }}
            />
            <div style={{ textAlign: 'right', fontSize: 10, color: (profile.bio?.length || 0) >= 45 ? 'var(--accent-primary)' : 'var(--text-muted)', marginTop: 6 }}>
              {(profile.bio?.length || 0)} / 50
            </div>
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ padding: '16px 16px calc(16px + env(safe-area-inset-bottom,0px))' }}>
            <button onClick={() => { showToast('저장되었어요'); setEditingProfile(false); }} style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: 'var(--accent-primary, #89cef5)', color: '#fff', fontSize: 14, fontWeight: 500,
              letterSpacing: -0.2, cursor: 'pointer', fontFamily: 'inherit',
            }}>저장</button>
          </div>

          {/* Field Edit Modal */}
          {editField && (() => {
            const closeField = () => setEditField(null);
            const saveField = () => { update(editField, editFieldValue); closeField(); };

            if (editField === 'nickname') {
              return (
                <>
                  <div onClick={closeField} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(4,44,83,0.18)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }} />
                  <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2001,
                    background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none',
                    border: 'none', borderRadius: '22px 22px 0 0',
                    boxShadow: '0 -8px 28px rgba(0,0,0,0.08)', padding: '0 0 calc(env(safe-area-inset-bottom,0px))',
                    maxWidth: 430, margin: '0 auto', animation: 'slideUp 0.3s ease',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}><div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(137,206,245,0.4)' }} /></div>
                    <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>이름</span>
                      <button onClick={closeField} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                    <div style={{ padding: '0 16px 16px' }}>
                      <input type="text" value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)} placeholder="이름을 입력하세요" maxLength={20} autoFocus
                        style={{ width: '100%', boxSizing: 'border-box', background: '#ffffff', border: 'none', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }} />
                      <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{editFieldValue.length}/20</div>
                      <button onClick={saveField} style={{ width: '100%', marginTop: 12, padding: 14, borderRadius: 10, border: 'none', background: 'var(--accent-primary, #89cef5)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
                    </div>
                  </div>
                </>
              );
            }

            if (editField === 'birthYear') {
              const formatBirth = (raw) => {
                const digits = raw.replace(/\D/g, '').slice(0, 8);
                if (digits.length <= 4) return digits;
                if (digits.length <= 6) return digits.slice(0, 4) + '.' + digits.slice(4);
                return digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6);
              };
              const birthToISO = (formatted) => {
                const d = formatted.replace(/\D/g, '');
                if (d.length === 8) return d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6);
                return '';
              };
              return (
                <>
                  <div onClick={closeField} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(4,44,83,0.18)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }} />
                  <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2001,
                    background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none',
                    border: 'none', borderRadius: '22px 22px 0 0',
                    boxShadow: '0 -8px 28px rgba(0,0,0,0.08)', padding: '0 0 calc(env(safe-area-inset-bottom,0px))',
                    maxWidth: 430, margin: '0 auto', animation: 'slideUp 0.3s ease',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}><div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(137,206,245,0.4)' }} /></div>
                    <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>생년월일</span>
                      <button onClick={closeField} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                    <div style={{ padding: '0 16px 16px' }}>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={editFieldValue || ''}
                        placeholder="2000.01.01"
                        maxLength={10}
                        autoFocus
                        onChange={(e) => {
                          const formatted = formatBirth(e.target.value);
                          setEditFieldValue(formatted);
                          const iso = birthToISO(formatted);
                          if (iso) { update('birthYear', iso); }
                        }}
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: 12, fontSize: 13,
                          border: 'none', background: '#ffffff',
                          color: 'var(--text-primary)', fontFamily: 'inherit', boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                      <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{editFieldValue.replace(/\D/g, '').length}/8</div>
                    </div>
                  </div>
                </>
              );
            }

            if (editField === 'gender') {
              return (
                <>
                  <div onClick={closeField} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(4,44,83,0.18)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }} />
                  <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2001, background: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none', border: 'none', borderRadius: '22px 22px 0 0', padding: '0 0 calc(env(safe-area-inset-bottom,0px))', maxWidth: 430, margin: '0 auto', animation: 'settingsSlideIn 0.25s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}><div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(137,206,245,0.4)' }} /></div>
                    <div style={{ padding: '14px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>성별</span>
                      <div onClick={closeField} style={{ width: 32, height: 32, borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </div>
                    </div>
                    <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
                      {GENDER_OPTIONS.map(g => {
                        const selected = editFieldValue === g;
                        return (
                          <div key={g} onClick={() => { setEditFieldValue(g); update('gender', g); closeField(); }} style={{
                            flex: 1, padding: '14px 0', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
                            fontSize: 14, fontWeight: 500,
                            background: selected ? 'rgba(137,206,245,0.12)' : 'rgba(255,255,255,0.4)',
                            color: selected ? 'var(--accent-primary)' : 'var(--text-primary)',
                            border: selected ? '1px solid var(--accent-primary, #89cef5)' : '1px solid rgba(255,255,255,0.3)',
                          }}>{g}</div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* ===== Skin Type Sub-Page ===== */}
      {editingSkin && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1002, maxWidth: 430, margin: '0 auto',
          background: 'linear-gradient(180deg, #C5E3FF 0%, #F1F7FD 100%)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          animation: 'settingsSlideIn 0.3s ease',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top,0px) + 16px) 16px 12px', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setEditingSkin(false)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: -0.2 }}>피부 타입</span>
          </div>

          {/* Intro */}
          <div style={{ padding: '12px 24px 20px' }}>
            <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: -0.3, lineHeight: 1.35 }}>
              {profile.skinType
                ? '지금 설정된 피부 타입이에요'
                : `${profile.nickname || '당신'}의 피부 타입은 무엇인가요?`}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              {profile.skinType ? '피부 타입이 바뀐 것 같다면 다시 설정해도 돼요' : '선택하시면 lua가 더 정확한 분석을 드릴 수 있어요'}
            </div>
          </div>

          {/* Skin type options */}
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: '건성', icon: '', desc: '세안 후 당기고 건조한 느낌이 자주 나요' },
              { key: '지성', icon: '', desc: '전체적으로 유분이 많고 번들거림이 있어요' },
              { key: '복합성', icon: '', desc: 'T존은 유분, 볼은 건조한 편이에요' },
              { key: '민감성', icon: '', desc: '쉽게 자극받고 환절기에 트러블이 잘 나요' },
              { key: '중성', icon: '', desc: '특별히 건조하거나 유분이 많지 않아요' },
            ].map(opt => {
              const selected = profile.skinType === opt.key;
              return (
                <div key={opt.key} onClick={() => update('skinType', opt.key)} style={{
                  padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                  background: selected ? 'rgba(137,206,245,0.12)' : 'rgba(255,255,255,0.35)',
                  border: selected ? '1px solid var(--accent-primary, #89cef5)' : '1px solid rgba(255,255,255,0.3)',
                  display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 40, height: 40, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>{opt.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: -0.2 }}>{opt.key}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
                  </div>
                  {selected && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary, #89cef5)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ padding: '16px 16px calc(16px + env(safe-area-inset-bottom,0px))' }}>
            <button onClick={() => { showToast('저장되었어요'); setEditingSkin(false); }} style={{
              width: '100%', padding: 14, borderRadius: 12, border: 'none',
              background: 'var(--accent-primary, #89cef5)', color: '#fff', fontSize: 14, fontWeight: 500,
              letterSpacing: -0.2, cursor: 'pointer', fontFamily: 'inherit',
            }}>저장</button>
          </div>
        </div>
      )}

      {/* Backup Guide Sub-Page */}
      {backupGuide && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1002,
          background: 'linear-gradient(180deg, #C5E3FF 0%, #F1F7FD 100%)',
          animation: 'settingsSlideIn 0.3s ease',
        }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top,0px) + 16px) 16px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
            <div onClick={() => setBackupGuide(null)} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </div>
            <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>데이터 백업</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '25px 20px 40px', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              백업 파일 저장하기
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.6 }}>
              {backupGuide.lsCount}개 항목 · {backupGuide.photoCount}장 사진이 백업됩니다.
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
              저장 방법 안내
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
              아래 버튼을 누르면 공유 화면이 열립니다.{'\n'}"파일에 저장"을 선택해주세요.
            </div>

            <button
              onClick={async () => {
                const { json, lsCount, photoCount } = backupGuide;
                setBackupGuide(null);
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
              }}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                border: 'none', background: 'rgba(91,168,214,0.1)', color: '#5BA8D6',
                fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              백업 파일 저장하기
            </button>
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
              border: '1px solid var(--border-subtle)',
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
                      flex: 1, padding: 12, borderRadius: 14, border: '1px solid var(--border-subtle)',
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
                  width: 32, height: 32, border: '3px solid rgba(240,144,112,0.2)',
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
          targetValue: targets[key] || Math.min(100, startValue + 10),
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
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1002,
        background: 'var(--bg-modal-overlay)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          maxHeight: '85vh', overflowY: 'auto',
          background: 'var(--bg-modal)', borderRadius: '24px 24px 0 0',
          padding: '24px 24px 40px',
          border: '1px solid var(--border-subtle)',
          borderBottom: 'none',
          animation: 'slideUp 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              {step === 1 && '지표 선택'}
              {step === 2 && '목표 설정'}
              {step === 3 && '목표 확인'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {step === 1 && '개선하고 싶은 지표를 선택하세요 (최대 3개)'}
              {step === 2 && '목표 점수와 기간을 설정하세요'}
              {step === 3 && '설정한 목표를 확인하세요'}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'var(--bg-input)', color: 'var(--text-muted)',
            fontSize: 16, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}></button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: s <= step ? '#ADEBB3' : 'var(--bg-input)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* STEP 1: Metric selection */}
        {step === 1 && (
          <div>
            {!latestRecord && (
              <div style={{
                padding: '12px 16px', borderRadius: 14, marginBottom: 16,
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
              }}>
                <div style={{ fontSize: 12, color: '#f59e0b', lineHeight: 1.5 }}>
                  먼저 피부 분석을 해야 현재 점수를 확인할 수 있어요. 분석 후 목표를 설정해보세요!
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sortedMetrics.map((m, idx) => {
                const selected = selectedMetrics.includes(m.key);
                return (
                  <div
                    key={m.key}
                    onClick={() => latestRecord && toggleMetric(m.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px', borderRadius: 16,
                      background: selected ? 'rgba(240,144,112,0.1)' : 'var(--bg-card)',
                      border: selected ? '1px solid rgba(240,144,112,0.3)' : '1px solid var(--border-light)',
                      cursor: latestRecord ? 'pointer' : 'default',
                      opacity: latestRecord ? 1 : 0.5,
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{m.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{m.label}</span>
                        {idx < 3 && latestRecord && (
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 6,
                            background: 'rgba(240,96,80,0.1)', color: '#e05545',
                          }}>추천</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        현재 {m.value}점
                      </div>
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
                      background: selected ? '#ADEBB3' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 0.2s',
                    }}>
                      {selected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: Target setting */}
        {step === 2 && (
          <div>
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
                    border: '1px solid rgba(240,144,112,0.2)',
                    background: 'rgba(240,144,112,0.06)',
                    color: '#81E4BD', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >+{p.delta}<br/><span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>{p.label}</span></button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selectedMetrics.map((key) => {
                const meta = METRIC_META.find((m) => m.key === key);
                const current = latestRecord ? (latestRecord[key] ?? 0) : 50;
                const target = targets[key] || Math.min(100, current + 10);

                return (
                  <div key={key} style={{
                    padding: '16px', borderRadius: 16,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{meta.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>{meta.label}</span>
                      </div>
                      <span style={{ fontSize: 13, color: '#ADEBB3', fontWeight: 600 }}>
                        {current} → {target}
                      </span>
                    </div>
                    <div style={{
                      width: '100%', height: 8, borderRadius: 4,
                      background: 'var(--bg-card-hover)', position: 'relative',
                      marginBottom: 10,
                    }}>
                      <div style={{
                        width: `${current}%`, height: '100%', borderRadius: 4,
                        background: 'var(--bg-input)',
                      }} />
                      <div style={{
                        position: 'absolute', top: 0, left: 0,
                        width: `${target}%`, height: '100%', borderRadius: 4,
                        background: 'linear-gradient(90deg, #E87080, #81E4BD, #81E4BD)',
                        opacity: 0.6,
                      }} />
                    </div>
                    <input
                      type="range"
                      min={Math.min(current + 1, 100)}
                      max={100}
                      value={target}
                      onChange={(e) => setTargets((prev) => ({ ...prev, [key]: parseInt(e.target.value) }))}
                      style={{ width: '100%', accentColor: '#ADEBB3' }}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>목표 기간</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[30, 60, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 14,
                      border: duration === d ? '1px solid #ADEBB3' : '1px solid var(--border-subtle)',
                      background: duration === d ? 'rgba(240,144,112,0.12)' : 'transparent',
                      color: duration === d ? '#ADEBB3' : 'var(--text-muted)',
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
          <div>
            <div style={{
              padding: 20, borderRadius: 20,
              background: 'rgba(240,144,112,0.06)',
              border: '1px solid rgba(240,144,112,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>목표 요약</span>
                <span style={{ fontSize: 12, color: '#ADEBB3', fontWeight: 500 }}>{duration}일</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {selectedMetrics.map((key) => {
                  const meta = METRIC_META.find((m) => m.key === key);
                  const current = latestRecord ? (latestRecord[key] ?? 0) : 50;
                  const target = targets[key] || Math.min(100, current + 10);
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{meta.icon}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{meta.label}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{current}</span>
                        <span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>→</span>
                        <span style={{ color: '#ADEBB3', fontWeight: 600 }}>{target}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {existingGoal && existingGoal.status === 'active' && (
              <div style={{
                marginTop: 12, padding: '10px 16px', borderRadius: 12,
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
              }}>
                <div style={{ fontSize: 12, color: '#f59e0b', lineHeight: 1.5 }}>
                  기존 목표가 새 목표로 대체됩니다.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                flex: 1, padding: 14, borderRadius: 16,
                border: '1px solid var(--border-subtle)',
                background: 'transparent', color: 'var(--text-muted)',
                fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
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
                    t[key] = Math.min(100, v + 10);
                  }
                  setTargets((prev) => ({ ...t, ...prev }));
                }
                setStep(step + 1);
              }}
              disabled={step === 1 && selectedMetrics.length === 0}
              style={{
                flex: 1, padding: 14, borderRadius: 16, border: 'none',
                background: (step === 1 && selectedMetrics.length === 0)
                  ? 'var(--bg-input)' : 'var(--btn-primary-bg)',
                color: (step === 1 && selectedMetrics.length === 0) ? 'var(--text-dim)' : '#fff',
                fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >다음</button>
          )}
          {step === 3 && (
            <button
              onClick={handleSave}
              style={{
                flex: 1, padding: 14, borderRadius: 16, border: 'none',
                background: 'var(--btn-primary-bg)',
                color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: 'none',
              }}
            >목표 시작하기</button>
          )}
        </div>

        {existingGoal && existingGoal.status === 'active' && step === 1 && (
          <button
            onClick={handleReset}
            style={{
              width: '100%', marginTop: 12, padding: 12, borderRadius: 14,
              border: 'none', background: 'transparent',
              color: '#e05545', fontSize: 13, fontWeight: 400,
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
        border: '1px solid var(--border-separator)',
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
  const [h, m] = value.split(':').map(Number);
  const [ampm, setAmpm] = useState(h < 12 ? 'AM' : 'PM');
  const [hour, setHour] = useState(h === 0 ? 12 : h > 12 ? h - 12 : h);
  const [minute, setMinute] = useState(m);

  const hourRef = useRef(null);
  const minRef = useRef(null);

  const ITEM_H = 44;
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  useEffect(() => {
    if (hourRef.current) {
      hourRef.current.scrollTop = (hour - 1) * ITEM_H;
    }
    if (minRef.current) {
      minRef.current.scrollTop = minute * ITEM_H;
    }
  }, []);

  const handleScroll = useCallback((ref, items, setter) => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, items.length - 1));
    setter(items[clamped]);
  }, []);

  const handleConfirm = () => {
    let h24 = hour;
    if (ampm === 'AM' && hour === 12) h24 = 0;
    else if (ampm === 'PM' && hour !== 12) h24 = hour + 12;
    onChange(`${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };

  const colStyle = {
    height: ITEM_H * 3, overflow: 'hidden', overflowY: 'auto',
    scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none', msOverflowStyle: 'none',
    flex: 1, position: 'relative',
  };

  const itemStyle = (active) => ({
    height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: active ? 22 : 16, fontWeight: active ? 600 : 300,
    color: active ? '#ADEBB3' : 'var(--text-dim)',
    scrollSnapAlign: 'center', transition: 'all 0.15s',
    cursor: 'pointer',
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'var(--bg-modal-overlay)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430,
          background: 'var(--bg-modal)', borderRadius: '24px 24px 0 0',
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
          animation: 'slideUp 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span onClick={onClose} style={{ fontSize: 14, color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 400 }}>취소</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>알림 시간</span>
          <span onClick={handleConfirm} style={{ fontSize: 14, color: '#ADEBB3', cursor: 'pointer', fontWeight: 600 }}>확인</span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 0,
          background: 'var(--bg-card)', borderRadius: 20, overflow: 'hidden',
          border: '1px solid var(--border-light)',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', left: 8, right: 8,
            top: ITEM_H, height: ITEM_H,
            background: 'rgba(240,144,112,0.08)', borderRadius: 12,
            pointerEvents: 'none', zIndex: 0,
          }} />

          <div style={{ width: 64, height: ITEM_H * 3, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: ITEM_H, zIndex: 1 }}>
            {['AM', 'PM'].map((v) => (
              <div
                key={v}
                onClick={() => setAmpm(v)}
                style={{
                  height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: ampm === v ? 18 : 15, fontWeight: ampm === v ? 600 : 300,
                  color: ampm === v ? '#ADEBB3' : 'var(--text-dim)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >{v === 'AM' ? '오전' : '오후'}</div>
            ))}
          </div>

          <div
            ref={hourRef}
            onScroll={() => handleScroll(hourRef, hours, setHour)}
            className="hide-scrollbar"
            style={{ ...colStyle, zIndex: 1 }}
          >
            <div style={{ height: ITEM_H }} />
            {hours.map((h) => (
              <div key={h} style={itemStyle(h === hour)}
                onClick={() => { setHour(h); if (hourRef.current) hourRef.current.scrollTo({ top: (h - 1) * ITEM_H, behavior: 'smooth' }); }}
              >{h}</div>
            ))}
            <div style={{ height: ITEM_H }} />
          </div>

          <div style={{ fontSize: 22, fontWeight: 600, color: '#ADEBB3', zIndex: 1 }}>:</div>

          <div
            ref={minRef}
            onScroll={() => handleScroll(minRef, minutes, setMinute)}
            className="hide-scrollbar"
            style={{ ...colStyle, zIndex: 1 }}
          >
            <div style={{ height: ITEM_H }} />
            {minutes.map((m) => (
              <div key={m} style={itemStyle(m === minute)}
                onClick={() => { setMinute(m); if (minRef.current) minRef.current.scrollTo({ top: m * ITEM_H, behavior: 'smooth' }); }}
              >{String(m).padStart(2, '0')}</div>
            ))}
            <div style={{ height: ITEM_H }} />
          </div>
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
  border: '1px solid var(--border-subtle)', background: 'var(--bg-card-hover)',
  fontSize: 14, color: 'var(--text-primary)', outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s',
};

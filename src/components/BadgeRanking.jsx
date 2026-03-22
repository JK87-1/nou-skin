import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BADGE_DATABASE, LEVEL_TITLES, THEMES, calculateLevel, getLevelTitle, getLevelTitleData, getDefaultTheme, getThemeById, getThemesForMode } from '../data/BadgeData';
import {
  getTotalXP, getLevel, getLevelProgress,
  getAllBadgesWithStatus, checkAndAwardBadges, getStats,
} from '../storage/BadgeStorage';
import { getRecords, getStreak, getLatestRecord } from '../storage/SkinStorage';
import { getProfile, saveProfile, getDeviceId } from '../storage/ProfileStorage';
import SoftCloverIcon from './icons/SoftCloverIcon';
import { TargetIcon, CrownIcon, TrophyIcon, CheckIcon, LockIcon, PastelIcon } from './icons/PastelIcons';

// ===== 랭킹 API 호출 =====
async function fetchRanking(deviceId, nickname, score, xp, level) {
  try {
    const res = await fetch('/api/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, nickname, score, xp, level }),
    });
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch {
    return null;
  }
}

// ===== Mini Pearl SVG =====
function MiniPearl({ size = 24, colors, glow, id: pid, cloverTheme }) {
  // cloverTheme이 있으면 SoftCloverIcon 사용, 없으면 fallback
  if (cloverTheme) {
    return <SoftCloverIcon theme={cloverTheme} size={size} animate={false} />;
  }
  const u = `mp${pid}${Math.random() * 1e5 | 0}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <radialGradient id={`${u}g`} cx="38%" cy="34%" r="58%">
          <stop offset="0%" stopColor={colors[0]} /><stop offset="50%" stopColor={colors[1]} /><stop offset="100%" stopColor={colors[2]} />
        </radialGradient>
        {glow && <filter id={`${u}f`}><feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor={colors[1]} floodOpacity="0.6" /></filter>}
      </defs>
      <circle cx="12" cy="12" r="10" fill={`url(#${u}g)`} filter={glow ? `url(#${u}f)` : undefined} />
      <ellipse cx="9" cy="8.5" rx="3" ry="2.2" fill="white" opacity="0.5" />
      <circle cx="8" cy="7.5" r="1.2" fill="white" opacity="0.65" />
    </svg>
  );
}

// ===== Main Component =====
export default function BadgeRanking({ onNewBadge, onSettingsClick, colorMode, onThemeChange }) {
  const [tab, setTab] = useState('badges'); // 'badges' | 'theme' | 'ranking'
  const [selectedCat, setSelectedCat] = useState('streak');
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [toast, setToast] = useState(null);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const photoInputRef = useRef(null);
  const nameInputRef = useRef(null);

  // Data
  const [profile, setProfile] = useState(getProfile);
  const records = getRecords();
  const streak = getStreak();
  const stats = getStats();
  const latestRecord = getLatestRecord();
  const totalXP = getTotalXP();
  const level = getLevel();
  const levelProgress = getLevelProgress();
  const allBadges = getAllBadgesWithStatus();

  // Theme & selected title
  const activeTheme = useMemo(() => {
    if (profile.activeTheme) {
      const t = getThemeById(profile.activeTheme);
      if (t.mode === colorMode) return t;
    }
    return getDefaultTheme(colorMode);
  }, [profile.activeTheme, colorMode]);
  const selectedTitleData = useMemo(() => {
    if (profile.selectedTitleLevel) {
      const t = LEVEL_TITLES.find(lt => lt.level === profile.selectedTitleLevel && level >= lt.level);
      if (t) return t;
    }
    return getLevelTitleData(level);
  }, [profile.selectedTitleLevel, level]);
  const levelTitle = selectedTitleData.title;

  const earnedCount = useMemo(() =>
    Object.values(allBadges).reduce((sum, cat) => sum + cat.badges.filter(b => b.earned).length, 0),
    [allBadges]);
  const totalBadgeCount = useMemo(() =>
    Object.values(allBadges).reduce((sum, cat) => sum + cat.badges.length, 0),
    [allBadges]);

  const nextLevelXP = level * 200;
  const currentLevelXP = (level - 1) * 200;

  // Ranking (server)
  const [ranking, setRanking] = useState([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [rankError, setRankError] = useState(false);
  const [weekLabel, setWeekLabel] = useState('');

  const loadRanking = async () => {
    setRankLoading(true);
    setRankError(false);
    const myScore = latestRecord?.overallScore || 0;
    const data = await fetchRanking(
      getDeviceId(), profile.nickname || '사용자', myScore, totalXP, level
    );
    if (data) {
      setRanking(data.ranking || []);
      setWeekLabel(data.weekLabel || '');
    } else {
      setRankError(true);
    }
    setRankLoading(false);
  };

  useEffect(() => { loadRanking(); }, []);

  const myRank = ranking.find(u => u.isMe);

  // Next goals (closest to completion, not yet earned)
  const nextGoals = useMemo(() => {
    const all = [];
    for (const cat of Object.values(allBadges)) {
      for (const b of cat.badges) {
        if (!b.earned && b.progress > 0) {
          all.push({ ...b, catColor: cat.color });
        }
      }
    }
    all.sort((a, b) => b.progress - a.progress);
    return all.slice(0, 3);
  }, [allBadges]);

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  // Profile photo picker
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      // Resize to 300x300 for storage efficiency
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 300;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const updated = saveProfile({ profileImage: dataUrl });
        setProfile(updated);
        showToastMsg('프로필 사진이 변경되었어요');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Nickname inline edit
  const startNameEdit = () => {
    setNameInput(profile.nickname || '');
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };
  const saveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== profile.nickname) {
      const updated = saveProfile({ nickname: trimmed });
      setProfile(updated);
      showToastMsg('이름이 변경되었어요');
    }
    setEditingName(false);
  };

  const handleShare = async (badge) => {
    const text = `루아에서 "${badge.name}" 뱃지를 획득했어요! ${badge.icon} ${badge.desc}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: '루아 뱃지 획득!', text });
      } else {
        await navigator.clipboard.writeText(text);
        showToastMsg('링크가 복사되었어요!');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        showToastMsg('링크가 복사되었어요!');
      } catch { /* ignore */ }
    }
  };

  const catEntries = Object.entries(allBadges);
  const currentCat = allBadges[selectedCat];

  return (
    <div style={{ paddingBottom: 20 }}>
      <style>{`
        @keyframes brFadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes brXpFill { from { width: 0; } }
        @keyframes brBadgeShine { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes brFadeInDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes brScaleUp { 0% { transform: scale(0.8); opacity: 0; } 60% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
        .br-hide-scroll::-webkit-scrollbar { display: none; }
        .br-hide-scroll { scrollbar-width: none; }
      `}</style>

      {/* ── Profile Header ── */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 16, padding: '28px 20px',
          boxShadow: 'none', marginBottom: 12,
          textAlign: 'center', position: 'relative',
          animation: 'brFadeInUp 0.5s ease both',
        }}>
          {/* Settings gear — circle button top-right */}
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              style={{
                position: 'absolute', top: 20, right: 20, zIndex: 2,
                width: 32, height: 32, borderRadius: '50%',
                border: 'none', background: 'var(--tag-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>{'⚙'}</span>
            </button>
          )}

          {/* Avatar centered with badge count */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12, cursor: 'pointer' }}
            onClick={() => photoInputRef.current?.click()}>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
            <div style={{
              width: 80, height: 80, borderRadius: 24,
              background: `linear-gradient(135deg, #FFD4B8, #81E4BD)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', margin: '0 auto',
            }}>
              {profile.profileImage ? (
                <img src={profile.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                  {(profile.nickname || '사용자').charAt(0)}
                </span>
              )}
            </div>
            {/* Badge count badge */}
            <div style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 22, height: 22, borderRadius: '50%',
              background: 'linear-gradient(135deg, #81E4BD, #FFA500)',
              color: '#fff', fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff',
            }}>{earnedCount}</div>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 4 }}>
            {editingName ? (
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }}
                maxLength={12}
                style={{
                  fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
                  background: 'var(--item-bg)', border: '1.5px solid rgba(124,92,252,0.3)',
                  borderRadius: 10, padding: '2px 10px', width: 180,
                  outline: 'none', fontFamily: 'inherit', textAlign: 'center',
                }}
              />
            ) : (
              <span
                onClick={startNameEdit}
                style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                {profile.nickname || '사용자'}
              </span>
            )}
          </div>

          {/* Title chip */}
          <div style={{ marginBottom: 14 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowTitleModal(true); }}
              style={{
                fontSize: 11, fontWeight: 600, color: '#81E4BD',
                background: 'rgba(124,92,252,0.08)', padding: '4px 12px', borderRadius: 8,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <span>{selectedTitleData.icon}</span>
              {levelTitle}
            </button>
          </div>

          {/* XP Progress bar */}
          <div style={{ margin: '0 auto', maxWidth: 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Level {level}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{totalXP - currentLevelXP} / {nextLevelXP - currentLevelXP} XP</span>
            </div>
            <div style={{ height: 6, background: 'var(--progress-track)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${levelProgress}%`, height: '100%', borderRadius: 3,
                background: 'linear-gradient(90deg, #81E4BD, #81E4BD)',
                transition: 'width 1s ease-out',
              }} />
            </div>
          </div>

          {/* Stats row — 4 columns with dividers */}
          <div style={{ display: 'flex', marginTop: 16, gap: 0 }}>
            {[
              { value: records.length, label: '기록' },
              { value: streak.count, label: '스트릭' },
              { value: level, label: '레벨' },
              { value: earnedCount, label: '뱃지', onClick: () => setShowBadgeModal(true) },
            ].map((s, i, arr) => (
              <div key={i} onClick={s.onClick} style={{
                flex: 1, textAlign: 'center', cursor: s.onClick ? 'pointer' : 'default',
                borderRight: i < arr.length - 1 ? '1px solid var(--progress-track)' : 'none',
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

      {/* ── Tab Switcher ── */}
        <div style={{
          display: 'flex', gap: 2, background: 'var(--tag-bg)', borderRadius: 12,
          padding: 4, margin: '12px 0 16px',
          animation: 'brFadeInUp 0.5s ease 0.1s both',
        }}>
          {[
            { key: 'badges', label: '뱃지' },
            { key: 'theme', label: '테마' },
            { key: 'ranking', label: '랭킹' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, textAlign: 'center', padding: '8px 12px',
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              border: 'none',
              background: tab === t.key ? 'var(--bg-card)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: 'none',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
            }}>{t.label}</button>
          ))}
        </div>

      {/* ── Badge Collection Tab ── */}
      {tab === 'badges' && (
        <div>
          {/* Next Goals */}
          {nextGoals.length > 0 && (
            <>
              <div style={{ padding: '0 0 8px' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>다음 목표</span>
              </div>
              {nextGoals.slice(0, 1).map((g) => (
                <div key={g.id} style={{
                  background: 'var(--bg-card)', borderRadius: 16, padding: 20,
                  boxShadow: 'none', marginBottom: 16,
                  animation: 'brFadeInUp 0.5s ease 0.15s both',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <span style={{ fontSize: 28, display: 'inline-flex' }}><PastelIcon emoji={g.icon} size={28} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{g.desc}</div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#81E4BD' }}>
                      {g.current}/{g.target}
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--progress-track)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${g.progress * 100}%`, height: '100%', borderRadius: 3,
                      background: 'linear-gradient(90deg, #81E4BD, #81E4BD)',
                    }} />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Category Filter */}
            <div className="br-hide-scroll" style={{
              display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12,
              animation: 'brFadeInUp 0.5s ease 0.15s both',
            }}>
              {catEntries.map(([key, cat]) => {
                const active = selectedCat === key;
                return (
                  <button key={key} onClick={() => { setSelectedCat(key); setSelectedBadge(null); }} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit',
                    background: active ? 'rgba(124,92,252,0.08)' : 'var(--tag-bg)',
                    color: active ? '#81E4BD' : '#4E5968',
                    border: 'none', transition: 'all 0.25s',
                  }}>
                    {cat.subtitle || cat.label}
                  </button>
                );
              })}
            </div>

          {/* Category subtitle */}
          {currentCat?.subtitle && (
            <div style={{
              fontSize: 12, color: 'var(--text-muted)', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 6,
              animation: 'brFadeInUp 0.3s ease 0.18s both',
            }}>
              <span style={{
                fontSize: 11, fontWeight: 600, color: currentCat.color,
                background: `${currentCat.color}14`, padding: '3px 8px', borderRadius: 6,
              }}>{currentCat.subtitle}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {currentCat.badges.filter(b => b.earned).length}/{currentCat.badges.length} 달성
              </span>
            </div>
          )}

          {/* Badge Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
              animation: 'brFadeInUp 0.4s ease 0.2s both',
            }}>
              {currentCat?.badges.map((badge, bi) => (
                <div
                  key={badge.id}
                  onClick={() => setSelectedBadge(selectedBadge === badge.id ? null : badge.id)}
                  style={{
                    textAlign: 'center', padding: 16, borderRadius: 16,
                    cursor: 'pointer', transition: 'all 0.25s',
                    background: badge.earned ? 'var(--bg-card)' : 'var(--item-bg)',
                    boxShadow: 'none',
                    animation: `brFadeInUp 0.4s ease-out ${bi * 0.06}s both`,
                  }}
                >
                  <div style={{
                    fontSize: 36, marginBottom: 8, display: 'flex', justifyContent: 'center',
                    filter: badge.earned ? 'none' : 'grayscale(1) opacity(0.4)',
                  }}><PastelIcon emoji={badge.icon} size={36} /></div>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: badge.earned ? 'var(--text-primary)' : 'var(--text-dim)',
                  }}>{badge.name}</div>
                  {badge.earned ? (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>획득 완료!</div>
                  ) : badge.progress > 0 ? (
                    <>
                      <div style={{ marginTop: 6 }}>
                        <div style={{ height: 4, background: 'var(--progress-track)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            width: `${badge.progress * 100}%`, height: '100%', borderRadius: 2,
                            background: 'linear-gradient(90deg, #81E4BD, #81E4BD)',
                          }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                        {badge.current}/{badge.target}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>미획득</div>
                  )}
                </div>
              ))}
            </div>

        </div>
      )}

      {/* ── Theme Tab ── */}
      {tab === 'theme' && (
        <div style={{ animation: 'brFadeInUp 0.5s ease 0.1s both' }}>
          {/* What theme changes — horizontal scroll chips */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {['액센트 컬러', '루아 아이콘', '분석 오라', '칭호 뱃지', 'XP 바', '랭킹 명함'].map((item, i) => (
              <div key={i} style={{
                padding: '5px 10px', borderRadius: 8,
                background: 'var(--tag-bg)',
                fontSize: 11, color: '#4E5968', fontWeight: 500,
              }}>{item}</div>
            ))}
          </div>

          {/* Theme list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {getThemesForMode(colorMode).map((t) => {
              const isActive = activeTheme.id === t.id;
              return (
                <div key={t.id}
                  onClick={() => {
                    const updated = saveProfile({ activeTheme: t.id });
                    setProfile(updated);
                  }}
                  style={{
                    padding: '14px 16px', borderRadius: 16,
                    background: 'var(--bg-card)',
                    boxShadow: isActive ? `0 0 0 1.5px ${t.accent}40` : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}
                >
                  {/* Pearl icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: `linear-gradient(135deg, ${t.pearl[0]}40, ${t.pearl[1]}30)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <MiniPearl size={28} colors={t.pearl} glow={isActive} id={`tl-${t.id}`} cloverTheme={t.cloverTheme} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t.name}</span>
                      {isActive && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: t.accent,
                          background: `${t.accent}15`, padding: '2px 7px', borderRadius: 6,
                        }}>적용 중</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {t.kr} · {t.desc}
                    </div>
                  </div>

                  {/* Color swatches */}
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {[...t.pearl, t.accent].map((c, i) => (
                      <div key={i} style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: c,
                        border: '1px solid rgba(0,0,0,0.06)',
                      }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Ranking Tab ── */}
      {tab === 'ranking' && (
        <div>
          {/* Week label */}
          <div style={{ textAlign: 'center', marginBottom: 20, animation: 'brFadeInUp 0.5s ease 0.15s both' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{weekLabel || '이번 주'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>종합 점수 기준</div>
          </div>

          {/* Loading */}
          {rankLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 12, animation: 'brBadgeShine 1s ease infinite' }}><CrownIcon size={28} /></div>
              랭킹을 불러오는 중...
            </div>
          )}

          {/* Error */}
          {rankError && !rankLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>😥</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>랭킹을 불러올 수 없습니다</div>
              <button onClick={loadRanking} style={{
                padding: '8px 24px', borderRadius: 12, border: `1px solid ${activeTheme.accent}4d`,
                background: `${activeTheme.accent}1a`, color: activeTheme.accent, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>다시 시도</button>
            </div>
          )}

          {/* Ranking Content */}
          {!rankLoading && !rankError && ranking.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🏅</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>아직 랭킹 데이터가 없어요</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>피부 측정을 하면 랭킹에 참여할 수 있어요!</div>
            </div>
          )}

          {!rankLoading && !rankError && ranking.length > 0 && <>
          {/* Top 3 Podium */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8,
            marginBottom: 24, animation: 'brFadeInUp 0.5s ease 0.2s both',
          }}>
            {/* 2nd place */}
            {ranking.length >= 2 && <PodiumCard user={ranking[1]} medal="🥈" accent={activeTheme.accent} />}
            {/* 1st place */}
            {ranking.length >= 1 && <PodiumCard user={ranking[0]} medal={<TrophyIcon size={28} />} isFirst accent={activeTheme.accent} />}
            {/* 3rd place */}
            {ranking.length >= 3 && <PodiumCard user={ranking[2]} medal="🥉" accent={activeTheme.accent} />}
          </div>

          {/* 4th and below */}
          <div>
            {ranking.slice(3).map((user, i) => (
              <div
                key={user.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', marginBottom: 6, borderRadius: 16,
                  background: user.isMe
                    ? 'linear-gradient(135deg, rgba(240,144,112,0.1), rgba(240,144,112,0.05))'
                    : 'rgba(255,255,255,0.02)',
                  border: user.isMe
                    ? '1px solid rgba(240,144,112,0.25)'
                    : '1px solid var(--border-separator)',
                  animation: `brFadeInUp 0.4s ease-out ${(i + 3) * 0.06}s both`,
                }}
              >
                {/* Rank */}
                <div style={{
                  width: 28, height: 28, borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  background: user.isMe
                    ? 'var(--btn-primary-bg)' : 'var(--bg-card)',
                  color: user.isMe ? '#fff' : 'var(--text-dim)',
                }}>{user.rank}</div>

                {/* Name */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 14, fontWeight: user.isMe ? 700 : 500,
                      color: user.isMe ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}>{user.nickname}</span>
                    {user.isMe && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: activeTheme.accent,
                        background: `${activeTheme.accent}1f`, padding: '1px 6px', borderRadius: 4,
                      }}>나</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>Lv.{user.level} · {user.xp.toLocaleString()} XP</div>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: user.isMe ? activeTheme.accent : 'var(--text-primary)' }}>
                    {user.score}
                  </div>
                  <ChangeIndicator change={user.change} />
                </div>
              </div>
            ))}
          </div>

          {/* My Ranking Analysis */}
          {myRank && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(240,144,112,0.08), rgba(240,144,112,0.04))',
              borderRadius: 20, border: '1px solid rgba(240,144,112,0.15)',
              padding: 18, marginTop: 16,
              animation: 'brFadeInUp 0.5s ease 0.4s both',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📊</span> 나의 랭킹 분석
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[
                  { value: `${myRank.rank}위`, label: '현재 순위', color: activeTheme.accent },
                  { value: myRank.change > 0 ? `▲${myRank.change}` : myRank.change < 0 ? `▼${Math.abs(myRank.change)}` : '-', label: '지난주 대비', color: myRank.change > 0 ? '#34d399' : myRank.change < 0 ? '#f87171' : 'var(--text-dim)' },
                  { value: `${Math.round((myRank.rank / ranking.length) * 100)}%`, label: '상위', color: activeTheme.accent },
                ].map((s, i) => (
                  <div key={i} style={{
                    flex: 1, textAlign: 'center', padding: '12px 6px',
                    background: 'var(--bg-card)', borderRadius: 14,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* AI Comment */}
              {(() => {
                const above = ranking.find(u => u.rank === myRank.rank - 1);
                const diff = above ? above.score - myRank.score : 0;
                const weakest = latestRecord ? (() => {
                  const metrics = [
                    { key: 'moisture', label: '수분' },
                    { key: 'skinTone', label: '피부톤' },
                    { key: 'poreScore', label: '모공' },
                    { key: 'elasticityScore', label: '탄력' },
                  ];
                  return metrics.reduce((min, m) => (latestRecord[m.key] || 100) < (latestRecord[min.key] || 100) ? m : min, metrics[0]);
                })() : null;

                return (
                  <div style={{
                    padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 12,
                    fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
                  }}>
                    💡 {above
                      ? `${myRank.rank - 1}위와 ${diff}점 차이예요.${weakest ? ` ${weakest.label} 점수를 올리면 이번 주 안에 순위를 올릴 수 있어요!` : ''}`
                      : '현재 1위예요! 이 상태를 유지해보세요!'
                    }
                  </div>
                );
              })()}
            </div>
          )}
          </>}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(240,144,112,0.9)', color: '#fff',
          padding: '10px 24px', borderRadius: 20, fontSize: 13, fontWeight: 500,
          zIndex: 999, animation: 'brFadeInDown 0.3s ease-out both',
        }}><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><CheckIcon size={13} /></span> {toast}</div>
      )}

      {/* Modals */}
      {showTitleModal && <TitleSelectionSheet
        currentLevel={level} totalXP={totalXP} activeTheme={activeTheme}
        selectedTitleLevel={selectedTitleData.level}
        onSelect={(titleLevel) => {
          const updated = saveProfile({ selectedTitleLevel: titleLevel });
          setProfile(updated);
          setShowTitleModal(false);
        }}
        onClose={() => setShowTitleModal(false)}
      />}
      {showBadgeModal && <BadgeCollectionModal allBadges={allBadges} onShare={handleShare} onClose={() => setShowBadgeModal(false)} accent={activeTheme.accent} />}
    </div>
  );
}

// ===== Podium Card =====
function PodiumCard({ user, medal, isFirst, accent = '#81E4BD' }) {
  return (
    <div style={{
      flex: 1, maxWidth: isFirst ? 130 : 110,
      padding: isFirst ? '18px 6px 14px' : '14px 6px 12px',
      textAlign: 'center', borderRadius: 18,
      background: isFirst
        ? 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,146,36,0.04))'
        : 'var(--bg-card)',
      border: isFirst
        ? '1px solid rgba(251,191,36,0.2)'
        : '1px solid var(--border-light)',
    }}>
      <div style={{ fontSize: isFirst ? 28 : 22, marginBottom: 6 }}>{medal}</div>
      <div style={{
        width: isFirst ? 44 : 36, height: isFirst ? 44 : 36, borderRadius: isFirst ? 14 : 12,
        background: user.isMe ? `${accent}26` : 'var(--bg-card-hover)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 6px', fontSize: isFirst ? 18 : 14,
        border: user.isMe ? `2px solid ${accent}66` : 'none',
        overflow: 'hidden',
      }}>
        {user.isMe && user.nickname ? user.nickname.charAt(0) : '👤'}
      </div>
      <div style={{
        fontSize: isFirst ? 13 : 12, fontWeight: user.isMe ? 700 : 500,
        color: user.isMe ? 'var(--text-primary)' : 'var(--text-secondary)', marginBottom: 2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {user.nickname}
        {user.isMe && <span style={{ fontSize: 9, color: accent, marginLeft: 3 }}>나</span>}
      </div>
      <div style={{
        fontSize: isFirst ? 22 : 18, fontWeight: 700,
        color: isFirst ? '#F0B870' : (user.isMe ? accent : 'var(--text-primary)'),
      }}>{user.score}</div>
      <ChangeIndicator change={user.change} />
    </div>
  );
}

function ChangeIndicator({ change }) {
  if (change > 0) return <span style={{ fontSize: 10, color: '#34d399' }}>▲{change}</span>;
  if (change < 0) return <span style={{ fontSize: 10, color: '#f87171' }}>▼{Math.abs(change)}</span>;
  return <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>-</span>;
}

// ===== Title Selection Sheet =====
function TitleSelectionSheet({ currentLevel, totalXP, activeTheme, selectedTitleLevel, onSelect, onClose }) {
  const currentRef = useRef(null);
  const earnedCount = LEVEL_TITLES.filter(t => currentLevel >= t.level).length;

  useEffect(() => {
    const timer = setTimeout(() => {
      currentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      {/* Overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'var(--bg-modal-overlay)', backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
        animation: 'fadeIn 0.2s ease-out',
      }} />

      {/* Sheet */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', maxHeight: '75vh',
          borderRadius: '28px 28px 0 0',
          background: 'var(--modal-bg)', backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
          border: '1px solid var(--border-light)', borderBottom: 'none',
          display: 'flex', flexDirection: 'column',
          animation: 'brFadeInUp 0.3s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '8px 24px 14px', borderBottom: '1px solid var(--border-separator)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>칭호 선택</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>달성한 칭호 중 프로필에 표시할 칭호를 선택하세요</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: activeTheme.accent, fontFamily: "var(--font-display)" }}>
              {earnedCount}/{LEVEL_TITLES.length}
            </div>
          </div>
        </div>

        {/* Title list */}
        <div className="br-hide-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 24px 30px' }}>
          {LEVEL_TITLES.map((title) => {
            const earned = currentLevel >= title.level;
            const isSelected = selectedTitleLevel === title.level;

            return (
              <div
                key={title.level}
                ref={isSelected ? currentRef : null}
                onClick={() => earned && onSelect(title.level)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', marginBottom: 3, borderRadius: 14,
                  background: isSelected ? `${activeTheme.accent}10` : 'rgba(255,255,255,0.02)',
                  border: isSelected ? `1px solid ${activeTheme.accent}30` : '1px solid rgba(255,255,255,0.03)',
                  cursor: earned ? 'pointer' : 'default',
                  opacity: earned ? 1 : 0.35,
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Level badge */}
                <div style={{
                  width: 24, height: 24, borderRadius: 7, flexShrink: 0,
                  background: isSelected ? `linear-gradient(135deg, ${activeTheme.accent}, ${activeTheme.sub})` : 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: isSelected ? '#000' : 'var(--text-muted)',
                  fontFamily: "var(--font-display)",
                }}>{title.level}</div>

                {/* Icon */}
                <span style={{ fontSize: 18, filter: earned ? 'none' : 'grayscale(1) brightness(0.3)' }}>{title.icon}</span>

                {/* Name */}
                <div style={{ flex: 1 }}>
                  <span style={{
                    fontSize: 13, fontWeight: isSelected ? 700 : 500,
                    color: earned ? 'var(--text-primary)' : 'var(--text-dim)',
                  }}>{title.title}</span>
                </div>

                {/* Status */}
                {isSelected && (
                  <div style={{
                    fontSize: 8, fontWeight: 700, color: activeTheme.accent,
                    background: `${activeTheme.accent}15`, padding: '3px 8px', borderRadius: 6,
                  }}>사용 중</div>
                )}
                {earned && !isSelected && (
                  <span style={{ fontSize: 10, color: '#34d399' }}>✓</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ===== Badge Collection Modal =====
function BadgeCollectionModal({ allBadges, onShare, onClose, accent = '#81E4BD' }) {
  const [modalCat, setModalCat] = useState('all');
  const [detailBadge, setDetailBadge] = useState(null);

  const catEntries = Object.entries(allBadges);
  const earnedCount = catEntries.reduce((sum, [, cat]) => sum + cat.badges.filter(b => b.earned).length, 0);
  const totalCount = catEntries.reduce((sum, [, cat]) => sum + cat.badges.length, 0);

  // Build badge list based on selected category
  const badgeList = modalCat === 'all'
    ? catEntries.map(([key, cat]) => ({ key, ...cat }))
    : catEntries.filter(([key]) => key === modalCat).map(([key, cat]) => ({ key, ...cat }));

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg-modal-overlay)',
        backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
        zIndex: 1000,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-modal)', borderRadius: '24px 24px 0 0',
          border: '1px solid rgba(240,144,112,0.15)', borderBottom: 'none',
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          animation: 'brFadeInUp 0.35s ease both',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 20px 16px', borderBottom: '1px solid var(--border-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>뱃지 컬렉션</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              {earnedCount} / {totalCount} 획득
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 10, border: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)', color: 'var(--text-muted)', fontSize: 16,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Category Tabs */}
        <div className="br-hide-scroll" style={{
          display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 20px',
          borderBottom: '1px solid var(--border-separator)', flexShrink: 0,
        }}>
          <button onClick={() => { setModalCat('all'); setDetailBadge(null); }} style={{
            padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600,
            whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit',
            background: modalCat === 'all' ? `${accent}26` : 'var(--bg-card)',
            color: modalCat === 'all' ? accent : 'var(--text-dim)',
            border: modalCat === 'all' ? `1px solid ${accent}4d` : '1px solid var(--border-separator)',
          }}>전체</button>
          {catEntries.map(([key, cat]) => {
            const active = modalCat === key;
            const catEarned = cat.badges.filter(b => b.earned).length;
            return (
              <button key={key} onClick={() => { setModalCat(key); setDetailBadge(null); }} style={{
                padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit',
                background: active ? `linear-gradient(135deg, ${cat.color}20, ${cat.color}10)` : 'var(--bg-card)',
                color: active ? cat.color : 'var(--text-dim)',
                border: active ? `1px solid ${cat.color}40` : '1px solid var(--border-separator)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ display: 'inline-flex' }}><PastelIcon emoji={cat.icon} size={13} /></span>
                <span>{cat.subtitle || cat.label}</span>
                <span style={{ opacity: 0.6 }}>{catEarned}/{cat.badges.length}</span>
              </button>
            );
          })}
        </div>

        {/* Badge Grid */}
        <div className="br-hide-scroll" style={{
          overflowY: 'auto', padding: '16px 20px 20px', flex: 1,
        }}>
          {badgeList.map((cat) => (
            <div key={cat.key} style={{ marginBottom: modalCat === 'all' ? 20 : 0 }}>
              {/* Category header (only in "all" mode) */}
              {modalCat === 'all' && (
                <div style={{
                  fontSize: 12, fontWeight: 600, color: cat.color, marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ display: 'inline-flex' }}><PastelIcon emoji={cat.icon} size={13} /></span> {cat.subtitle || cat.label}
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>
                    {cat.badges.filter(b => b.earned).length}/{cat.badges.length}
                  </span>
                </div>
              )}

              {/* Grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
              }}>
                {cat.badges.map((badge) => {
                  const isDetail = detailBadge?.id === badge.id;
                  return (
                    <div
                      key={badge.id}
                      onClick={() => setDetailBadge(isDetail ? null : badge)}
                      style={{
                        padding: '12px 4px 10px', textAlign: 'center',
                        borderRadius: 16, cursor: 'pointer',
                        background: isDetail
                          ? `linear-gradient(135deg, ${cat.color}15, ${cat.color}08)`
                          : badge.earned ? 'var(--bg-card)' : 'rgba(255,255,255,0.015)',
                        border: isDetail
                          ? `1.5px solid ${cat.color}40`
                          : badge.earned ? '1px solid var(--border-light)' : '1px solid rgba(255,255,255,0.03)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {/* Icon */}
                      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 6 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 14,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 22, margin: '0 auto',
                          background: badge.earned
                            ? `linear-gradient(135deg, ${cat.color}18, ${cat.color}08)`
                            : 'rgba(255,255,255,0.02)',
                          filter: badge.earned ? 'none' : 'grayscale(1) brightness(0.35)',
                          boxShadow: 'none',
                        }}><PastelIcon emoji={badge.icon} size={22} /></div>
                        {badge.earned && (
                          <div style={{
                            position: 'absolute', bottom: -2, right: -2,
                            width: 14, height: 14, borderRadius: 5,
                            background: 'linear-gradient(135deg, #34d399, #22c55e)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1.5px solid var(--bg-modal)',
                          }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {/* Name */}
                      <div style={{
                        fontSize: 10, fontWeight: 600, lineHeight: 1.2,
                        color: badge.earned ? 'var(--text-secondary)' : '#444458',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{badge.name}</div>
                      {/* Mini progress */}
                      {!badge.earned && badge.progress > 0 && (
                        <div style={{
                          height: 3, borderRadius: 2, background: 'var(--bg-card)',
                          overflow: 'hidden', margin: '5px 4px 0',
                        }}>
                          <div style={{
                            width: `${badge.progress * 100}%`, height: '100%', borderRadius: 2,
                            background: `linear-gradient(90deg, ${cat.color}, ${cat.color}88)`,
                          }} />
                        </div>
                      )}
                      {!badge.earned && badge.progress === 0 && (
                        <div style={{ fontSize: 8, color: '#444458', marginTop: 3 }}><LockIcon size={8} /></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Detail Panel */}
          {detailBadge && (() => {
            // Find the category color for this badge
            let badgeCatColor = accent;
            for (const [, cat] of catEntries) {
              if (cat.badges.some(b => b.id === detailBadge.id)) {
                badgeCatColor = cat.color;
                break;
              }
            }
            return (
              <div style={{
                marginTop: 16, padding: 16, borderRadius: 18,
                background: 'linear-gradient(135deg, rgba(240,144,112,0.06), rgba(240,144,112,0.03))',
                border: '1px solid rgba(240,144,112,0.12)',
                animation: 'brFadeInUp 0.3s ease both',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, flexShrink: 0,
                    background: detailBadge.earned
                      ? `linear-gradient(135deg, ${badgeCatColor}18, ${badgeCatColor}08)`
                      : 'rgba(255,255,255,0.02)',
                    filter: detailBadge.earned ? 'none' : 'grayscale(1) brightness(0.35)',
                    boxShadow: 'none',
                  }}>{detailBadge.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{detailBadge.name}</span>
                      {detailBadge.earned && (
                        <span style={{
                          fontSize: 9, fontWeight: 600, color: '#34d399',
                          background: 'rgba(52,211,153,0.1)', padding: '2px 6px', borderRadius: 4,
                        }}>획득</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{detailBadge.desc}</div>
                    {detailBadge.earned && detailBadge.earnedDate && (
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                        📅 {new Date(detailBadge.earnedDate).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} 획득
                      </div>
                    )}
                    {!detailBadge.earned && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>진행률</span>
                          <span style={{ fontSize: 10, color: badgeCatColor, fontWeight: 600 }}>{detailBadge.current}/{detailBadge.target}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-card)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${(detailBadge.progress || 0) * 100}%`, height: '100%', borderRadius: 2,
                            background: `linear-gradient(90deg, ${badgeCatColor}, ${badgeCatColor}88)`,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Share button for earned */}
                {detailBadge.earned && (
                  <button
                    onClick={() => onShare(detailBadge)}
                    style={{
                      width: '100%', padding: '10px 0', borderRadius: 12, marginTop: 12,
                      background: 'var(--btn-primary-bg)',
                      border: 'none', fontSize: 13, fontWeight: 600, color: '#fff',
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >📤 공유하기</button>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ===== Badge Celebration Popup =====
export function BadgeCelebration({ badge, onClose, accent = '#81E4BD' }) {
  if (!badge) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--bg-modal-overlay)',
        backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 300, padding: 32, textAlign: 'center',
          background: 'var(--modal-bg)', borderRadius: 28,
          border: `1px solid ${accent}33`,
          animation: 'brScaleUp 0.4s ease both',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12, display: 'flex', justifyContent: 'center' }}><PastelIcon emoji={badge.icon} size={48} /></div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          🎉 새 뱃지 획득!
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: accent, marginBottom: 4 }}>
          {badge.name}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
          {badge.desc}
        </div>
        <div style={{
          display: 'inline-block', padding: '4px 14px', borderRadius: 10,
          background: 'rgba(251,191,36,0.1)', marginBottom: 20,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#F0B870' }}>+100 XP</span>
        </div>
        <br />
        <button
          onClick={onClose}
          style={{
            padding: '12px 48px', borderRadius: 16, border: 'none',
            background: 'var(--btn-primary-bg)',
            color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >확인</button>
      </div>
    </div>,
    document.body,
  );
}

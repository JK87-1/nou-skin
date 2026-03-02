import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BADGE_DATABASE, calculateLevel, getLevelTitle } from '../data/BadgeData';
import {
  getTotalXP, getLevel, getLevelProgress,
  getAllBadgesWithStatus, checkAndAwardBadges, getStats,
} from '../storage/BadgeStorage';
import { getRecords, getStreak, getLatestRecord } from '../storage/SkinStorage';
import { getProfile, getDeviceId } from '../storage/ProfileStorage';
import AuraPearl from './icons/AuraPearl';

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

// ===== Main Component =====
export default function BadgeRanking({ onNewBadge, onSettingsClick }) {
  const [tab, setTab] = useState('badges'); // 'badges' | 'ranking'
  const [selectedCat, setSelectedCat] = useState('streak');
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [toast, setToast] = useState(null);

  // Data
  const profile = getProfile();
  const records = getRecords();
  const streak = getStreak();
  const stats = getStats();
  const latestRecord = getLatestRecord();
  const totalXP = getTotalXP();
  const level = getLevel();
  const levelProgress = getLevelProgress();
  const levelTitle = getLevelTitle(level);
  const allBadges = getAllBadgesWithStatus();

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

  const handleShare = async (badge) => {
    const text = `LUA에서 "${badge.name}" 뱃지를 획득했어요! ${badge.icon} ${badge.desc}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'LUA 뱃지 획득!', text });
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
        padding: '10px 0 22px', animation: 'brFadeInUp 0.5s ease both',
        position: 'relative',
      }}>
        {/* Settings gear (top right, same height as profile) */}
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            style={{
              position: 'absolute', top: 10, right: 0, zIndex: 2,
              width: 28, height: 28, borderRadius: 9,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8888a0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
        )}

        {/* Avatar + Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {/* AuraPearl background */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 0, opacity: 0.6, pointerEvents: 'none',
            }}>
              <AuraPearl variant="eternal" size={64} animated />
            </div>
            <div style={{
              width: 100, height: 100, borderRadius: 30,
              border: '2.5px solid rgba(167,139,250,0.4)',
              background: 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative', zIndex: 1,
            }}>
              {profile.profileImage ? (
                <img src={profile.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 44 }}>👤</span>
              )}
            </div>
            {/* Level badge */}
            <div style={{
              position: 'absolute', bottom: -5, right: -5, zIndex: 2,
              width: 32, height: 32, borderRadius: 11,
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2.5px solid #0a0a0f',
              fontSize: 14, fontWeight: 800, color: '#1a1a2e',
            }}>{level}</div>
          </div>

          {/* Name + Title */}
          <div style={{ flex: 1, paddingRight: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#f0f0f5' }}>
                {profile.nickname || '사용자'}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#a78bfa',
                background: 'rgba(167,139,250,0.12)', padding: '3px 10px', borderRadius: 7,
              }}>{levelTitle}</span>
            </div>
            {/* XP Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 12, color: '#8888a0' }}>Lv.{level} → Lv.{level + 1}</span>
              <span style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>{totalXP - currentLevelXP} / {nextLevelXP - currentLevelXP} XP</span>
            </div>
            <div style={{
              height: 9, borderRadius: 5,
              background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
            }}>
              <div style={{
                width: `${levelProgress}%`, height: '100%', borderRadius: 5,
                background: 'linear-gradient(90deg, #6858a8, #9080c8, #a78bfa)',
                animation: 'brXpFill 1s ease both',
              }} />
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { icon: '🪞', value: records.length, label: '측정' },
            { icon: '🎯', value: stats.totalMissions || 0, label: '미션' },
            { icon: '🔥', value: streak.count, label: '연속' },
            { icon: '🏅', value: `${earnedCount}/${totalBadgeCount}`, label: '뱃지' },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: '16px 4px 14px', textAlign: 'center',
              background: 'rgba(255,255,255,0.03)', borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ fontSize: 22, marginBottom: 5 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f5', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#555568', marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 3,
        border: '1px solid rgba(255,255,255,0.05)', marginBottom: 20,
        display: 'flex', animation: 'brFadeInUp 0.5s ease 0.1s both',
      }}>
        {[
          { key: 'badges', label: '🏅 뱃지 컬렉션' },
          { key: 'ranking', label: '👑 주간 랭킹' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: 10, borderRadius: 11, fontSize: 13, fontWeight: 600,
            border: tab === t.key ? '1px solid rgba(167,139,250,0.2)' : '1px solid transparent',
            background: tab === t.key ? 'rgba(167,139,250,0.15)' : 'transparent',
            color: tab === t.key ? '#a78bfa' : '#555568',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.25s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Badge Collection Tab ── */}
      {tab === 'badges' && (
        <div>
          {/* Category Filter */}
          <div className="br-hide-scroll" style={{
            display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12,
            animation: 'brFadeInUp 0.5s ease 0.15s both',
          }}>
            {catEntries.map(([key, cat]) => {
              const active = selectedCat === key;
              const catEarned = cat.badges.filter(b => b.earned).length;
              return (
                <button key={key} onClick={() => { setSelectedCat(key); setSelectedBadge(null); }} style={{
                  padding: '8px 14px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  whiteSpace: 'nowrap', flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit',
                  background: active
                    ? `linear-gradient(135deg, ${cat.color}20, ${cat.color}10)`
                    : 'rgba(255,255,255,0.03)',
                  color: active ? cat.color : '#555568',
                  border: active ? `1px solid ${cat.color}40` : '1px solid rgba(255,255,255,0.05)',
                  transition: 'all 0.25s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span>{cat.icon}{cat.label}</span>
                  <span style={{
                    fontSize: 10, opacity: 0.7,
                    color: active ? cat.color : '#555568',
                  }}>{catEarned}/{cat.badges.length}</span>
                </button>
              );
            })}
          </div>

          {/* Badge List */}
          <div style={{ animation: 'brFadeInUp 0.4s ease 0.2s both' }}>
            {currentCat?.badges.map((badge, bi) => {
              const isSelected = selectedBadge === badge.id;
              const color = currentCat.color;

              return (
                <div
                  key={badge.id}
                  onClick={() => setSelectedBadge(isSelected ? null : badge.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: 16, marginBottom: 8, borderRadius: 18, cursor: 'pointer',
                    background: isSelected
                      ? `${color}12`
                      : badge.earned ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
                    border: isSelected
                      ? `1px solid ${color}40`
                      : badge.earned ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.03)',
                    transition: 'all 0.25s',
                    animation: `brFadeInUp 0.4s ease-out ${bi * 0.06}s both`,
                  }}
                >
                  {/* Icon */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 26,
                      background: badge.earned
                        ? `linear-gradient(135deg, ${color}18, ${color}08)`
                        : 'rgba(255,255,255,0.02)',
                      border: badge.earned
                        ? `1px solid ${color}25`
                        : '1px solid rgba(255,255,255,0.04)',
                      filter: badge.earned ? 'none' : 'grayscale(1) brightness(0.35)',
                      animation: badge.earned ? 'brBadgeShine 3s ease infinite' : 'none',
                      boxShadow: badge.earned ? `0 0 12px ${color}25` : 'none',
                    }}>{badge.icon}</div>
                    {badge.earned && (
                      <div style={{
                        position: 'absolute', bottom: -3, right: -3,
                        width: 18, height: 18, borderRadius: 6,
                        background: 'linear-gradient(135deg, #34d399, #22c55e)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid #0a0a0f',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{
                        fontSize: 15, fontWeight: 600,
                        color: badge.earned ? '#f0f0f5' : '#555568',
                      }}>{badge.name}</span>
                      {badge.earned && (
                        <span style={{
                          fontSize: 9, fontWeight: 600, color: '#34d399',
                          background: 'rgba(52,211,153,0.1)', padding: '2px 6px', borderRadius: 4,
                        }}>획득</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#8888a0', marginBottom: 0 }}>{badge.desc}</div>

                    {/* Progress for unearned */}
                    {!badge.earned && badge.progress > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 10, color: '#555568' }}>진행률</span>
                          <span style={{ fontSize: 10, color, fontWeight: 600 }}>{badge.current}/{badge.target}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${badge.progress * 100}%`, height: '100%', borderRadius: 2,
                            background: `linear-gradient(90deg, ${color}, ${color}88)`,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Earned date */}
                    {badge.earned && badge.earnedDate && (
                      <div style={{ fontSize: 10, color: '#555568', marginTop: 4 }}>
                        📅 {new Date(badge.earnedDate).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} 획득
                      </div>
                    )}
                  </div>

                  {/* Share button for selected & earned */}
                  {isSelected && badge.earned && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleShare(badge); }}
                      style={{
                        padding: '8px 12px', borderRadius: 10,
                        background: 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
                        border: 'none', fontSize: 11, fontWeight: 600, color: '#fff',
                        cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >📤 공유</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Next Goals */}
          {nextGoals.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(167,139,250,0.03))',
              borderRadius: 18, border: '1px solid rgba(167,139,250,0.1)',
              padding: 16, marginTop: 12,
              animation: 'brFadeInUp 0.5s ease 0.3s both',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🎯</span> 다음 목표
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {nextGoals.map((g) => (
                  <div key={g.id} style={{
                    flex: 1, textAlign: 'center', padding: '12px 6px 10px',
                    background: 'rgba(255,255,255,0.03)', borderRadius: 14,
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{g.icon}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#e0e0e8', marginBottom: 4 }}>{g.name}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', marginBottom: 6 }}>
                      {Math.round(g.progress * 100)}%
                    </div>
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', margin: '0 4px' }}>
                      <div style={{
                        width: `${g.progress * 100}%`, height: '100%', borderRadius: 2,
                        background: 'linear-gradient(90deg, #6858a8, #9080c8, #a78bfa)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Ranking Tab ── */}
      {tab === 'ranking' && (
        <div>
          {/* Week label */}
          <div style={{ textAlign: 'center', marginBottom: 20, animation: 'brFadeInUp 0.5s ease 0.15s both' }}>
            <div style={{ fontSize: 12, color: '#8888a0' }}>{weekLabel || '이번 주'}</div>
            <div style={{ fontSize: 10, color: '#555568', marginTop: 2 }}>종합 점수 기준</div>
          </div>

          {/* Loading */}
          {rankLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8888a0', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 12, animation: 'brBadgeShine 1s ease infinite' }}>👑</div>
              랭킹을 불러오는 중...
            </div>
          )}

          {/* Error */}
          {rankError && !rankLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>😥</div>
              <div style={{ fontSize: 13, color: '#8888a0', marginBottom: 16 }}>랭킹을 불러올 수 없습니다</div>
              <button onClick={loadRanking} style={{
                padding: '8px 24px', borderRadius: 12, border: '1px solid rgba(167,139,250,0.3)',
                background: 'rgba(167,139,250,0.1)', color: '#a78bfa', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>다시 시도</button>
            </div>
          )}

          {/* Ranking Content */}
          {!rankLoading && !rankError && ranking.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>🏅</div>
              <div style={{ fontSize: 13, color: '#8888a0' }}>아직 랭킹 데이터가 없어요</div>
              <div style={{ fontSize: 11, color: '#555568', marginTop: 4 }}>피부 측정을 하면 랭킹에 참여할 수 있어요!</div>
            </div>
          )}

          {!rankLoading && !rankError && ranking.length > 0 && <>
          {/* Top 3 Podium */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8,
            marginBottom: 24, animation: 'brFadeInUp 0.5s ease 0.2s both',
          }}>
            {/* 2nd place */}
            {ranking.length >= 2 && <PodiumCard user={ranking[1]} medal="🥈" />}
            {/* 1st place */}
            {ranking.length >= 1 && <PodiumCard user={ranking[0]} medal="🏆" isFirst />}
            {/* 3rd place */}
            {ranking.length >= 3 && <PodiumCard user={ranking[2]} medal="🥉" />}
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
                    ? 'linear-gradient(135deg, rgba(167,139,250,0.1), rgba(167,139,250,0.05))'
                    : 'rgba(255,255,255,0.02)',
                  border: user.isMe
                    ? '1px solid rgba(167,139,250,0.25)'
                    : '1px solid rgba(255,255,255,0.04)',
                  animation: `brFadeInUp 0.4s ease-out ${(i + 3) * 0.06}s both`,
                }}
              >
                {/* Rank */}
                <div style={{
                  width: 28, height: 28, borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                  background: user.isMe
                    ? 'linear-gradient(135deg, #9080c8, #6858a8, #483090)' : 'rgba(255,255,255,0.04)',
                  color: user.isMe ? '#fff' : '#555568',
                }}>{user.rank}</div>

                {/* Name */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 14, fontWeight: user.isMe ? 700 : 500,
                      color: user.isMe ? '#f0f0f5' : '#e0e0e8',
                    }}>{user.nickname}</span>
                    {user.isMe && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: '#a78bfa',
                        background: 'rgba(167,139,250,0.12)', padding: '1px 6px', borderRadius: 4,
                      }}>나</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#555568', marginTop: 1 }}>Lv.{user.level} · {user.xp.toLocaleString()} XP</div>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: user.isMe ? '#a78bfa' : '#f0f0f5' }}>
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
              background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(167,139,250,0.04))',
              borderRadius: 20, border: '1px solid rgba(167,139,250,0.15)',
              padding: 18, marginTop: 16,
              animation: 'brFadeInUp 0.5s ease 0.4s both',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e8', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📊</span> 나의 랭킹 분석
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[
                  { value: `${myRank.rank}위`, label: '현재 순위', color: '#a78bfa' },
                  { value: myRank.change > 0 ? `▲${myRank.change}` : myRank.change < 0 ? `▼${Math.abs(myRank.change)}` : '-', label: '지난주 대비', color: myRank.change > 0 ? '#34d399' : myRank.change < 0 ? '#f87171' : '#555568' },
                  { value: `${Math.round((myRank.rank / ranking.length) * 100)}%`, label: '상위', color: '#a78bfa' },
                ].map((s, i) => (
                  <div key={i} style={{
                    flex: 1, textAlign: 'center', padding: '12px 6px',
                    background: 'rgba(255,255,255,0.03)', borderRadius: 14,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: '#8888a0', marginTop: 6 }}>{s.label}</div>
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
                    fontSize: 12, color: '#8888a0', lineHeight: 1.6,
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
          background: 'rgba(167,139,250,0.9)', color: '#fff',
          padding: '10px 24px', borderRadius: 20, fontSize: 13, fontWeight: 500,
          zIndex: 999, animation: 'brFadeInDown 0.3s ease-out both',
        }}>✅ {toast}</div>
      )}
    </div>
  );
}

// ===== Podium Card =====
function PodiumCard({ user, medal, isFirst }) {
  return (
    <div style={{
      flex: 1, maxWidth: isFirst ? 130 : 110,
      padding: isFirst ? '18px 6px 14px' : '14px 6px 12px',
      textAlign: 'center', borderRadius: 18,
      background: isFirst
        ? 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,146,36,0.04))'
        : 'rgba(255,255,255,0.03)',
      border: isFirst
        ? '1px solid rgba(251,191,36,0.2)'
        : '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: isFirst ? 28 : 22, marginBottom: 6 }}>{medal}</div>
      <div style={{
        width: isFirst ? 44 : 36, height: isFirst ? 44 : 36, borderRadius: isFirst ? 14 : 12,
        background: user.isMe ? 'linear-gradient(135deg, #9080c8, #6858a8, #483090)' : 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 6px', fontSize: isFirst ? 18 : 14,
        border: user.isMe ? '2px solid rgba(167,139,250,0.4)' : 'none',
        overflow: 'hidden',
      }}>
        {user.isMe && user.nickname ? user.nickname.charAt(0) : '👤'}
      </div>
      <div style={{
        fontSize: isFirst ? 13 : 12, fontWeight: user.isMe ? 700 : 500,
        color: user.isMe ? '#f0f0f5' : '#e0e0e8', marginBottom: 2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {user.nickname}
        {user.isMe && <span style={{ fontSize: 9, color: '#a78bfa', marginLeft: 3 }}>나</span>}
      </div>
      <div style={{
        fontSize: isFirst ? 22 : 18, fontWeight: 700,
        color: isFirst ? '#fbbf24' : (user.isMe ? '#a78bfa' : '#f0f0f5'),
      }}>{user.score}</div>
      <ChangeIndicator change={user.change} />
    </div>
  );
}

function ChangeIndicator({ change }) {
  if (change > 0) return <span style={{ fontSize: 10, color: '#34d399' }}>▲{change}</span>;
  if (change < 0) return <span style={{ fontSize: 10, color: '#f87171' }}>▼{Math.abs(change)}</span>;
  return <span style={{ fontSize: 10, color: '#555568' }}>-</span>;
}

// ===== Badge Celebration Popup =====
export function BadgeCelebration({ badge, onClose }) {
  if (!badge) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 300, padding: 32, textAlign: 'center',
          background: 'rgba(20,20,30,0.95)', borderRadius: 28,
          border: '1px solid rgba(167,139,250,0.2)',
          animation: 'brScaleUp 0.4s ease both',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>{badge.icon}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f5', marginBottom: 6 }}>
          🎉 새 뱃지 획득!
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#a78bfa', marginBottom: 4 }}>
          {badge.name}
        </div>
        <div style={{ fontSize: 13, color: '#8888a0', marginBottom: 16, lineHeight: 1.5 }}>
          {badge.desc}
        </div>
        <div style={{
          display: 'inline-block', padding: '4px 14px', borderRadius: 10,
          background: 'rgba(251,191,36,0.1)', marginBottom: 20,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24' }}>+100 XP</span>
        </div>
        <br />
        <button
          onClick={onClose}
          style={{
            padding: '12px 48px', borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
            color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >확인</button>
      </div>
    </div>,
    document.body,
  );
}

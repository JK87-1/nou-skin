/**
 * DailyMission — 오늘의 피부 미션
 * 분석 결과 기반 맞춤 미션 + 진행 추적 + 뱃지 시스템
 */
import { useState, useEffect, useCallback } from 'react';
import { getLatestRecord } from '../storage/SkinStorage';
import { getTodayMissions } from '../data/MissionData';
import {
  loadMissionProgress, saveMissionProgress, initMissionState,
  getMissionStreak, getWeeklyStatus, getTotalXP, getBadges,
} from '../storage/MissionStorage';
import { addXP as addBadgeXP, incrementStat, checkAndAwardBadges } from '../storage/BadgeStorage';
import AuraPearl from './icons/AuraPearl';

const ANIM_CSS = `
@keyframes missionFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes missionCelebrate{0%{transform:scale(1)}30%{transform:scale(1.03)}60%{transform:scale(0.97)}100%{transform:scale(1)}}
@keyframes missionCheckPop{0%{transform:scale(0)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes missionXpFloat{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-30px)}}
`;

const fadeUp = (delay = 0) => ({
  animation: `missionFadeUp 0.5s ease-out ${delay}s both`,
});

// AI 코치 코멘트 생성
function getCoachComment(streak, category) {
  const base = {
    수분부족: '오늘 수분 케어에 집중하면 피부 수분도가 빠르게 올라갈 수 있어요.',
    색소침착: '자외선 차단을 꾸준히 하면 색소 개선 효과를 볼 수 있어요.',
    다크서클: '오늘 충분히 쉬면 내일 눈가가 훨씬 밝아질 거예요.',
    트러블: '깨끗한 세안과 보습이 트러블 완화의 핵심이에요.',
    민감도: '자극을 줄이고 보습에 집중하면 피부 장벽이 회복돼요.',
    기본: '피부 상태가 좋을 때 기본 루틴을 유지하는 게 가장 중요해요!',
  };

  if (streak >= 7) return `${streak}일 연속 미션 달성 중이에요! 꾸준함이 가장 좋은 스킨케어예요. ${base[category] || base.기본}`;
  if (streak >= 3) return `${streak}일 연속 달성! 습관이 만들어지고 있어요. ${base[category] || base.기본}`;
  return base[category] || base.기본;
}

export default function DailyMission() {
  const [missions, setMissions] = useState(null);
  const [progress, setProgress] = useState(null);
  const [celebrating, setCelebrating] = useState(null); // 'main' | index | null
  const [xpFloat, setXpFloat] = useState(null);
  const [badgeTooltip, setBadgeTooltip] = useState(null);

  const latest = getLatestRecord();

  // 미션 초기화 / 로드
  useEffect(() => {
    if (!latest) return;
    const todayMissions = getTodayMissions(latest);
    if (!todayMissions) return;
    setMissions(todayMissions);

    let state = loadMissionProgress();
    if (!state) {
      state = initMissionState(todayMissions.category, todayMissions.bonus.length);
      saveMissionProgress(state);
    }
    setProgress(state);
  }, []);

  const updateProgress = useCallback((updater) => {
    setProgress(prev => {
      const next = updater(prev);
      saveMissionProgress(next);
      return next;
    });
  }, []);

  // 메인 미션 완료
  const handleMainComplete = useCallback(() => {
    if (!missions || progress?.mainCompleted) return;
    const xp = missions.main.xp;
    setCelebrating('main');
    setXpFloat(xp);
    setTimeout(() => { setCelebrating(null); setXpFloat(null); }, 1200);
    updateProgress(p => ({ ...p, mainCompleted: true, earnedXP: (p.earnedXP || 0) + xp }));
    addBadgeXP(30, '메인 미션 완료');
    incrementStat('totalMissions');
    checkAndAwardBadges();
  }, [missions, progress, updateProgress]);

  // 트래커 증가
  const handleTrackIncrement = useCallback(() => {
    if (!missions?.main.trackable || progress?.mainCompleted) return;
    updateProgress(p => {
      const next = (p.trackProgress || 0) + 1;
      if (next >= missions.main.trackTotal) {
        const xp = missions.main.xp;
        setCelebrating('main');
        setXpFloat(xp);
        setTimeout(() => { setCelebrating(null); setXpFloat(null); }, 1200);
        addBadgeXP(30, '메인 미션 완료');
        incrementStat('totalMissions');
        checkAndAwardBadges();
        return { ...p, trackProgress: next, mainCompleted: true, earnedXP: (p.earnedXP || 0) + xp };
      }
      return { ...p, trackProgress: next };
    });
  }, [missions, progress, updateProgress]);

  // 보너스 미션 완료
  const handleBonusComplete = useCallback((index) => {
    if (progress?.bonusCompleted?.[index]) return;
    const xp = missions.bonus[index]?.xp || 0;
    setCelebrating(index);
    setXpFloat(xp);
    setTimeout(() => { setCelebrating(null); setXpFloat(null); }, 800);
    updateProgress(p => {
      const bc = [...(p.bonusCompleted || [])];
      bc[index] = true;
      const next = { ...p, bonusCompleted: bc, earnedXP: (p.earnedXP || 0) + xp };
      // 올클리어 체크
      if (next.mainCompleted && bc.every(Boolean)) {
        addBadgeXP(20, '올클리어 보너스');
        incrementStat('allClearCount');
      }
      return next;
    });
    addBadgeXP(xp >= 20 ? 25 : 15, '보너스 미션 완료');
    incrementStat('totalMissions');
    checkAndAwardBadges();
  }, [missions, progress, updateProgress]);

  // 분석 데이터 없음
  if (!latest) {
    return (
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.06)', padding: '32px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🎯</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e8', marginBottom: 6 }}>오늘의 피부 미션</div>
          <div style={{ fontSize: 12, color: '#8888a0' }}>먼저 피부 측정을 해주세요.<br />분석 결과에 맞는 맞춤 미션이 생성돼요!</div>
        </div>
      </div>
    );
  }

  if (!missions || !progress) return null;

  const streak = getMissionStreak();
  const displayStreak = progress.mainCompleted ? streak + 1 : streak;
  const weeklyStatus = getWeeklyStatus();
  const badges = getBadges();
  const totalCompleted = (progress.mainCompleted ? 1 : 0) + (progress.bonusCompleted?.filter(Boolean).length || 0);
  const totalMissions = 1 + missions.bonus.length;
  const completionPct = Math.round((totalCompleted / totalMissions) * 100);
  const remainingCount = totalMissions - totalCompleted;
  const coachComment = getCoachComment(displayStreak, missions.category);

  return (
    <div style={{ padding: '0 20px', marginTop: 24 }}>
      <style>{ANIM_CSS}</style>

      {/* === 3-1. HEADER === */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, ...fadeUp(0) }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#8888a0', marginBottom: 4 }}>DAILY MISSION</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f5' }}>오늘의 피부 미션</div>
        </div>
        {displayStreak > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,146,36,0.08))',
            border: '1px solid rgba(251,191,36,0.2)', borderRadius: 20, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 6,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 50%)',
              pointerEvents: 'none',
            }} />
            <span style={{ fontSize: 16, position: 'relative' }}>🔥</span>
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Outfit,sans-serif', color: '#fbbf24', position: 'relative' }}>{displayStreak}</span>
            <span style={{ fontSize: 9, color: '#d4a017', position: 'relative' }}>일 연속</span>
          </div>
        )}
      </div>

      {/* === 3-2. WEEKLY CALENDAR === */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, ...fadeUp(0.1) }}>
        {weeklyStatus.map(day => (
          <div key={day.date} style={{
            flex: 1, textAlign: 'center', padding: '10px 0 8px', borderRadius: 14, position: 'relative',
            background: day.isToday
              ? 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(167,139,250,0.1))'
              : day.completed ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.02)',
            border: day.isToday
              ? '1px solid rgba(167,139,250,0.3)'
              : day.completed ? '1px solid rgba(52,211,153,0.15)' : '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{ fontSize: 10, color: day.isToday ? '#a78bfa' : '#666680', fontWeight: 600, marginBottom: 2 }}>{day.dayLabel}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: day.isToday ? '#f0f0f5' : day.completed ? '#34d399' : '#555570' }}>
              {new Date(day.date).getDate()}
            </div>
            {day.completed && !day.isToday && (
              <div style={{
                position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%',
                background: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: '#fff', fontWeight: 700,
              }}>✓</div>
            )}
            {day.isToday && (
              <div style={{
                width: 4, height: 4, borderRadius: '50%', background: '#818cf8',
                margin: '4px auto 0',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* === 3-3. TODAY ACHIEVEMENT === */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.06)', padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18,
        ...fadeUp(0.15),
      }}>
        {/* Progress ring */}
        <div style={{ position: 'relative', width: 50, height: 50, flexShrink: 0 }}>
          <svg width="50" height="50" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="21" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
            <circle cx="25" cy="25" r="21" fill="none"
              stroke="url(#missionGrad)" strokeWidth="4"
              strokeDasharray={`${(completionPct / 100) * 131.95} 131.95`}
              strokeLinecap="round" transform="rotate(-90 25 25)"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
            <defs>
              <linearGradient id="missionGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, fontFamily: 'Outfit,sans-serif', color: '#e0e0e8',
          }}>{completionPct}%</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f5' }}>오늘의 달성률</div>
          <div style={{ fontSize: 11, color: '#8888a0', marginTop: 2 }}>
            {totalCompleted}/{totalMissions} 미션 완료 · {progress.earnedXP || 0} XP
          </div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, borderRadius: 12, padding: '5px 10px',
          background: remainingCount === 0 ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
          color: remainingCount === 0 ? '#34d399' : '#8888a0',
          border: remainingCount === 0 ? '1px solid rgba(52,211,153,0.2)' : '1px solid rgba(255,255,255,0.06)',
        }}>
          {remainingCount === 0 ? '올클리어! 🎉' : `${remainingCount}개 남음`}
        </div>
      </div>

      {/* === 3-4. MAIN MISSION === */}
      <div style={{ marginBottom: 20, ...fadeUp(0.2) }}>
        <div style={{
          fontSize: 13, fontWeight: 700, marginBottom: 10,
          background: 'linear-gradient(90deg, #6858a8, #9080c8, #a78bfa)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>★ 오늘의 메인 미션</div>

        <div style={{
          padding: 20, borderRadius: 22, position: 'relative', overflow: 'hidden',
          background: progress.mainCompleted
            ? 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(52,211,153,0.03))'
            : 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(167,139,250,0.04))',
          border: progress.mainCompleted
            ? '1px solid rgba(52,211,153,0.2)'
            : '1px solid rgba(167,139,250,0.15)',
          animation: celebrating === 'main' ? 'missionCelebrate 0.5s ease' : undefined,
        }}>
          {/* Radial glow */}
          <div style={{
            position: 'absolute', top: -30, right: -30, width: 100, height: 100,
            background: progress.mainCompleted
              ? 'radial-gradient(circle, rgba(52,211,153,0.1), transparent)'
              : 'radial-gradient(circle, rgba(167,139,250,0.08), transparent)',
            borderRadius: '50%', pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative' }}>
            {/* Icon */}
            <div style={{
              width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: progress.mainCompleted
                ? 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.08))'
                : 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(167,139,250,0.08))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>{missions.main.icon}</div>

            <div style={{ flex: 1 }}>
              {/* Tags */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                  background: 'rgba(167,139,250,0.1)', color: '#a78bfa',
                }}>{missions.main.category}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                  background: 'rgba(251,191,36,0.1)', color: '#fbbf24',
                }}>+{missions.main.xp} XP</span>
              </div>

              {/* Title */}
              <div style={{
                fontSize: 17, fontWeight: 700, color: '#f0f0f5', marginBottom: 4,
                textDecoration: progress.mainCompleted ? 'line-through' : 'none',
                opacity: progress.mainCompleted ? 0.6 : 1,
              }}>{missions.main.title}</div>

              {/* Description */}
              <div style={{ fontSize: 12, color: '#8888a0', lineHeight: 1.5 }}>{missions.main.description}</div>
            </div>
          </div>

          {/* Trackable progress */}
          {missions.main.trackable && !progress.mainCompleted && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e0e0e8' }}>
                  {progress.trackProgress || 0} / {missions.main.trackTotal} {missions.main.trackUnit}
                </span>
                <span style={{ fontSize: 11, color: '#8888a0' }}>
                  {missions.main.trackTotal - (progress.trackProgress || 0)} {missions.main.trackUnit} 남음
                </span>
              </div>
              {/* Segmented progress bar */}
              <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
                {Array.from({ length: missions.main.trackTotal }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1, height: 6, borderRadius: 3,
                    background: i < (progress.trackProgress || 0)
                      ? 'linear-gradient(90deg, #6858a8, #9080c8, #a78bfa)'
                      : 'rgba(255,255,255,0.06)',
                    transition: 'background 0.3s ease',
                  }} />
                ))}
              </div>
              {/* Track button */}
              <button onClick={handleTrackIncrement} style={{
                width: '100%', padding: 12, border: 'none', borderRadius: 14,
                background: 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(167,139,250,0.3)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}>{missions.main.buttonText || '완료!'}</button>
            </div>
          )}

          {/* Non-trackable complete button */}
          {!missions.main.trackable && !progress.mainCompleted && (
            <button onClick={handleMainComplete} style={{
              width: '100%', padding: 12, border: 'none', borderRadius: 14, marginTop: 16,
              background: 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(167,139,250,0.3)',
            }}>미션 완료!</button>
          )}

          {/* Completed message */}
          {progress.mainCompleted && (
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 12,
              background: 'rgba(52,211,153,0.08)', textAlign: 'center',
              fontSize: 13, fontWeight: 600, color: '#34d399',
              position: 'relative', overflow: 'hidden',
            }}>
              {celebrating === 'main' && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  opacity: 0.5, pointerEvents: 'none',
                  animation: 'missionCelebrate 0.5s ease',
                }}>
                  <AuraPearl variant="cosmic" size={80} animated />
                </div>
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>🎉 메인 미션 완료! +{missions.main.xp} XP 획득</span>
            </div>
          )}

          {/* Source info */}
          {missions.sourceScore !== null && (
            <div style={{ fontSize: 10, color: '#555568', marginTop: 8, textAlign: 'right' }}>
              📊 {missions.sourceLabel} {missions.sourceScore}점 기반 추천
            </div>
          )}
        </div>
      </div>

      {/* === 3-5. BONUS MISSIONS === */}
      <div style={{ marginBottom: 20, ...fadeUp(0.3) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e8' }}>보너스 미션</span>
          <span style={{ fontSize: 11, color: '#8888a0' }}>
            {progress.bonusCompleted?.filter(Boolean).length || 0}/{missions.bonus.length} 완료
          </span>
        </div>

        {missions.bonus.map((b, i) => {
          const completed = progress.bonusCompleted?.[i];
          return (
            <div key={b.id ?? i} onClick={() => !completed && handleBonusComplete(i)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: 16, marginBottom: 8,
              borderRadius: 18, cursor: completed ? 'default' : 'pointer',
              background: completed ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)',
              border: completed ? '1px solid rgba(52,211,153,0.12)' : '1px solid rgba(255,255,255,0.05)',
              animation: celebrating === i ? 'missionCelebrate 0.5s ease' : `missionFadeUp 0.4s ease-out ${0.3 + i * 0.08}s both`,
              transition: 'background 0.2s, border-color 0.2s',
            }}>
              {/* Checkbox */}
              <div style={{
                width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: completed
                  ? 'linear-gradient(135deg, #34d399, #059669)'
                  : 'rgba(255,255,255,0.04)',
                border: completed ? 'none' : '1.5px solid rgba(255,255,255,0.12)',
                fontSize: completed ? 16 : 18,
                color: completed ? '#fff' : undefined,
                animation: completed && celebrating === i ? 'missionCheckPop 0.3s ease' : undefined,
              }}>
                {completed ? '✓' : b.icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: '#f0f0f5', marginBottom: 3,
                  textDecoration: completed ? 'line-through' : 'none',
                  opacity: completed ? 0.6 : 1,
                }}>{b.title}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 5,
                    background: 'rgba(167,139,250,0.08)', color: '#a78bfa',
                  }}>{b.category}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 5,
                    background: 'rgba(251,191,36,0.08)', color: '#fbbf24',
                  }}>+{b.xp} XP</span>
                </div>
              </div>

              {/* Right */}
              {completed ? (
                <span style={{
                  fontSize: 10, fontWeight: 600, color: '#34d399',
                  background: 'rgba(52,211,153,0.1)', padding: '3px 8px', borderRadius: 8,
                }}>완료</span>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M9 18l6-6-6-6" stroke="#555570" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* === 3-6. BADGES === */}
      <div style={{ marginBottom: 20, ...fadeUp(0.4) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e8' }}>획득한 뱃지</span>
          <span style={{ fontSize: 11, color: '#8888a0' }}>
            {badges.filter(b => b.achieved).length}/{badges.length}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {badges.map(badge => (
            <div key={badge.id}
              onClick={() => setBadgeTooltip(badgeTooltip === badge.id ? null : badge.id)}
              style={{
                flex: 1, textAlign: 'center', padding: '14px 6px 10px', borderRadius: 16,
                cursor: 'pointer', position: 'relative',
                background: badge.achieved
                  ? 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(167,139,250,0.04))'
                  : 'rgba(255,255,255,0.02)',
                border: badge.achieved
                  ? '1px solid rgba(167,139,250,0.15)'
                  : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{
                fontSize: 24, marginBottom: 4,
                filter: badge.achieved ? 'none' : 'grayscale(1) brightness(0.4)',
              }}>{badge.icon}</div>
              <div style={{
                fontSize: 10, fontWeight: 600, lineHeight: 1.3,
                color: badge.achieved ? '#e0e0e8' : '#555570',
              }}>{badge.name}</div>

              {/* Progress bar for unachieved */}
              {!badge.achieved && (
                <div style={{
                  height: 3, borderRadius: 2, marginTop: 6,
                  background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${badge.progress * 100}%`,
                    background: 'linear-gradient(90deg, #6858a8, #9080c8, #a78bfa)',
                  }} />
                </div>
              )}

              {/* Tooltip */}
              {badgeTooltip === badge.id && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(20,20,35,0.95)', borderRadius: 10, padding: '8px 12px',
                  fontSize: 10, color: '#e0e0e8', whiteSpace: 'nowrap', marginBottom: 6,
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 10,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{badge.description}</div>
                  <div style={{ color: '#8888a0' }}>{badge.current}/{badge.target}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* === 3-7. AI SKIN COACH === */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(167,139,250,0.06), rgba(167,139,250,0.03))',
        borderRadius: 18, border: '1px solid rgba(167,139,250,0.1)', padding: 16,
        ...fadeUp(0.5),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>✨</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa' }}>AI 피부 코치</span>
        </div>
        <div style={{ fontSize: 13, color: '#e0e0e8', lineHeight: 1.6 }}>{coachComment}</div>
      </div>

      {/* XP float animation */}
      {xpFloat && (
        <div style={{
          position: 'fixed', top: '40%', left: '50%', transform: 'translateX(-50%)',
          fontSize: 20, fontWeight: 800, color: '#fbbf24', fontFamily: 'Outfit,sans-serif',
          animation: 'missionXpFloat 1.2s ease-out forwards', pointerEvents: 'none', zIndex: 999,
          textShadow: '0 2px 10px rgba(251,191,36,0.5)',
        }}>+{xpFloat} XP</div>
      )}
    </div>
  );
}

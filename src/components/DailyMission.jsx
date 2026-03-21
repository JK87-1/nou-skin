/**
 * DailyMission — 오늘의 피부 미션
 * 분석 결과 기반 맞춤 미션 + 진행 추적 + 뱃지 시스템
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getLatestRecord } from '../storage/SkinStorage';
import { getTodayMissions } from '../data/MissionData';
import {
  loadMissionProgress, saveMissionProgress, initMissionState,
  getMissionStreak, getWeeklyStatus, getTotalXP, getBadges,
} from '../storage/MissionStorage';
import { addXP as addBadgeXP, incrementStat, checkAndAwardBadges } from '../storage/BadgeStorage';
import SoftCloverIcon from './icons/SoftCloverIcon';
import { TargetIcon, SparkleIcon, CheckIcon, PastelIcon } from './icons/PastelIcons';

const ANIM_CSS = `
@keyframes missionFadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes missionCelebrate{0%{transform:scale(1)}30%{transform:scale(1.03)}60%{transform:scale(0.97)}100%{transform:scale(1)}}
@keyframes missionCheckPop{0%{transform:scale(0)}50%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes missionXpFloat{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-30px)}}
@keyframes missionToastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
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
  const [undoToast, setUndoToast] = useState(null);
  const undoTimerRef = useRef(null);

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

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

  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

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
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ label: '메인 미션 완료!', type: 'main' });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 4000);
  }, [missions, progress, updateProgress]);

  // 트래커 증가
  const handleTrackIncrement = useCallback(() => {
    if (!missions?.main.trackable || progress?.mainCompleted) return;
    const willComplete = ((progress?.trackProgress || 0) + 1) >= missions.main.trackTotal;
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
    if (willComplete) {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoToast({ label: '메인 미션 완료!', type: 'main' });
      undoTimerRef.current = setTimeout(() => setUndoToast(null), 4000);
    }
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
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ label: '보너스 미션 완료!', type: 'bonus', index });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 4000);
  }, [missions, progress, updateProgress]);

  // 메인 미션 되돌리기
  const handleUndoMain = useCallback(() => {
    if (!progress?.mainCompleted || !missions) return;
    const xp = missions.main.xp;
    const wasAllClear = progress.mainCompleted && progress.bonusCompleted?.every(Boolean);
    updateProgress(p => {
      const next = { ...p, mainCompleted: false, earnedXP: Math.max(0, (p.earnedXP || 0) - xp) };
      if (missions.main.trackable) {
        next.trackProgress = Math.max(0, (missions.main.trackTotal || 1) - 1);
      }
      return next;
    });
    addBadgeXP(-30, '메인 미션 되돌리기');
    incrementStat('totalMissions', -1);
    if (wasAllClear) {
      addBadgeXP(-20, '올클리어 되돌리기');
      incrementStat('allClearCount', -1);
    }
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast(null);
  }, [missions, progress, updateProgress]);

  // 보너스 미션 되돌리기
  const handleUndoBonus = useCallback((index) => {
    if (!progress?.bonusCompleted?.[index] || !missions) return;
    const xp = missions.bonus[index]?.xp || 0;
    const wasAllClear = progress.mainCompleted && progress.bonusCompleted?.every(Boolean);
    updateProgress(p => {
      const bc = [...(p.bonusCompleted || [])];
      bc[index] = false;
      return { ...p, bonusCompleted: bc, earnedXP: Math.max(0, (p.earnedXP || 0) - xp) };
    });
    addBadgeXP(-(xp >= 20 ? 25 : 15), '보너스 미션 되돌리기');
    incrementStat('totalMissions', -1);
    if (wasAllClear) {
      addBadgeXP(-20, '올클리어 되돌리기');
      incrementStat('allClearCount', -1);
    }
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast(null);
  }, [missions, progress, updateProgress]);

  // 분석 데이터 없음
  if (!latest) {
    return (
      <div style={{ padding: '0 20px', marginTop: 24 }}>
        <div className={isLight ? 'card' : ''} style={{
          ...(isLight ? {
            borderRadius: 16, padding: '32px 20px', textAlign: 'center', margin: 0,
          } : {
            background: 'rgba(255,255,255,0.03)', borderRadius: 20,
            border: 'none', padding: '32px 20px',
            textAlign: 'center',
          }),
          boxShadow: 'none', border: 'none',
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}><TargetIcon size={36} /></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>오늘의 피부 미션</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>먼저 피부 측정을 해주세요.<br />분석 결과에 맞는 맞춤 미션이 생성돼요!</div>
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
          <div style={{ fontSize: 11, fontWeight: isLight ? 600 : 700, letterSpacing: isLight ? 1 : 2, color: 'var(--text-muted)', marginBottom: 4 }}>DAILY MISSION</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>오늘의 피부 미션</div>
        </div>
        {displayStreak > 0 && (
          <div style={{
            ...(isLight ? {
              background: 'rgba(249,115,22,0.08)',
              border: 'none', borderRadius: 8, padding: '6px 12px',
            } : {
              background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,146,36,0.08))',
              border: 'none', borderRadius: 20, padding: '8px 14px',
            }),
            display: 'flex', alignItems: 'center', gap: 6,
            position: 'relative', overflow: 'hidden',
          }}>
            {!isLight && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 50%)',
                pointerEvents: 'none',
              }} />
            )}
            <span style={{ fontSize: isLight ? 14 : 16, position: 'relative' }}>🔥</span>
            <span style={{
              fontSize: isLight ? 13 : 16, fontWeight: isLight ? 600 : 700,
              fontFamily: 'var(--font-display)',
              color: isLight ? '#F97316' : '#F0B870', position: 'relative',
            }}>{displayStreak}일 연속</span>
          </div>
        )}
      </div>

      {/* === 3-2. WEEKLY CALENDAR === */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, ...fadeUp(0.1) }}>
        {weeklyStatus.map(day => (
          <div key={day.date} style={{
            flex: 1, textAlign: 'center', padding: '10px 0 8px', borderRadius: 12, position: 'relative',
            ...(isLight ? {
              background: day.isToday
                ? '#FFFFFF'
                : day.completed ? 'transparent' : 'transparent',
              boxShadow: 'none',
              border: 'none',
            } : {
              background: day.isToday
                ? 'linear-gradient(135deg, rgba(240,144,112,0.15), rgba(240,144,112,0.1))'
                : day.completed ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.02)',
              border: 'none',
            }),
          }}>
            <div style={{
              fontSize: isLight ? 11 : 10,
              color: day.isToday ? (isLight ? '#8B95A1' : '#81E4BD') : 'var(--text-muted)',
              fontWeight: 600, marginBottom: 2,
            }}>{day.dayLabel}</div>
            <div style={{
              fontSize: isLight ? 15 : 13, fontWeight: 700,
              color: day.isToday
                ? (isLight ? '#81E4BD' : 'var(--text-primary)')
                : day.completed ? (isLight ? '#22C55E' : '#34d399') : (isLight ? '#191F28' : 'var(--text-dim)'),
            }}>
              {new Date(day.date).getDate()}
            </div>
            {day.completed && !day.isToday && (
              isLight ? (
                <div style={{ fontSize: 8, color: '#22C55E', marginTop: 2 }}>&#10003;</div>
              ) : (
                <div style={{
                  position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%',
                  background: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: '#fff', fontWeight: 700,
                }}>✓</div>
              )
            )}
            {day.isToday && (
              <div style={{
                width: 4, height: 4, borderRadius: '50%', background: isLight ? '#81E4BD' : '#ADEBB3',
                margin: '4px auto 0',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* === 3-3. TODAY ACHIEVEMENT === */}
      <div className={isLight ? 'card' : ''} style={{
        ...(isLight ? {
          borderRadius: 16, padding: '16px 18px',
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18,
          margin: '0 0 18px',
        } : {
          background: 'rgba(255,255,255,0.03)', borderRadius: 20,
          border: 'none', padding: '16px 18px',
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18,
        }),
        boxShadow: 'none', border: 'none',
        ...fadeUp(0.15),
      }}>
        {/* Progress ring */}
        <div style={{ position: 'relative', width: 50, height: 50, flexShrink: 0 }}>
          <svg width="50" height="50" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="22" fill="none" stroke={isLight ? '#F2F3F5' : 'var(--border-light)'} strokeWidth="4" />
            <circle cx="25" cy="25" r="22" fill="none"
              stroke={isLight ? '#81E4BD' : 'url(#missionGrad)'} strokeWidth="4"
              strokeDasharray={`${(completionPct / 100) * 138.23} 138.23`}
              strokeLinecap="round" transform="rotate(-90 25 25)"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
            {!isLight && (
              <defs>
                <linearGradient id="missionGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ADEBB3" />
                  <stop offset="100%" stopColor="#81E4BD" />
                </linearGradient>
              </defs>
            )}
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isLight ? 13 : 12, fontWeight: 700, fontFamily: 'var(--font-display)',
            color: isLight ? '#191F28' : 'var(--text-secondary)',
          }}>{completionPct}%</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: isLight ? '#8B95A1' : 'var(--text-muted)' }}>오늘의 달성률</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: isLight ? '#191F28' : 'var(--text-primary)' }}>
            {totalCompleted} / {totalMissions} 완료
          </div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, borderRadius: isLight ? 8 : 12, padding: '5px 10px',
          ...(isLight ? {
            background: remainingCount === 0 ? 'rgba(34,197,94,0.08)' : 'rgba(124,92,252,0.08)',
            color: remainingCount === 0 ? '#22C55E' : '#81E4BD',
            border: 'none',
          } : {
            background: remainingCount === 0 ? 'rgba(52,211,153,0.12)' : 'var(--bg-card)',
            color: remainingCount === 0 ? '#34d399' : 'var(--text-muted)',
            border: 'none',
          }),
        }}>
          {remainingCount === 0 ? '올클리어!' : `+${progress.earnedXP || 0} XP`}
        </div>
      </div>

      {/* === 3-4. MAIN MISSION === */}
      <div style={{ marginBottom: 20, ...fadeUp(0.2) }}>
        {!isLight && (
          <div style={{
            fontSize: 13, fontWeight: 700, marginBottom: 10,
            background: 'linear-gradient(90deg, #E87080, #81E4BD, #81E4BD)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>★ 오늘의 메인 미션</div>
        )}

        <div className={isLight ? 'card' : ''} style={{
          ...(isLight ? {
            padding: 20, borderRadius: 16, position: 'relative', overflow: 'hidden',
            borderLeft: 'none',
            margin: 0,
          } : {
            padding: 20, borderRadius: 22, position: 'relative', overflow: 'hidden',
            background: progress.mainCompleted
              ? 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(52,211,153,0.03))'
              : 'linear-gradient(135deg, rgba(240,144,112,0.08), rgba(240,144,112,0.04))',
            border: 'none',
          }),
          boxShadow: 'none', border: 'none',
          animation: celebrating === 'main' ? 'missionCelebrate 0.5s ease' : undefined,
        }}>
          {/* Radial glow (dark mode only) */}
          {!isLight && (
            <div style={{
              position: 'absolute', top: -30, right: -30, width: 100, height: 100,
              background: progress.mainCompleted
                ? 'radial-gradient(circle, rgba(52,211,153,0.1), transparent)'
                : 'radial-gradient(circle, rgba(240,144,112,0.08), transparent)',
              borderRadius: '50%', pointerEvents: 'none',
            }} />
          )}

          <div style={{ display: 'flex', gap: isLight ? 12 : 14, alignItems: 'flex-start', position: 'relative' }}>
            {/* Icon */}
            <div className={isLight ? 'sec-icon' : ''} style={{
              ...(isLight ? {
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              } : {
                width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }),
            }}><PastelIcon emoji={missions.main.icon} size={isLight ? 20 : 26} /></div>

            <div style={{ flex: 1 }}>
              {/* Tags */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: isLight ? 8 : 6,
                  background: isLight ? 'rgba(124,92,252,0.08)' : 'rgba(240,144,112,0.1)',
                  color: isLight ? '#81E4BD' : '#81E4BD',
                }}>{missions.main.category}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: isLight ? 8 : 6,
                  background: isLight ? '#F2F3F5' : 'rgba(251,191,36,0.1)',
                  color: isLight ? '#4E5968' : '#F0B870',
                }}>+{missions.main.xp} XP</span>
              </div>

              {/* Title */}
              <div style={{
                fontSize: isLight ? 16 : 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4,
                textDecoration: progress.mainCompleted ? 'line-through' : 'none',
                opacity: progress.mainCompleted ? 0.6 : 1,
              }}>{missions.main.title}</div>

              {/* Description */}
              <div style={{ fontSize: isLight ? 13 : 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{missions.main.description}</div>
            </div>
          </div>

          {/* Trackable progress */}
          {missions.main.trackable && !progress.mainCompleted && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Progress track */}
                <div style={{
                  flex: 1, height: 6, borderRadius: 3,
                  background: isLight ? '#F2F3F5' : 'var(--bg-card-hover)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${((progress.trackProgress || 0) / missions.main.trackTotal) * 100}%`,
                    background: isLight ? 'linear-gradient(90deg, #81E4BD, #81E4BD)' : 'linear-gradient(90deg, #E87080, #81E4BD, #81E4BD)',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                {/* Count label */}
                <span style={{ fontSize: 13, fontWeight: 600, color: isLight ? '#191F28' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {progress.trackProgress || 0}/{missions.main.trackTotal}{missions.main.trackUnit}
                </span>
                {/* Track button */}
                <button onClick={handleTrackIncrement} style={{
                  padding: '6px 12px', border: '1px solid #E8E8E8',
                  borderRadius: isLight ? 8 : 14,
                  background: '#FFFFFF',
                  color: '#333', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  boxShadow: 'none',
                  whiteSpace: 'nowrap',
                }}>{missions.main.icon && <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 4 }}><PastelIcon emoji={missions.main.icon} size={14} /></span>}{(missions.main.buttonText || '완료!').replace(/[\u{1F300}-\u{1FAF8}]/gu, '').trim()}</button>
              </div>
            </div>
          )}

          {/* Non-trackable complete button */}
          {!missions.main.trackable && !progress.mainCompleted && (
            <button onClick={handleMainComplete} style={{
              width: '100%', padding: 12, border: 'none', borderRadius: 14, marginTop: 16,
              background: 'var(--btn-primary-bg)',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: 'none',
            }}>미션 완료!</button>
          )}

          {/* Completed message */}
          {progress.mainCompleted && (
            <div style={{
              marginTop: 14, padding: '10px 14px', borderRadius: 12,
              background: 'rgba(52,211,153,0.08)',
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
                  <SoftCloverIcon theme="champagneGold" size={80} animate />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
                <span>🎉 메인 미션 완료! +{missions.main.xp} XP 획득</span>
                <button onClick={(e) => { e.stopPropagation(); handleUndoMain(); }} style={{
                  background: 'var(--bg-input)', border: 'none',
                  borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                  color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>되돌리기</button>
              </div>
            </div>
          )}

          {/* Source info */}
          {missions.sourceScore !== null && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8, textAlign: 'right' }}>
              📊 {missions.sourceLabel} {missions.sourceScore}점 기반 추천
            </div>
          )}
        </div>
      </div>

      {/* === 3-5. BONUS MISSIONS === */}
      <div style={{ marginBottom: 20, ...fadeUp(0.3) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>보너스 미션</span>
          <span style={{ fontSize: isLight ? 12 : 11, color: 'var(--text-muted)' }}>
            {progress.bonusCompleted?.filter(Boolean).length || 0}/{missions.bonus.length} 완료
          </span>
        </div>

        {isLight ? (
          /* Light mode: single card with dividers (Toss style) */
          <div className="card" style={{ padding: 0, margin: 0, boxShadow: 'none', border: 'none' }}>
            {missions.bonus.map((b, i) => {
              const completed = progress.bonusCompleted?.[i];
              return (
                <div key={b.id ?? i}>
                  <div onClick={() => !completed && handleBonusComplete(i)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px', cursor: completed ? 'default' : 'pointer',
                    animation: celebrating === i ? 'missionCelebrate 0.5s ease' : `missionFadeUp 0.4s ease-out ${0.3 + i * 0.08}s both`,
                  }}>
                    {/* Checkbox */}
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: completed ? 'rgba(34,197,94,0.1)' : '#F2F3F5',
                      animation: completed && celebrating === i ? 'missionCheckPop 0.3s ease' : undefined,
                    }}>
                      <span style={{
                        fontSize: 14,
                        color: completed ? '#22C55E' : '#B0B8C1',
                      }}>{completed ? '\u2713' : '\u25CB'}</span>
                    </div>

                    {/* Title */}
                    <span style={{
                      flex: 1, fontSize: 14,
                      color: completed ? '#8B95A1' : '#191F28',
                      textDecoration: completed ? 'line-through' : 'none',
                    }}>{b.title}</span>

                    {/* Right: XP chip or undo or chevron */}
                    {completed ? (
                      <span style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 8,
                        background: '#F2F3F5', color: '#4E5968',
                      }}>+{b.xp} XP</span>
                    ) : (
                      <span style={{ color: '#B0B8C1', fontSize: 14 }}>{'\u203A'}</span>
                    )}
                  </div>
                  {i < missions.bonus.length - 1 && (
                    <div style={{ height: 1, background: '#F2F3F5', margin: '0 20px' }} />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Dark mode: original individual bordered items */
          missions.bonus.map((b, i) => {
            const completed = progress.bonusCompleted?.[i];
            return (
              <div key={b.id ?? i} onClick={() => !completed && handleBonusComplete(i)} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: 16, marginBottom: 8,
                borderRadius: 18, cursor: completed ? 'default' : 'pointer',
                background: completed ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)',
                border: 'none',
                animation: celebrating === i ? 'missionCelebrate 0.5s ease' : `missionFadeUp 0.4s ease-out ${0.3 + i * 0.08}s both`,
                transition: 'background 0.2s, border-color 0.2s',
              }}>
                {/* Checkbox */}
                <div style={{
                  width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: completed
                    ? 'linear-gradient(135deg, #34d399, #059669)'
                    : 'var(--bg-card)',
                  border: 'none',
                  fontSize: completed ? 16 : 18,
                  color: completed ? '#fff' : undefined,
                  animation: completed && celebrating === i ? 'missionCheckPop 0.3s ease' : undefined,
                }}>
                  {completed ? '\u2713' : <PastelIcon emoji={b.icon} size={18} />}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3,
                    textDecoration: completed ? 'line-through' : 'none',
                    opacity: completed ? 0.6 : 1,
                  }}>{b.title}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 5,
                      background: 'rgba(240,144,112,0.08)', color: '#81E4BD',
                    }}>{b.category}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 5,
                      background: 'rgba(251,191,36,0.08)', color: '#F0B870',
                    }}>+{b.xp} XP</span>
                  </div>
                </div>

                {/* Right */}
                {completed ? (
                  <button onClick={(e) => { e.stopPropagation(); handleUndoBonus(i); }} style={{
                    fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                    background: 'var(--bg-card-hover)', padding: '4px 10px', borderRadius: 8,
                    border: 'none', cursor: 'pointer',
                  }}>되돌리기</button>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* === 3-6. BADGES === */}
      {!isLight && (
        <div style={{ marginBottom: 20, ...fadeUp(0.4) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>획득한 뱃지</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
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
                    ? 'linear-gradient(135deg, rgba(240,144,112,0.08), rgba(240,144,112,0.04))'
                    : 'rgba(255,255,255,0.02)',
                  border: 'none',
                }}
              >
                <div style={{
                  fontSize: 24, marginBottom: 4,
                  filter: badge.achieved ? 'none' : 'grayscale(1) brightness(0.4)',
                }}><PastelIcon emoji={badge.icon} size={24} /></div>
                <div style={{
                  fontSize: 10, fontWeight: 600, lineHeight: 1.3,
                  color: badge.achieved ? 'var(--text-secondary)' : 'var(--text-dim)',
                }}>{badge.name}</div>

                {/* Progress bar for unachieved */}
                {!badge.achieved && (
                  <div style={{
                    height: 3, borderRadius: 2, marginTop: 6,
                    background: 'var(--bg-card-hover)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${badge.progress * 100}%`,
                      background: 'linear-gradient(90deg, #E87080, #81E4BD, #81E4BD)',
                    }} />
                  </div>
                )}

                {/* Tooltip */}
                {badgeTooltip === badge.id && (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(20,20,35,0.95)', borderRadius: 10, padding: '8px 12px',
                    fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: 6,
                    border: 'none',
                    boxShadow: 'none', zIndex: 10,
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{badge.description}</div>
                    <div style={{ color: 'var(--text-muted)' }}>{badge.current}/{badge.target}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === 3-7. AI SKIN COACH === */}
      <div className={isLight ? 'card' : ''} style={{
        ...(isLight ? {
          background: '#E0EBE7',
          borderRadius: 16, border: 'none', padding: 16, margin: 0,
          boxShadow: 'none',
        } : {
          background: '#E0EBE7',
          borderRadius: 18, border: 'none', padding: 16,
        }),
        boxShadow: 'none', border: 'none',
        ...fadeUp(0.5),
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: isLight ? 12 : 10, marginBottom: isLight ? 0 : 10 }}>
          {isLight ? (
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><SparkleIcon size={24} /></div>
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><SparkleIcon size={20} /></div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, marginBottom: isLight ? 4 : 0,
              color: isLight ? '#2EAA7B' : '#2EAA7B',
            }}>AI 피부 코치</div>
            {isLight && (
              <div style={{ fontSize: 14, color: '#4E5968', lineHeight: 1.5 }}>{coachComment}</div>
            )}
          </div>
        </div>
        {!isLight && (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{coachComment}</div>
        )}
      </div>

      {/* Undo toast */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          ...(isLight ? {
            background: '#FFFFFF', borderRadius: 12, padding: '12px 20px',
            border: 'none',
            boxShadow: 'none',
          } : {
            background: 'rgba(20,20,35,0.95)', borderRadius: 16, padding: '12px 20px',
            border: 'none',
            boxShadow: 'none',
            backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
          }),
          display: 'flex', alignItems: 'center', gap: 12,
          animation: 'missionToastIn 0.3s ease-out',
          zIndex: 1000,
        }}>
          <span style={{ fontSize: 20 }}><CheckIcon size={20} /></span>
          <span style={{ fontSize: 13, color: isLight ? '#191F28' : 'var(--text-secondary)', fontWeight: 500 }}>{undoToast.label}</span>
          <button onClick={() => {
            if (undoToast.type === 'main') handleUndoMain();
            else handleUndoBonus(undoToast.index);
          }} style={{
            ...(isLight ? {
              background: 'rgba(124,92,252,0.08)', border: 'none',
              color: '#81E4BD',
            } : {
              background: 'rgba(240,144,112,0.15)', border: 'none',
              color: '#81E4BD',
            }),
            borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}>되돌리기</button>
        </div>
      )}

      {/* XP float animation */}
      {xpFloat && (
        <div style={{
          position: 'fixed', top: '40%', left: '50%', transform: 'translateX(-50%)',
          fontSize: 20, fontWeight: 800, color: '#F0B870', fontFamily: 'var(--font-display)',
          animation: 'missionXpFloat 1.2s ease-out forwards', pointerEvents: 'none', zIndex: 999,
          textShadow: '0 2px 10px rgba(251,191,36,0.5)',
        }}>+{xpFloat} XP</div>
      )}
    </div>
  );
}

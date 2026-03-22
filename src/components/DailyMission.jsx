/**
 * DailyMission — 오늘의 피부 미션
 * 분석 결과 기반 맞춤 미션 + 진행 추적 + 뱃지 시스템
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getLatestRecord } from '../storage/SkinStorage';
import { getTodayMissions } from '../data/MissionData';
import {
  loadMissionProgress, saveMissionProgress, initMissionState,
  getWeeklyStatus, getTotalXP, getBadges,
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
function getCoachComment(category) {
  const base = {
    수분부족: '오늘 수분 케어에 집중하면 피부 수분도가 빠르게 올라갈 수 있어요.',
    색소침착: '자외선 차단을 꾸준히 하면 색소 개선 효과를 볼 수 있어요.',
    다크서클: '오늘 충분히 쉬면 내일 눈가가 훨씬 밝아질 거예요.',
    트러블: '깨끗한 세안과 보습이 트러블 완화의 핵심이에요.',
    민감도: '자극을 줄이고 보습에 집중하면 피부 장벽이 회복돼요.',
    기본: '피부 상태가 좋을 때 기본 루틴을 유지하는 게 가장 중요해요!',
  };
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
        <div style={{
          borderRadius: 'var(--card-border-radius)', padding: '32px 20px', textAlign: 'center', margin: 0,
          background: 'var(--bg-card)',
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

  const weeklyStatus = getWeeklyStatus();
  const badges = getBadges();
  const totalCompleted = (progress.mainCompleted ? 1 : 0) + (progress.bonusCompleted?.filter(Boolean).length || 0);
  const totalMissions = 1 + missions.bonus.length;
  const completionPct = Math.round((totalCompleted / totalMissions) * 100);
  const remainingCount = totalMissions - totalCompleted;
  const coachComment = getCoachComment(missions.category);

  return (
    <div style={{ padding: '0 20px', marginTop: 24 }}>
      <style>{ANIM_CSS}</style>

      {/* === 3-1. HEADER === */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, ...fadeUp(0) }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>DAILY MISSION</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>오늘의 피부 미션</div>
        </div>
      </div>

      {/* === 3-2. WEEKLY CALENDAR === */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, ...fadeUp(0.1) }}>
        {weeklyStatus.map(day => (
          <div key={day.date} style={{
            flex: 1, textAlign: 'center', padding: '10px 0 8px', borderRadius: 12, position: 'relative',
            background: day.isToday
              ? 'var(--day-today-bg)'
              : day.completed ? 'var(--day-completed-bg)' : 'var(--day-default-bg)',
            border: 'none',
          }}>
            <div style={{
              fontSize: 11,
              color: day.isToday ? 'var(--day-today-accent)' : 'var(--text-muted)',
              fontWeight: 600, marginBottom: 2,
            }}>{day.dayLabel}</div>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: day.isToday
                ? 'var(--day-today-accent)'
                : day.completed ? 'var(--accent-success)' : 'var(--text-primary)',
            }}>
              {new Date(day.date).getDate()}
            </div>
            {day.completed && !day.isToday && (
              <div style={{ fontSize: 8, color: 'var(--accent-success)', marginTop: 2 }}>&#10003;</div>
            )}
            {day.isToday && (
              <div style={{
                width: 4, height: 4, borderRadius: '50%', background: 'var(--day-today-accent)',
                margin: '4px auto 0',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* === 3-3. TODAY ACHIEVEMENT === */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 'var(--card-border-radius)',
        border: 'none', padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18,
        boxShadow: 'none',
        ...fadeUp(0.15),
      }}>
        {/* Progress ring */}
        <div style={{ position: 'relative', width: 50, height: 50, flexShrink: 0 }}>
          <svg width="50" height="50" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="22" fill="none" stroke="var(--progress-track)" strokeWidth="4" />
            <circle cx="25" cy="25" r="22" fill="none"
              stroke="var(--accent-primary)" strokeWidth="4"
              strokeDasharray={`${(completionPct / 100) * 138.23} 138.23`}
              strokeLinecap="round" transform="rotate(-90 25 25)"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)',
            color: 'var(--text-primary)',
          }}>{completionPct}%</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>오늘의 달성률</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {totalCompleted} / {totalMissions} 완료
          </div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, borderRadius: 8, padding: '5px 10px',
          background: remainingCount === 0 ? 'var(--accent-success-bg)' : 'var(--bg-card)',
          color: remainingCount === 0 ? 'var(--accent-success)' : 'var(--text-muted)',
          border: 'none',
        }}>
          {remainingCount === 0 ? '올클리어!' : `+${progress.earnedXP || 0} P`}
        </div>
      </div>

      {/* === 3-4. MAIN MISSION === */}
      <div style={{ marginBottom: 20, ...fadeUp(0.2) }}>
        <div style={{
          padding: 20, borderRadius: 'var(--card-border-radius)', position: 'relative', overflow: 'hidden',
          background: progress.mainCompleted
            ? 'var(--accent-success-bg)'
            : 'var(--context-bg)',
          boxShadow: 'none', border: 'none',
          animation: celebrating === 'main' ? 'missionCelebrate 0.5s ease' : undefined,
        }}>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative' }}>
            {/* Icon */}
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><PastelIcon emoji={missions.main.icon} size={20} /></div>

            <div style={{ flex: 1 }}>
              {/* Tags */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                  background: 'var(--context-bg)',
                  color: 'var(--accent-primary)',
                }}>{missions.main.category}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                  background: 'var(--tag-bg)',
                  color: 'var(--accent-streak)',
                }}>+{missions.main.xp} P</span>
              </div>

              {/* Title */}
              <div style={{
                fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4,
                textDecoration: progress.mainCompleted ? 'line-through' : 'none',
                opacity: progress.mainCompleted ? 0.6 : 1,
              }}>{missions.main.title}</div>

              {/* Description */}
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{missions.main.description}</div>
            </div>
          </div>

          {/* Trackable progress */}
          {missions.main.trackable && !progress.mainCompleted && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Progress track */}
                <div style={{
                  flex: 1, height: 6, borderRadius: 3,
                  background: 'var(--progress-track)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${((progress.trackProgress || 0) / missions.main.trackTotal) * 100}%`,
                    background: 'var(--progress-fill)',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                {/* Count label */}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {progress.trackProgress || 0}/{missions.main.trackTotal}{missions.main.trackUnit}
                </span>
                {/* Track button */}
                <button onClick={handleTrackIncrement} style={{
                  padding: '6px 12px', border: 'var(--item-border)',
                  borderRadius: 8,
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
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
              background: 'var(--accent-success-bg)',
              fontSize: 13, fontWeight: 600, color: 'var(--accent-success)',
              position: 'relative', overflow: 'hidden',
            }}>
              {celebrating === 'main' && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  opacity: 0.5, pointerEvents: 'none',
                  animation: 'missionCelebrate 0.5s ease',
                }}>
                  <SoftCloverIcon theme="morningLight" size={80} animate />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
                <span>🎉 메인 미션 완료! +{missions.main.xp} P 획득</span>
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
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {progress.bonusCompleted?.filter(Boolean).length || 0}/{missions.bonus.length} 완료
          </span>
        </div>

        {/* Single card with dividers (unified) */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--card-border-radius)', overflow: 'hidden', boxShadow: 'none', border: 'none' }}>
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
                    background: completed ? 'var(--accent-success-bg)' : 'var(--tag-bg)',
                    animation: completed && celebrating === i ? 'missionCheckPop 0.3s ease' : undefined,
                  }}>
                    <span style={{
                      fontSize: 14,
                      color: completed ? 'var(--accent-success)' : 'var(--text-dim)',
                    }}>{completed ? '\u2713' : '\u25CB'}</span>
                  </div>

                  {/* Title */}
                  <span style={{
                    flex: 1, fontSize: 14,
                    color: completed ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: completed ? 'line-through' : 'none',
                  }}>{b.title}</span>

                  {/* Right: XP chip or chevron */}
                  {completed ? (
                    <span style={{
                      fontSize: 10, padding: '2px 6px', borderRadius: 8,
                      background: 'var(--tag-bg)', color: 'var(--tag-color)',
                    }}>+{b.xp} P</span>
                  ) : (
                    <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>{'\u203A'}</span>
                  )}
                </div>
                {i < missions.bonus.length - 1 && (
                  <div style={{ height: 1, background: 'var(--border-separator)', margin: '0 20px' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* === 3-6. BADGES === */}
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
                  ? 'var(--context-bg)'
                  : 'var(--item-bg)',
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
                  background: 'var(--progress-track)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    width: `${badge.progress * 100}%`,
                    background: 'var(--progress-fill)',
                  }} />
                </div>
              )}

              {/* Tooltip */}
              {badgeTooltip === badge.id && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--bg-modal)', borderRadius: 10, padding: '8px 12px',
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

      {/* === 3-7. AI SKIN COACH === */}
      <div style={{
        background: '#E0EBE7',
        borderRadius: 'var(--card-border-radius)', border: 'none', padding: 16,
        boxShadow: 'none',
        ...fadeUp(0.5),
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><SparkleIcon size={24} /></div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, marginBottom: 4,
              color: '#2EAA7B',
            }}>AI 피부 코치</div>
            <div style={{ fontSize: 14, color: '#4E5968', lineHeight: 1.5 }}>{coachComment}</div>
          </div>
        </div>
      </div>

      {/* Undo toast */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-modal)', borderRadius: 12, padding: '12px 20px',
          border: 'none', boxShadow: 'none',
          backdropFilter: 'var(--card-backdrop)', WebkitBackdropFilter: 'var(--card-backdrop)',
          display: 'flex', alignItems: 'center', gap: 12,
          animation: 'missionToastIn 0.3s ease-out',
          zIndex: 1000,
        }}>
          <span style={{ fontSize: 20 }}><CheckIcon size={20} /></span>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{undoToast.label}</span>
          <button onClick={() => {
            if (undoToast.type === 'main') handleUndoMain();
            else handleUndoBonus(undoToast.index);
          }} style={{
            background: 'var(--context-bg)', border: 'none',
            color: 'var(--accent-primary)',
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
        }}>+{xpFloat} P</div>
      )}
    </div>
  );
}

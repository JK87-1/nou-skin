import { useState, useRef, useCallback } from 'react';
import { saveProfile } from '../storage/ProfileStorage';
import { saveSupplementRoutine } from '../storage/SupplementStorage';
import { GOALS, SUPPLEMENTS, GOAL_ROLE_MAP, LUA_RECOMMENDED_SETS, checkConflicts, findSynergies, autoSchedule, TIME_SLOTS, MEAL_LABELS } from '../data/SupplementData';
import { hapticLight } from '../utils/haptic';

// ===== 디자인 토큰 =====
const C = {
  primary: '#B8865C',
  light: 'rgba(184, 134, 92, 0.08)',
  bg: '#FAF1E0',
  textP: '#6B4A2A',
  textS: '#8A5A3C',
  textMuted: '#8BA6BD',
  checked: '#5E9D8A',
  morning: 'linear-gradient(180deg, #FFE5C4 0%, #FAF1E0 100%)',
  lunch: 'linear-gradient(180deg, #FFE8B0 0%, #FCF6E0 100%)',
  evening: 'linear-gradient(180deg, #D8C9B8 0%, #EAE2D5 100%)',
  bedtime: 'linear-gradient(180deg, #C9C5DC 0%, #E0DEEF 100%)',
};

const TOTAL_STEPS = 5;

// ===== Swipe down to close =====
function useSwipeDown(onClose) {
  const startY = useRef(0);
  const currentY = useRef(0);
  const dragging = useRef(false);
  const elRef = useRef(null);
  const onTouchStart = useCallback((e) => {
    const el = elRef.current;
    if (el && el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    currentY.current = 0;
    dragging.current = true;
  }, []);
  const onTouchMove = useCallback((e) => {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy < 0) { currentY.current = 0; if (elRef.current) elRef.current.style.transform = ''; return; }
    currentY.current = dy;
    if (elRef.current) elRef.current.style.transform = `translateY(${dy}px)`;
  }, []);
  const onTouchEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    if (currentY.current > 120) {
      if (elRef.current) elRef.current.style.transition = 'transform 0.25s ease';
      if (elRef.current) elRef.current.style.transform = 'translateY(100%)';
      setTimeout(() => onClose(), 200);
    } else {
      if (elRef.current) { elRef.current.style.transition = 'transform 0.2s ease'; elRef.current.style.transform = ''; }
      setTimeout(() => { if (elRef.current) elRef.current.style.transition = ''; }, 200);
    }
  }, [onClose]);
  return { elRef, onTouchStart, onTouchMove, onTouchEnd };
}

export default function SupplementOnboardingPage({ onClose, onComplete }) {
  const [step, setStep] = useState(0);
  const swipe = useSwipeDown(onClose);

  // Step 2: 목표
  const [goals, setGoals] = useState([]);

  // Step 3: 역할별 영양제 선택
  const [selectedSupps, setSelectedSupps] = useState(new Set());
  const [currentGoalIdx, setCurrentGoalIdx] = useState(0);

  // Step 4: 시간대 배치 결과
  const [schedule, setSchedule] = useState(null);

  // Step 5: 충돌 + 알림
  const [notifications, setNotifications] = useState({
    morning: '08:00', lunch: '12:30', evening: '18:30', bedtime: '22:00',
  });

  const toggleGoal = (id) => {
    setGoals(prev => {
      if (prev.includes(id)) return prev.filter(g => g !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
    hapticLight();
  };

  const toggleSupp = (id) => {
    setSelectedSupps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    hapticLight();
  };

  const applyLuaSet = (goalId) => {
    const set = LUA_RECOMMENDED_SETS[goalId] || [];
    setSelectedSupps(prev => {
      const next = new Set(prev);
      set.forEach(id => next.add(id));
      return next;
    });
    hapticLight();
  };

  const moveSupp = (id, fromTime, toTime) => {
    if (!schedule) return;
    const next = { ...schedule };
    next[fromTime] = next[fromTime].filter(s => s.id !== id);
    const supp = SUPPLEMENTS[id];
    next[toTime] = [...next[toTime], { id, meal: supp?.timing?.meal || 'after' }];
    setSchedule(next);
  };

  const handleNext = () => {
    if (step === 2 && currentGoalIdx < goals.length - 1) {
      setCurrentGoalIdx(currentGoalIdx + 1);
      return;
    }
    if (step === 2) {
      // 마지막 목표 완료 → 자동 배치 생성 후 시간배치 화면으로
      const sched = autoSchedule([...selectedSupps]);
      setSchedule(sched);
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step === 2 && currentGoalIdx > 0) {
      setCurrentGoalIdx(currentGoalIdx - 1);
      return;
    }
    if (step > 0) {
      if (step === 3) setCurrentGoalIdx(goals.length - 1);
      setStep(step - 1);
    } else {
      onClose();
    }
  };

  const handleComplete = () => {
    // 스케줄에 이름 추가
    const namedSchedule = {};
    for (const [time, items] of Object.entries(schedule)) {
      namedSchedule[time] = items.map(s => ({
        ...s,
        name: SUPPLEMENTS[s.id]?.name || s.id,
      }));
    }

    saveSupplementRoutine({
      goals,
      schedule: namedSchedule,
      notifications,
      setupCompletedAt: new Date().toISOString(),
      version: 1,
    });

    saveProfile({ supplementOnboardingDone: true, supplementGoals: goals });

    onComplete?.();
    onClose();
  };

  const canProceed = () => {
    if (step === 0) return true; // 인사 화면
    if (step === 1) return goals.length > 0;
    if (step === 2) return selectedSupps.size > 0;
    if (step === 3) return schedule && Object.values(schedule).some(s => s.length > 0);
    if (step === 4) return true;
    return true;
  };

  const conflicts = step >= 4 ? checkConflicts([...selectedSupps]) : [];
  const synergies = step >= 4 ? findSynergies([...selectedSupps]) : [];
  const totalSelected = selectedSupps.size;

  // ===== RENDER =====
  return (
    <div ref={swipe.elRef} onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd} style={{
      position: 'fixed', inset: 0, zIndex: 2003,
      background: `linear-gradient(to bottom, ${C.bg}, #fff)`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
        <div onClick={handleBack} style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent', zIndex: 1,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.textP} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: 14, fontWeight: 600, color: C.textP }}>영양제</span>
      </div>

      {/* Progress */}
      {step > 0 && (
        <div style={{ padding: '12px 24px 0' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 2,
                background: i < step ? C.primary : i === step ? C.primary : 'rgba(184,134,92,0.15)',
                opacity: i <= step ? 1 : 0.4,
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '24px 24px 140px' }}>
        {step === 0 && <Step1Intro />}
        {step === 1 && <Step2Goals goals={goals} onToggle={toggleGoal} />}
        {step === 2 && (
          <Step3Supplements
            goalId={goals[currentGoalIdx]}
            currentIdx={currentGoalIdx}
            totalGoals={goals.length}
            selectedSupps={selectedSupps}
            onToggle={toggleSupp}
            onApplySet={applyLuaSet}
          />
        )}
        {step === 3 && schedule && (
          <Step4Schedule schedule={schedule} onMove={moveSupp} />
        )}
        {step === 4 && (
          <Step5Complete
            schedule={schedule}
            conflicts={conflicts}
            synergies={synergies}
            notifications={notifications}
            totalSelected={totalSelected}
            goals={goals}
          />
        )}
      </div>

      {/* Bottom button */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '16px 24px calc(env(safe-area-inset-bottom, 0px) + 16px)',
        background: `linear-gradient(transparent, #fff 30%)`,
      }}>
        {step === 0 ? (
          <div>
            <button onClick={() => setStep(1)} style={btnPrimary()}>✨ 시작하기</button>
            <button onClick={onClose} style={btnText()}>건너뛰기</button>
          </div>
        ) : step === 4 ? (
          <button onClick={handleComplete} style={btnPrimary()}>홈으로 돌아가기</button>
        ) : step === 2 ? (
          <div>
            <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginBottom: 8 }}>
              선택한 영양제 {totalSelected}개
            </div>
            <button onClick={handleNext} disabled={!canProceed()} style={btnPrimary(!canProceed())}>
              {currentGoalIdx < goals.length - 1 ? '다음 목표 →' : '시간 배치하기 →'}
            </button>
          </div>
        ) : (
          <button onClick={handleNext} disabled={!canProceed()} style={btnPrimary(!canProceed())}>
            다음
          </button>
        )}
      </div>
    </div>
  );
}

// ===== Step 1: 인사 + 가치 제안 =====
function Step1Intro() {
  return (
    <div style={{ textAlign: 'center', paddingTop: 60 }}>
      <div style={{ fontSize: 40, marginBottom: 20 }}>💊</div>
      <div style={{ fontSize: 18, fontWeight: 500, color: '#2C4A5E', marginBottom: 16 }}>내 영양제 루틴 만들기</div>
      <div style={{ fontSize: 12, color: '#6B8499', lineHeight: 1.7 }}>
        어떤 영양제가 나에게 필요한지<br />함께 찾아볼게요
      </div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 20 }}>5분이면 충분해요</div>
    </div>
  );
}

// ===== Step 2: 목표 선택 =====
function Step2Goals({ goals, onToggle }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 500, color: '#2C4A5E', marginBottom: 4 }}>어떤 게 신경 쓰이세요?</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>최대 3개까지 선택</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {GOALS.map(g => {
          const sel = goals.includes(g.id);
          return (
            <div key={g.id} onClick={() => onToggle(g.id)} style={{
              background: sel ? C.bg : '#fff',
              border: sel ? `1.5px solid ${C.primary}` : '1.5px solid #E5E5E0',
              borderRadius: 12, padding: '14px 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              cursor: 'pointer', position: 'relative',
              transition: 'all 0.15s ease',
            }}>
              {sel && (
                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  width: 16, height: 16, borderRadius: '50%', background: C.primary,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
              <span style={{ fontSize: 22 }}>{g.icon}</span>
              <span style={{ fontSize: 11, fontWeight: sel ? 500 : 400, color: sel ? C.textP : '#2C4A5E', textAlign: 'center' }}>{g.label}</span>
            </div>
          );
        })}
      </div>

      {goals.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: C.primary, fontWeight: 500 }}>
          선택 {goals.length}/3
        </div>
      )}
    </div>
  );
}

// ===== Step 3: 역할별 영양제 선택 =====
function Step3Supplements({ goalId, currentIdx, totalGoals, selectedSupps, onToggle, onApplySet }) {
  const goal = GOALS.find(g => g.id === goalId);
  const roles = GOAL_ROLE_MAP[goalId] || [];

  return (
    <div>
      {/* 진행 표시 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        {Array.from({ length: totalGoals }, (_, i) => (
          <div key={i} style={{
            width: i === currentIdx ? 8 : 6, height: i === currentIdx ? 8 : 6,
            borderRadius: '50%', background: i <= currentIdx ? C.primary : 'rgba(184,134,92,0.2)',
            transition: 'all 0.2s',
          }} />
        ))}
        <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 4 }}>{currentIdx + 1}/{totalGoals}</span>
      </div>

      {/* 목표 카드 */}
      <div style={{
        background: C.light, padding: 12, borderRadius: 12, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>{goal?.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.textP }}>{goal?.label}</span>
      </div>

      <div style={{ fontSize: 15, fontWeight: 500, color: '#2C4A5E', marginBottom: 4 }}>필요한 영양제를 골라보세요</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>역할별로 분류했어요</div>

      {/* 역할 그룹들 */}
      {roles.map((role, ri) => (
        <div key={ri} style={{
          background: C.bg, border: `0.5px solid ${C.primary}`, borderRadius: 12,
          padding: 12, marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 12 }}>{role.emoji}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textP }}>{role.name}</span>
          </div>
          <div style={{ fontSize: 9, color: C.textS, lineHeight: 1.4, marginBottom: 8 }}>{role.description}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {role.supplements.map(suppId => {
              const supp = SUPPLEMENTS[suppId];
              if (!supp) return null;
              const sel = selectedSupps.has(suppId);
              return (
                <div key={suppId} onClick={() => onToggle(suppId)} style={{
                  background: sel ? 'rgba(184,134,92,0.12)' : '#fff',
                  borderRadius: 10, padding: '8px 10px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', transition: 'background 0.15s',
                }}>
                  {/* 체크박스 */}
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: sel ? `2px solid ${C.primary}` : '2px solid #ccc',
                    background: sel ? C.primary : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    {sel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  {/* 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, color: '#2C4A5E' }}>{supp.name}</span>
                      {supp.badges.map(b => (
                        <span key={b} style={{
                          fontSize: 8, fontWeight: 600, color: C.primary,
                          background: 'rgba(184,134,92,0.1)', padding: '1px 5px', borderRadius: 4,
                        }}>{b}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 8, color: '#6B8499', marginTop: 1 }}>{supp.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* lua 추천 세트 */}
      <div style={{
        background: 'rgba(94, 157, 138, 0.1)', borderRadius: 12, padding: '10px 12px', marginTop: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#2E6E5A' }}>💡 결정이 어려우면</div>
          <div style={{ fontSize: 9, color: '#5E9D8A' }}>베스트 조합을 적용해 드려요</div>
        </div>
        <button onClick={() => onApplySet(goalId)} style={{
          padding: '6px 12px', borderRadius: 8, border: 'none',
          background: '#5E9D8A', color: '#fff', fontSize: 10, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>추천 세트 적용</button>
      </div>
    </div>
  );
}

// ===== Step 4: 시간대 배치 =====
function Step4Schedule({ schedule, onMove }) {
  const timeOrder = ['morning', 'lunch', 'evening', 'bedtime'];

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 500, color: '#2C4A5E', marginBottom: 4 }}>복용 시간 정해드릴게요</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>조정 가능해요</div>

      {timeOrder.map(time => {
        const slot = TIME_SLOTS[time];
        const items = schedule[time] || [];
        if (items.length === 0) return null;
        return (
          <div key={time} style={{
            background: C[time] || '#fff', borderRadius: 14, padding: '14px 16px',
            marginBottom: 10, border: '0.5px solid rgba(255,255,255,0.7)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>{slot.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.textP }}>{slot.label}</span>
              <span style={{ fontSize: 10, color: C.textMuted }}>({slot.defaultTime})</span>
            </div>
            {items.map(item => {
              const supp = SUPPLEMENTS[item.id];
              if (!supp) return null;
              const mealLabel = MEAL_LABELS[item.meal] || '';
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 0', borderBottom: '0.5px solid rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: 3,
                      border: `1.5px solid ${C.primary}`, background: C.primary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <span style={{ fontSize: 11, color: '#2C4A5E' }}>{supp.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {mealLabel && <span style={{ fontSize: 9, color: C.textMuted }}>{mealLabel}</span>}
                    <select
                      value={time}
                      onChange={(e) => onMove(item.id, time, e.target.value)}
                      style={{
                        fontSize: 9, color: C.primary, background: 'transparent',
                        border: `1px solid ${C.primary}`, borderRadius: 4, padding: '2px 4px',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {timeOrder.map(t => (
                        <option key={t} value={t}>{TIME_SLOTS[t].label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 0', marginTop: 8,
      }}>
        <span style={{ fontSize: 12 }}>💡</span>
        <span style={{ fontSize: 10, color: C.textMuted }}>흡수율 + 효과 + 충돌 회피 기준으로 배치했어요</span>
      </div>
    </div>
  );
}

// ===== Step 5: 충돌 검사 + 완료 =====
function Step5Complete({ schedule, conflicts, synergies, notifications, totalSelected, goals }) {
  const timeOrder = ['morning', 'lunch', 'evening', 'bedtime'];
  const totalScheduled = timeOrder.reduce((s, t) => s + (schedule?.[t]?.length || 0), 0);

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>{conflicts.length > 0 ? '⚠️' : '✨'}</div>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#2C4A5E' }}>
          {conflicts.length > 0 ? '확인이 필요해요' : '완벽한 루틴이에요!'}
        </div>
      </div>

      {/* 충돌 경고 */}
      {conflicts.length > 0 && (
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 14, padding: '14px 16px', marginBottom: 16,
        }}>
          {conflicts.map((c, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              marginBottom: i < conflicts.length - 1 ? 8 : 0,
            }}>
              <span style={{ fontSize: 12, flexShrink: 0 }}>⚠️</span>
              <span style={{ fontSize: 11, color: '#9A7000', lineHeight: 1.5 }}>{c.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* 시너지 */}
      {synergies.length > 0 && (
        <div style={{
          background: 'rgba(94,157,138,0.08)', border: '1px solid rgba(94,157,138,0.15)',
          borderRadius: 14, padding: '14px 16px', marginBottom: 16,
        }}>
          {synergies.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              marginBottom: i < synergies.length - 1 ? 8 : 0,
            }}>
              <span style={{ fontSize: 12, flexShrink: 0 }}>✨</span>
              <span style={{ fontSize: 11, color: '#2E6E5A', lineHeight: 1.5 }}>{s.note}</span>
            </div>
          ))}
        </div>
      )}

      {/* 요약 */}
      <div style={{
        background: '#fff', borderRadius: 14, padding: '16px', marginBottom: 16,
        border: '0.5px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2C4A5E', marginBottom: 12 }}>📊 요약</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: C.primary, fontFamily: 'var(--font-display)' }}>{goals.length}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>목표</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: C.primary, fontFamily: 'var(--font-display)' }}>{totalSelected}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>영양제</div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600, color: C.primary, fontFamily: 'var(--font-display)' }}>{timeOrder.filter(t => (schedule?.[t]?.length || 0) > 0).length}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>시간대</div>
          </div>
        </div>
      </div>

      {/* 시간대별 미리보기 */}
      {timeOrder.map(time => {
        const items = schedule?.[time] || [];
        if (items.length === 0) return null;
        const slot = TIME_SLOTS[time];
        return (
          <div key={time} style={{
            background: '#fff', borderRadius: 12, padding: '12px 16px',
            marginBottom: 8, border: '0.5px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 12 }}>{slot.emoji}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.textP }}>{slot.label}</span>
              <span style={{ fontSize: 9, color: C.textMuted }}>{notifications[time]}</span>
            </div>
            <div style={{ fontSize: 10, color: '#6B8499' }}>
              {items.map(s => SUPPLEMENTS[s.id]?.name || s.id).join(', ')}
            </div>
          </div>
        );
      })}

      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: C.textMuted }}>
        내 영양제 루틴 완성! 🎉
      </div>
    </div>
  );
}

// ===== 공통 버튼 스타일 =====
function btnPrimary(disabled = false) {
  return {
    width: '100%', padding: '14px 0', borderRadius: 16, border: 'none',
    background: disabled ? '#ddd' : C.primary,
    color: disabled ? '#aaa' : '#fff',
    fontSize: 15, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit', transition: 'all 0.2s',
  };
}

function btnText() {
  return {
    width: '100%', padding: '10px 0', border: 'none', background: 'transparent',
    color: C.textMuted, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
  };
}

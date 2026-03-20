/**
 * LUA Routine Page v1.0
 *
 * 모닝/나이트 스킨케어 루틴 체크리스트
 * - 시간대 자동 감지 (오전=모닝, 오후6시 이후=나이트)
 * - AI 진단 결과 기반 맞춤 루틴
 * - 체크 상태 localStorage 저장, 매일 자정 리셋
 * - 주간 완료율 추적
 */

import { useState, useEffect } from 'react';
import { SunIcon, MoonIcon } from '../components/icons/PastelIcons';
import { getLatestRecord } from '../storage/SkinStorage';
import {
  getChecks, toggleCheck, getProgress,
  getPersonalizedSteps, getIngredientRecommendations,
  getWeeklyCompletion,
} from '../storage/RoutineStorage';

export default function RoutinePage() {
  const isEvening = new Date().getHours() >= 18;
  const [mode, setMode] = useState(isEvening ? 'night' : 'morning');
  const [checks, setChecks] = useState(getChecks());
  const [openIngredientIdx, setOpenIngredientIdx] = useState(null);

  const latestRecord = getLatestRecord();
  const steps = getPersonalizedSteps(mode, latestRecord);
  const progress = getProgress(mode);
  const ingredients = getIngredientRecommendations(latestRecord);
  const weekly = getWeeklyCompletion();

  const handleToggle = (stepId) => {
    const updated = toggleCheck(mode, stepId);
    setChecks({ ...updated });
  };

  const modeChecks = checks[mode] || {};

  // AI 맥락 메시지
  const getContextMessage = () => {
    if (!latestRecord) return '피부 진단을 하면 맞춤 루틴을 추천받을 수 있어요.';
    const concerns = latestRecord.concerns || [];
    if (concerns.length > 0) {
      return `오늘은 ${concerns[0]} 관리에 집중하는 루틴이에요. 최근 분석 결과를 바탕으로 추천했어요.`;
    }
    return '오늘의 피부 상태에 맞춘 기본 루틴이에요. 꾸준한 관리가 가장 중요해요!';
  };

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Header */}
      <div style={{ padding: '48px 28px 20px', textAlign: 'center' }}>
        <h1 style={{
          fontSize: 28, fontWeight: 300, color: '#e0e0e8',
          fontFamily: "'Pretendard Variable', -apple-system, BlinkMacSystemFont, sans-serif", fontStyle: 'italic',
          marginBottom: 4,
        }}>Daily Ritual</h1>
        <p style={{ fontSize: 13, color: '#8888a0' }}>오늘의 피부 루틴</p>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Morning/Night Toggle */}
        <div className="segment-control" style={{ marginBottom: 20 }}>
          <button
            className={`segment-btn${mode === 'morning' ? ' active' : ''}`}
            onClick={() => setMode('morning')}
          ><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><SunIcon size={16} /></span> 모닝 케어</button>
          <button
            className={`segment-btn${mode === 'night' ? ' active' : ''}`}
            onClick={() => setMode('night')}
          ><span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><MoonIcon size={16} /></span> 나이트 케어</button>
        </div>

        {/* AI Context Card */}
        <div style={{
          background: 'rgba(240,144,112,0.06)',
          border: '1px solid rgba(240,144,112,0.1)',
          borderRadius: 16, padding: '14px 16px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🤖</span>
            <p style={{ fontSize: 13, color: '#e0e0e8', lineHeight: 1.6, margin: 0 }}>
              {getContextMessage()}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e8' }}>
              오늘 진행률
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ADEBB3' }}>
              {progress.done}/{progress.total} 완료
            </span>
          </div>
          <div style={{
            height: 8, borderRadius: 4,
            background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: 'linear-gradient(90deg, #E87080, #FBEC5D, #FBEC5D)',
              width: `${(progress.done / progress.total) * 100}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Routine Checklist */}
        <div className="card" style={{ padding: '8px 16px', marginBottom: 20 }}>
          {steps.map((step) => {
            const isChecked = !!modeChecks[step.id];
            return (
              <div key={step.id} className={`routine-step${isChecked ? ' checked' : ''}`}>
                <button
                  className={`routine-checkbox${isChecked ? ' checked' : ''}`}
                  onClick={() => handleToggle(step.id)}
                >
                  {isChecked && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <div style={{ flex: 1 }}>
                  <div className="routine-step-num">STEP {step.step}</div>
                  <div className="routine-step-name">{step.name}</div>
                  <div className="routine-step-desc">{step.desc}</div>
                  <div className="routine-step-time">⏱ {step.time}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 나에게 맞는 성분 섹션 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e8' }}>나에게 맞는 성분</div>
            <div style={{ fontSize: 12, color: '#8888a0', marginTop: 2 }}>
              {latestRecord ? '피부 분석 기반 맞춤 추천' : '기본 추천 성분'}
            </div>
          </div>

          {ingredients.map((ing, idx) => {
            const isOpen = openIngredientIdx === idx;
            return (
              <div key={idx} className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
                <div
                  onClick={() => setOpenIngredientIdx(isOpen ? null : idx)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{ing.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#ADEBB3' }}>{ing.nameKo}</div>
                      <div style={{ fontSize: 11, color: '#8888a0' }}>{ing.name}</div>
                    </div>
                    {ing.score != null && (
                      <span style={{
                        flexShrink: 0, marginLeft: 'auto', marginRight: 8,
                        fontSize: 10, fontWeight: 600, color: '#ADEBB3',
                        background: 'rgba(240,144,112,0.1)', borderRadius: 20,
                        padding: '3px 8px',
                      }}>{ing.reason}</span>
                    )}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{
                    flexShrink: 0, transition: 'transform 0.3s',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>
                    <path d="M6 9l6 6 6-6" stroke="#ADEBB3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{
                  maxHeight: isOpen ? 300 : 0, overflow: 'hidden',
                  transition: 'max-height 0.3s ease, margin-top 0.3s ease',
                  marginTop: isOpen ? 12 : 0,
                }}>
                  <p style={{ fontSize: 13, color: '#e0e0e8', lineHeight: 1.7, margin: '0 0 10px' }}>{ing.desc}</p>
                  <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8,
                  }}>
                    <span style={{
                      fontSize: 11, color: '#8888a0', background: 'rgba(255,255,255,0.06)',
                      borderRadius: 8, padding: '4px 10px',
                    }}>추천 농도: {ing.concentration}</span>
                  </div>
                  <div style={{
                    background: 'rgba(240,144,112,0.06)', borderRadius: 10,
                    padding: '10px 12px', border: '1px solid rgba(240,144,112,0.08)',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#ADEBB3', marginBottom: 4 }}>사용 팁</div>
                    <p style={{ fontSize: 12, color: '#8888a0', lineHeight: 1.6, margin: 0 }}>{ing.tip}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {!latestRecord && (
            <div style={{
              textAlign: 'center', padding: '12px 0 4px',
            }}>
              <p style={{ fontSize: 12, color: '#8888a0', marginBottom: 8 }}>
                피부 진단을 하면 나에게 딱 맞는 성분을 추천받을 수 있어요!
              </p>
            </div>
          )}
        </div>

        {/* Weekly Completion Dots */}
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e8', marginBottom: 14 }}>주간 루틴 현황</div>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            {weekly.map((day) => (
              <div key={day.date} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 4,
                  background: day.completed ? '#ADEBB3'
                    : day.isToday ? 'rgba(240,144,112,0.15)'
                    : day.partial ? 'rgba(240,144,112,0.08)'
                    : 'rgba(255,255,255,0.04)',
                  border: day.isToday && !day.completed ? '2px solid #ADEBB3' : 'none',
                }}>
                  {day.completed ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : day.partial ? (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ADEBB3' }} />
                  ) : null}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: day.isToday ? 600 : 400,
                  color: day.isToday ? '#ADEBB3' : '#8888a0',
                }}>{day.dayLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

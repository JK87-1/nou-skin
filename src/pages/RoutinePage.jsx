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
  getChecksForDate, toggleCheckForDate, getProgressForDate,
  getPersonalizedSteps, getIngredientRecommendations,
  getWeeklyCompletion,
} from '../storage/RoutineStorage';
import WeekDateHeader from '../components/WeekDateHeader';

function getDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function RoutinePage() {
  const isEvening = new Date().getHours() >= 18;
  const [mode, setMode] = useState(isEvening ? 'night' : 'morning');
  const todayKey = getDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [checks, setChecks] = useState(() => getChecksForDate(selectedDate));
  const [headerTitle, setHeaderTitle] = useState('');
  const [openIngredientIdx, setOpenIngredientIdx] = useState(null);

  const latestRecord = getLatestRecord();
  const steps = getPersonalizedSteps(mode, latestRecord);
  const progress = getProgressForDate(selectedDate, mode);
  const ingredients = getIngredientRecommendations(latestRecord);
  const weekly = getWeeklyCompletion();

  const handleSelectDate = (dateKey) => {
    setSelectedDate(dateKey);
    setChecks(getChecksForDate(dateKey));
  };

  const handleToggle = (stepId) => {
    const updated = toggleCheckForDate(selectedDate, mode, stepId);
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
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)', fontFamily: 'Pretendard, sans-serif' }}>{headerTitle}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Weekly Date Header */}
      <WeekDateHeader
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        weeklyData={weekly}
        hideTitle
        onTitleChange={setHeaderTitle}
      />

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
          background: 'var(--context-bg)',
          border: 'var(--context-border)',
          borderRadius: 16, padding: '14px 16px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🤖</span>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {getContextMessage()}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {selectedDate === todayKey ? '오늘' : `${new Date(selectedDate).getMonth() + 1}/${new Date(selectedDate).getDate()}`} 진행률
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ingredient-accent)' }}>
              {progress.done}/{progress.total} 완료
            </span>
          </div>
          <div style={{
            height: 8, borderRadius: 4,
            background: 'var(--progress-track)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: 'var(--progress-fill)',
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
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>나에게 맞는 성분</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
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
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ingredient-accent)' }}>{ing.nameKo}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ing.name}</div>
                    </div>
                    {ing.score != null && (
                      <span style={{
                        flexShrink: 0, marginLeft: 'auto', marginRight: 8,
                        fontSize: 10, fontWeight: 600, color: 'var(--ingredient-accent)',
                        background: 'var(--context-bg)', borderRadius: 20,
                        padding: '3px 8px',
                      }}>{ing.reason}</span>
                    )}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{
                    flexShrink: 0, transition: 'transform 0.3s',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>
                    <path d="M6 9l6 6 6-6" stroke="var(--ingredient-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{
                  maxHeight: isOpen ? 300 : 0, overflow: 'hidden',
                  transition: 'max-height 0.3s ease, margin-top 0.3s ease',
                  marginTop: isOpen ? 12 : 0,
                }}>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 10px' }}>{ing.desc}</p>
                  <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8,
                  }}>
                    <span style={{
                      fontSize: 11, color: 'var(--text-muted)', background: 'var(--tag-bg)',
                      borderRadius: 8, padding: '4px 10px',
                    }}>추천 농도: {ing.concentration}</span>
                  </div>
                  <div style={{
                    background: 'var(--context-bg)', borderRadius: 10,
                    padding: '10px 12px', border: 'var(--context-border)',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ingredient-accent)', marginBottom: 4 }}>사용 팁</div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{ing.tip}</p>
                  </div>
                </div>
              </div>
            );
          })}

          {!latestRecord && (
            <div style={{
              textAlign: 'center', padding: '12px 0 4px',
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                피부 진단을 하면 나에게 딱 맞는 성분을 추천받을 수 있어요!
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

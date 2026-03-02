import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  getProfile, saveProfile,
  SKIN_TYPES, SKIN_CONCERNS, SENSITIVITY_OPTIONS, GENDER_OPTIONS,
} from '../storage/ProfileStorage';
import { getRecords, getStreak, getTotalChanges } from '../storage/SkinStorage';
import { clearBaseline, hasBaseline } from '../engine/HybridAnalysis';
import {
  isPushSupported, isStandalone, isIOS, getPermissionState,
  subscribeToPush, saveSubscriptionToServer,
  unsubscribeFromPush, updateReminderTime,
  updateTipSettings, syncSkinDataToServer,
} from '../utils/pushNotification';
import { getLatestRecord } from '../storage/SkinStorage';
import { getGoal, saveGoal, clearGoal, getDaysRemaining, getGoalProgress, getOverallProgress, METRIC_META } from '../storage/GoalStorage';
import BadgeRanking from '../components/BadgeRanking';

export default function MyPage() {
  const [profile, setProfile] = useState(getProfile);
  const [toast, setToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('저장되었습니다');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  };

  const update = (key, value) => {
    const next = saveProfile({ [key]: value });
    setProfile(next);
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ padding: '0 24px 0' }}>

        {/* Badge & Ranking UI (gear icon inside profile header) */}
        <BadgeRanking onSettingsClick={() => setSettingsOpen(true)} />

        {/* App Info */}
        <div style={{
          textAlign: 'center', padding: '12px 0 0',
          animation: 'breatheIn 0.8s ease 0.55s both',
        }}>
          <div style={{ fontSize: 11, color: '#8888a0', fontWeight: 300, marginBottom: 4 }}>LUA Beta v1.0.2</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, color: '#8888a0', fontWeight: 300, cursor: 'pointer' }}>이용약관</span>
            <span style={{ fontSize: 11, color: '#8888a0', fontWeight: 300, cursor: 'pointer' }}>개인정보처리방침</span>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && createPortal(
        <SettingsModal
          profile={profile}
          update={update}
          onClose={() => setSettingsOpen(false)}
          showToast={showToast}
        />,
        document.body,
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(167,139,250,0.9)', color: '#fff', padding: '10px 24px',
          borderRadius: 20, fontSize: 13, fontWeight: 500, zIndex: 999,
          animation: 'fadeIn 0.2s ease',
        }}>{toastMsg}</div>
      )}
    </div>
  );
}

// ===== Settings Modal =====

function SettingsModal({ profile, update, onClose, showToast }) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingSkin, setEditingSkin] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [baselineExists, setBaselineExists] = useState(() => hasBaseline());
  const [importMode, setImportMode] = useState(false);
  const [importCode, setImportCode] = useState('');

  const currentYear = new Date().getFullYear();
  const age = profile.birthYear ? currentYear - parseInt(profile.birthYear) : null;

  const toggleConcern = (c) => {
    const list = profile.skinConcerns.includes(c)
      ? profile.skinConcerns.filter(x => x !== c)
      : [...profile.skinConcerns, c];
    update('skinConcerns', list);
  };

  const skinTypeEmoji = {
    '건성': '💧', '지성': '🫧', '복합성': '🫧', '중성': '✨', '민감성': '🌸',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430,
          maxHeight: '90vh', overflowY: 'auto',
          background: '#1a1a28', borderRadius: '24px 24px 0 0',
          padding: '24px 24px 40px',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          animation: 'slideUp 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f5' }}>설정</div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.08)', color: '#8888a0',
            fontSize: 16, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Profile Edit */}
        <SettingsSection label="프로필">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 20px', cursor: 'pointer',
          }} onClick={() => setEditingProfile(!editingProfile)}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, flexShrink: 0,
              background: 'rgba(167,139,250,0.08)',
            }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#e0e0e8' }}>프로필 편집</div>
              <div style={{ fontSize: 11, color: '#8888a0', fontWeight: 300, marginTop: 2 }}>
                {profile.nickname || '사용자'} · {age ? `만 ${age}세` : '나이 미설정'}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555570" strokeWidth="1.5" strokeLinecap="round"
              style={{ transform: editingProfile ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>

          {editingProfile && (
            <div style={{ padding: '0 20px 16px', animation: 'breatheIn 0.3s ease both' }}>
              <Section label="닉네임">
                <input
                  type="text"
                  value={profile.nickname}
                  onChange={(e) => update('nickname', e.target.value)}
                  placeholder="닉네임을 입력하세요"
                  maxLength={20}
                  style={inputStyle}
                />
              </Section>
              <Section label="출생연도">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="number"
                    value={profile.birthYear}
                    onChange={(e) => update('birthYear', e.target.value)}
                    placeholder="예: 1995"
                    min={1940} max={currentYear}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {age !== null && age > 0 && (
                    <span style={{ fontSize: 13, color: '#818cf8', fontWeight: 600, whiteSpace: 'nowrap' }}>만 {age}세</span>
                  )}
                </div>
              </Section>
              <Section label="성별">
                <ChipGroup
                  options={GENDER_OPTIONS}
                  selected={profile.gender}
                  onSelect={(v) => update('gender', v)}
                />
              </Section>
            </div>
          )}

          {/* Skin type */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 20px', cursor: 'pointer',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }} onClick={() => setEditingSkin(!editingSkin)}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, flexShrink: 0,
              background: 'rgba(167,139,250,0.08)',
            }}>{skinTypeEmoji[profile.skinType] || '🧬'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#e0e0e8' }}>피부 타입</div>
              <div style={{ fontSize: 11, color: '#8888a0', fontWeight: 300, marginTop: 2 }}>
                {profile.skinType || '미설정'}{profile.sensitivity ? ` · ${profile.sensitivity}` : ''}
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555570" strokeWidth="1.5" strokeLinecap="round"
              style={{ transform: editingSkin ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>

          {editingSkin && (
            <div style={{ padding: '0 20px 16px', animation: 'breatheIn 0.3s ease both' }}>
              <Section label="피부 타입">
                <ChipGroup
                  options={SKIN_TYPES}
                  selected={profile.skinType}
                  onSelect={(v) => update('skinType', v)}
                />
              </Section>
              <Section label="민감도">
                <ChipGroup
                  options={SENSITIVITY_OPTIONS}
                  selected={profile.sensitivity}
                  onSelect={(v) => update('sensitivity', v)}
                />
              </Section>
              <Section label="피부 고민">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SKIN_CONCERNS.map((c) => {
                    const active = profile.skinConcerns.includes(c);
                    return (
                      <div
                        key={c}
                        onClick={() => toggleConcern(c)}
                        style={{
                          padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 400,
                          cursor: 'pointer', transition: 'all 0.2s',
                          background: active ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.04)',
                          color: active ? '#818cf8' : '#8888a0',
                          border: active ? '1px solid rgba(167,139,250,0.2)' : '1px solid rgba(255,255,255,0.06)',
                        }}
                      >{c}</div>
                    );
                  })}
                </div>
              </Section>
            </div>
          )}
        </SettingsSection>

        {/* 관리 */}
        <SettingsSection label="관리">
          <ReminderItem
            enabled={profile.reminderEnabled}
            time={profile.reminderTime || '08:00'}
            onToggle={(v) => update('reminderEnabled', v)}
            onTimeChange={(v) => update('reminderTime', v)}
            profile={profile}
            tipEnabled={profile.tipEnabled}
            showToast={showToast}
          />
          <BeautyTipItem
            enabled={profile.tipEnabled}
            time={profile.tipTime || '20:00'}
            onToggle={(v) => update('tipEnabled', v)}
            onTimeChange={(v) => update('tipTime', v)}
            profile={profile}
            reminderEnabled={profile.reminderEnabled}
            showToast={showToast}
          />
          <div
            onClick={() => {
              if (!baselineExists) return;
              if (confirm('기준 측정을 초기화하면 다음 분석이 새로운 기준이 됩니다. 초기화할까요?')) {
                clearBaseline();
                setBaselineExists(false);
                showToast('기준 측정이 초기화되었습니다');
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 20px', cursor: baselineExists ? 'pointer' : 'default',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              opacity: baselineExists ? 1 : 0.45,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, flexShrink: 0,
              background: 'rgba(167,139,250,0.08)',
            }}>📷</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#e0e0e8' }}>기준 측정 초기화</div>
              <div style={{ fontSize: 11, color: '#8888a0', fontWeight: 300, marginTop: 2 }}>
                {baselineExists ? '다음 분석이 새 기준이 됩니다' : '기준 사진 없음 (첫 분석 시 자동 저장)'}
              </div>
            </div>
            {baselineExists && (
              <span style={{
                padding: '4px 12px', borderRadius: 10, fontSize: 11, fontWeight: 500,
                background: 'rgba(240,96,80,0.08)', color: '#e05545',
              }}>초기화</span>
            )}
          </div>
          <SettingsMenuItem icon="📊" label="피부 리포트" desc="월간 분석 리포트 받기" right="badge-new" onTap={() => showToast('피부 리포트는 준비 중이에요')} />
          <SettingsMenuItem icon="🎯" label="피부 목표 설정" desc={(() => {
            const g = getGoal();
            if (!g || g.status === 'expired') return '나만의 피부 점수 목표 세우기';
            if (g.status === 'completed') return '목표 달성 완료!';
            const d = getDaysRemaining();
            return `D-${d} 진행 중 · ${getOverallProgress()}%`;
          })()} right="arrow" onTap={() => setGoalModalOpen(true)} />
        </SettingsSection>

        {/* 데이터 */}
        <SettingsSection label="데이터">
          <div
            onClick={async () => {
              try {
                const data = {};
                for (let i = 0; i < localStorage.length; i++) {
                  const key = localStorage.key(i);
                  if (key && key.startsWith('nou_')) {
                    data[key] = localStorage.getItem(key);
                  }
                }
                const json = JSON.stringify(data);
                const encoded = btoa(unescape(encodeURIComponent(json)));
                await navigator.clipboard.writeText(encoded);
                showToast('데이터가 클립보드에 복사되었습니다');
              } catch {
                showToast('복사 실패 — 수동으로 시도해주세요');
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 20px', cursor: 'pointer',
              borderTop: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, flexShrink: 0,
              background: 'rgba(167,139,250,0.08)',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#e0e0e8' }}>데이터 내보내기</div>
              <div style={{ fontSize: 11, color: '#8888a0', fontWeight: 300, marginTop: 2 }}>클립보드에 복사 (앱 설치 전 백업)</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555570" strokeWidth="1.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          <div
            onClick={() => setImportMode(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 20px', cursor: 'pointer',
              borderTop: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, flexShrink: 0,
              background: 'rgba(167,139,250,0.08)',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 400, color: '#e0e0e8' }}>데이터 가져오기</div>
              <div style={{ fontSize: 11, color: '#8888a0', fontWeight: 300, marginTop: 2 }}>Safari 기록을 앱으로 복원</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555570" strokeWidth="1.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </SettingsSection>

        {/* 설정 */}
        <SettingsSection label="설정">
          <DarkModeItem enabled={darkMode} onToggle={(v) => {
            if (!v) { showToast('현재 다크모드만 지원돼요'); return; }
            setDarkMode(v);
          }} />
          <SettingsMenuItem icon="🌐" label="언어" desc="한국어" right="arrow" onTap={() => showToast('현재 한국어만 지원돼요')} />
          <SettingsMenuItem icon="🔒" label="개인정보 관리" right="arrow" onTap={() => showToast('모든 데이터는 기기에만 저장돼요')} />
        </SettingsSection>

        {/* 지원 */}
        <SettingsSection label="지원">
          <SettingsMenuItem icon="💬" label="피드백 보내기" right="arrow" onTap={() => {
            const subject = encodeURIComponent('LUA 피드백');
            window.open(`mailto:luaskin.co@gmail.com?subject=${subject}`, '_blank');
          }} />
          <SettingsMenuItem icon="❓" label="자주 묻는 질문" right="arrow" onTap={() => showToast('FAQ는 준비 중이에요')} />
        </SettingsSection>

        <div style={{ marginTop: 10, textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#8888a0' }}>
            설정한 정보는 기기에만 저장되며 외부로 전송되지 않아요
          </p>
        </div>
      </div>

      {/* Import Modal */}
      {importMode && (
        <div
          onClick={(e) => { e.stopPropagation(); setImportMode(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1001,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 360,
              background: '#1e1e2a', borderRadius: 24, padding: 24,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f0f0f5', marginBottom: 6 }}>데이터 가져오기</div>
            <div style={{ fontSize: 12, color: '#8888a0', marginBottom: 16, lineHeight: 1.5 }}>
              Safari에서 내보낸 코드를 붙여넣기 해주세요.
            </div>
            <textarea
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              placeholder="여기에 붙여넣기..."
              style={{
                width: '100%', height: 80, padding: 14, borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.06)',
                fontSize: 13, color: '#f0f0f5', fontFamily: 'monospace',
                outline: 'none', resize: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                onClick={() => { setImportMode(false); setImportCode(''); }}
                style={{
                  flex: 1, padding: 12, borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)',
                  background: 'transparent', color: '#8888a0', fontSize: 14, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >취소</button>
              <button
                onClick={() => {
                  try {
                    const json = decodeURIComponent(escape(atob(importCode.trim())));
                    const data = JSON.parse(json);
                    let count = 0;
                    for (const [key, value] of Object.entries(data)) {
                      if (key.startsWith('nou_')) {
                        localStorage.setItem(key, value);
                        count++;
                      }
                    }
                    if (count === 0) throw new Error('no data');
                    setImportMode(false);
                    setImportCode('');
                    showToast(`${count}개 항목 복원 완료!`);
                    setTimeout(() => window.location.reload(), 1000);
                  } catch {
                    showToast('유효하지 않은 코드입니다');
                  }
                }}
                style={{
                  flex: 1, padding: 12, borderRadius: 14, border: 'none',
                  background: 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >복원하기</button>
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
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          maxHeight: '85vh', overflowY: 'auto',
          background: '#1a1a28', borderRadius: '24px 24px 0 0',
          padding: '24px 24px 40px',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          animation: 'slideUp 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f5' }}>
              {step === 1 && '지표 선택'}
              {step === 2 && '목표 설정'}
              {step === 3 && '목표 확인'}
            </div>
            <div style={{ fontSize: 12, color: '#8888a0', marginTop: 2 }}>
              {step === 1 && '개선하고 싶은 지표를 선택하세요 (최대 3개)'}
              {step === 2 && '목표 점수와 기간을 설정하세요'}
              {step === 3 && '설정한 목표를 확인하세요'}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.08)', color: '#8888a0',
            fontSize: 16, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: s <= step ? '#818cf8' : 'rgba(255,255,255,0.08)',
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
                      background: selected ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.04)',
                      border: selected ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      cursor: latestRecord ? 'pointer' : 'default',
                      opacity: latestRecord ? 1 : 0.5,
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{m.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#e0e0e8' }}>{m.label}</span>
                        {idx < 3 && latestRecord && (
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 6,
                            background: 'rgba(240,96,80,0.1)', color: '#e05545',
                          }}>추천</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#8888a0', marginTop: 2 }}>
                        현재 {m.value}점
                      </div>
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: selected ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
                      background: selected ? '#818cf8' : 'transparent',
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
                    border: '1px solid rgba(167,139,250,0.2)',
                    background: 'rgba(167,139,250,0.06)',
                    color: '#a78bfa', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >+{p.delta}<br/><span style={{ fontSize: 10, fontWeight: 400, color: '#8888a0' }}>{p.label}</span></button>
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
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{meta.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#e0e0e8' }}>{meta.label}</span>
                      </div>
                      <span style={{ fontSize: 13, color: '#818cf8', fontWeight: 600 }}>
                        {current} → {target}
                      </span>
                    </div>
                    <div style={{
                      width: '100%', height: 8, borderRadius: 4,
                      background: 'rgba(255,255,255,0.06)', position: 'relative',
                      marginBottom: 10,
                    }}>
                      <div style={{
                        width: `${current}%`, height: '100%', borderRadius: 4,
                        background: 'rgba(255,255,255,0.12)',
                      }} />
                      <div style={{
                        position: 'absolute', top: 0, left: 0,
                        width: `${target}%`, height: '100%', borderRadius: 4,
                        background: 'linear-gradient(90deg, #6858a8, #9080c8, #a78bfa)',
                        opacity: 0.6,
                      }} />
                    </div>
                    <input
                      type="range"
                      min={Math.min(current + 1, 100)}
                      max={100}
                      value={target}
                      onChange={(e) => setTargets((prev) => ({ ...prev, [key]: parseInt(e.target.value) }))}
                      style={{ width: '100%', accentColor: '#818cf8' }}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#e0e0e8', marginBottom: 10 }}>목표 기간</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[30, 60, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 14,
                      border: duration === d ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.08)',
                      background: duration === d ? 'rgba(167,139,250,0.12)' : 'transparent',
                      color: duration === d ? '#818cf8' : '#8888a0',
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
              background: 'rgba(167,139,250,0.06)',
              border: '1px solid rgba(167,139,250,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f5' }}>목표 요약</span>
                <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 500 }}>{duration}일</span>
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
                        <span style={{ fontSize: 13, color: '#e0e0e8' }}>{meta.label}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#8888a0' }}>
                        <span style={{ color: '#8888a0' }}>{current}</span>
                        <span style={{ color: '#555570', margin: '0 6px' }}>→</span>
                        <span style={{ color: '#818cf8', fontWeight: 600 }}>{target}</span>
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
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: '#8888a0',
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
                  ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
                color: (step === 1 && selectedMetrics.length === 0) ? '#555570' : '#fff',
                fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >다음</button>
          )}
          {step === 3 && (
            <button
              onClick={handleSave}
              style={{
                flex: 1, padding: 14, borderRadius: 16, border: 'none',
                background: 'linear-gradient(135deg, #9080c8, #6858a8, #483090)',
                color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 20px rgba(167,139,250,0.35)',
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
      <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e8', marginBottom: 8 }}>{label}</div>
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
              background: active ? '#818cf8' : 'rgba(255,255,255,0.04)',
              color: active ? '#fff' : '#8888a0',
              border: active ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.08)',
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
          width: 1, background: 'rgba(167,139,250,0.1)',
        }} />
      )}
      <div style={{
        fontFamily: 'inherit',
        fontSize: 28, fontWeight: 400, color: '#818cf8',
        lineHeight: 1, marginBottom: 6,
      }}>
        {value}{unit && <span style={{ fontSize: 14, color: '#8888a0' }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 11, color: '#8888a0', fontWeight: 300, letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
}

function SettingsSection({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 400, color: '#8888a0',
        letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10,
      }}>{label}</div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 0,
        background: 'rgba(255,255,255,0.04)', borderRadius: 20, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.04)',
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
      borderTop: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, flexShrink: 0,
        background: 'rgba(167,139,250,0.08)',
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 400, color: '#e0e0e8' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: '#8888a0', fontWeight: 300, marginTop: 2 }}>{desc}</div>}
      </div>
      {right === 'arrow' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555570" strokeWidth="1.5" strokeLinecap="round">
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
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 20px',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, flexShrink: 0,
          background: 'rgba(167,139,250,0.08)',
        }}>🔔</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 400, color: '#e0e0e8' }}>진단 리마인더</div>
          {enabled && (
            <div
              onClick={() => setShowPicker(true)}
              style={{ fontSize: 11, color: '#818cf8', fontWeight: 400, marginTop: 2, cursor: 'pointer' }}
            >
              {formatTime(time)} ✎
            </div>
          )}
          {!enabled && (
            <div style={{ fontSize: 11, color: '#8888a0', fontWeight: 300, marginTop: 2 }}>꺼짐</div>
          )}
        </div>
        <div
          onClick={subscribing ? undefined : handleToggle}
          style={{
            width: 44, height: 26, borderRadius: 13,
            background: enabled ? '#818cf8' : 'rgba(255,255,255,0.15)',
            position: 'relative', flexShrink: 0, cursor: subscribing ? 'wait' : 'pointer',
            transition: 'background 0.3s',
            opacity: subscribing ? 0.6 : 1,
          }}
        >
          <div style={{
            position: 'absolute', top: 3,
            left: enabled ? 21 : 3,
            width: 20, height: 20, borderRadius: '50%',
            background: '#e0e0e8', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
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
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 20px',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, flexShrink: 0,
          background: 'rgba(167,139,250,0.08)',
        }}>💡</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 400, color: '#e0e0e8' }}>뷰티 팁 알림</div>
          {enabled ? (
            <div
              onClick={() => setShowPicker(true)}
              style={{ fontSize: 11, color: '#818cf8', fontWeight: 400, marginTop: 2, cursor: 'pointer' }}
            >
              {formatTime(time)} ✎
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#8888a0', fontWeight: 300, marginTop: 2 }}>
              내 피부에 맞는 뷰티 팁을 매일 받아보세요
            </div>
          )}
        </div>
        <div
          onClick={subscribing ? undefined : handleToggle}
          style={{
            width: 44, height: 26, borderRadius: 13,
            background: enabled ? '#818cf8' : 'rgba(255,255,255,0.15)',
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
            background: '#e0e0e8', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
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
    color: active ? '#818cf8' : '#555570',
    scrollSnapAlign: 'center', transition: 'all 0.15s',
    cursor: 'pointer',
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430,
          background: '#1e1e2a', borderRadius: '24px 24px 0 0',
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
          animation: 'slideUp 0.3s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span onClick={onClose} style={{ fontSize: 14, color: '#8888a0', cursor: 'pointer', fontWeight: 400 }}>취소</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#f0f0f5' }}>알림 시간</span>
          <span onClick={handleConfirm} style={{ fontSize: 14, color: '#818cf8', cursor: 'pointer', fontWeight: 600 }}>확인</span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 0,
          background: 'rgba(255,255,255,0.04)', borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', left: 8, right: 8,
            top: ITEM_H, height: ITEM_H,
            background: 'rgba(167,139,250,0.08)', borderRadius: 12,
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
                  color: ampm === v ? '#818cf8' : '#555570',
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

          <div style={{ fontSize: 22, fontWeight: 600, color: '#818cf8', zIndex: 1 }}>:</div>

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
        borderTop: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, flexShrink: 0,
        background: 'rgba(255,255,255,0.06)',
      }}>🌙</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 400, color: '#e0e0e8' }}>다크모드</div>
      </div>
      <div style={{
        width: 44, height: 26, borderRadius: 13,
        background: enabled ? '#818cf8' : 'rgba(255,255,255,0.15)',
        position: 'relative', flexShrink: 0,
        transition: 'background 0.3s',
      }}>
        <div style={{
          position: 'absolute', top: 3,
          left: enabled ? 21 : 3,
          width: 20, height: 20, borderRadius: '50%',
          background: '#e0e0e8', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          transition: 'left 0.3s',
        }} />
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.06)',
  fontSize: 14, color: '#f0f0f5', outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s',
};

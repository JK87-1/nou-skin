import { useState, useCallback, useMemo } from 'react';
import {
  getBodyRecords, saveBodyRecord, deleteBodyRecord,
  getBodyGoal, saveBodyGoal, getBodyProfile, saveBodyProfile,
  calcBMI, getLatestWeight, getStartWeight,
} from '../storage/BodyStorage';
import { getProfile, saveProfile, SKIN_TYPES, SKIN_CONCERNS, SENSITIVITY_OPTIONS, GENDER_OPTIONS } from '../storage/ProfileStorage';

const fadeUp = (delay = 0) => ({ animation: `breatheIn 0.5s ease ${delay}s both` });

export default function BodyPage() {
  const [records, setRecords] = useState(getBodyRecords);
  const [goal, setGoal] = useState(getBodyGoal);
  const [profile, setProfile] = useState(getBodyProfile);
  const [showAdd, setShowAdd] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userProfile, setUserProfile] = useState(getProfile);

  const latest = records.length > 0 ? records[records.length - 1] : null;
  const start = records.length > 0 ? records[0] : null;
  const diff = start && latest ? (latest.weight - start.weight).toFixed(1) : null;
  const goalDiff = goal && latest ? (latest.weight - goal.target).toFixed(1) : null;
  const bmi = latest ? calcBMI(latest.weight, profile.height) : null;

  const refresh = useCallback(() => {
    setRecords(getBodyRecords());
    setGoal(getBodyGoal());
    setProfile(getBodyProfile());
  }, []);

  const handleSave = useCallback((weight) => {
    saveBodyRecord(weight);
    refresh();
    setShowAdd(false);
  }, [refresh]);

  const handleDelete = useCallback((date) => {
    deleteBodyRecord(date);
    refresh();
  }, [refresh]);

  const handleSaveGoal = useCallback((target) => {
    saveBodyGoal({ target });
    refresh();
    setShowGoalModal(false);
  }, [refresh]);

  // Graph data (last 14 records)
  const graphData = useMemo(() => {
    const slice = records.slice(-14);
    if (slice.length < 2) return null;
    const weights = slice.map(r => r.weight);
    const min = Math.min(...weights) - 1;
    const max = Math.max(...weights) + 1;
    const range = max - min || 1;
    const w = 280;
    const h = 60;
    const points = slice.map((r, i) => {
      const x = (i / (slice.length - 1)) * w;
      const y = h - ((r.weight - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');
    const lastPt = { x: w, y: h - ((weights[weights.length - 1] - min) / range) * h };
    return { points, lastPt, w, h };
  }, [records]);

  const recentRecords = [...records].reverse().slice(0, 10);
  const today = new Date();

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', paddingBottom: 80 }}>
      {/* Header with profile */}
      <div style={{ padding: '24px 24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%', overflow: 'hidden',
              background: 'var(--bg-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {userProfile.profileImage ? (
                <img src={userProfile.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <circle cx="12" cy="10" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{userProfile.nickname || '사용자'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{userProfile.skinType || ''}{userProfile.birthYear ? ` · ${new Date().getFullYear() - userProfile.birthYear}세` : ''}</div>
            </div>
          </div>
          {/* Settings gear */}
          <div onClick={() => setShowSettings(true)} style={{ cursor: 'pointer', padding: 6 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </div>
        </div>

        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>바디</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {goalDiff != null
            ? `목표까지 ${Math.abs(goalDiff)}kg ${Number(goalDiff) > 0 ? '남았어요' : '달성!'}`
            : '목표를 설정해보세요'}
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Current Weight Hero */}
        <div style={{ textAlign: 'center', padding: '12px 0 8px', ...fadeUp(0.05) }}>
          {latest ? (
            <>
              <div style={{
                fontSize: 42, fontWeight: 600, fontFamily: 'var(--font-display)',
                color: 'var(--accent-primary)',
              }}>{latest.weight}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>kg · 오늘</div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--text-dim)', padding: '20px 0' }}>
              첫 기록을 시작해보세요
            </div>
          )}
        </div>

        {/* Weight Graph */}
        {graphData && (
          <div style={{ margin: '8px 0 16px', ...fadeUp(0.1) }}>
            <svg viewBox={`0 0 ${graphData.w} ${graphData.h}`} style={{ width: '100%', height: 60 }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#81E4BD" />
                  <stop offset="100%" stopColor="#81E4BD" />
                </linearGradient>
              </defs>
              <polyline points={graphData.points} fill="none" stroke="url(#bodyGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={graphData.lastPt.x} cy={graphData.lastPt.y} r="4" fill="#81E4BD" />
            </svg>
          </div>
        )}

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, ...fadeUp(0.15) }}>
          <StatBox label="시작 몸무게" value={start ? start.weight : ''} unit="kg" />
          <StatBox
            label="변화"
            value={diff != null ? `${Number(diff) > 0 ? '+' : ''}${diff}` : ''}
            unit="kg"
            color={diff && Number(diff) < 0 ? 'var(--accent-primary)' : 'var(--text-primary)'}
          />
          <StatBox
            label="목표"
            value={goal ? goal.target : ''}
            unit="kg"
            onTap={() => setShowGoalModal(true)}
          />
          <StatBox label="BMI" value={bmi || ''} />
        </div>

        {/* Recent Records */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '24px 0 10px', ...fadeUp(0.2) }}>
          최근 기록
        </div>

        {recentRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-dim)', fontSize: 13, ...fadeUp(0.25) }}>
            아직 기록이 없어요
          </div>
        ) : (
          <div style={fadeUp(0.25)}>
            {recentRecords.map((r, i) => {
              const d = new Date(r.date);
              const isToday = r.date === today.toISOString().slice(0, 10);
              return (
                <div key={r.date} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-card)', borderRadius: 'var(--card-border-radius)',
                  padding: '14px 18px', marginBottom: 8,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {d.getMonth() + 1}월 {d.getDate()}일{isToday ? ' (오늘)' : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 15, fontWeight: 600,
                      color: isToday ? 'var(--accent-primary)' : 'var(--text-muted)',
                    }}>{r.weight} kg</span>
                    <button onClick={() => handleDelete(r.date)} style={{
                      background: 'none', border: 'none', color: 'var(--text-dim)',
                      fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
                    }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Button */}
        <div style={{ marginTop: 16, ...fadeUp(0.3) }}>
          <button onClick={() => setShowAdd(true)} style={{
            width: '100%', padding: '14px 0',
            background: 'var(--accent-primary)',
            border: 'none', borderRadius: 'var(--btn-radius)',
            fontSize: 14, fontWeight: 600,
            color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
          }}>오늘 기록하기</button>
        </div>
      </div>

      {/* Add Weight Modal */}
      {showAdd && <AddWeightModal onSave={handleSave} onClose={() => setShowAdd(false)} latest={latest} />}

      {/* Goal Modal */}
      {showGoalModal && <GoalModal onSave={handleSaveGoal} onClose={() => setShowGoalModal(false)} current={goal} />}

      {/* Profile Settings Modal */}
      {showSettings && <ProfileSettingsModal
        profile={userProfile}
        onUpdate={(key, val) => { const next = saveProfile({ [key]: val }); setUserProfile(next); }}
        onClose={() => setShowSettings(false)}
      />}
    </div>
  );
}

function StatBox({ label, value, unit, color, onTap }) {
  return (
    <div onClick={onTap} style={{
      background: 'var(--bg-card)', borderRadius: 'var(--card-border-radius)',
      padding: '14px 16px', cursor: onTap ? 'pointer' : 'default',
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: color || 'var(--text-primary)', marginTop: 4, fontFamily: 'var(--font-display)' }}>
        {value} {unit && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)' }}>{unit}</span>}
      </div>
      {onTap && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>탭하여 설정</div>}
    </div>
  );
}

function AddWeightModal({ onSave, onClose, latest }) {
  const [weight, setWeight] = useState(latest ? String(latest.weight) : '');

  const inputStyle = {
    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
    background: 'var(--bg-input, #F2F3F5)', fontSize: 20, fontWeight: 600,
    color: 'var(--text-primary)', fontFamily: 'var(--font-display)',
    textAlign: 'center', outline: 'none',
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, textAlign: 'center' }}>오늘 몸무게</div>

        <input
          value={weight} onChange={e => setWeight(e.target.value)}
          placeholder="0.0" type="number" step="0.1"
          style={inputStyle}
          autoFocus
        />
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>kg</div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--bg-input, #F2F3F5)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={() => { if (weight) onSave(Number(weight)); }} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--accent-primary)',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>저장</button>
        </div>
      </div>
    </div>
  );
}

function GoalModal({ onSave, onClose, current }) {
  const [target, setTarget] = useState(current ? String(current.target) : '');

  const inputStyle = {
    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
    background: 'var(--bg-input, #F2F3F5)', fontSize: 20, fontWeight: 600,
    color: 'var(--text-primary)', fontFamily: 'var(--font-display)',
    textAlign: 'center', outline: 'none',
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, textAlign: 'center' }}>목표 몸무게</div>

        <input
          value={target} onChange={e => setTarget(e.target.value)}
          placeholder="0.0" type="number" step="0.1"
          style={inputStyle}
          autoFocus
        />
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>kg</div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--bg-input, #F2F3F5)',
            color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>취소</button>
          <button onClick={() => { if (target) onSave(Number(target)); }} style={{
            flex: 1, padding: '14px 0', borderRadius: 'var(--btn-radius)',
            border: 'none', background: 'var(--accent-primary)',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>저장</button>
        </div>
      </div>
    </div>
  );
}

// ===== Profile Settings Modal =====
function ProfileSettingsModal({ profile, onUpdate, onClose }) {
  const currentYear = new Date().getFullYear();
  const age = profile.birthYear ? currentYear - parseInt(profile.birthYear) : null;

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none',
    background: 'var(--bg-input, #F2F3F5)', fontSize: 14,
    color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-modal, #fff)', borderRadius: '24px 24px 0 0',
        padding: '24px 24px 40px', width: '100%', maxWidth: 420,
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-dim)', margin: '0 auto 20px', opacity: 0.3 }} />
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>프로필 설정</div>

        {/* Profile photo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div onClick={() => document.getElementById('profile-photo-input')?.click()} style={{
            position: 'relative', width: 72, height: 72, borderRadius: '50%', cursor: 'pointer',
            overflow: 'hidden', background: 'var(--bg-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {profile.profileImage ? (
              <img src={profile.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <circle cx="12" cy="10" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
              </svg>
            )}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 24,
              background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#fff" strokeWidth="1.5" />
                <circle cx="12" cy="13" r="3" stroke="#fff" strokeWidth="1.5" />
              </svg>
            </div>
            <input id="profile-photo-input" type="file" accept="image/*" onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                // Resize to 200px for storage
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = 200; canvas.height = 200;
                  const ctx = canvas.getContext('2d');
                  const size = Math.min(img.width, img.height);
                  const sx = (img.width - size) / 2, sy = (img.height - size) / 2;
                  ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
                  onUpdate('profileImage', canvas.toDataURL('image/jpeg', 0.8));
                };
                img.src = ev.target.result;
              };
              reader.readAsDataURL(file);
            }} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Nickname */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>닉네임</div>
          <input value={profile.nickname || ''} onChange={e => onUpdate('nickname', e.target.value)}
            placeholder="닉네임" maxLength={20} style={inputStyle} />
        </div>

        {/* ── 기본 정보 ── */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '24px 0 12px' }}>기본 정보</div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>생년월일</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input value={profile.birthYear || ''} onChange={e => onUpdate('birthYear', e.target.value)}
              placeholder="예: 1995" type="number" min={1940} max={currentYear} style={{ ...inputStyle, flex: 1 }} />
            {age > 0 && <span style={{ fontSize: 13, color: 'var(--accent-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>만 {age}세</span>}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>성별</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {GENDER_OPTIONS.map(g => (
              <button key={g} onClick={() => onUpdate('gender', g)} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                background: profile.gender === g ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                color: profile.gender === g ? '#fff' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{g}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>키 (cm)</div>
            <input value={profile.height || ''} onChange={e => onUpdate('height', e.target.value)}
              placeholder="165" type="number" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>현재 몸무게 (kg)</div>
            <input value={profile.currentWeight || ''} onChange={e => onUpdate('currentWeight', e.target.value)}
              placeholder="60" type="number" step="0.1" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>목표 몸무게 (kg)</div>
          <input value={profile.goalWeight || ''} onChange={e => onUpdate('goalWeight', e.target.value)}
            placeholder="55" type="number" step="0.1" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>활동 수준</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['거의 없음', '가벼운 활동', '보통', '활발한 활동', '매우 활발'].map(level => (
              <button key={level} onClick={() => onUpdate('activityLevel', level)} style={{
                padding: '8px 14px', borderRadius: 10, border: 'none',
                background: profile.activityLevel === level ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                color: profile.activityLevel === level ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{level}</button>
            ))}
          </div>
        </div>

        {/* ── 피부 정보 ── */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '24px 0 12px' }}>피부 정보</div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>피부 타입</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SKIN_TYPES.map(t => (
              <button key={t} onClick={() => onUpdate('skinType', t)} style={{
                padding: '8px 14px', borderRadius: 10, border: 'none',
                background: profile.skinType === t ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                color: profile.skinType === t ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>주요 피부 고민</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SKIN_CONCERNS.map(c => {
              const active = (profile.skinConcerns || []).includes(c);
              return (
                <button key={c} onClick={() => {
                  const list = active ? profile.skinConcerns.filter(x => x !== c) : [...(profile.skinConcerns || []), c];
                  onUpdate('skinConcerns', list);
                }} style={{
                  padding: '8px 14px', borderRadius: 10, border: 'none',
                  background: active ? 'var(--accent-primary)' : 'var(--bg-input, #F2F3F5)',
                  color: active ? '#fff' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                }}>{c}</button>
              );
            })}
          </div>
        </div>

        <button onClick={onClose} style={{
          width: '100%', padding: '14px 0', borderRadius: 'var(--btn-radius)',
          border: 'none', background: 'var(--accent-primary)',
          color: '#fff', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>완료</button>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  getProfile, saveProfile,
  SKIN_TYPES, SKIN_CONCERNS, SENSITIVITY_OPTIONS, GENDER_OPTIONS,
} from '../storage/ProfileStorage';
import { getRecords, getStreak, getTotalChanges } from '../storage/SkinStorage';

export default function MyPage() {
  const [profile, setProfile] = useState(getProfile);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingSkin, setEditingSkin] = useState(false);
  const [toast, setToast] = useState(false);
  const fileRef = useRef(null);

  const update = (key, value) => {
    const next = saveProfile({ [key]: value });
    setProfile(next);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200; canvas.height = 200;
        const ctx = canvas.getContext('2d');
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
        update('profileImage', canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleConcern = (c) => {
    const list = profile.skinConcerns.includes(c)
      ? profile.skinConcerns.filter(x => x !== c)
      : [...profile.skinConcerns, c];
    update('skinConcerns', list);
  };

  const currentYear = new Date().getFullYear();
  const age = profile.birthYear ? currentYear - parseInt(profile.birthYear) : null;

  // Journey stats
  const records = getRecords();
  const streak = getStreak();
  const totalChanges = getTotalChanges();
  const recordCount = records.length;
  const firstRecord = records.length > 0 ? records[0] : null;
  const daysSinceStart = firstRecord
    ? Math.max(1, Math.ceil((Date.now() - new Date(firstRecord.date).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const scoreDiff = totalChanges ? totalChanges.overallScore : 0;

  // Skin type emoji mapping
  const skinTypeEmoji = {
    '건성': '💧', '지성': '🫧', '복합성': '🫧', '중성': '✨', '민감성': '🌸',
  };

  const Arrow = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4ccc4" strokeWidth="1.5" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );

  return (
    <div style={{ paddingBottom: 40 }}>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />

      <div style={{ padding: '0 24px 0' }}>

        {/* Header */}
        <div style={{ padding: '10px 0 32px', animation: 'breatheIn 0.8s ease both' }}>
          <div style={{
            fontSize: 28, fontWeight: 300, fontStyle: 'italic',
            color: '#b08872', letterSpacing: 1, marginBottom: 4,
          }}>My Skin Story</div>
          <div style={{ fontSize: 13, fontWeight: 300, color: '#a89888', letterSpacing: 0.5 }}>마이페이지</div>
        </div>

        {/* Profile Card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 18,
          marginBottom: 28, animation: 'breatheIn 0.8s ease 0.1s both',
        }}>
          {/* Photo */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
              position: 'relative', flexShrink: 0, cursor: 'pointer',
              background: 'linear-gradient(135deg, #c4705a, #d4856c)', padding: 2.5,
            }}
          >
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              overflow: 'hidden', background: '#fdfbf9',
            }}>
              {profile.profileImage ? (
                <img src={profile.profileImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c4b0a0" strokeWidth="1.5">
                    <circle cx="12" cy="10" r="4" /><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
            {/* Camera badge */}
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 24, height: 24, borderRadius: '50%',
              background: 'white', border: '1.5px solid rgba(196,112,90,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c4705a" strokeWidth="2" strokeLinecap="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </div>
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#3a302a', marginBottom: 4 }}>
              {profile.nickname || '사용자'}님
            </div>
            <div style={{ fontSize: 12, color: '#b8a898', fontWeight: 300 }}>
              {daysSinceStart > 0 ? `NOU와 함께한 지 ${daysSinceStart}일째` : 'NOU에 오신 것을 환영해요'}
            </div>
          </div>

          {/* Edit button */}
          <button
            onClick={() => setEditingProfile(!editingProfile)}
            style={{
              padding: '8px 16px', borderRadius: 20,
              border: '1px solid rgba(180,160,140,0.2)', background: 'transparent',
              fontSize: 12, color: '#8a7a6e', fontWeight: 400,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.3s',
            }}
          >{editingProfile ? '완료' : '편집'}</button>
        </div>

        {/* Profile Edit Section (collapsible) */}
        {editingProfile && (
          <div style={{
            background: 'white', borderRadius: 22, padding: 22,
            marginBottom: 28, border: '1px solid rgba(180,160,140,0.08)',
            animation: 'breatheIn 0.3s ease both',
          }}>
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
                  <span style={{ fontSize: 13, color: '#c4705a', fontWeight: 600, whiteSpace: 'nowrap' }}>만 {age}세</span>
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

        {/* Journey Stats */}
        <div style={{
          background: 'linear-gradient(160deg, rgba(196,112,90,0.04), rgba(196,112,90,0.09))',
          borderRadius: 22, padding: 22, marginBottom: 28,
          border: '1px solid rgba(196,112,90,0.06)',
          animation: 'breatheIn 0.8s ease 0.2s both',
        }}>
          <div style={{
            fontSize: 16, fontWeight: 400, color: '#6a5548',
            marginBottom: 18, letterSpacing: 0.5,
          }}>나의 피부 여정</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
            <JourneyStat value={recordCount} label="총 기록" />
            <JourneyStat value={streak.count} unit="일" label="연속 기록" hasDivider />
            <JourneyStat value={scoreDiff > 0 ? `+${scoreDiff}` : String(scoreDiff)} label="점수 변화" hasDivider noFont={scoreDiff === 0} />
          </div>
        </div>

        {/* Skin Type Card */}
        <div style={{
          background: 'white', borderRadius: 22, padding: 22,
          marginBottom: 28, border: '1px solid rgba(180,160,140,0.08)',
          animation: 'breatheIn 0.8s ease 0.3s both',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#5a4a40' }}>나의 피부 타입</div>
            <span
              onClick={() => setEditingSkin(!editingSkin)}
              style={{ fontSize: 12, color: '#c4705a', fontWeight: 400, cursor: 'pointer' }}
            >{editingSkin ? '완료' : '수정'}</span>
          </div>

          {editingSkin ? (
            <div style={{ animation: 'breatheIn 0.3s ease both' }}>
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
                          background: active ? 'rgba(196,112,90,0.08)' : 'rgba(180,160,140,0.06)',
                          color: active ? '#c4705a' : '#8a7a6e',
                          border: active ? '1px solid rgba(196,112,90,0.18)' : '1px solid rgba(180,160,140,0.1)',
                        }}
                      >{c}</div>
                    );
                  })}
                </div>
              </Section>
            </div>
          ) : (
            <>
              {/* Badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'linear-gradient(135deg, rgba(196,112,90,0.06), rgba(196,112,90,0.12))',
                borderRadius: 14, padding: '10px 16px', marginBottom: 14,
              }}>
                <span style={{ fontSize: 20 }}>{skinTypeEmoji[profile.skinType] || '🧬'}</span>
                <span style={{ fontSize: 15, fontWeight: 500, color: '#5a4a40' }}>
                  {profile.skinType || '미설정'}
                  {profile.sensitivity ? ` · ${profile.sensitivity}` : ''}
                </span>
              </div>

              {/* Concern tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SKIN_CONCERNS.map((c) => {
                  const active = profile.skinConcerns.includes(c);
                  return (
                    <span key={c} style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12,
                      fontWeight: 400, cursor: 'default', transition: 'all 0.3s',
                      background: active ? 'rgba(196,112,90,0.08)' : 'rgba(180,160,140,0.06)',
                      color: active ? '#c4705a' : '#8a7a6e',
                      border: active ? '1px solid rgba(196,112,90,0.18)' : '1px solid rgba(180,160,140,0.1)',
                    }}>{c}</span>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div style={{
          height: 1, margin: '0 10px 28px',
          background: 'linear-gradient(90deg, transparent, rgba(180,160,140,0.15), transparent)',
        }} />

        {/* Menu: 관리 */}
        <MenuSection label="관리" delay={0.4}>
          <ReminderItem
            enabled={profile.reminderEnabled}
            time={profile.reminderTime || '08:00'}
            onToggle={(v) => update('reminderEnabled', v)}
            onTimeChange={(v) => update('reminderTime', v)}
          />
          <MenuItem icon="📊" iconColor="green" label="피부 리포트" desc="월간 분석 리포트 받기" right="badge-new" />
          <MenuItem icon="🎯" iconColor="purple" label="피부 목표 설정" desc="3개월 후 피부 점수 목표" right="arrow" />
        </MenuSection>

        {/* Menu: 설정 */}
        <MenuSection label="설정" delay={0.5}>
          <MenuItem icon="🌙" iconColor="gray" label="다크모드" right="toggle-off" />
          <MenuItem icon="🌐" iconColor="gray" label="언어" desc="한국어" right="arrow" />
          <MenuItem icon="🔒" iconColor="gray" label="개인정보 관리" right="arrow" />
        </MenuSection>

        {/* Menu: 지원 */}
        <MenuSection label="지원" delay={0.55}>
          <MenuItem icon="💬" iconColor="amber" label="피드백 보내기" right="arrow" />
          <MenuItem icon="❓" iconColor="gray" label="자주 묻는 질문" right="arrow" />
        </MenuSection>

        {/* App Info */}
        <div style={{
          textAlign: 'center', padding: '16px 0 0',
          animation: 'breatheIn 0.8s ease 0.6s both',
        }}>
          <div style={{ fontSize: 11, color: '#c4b0a0', fontWeight: 300, marginBottom: 4 }}>NOU Beta v1.0.2</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, color: '#b8a898', fontWeight: 300, cursor: 'pointer' }}>이용약관</span>
            <span style={{ fontSize: 11, color: '#b8a898', fontWeight: 300, cursor: 'pointer' }}>개인정보처리방침</span>
            <span style={{ fontSize: 11, color: '#b8a898', fontWeight: 300, cursor: 'pointer' }}>로그아웃</span>
          </div>
        </div>

        {/* Privacy note */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#c4b0a0' }}>
            설정한 정보는 기기에만 저장되며 외부로 전송되지 않아요
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(60,50,40,0.85)', color: '#fff', padding: '10px 24px',
          borderRadius: 20, fontSize: 13, fontWeight: 500, zIndex: 999,
          animation: 'fadeIn 0.2s ease',
        }}>저장되었습니다</div>
      )}
    </div>
  );
}

// ===== Sub-components =====

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#5a4a40', marginBottom: 8 }}>{label}</div>
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
              background: active ? '#c4705a' : 'rgba(0,0,0,0.03)',
              color: active ? '#fff' : '#8a7a6e',
              border: active ? '1px solid #c4705a' : '1px solid rgba(0,0,0,0.06)',
            }}
          >
            {opt}
          </div>
        );
      })}
    </div>
  );
}

function JourneyStat({ value, unit, label, hasDivider, noFont }) {
  return (
    <div style={{ textAlign: 'center', position: 'relative' }}>
      {hasDivider && (
        <div style={{
          position: 'absolute', left: 0, top: '15%', height: '70%',
          width: 1, background: 'rgba(196,112,90,0.1)',
        }} />
      )}
      <div style={{
        fontFamily: 'inherit',
        fontSize: 28, fontWeight: 400, color: '#c4705a',
        lineHeight: 1, marginBottom: 6,
      }}>
        {value}{unit && <span style={{ fontSize: 14, color: '#b8a898' }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 11, color: '#a89888', fontWeight: 300, letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
}

function ReminderItem({ enabled, time, onToggle, onTimeChange }) {
  const [showPicker, setShowPicker] = useState(false);

  const formatTime = (t) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour < 12 ? '오전' : '오후';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `매일 ${ampm} ${h12}:${m.padStart(2, '0')}`;
  };

  return (
    <div style={{ borderTop: '1px solid rgba(180,160,140,0.06)' }}>
      {/* Main row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '16px 20px',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, flexShrink: 0,
          background: 'rgba(196,112,90,0.08)',
        }}>🔔</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 400, color: '#5a4a40' }}>진단 리마인더</div>
          {enabled && (
            <div
              onClick={() => setShowPicker(true)}
              style={{ fontSize: 11, color: '#c4705a', fontWeight: 400, marginTop: 2, cursor: 'pointer' }}
            >
              {formatTime(time)} ✎
            </div>
          )}
          {!enabled && (
            <div style={{ fontSize: 11, color: '#b8a898', fontWeight: 300, marginTop: 2 }}>꺼짐</div>
          )}
        </div>
        <div
          onClick={() => onToggle(!enabled)}
          style={{
            width: 44, height: 26, borderRadius: 13,
            background: enabled ? '#c4705a' : '#d4ccc4',
            position: 'relative', flexShrink: 0, cursor: 'pointer',
            transition: 'background 0.3s',
          }}
        >
          <div style={{
            position: 'absolute', top: 3,
            left: enabled ? 21 : 3,
            width: 20, height: 20, borderRadius: '50%',
            background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            transition: 'left 0.3s',
          }} />
        </div>
      </div>

      {/* Custom Time Picker Modal */}
      {showPicker && (
        <TimePicker
          value={time}
          onChange={(v) => { onTimeChange(v); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
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

  // Scroll to initial position
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
    color: active ? '#c4705a' : '#c4b0a0',
    scrollSnapAlign: 'center', transition: 'all 0.15s',
    cursor: 'pointer',
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430,
          background: '#fdfbf9', borderRadius: '24px 24px 0 0',
          padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
          animation: 'slideUp 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span onClick={onClose} style={{ fontSize: 14, color: '#a89888', cursor: 'pointer', fontWeight: 400 }}>취소</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#3a302a' }}>알림 시간</span>
          <span onClick={handleConfirm} style={{ fontSize: 14, color: '#c4705a', cursor: 'pointer', fontWeight: 600 }}>확인</span>
        </div>

        {/* Picker body */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          background: 'white', borderRadius: 20, overflow: 'hidden',
          border: '1px solid rgba(180,160,140,0.1)',
          position: 'relative',
        }}>
          {/* Selection highlight bar */}
          <div style={{
            position: 'absolute', left: 8, right: 8,
            top: ITEM_H, height: ITEM_H,
            background: 'rgba(196,112,90,0.06)', borderRadius: 12,
            pointerEvents: 'none', zIndex: 0,
          }} />

          {/* AM/PM */}
          <div style={{ width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: `${ITEM_H}px 0`, zIndex: 1 }}>
            {['AM', 'PM'].map((v) => (
              <div
                key={v}
                onClick={() => setAmpm(v)}
                style={{
                  height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: ampm === v ? 18 : 15, fontWeight: ampm === v ? 600 : 300,
                  color: ampm === v ? '#c4705a' : '#c4b0a0',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >{v === 'AM' ? '오전' : '오후'}</div>
            ))}
          </div>

          {/* Hour scroll */}
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

          <div style={{ fontSize: 22, fontWeight: 600, color: '#c4705a', zIndex: 1 }}>:</div>

          {/* Minute scroll */}
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

function MenuSection({ label, delay, children }) {
  return (
    <div style={{ marginBottom: 24, animation: `breatheIn 0.8s ease ${delay}s both` }}>
      <div style={{
        fontSize: 11, fontWeight: 400, color: '#a89888',
        letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
      }}>{label}</div>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 0,
        background: 'white', borderRadius: 20, overflow: 'hidden',
        border: '1px solid rgba(180,160,140,0.06)',
      }}>
        {children}
      </div>
    </div>
  );
}

function MenuItem({ icon, iconColor, label, desc, right }) {
  const iconBgMap = {
    coral: 'rgba(196,112,90,0.08)',
    green: 'rgba(138,173,140,0.1)',
    purple: 'rgba(140,120,180,0.08)',
    amber: 'rgba(212,160,64,0.08)',
    gray: 'rgba(180,160,140,0.08)',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '16px 20px', cursor: 'pointer',
      borderTop: '1px solid rgba(180,160,140,0.06)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, flexShrink: 0,
        background: iconBgMap[iconColor] || iconBgMap.gray,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 400, color: '#5a4a40' }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: '#b8a898', fontWeight: 300, marginTop: 2 }}>{desc}</div>}
      </div>
      {right === 'arrow' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4ccc4" strokeWidth="1.5" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
      {right === 'toggle' && (
        <div style={{
          width: 44, height: 26, borderRadius: 13,
          background: '#c4705a', position: 'relative', flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute', top: 3, left: 21,
            width: 20, height: 20, borderRadius: '50%',
            background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }} />
        </div>
      )}
      {right === 'toggle-off' && (
        <div style={{
          width: 44, height: 26, borderRadius: 13,
          background: '#d4ccc4', position: 'relative', flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute', top: 3, left: 3,
            width: 20, height: 20, borderRadius: '50%',
            background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }} />
        </div>
      )}
      {right === 'badge-new' && (
        <span style={{
          padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 500,
          background: 'rgba(138,173,140,0.12)', color: '#6a9a6e',
        }}>NEW</span>
      )}
      {right === 'badge-premium' && (
        <span style={{
          padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 500,
          background: 'linear-gradient(135deg, rgba(196,112,90,0.1), rgba(196,112,90,0.15))',
          color: '#c4705a',
        }}>PRO</span>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 14,
  border: '1px solid rgba(0,0,0,0.08)', background: '#fff',
  fontSize: 14, color: '#3d3328', outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s',
};

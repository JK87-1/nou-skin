import { useState, useMemo } from 'react';
import { generateRoutine } from '../engine/RoutineEngine';

const SKIN_TYPE_LABELS = {
  dry: '건성', oily: '지성', combination: '복합성', normal: '중성', sensitive: '민감성',
};

const TABS = [
  { id: 'morning', label: '모닝', icon: '☀️' },
  { id: 'evening', label: '이브닝', icon: '🌙' },
  { id: 'weekly', label: '주간 플랜', icon: '📅' },
  { id: 'ingredients', label: '성분', icon: '🧬' },
];

export default function SkincareRoutine({ result, onBack }) {
  const [activeTab, setActiveTab] = useState('morning');

  const routine = useMemo(() => generateRoutine(result), [result]);

  const { skinType, topConcerns, recommendedIngredients, morningRoutine, eveningRoutine, weeklyPlan, conflictNotes } = routine;

  return (
    <div style={{
      minHeight: '100dvh', background: '#FAFAFA',
      animation: 'fadeIn 0.3s ease-out',
    }}>
      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #FFD68A, #FFB347 30%, #FF8C42)',
        padding: '48px 24px 28px', borderRadius: '0 0 32px 32px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 160, height: 160,
          borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, left: -20, width: 100, height: 100,
          borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
        }} />
        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
          width: 38, height: 38, color: '#fff', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 24 }}>🧪</span>
          <h1 style={{
            fontSize: 22, fontWeight: 800, color: '#fff', margin: 0,
            fontFamily: "'Outfit', sans-serif",
            textShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>나만의 스킨케어 루틴</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#fff',
            background: 'rgba(255,255,255,0.25)', padding: '4px 12px',
            borderRadius: 20, backdropFilter: 'blur(8px)',
          }}>{SKIN_TYPE_LABELS[skinType] || skinType} 피부</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
            맞춤 {recommendedIngredients.length}개 활성성분
          </span>
        </div>
      </div>

      <div style={{ padding: '16px 16px 40px' }}>
        {/* ── Concern Summary ── */}
        <div className="glass-card" style={{ animation: 'fadeUp 0.4s ease-out 0.1s both' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2d2520', marginBottom: 10 }}>
            주요 관심사 TOP 3
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {topConcerns.map((c, i) => (
              <span key={c.key} style={{
                fontSize: 12, fontWeight: 600,
                color: i === 0 ? '#e05545' : i === 1 ? '#d4900a' : '#7C4DFF',
                background: i === 0 ? 'rgba(240,96,80,0.1)' : i === 1 ? 'rgba(245,166,35,0.1)' : 'rgba(124,77,255,0.08)',
                border: `1px solid ${i === 0 ? 'rgba(240,96,80,0.18)' : i === 1 ? 'rgba(245,166,35,0.18)' : 'rgba(124,77,255,0.15)'}`,
                padding: '5px 14px', borderRadius: 20,
              }}>
                {c.label} <span style={{ opacity: 0.6, fontFamily: "'Outfit', sans-serif" }}>{Math.round(c.score)}점</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto',
          padding: '2px 0', msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              className="tab-pill"
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 'none', padding: '8px 16px', borderRadius: 20,
                border: activeTab === tab.id ? 'none' : '1px solid rgba(0,0,0,0.08)',
                background: activeTab === tab.id
                  ? 'linear-gradient(135deg, #FFB347, #FF8C42)'
                  : 'rgba(255,255,255,0.7)',
                color: activeTab === tab.id ? '#fff' : '#5a4a3a',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: activeTab === tab.id ? '0 2px 12px rgba(255,140,66,0.3)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div style={{ animation: 'slideLeft 0.3s ease-out' }} key={activeTab}>
          {activeTab === 'morning' && (
            <RoutineTab steps={morningRoutine} period="am" skinType={skinType} />
          )}
          {activeTab === 'evening' && (
            <RoutineTab steps={eveningRoutine} period="pm" skinType={skinType} />
          )}
          {activeTab === 'weekly' && (
            <WeeklyTab plan={weeklyPlan} />
          )}
          {activeTab === 'ingredients' && (
            <IngredientsTab ingredients={recommendedIngredients} conflictNotes={conflictNotes} />
          )}
        </div>

        {/* ── Conflict Notes ── */}
        {conflictNotes.length > 0 && activeTab !== 'ingredients' && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,152,0,0.08), rgba(255,87,34,0.08))',
            border: '1px solid rgba(255,152,0,0.15)',
            borderRadius: 16, padding: 16, marginTop: 8,
            animation: 'fadeUp 0.4s ease-out',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e65100', marginBottom: 8 }}>
              ⚠️ 성분 사용 주의사항
            </div>
            {conflictNotes.map((note, i) => (
              <p key={i} style={{ fontSize: 12, color: '#5a4a3a', lineHeight: 1.6, margin: '4px 0' }}>
                • {note}
              </p>
            ))}
          </div>
        )}

        {/* ── Disclaimer ── */}
        <p style={{
          textAlign: 'center', fontSize: 11, color: '#b8a594',
          marginTop: 24, lineHeight: 1.6,
        }}>
          AI 추정 기반 루틴이며 의료 조언이 아닙니다.<br />
          새로운 성분은 패치 테스트 후 사용하세요.
        </p>

        {/* ── Back Button ── */}
        <button onClick={onBack} style={{
          width: '100%', padding: 14, borderRadius: 50, fontFamily: 'inherit',
          background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.6)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          color: '#5a4a3a', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          marginTop: 12,
        }}>← 결과로 돌아가기</button>
      </div>
    </div>
  );
}

// ── RoutineTab: AM/PM 스텝 카드 ──
function RoutineTab({ steps, period }) {
  const [expanded, setExpanded] = useState(null);

  const visibleSteps = steps.filter(s => s.type !== 'conditional' || s.show !== false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        fontSize: 13, fontWeight: 600, color: '#b8a594', marginBottom: 2,
      }}>
        {period === 'am' ? '☀️ 아침 루틴' : '🌙 저녁 루틴'} · {visibleSteps.length}단계
      </div>
      {visibleSteps.map((step, idx) => (
        <div
          key={step.step}
          className="routine-step"
          onClick={() => setExpanded(expanded === step.step ? null : step.step)}
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.6)',
            borderRadius: 18, padding: '14px 16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.04), inset 0 1px 2px rgba(255,255,255,0.8)',
            cursor: 'pointer', transition: 'transform 0.15s',
            animation: `fadeUp 0.4s ease-out ${idx * 0.06}s both`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'linear-gradient(135deg, #FFF3E4, #FFE8D6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              {step.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: '#FF8C42',
                  fontFamily: "'Outfit', sans-serif",
                }}>STEP {idx + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#2d2520' }}>{step.nameKo}</span>
              </div>
              {step.form && (
                <span style={{
                  fontSize: 11.5, color: '#8b7a6a', marginTop: 2, display: 'block',
                }}>추천 제형: {step.form}</span>
              )}
            </div>
            <span style={{
              fontSize: 12, color: '#c4b5a0', transition: 'transform 0.2s',
              transform: expanded === step.step ? 'rotate(180deg)' : 'rotate(0)',
            }}>▼</span>
          </div>

          {/* 맞춤 성분 태그 — 항상 표시 */}
          {step.activeIngredients && step.activeIngredients.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#7C4DFF', marginRight: 2 }}>
                {step.type === 'dynamic' ? '핵심 성분' : '추천 성분'}
              </span>
              {step.activeIngredients.map(ing => (
                <span key={ing.id} style={{
                  fontSize: 10.5, fontWeight: 500,
                  color: '#7C4DFF', background: 'rgba(124,77,255,0.08)',
                  border: '1px solid rgba(124,77,255,0.15)',
                  padding: '2px 8px', borderRadius: 10,
                }}>
                  {ing.nameKo}
                </span>
              ))}
            </div>
          )}

          {expanded === step.step && (
            <div style={{
              marginTop: 12, paddingTop: 12,
              borderTop: '1px solid rgba(0,0,0,0.05)',
              animation: 'fadeUp 0.2s ease-out',
            }}>
              <p style={{ fontSize: 12, color: '#5a4a3a', lineHeight: 1.6, margin: '0 0 8px' }}>
                {step.descKo}
              </p>
              {step.activeIngredients && step.activeIngredients.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#7C4DFF', marginBottom: 6 }}>
                    성분 상세
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {step.activeIngredients.map(ing => (
                      <span key={ing.id} style={{
                        fontSize: 11, fontWeight: 500,
                        color: '#7C4DFF', background: 'rgba(124,77,255,0.08)',
                        border: '1px solid rgba(124,77,255,0.15)',
                        padding: '3px 10px', borderRadius: 12,
                      }}>
                        {ing.nameKo} <span style={{ opacity: 0.6 }}>{ing.concentration}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── WeeklyTab: 7일 그리드 ──
function WeeklyTab({ plan }) {
  const typeColors = {
    basic: { bg: 'rgba(76,175,80,0.08)', border: 'rgba(76,175,80,0.15)', color: '#388E3C' },
    retinol: { bg: 'rgba(255,140,66,0.1)', border: 'rgba(255,140,66,0.2)', color: '#E65100' },
    recovery: { bg: 'rgba(79,195,247,0.1)', border: 'rgba(79,195,247,0.2)', color: '#0277BD' },
    exfoliation: { bg: 'rgba(124,77,255,0.08)', border: 'rgba(124,77,255,0.15)', color: '#7C4DFF' },
    special: { bg: 'rgba(240,98,146,0.08)', border: 'rgba(240,98,146,0.15)', color: '#C2185B' },
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#b8a594', marginBottom: 12 }}>
        📅 주간 스킨케어 플랜
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plan.map((day, i) => {
          const c = typeColors[day.type] || typeColors.basic;
          return (
            <div key={day.day} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.6)',
              borderRadius: 16, padding: '12px 16px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
              animation: `fadeUp 0.4s ease-out ${i * 0.05}s both`,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: c.bg, border: `1px solid ${c.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 18 }}>{day.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: '#2d2520',
                    fontFamily: "'Outfit', sans-serif",
                  }}>{day.day}</span>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: c.color,
                    background: c.bg, padding: '2px 8px', borderRadius: 8,
                  }}>{day.nameKo}</span>
                </div>
                <p style={{ fontSize: 11.5, color: '#8b7a6a', margin: '3px 0 0', lineHeight: 1.4 }}>
                  {day.descKo}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── IngredientsTab: 성분 카드 ──
function IngredientsTab({ ingredients, conflictNotes }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#b8a594', marginBottom: 12 }}>
        🧬 추천 활성성분 {ingredients.length}종
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ingredients.map((ing, i) => (
          <div key={ing.id} style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.6)',
            borderRadius: 18, padding: 16,
            boxShadow: '0 4px 24px rgba(0,0,0,0.04), inset 0 1px 2px rgba(255,255,255,0.8)',
            animation: `fadeUp 0.4s ease-out ${i * 0.06}s both`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#2d2520' }}>{ing.nameKo}</span>
                <span style={{
                  fontSize: 11, fontWeight: 500, color: '#FF8C42',
                  background: 'rgba(255,140,66,0.1)', padding: '2px 8px',
                  borderRadius: 8, marginLeft: 8,
                }}>{ing.category}</span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#7C4DFF',
                background: 'rgba(124,77,255,0.08)', padding: '3px 10px',
                borderRadius: 10,
              }}>{ing.concentration}</span>
            </div>
            <p style={{ fontSize: 12, color: '#5a4a3a', lineHeight: 1.65, margin: 0 }}>
              {ing.descKo}
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 10.5, color: '#8b7a6a',
                background: 'rgba(0,0,0,0.04)', padding: '3px 8px', borderRadius: 8,
              }}>
                {ing.period === 'am' ? '☀️ 아침' : ing.period === 'pm' ? '🌙 저녁' : '☀️🌙 아침+저녁'}
              </span>
              {ing.skinTypes.includes('all') ? (
                <span style={{
                  fontSize: 10.5, color: '#388E3C',
                  background: 'rgba(76,175,80,0.08)', padding: '3px 8px', borderRadius: 8,
                }}>모든 피부타입</span>
              ) : (
                ing.skinTypes.map(st => (
                  <span key={st} style={{
                    fontSize: 10.5, color: '#8b7a6a',
                    background: 'rgba(0,0,0,0.04)', padding: '3px 8px', borderRadius: 8,
                  }}>{SKIN_TYPE_LABELS[st] || st}</span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Conflict Warnings */}
      {conflictNotes.length > 0 && (
        <div style={{
          marginTop: 16,
          background: 'linear-gradient(135deg, rgba(255,152,0,0.08), rgba(255,87,34,0.08))',
          border: '1px solid rgba(255,152,0,0.15)',
          borderRadius: 16, padding: 16,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e65100', marginBottom: 8 }}>
            ⚠️ 성분 간 충돌 주의
          </div>
          {conflictNotes.map((note, i) => (
            <p key={i} style={{ fontSize: 12, color: '#5a4a3a', lineHeight: 1.6, margin: '4px 0' }}>
              • {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

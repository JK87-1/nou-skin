import { useState } from 'react';

/**
 * 결과 페이지 AI 정밀 분석 카드.
 * - aiNotes (summary) 본문: 매일 다르게 나오는 narrative
 * - aiDetails (3개 부위별 소견): 칩 + 아코디언 펼침
 * - 메이크업/cv_only 배지 통합
 *
 * cv_only 또는 응답 없음 → null 반환 (호출부에서 조건 렌더링 불필요)
 *
 * props
 *  - aiNotes: string | undefined
 *  - aiDetails: string[] | undefined  (예: ["이마: 수평 주름 1~2줄, 중등도", ...])
 *  - accent: theme accent color
 *  - analysisMode: 'hybrid' | 'cv_only'
 *  - makeupDetected: boolean
 *  - animationDelay: CSS animation delay (e.g. '0.85s')
 */
export default function AiCommentCard({
  aiNotes,
  aiDetails,
  accent = '#6598ef',
  analysisMode,
  makeupDetected,
  animationDelay = '0.85s',
}) {
  const [openIdx, setOpenIdx] = useState(null); // 펼친 칩 index. null = 모두 닫힘.

  if (!aiNotes && (!aiDetails || aiDetails.length === 0)) return null;

  // 식별 관련 sentence(동일/다른 인물 등) 필터링 — 사용자에게 노출하지 않음
  const filteredNotes = (aiNotes || '')
    .replace(/[^.。!]*(?:동일\s*인물|같은\s*(?:사람|인물)|다른\s*(?:사람|인물)|differentPerson|두\s*사진\s*(?:은|이|를))[^.。!]*[.。!]\s*/gi, '')
    .trim();

  const parsedDetails = (aiDetails || [])
    .filter((d) => typeof d === 'string' && d.trim().length > 0)
    .slice(0, 4)
    .map((d, idx) => parseDetail(d, idx));

  const showCard = filteredNotes || parsedDetails.length > 0;
  if (!showCard) return null;

  return (
    <div style={{
      marginTop: 14, padding: 18, borderRadius: 'var(--card-radius)',
      background: 'var(--card-bg)',
      backdropFilter: 'var(--card-blur)', WebkitBackdropFilter: 'var(--card-blur)',
      border: 'none',
      boxShadow: 'var(--card-shadow)',
      animation: `fadeUp 0.5s ease-out ${animationDelay} both`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: accent, letterSpacing: 0.2 }}>
            AI 정밀 분석
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {makeupDetected && (
            <Badge label="메이크업 감지" color="#f0a050" bg="rgba(240,160,80,0.12)" />
          )}
          {analysisMode === 'cv_only' && (
            <Badge label="자체 분석" color="var(--text-muted)" bg="rgba(0,0,0,0.05)" />
          )}
        </div>
      </div>

      {/* Summary */}
      {filteredNotes && (
        <p style={{
          fontSize: 14, color: 'var(--text-primary)',
          lineHeight: 1.7, margin: 0, fontWeight: 500,
        }}>
          {filteredNotes}
        </p>
      )}

      {/* Details — chip row + accordion body */}
      {parsedDetails.length > 0 && (
        <div style={{ marginTop: filteredNotes ? 14 : 0 }}>
          <div style={{
            fontSize: 11, color: 'var(--text-muted)', marginBottom: 8,
            fontWeight: 500,
          }}>
            부위별 소견 — 탭해서 보세요
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {parsedDetails.map((d, idx) => {
              const open = openIdx === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setOpenIdx(open ? null : idx)}
                  style={{
                    padding: '7px 14px', borderRadius: 999,
                    border: 'none',
                    background: open ? accent : 'rgba(0,0,0,0.04)',
                    color: open ? '#fff' : 'var(--text-secondary)',
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.16s',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >{d.label}</button>
              );
            })}
          </div>

          {/* Accordion body — 한 번에 하나만 펼침 */}
          {openIdx != null && parsedDetails[openIdx] && (
            <div
              key={openIdx}
              style={{
                marginTop: 12, padding: '12px 14px', borderRadius: 14,
                background: 'rgba(0,0,0,0.025)',
                animation: 'aiDetailFade 0.22s ease-out',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 500, color: accent, marginBottom: 4 }}>
                {parsedDetails[openIdx].label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {parsedDetails[openIdx].body}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes aiDetailFade {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function Badge({ label, color, bg }) {
  return (
    <span style={{
      fontSize: 10, padding: '3px 8px', borderRadius: 999,
      background: bg, color,
      fontWeight: 500,
    }}>{label}</span>
  );
}

/**
 * "부위: 본문" 형식의 detail 문자열을 라벨/본문으로 분리.
 * 콜론 없거나 라벨이 너무 길면 fallback.
 */
function parseDetail(raw, idx) {
  const detail = raw.trim();
  // 풀-사이즈 콜론(:) 또는 한국어 콜론(:) 모두 처리
  let colonIdx = detail.indexOf(':');
  if (colonIdx < 0) colonIdx = detail.indexOf(':');

  // 콜론 없거나 너무 멀면 라벨 추출 안 함 — 번호로 표시
  if (colonIdx < 0 || colonIdx > 14) {
    return { label: `소견 ${idx + 1}`, body: detail };
  }

  const labelRaw = detail.slice(0, colonIdx).trim();
  const body = detail.slice(colonIdx + 1).trim();

  // 라벨이 6자 초과 (예: "이마/눈가/볼/코/턱") → 첫 항목 + "외"
  if (labelRaw.length > 6 && labelRaw.includes('/')) {
    const first = labelRaw.split('/')[0].trim();
    return { label: `${first} 외`, body };
  }
  // 그래도 7자 초과면 단순 truncate
  if (labelRaw.length > 7) {
    return { label: labelRaw.slice(0, 6) + '…', body };
  }

  return { label: labelRaw, body };
}

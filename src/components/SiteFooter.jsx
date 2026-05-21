import { useState } from 'react';
import { COMPANY_INFO, DPO_INFO, CONTACT_EMAIL } from '../legal/legalContent';

/**
 * SiteFooter — 전자상거래법·정보통신망법 표시 의무 (사업자 정보 11개 항목).
 *
 * MyPage 하단에 표시. 베타 출시 D-1(2026-05-21) 변호사 검토 결과 반영.
 * 표시 의무 위반 시 500만~1,000만원 과태료.
 *
 * onShowLegal({ key: 'terms'|'privacy'|'biometric' }) 콜백으로 약관 모달 트리거.
 */
export default function SiteFooter({ onShowLegal }) {
  const [expanded, setExpanded] = useState(false);

  const row = (label, value) => (
    <div style={{ display: 'flex', gap: 8, fontSize: 11.5, lineHeight: 1.7, color: 'var(--text-muted, #8B95A1)' }}>
      <span style={{ minWidth: 92, flexShrink: 0, color: 'var(--text-dim, #B0B8C1)' }}>{label}</span>
      <span style={{ color: 'var(--text-secondary, #6F7787)', wordBreak: 'keep-all' }}>{value}</span>
    </div>
  );

  return (
    <div style={{
      padding: '24px 18px calc(80px + env(safe-area-inset-bottom, 0px))',
      borderTop: '1px solid var(--border, rgba(255,255,255,0.06))',
      marginTop: 12,
      fontFamily: 'inherit',
    }}>
      {/* 약관 링크 row — 항상 노출 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginBottom: 14, fontSize: 12 }}>
        <button onClick={() => onShowLegal?.('terms')} style={linkBtnStyle}>이용약관</button>
        <span style={dotStyle}>·</span>
        <button onClick={() => onShowLegal?.('privacy')} style={{ ...linkBtnStyle, fontWeight: 600 }}>개인정보 처리방침</button>
        <span style={dotStyle}>·</span>
        <button onClick={() => onShowLegal?.('biometric')} style={linkBtnStyle}>생체정보 동의서</button>
        <span style={dotStyle}>·</span>
        <button onClick={() => onShowLegal?.('overseas')} style={linkBtnStyle}>국외 이전 동의</button>
      </div>

      {/* 사업자 정보 — expand 토글 */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          background: 'none', border: 'none', padding: 0,
          fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #6F7787)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          marginBottom: expanded ? 10 : 0,
        }}
      >
        사업자 정보
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.18s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 14 }}>
          {row('상호', COMPANY_INFO.name)}
          {row('대표자', COMPANY_INFO.ceo)}
          {row('사업자등록번호', COMPANY_INFO.bizNumber)}
          {row('통신판매업', COMPANY_INFO.ecommerceLicense)}
          {row('본사 주소', COMPANY_INFO.address)}
          {row('전화', COMPANY_INFO.phone)}
          {row('이메일', COMPANY_INFO.email)}
          {row('호스팅', COMPANY_INFO.hostingProvider)}
          {row('개인정보 보호책임자', `${DPO_INFO.name} (${DPO_INFO.title})`)}
        </div>
      )}

      <div style={{
        fontSize: 11, color: 'var(--text-dim, #B0B8C1)', lineHeight: 1.6,
      }}>
        본 서비스는 의료기기가 아닙니다. 분석 결과는 참고용이며 의학적 판단의 근거가 될 수 없습니다.
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim, #B0B8C1)', marginTop: 6 }}>
        © 2026 {COMPANY_INFO.name} · 문의 {CONTACT_EMAIL}
      </div>
    </div>
  );
}

const linkBtnStyle = {
  background: 'none', border: 'none', padding: 0,
  fontSize: 12, color: 'var(--text-secondary, #6F7787)',
  cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
  textUnderlineOffset: 2, textDecorationColor: 'rgba(127,135,144,0.3)',
};
const dotStyle = { color: 'var(--text-dim, #B0B8C1)', fontSize: 11 };

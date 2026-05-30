import { useState } from 'react';
import { COMPANY_INFO, DPO_INFO } from '../legal/legalContent';

/**
 * SiteFooter — 설정 하단 정보 블록.
 * 저작권 · 면책 · 사업자 정보를 하나의 블록으로.
 */
export default function SiteFooter() {
  const [expanded, setExpanded] = useState(false);

  const c = 'rgba(0,0,0,0.15)';

  return (
    <div style={{
      padding: '0 28px calc(80px + env(safe-area-inset-bottom, 0px))',
      marginTop: 44,
      fontSize: 12, fontWeight: 500, color: c, lineHeight: 1.8,
    }}>
      © 2026 {COMPANY_INFO.name} · v1.0.2<br />
      본 서비스는 의료 행위가 아닙니다.<br />
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          background: 'none', border: 'none', padding: 0, marginTop: 2,
          fontSize: 12, fontWeight: 500, color: c, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontFamily: 'inherit',
        }}
      >
        사업자 정보
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transition: 'transform 0.18s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {expanded && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '0 4px' }}>
          {[
            COMPANY_INFO.name,
            `대표 ${COMPANY_INFO.ceo}`,
            `사업자등록번호 ${COMPANY_INFO.bizNumber}`,
            `통신판매업 ${COMPANY_INFO.ecommerceLicense}`,
            COMPANY_INFO.address,
            COMPANY_INFO.phone,
            COMPANY_INFO.email,
            `개인정보 보호책임자 ${DPO_INFO.name}`,
          ].map((item, i, arr) => (
            <span key={i} style={{ whiteSpace: 'nowrap' }}>{item}{i < arr.length - 1 ? ' · ' : ''}</span>
          ))}
        </div>
      )}
    </div>
  );
}

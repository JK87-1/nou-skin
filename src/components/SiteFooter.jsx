import { useState } from 'react';
import { COMPANY_INFO, DPO_INFO, CONTACT_EMAIL } from '../legal/legalContent';

/**
 * SiteFooter — 설정 하단 통합 푸터.
 * 버전 · 로그아웃 · 사업자 정보 · 면책 · 저작권을 하나의 블록으로.
 */
export default function SiteFooter({ onLogout }) {
  const [expanded, setExpanded] = useState(false);

  const row = (label, value) => (
    <div style={{ display: 'flex', gap: 8, fontSize: 11, lineHeight: 1.7 }}>
      <span style={{ minWidth: 88, flexShrink: 0, color: 'rgba(0,0,0,0.3)' }}>{label}</span>
      <span style={{ color: 'rgba(0,0,0,0.45)', wordBreak: 'keep-all' }}>{value}</span>
    </div>
  );

  return (
    <div style={{
      padding: '32px 28px calc(80px + env(safe-area-inset-bottom, 0px))',
      marginTop: 24,
      textAlign: 'center',
    }}>
      {/* 버전 */}
      <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.25)', marginBottom: 16 }}>
        버전 1.0.2
      </div>

      {/* 로그아웃 */}
      {onLogout && (
        <div
          onClick={onLogout}
          style={{
            fontSize: 13, color: 'rgba(0,0,0,0.35)', cursor: 'pointer',
            marginBottom: 24,
          }}
        >
          로그아웃
        </div>
      )}

      {/* 구분선 */}
      <div style={{ width: 32, height: 1, background: 'rgba(0,0,0,0.08)', margin: '0 auto 20px' }} />

      {/* 면책 문구 */}
      <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)', lineHeight: 1.7, marginBottom: 16 }}>
        본 서비스는 의료기기가 아닙니다.<br />
        분석 결과는 참고용이며 의학적 판단의 근거가 될 수 없습니다.
      </div>

      {/* 사업자 정보 토글 */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          background: 'none', border: 'none', padding: 0,
          fontSize: 11, color: 'rgba(0,0,0,0.3)',
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
          marginBottom: expanded ? 12 : 0,
        }}
      >
        사업자 정보
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transition: 'transform 0.18s', transform: expanded ? 'rotate(180deg)' : 'none' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {expanded && (
        <div style={{ marginTop: 8, marginBottom: 16, fontSize: 11, color: 'rgba(0,0,0,0.35)', lineHeight: 1.8 }}>
          {COMPANY_INFO.name} · 대표 {COMPANY_INFO.ceo}<br />
          사업자등록번호 {COMPANY_INFO.bizNumber}<br />
          통신판매업 {COMPANY_INFO.ecommerceLicense}<br />
          {COMPANY_INFO.address}<br />
          {COMPANY_INFO.phone} · {COMPANY_INFO.email}<br />
          개인정보 보호책임자 {DPO_INFO.name} ({DPO_INFO.title})
        </div>
      )}

      {/* 저작권 */}
      <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.2)', marginTop: expanded ? 0 : 16 }}>
        © 2026 {COMPANY_INFO.name}
      </div>
    </div>
  );
}

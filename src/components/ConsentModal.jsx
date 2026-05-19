import { useState } from 'react';
import { TERMS_OF_SERVICE, PRIVACY_POLICY, BIOMETRIC_CONSENT, SERVICE_NAME } from '../legal/legalContent';

// 단순 마크다운 → React 노드 변환기. 외부 라이브러리 도입 회피.
function renderMarkdown(text) {
  return text.split('\n').map((line, i) => {
    const key = `l-${i}`;
    if (line.startsWith('### ')) {
      return <h3 key={key} style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '14px 0 6px' }}>{line.slice(4)}</h3>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={key} style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '18px 0 8px' }}>{line.slice(3)}</h2>;
    }
    if (line.startsWith('# ')) {
      return <h1 key={key} style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 14px' }}>{line.slice(2)}</h1>;
    }
    if (line.startsWith('|')) {
      return <div key={key} style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'pre', lineHeight: 1.6 }}>{line}</div>;
    }
    if (line.startsWith('- ')) {
      return <div key={key} style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '3px 0', paddingLeft: 14, lineHeight: 1.6 }}>• {line.slice(2)}</div>;
    }
    if (/^\d+\. /.test(line)) {
      return <div key={key} style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '3px 0', paddingLeft: 14, lineHeight: 1.6 }}>{line}</div>;
    }
    if (line === '') return <div key={key} style={{ height: 6 }} />;
    // **bold** inline 처리
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={key} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>
        {parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{p.slice(2, -2)}</strong>
            : p
        )}
      </p>
    );
  });
}

export default function ConsentModal({ onAccept }) {
  const [activeTab, setActiveTab] = useState('terms');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedBiometric, setAgreedBiometric] = useState(false);

  const allAgreed = agreedTerms && agreedPrivacy && agreedBiometric;

  const content = {
    terms: { title: '이용약관', text: TERMS_OF_SERVICE, agreed: agreedTerms, setAgreed: setAgreedTerms },
    privacy: { title: '개인정보 처리방침', text: PRIVACY_POLICY, agreed: agreedPrivacy, setAgreed: setAgreedPrivacy },
    biometric: { title: '사진 분석 안내', text: BIOMETRIC_CONSENT, agreed: agreedBiometric, setAgreed: setAgreedBiometric },
  };

  const current = content[activeTab];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#ffffff', zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      maxWidth: 480, margin: '0 auto',
    }}>
      <header style={{ padding: '24px 20px 14px', borderBottom: '1px solid var(--border, rgba(0,0,0,0.08))' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#5BA8D6', letterSpacing: 0.4, marginBottom: 4 }}>BETA</div>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
          {SERVICE_NAME}을(를) 시작하기 전<br />아래 사항에 동의해주세요
        </h1>
      </header>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border, rgba(0,0,0,0.08))' }}>
        {Object.entries(content).map(([key, c]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              flex: 1, padding: '12px 4px', background: 'none', border: 'none',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              color: activeTab === key ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === key ? '2px solid #5BA8D6' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {c.title}{c.agreed ? ' ✓' : ''}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 20px' }}>
        {renderMarkdown(current.text)}
      </div>

      <div style={{
        borderTop: '1px solid var(--border, rgba(0,0,0,0.08))',
        padding: '14px 20px 20px',
        background: '#ffffff',
      }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, marginBottom: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={current.agreed}
            onChange={e => current.setAgreed(e.target.checked)}
            style={{ marginTop: 2, accentColor: '#5BA8D6' }}
          />
          <span style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
            <strong>(필수) {current.title}</strong>의 내용을 모두 확인하였으며 이에 동의합니다.
          </span>
        </label>
        <button
          disabled={!allAgreed}
          onClick={onAccept}
          style={{
            width: '100%', padding: '14px', borderRadius: 12,
            background: allAgreed ? '#5BA8D6' : 'var(--border, rgba(0,0,0,0.1))',
            color: allAgreed ? '#fff' : 'var(--text-muted)',
            border: 'none', fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            cursor: allAgreed ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          {allAgreed ? '모두 동의하고 시작하기' : `세 가지 동의 항목을 모두 체크해주세요 (${[agreedTerms, agreedPrivacy, agreedBiometric].filter(Boolean).length}/3)`}
        </button>
      </div>
    </div>
  );
}

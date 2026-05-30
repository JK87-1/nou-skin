/**
 * PrecisionPaywall.jsx — 정밀 측정 결제 게이트 (mock)
 *
 * mock 결제 UI. 3가지 플랜:
 *   - 1회권:    ₩9,900
 *   - 월 5회권: ₩29,900 (1회당 ₩5,980)
 *   - 평생 패스: ₩99,000 (베타 한정)
 *
 * "결제하기" 클릭 시 즉시 unlock(localStorage). 실제 결제 연동 시 이 핸들러만 교체.
 */

import { useState } from 'react';
import { purchasePrecision } from '../storage/PrecisionStorage';
import { hapticLight, hapticSuccess } from '../utils/haptics';

const PLANS = [
  { id: 'single', label: '1회 정밀 측정', price: 9900, sub: '한 번 사용', perUse: 9900 },
  { id: 'monthly', label: '월 5회 패스', price: 29900, sub: '30일간 5회', perUse: 5980, badge: '인기' },
  { id: 'pass', label: '평생 패스', price: 99000, sub: '제한 없음 · 베타 한정', perUse: null, badge: 'BETA' },
];

export default function PrecisionPaywall({ onUnlock, onClose }) {
  const [selected, setSelected] = useState('monthly');
  const [processing, setProcessing] = useState(false);

  const handlePurchase = async () => {
    hapticLight();
    setProcessing(true);
    // mock 결제 지연 (실제 PG 연동 시 이 자리에)
    await new Promise(r => setTimeout(r, 600));
    purchasePrecision(selected);
    hapticSuccess();
    setProcessing(false);
    onUnlock?.(selected);
  };

  return (
    <div style={wrap}>
      <div style={topBar}>
        <button onClick={onClose} style={iconBtn} aria-label="닫기">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '24px 0 28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(88,174,254,0.15)', border: '1px solid rgba(88,174,254,0.3)', borderRadius: 999, marginBottom: 16 }}>
            <span style={{ color: '#58aefe', fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>✦ PRECISION MODE</span>
          </div>
          <div style={{ color: '#fff', fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 10 }}>
            정밀 측정 모드
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13.5, lineHeight: 1.65, padding: '0 16px' }}>
            정면·좌·우 3장의 사진으로 거울로도 못 보던 좌우 비대칭과<br/>
            부위별 임상급 분석을 받아보세요.
          </div>
        </div>

        {/* Features */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 18, marginBottom: 24 }}>
          <Feature title="좌·우 비대칭 분석" desc="다크서클·색소·붉은기·팔자·모공 5종" />
          <Feature title="부위별 9 영역 점수" desc="이마·볼·코·팔자·눈밑·턱 정밀 측정" />
          <Feature title="임상 발견 + 시술 카테고리" desc="패턴별 일반 정보 안내 (정보 제공)" />
          <Feature title="의사 톤 상세 판독" desc="300~450자 정밀 리포트" />
          <Feature title="결과 PNG 공유" desc="결과 화면 그대로 이미지 저장" last />
        </div>

        {/* Plans */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {PLANS.map(p => {
            const active = selected === p.id;
            return (
              <button
                key={p.id}
                onClick={() => { hapticLight(); setSelected(p.id); }}
                style={{
                  position: 'relative',
                  background: active ? 'rgba(88,174,254,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${active ? '#58aefe' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  transition: 'all 160ms ease',
                }}
              >
                {p.badge && (
                  <div style={{
                    position: 'absolute', top: -8, right: 14,
                    background: p.badge === 'BETA' ? '#f5a85c' : '#58aefe',
                    color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                    letterSpacing: 0.3,
                  }}>{p.badge}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: `2px solid ${active ? '#58aefe' : 'rgba(255,255,255,0.25)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {active && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#58aefe' }} />}
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontSize: 14.5, fontWeight: 700, marginBottom: 2 }}>{p.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5 }}>{p.sub}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>
                    ₩{p.price.toLocaleString()}
                  </div>
                  {p.perUse && p.perUse !== p.price && (
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5, marginTop: 2 }}>1회 ₩{p.perUse.toLocaleString()}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.6, marginBottom: 16, textAlign: 'center' }}>
          베타 기간 mock 결제 — 실제 차감되지 않습니다.<br/>
          GA 시점에 실제 PG 연동 예정.
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '12px 20px calc(env(safe-area-inset-bottom, 0px) + 16px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={handlePurchase}
          disabled={processing}
          style={{
            width: '100%', padding: 16,
            background: processing ? 'rgba(88,174,254,0.5)' : 'linear-gradient(135deg, #58aefe 0%, #6598ef 100%)',
            border: 'none', borderRadius: 14,
            color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: -0.2,
            cursor: processing ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 8px 24px rgba(88,174,254,0.3)',
          }}
        >
          {processing ? '결제 처리 중...' : `₩${PLANS.find(p=>p.id===selected).price.toLocaleString()} 결제하기`}
        </button>
      </div>
    </div>
  );
}

function Feature({ title, desc, last }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(88,174,254,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#58aefe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
      </div>
      <div>
        <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600, letterSpacing: -0.2, marginBottom: 2 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5 }}>{desc}</div>
      </div>
    </div>
  );
}

const wrap = {
  position: 'fixed', inset: 0, zIndex: 9700,
  background: 'linear-gradient(180deg, #0e1530 0%, #111118 100%)',
  height: '100dvh', display: 'flex', flexDirection: 'column',
};

const topBar = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 4px',
  flexShrink: 0,
};

const iconBtn = {
  width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none',
  cursor: 'pointer', padding: 0,
};

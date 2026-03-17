import { useRef } from "react";

export default function EternalPearl({ size = 280, animated = true, colors, theme }) {
  const id = useRef("ep-" + Math.random().toString(36).slice(2, 8)).current;
  const orbSize = Math.round(size * 0.54);

  return (
    <>
      {animated && (
        <style>{`
          @keyframes ${id}-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @keyframes ${id}-shimmer {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.02); }
          }
          @keyframes ${id}-halo {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(1.06); }
          }
        `}</style>
      )}
      <div style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: animated ? `${id}-float 6s ease-in-out infinite` : 'none',
      }}>

        {/* ═══ HALO GLOW (그림자/라인 없음) ═══ */}
        <div style={{
          position: 'absolute',
          width: orbSize * 2.0,
          height: orbSize * 2.0,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,179,71,0.08) 30%, rgba(255,140,66,0.03) 60%, transparent 70%)',
          animation: animated ? `${id}-halo 4s ease-in-out infinite` : 'none',
        }} />

        {/* ═══ FLOOR SHADOW ═══ */}
        <div style={{
          position: 'absolute',
          bottom: size * 0.12,
          width: orbSize * 1.1,
          height: orbSize * 0.18,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,140,66,0.25) 0%, rgba(255,170,136,0.12) 40%, transparent 70%)',
          filter: 'blur(8px)',
        }} />

        {/* ═══ ORB BODY ═══ */}
        <div style={{
          width: orbSize,
          height: orbSize,
          borderRadius: '50%',
          position: 'relative',
          /* 기본 구체 — 황금→오렌지→피치핑크 */
          background: `
            radial-gradient(circle at 36% 32%, #FFE880 0%, #FFD700 15%, #FF8C42 50%, #FFAA88 80%, #E87850 100%)
          `,
          boxShadow: `
            inset 0 -8px 20px rgba(200,80,40,0.25),
            inset 0 6px 15px rgba(255,230,140,0.2),
            0 4px 30px rgba(255,140,66,0.3),
            0 8px 60px rgba(255,140,66,0.15),
            0 0 80px rgba(255,215,0,0.08)
          `,
          overflow: 'hidden',
        }}>

          {/* 이리데슨트 오팔 레이어 1 — 우측 핑크 */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'radial-gradient(circle at 68% 45%, rgba(255,170,200,0.3) 0%, transparent 45%)',
            mixBlendMode: 'screen',
          }} />

          {/* 이리데슨트 오팔 레이어 2 — 좌하단 골드 */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 70%, rgba(255,215,0,0.2) 0%, transparent 40%)',
            mixBlendMode: 'screen',
          }} />

          {/* 이리데슨트 오팔 레이어 3 — 상단 시안-골드 시머 */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'radial-gradient(circle at 55% 25%, rgba(255,240,180,0.15) 0%, transparent 35%)',
            mixBlendMode: 'overlay',
            animation: animated ? `${id}-shimmer 5s ease-in-out infinite` : 'none',
          }} />


          {/* ═══ 좌상단 메인 하이라이트 (크고 부드럽게) ═══ */}
          <div style={{
            position: 'absolute',
            top: '12%', left: '14%',
            width: '45%', height: '38%',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 45% 42%, rgba(255,255,240,0.85) 0%, rgba(255,245,200,0.4) 30%, rgba(255,230,160,0.1) 60%, transparent 100%)',
            filter: 'blur(2px)',
          }} />

          {/* 좌상단 날카로운 스펙큘러 포인트 */}
          <div style={{
            position: 'absolute',
            top: '18%', left: '22%',
            width: '14%', height: '10%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 40%, transparent 100%)',
          }} />

          {/* ═══ 우하단 보조 하이라이트 ═══ */}
          <div style={{
            position: 'absolute',
            bottom: '18%', right: '20%',
            width: '12%', height: '10%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,220,180,0.08) 50%, transparent 100%)',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '22%', right: '24%',
            width: '5%', height: '4%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 100%)',
          }} />

          {/* ═══ 중앙 하단 핑크빛 반사광 ═══ */}
          <div style={{
            position: 'absolute',
            bottom: '8%', left: '30%',
            width: '40%', height: '20%',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 50% 60%, rgba(255,170,180,0.2) 0%, rgba(255,150,160,0.08) 50%, transparent 100%)',
            filter: 'blur(3px)',
          }} />

        </div>
      </div>
    </>
  );
}

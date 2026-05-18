/**
 * 메인 오브 — 구름처럼 부드럽게 퍼지는 효과 + 급격한 이동
 * 화이트 · 밝은레몬 · 레몬 · 형광옐로우
 */
import { useRef } from "react";

const orbStyles = `
.lua-orb { isolation: isolate; }
.lua-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(24px);
  -webkit-filter: blur(24px);
  opacity: 0.85;
  will-change: transform, opacity;
}
.lua-blob-1 {
  width: 75%; height: 75%;
  background: radial-gradient(circle, #FFFFFF, #FFF9B0);
  top: 5%; left: 8%;
  animation: luaDrift1 4s ease-in-out infinite;
}
.lua-blob-2 {
  width: 65%; height: 65%;
  background: radial-gradient(circle, #FFE500, #FFD600);
  bottom: 5%; right: 5%;
  opacity: 0.9;
  animation: luaDrift2 5s ease-in-out infinite;
}
.lua-blob-3 {
  width: 55%; height: 55%;
  background: radial-gradient(circle, #FFEB3B, #FDD835);
  top: 38%; left: 30%;
  opacity: 0.85;
  animation: luaDrift3 3.5s ease-in-out infinite;
}
.lua-blob-4 {
  width: 60%; height: 60%;
  background: radial-gradient(circle, #FFF176, #FFEE58);
  top: 3%; right: 5%;
  animation: luaDrift4 4.5s ease-in-out infinite;
}
.lua-blob-5a {
  width: 80%; height: 25%;
  background: radial-gradient(ellipse, rgba(200,251,220,0.35) 0%, rgba(200,251,220,0.15) 40%, transparent 70%);
  filter: blur(18px);
  -webkit-filter: blur(18px);
  top: -5%; left: 10%;
  opacity: 0.7;
  animation: luaWave1 8s ease-in-out infinite;
}
.lua-blob-5b {
  width: 25%; height: 80%;
  background: radial-gradient(ellipse, rgba(200,251,220,0.3) 0%, rgba(200,251,220,0.12) 40%, transparent 70%);
  filter: blur(18px);
  -webkit-filter: blur(18px);
  top: 10%; right: -5%;
  opacity: 0.6;
  animation: luaWave2 9s ease-in-out infinite;
}
.lua-blob-5c {
  width: 80%; height: 25%;
  background: radial-gradient(ellipse, rgba(200,251,220,0.32) 0%, rgba(200,251,220,0.13) 40%, transparent 70%);
  filter: blur(18px);
  -webkit-filter: blur(18px);
  bottom: -5%; left: 10%;
  opacity: 0.65;
  animation: luaWave3 7.5s ease-in-out infinite;
}
.lua-blob-5d {
  width: 25%; height: 80%;
  background: radial-gradient(ellipse, rgba(200,251,220,0.3) 0%, rgba(200,251,220,0.12) 40%, transparent 70%);
  filter: blur(18px);
  -webkit-filter: blur(18px);
  top: 10%; left: -5%;
  opacity: 0.6;
  animation: luaWave4 8.5s ease-in-out infinite;
}

@keyframes luaWave1 {
  0%, 100% { transform: translateX(0) scaleX(1); opacity: 0.7; }
  25%  { transform: translateX(15%) scaleX(1.25); opacity: 0.9; }
  50%  { transform: translateX(-5%) scaleX(0.95); opacity: 0.6; }
  75%  { transform: translateX(-12%) scaleX(0.85); opacity: 0.8; }
}
@keyframes luaWave2 {
  0%, 100% { transform: translateY(0) scaleY(1); opacity: 0.65; }
  30%  { transform: translateY(15%) scaleY(1.2); opacity: 0.85; }
  60%  { transform: translateY(-12%) scaleY(0.8); opacity: 0.55; }
}
@keyframes luaWave3 {
  0%, 100% { transform: translateX(0) scaleX(1); opacity: 0.65; }
  20%  { transform: translateX(-15%) scaleX(1.2); opacity: 0.85; }
  45%  { transform: translateX(5%) scaleX(0.95); opacity: 0.55; }
  70%  { transform: translateX(12%) scaleX(0.85); opacity: 0.8; }
}
@keyframes luaWave4 {
  0%, 100% { transform: translateY(0) scaleY(1); opacity: 0.6; }
  25%  { transform: translateY(-15%) scaleY(1.25); opacity: 0.8; }
  55%  { transform: translateY(12%) scaleY(0.85); opacity: 0.5; }
}
@keyframes luaDrift1 {
  0%   { transform: translate(0, 0) scale(1.05); opacity: 0.9; }
  12%  { transform: translate(8%, 5%) scale(1.15); opacity: 0.95; }
  28%  { transform: translate(25%, -20%) scale(0.85); opacity: 1; }
  42%  { transform: translate(18%, -15%) scale(1.25); opacity: 0.8; }
  58%  { transform: translate(-8%, 12%) scale(1.15); opacity: 0.9; }
  75%  { transform: translate(-22%, 16%) scale(0.9); opacity: 0.95; }
  100% { transform: translate(0, 0) scale(1.05); opacity: 0.9; }
}
@keyframes luaDrift2 {
  0%   { transform: translate(0, 0) scale(1); opacity: 0.85; }
  18%  { transform: translate(-28%, -20%) scale(1.2); opacity: 0.6; }
  32%  { transform: translate(-22%, -15%) scale(1.35); opacity: 0.95; }
  48%  { transform: translate(12%, 25%) scale(0.7); opacity: 0.75; }
  65%  { transform: translate(8%, 18%) scale(1.15); opacity: 0.9; }
  82%  { transform: translate(25%, -10%) scale(0.85); opacity: 0.8; }
  100% { transform: translate(0, 0) scale(1); opacity: 0.85; }
}
@keyframes luaDrift3 {
  0%   { transform: translate(0, 0) scale(1); opacity: 0.8; }
  15%  { transform: translate(25%, -28%) scale(1.3); opacity: 0.9; }
  35%  { transform: translate(20%, -22%) scale(1.4); opacity: 0.55; }
  52%  { transform: translate(-20%, 8%) scale(0.75); opacity: 1; }
  72%  { transform: translate(-10%, 25%) scale(1.15); opacity: 0.7; }
  100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
}
@keyframes luaDrift4 {
  0%   { transform: translate(0, 0) scale(1); opacity: 0.85; }
  20%  { transform: translate(-25%, 28%) scale(1.25); opacity: 0.6; }
  38%  { transform: translate(-20%, 22%) scale(1.35); opacity: 0.9; }
  55%  { transform: translate(28%, -8%) scale(0.75); opacity: 0.8; }
  75%  { transform: translate(20%, -25%) scale(1.2); opacity: 0.95; }
  100% { transform: translate(0, 0) scale(1); opacity: 0.85; }
}
`;

export default function EternalPearl({ size = 280, animated = true }) {
  const orbSize = Math.round(size * 0.85);

  return (
    <>
      <style>{orbStyles}</style>
      <div style={{
        position: 'relative',
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* 뒤쪽 확대 오브 */}
        <div style={{
          position: 'absolute',
          width: size * 1.3, height: size * 1.3,
          borderRadius: '50%',
          overflow: 'hidden',
          opacity: 0.25,
          mask: 'radial-gradient(circle, rgba(0,0,0,1) 25%, rgba(0,0,0,0) 70%)',
          WebkitMask: 'radial-gradient(circle, rgba(0,0,0,1) 25%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }}>
          <div className="lua-orb" style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFFFFF, #FFE500)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div className="lua-blob lua-blob-3" style={{ animationDelay: '-3s' }} />
            <div className="lua-blob lua-blob-1" style={{ animationDelay: '-5s' }} />
            <div className="lua-blob lua-blob-4" style={{ animationDelay: '-2s' }} />
            <div className="lua-blob lua-blob-2" style={{ animationDelay: '-7s' }} />
            <div className="lua-blob lua-blob-5a" style={{ animationDelay: '-3s' }} />
            <div className="lua-blob lua-blob-5b" style={{ animationDelay: '-5s' }} />
            <div className="lua-blob lua-blob-5c" style={{ animationDelay: '-2s' }} />
            <div className="lua-blob lua-blob-5d" style={{ animationDelay: '-6s' }} />
          </div>
        </div>

        {/* 가장자리 글로우 — 메인 오브 바로 뒤 */}
        <div style={{
          position: 'absolute',
          width: orbSize * 1.08, height: orbSize * 1.08,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,245,160,0.5) 40%, rgba(255,240,140,0.2) 65%, transparent 80%)',
          filter: 'blur(8px)', WebkitFilter: 'blur(8px)',
          pointerEvents: 'none',
        }} />

        {/* 메인 오브 */}
        <div style={{
          width: orbSize, height: orbSize, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="lua-orb" style={{
            width: orbSize, height: orbSize, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFFFFF, #FFE500)',
            position: 'relative', overflow: 'hidden',
            clipPath: 'circle(50%)', WebkitClipPath: 'circle(50%)',
          }}>
            <div className="lua-blob lua-blob-1" />
            <div className="lua-blob lua-blob-2" />
            <div className="lua-blob lua-blob-3" />
            <div className="lua-blob lua-blob-4" />
            <div className="lua-blob lua-blob-5a" />
            <div className="lua-blob lua-blob-5b" />
            <div className="lua-blob lua-blob-5c" />
            <div className="lua-blob lua-blob-5d" />
          </div>
        </div>
      </div>
    </>
  );
}

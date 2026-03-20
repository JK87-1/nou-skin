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
  filter: blur(28px);
  -webkit-filter: blur(28px);
  opacity: 0.75;
  will-change: transform, opacity;
}
.lua-blob-1 {
  width: 70%; height: 70%;
  background: radial-gradient(circle, #FFFFFF, #F8F8F8);
  top: 5%; left: 8%;
  animation: luaDrift1 6s ease-in-out infinite;
}
.lua-blob-2 {
  width: 60%; height: 60%;
  background: radial-gradient(circle, #FFF9B0, #FFF59D);
  bottom: 5%; right: 5%;
  opacity: 0.85;
  animation: luaDrift2 7.5s ease-in-out infinite;
}
.lua-blob-3 {
  width: 50%; height: 50%;
  background: radial-gradient(circle, #FFF176, #FFEE58);
  top: 38%; left: 30%;
  opacity: 0.75;
  animation: luaDrift3 5.5s ease-in-out infinite;
}
.lua-blob-4 {
  width: 55%; height: 55%;
  background: radial-gradient(circle, #DFFF00, #E6FF00);
  top: 3%; right: 5%;
  animation: luaDrift4 7s ease-in-out infinite;
}
.lua-blob-5a {
  width: 80%; height: 25%;
  background: radial-gradient(ellipse, rgba(152,251,203,0.7) 0%, rgba(152,251,203,0.3) 40%, transparent 70%);
  filter: blur(18px);
  -webkit-filter: blur(18px);
  top: -5%; left: 10%;
  opacity: 0.7;
  animation: luaWave1 8s ease-in-out infinite;
}
.lua-blob-5b {
  width: 25%; height: 80%;
  background: radial-gradient(ellipse, rgba(152,251,203,0.6) 0%, rgba(152,251,203,0.25) 40%, transparent 70%);
  filter: blur(18px);
  -webkit-filter: blur(18px);
  top: 10%; right: -5%;
  opacity: 0.6;
  animation: luaWave2 9s ease-in-out infinite;
}
.lua-blob-5c {
  width: 80%; height: 25%;
  background: radial-gradient(ellipse, rgba(152,251,203,0.65) 0%, rgba(152,251,203,0.3) 40%, transparent 70%);
  filter: blur(18px);
  -webkit-filter: blur(18px);
  bottom: -5%; left: 10%;
  opacity: 0.65;
  animation: luaWave3 7.5s ease-in-out infinite;
}
.lua-blob-5d {
  width: 25%; height: 80%;
  background: radial-gradient(ellipse, rgba(152,251,203,0.6) 0%, rgba(152,251,203,0.25) 40%, transparent 70%);
  filter: blur(18px);
  -webkit-filter: blur(18px);
  top: 10%; left: -5%;
  opacity: 0.6;
  animation: luaWave4 8.5s ease-in-out infinite;
}

@keyframes luaWave1 {
  0%, 100% { transform: translateX(0) scaleX(1); opacity: 0.6; }
  30%  { transform: translateX(10%) scaleX(1.15); opacity: 0.8; }
  60%  { transform: translateX(-8%) scaleX(0.9); opacity: 0.5; }
}
@keyframes luaWave2 {
  0%, 100% { transform: translateY(0) scaleY(1); opacity: 0.55; }
  35%  { transform: translateY(10%) scaleY(1.12); opacity: 0.75; }
  65%  { transform: translateY(-8%) scaleY(0.88); opacity: 0.5; }
}
@keyframes luaWave3 {
  0%, 100% { transform: translateX(0) scaleX(1); opacity: 0.55; }
  25%  { transform: translateX(-10%) scaleX(1.1); opacity: 0.75; }
  55%  { transform: translateX(8%) scaleX(0.92); opacity: 0.5; }
}
@keyframes luaWave4 {
  0%, 100% { transform: translateY(0) scaleY(1); opacity: 0.5; }
  30%  { transform: translateY(-10%) scaleY(1.15); opacity: 0.7; }
  60%  { transform: translateY(8%) scaleY(0.9); opacity: 0.45; }
}
@keyframes luaDrift1 {
  0%   { transform: translate(0, 0) scale(1); opacity: 0.7; }
  15%  { transform: translate(5%, 3%) scale(1.1); opacity: 0.75; }
  30%  { transform: translate(22%, -18%) scale(0.85); opacity: 0.9; }
  45%  { transform: translate(18%, -15%) scale(1.2); opacity: 0.6; }
  60%  { transform: translate(-5%, 8%) scale(1.15); opacity: 0.8; }
  80%  { transform: translate(-20%, 15%) scale(0.9); opacity: 0.7; }
  100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
}
@keyframes luaDrift2 {
  0%   { transform: translate(0, 0) scale(1); opacity: 0.8; }
  20%  { transform: translate(-22%, -15%) scale(1.15); opacity: 0.65; }
  35%  { transform: translate(-18%, -12%) scale(1.25); opacity: 0.85; }
  50%  { transform: translate(8%, 20%) scale(0.8); opacity: 0.7; }
  70%  { transform: translate(6%, 15%) scale(1.1); opacity: 0.75; }
  85%  { transform: translate(18%, -8%) scale(0.95); opacity: 0.8; }
  100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
}
@keyframes luaDrift3 {
  0%   { transform: translate(0, 0) scale(1); opacity: 0.7; }
  18%  { transform: translate(18%, -20%) scale(1.2); opacity: 0.8; }
  40%  { transform: translate(15%, -16%) scale(1.3); opacity: 0.55; }
  55%  { transform: translate(-15%, 5%) scale(0.85); opacity: 0.85; }
  75%  { transform: translate(-6%, 18%) scale(1.1); opacity: 0.65; }
  100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
}
@keyframes luaDrift4 {
  0%   { transform: translate(0, 0) scale(1); opacity: 0.75; }
  22%  { transform: translate(-18%, 20%) scale(1.18); opacity: 0.6; }
  40%  { transform: translate(-15%, 16%) scale(1.25); opacity: 0.8; }
  58%  { transform: translate(20%, -5%) scale(0.85); opacity: 0.7; }
  78%  { transform: translate(15%, -18%) scale(1.1); opacity: 0.85; }
  100% { transform: translate(0, 0) scale(1); opacity: 0.75; }
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
          opacity: 0.5,
          mask: 'radial-gradient(circle, rgba(0,0,0,1) 25%, rgba(0,0,0,0) 70%)',
          WebkitMask: 'radial-gradient(circle, rgba(0,0,0,1) 25%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }}>
          <div className="lua-orb" style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFFFFF, #DFFF00)',
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

        {/* 메인 오브 */}
        <div style={{
          width: orbSize, height: orbSize, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="lua-orb" style={{
            width: orbSize, height: orbSize, borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFFFFF, #DFFF00)',
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

/**
 * SoftCloverIcon — LUA Pearl Icon
 * 18가지 컬러 테마 지원
 *
 * ── 사용법 ──────────────────────────────────────────────────
 *   import SoftCloverIcon from "@/components/icons/SoftCloverIcon";
 *
 *   <SoftCloverIcon />
 *   <SoftCloverIcon theme="onyxBlack" size={64} showBg />
 *   <SoftCloverIcon theme="champagneGold" size={48} showBg animate={false} />
 *
 * ── Props ────────────────────────────────────────────────────
 *   theme    : string  — THEMES 키값. 기본값 "morningLight"
 *   size     : number  — 아이콘 크기(px). 기본값 200
 *   showBg   : boolean — 그라데이션 앱 아이콘 배경. 기본값 false
 *   bgRadius : number  — showBg 시 border-radius(px). 기본값 size×0.224
 *   animate  : boolean — 플로팅 애니메이션. 기본값 true
 *   className: string  — SVG 추가 클래스
 *   style    : object  — SVG 추가 인라인 스타일
 *
 * ── 전체 18 테마 ─────────────────────────────────────────────
 *   Vol.1 (컬러)
 *     morningLight · roseGold · navySapphire · sunsetPeach
 *     sunsetAmber · coralBlush · aquaMint
 *
 *   Vol.2 (컬러)
 *     cherryBlossom · deepEmerald · smokyMauve
 *     deepOcean · sunrisePeach · warmSand
 *
 *   Vol.3 (럭셔리 뉴트럴)
 *     onyxBlack · obsidianGray · lunaWhite
 *     pureIvory · cashmereBeige · champagneGold
 */

import { useId } from "react";

// ─── 팔레트 ─────────────────────────────────────────────────────
// rg  : 프레임 linearGradient  [4 stops: light→mid-light→mid-dark→dark]
// mop : MoP 인레이 radialGradient [6 stops: light→dark]
// iri : 이리데슨트 시머 base color
// cp  : 중앙 진주 radialGradient [5 stops]
// sh  : 드롭 섀도우 flood-color
// ────────────────────────────────────────────────────────────────
export const THEMES = {

  // ── 라이트모드 ───────────────────────────────────────────────

  morningLight: {
    label: "모닝 라이트",
    rg:  ["#F0FFF8", "#A8E6CF", "#5EC6B0", "#2A8A70"],
    mop: ["#FAFFFC", "#E8F8F0", "#C0ECD8", "#88D4BC", "#50B898", "#2A8A70"],
    iri: "#FEF9C3",
    cp:  ["#fff", "#F0FFF8", "#C8F0E0", "#88D4BC", "#3A8868"],
    sh:  "#0A2818",
  },

  springBlossom: {
    label: "스프링 블라썸",
    rg:  ["#F0F8FF", "#A8D8F0", "#5EB8E0", "#2A7AAA"],
    mop: ["#FAFCFF", "#E8F4FC", "#C0E0F4", "#88C8E8", "#50A0D0", "#2A7AAA"],
    iri: "#FFC0D0",
    cp:  ["#fff", "#F0F8FF", "#C8E8F8", "#88C8E8", "#2A7AAA"],
    sh:  "#081840",
  },

  // ── 다크모드 ─────────────────────────────────────────────────

  midnightMoon: {
    label: "미드나이트 문",
    rg:  ["#FFF5E8", "#9AC8E8", "#4080B0", "#1A2A40"],
    mop: ["#FFF5E8", "#D8E8F0", "#9AC8E8", "#5898C0", "#2A5878", "#1A2A40"],
    iri: "#FFF5E8",
    cp:  ["#fff", "#FFF5E8", "#D8E8F0", "#9AC8E8", "#2A5878"],
    sh:  "#081828",
  },

  mysticNight: {
    label: "미스틱 나이트",
    rg:  ["#E0D0F0", "#B898D8", "#7858A8", "#1A1830"],
    mop: ["#F0E8F8", "#E0D0F0", "#C0A8D8", "#9878B8", "#684888", "#1A1830"],
    iri: "#6898E8",
    cp:  ["#fff", "#F0E8F8", "#D8C8E8", "#B898D8", "#684888"],
    sh:  "#100828",
  },
};

export const THEME_KEYS = Object.keys(THEMES);

// ─── 컴포넌트 ────────────────────────────────────────────────────
export default function SoftCloverIcon({
  theme     = "morningLight",
  size      = 200,
  showBg    = false,
  bgRadius,
  animate   = true,
  className,
  style,
}) {
  const uid = useId().replace(/:/g, "");
  const p   = THEMES[theme] ?? THEMES.morningLight;

  const id = {
    rg:  `${uid}rg`,
    mop: `${uid}mop`,
    iri: `${uid}iri`,
    cp:  `${uid}cp`,
    pgl: `${uid}pgl`,
    sh:  `${uid}sh`,
    leafShade: `${uid}ls`,
    centerShade: `${uid}cs`,
  };

  // 4잎 좌표 — 좌우 대칭 배치 (상, 하, 좌, 우)
  const D = 38;
  const leaves = [
    { cx: 100,     cy: 100 - D, rot: 0   },  // 상
    { cx: 100 + D, cy: 100,     rot: 0   },  // 우
    { cx: 100,     cy: 100 + D, rot: 0   },  // 하
    { cx: 100 - D, cy: 100,     rot: 0   },  // 좌
  ];

  const floatAnim = null;

  const svgEl = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      style={style}
      aria-label={`LUA — ${p.label}`}
    >
      <defs>
        {/* 프레임 linearGradient */}
        <linearGradient id={id.rg} x1="10%" y1="0%" x2="90%" y2="100%">
          <stop offset="0%"   stopColor={p.rg[0]} />
          <stop offset="30%"  stopColor={p.rg[1]} />
          <stop offset="60%"  stopColor={p.rg[2]} />
          <stop offset="100%" stopColor={p.rg[3]} />
        </linearGradient>

        {/* MoP 인레이 radialGradient — 6 stops */}
        <radialGradient id={id.mop} cx="42%" cy="36%" r="56%">
          <stop offset="0%"   stopColor={p.mop[0]} />
          <stop offset="18%"  stopColor={p.mop[1]} />
          <stop offset="40%"  stopColor={p.mop[2]} />
          <stop offset="62%"  stopColor={p.mop[3]} />
          <stop offset="82%"  stopColor={p.mop[4]} />
          <stop offset="100%" stopColor={p.mop[5]} />
        </radialGradient>

        {/* 이리데슨트 시머 */}
        <radialGradient id={id.iri} cx="56%" cy="60%" r="42%">
          <stop offset="0%"   stopColor={p.iri} stopOpacity="0.22" />
          <stop offset="50%"  stopColor={p.iri} stopOpacity="0.09" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>

        {/* 중앙 진주 */}
        <radialGradient id={id.cp} cx="38%" cy="32%" r="56%">
          <stop offset="0%"   stopColor={p.cp[0]} />
          <stop offset="22%"  stopColor={p.cp[1]} />
          <stop offset="50%"  stopColor={p.cp[2]} />
          <stop offset="78%"  stopColor={p.cp[3]} />
          <stop offset="100%" stopColor={p.cp[4]} />
        </radialGradient>

        {/* 진주 글로우 필터 */}
        <filter id={id.pgl}>
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* 드롭 섀도우 필터 */}
        <filter id={id.sh} x="-25%" y="-10%" width="150%" height="138%">
          <feDropShadow
            dx="0" dy="5" stdDeviation="7"
            floodColor={p.sh} floodOpacity="0.32"
          />
        </filter>
        {/* 잎 음영 */}
        <radialGradient id={id.leafShade} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="60%" stopColor="#e0e0e0" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#c0c0c0" stopOpacity="0.18" />
        </radialGradient>

        {/* 중앙 원 음영 */}
        <radialGradient id={id.centerShade} cx="38%" cy="35%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#FBEC5D" stopOpacity="0" />
          <stop offset="100%" stopColor="#70D4A8" stopOpacity="0.15" />
        </radialGradient>
      </defs>

      <g filter={`url(#${id.sh})`}>
        {floatAnim}

        {/* 레이어 1 — 잎 베이스 (흰색) */}
        {leaves.map((l, i) => (
          <ellipse key={`f${i}`}
            cx={l.cx} cy={l.cy} rx="34" ry="34"
            fill="white"
          />
        ))}

        {/* 레이어 2 — 은은한 음영 */}
        {leaves.map((l, i) => (
          <ellipse key={`s${i}`}
            cx={l.cx} cy={l.cy} rx="34" ry="34"
            fill={`url(#${id.leafShade})`}
          />
        ))}

        {/* 잎 하이라이트 */}
        <ellipse cx="100" cy="52" rx="12" ry="9" fill="white" opacity="0.6" />
        <ellipse cx="62" cy="100" rx="9" ry="12" fill="white" opacity="0.4" />

        {/* 중앙 원 — 노란색 + 약간의 입체감 */}
        <circle cx="100" cy="100" r="30" fill="#FBEC5D" />
        <circle cx="100" cy="100" r="30" fill={`url(#${id.centerShade})`} />
        <ellipse cx="95" cy="93" rx="8" ry="5" fill="white" opacity="0.4" />
      </g>
    </svg>
  );

  if (!showBg) return svgEl;

  const r = bgRadius ?? Math.round(size * 0.224);
  return (
    <div style={{
      width:          size,
      height:         size,
      borderRadius:   r,
      background:     `linear-gradient(148deg, ${p.rg[1]}, ${p.rg[2]} 52%, ${p.rg[3]})`,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      position:       "relative",
      overflow:       "hidden",
      flexShrink:     0,
    }}>
      {/* 광택 오버레이 */}
      <div style={{
        position:      "absolute",
        inset:         0,
        background:    "linear-gradient(148deg, rgba(255,255,255,.38) 0%, rgba(255,255,255,.05) 42%, transparent 100%)",
        pointerEvents: "none",
      }} />
      {svgEl}
    </div>
  );
}

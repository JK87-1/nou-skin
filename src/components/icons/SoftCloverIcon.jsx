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
 *   theme    : string  — THEMES 키값. 기본값 "verteDeH"
 *   size     : number  — 아이콘 크기(px). 기본값 200
 *   showBg   : boolean — 그라데이션 앱 아이콘 배경. 기본값 false
 *   bgRadius : number  — showBg 시 border-radius(px). 기본값 size×0.224
 *   animate  : boolean — 플로팅 애니메이션. 기본값 true
 *   className: string  — SVG 추가 클래스
 *   style    : object  — SVG 추가 인라인 스타일
 *
 * ── 전체 18 테마 ─────────────────────────────────────────────
 *   Vol.1 (컬러)
 *     verteDeH · roseGold · navySapphire · sunsetPeach
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

  // ── Vol.1 — 컬러 ───────────────────────────────────────────────

  verteDeH: {
    label: "베르도",
    rg:  ["#C8D8A8", "#6A9A6A", "#3A6A44", "#1E3C2A"],
    mop: ["#F2FFF6", "#D8EEDC", "#B4D4C0", "#80AA98", "#4A7868", "#2A5040"],
    iri: "#6EE7B7",
    cp:  ["#fff", "#EEF8F4", "#C8E8DC", "#8ABAA8", "#3A6858"],
    sh:  "#0A2818",
  },

  roseGold: {
    label: "로즈 골드",
    rg:  ["#f4d4c4", "#dca894", "#c48878", "#a06860"],
    mop: ["#fff8f2", "#f8ece0", "#f0d8c8", "#dbb8ae", "#c09898", "#987070"],
    iri: "#fbcfe8",
    cp:  ["#fff", "#faf0ee", "#e0c8cc", "#b898a0", "#886070"],
    sh:  "#401828",
  },

  navySapphire: {
    label: "미드나잇 네이비",
    rg:  ["#C8D8F8", "#6898E8", "#2858C8", "#0C2888"],
    mop: ["#FFF0E8", "#FFD8C0", "#98B0D8", "#6080B8", "#304878", "#182848"],
    iri: "#fde0c0",
    cp:  ["#fff", "#FFF0E8", "#FFD8C0", "#E0A070", "#905020"],
    sh:  "#301000",
  },

  sunsetPeach: {
    label: "선셋 피치",
    rg:  ["#FFE8D0", "#FFBF90", "#E88050", "#C05828"],
    mop: ["#FFF5E8", "#FFD8C0", "#FFD88A", "#E89868", "#A85838", "#581800"],
    iri: "#fde0c0",
    cp:  ["#fff", "#FFF5E8", "#FFD8C0", "#E8A878", "#A85838"],
    sh:  "#3C0800",
  },

  sunsetAmber: {
    label: "선셋 앰버",
    rg:  ["#FFF0C8", "#F8C860", "#E89018", "#A85C00"],
    mop: ["#FEF9EC", "#F8E8A0", "#F0CC60", "#D8A030", "#A06810", "#603000"],
    iri: "#fde68a",
    cp:  ["#fff", "#FEF9EC", "#F8E0A0", "#D8A850", "#905018"],
    sh:  "#3C1800",
  },

  coralBlush: {
    label: "코랄 블러쉬",
    rg:  ["#FFE8E0", "#F8B090", "#E87050", "#C03828"],
    mop: ["#FEF4F0", "#F8D0C0", "#F0A888", "#D87860", "#A84838", "#601818"],
    iri: "#fed7aa",
    cp:  ["#fff", "#FEF4F0", "#F8C8B0", "#E09080", "#A84838"],
    sh:  "#3C0C08",
  },

  aquaMint: {
    label: "아쿠아 민트",
    rg:  ["#C8F5EE", "#70D8C8", "#20A898", "#0A6868"],
    mop: ["#EEF9F8", "#B8ECE4", "#88D4CC", "#50B0A8", "#288078", "#104848"],
    iri: "#6ee7b7",
    cp:  ["#fff", "#EEF9F8", "#B8ECE4", "#68C0B8", "#287868"],
    sh:  "#022828",
  },

  // ── Vol.2 — 컬러 ───────────────────────────────────────────────

  cherryBlossom: {
    label: "체리 블라썸",
    rg:  ["#FFE4EE", "#F4A8C8", "#D85898", "#A02870"],
    mop: ["#FFF5FA", "#FBE0EE", "#F4C0DC", "#E898C0", "#C06898", "#883060"],
    iri: "#f9a8d4",
    cp:  ["#fff", "#FDF4F8", "#F8D8E8", "#E8A8CC", "#C06890"],
    sh:  "#50082C",
  },

  deepEmerald: {
    label: "딥 에메랄드",
    rg:  ["#B8EED0", "#50C888", "#1A8850", "#0A4828"],
    mop: ["#F0FFF8", "#C8F0DC", "#90D8B8", "#50A880", "#207850", "#084830"],
    iri: "#34d399",
    cp:  ["#fff", "#F0FFF8", "#C8EED8", "#80C8A8", "#287858"],
    sh:  "#022818",
  },

  smokyMauve: {
    label: "스모키 모브",
    rg:  ["#E8D8E8", "#C098C0", "#906090", "#583858"],
    mop: ["#F8F0F8", "#E8D0E8", "#D0A8D0", "#B080B0", "#785878", "#483048"],
    iri: "#e879f9",
    cp:  ["#fff", "#F8F0F8", "#E8D0E8", "#C898C8", "#885888"],
    sh:  "#280828",
  },

  deepOcean: {
    label: "딥 오션",
    rg:  ["#B0D8F0", "#5098D0", "#1058A8", "#082860"],
    mop: ["#EEF6FC", "#C0DCF4", "#88B8E0", "#4888C0", "#185898", "#083060"],
    iri: "#7dd3fc",
    cp:  ["#fff", "#EEF6FC", "#C8E0F4", "#88B8E0", "#2868B0"],
    sh:  "#021840",
  },

  sunrisePeach: {
    label: "선라이즈 피치",
    rg:  ["#FEEBD0", "#F8C080", "#E88038", "#B04800"],
    mop: ["#FFF8EE", "#FEEBD0", "#F8D0A0", "#F0A860", "#C06820", "#783000"],
    iri: "#fdba74",
    cp:  ["#fff", "#FFF8EE", "#F8DFB0", "#F0B868", "#C07028"],
    sh:  "#401800",
  },

  warmSand: {
    label: "웜 샌드",
    rg:  ["#FFF8F0", "#F0D8C0", "#D0A080", "#906040"],
    mop: ["#FAFAFA", "#FFF0E0", "#F0D0B0", "#D8B898", "#B88860", "#604020"],
    iri: "#fdd8b0",
    cp:  ["#fff", "#FFF8F0", "#FFE8D0", "#E0C0A0", "#A07850"],
    sh:  "#200C00",
  },

  // ── Vol.3 — 럭셔리 뉴트럴 ──────────────────────────────────────

  onyxBlack: {
    label: "오닉스 블랙",
    rg:  ["#5A5A5A", "#2C2C2C", "#141414", "#060606"],
    mop: ["#484848", "#303030", "#1E1E1E", "#121212", "#080808", "#020202"],
    iri: "#FFB347",
    cp:  ["#fff", "#EBEBF4", "#C8C8DC", "#8888A8", "#303050"],
    sh:  "#000000",
  },

  obsidianGray: {
    label: "오브시디언 그레이",
    rg:  ["#909090", "#606060", "#383838", "#1C1C1C"],
    mop: ["#808080", "#646464", "#484848", "#303030", "#1A1A1A", "#0A0A0A"],
    iri: "#FFB347",
    cp:  ["#fff", "#F0F0F8", "#D4D4E4", "#A0A0BC", "#484868"],
    sh:  "#080808",
  },

  lunaWhite: {
    label: "루나 화이트",
    rg:  ["#FFFFFF", "#F4F4F4", "#E4E4E4", "#CCCCCC"],
    mop: ["#FFFFFF", "#FAFAFA", "#F4F4F4", "#EBEBEB", "#D8D8D8", "#C0C0C0"],
    iri: "#FFF5E8",
    cp:  ["#fff", "#FFF8F0", "#ECEFF8", "#D4D8EC", "#9898C0"],
    sh:  "#606080",
  },

  pureIvory: {
    label: "퓨어 아이보리",
    rg:  ["#FFFFF2", "#F8F4DC", "#EDE8C4", "#D8D0A8"],
    mop: ["#FFFFF8", "#FBF8EC", "#F4EFD8", "#EBE6C4", "#D4CCA8", "#B8B088"],
    iri: "#fef9c3",
    cp:  ["#fff", "#FFFEF8", "#F8F4E4", "#E8E0C4", "#C8BEA0"],
    sh:  "#504830",
  },

  cashmereBeige: {
    label: "캐시미어 베이지",
    rg:  ["#EEE0C8", "#D0BC9C", "#B09878", "#88745A"],
    mop: ["#F4EAD8", "#EAE0CC", "#DDD0B8", "#C8BA9C", "#A89070", "#786848"],
    iri: "#fde68a",
    cp:  ["#fff", "#FAF5EE", "#EEE4D4", "#D8CAB0", "#B0A07C"],
    sh:  "#2C1C08",
  },

  champagneGold: {
    label: "샴페인 골드",
    rg:  ["#FFF6E0", "#F0D898", "#D8B060", "#B88830"],
    mop: ["#FFFCF0", "#FBF3D4", "#F4E8B4", "#E8D490", "#D0B060", "#A88030"],
    iri: "#fef3c7",
    cp:  ["#fff", "#FFFCF0", "#FAF0D0", "#ECE0A8", "#D0B868"],
    sh:  "#402808",
  },
};

export const THEME_KEYS = Object.keys(THEMES);

// ─── 컴포넌트 ────────────────────────────────────────────────────
export default function SoftCloverIcon({
  theme     = "verteDeH",
  size      = 200,
  showBg    = false,
  bgRadius,
  animate   = true,
  className,
  style,
}) {
  const uid = useId().replace(/:/g, "");
  const p   = THEMES[theme] ?? THEMES.verteDeH;

  const id = {
    rg:  `${uid}rg`,
    mop: `${uid}mop`,
    iri: `${uid}iri`,
    cp:  `${uid}cp`,
    pgl: `${uid}pgl`,
    sh:  `${uid}sh`,
  };

  // 4잎 좌표 — angle offset -45°, D=38
  const D = 38;
  const leaves = [0, 90, 180, 270].map((angle) => {
    const rad = (angle - 45) * (Math.PI / 180);
    return {
      cx:  parseFloat((100 + Math.cos(rad) * D).toFixed(3)),
      cy:  parseFloat((100 + Math.sin(rad) * D).toFixed(3)),
      rot: angle,
    };
  });

  const floatAnim = animate ? (
    <animateTransform
      attributeName="transform"
      type="translate"
      values="0,0;0,-3;0,0"
      dur="5s"
      repeatCount="indefinite"
    />
  ) : null;

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
      </defs>

      <g filter={`url(#${id.sh})`}>
        {floatAnim}

        {/* 레이어 1 — 프레임 rx=38 */}
        {leaves.map((l, i) => (
          <ellipse key={`f${i}`}
            cx={l.cx} cy={l.cy} rx="38" ry="38"
            fill={`url(#${id.rg})`}
            transform={`rotate(${l.rot},100,100)`}
          />
        ))}

        {/* 레이어 2 — MoP 인레이 rx=34 */}
        {leaves.map((l, i) => (
          <ellipse key={`m${i}`}
            cx={l.cx} cy={l.cy} rx="34" ry="34"
            fill={`url(#${id.mop})`}
          />
        ))}

        {/* 레이어 3 — 이리데슨트 시머 rx=34 */}
        {leaves.map((l, i) => (
          <ellipse key={`i${i}`}
            cx={l.cx} cy={l.cy} rx="34" ry="34"
            fill={`url(#${id.iri})`}
          />
        ))}

        {/* 하이라이트 — 좌상단 잎 */}
        <ellipse cx="53" cy="50" rx="14" ry="11" fill="white" opacity="0.35" />
        <ellipse cx="50" cy="47" rx="7"  ry="5"  fill="white" opacity="0.6"  />
        <ellipse cx="48" cy="45" rx="3"  ry="2.5" fill="white" opacity="0.85" />

        {/* 미세 하이라이트 — 우상단·좌하단 잎 */}
        <ellipse cx="145" cy="58"  rx="8" ry="6" fill="white" opacity="0.12" />
        <ellipse cx="140" cy="145" rx="6" ry="8" fill="white" opacity="0.08" />

        {/* 중앙 진주 + 글로우 */}
        <g filter={`url(#${id.pgl})`}>
          <circle cx="100" cy="100" r="20" fill={`url(#${id.cp})`} />
        </g>
        <circle cx="100" cy="100" r="20"
          fill="none" stroke={`url(#${id.rg})`} strokeWidth="3" />
        <ellipse cx="94" cy="93" rx="8"   ry="5.5" fill="white" opacity="0.5"  />
        <ellipse cx="92" cy="91" rx="4"   ry="3"   fill="white" opacity="0.8"  />
        <ellipse cx="91" cy="90" rx="2"   ry="1.5" fill="white" opacity="0.95" />
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

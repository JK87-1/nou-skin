import { useRef } from 'react';
import { COLORS } from '../../design/tokens';

// ── Theme palettes (10-stop for smooth pearl gradient) ──
const DARK_STOPS = [
  { offset: '0%', color: '#f4ecff' },
  { offset: '8%', color: '#ece0fc' },
  { offset: '18%', color: '#dcd0f4' },
  { offset: '28%', color: '#ccbce8' },
  { offset: '40%', color: '#b8a4dc' },
  { offset: '52%', color: '#a48cce' },
  { offset: '64%', color: '#8c74bc' },
  { offset: '76%', color: '#745ca8' },
  { offset: '88%', color: '#5c4494' },
  { offset: '100%', color: '#402880' },
];
const LIGHT_STOPS = [
  { offset: '0%', color: '#fffaff' },
  { offset: '8%', color: '#f8f2ff' },
  { offset: '18%', color: '#f0e6fa' },
  { offset: '28%', color: '#e4d6f2' },
  { offset: '40%', color: '#d4c2e8' },
  { offset: '52%', color: '#c4aede' },
  { offset: '64%', color: '#b098d0' },
  { offset: '76%', color: '#9880c0' },
  { offset: '88%', color: '#7c66ac' },
  { offset: '100%', color: '#503898' },
];
const DARK_GLOW = { primary: '#89cef5', secondary: '#FFD4B8' };
const LIGHT_GLOW = { primary: '#7c3aed', secondary: '#aed8f7' };

// ── Shared SVG fragments ──

function PearlDefs({ id, stops, theme, glow }) {
  const isLight = theme === 'light';
  return (
    <>
      {/* Pearl body gradient */}
      <radialGradient id={`${id}-base`} cx="38%" cy="34%" r="62%">
        {stops.map((s, i) => (
          <stop key={i} offset={s.offset} stopColor={s.color} />
        ))}
      </radialGradient>

      {/* Subsurface scattering */}
      <radialGradient id={`${id}-sss`} cx="58%" cy="60%" r="35%">
        <stop offset="0%" stopColor={isLight ? '#ffc0dc' : '#d4a0c8'} stopOpacity={isLight ? '0.25' : '0.18'} />
        <stop offset="50%" stopColor={isLight ? '#eeb0d0' : '#b888b8'} stopOpacity="0.08" />
        <stop offset="100%" stopColor="transparent" />
      </radialGradient>

      {/* Iridescence layers */}
      <radialGradient id={`${id}-iri-indigo`} cx="62%" cy="64%" r="38%">
        <stop offset="0%" stopColor="#aed8f7" stopOpacity="0.3" />
        <stop offset="50%" stopColor="#aed8f7" stopOpacity="0.1" />
        <stop offset="100%" stopColor="#aed8f7" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-iri-pink`} cx="68%" cy="42%" r="30%">
        <stop offset="0%" stopColor="#E06888" stopOpacity="0.18" />
        <stop offset="50%" stopColor="#E06888" stopOpacity="0.06" />
        <stop offset="100%" stopColor="#E06888" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-iri-teal`} cx="42%" cy="72%" r="25%">
        <stop offset="0%" stopColor="#F0C878" stopOpacity="0.1" />
        <stop offset="100%" stopColor="#F0C878" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-iri-gold`} cx="72%" cy="55%" r="22%">
        <stop offset="0%" stopColor="#F0B870" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#F0B870" stopOpacity="0" />
      </radialGradient>

      {/* Fresnel rim */}
      <radialGradient id={`${id}-fresnel`} cx="50%" cy="50%" r="50%">
        <stop offset="78%" stopColor="transparent" />
        <stop offset="88%" stopColor={isLight ? '#d8c8f0' : glow.secondary} stopOpacity={isLight ? '0.18' : '0.12'} />
        <stop offset="94%" stopColor="white" stopOpacity={isLight ? '0.25' : '0.1'} />
        <stop offset="100%" stopColor="white" stopOpacity="0.05" />
      </radialGradient>

      {/* Rim light */}
      <radialGradient id={`${id}-rim`} cx="50%" cy="50%" r="50%">
        <stop offset="88%" stopColor="transparent" />
        <stop offset="96%" stopColor={glow.secondary} stopOpacity="0.08" />
        <stop offset="100%" stopColor="transparent" />
      </radialGradient>

      {/* Main sheen */}
      <radialGradient id={`${id}-sheen`} cx="33%" cy="30%" r="30%">
        <stop offset="0%" stopColor="white" stopOpacity="0.98" />
        <stop offset="15%" stopColor="white" stopOpacity="0.65" />
        <stop offset="35%" stopColor="white" stopOpacity="0.2" />
        <stop offset="60%" stopColor="white" stopOpacity="0.04" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </radialGradient>

      {/* Sharp specular pinpoint */}
      <radialGradient id={`${id}-spec`} cx="30%" cy="26%" r="10%">
        <stop offset="0%" stopColor="white" stopOpacity="1" />
        <stop offset="50%" stopColor="white" stopOpacity="0.7" />
        <stop offset="80%" stopColor="white" stopOpacity="0.1" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </radialGradient>

      {/* Drop shadow */}
      <filter id={`${id}-shadow`}>
        <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor="#6d28d9" floodOpacity="0.3" />
      </filter>

      {/* Highlight blur (legacy) */}
      <filter id={`${id}-hlBlur`}>
        <feGaussianBlur stdDeviation="2" />
      </filter>

      {/* Highlight glow */}
      <filter id={`${id}-glow`}>
        <feGaussianBlur stdDeviation="2.5" result="b" />
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </>
  );
}

function PearlBody({ id }) {
  return (
    <>
      {/* Pearl sphere */}
      <circle cx="100" cy="100" r="56" fill={`url(#${id}-base)`} filter={`url(#${id}-shadow)`} />
      {/* Subsurface scattering */}
      <circle cx="100" cy="100" r="56" fill={`url(#${id}-sss)`} />
      {/* Iridescence */}
      <circle cx="100" cy="100" r="56" fill={`url(#${id}-iri-indigo)`} />
      <circle cx="100" cy="100" r="56" fill={`url(#${id}-iri-pink)`} />
      <circle cx="100" cy="100" r="56" fill={`url(#${id}-iri-teal)`} />
      <circle cx="100" cy="100" r="56" fill={`url(#${id}-iri-gold)`} />
      {/* Fresnel rim */}
      <circle cx="100" cy="100" r="56" fill={`url(#${id}-fresnel)`} />
      {/* Rim light */}
      <circle cx="100" cy="100" r="56" fill={`url(#${id}-rim)`} />
      {/* Edge light */}
      <circle cx="100" cy="100" r="55.5" fill="none" stroke="white" strokeWidth="0.8" opacity="0.1" />
      {/* Sheen */}
      <circle cx="100" cy="100" r="56" fill={`url(#${id}-sheen)`} />
      {/* Sharp specular */}
      <circle cx="100" cy="100" r="56" fill={`url(#${id}-spec)`} />
      {/* Highlight cluster */}
      <ellipse cx="80" cy="76" rx="10" ry="7.5" fill="white" opacity="0.65" filter={`url(#${id}-glow)`} />
      <circle cx="76" cy="70" r="4" fill="white" opacity="0.95" />
      <circle cx="72" cy="65" r="1.8" fill="white" opacity="0.7" />
      <circle cx="86" cy="82" r="1.2" fill="white" opacity="0.2" />
      {/* Bottom reflected light */}
      <circle cx="118" cy="120" r="2.5" fill="white" opacity="0.08" />
      <circle cx="120" cy="116" r="1" fill="white" opacity="0.15" />
    </>
  );
}

// ── Variant: Living Pearl ──

function LivingPearl({ id, animated, stops, theme, glow }) {
  return (
    <>
      <defs>
        <PearlDefs id={id} stops={stops} theme={theme} glow={glow} />
        {/* Aura layers */}
        <radialGradient id={`${id}-aura1`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="65%" stopColor={glow.primary} stopOpacity="0.12" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`${id}-aura2`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="60%" stopColor={glow.primary} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`${id}-aura3`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="70%" stopColor={glow.primary} stopOpacity="0.05" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* 3-layer aura */}
      <circle cx="100" cy="100" r="96" fill={`url(#${id}-aura1)`}
        className={animated ? 'aura-ring-1' : undefined}
        style={animated ? { transformOrigin: '100px 100px' } : undefined} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-aura2)`}
        className={animated ? 'aura-ring-2' : undefined}
        style={animated ? { transformOrigin: '100px 100px' } : undefined} />
      <circle cx="100" cy="100" r="82" fill={`url(#${id}-aura3)`}
        className={animated ? 'aura-ring-3' : undefined}
        style={animated ? { transformOrigin: '100px 100px' } : undefined} />

      {/* Aura ring lines */}
      <circle cx="100" cy="100" r="86" fill="none" stroke={glow.primary} strokeWidth="0.6" opacity="0.08" />
      <circle cx="100" cy="100" r="76" fill="none" stroke={glow.primary} strokeWidth="0.4" opacity="0.06" />

      <PearlBody id={id} />
    </>
  );
}

// ── Variant: Eternal Pearl ──

function EternalPearl({ id, animated, stops, theme, glow }) {
  return (
    <>
      <defs>
        <PearlDefs id={id} stops={stops} theme={theme} glow={glow} />
        {/* Halo glow */}
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="30%" stopColor={glow.primary} stopOpacity="0.18" />
          <stop offset="50%" stopColor={glow.primary} stopOpacity="0.08" />
          <stop offset="68%" stopColor={glow.secondary} stopOpacity="0.03" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        {/* Halo blur filter */}
        <filter id={`${id}-haloBlur`}>
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* Halo glow fill */}
      <circle cx="100" cy="100" r="98" fill={`url(#${id}-halo)`}
        className={animated ? 'aura-ring-1' : undefined}
        style={animated ? { transformOrigin: '100px 100px' } : undefined} />

      {/* Halo rings */}
      <circle cx="100" cy="100" r="78" fill="none" stroke={glow.primary}
        strokeWidth="5" opacity="0.04" filter={`url(#${id}-haloBlur)`} />
      <circle cx="100" cy="100" r="78" fill="none" stroke={glow.primary}
        strokeWidth="1" opacity="0.1" />
      <circle cx="100" cy="100" r="70" fill="none" stroke={glow.primary}
        strokeWidth="0.5" opacity="0.05" />

      <PearlBody id={id} />

      {/* Pearl edge light */}
      <circle cx="100" cy="100" r="53.5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.05" />
    </>
  );
}

// ── Variant: Aurora Pearl ──

function AuroraPearl({ id, animated, stops, theme, glow }) {
  return (
    <>
      <defs>
        <PearlDefs id={id} stops={stops} theme={theme} glow={glow} />
        {/* Aura layers (same as living) */}
        <radialGradient id={`${id}-aura1`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="65%" stopColor={glow.primary} stopOpacity="0.12" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`${id}-aura2`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="60%" stopColor={glow.primary} stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        {/* Directional auras */}
        <radialGradient id={`${id}-dir-purple`} cx="30%" cy="30%" r="40%">
          <stop offset="0%" stopColor="#89cef5" stopOpacity="0.1" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`${id}-dir-teal`} cx="70%" cy="70%" r="40%">
          <stop offset="0%" stopColor="#F0C878" stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        {/* Aurora bands on surface */}
        <linearGradient id={`${id}-aurora1`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" stopOpacity="0.2" />
          <stop offset="33%" stopColor="#aed8f7" stopOpacity="0.15" />
          <stop offset="66%" stopColor="#89cef5" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#F0B870" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id={`${id}-aurora2`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E06888" stopOpacity="0.12" />
          <stop offset="50%" stopColor="#89cef5" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      {/* Aura layers */}
      <circle cx="100" cy="100" r="96" fill={`url(#${id}-aura1)`}
        className={animated ? 'aura-ring-1' : undefined}
        style={animated ? { transformOrigin: '100px 100px' } : undefined} />
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-aura2)`}
        className={animated ? 'aura-ring-2' : undefined}
        style={animated ? { transformOrigin: '100px 100px' } : undefined} />

      {/* Directional auras */}
      <circle cx="100" cy="100" r="88" fill={`url(#${id}-dir-purple)`}
        className={animated ? 'aura-ring-3' : undefined}
        style={animated ? { transformOrigin: '100px 100px' } : undefined} />
      <circle cx="100" cy="100" r="88" fill={`url(#${id}-dir-teal)`} />

      {/* Aura ring lines */}
      <circle cx="100" cy="100" r="86" fill="none" stroke={glow.primary} strokeWidth="0.6" opacity="0.08" />
      <circle cx="100" cy="100" r="76" fill="none" stroke={glow.primary} strokeWidth="0.4" opacity="0.06" />

      <PearlBody id={id} />

      {/* Aurora bands over pearl surface */}
      <circle cx="100" cy="100" r="56" fill={`url(#${id}-aurora1)`} />
      <circle cx="100" cy="100" r="56" fill={`url(#${id}-aurora2)`} />

      {/* Surface flow lines */}
      <path d="M65,85 Q85,75 100,80 T135,90" fill="none" stroke="white" strokeWidth="0.5" opacity="0.05" />
      <path d="M70,105 Q90,95 110,100 T140,108" fill="none" stroke="#FFD4B8" strokeWidth="0.4" opacity="0.04" />
      <path d="M60,115 Q80,110 105,112 T145,118" fill="none" stroke="#67e8f9" strokeWidth="0.3" opacity="0.03" />
    </>
  );
}

// ── Variant: Cosmic Pearl ──

const STAR_POINTS = [
  { cx: 30, cy: 45, r: 0.6, o: 0.2 },
  { cx: 155, cy: 35, r: 0.5, o: 0.15 },
  { cx: 170, cy: 120, r: 0.8, o: 0.25 },
  { cx: 25, cy: 140, r: 0.4, o: 0.12 },
  { cx: 60, cy: 30, r: 0.7, o: 0.18 },
  { cx: 145, cy: 165, r: 0.5, o: 0.1 },
  { cx: 180, cy: 75, r: 0.6, o: 0.22 },
  { cx: 40, cy: 170, r: 0.4, o: 0.13 },
  { cx: 120, cy: 25, r: 0.5, o: 0.16 },
  { cx: 15, cy: 90, r: 0.7, o: 0.2 },
];

function CosmicPearl({ id, animated, stops, theme, glow }) {
  return (
    <>
      <defs>
        <PearlDefs id={id} stops={stops} theme={theme} glow={glow} />
        {/* Nebula cloud blur */}
        <filter id={`${id}-nebula`}>
          <feGaussianBlur stdDeviation="10" />
        </filter>
        {/* Nebula gradients */}
        <radialGradient id={`${id}-neb-purple`} cx="25%" cy="28%" r="35%">
          <stop offset="0%" stopColor="#89cef5" stopOpacity="0.15" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`${id}-neb-indigo`} cx="75%" cy="68%" r="30%">
          <stop offset="0%" stopColor="#aed8f7" stopOpacity="0.12" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`${id}-neb-pink`} cx="65%" cy="25%" r="28%">
          <stop offset="0%" stopColor="#E06888" stopOpacity="0.1" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`${id}-neb-teal`} cx="30%" cy="75%" r="25%">
          <stop offset="0%" stopColor="#F0C878" stopOpacity="0.08" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Nebula clouds */}
      <circle cx="100" cy="100" r="98" fill={`url(#${id}-neb-purple)`} filter={`url(#${id}-nebula)`}
        className={animated ? 'aura-ring-1' : undefined}
        style={animated ? { transformOrigin: '100px 100px' } : undefined} />
      <circle cx="100" cy="100" r="98" fill={`url(#${id}-neb-indigo)`} filter={`url(#${id}-nebula)`}
        className={animated ? 'aura-ring-2' : undefined}
        style={animated ? { transformOrigin: '100px 100px' } : undefined} />
      <circle cx="100" cy="100" r="98" fill={`url(#${id}-neb-pink)`} filter={`url(#${id}-nebula)`}
        className={animated ? 'aura-ring-3' : undefined}
        style={animated ? { transformOrigin: '100px 100px' } : undefined} />
      <circle cx="100" cy="100" r="98" fill={`url(#${id}-neb-teal)`} filter={`url(#${id}-nebula)`} />

      {/* Star points */}
      {STAR_POINTS.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.o} />
      ))}

      {/* Pearl body (slightly smaller: r=52) */}
      <circle cx="100" cy="100" r="52" fill={`url(#${id}-base)`} filter={`url(#${id}-shadow)`} />
      <circle cx="100" cy="100" r="52" fill={`url(#${id}-sss)`} />
      <circle cx="100" cy="100" r="52" fill={`url(#${id}-iri-indigo)`} />
      <circle cx="100" cy="100" r="52" fill={`url(#${id}-iri-pink)`} />
      <circle cx="100" cy="100" r="52" fill={`url(#${id}-iri-teal)`} />
      <circle cx="100" cy="100" r="52" fill={`url(#${id}-iri-gold)`} />
      <circle cx="100" cy="100" r="52" fill={`url(#${id}-fresnel)`} />
      <circle cx="100" cy="100" r="52" fill={`url(#${id}-rim)`} />
      <circle cx="100" cy="100" r="51.5" fill="none" stroke="white" strokeWidth="0.8" opacity="0.1" />
      <circle cx="100" cy="100" r="52" fill={`url(#${id}-sheen)`} />
      <circle cx="100" cy="100" r="52" fill={`url(#${id}-spec)`} />
      {/* Highlight cluster */}
      <ellipse cx="80" cy="76" rx="8" ry="6.5" fill="white" opacity="0.65" filter={`url(#${id}-glow)`} />
      <circle cx="76" cy="70" r="3.2" fill="white" opacity="0.95" />
      <circle cx="72" cy="66" r="1.4" fill="white" opacity="0.7" />
      <circle cx="86" cy="82" r="1" fill="white" opacity="0.2" />
      <circle cx="116" cy="118" r="2.2" fill="white" opacity="0.08" />
      <circle cx="118" cy="114" r="0.8" fill="white" opacity="0.15" />
    </>
  );
}

// ── Main Component ──

export default function AuraPearl({ variant = 'living', size = 60, theme = 'dark', animated = false, colors }) {
  const uid = useRef(Math.random().toString(36).slice(2, 8)).current;
  const id = `${variant}-${size}-${uid}`;

  let stops, glow;
  if (colors) {
    const [c0, c1, c2] = colors.pearl;
    stops = [
      { offset: '0%', color: c0 },
      { offset: '15%', color: c0 },
      { offset: '35%', color: c1 },
      { offset: '55%', color: c1 },
      { offset: '75%', color: c2 },
      { offset: '88%', color: c2 },
      { offset: '100%', color: c2 },
    ];
    glow = { primary: colors.accent, secondary: colors.sub || colors.accent };
  } else {
    stops = theme === 'light' ? LIGHT_STOPS : DARK_STOPS;
    glow = theme === 'light' ? LIGHT_GLOW : DARK_GLOW;
  }

  const props = { id, animated, stops, theme, glow };

  const variants = {
    living: LivingPearl,
    eternal: EternalPearl,
    aurora: AuroraPearl,
    cosmic: CosmicPearl,
  };
  const Variant = variants[variant] || LivingPearl;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <Variant {...props} />
    </svg>
  );
}

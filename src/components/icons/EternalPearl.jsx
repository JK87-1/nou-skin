import { useRef } from "react";

export default function EternalPearl({ size = 280, animated = true, colors, theme }) {
  const id = useRef("ep-" + Math.random().toString(36).slice(2, 8)).current;
  const isLight = theme === 'light';
  const accent = colors?.accent || '#F09070';
  const sub = colors?.sub || '#FFD4B8';
  const p = colors?.pearl;

  const baseStops = p
    ? [['0%', p[0]], ['15%', p[0]], ['35%', p[1]], ['55%', p[1]], ['75%', p[2]], ['90%', p[2]], ['100%', p[2]]]
    : isLight
      ? [
          ['0%', '#fffaff'], ['6%', '#f8f2ff'], ['14%', '#f0e6fa'],
          ['24%', '#e4d6f2'], ['35%', '#d4c2e8'], ['46%', '#c4aede'],
          ['58%', '#b098d0'], ['70%', '#9880c0'], ['82%', '#7c66ac'],
          ['93%', '#604c96'], ['100%', '#503c88'],
        ]
      : [
          ['0%', '#f4ecff'], ['6%', '#ece0fc'], ['14%', '#dcd0f4'],
          ['24%', '#ccbce8'], ['35%', '#b8a4dc'], ['46%', '#a48cce'],
          ['58%', '#8c74bc'], ['70%', '#745ca8'], ['82%', '#5c4494'],
          ['93%', '#442e7e'], ['100%', '#341e6c'],
        ];

  const sparkles = [
    { x: 118, y: 76, r: 1.5, cross: true, dur: 3, del: 0 },
    { x: 64, y: 96, r: 1.2, cross: true, dur: 2.5, del: 0.8 },
    { x: 108, y: 138, r: 1.3, cross: true, dur: 3.5, del: 1.5 },
    { x: 90, y: 56, r: 0.8, cross: false, dur: 2.8, del: 2 },
    { x: 140, y: 105, r: 1, cross: false, dur: 3.2, del: 0.4 },
    { x: 72, y: 118, r: 0.9, cross: false, dur: 2.2, del: 1.2 },
  ];

  return (
    <>
      {animated && (
        <style>{`
          @keyframes ${id}-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          @keyframes ${id}-p1 {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.03); }
          }
          @keyframes ${id}-p2 {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.75; transform: scale(1.05); }
          }
          @keyframes ${id}-spk {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
          }
        `}</style>
      )}
      <div style={{
        position: 'relative',
        animation: animated ? `${id}-float 6s ease-in-out infinite` : 'none',
      }}>
        <svg width={size} height={size} viewBox="0 0 200 200" fill="none" style={{ overflow: 'visible' }}>
          <defs>
            {/* Pearl base — rich multi-stop */}
            <radialGradient id={`${id}-base`} cx="38%" cy="34%" r="62%">
              {baseStops.map(([off, col], i) => <stop key={i} offset={off} stopColor={col}/>)}
            </radialGradient>

            {/* Subsurface scattering */}
            <radialGradient id={`${id}-sss`} cx="58%" cy="60%" r="35%">
              <stop offset="0%" stopColor={isLight ? '#ffc0dc' : '#d4a0c8'} stopOpacity={isLight ? '0.3' : '0.2'}/>
              <stop offset="50%" stopColor={isLight ? '#eeb0d0' : '#b888b8'} stopOpacity="0.1"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>

            {/* Depth volume */}
            <radialGradient id={`${id}-depth`} cx="55%" cy="58%" r="48%">
              <stop offset="0%" stopColor={isLight ? '#d0b8e8' : '#8868b0'} stopOpacity="0.12"/>
              <stop offset="60%" stopColor={isLight ? '#b8a0d8' : '#7058a0'} stopOpacity="0.05"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>

            {/* Iridescence — indigo */}
            <radialGradient id={`${id}-irid`} cx="60%" cy="62%" r="38%">
              <stop offset="0%" stopColor="#F0A878" stopOpacity="0.3"/>
              <stop offset="50%" stopColor="#F0A878" stopOpacity="0.1"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>
            {/* Iridescence — pink */}
            <radialGradient id={`${id}-pink`} cx="66%" cy="42%" r="28%">
              <stop offset="0%" stopColor="#E06888" stopOpacity="0.18"/>
              <stop offset="50%" stopColor="#E06888" stopOpacity="0.06"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>
            {/* Iridescence — teal */}
            <radialGradient id={`${id}-teal`} cx="38%" cy="72%" r="25%">
              <stop offset="0%" stopColor="#F0C878" stopOpacity="0.1"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>
            {/* Iridescence — gold */}
            <radialGradient id={`${id}-gold`} cx="72%" cy="55%" r="22%">
              <stop offset="0%" stopColor="#F0B870" stopOpacity="0.08"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>

            {/* Fresnel rim */}
            <radialGradient id={`${id}-fresnel`} cx="50%" cy="50%" r="50%">
              <stop offset="78%" stopColor="transparent"/>
              <stop offset="88%" stopColor={isLight ? '#d8c8f0' : '#a888d8'} stopOpacity={isLight ? '0.2' : '0.15'}/>
              <stop offset="94%" stopColor="white" stopOpacity={isLight ? '0.28' : '0.12'}/>
              <stop offset="100%" stopColor="white" stopOpacity="0.06"/>
            </radialGradient>

            {/* Primary sheen */}
            <radialGradient id={`${id}-sheen`} cx="33%" cy="30%" r="30%">
              <stop offset="0%" stopColor="white" stopOpacity="0.98"/>
              <stop offset="15%" stopColor="white" stopOpacity="0.7"/>
              <stop offset="35%" stopColor="white" stopOpacity="0.25"/>
              <stop offset="60%" stopColor="white" stopOpacity="0.05"/>
              <stop offset="100%" stopColor="white" stopOpacity="0"/>
            </radialGradient>

            {/* Sharp specular pinpoint */}
            <radialGradient id={`${id}-spec`} cx="30%" cy="26%" r="10%">
              <stop offset="0%" stopColor="white" stopOpacity="1"/>
              <stop offset="50%" stopColor="white" stopOpacity="0.7"/>
              <stop offset="80%" stopColor="white" stopOpacity="0.1"/>
              <stop offset="100%" stopColor="white" stopOpacity="0"/>
            </radialGradient>

            {/* Halo */}
            <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
              <stop offset="32%" stopColor={accent} stopOpacity={isLight ? '0.1' : '0.18'}/>
              <stop offset="50%" stopColor={accent} stopOpacity="0.05"/>
              <stop offset="68%" stopColor={sub} stopOpacity="0.02"/>
              <stop offset="100%" stopColor="transparent"/>
            </radialGradient>

            {/* Filters */}
            <filter id={`${id}-sh`}>
              <feDropShadow dx="0" dy="5" stdDeviation="14"
                floodColor={p ? p[2] : (isLight ? '#9878c0' : '#6d28d9')}
                floodOpacity={isLight ? "0.25" : "0.4"}/>
            </filter>
            <filter id={`${id}-gl`}>
              <feGaussianBlur stdDeviation="2.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id={`${id}-hb`}>
              <feGaussianBlur stdDeviation="5"/>
            </filter>
            <filter id={`${id}-sg`}>
              <feGaussianBlur stdDeviation="1.5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>

            <clipPath id={`${id}-cp`}>
              <circle cx="100" cy="100" r="54"/>
            </clipPath>
          </defs>

          {/* ═══ HALO ═══ */}
          <circle cx="100" cy="100" r="96" fill={`url(#${id}-halo)`}
            style={animated ? { animation: `${id}-p1 4s ease-in-out infinite`, transformOrigin: 'center' } : {}}/>
          <circle cx="100" cy="100" r="78" stroke={accent} strokeWidth="5" fill="none" opacity="0.04" filter={`url(#${id}-hb)`}
            style={animated ? { animation: `${id}-p2 5s ease-in-out 0.5s infinite`, transformOrigin: 'center' } : {}}/>
          <circle cx="100" cy="100" r="78" stroke={sub} strokeWidth="1" fill="none" opacity="0.1"
            style={animated ? { animation: `${id}-p2 5s ease-in-out 0.5s infinite`, transformOrigin: 'center' } : {}}/>
          <circle cx="100" cy="100" r="70" stroke={sub} strokeWidth="0.5" fill="none" opacity="0.05"
            style={animated ? { animation: `${id}-p1 4s ease-in-out infinite`, transformOrigin: 'center' } : {}}/>

          {/* ═══ PEARL BODY ═══ */}
          <circle cx="100" cy="100" r="54" fill={`url(#${id}-base)`} filter={`url(#${id}-sh)`}/>
          <circle cx="100" cy="100" r="54" fill={`url(#${id}-depth)`}/>
          <circle cx="100" cy="100" r="54" fill={`url(#${id}-sss)`}/>
          <circle cx="100" cy="100" r="54" fill={`url(#${id}-irid)`}/>
          <circle cx="100" cy="100" r="54" fill={`url(#${id}-pink)`}/>
          <circle cx="100" cy="100" r="54" fill={`url(#${id}-teal)`}/>
          <circle cx="100" cy="100" r="54" fill={`url(#${id}-gold)`}/>
          <circle cx="100" cy="100" r="54" fill={`url(#${id}-fresnel)`}/>

          {/* Edge light */}
          <circle cx="100" cy="100" r="53.5" stroke="white" strokeWidth="0.8" fill="none" opacity={isLight ? '0.15' : '0.06'}/>

          {/* Sheen + specular */}
          <circle cx="100" cy="100" r="54" fill={`url(#${id}-sheen)`}/>
          <circle cx="100" cy="100" r="54" fill={`url(#${id}-spec)`}/>

          {/* ═══ HIGHLIGHTS ═══ */}
          <ellipse cx="82" cy="78" rx="11" ry="8" fill="white" opacity="0.65" filter={`url(#${id}-gl)`}/>
          <circle cx="78" cy="72" r="4" fill="white" opacity="0.95"/>
          <circle cx="74" cy="67" r="2" fill="white" opacity="0.7"/>
          <circle cx="86" cy="84" r="1.2" fill="white" opacity="0.25"/>
          {/* Bottom reflected light */}
          <circle cx="115" cy="121" r="3" fill="white" opacity="0.08"/>
          <circle cx="117" cy="117" r="1.2" fill="white" opacity="0.18"/>

          {/* Caustic */}
          <path d="M68 128 Q88 120 100 122 T132 126" stroke="white" strokeWidth="0.6" fill="none" opacity="0.06"/>
          <path d="M72 132 Q92 126 108 128 T128 130" stroke="white" strokeWidth="0.3" fill="none" opacity="0.03"/>

          {/* ═══ SPARKLES ═══ */}
          {animated && (
            <g clipPath={`url(#${id}-cp)`}>
              {sparkles.map((s, i) => (
                <g key={i} style={{ animation: `${id}-spk ${s.dur}s ease-in-out ${s.del}s infinite` }}>
                  <circle cx={s.x} cy={s.y} r={s.r} fill="white"
                    filter={s.cross ? `url(#${id}-sg)` : undefined}/>
                  {s.cross && <>
                    <line x1={s.x - 3} y1={s.y} x2={s.x + 3} y2={s.y}
                      stroke="white" strokeWidth="0.5" opacity="0.6"/>
                    <line x1={s.x} y1={s.y - 3} x2={s.x} y2={s.y + 3}
                      stroke="white" strokeWidth="0.5" opacity="0.6"/>
                  </>}
                </g>
              ))}
            </g>
          )}
        </svg>
      </div>
    </>
  );
}

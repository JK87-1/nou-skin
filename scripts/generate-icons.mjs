import sharp from 'sharp';
import { mkdirSync } from 'fs';

// Eternal Pearl SVG — static version for app icons (no animation)
function createIconSvg(viewSize) {
  const pad = viewSize * 0.1;
  const pearlViewBox = 200;
  const scale = (viewSize - pad * 2) / pearlViewBox;

  return `<svg width="${viewSize}" height="${viewSize}" viewBox="0 0 ${viewSize} ${viewSize}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${viewSize}" height="${viewSize}" rx="${Math.round(viewSize * 0.22)}" fill="#0a0a12"/>
  <g transform="translate(${pad}, ${pad}) scale(${scale})">
    <defs>
      <radialGradient id="ep-base" cx="38%" cy="34%" r="58%">
        <stop offset="0%" stop-color="#ede4ff"/>
        <stop offset="20%" stop-color="#ccc0e8"/>
        <stop offset="45%" stop-color="#9c88c8"/>
        <stop offset="70%" stop-color="#6c58a8"/>
        <stop offset="100%" stop-color="#402880"/>
      </radialGradient>
      <radialGradient id="ep-sheen" cx="32%" cy="28%" r="32%">
        <stop offset="0%" stop-color="white" stop-opacity="0.95"/>
        <stop offset="30%" stop-color="white" stop-opacity="0.4"/>
        <stop offset="60%" stop-color="white" stop-opacity="0.06"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="ep-irid" cx="60%" cy="62%" r="40%">
        <stop offset="0%" stop-color="#a5b4fc" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
      <radialGradient id="ep-pink" cx="66%" cy="44%" r="28%">
        <stop offset="0%" stop-color="#f0abfc" stop-opacity="0.1"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
      <radialGradient id="ep-halo" cx="50%" cy="50%" r="50%">
        <stop offset="32%" stop-color="#a78bfa" stop-opacity="0.18"/>
        <stop offset="50%" stop-color="#a78bfa" stop-opacity="0.08"/>
        <stop offset="68%" stop-color="#c4b5fd" stop-opacity="0.03"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
      <filter id="ep-shadow">
        <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#6d28d9" flood-opacity="0.35"/>
      </filter>
      <filter id="ep-glow">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="ep-hblur">
        <feGaussianBlur stdDeviation="5"/>
      </filter>
    </defs>

    <!-- Halo glow -->
    <circle cx="100" cy="100" r="96" fill="url(#ep-halo)"/>

    <!-- Halo rings -->
    <circle cx="100" cy="100" r="78" stroke="#a78bfa" stroke-width="5" fill="none" opacity="0.04" filter="url(#ep-hblur)"/>
    <circle cx="100" cy="100" r="78" stroke="#c4b5fd" stroke-width="1" fill="none" opacity="0.1"/>
    <circle cx="100" cy="100" r="70" stroke="#c4b5fd" stroke-width="0.5" fill="none" opacity="0.05"/>

    <!-- Pearl body -->
    <circle cx="100" cy="100" r="54" fill="url(#ep-base)" filter="url(#ep-shadow)"/>

    <!-- Iridescence -->
    <circle cx="100" cy="100" r="54" fill="url(#ep-irid)"/>
    <circle cx="100" cy="100" r="54" fill="url(#ep-pink)"/>

    <!-- Edge light -->
    <circle cx="100" cy="100" r="53.5" stroke="white" stroke-width="0.5" fill="none" opacity="0.05"/>

    <!-- Sheen -->
    <circle cx="100" cy="100" r="54" fill="url(#ep-sheen)"/>

    <!-- Caustic -->
    <path d="M68 126 Q100 118 132 124" stroke="white" stroke-width="0.5" fill="none" opacity="0.04"/>

    <!-- Highlights -->
    <ellipse cx="80" cy="76" rx="9" ry="7" fill="white" opacity="0.78" filter="url(#ep-glow)"/>
    <circle cx="76" cy="70" r="3.5" fill="white" opacity="0.9"/>
    <circle cx="72" cy="66" r="1.5" fill="white" opacity="0.58"/>
    <circle cx="88" cy="82" r="1.5" fill="white" opacity="0.15"/>
    <circle cx="118" cy="120" r="2.5" fill="white" opacity="0.1"/>
  </g>
</svg>`;
}

const sizes = [
  { name: 'icon-16x16.png', size: 16 },
  { name: 'icon-32x32.png', size: 32 },
  { name: 'icon-180x180.png', size: 180 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

const outDir = 'public/icons';

async function generate() {
  // Generate from a high-res source SVG
  const srcSvg = Buffer.from(createIconSvg(1024));

  for (const { name, size } of sizes) {
    await sharp(srcSvg)
      .resize(size, size)
      .png()
      .toFile(`${outDir}/${name}`);
    console.log(`✓ ${name} (${size}x${size})`);
  }
  console.log('\nDone!');
}

generate().catch(console.error);

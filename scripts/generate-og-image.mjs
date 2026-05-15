import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const width = 1200;
const height = 630;
const outputPath = fileURLToPath(
  new URL("../public/og-image.png", import.meta.url),
);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07111f"/>
      <stop offset="50%" stop-color="#101827"/>
      <stop offset="100%" stop-color="#061317"/>
    </linearGradient>
    <radialGradient id="cyanGlow" cx="78%" cy="12%" r="62%">
      <stop offset="0%" stop-color="#64d2ff" stop-opacity="0.36"/>
      <stop offset="100%" stop-color="#64d2ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="greenGlow" cx="12%" cy="85%" r="58%">
      <stop offset="0%" stop-color="#30d158" stop-opacity="0.24"/>
      <stop offset="100%" stop-color="#30d158" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wordGradient" x1="180" y1="230" x2="1030" y2="390" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f8fbff"/>
      <stop offset="45%" stop-color="#d9f4ff"/>
      <stop offset="100%" stop-color="#7ce8ff"/>
    </linearGradient>
    <linearGradient id="wordHighlight" x1="230" y1="238" x2="970" y2="238" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="48%" stop-color="#ffffff" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="wordShadow" x="-20%" y="-45%" width="140%" height="190%">
      <feDropShadow dx="0" dy="28" stdDeviation="30" flood-color="#000000" flood-opacity="0.52"/>
      <feDropShadow dx="0" dy="0" stdDeviation="28" flood-color="#64d2ff" flood-opacity="0.24"/>
    </filter>
    <filter id="wordGlow" x="-20%" y="-45%" width="140%" height="190%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#cyanGlow)"/>
  <rect width="${width}" height="${height}" fill="url(#greenGlow)"/>

  <g opacity="0.2" stroke="#64d2ff" stroke-width="1">
    <path d="M0 100H1200"/>
    <path d="M0 220H1200"/>
    <path d="M0 340H1200"/>
    <path d="M0 460H1200"/>
    <path d="M120 0V630"/>
    <path d="M300 0V630"/>
    <path d="M480 0V630"/>
    <path d="M660 0V630"/>
    <path d="M840 0V630"/>
    <path d="M1020 0V630"/>
  </g>

  <text x="600" y="352" text-anchor="middle" fill="#64d2ff" opacity="0.2" filter="url(#wordGlow)" font-family="Inter, Atkinson, Arial, sans-serif" font-size="164" font-weight="800" letter-spacing="-8">PePoDev</text>
  <text x="600" y="352" text-anchor="middle" fill="url(#wordGradient)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" paint-order="stroke fill" filter="url(#wordShadow)" font-family="Inter, Atkinson, Arial, sans-serif" font-size="164" font-weight="800" letter-spacing="-8">PePoDev</text>
  <text x="600" y="352" text-anchor="middle" fill="url(#wordHighlight)" opacity="0.34" font-family="Inter, Atkinson, Arial, sans-serif" font-size="164" font-weight="800" letter-spacing="-8">PePoDev</text>
</svg>`;

await mkdir(dirname(outputPath), { recursive: true });
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outputPath);

console.log(`Generated ${outputPath}`);

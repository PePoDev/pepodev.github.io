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
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="22" flood-color="#000000" flood-opacity="0.4"/>
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

  <g filter="url(#shadow)">
    <rect x="84" y="76" width="1032" height="478" rx="28" fill="#0d1725" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>
    <rect x="84" y="76" width="1032" height="72" rx="28" fill="rgba(255,255,255,0.07)"/>
    <path d="M84 148H1116" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>

    <g transform="translate(122 104)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <rect x="0" y="0" width="32" height="32" rx="8" fill="rgba(48,209,88,0.12)" stroke="#30d158"/>
      <path d="M8 17L14 23L25 9" stroke="#30d158" stroke-width="3"/>
    </g>
    <text x="176" y="126" fill="#dce6f2" font-family="Inter, Atkinson, Arial, sans-serif" font-size="26" font-weight="700">pepodev.desktop</text>
    <text x="934" y="126" fill="#8b949e" font-family="Inter, Atkinson, Arial, sans-serif" font-size="20">pepo.dev</text>

    <g transform="translate(130 198)">
      <text x="0" y="0" fill="#30d158" font-family="Inter, Atkinson, Arial, sans-serif" font-size="24" font-weight="700">ONLINE</text>
      <text x="0" y="78" fill="#ffffff" font-family="Inter, Atkinson, Arial, sans-serif" font-size="84" font-weight="800" letter-spacing="-2">PePoDev</text>
      <text x="0" y="134" fill="#64d2ff" font-family="Inter, Atkinson, Arial, sans-serif" font-size="36" font-weight="700">Interactive SRE Desktop</text>
      <text x="0" y="180" fill="#64d2ff" font-family="Inter, Atkinson, Arial, sans-serif" font-size="36" font-weight="700">Portfolio</text>
      <text x="0" y="232" fill="#c9d1d9" font-family="Inter, Atkinson, Arial, sans-serif" font-size="26">Kubernetes | Terraform | SRE | Cloud</text>
    </g>

    <g transform="translate(682 208)">
      <rect x="0" y="0" width="344" height="250" rx="18" fill="#050b13" stroke="rgba(100,210,255,0.22)" stroke-width="2"/>
      <text x="28" y="50" fill="#30d158" font-family="Menlo, Consolas, monospace" font-size="21">$ kubectl get uptime</text>
      <text x="28" y="91" fill="#c9d1d9" font-family="Menlo, Consolas, monospace" font-size="20">portfolio   ready</text>
      <text x="28" y="132" fill="#c9d1d9" font-family="Menlo, Consolas, monospace" font-size="20">systems     nominal</text>
      <text x="28" y="173" fill="#c9d1d9" font-family="Menlo, Consolas, monospace" font-size="20">deploys     automated</text>
      <rect x="28" y="204" width="288" height="10" rx="5" fill="rgba(255,255,255,0.12)"/>
      <rect x="28" y="204" width="230" height="10" rx="5" fill="#64d2ff"/>
    </g>
  </g>
</svg>`;

await mkdir(dirname(outputPath), { recursive: true });
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outputPath);

console.log(`Generated ${outputPath}`);

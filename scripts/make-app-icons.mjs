/**
 * The home-screen icons, rendered from the same drawing as the favicon.
 *
 * Two shapes are needed, not one. `icon-512.png` is the app's own square,
 * corners and all, for the places that show it untouched. `maskable-512.png`
 * is the same mark on a gradient that runs edge to edge, with the drawing
 * pulled into the middle sixty percent — Android crops a maskable icon to
 * whatever shape the launcher uses, and anything near the edge is cut off.
 */
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
import { chromiumLaunchOptions } from './browser.mjs';

const svg = readFileSync(new URL('../app/icon.svg', import.meta.url), 'utf8');

/** The drawing without its rounded rectangle, for the maskable version. */
const inner = svg
  .replace(/<rect[^>]*\/>/, '')
  .replace(/<svg[^>]*>/, '')
  .replace('</svg>', '');

const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
      <stop stop-color="#4f3dd4"/><stop offset="1" stop-color="#2f2489"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" fill="url(#g)"/>
  <g transform="translate(16 16) scale(0.62) translate(-16 -16)">${inner}</g>
</svg>`;

const jobs = [
  { file: 'icon-192.png', size: 192, source: svg },
  { file: 'icon-512.png', size: 512, source: svg },
  { file: 'maskable-512.png', size: 512, source: maskable },
  // iOS ignores the manifest and reads this one, and it is never masked, so
  // it gets the square with its own corners.
  { file: 'apple-icon.png', size: 180, source: svg },
];

const browser = await chromium.launch(chromiumLaunchOptions());

for (const { file, size, source } of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${source}`,
    { waitUntil: 'load' },
  );
  const shot = await page.screenshot({ omitBackground: true });
  writeFileSync(new URL(`../public/${file}`, import.meta.url), shot);
  await page.close();
  console.log(`${file} — ${size}×${size}`);
}

await browser.close();

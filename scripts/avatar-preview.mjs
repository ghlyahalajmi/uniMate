/**
 * Render every avatar hairstyle to a PNG so the drawing can be *looked at*.
 *
 *   node scripts/avatar-preview.mjs
 *
 * An avatar is the one thing in this app that cannot be verified by a test: a
 * path can be valid SVG, typecheck, lint and still draw a bun hovering three
 * pixels above the head — which is exactly what it was doing until this script
 * showed it. Run it after touching avatar-art.tsx and open the PNG it writes.
 *
 * It parses the JSX rather than importing it, because the component is React
 * and this is a browser page; that is crude, and it only has to survive long
 * enough to answer "does this look right".
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { chromiumLaunchOptions } from '/home/user/uniMate/scripts/browser.mjs';

const src = readFileSync('/home/user/uniMate/components/avatar/avatar-art.tsx', 'utf8');

// Pull the JSX bodies out of the two hair functions and strip the TS/JSX bits
// that a browser cannot parse: this is a viewer, not a compiler.
function grab(name) {
  const start = src.indexOf(`function ${name}(`);
  const end = src.indexOf('\nfunction ', start + 10);
  return src.slice(start, end === -1 ? undefined : end);
}
const backSrc = grab('BackHair');
const frontSrc = grab('FrontHair');

function caseFor(block, key) {
  const re = new RegExp(`case '${key}':([\\s\\S]*?)(?=\\n    case '|\\n    default:)`);
  const m = block.match(re);
  if (!m) return '';
  return m[1]
    .replace(/return \(/g, '').replace(/return /g, '')
    .replace(/\);\s*$/g, '').replace(/;\s*$/g, '')
    .replace(/\{colour\}/g, '"#221c2b"')
    .replace(/fill=\{colour\}/g, 'fill="#221c2b"')
    .replace(/<\/?g[^>]*>/g, (t) => t)
    .trim();
}

const STYLES = ['none','short','curly','long','bun','wavy','buzz','hijab','ghutra','shmagh'];

const cells = STYLES.map((k) => `
  <figure>
    <svg viewBox="0 0 64 64" width="130" height="130">
      <circle cx="32" cy="32" r="32" fill="#4f3dd4"/>
      <g clip-path="url(#c)">
        <ellipse cx="32" cy="64" rx="18" ry="13" fill="#fff" fill-opacity="0.92"/>
        ${caseFor(backSrc, k)}
        <rect x="27" y="38" width="10" height="10" rx="4" fill="#d9a878"/>
        <ellipse cx="32" cy="29" rx="13" ry="14.5" fill="#eec9a4"/>
        ${caseFor(frontSrc, k)}
        <circle cx="27" cy="28" r="1.9" fill="#2a2431"/>
        <circle cx="37" cy="28" r="1.9" fill="#2a2431"/>
        <path d="M28 33.5q4 3.5 8 0" stroke="#2a2431" stroke-width="1.6" stroke-linecap="round" fill="none"/>
      </g>
    </svg>
    <figcaption>${k}</figcaption>
  </figure>`).join('');

const html = `<!doctype html><meta charset="utf-8">
<style>
 body{background:#f6f6f8;font:13px system-ui;margin:0;padding:18px;
      display:grid;grid-template-columns:repeat(5,1fr);gap:14px;justify-items:center}
 figure{margin:0;text-align:center} figcaption{margin-top:6px;font-weight:600}
</style>
<svg width="0" height="0"><defs><clipPath id="c"><circle cx="32" cy="32" r="32"/></clipPath></defs></svg>
${cells}`;

writeFileSync('/tmp/claude-0/-home-user/db212732-60bb-5627-8607-565579c2e76c/scratchpad/avatars.html', html);

const b = await chromium.launch(chromiumLaunchOptions());
const p = await b.newPage({ viewport: { width: 800, height: 640 }, deviceScaleFactor: 2 });
await p.goto('file:///tmp/claude-0/-home-user/db212732-60bb-5627-8607-565579c2e76c/scratchpad/avatars.html');
await p.screenshot({ path: '/tmp/claude-0/-home-user/db212732-60bb-5627-8607-565579c2e76c/scratchpad/hair.png', fullPage: true });
await b.close();
console.log('rendered');

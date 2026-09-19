/**
 * Responsive and target-size check for the public pages.
 *
 * Start the app first, then:
 *   PORT=3100 npm start &
 *   BASE=http://localhost:3100 node scripts/responsive-check.mjs
 *
 * It fails on three things the product treats as bugs:
 *   - any horizontal overflow (the brief: no horizontal scrolling)
 *   - any visible text below 12px
 *   - any interactive target under 32px tall
 *
 * It runs every page at seven widths in both English and Arabic, because RTL
 * reflows the header and is where the overflow bugs actually showed up.
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3100';
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1440];
const PAGES = [
  { path: '/', name: 'home' },
  { path: '/auth/sign-in', name: 'sign-in' },
  { path: '/auth/sign-up', name: 'sign-up' },
];
const LOCALES = ['en', 'ar'];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failures = 0;

for (const locale of LOCALES) {
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: 'unimate-locale', value: locale, domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();

  for (const p of PAGES) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle' });

      const report = await page.evaluate(() => {
        const de = document.documentElement;
        const overflow = de.scrollWidth - de.clientWidth;

        // Anything actually sticking out past the viewport.
        const offenders = [];
        const vw = de.clientWidth;
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right > vw + 1 || r.left < -1) {
            offenders.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
          }
        }

        // Font sizes below 12px anywhere visible.
        const tiny = [];
        for (const el of document.querySelectorAll('body *')) {
          if (!el.textContent?.trim()) continue;
          const cs = getComputedStyle(el);
          const size = parseFloat(cs.fontSize);
          if (size > 0 && size < 12 && cs.visibility !== 'hidden' && cs.display !== 'none') {
            tiny.push(`${el.tagName.toLowerCase()} ${size}px`);
          }
        }

        // Interactive targets smaller than 32px in either axis.
        const small = [];
        for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="tab"], [role="radio"], [role="switch"]')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (getComputedStyle(el).position === 'absolute' && r.height < 2) continue;
          if (r.height < 32 || r.width < 20) {
            small.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        }
        return { overflow, offenders: [...new Set(offenders)].slice(0, 4), tiny: [...new Set(tiny)].slice(0, 4), small: [...new Set(small)].slice(0, 4) };
      });

      const bad = report.overflow > 1 || report.tiny.length || report.small.length;
      if (bad) failures++;
      const tag = `${locale} ${p.name} @${width}`;
      if (bad) {
        console.log(`  FAIL ${tag}`);
        if (report.overflow > 1) console.log(`       h-overflow ${report.overflow}px :: ${report.offenders.join(' | ')}`);
        if (report.tiny.length) console.log(`       text <12px :: ${report.tiny.join(' | ')}`);
        if (report.small.length) console.log(`       target <32px :: ${report.small.join(' | ')}`);
      } else {
        console.log(`  ok   ${tag}`);
      }
    }
  }
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? '\nALL RESPONSIVE CHECKS PASS' : `\n${failures} viewport/page combinations failed`);

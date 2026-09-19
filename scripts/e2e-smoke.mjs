/**
 * End-to-end smoke test against a running app and a reachable Supabase project.
 *
 *   PORT=3100 npm start &
 *   BASE=http://localhost:3100 node scripts/e2e-smoke.mjs
 *
 * Signs in as the seeded demo student and walks every authenticated screen,
 * checking that real records render and that nothing overflows horizontally.
 *
 * Needs network access to your Supabase project — it will fail at the sign-in
 * step if the host is unreachable, which is a environment problem rather than
 * an application one.
 */
import { chromium } from 'playwright';

const B = process.env.BASE ?? 'http://localhost:3100';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

console.log('--- signing in as the demo student ---');
await p.goto(`${B}/auth/sign-in`, { waitUntil: 'networkidle' });
await p.fill('input[name="email"]', 'sara.alajmi@demo.unimate.app');
await p.fill('input[name="password"]', 'UniMateDemo2026!');
await Promise.all([
  p.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30000 }).catch(() => {}),
  p.click('button[type="submit"]'),
]);
await p.waitForTimeout(2500);
console.log('landed on:', new URL(p.url()).pathname);

const check = async (path, expect) => {
  await p.goto(`${B}${path}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const body = await p.locator('body').innerText();
  const ok = expect.every((s) => body.includes(s));
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${path.padEnd(12)} overflow=${overflow}px  ${ok ? '' : ':: missing ' + expect.filter((s) => !body.includes(s)).join(', ')}`);
  return { body, ok };
};

console.log('\n--- authenticated screens against the live database ---');
const dash = await check('/dashboard', ['Sara', 'CE301']);
await check('/momentum',  ['Momentum', 'Streak', 'Level']);
await check('/courses',   ['CE301', 'MATH201']);
await check('/grades',    ['CE301']);
await check('/tasks',     ['Rework Quiz 1 mistakes']);
await check('/calendar',  ['Calendar']);
await check('/analytics', ['Analytics']);
await check('/records',   ['Records']);
await check('/settings',  ['Settings', 'Kuwait University']);

console.log('\n--- momentum figures shown on screen ---');
await p.goto(`${B}/momentum`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const txt = await p.locator('body').innerText();
for (const label of ['Streak', 'Level', 'Longest', 'Achievements', 'Focus timer', 'Semester Wrapped']) {
  console.log(`  ${txt.includes(label) ? 'ok  ' : 'FAIL'} ${label}`);
}
const nums = txt.match(/\b(6|11|1290|42)\b/g);
console.log('  key figures found on page:', [...new Set(nums ?? [])].join(', '));

await p.screenshot({ path: '/tmp/shots/momentum.png', fullPage: false });
await p.goto(`${B}/dashboard`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.screenshot({ path: '/tmp/shots/dashboard.png', fullPage: false });

console.log('\npage errors:', errors.length ? errors : 'none');
await b.close();

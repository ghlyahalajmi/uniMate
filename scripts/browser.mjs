/**
 * Where Chromium lives differs by machine, so neither script may assume a path.
 *
 * On GitHub Actions `npx playwright install chromium` puts it in Playwright's
 * own cache and Playwright finds it unaided, so the right answer there is to
 * pass nothing. Some sandboxes ship a pre-installed browser at a fixed path
 * instead, with downloads turned off — there, passing nothing fails.
 *
 * So: an explicit override wins, a known pre-installed browser is used when it
 * is actually on disk, and otherwise Playwright resolves it itself.
 */
import { existsSync } from 'node:fs';

const PREINSTALLED = '/opt/pw-browsers/chromium';

export function chromiumLaunchOptions() {
  const override = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (override) return { executablePath: override };
  if (existsSync(PREINSTALLED)) return { executablePath: PREINSTALLED };
  return {};
}

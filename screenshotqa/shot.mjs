// scripts/shot.mjs — portable screenshot helper (from the screenshotqa skill)
// Setup: npm i -D playwright-core
// Usage: SHOT_BASE=http://localhost:PORT node scripts/shot.mjs "<path>" "<cssSelector|>" "<out.png>" [WxH]
//   e.g. node scripts/shot.mjs "/poll/abc/results" ".results-list" out.png 1440x1000
//        node scripts/shot.mjs "/" "" mobile.png 390x1500
import { chromium } from 'playwright-core';

const [path = '/', selector = '', out = 'shot.png', size = '1440x1000'] = process.argv.slice(2);
const [w, h] = size.split('x').map((n) => Number(n) || 0);
const base = process.env.SHOT_BASE || 'http://localhost:3000';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
  viewport: { width: w || 1440, height: h || 1000 },
  deviceScaleFactor: 2, // crisp, retina-quality captures
});
// 'domcontentloaded', not 'networkidle': pages with a persistent connection
// (SSE/websockets for live updates) never go network-idle, so that would hang.
await page.goto(base + path, { waitUntil: 'domcontentloaded' });

if (selector) {
  // Wait for the element to render (content often loads client-side), scroll to
  // it, and capture just that component.
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 15000 });
  await el.scrollIntoViewIfNeeded();
  await el.screenshot({ path: out });
} else {
  await page.waitForTimeout(800); // let client render settle for full-page shots
  await page.screenshot({ path: out, fullPage: true });
}
await browser.close();
console.log(`wrote ${out} (${w || 1440}x${h || 1000}) from ${base}${path}${selector ? ` @ ${selector}` : ''}`);

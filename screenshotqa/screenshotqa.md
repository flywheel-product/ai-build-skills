# screenshotqa — render it, look at it, then say it's done

How an AI should verify UI work **visually** before claiming it's done. This is the portable guide — any assistant can read and follow it. (Companion to a build-practice skill — see `builder` — and to behavioral/functional testing.)

> Throughout, **"the prompter"** = the person directing the build.

Reading code and a green type-check (e.g. `tsc`) do not tell you the UI is right. After any UI change, **capture the affected screen, open the PNG, and review it against exactly what was asked.** Fix and re-shoot until it's right. Never claim a visual change is done on a screen you haven't seen — the prompter should not be the one to spot your visual bugs.

## The helper (`shot.mjs`)

A portable screenshot helper lives in this folder as `shot.mjs` (also shown below). If the target repo has no `scripts/shot.mjs`, copy it in, then run it. It drives the **system Google Chrome** via `playwright-core` (`channel: 'chrome'` — no browser download), and sets a **real viewport**, so mobile widths render correctly with no hacks.

One-time setup per repo: `npm i -D playwright-core` (uses the installed Chrome; nothing else to download).

```js
// scripts/shot.mjs — screenshot helper
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
```

- **path** — deep-link straight to the screen you changed (apps usually encode state in the URL, e.g. `/poll/<id>/results`, `/?view=prep`). Don't screenshot the empty default and call it verified.
- **selector** — a CSS selector shoots just that element (best for one component); pass `""` for a full-page shot.
- **WxH** — viewport: `1440x1000` desktop, `390x1500` mobile.
- Then **Read the PNG** and judge layout, alignment, overflow, spacing, color, dark mode, and fit-to-ask.

**Prefer the selector form — full-page is for compact screens only.** A full-page shot of a screen with large expandable content (a full transcript, a long doc, an infinite list, a deep-linked detail that auto-expands) can be **tens of thousands of px tall** — a multi-MB PNG that's unreviewable at any sane scale. Reserve `""` (full page) for genuinely short screens; otherwise target the component. The selector form is also **more robust on cold loads**: it `waitFor`s the element to actually render, whereas the full-page path only waits a fixed 800ms and can capture mid-render on a cold SPA that chains fetches (e.g. list → detail → analysis). If you must do a full-page shot and it captures too early, bump that settle timeout.

## Reach the real state — seed data, don't trust the default

Most bugs hide in populated states, not the empty default. Before shooting:

- **Seed realistic data** via the app's API or fixtures: enough rows to fill the screen, plus the edge cases the prompter mentioned (long/multi-line text, many items, a selected/flagged item). Example: to review a results page, POST a record and create a spread of child data first, then deep-link to it.
- **Reproduce the prompter's exact scenario.** If they said "long titles" or "5 options," render that — not two short ones.
- Clean up seeded test data afterward if it persists anywhere that feeds future behavior.

## Always check responsive + theme

- **Shoot at least two widths** for any layout change — one desktop (e.g. 1440) and one mobile (e.g. 390). A change that looks right wide often overflows or stretches narrow (and vice versa).
- **If the app themes, check dark mode too** — a light-only screenshot misses half the surface.

## Visual-QA checklist (run against every screenshot)

- Edges / horizontal overflow — does anything run off-screen or force a scrollbar?
- Full-width controls that shouldn't be — buttons/inputs stretched across a wide container (cap and align them).
- Alignment and spacing — are related things aligned; is the rhythm consistent?
- Color & contrast — readable, AA; correct in **both** light and dark.
- States — empty, loading, error, and long-content wrapping, not just the happy path.
- Match to ask — does it do the specific thing requested, at the widths it'll be used?

## Zero-dependency fallback (system Chrome, no install)

If a repo can't take even one devDep, drive the installed Chrome directly:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --hide-scrollbars --window-size=1440,1000 \
  --screenshot=/tmp/shot.png "http://localhost:PORT/<path>"
```

**Pitfall — the mobile-width trap:** headless Chrome enforces a ~800px minimum render width, so `--window-size=390,...` silently renders at ~760 and *crops* — it looks like overflow that isn't real. To verify a true narrow width with raw Chrome, **wrap the app in a fixed-width iframe and screenshot that**:

```html
<!-- /tmp/frame.html -->
<!doctype html><meta charset="utf-8">
<style>html,body{margin:0}iframe{width:390px;height:1500px;border:0;display:block;margin:0 auto}</style>
<iframe src="http://localhost:PORT/<path>"></iframe>
```
then screenshot `file:///tmp/frame.html`. The iframe forces the inner document to lay out at 390px. (The `shot.mjs` helper above sets a real viewport and needs no such hack — prefer it.)

---

*Part of the [AI Build Skills](../README.md) collection · CC BY 4.0.*

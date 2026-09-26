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

## Auth-gated apps — get a sanctioned session, never bypass the gate

If the app requires sign-in, headless Chrome lands on the login page and every shot is worthless. Plan the auth path BEFORE shooting:

- **Best:** a dedicated QA/test account the prompter created, signed in by injecting its session into localStorage (for Supabase: admin `generate_link` → `POST /auth/v1/verify` with `token_hash` → store the session JSON under `sb-<ref>-auth-token`). OAuth redirect flows usually fail locally because redirect allow-lists only contain production URLs — session injection avoids that.
- If the app has an **authorization layer beyond sign-in** (an allowlist table, roles), do NOT add accounts to it, patch the check out, or add env-var bypasses on your own authority — that's the prompter's access-control decision. Ask them for a sanctioned path (QA account on the allowlist, or they eyeball the deployed UI).
- When visual QA is blocked on that decision, say so explicitly in the ship report — don't quietly claim the UI verified, and don't let it silently block the rest of the work.

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

## Mobile compatibility suite — MANDATORY before every commit that touches UI

A screenshot at 390px is necessary but not sufficient. Phones fail in ways a
static PNG hides: a modal taller than the screen whose top you can't scroll to,
a submit button under the fixed bottom nav, iOS zooming the page because an
input is 14px, tap targets a thumb can't hit, `100vh` that doesn't match the
real viewport behind Safari's toolbars. The **mobile QA suite** in this folder
catches those automatically, and a **commit gate** refuses UI commits until it
has passed. This exists because the prompter had to report "I can't scroll to
the top of the modal or press submit on my phone" — that must never be their job.

### Files (in this skill folder — copy into the repo)

| File | Goes to | Purpose |
|---|---|---|
| `mobileqa.mjs` | `scripts/mobileqa.mjs` | The engine: real phone emulation (viewport + touch + mobile UA + DPR), screenshots per scenario × viewport × theme, in-page checks, report, `last-pass.json`. |
| `mobileqa-gate.mjs` | `scripts/mobileqa-gate.mjs` | Hashes every UI source file; exits non-zero unless the suite PASSED on exactly the current source. |
| `mobileqa.config.example.mjs` | `mobileqa.config.mjs` (repo root) | Base URL, viewports, scenarios (one per route + one per modal/drawer/sheet), auth via the app's own login screen, theme hook. |
| `pre-commit` | `.githooks/pre-commit` | Git hook: staged UI files ⇒ gate must pass. Activate with `git config core.hooksPath .githooks` (also as the `prepare` npm script). |
| `claude-hook-mobileqa-gate.sh` | `~/.claude/hooks/mobileqa-gate.sh` | Global Claude Code PreToolUse hook on `git commit` (already installed on this machine; `~/.claude/settings.json`). Blocks commits in any web repo that lacks the suite, and stale-pass commits in repos that have it. |

**Install in a new repo (do this the first time you touch any UI in it):**

```
npm i -D playwright-core
cp <skill>/mobileqa.mjs <skill>/mobileqa-gate.mjs scripts/
cp <skill>/mobileqa.config.example.mjs mobileqa.config.mjs   # then edit base/routes/auth
mkdir -p .githooks && cp <skill>/pre-commit .githooks/ && chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
# package.json: "mobileqa": "node scripts/mobileqa.mjs", "mobileqa:gate": "node scripts/mobileqa-gate.mjs",
#               "prepare": "git config core.hooksPath .githooks 2>/dev/null || true"
echo ".mobileqa/" >> .gitignore
```

Scenario options: `path`, `public` (no auth), `fresh` (brand-new signed-out context — use it for the login screen), `waitFor`, `actions` (`click`, `tap`, `fill`, `press`, `waitFor`, `wait`, `evaluate`, or `run: async (page) => {}` for anything Playwright can do), `waitForAfter`, `settle`, `noFullPage`, `phoneOnly`, `desktopOnly`, `minWidth`, `maxWidth`. Cover **every route and every modal/drawer/sheet/menu** — the overlays are where phones break.

**Pitfall learned the hard way:** never navigate away from a page that is still bootstrapping its session. Some apps treat an aborted session fetch as "signed out" and wipe the stored identity (camps-ops did — fixed in its SessionProvider). The engine re-navigates only right after an actual login, and the config's `isLoggedOut` should wait for the app to settle on a known state rather than checking after a fixed delay.

Add a **dev-only component sandbox route** (e.g. `/__qa`, registered only when
`import.meta.env.DEV`) that renders the shared primitives — the modal with a
form taller than a phone, the confirm dialog, inputs, buttons — with no auth and
no data. It gives the suite something that always runs even when the signed-in
scenarios are blocked on credentials, and it's where a shared-component bug is
proven fixed. (See camps-ops `src/pages/dev/QaSandbox.tsx` for the pattern.)

### Run it

```
npm run mobileqa                       # everything: all scenarios × viewports × light/dark
npm run mobileqa -- --only add-item    # one scenario family
npm run mobileqa -- --viewports phoneSmall,desktop --themes light
npm run mobileqa -- --no-shots         # checks only
```

Then **open `.mobileqa/report.md`** and **look at the PNGs in `.mobileqa/shots/`**
the same way you'd review any screenshot (checklist above). A green run is the
floor, not the ceiling — the checks can't see ugly.

### What it checks (FAIL blocks the commit; warn is reported)

- **viewport-meta** — present, `width=device-width`, doesn't disable pinch zoom.
- **h-overflow** — document wider than the viewport, with the outermost offenders named.
- **dialog-fit** — any full-screen overlay whose content starts above the viewport or runs below it with no scrollable region. (The exact "can't scroll to the top of the modal" bug.)
- **unreachable-control** — every button/link/input in the topmost layer can be scrolled into view and is the element actually hit at its centre (catches fixed bars, stray overlays, `pointer-events` mistakes).
- **fixed-bar-overlap** — at the end of the page, content sits under a fixed bottom bar (missing bottom padding).
- **control-font** (phones) — any input/select/textarea under 16px ⇒ iOS focus-zoom.
- **tap-target** — under 24px *and* crowded by a neighbour in the same layer fails on phones (WCAG 2.5.8 with its spacing exception); under 24px but spaced, or under 44px, warns on touch widths (Apple HIG).
- **wide-region** (warn, phones) — a region that must be panned horizontally (a wide table), with how much a sticky first column leaves to pan in. Controls inside it are exempt from the reachability check.
- **text-size** (warn) — text under 11px. **chrome-budget** (warn) — fixed/sticky bars eating >35% of a phone screen. **page-error** (warn) — uncaught JS errors.

### Build rules that keep the suite green (put them in the CSS once, per app)

- **Modals/sheets:** `max-height: calc(100dvh - safe-area)`, `display:flex; flex-direction:column`, header `shrink-0`, body `overflow-y:auto; overscroll-behavior:contain`, `role="dialog" aria-modal="true"`. On phones dock to the bottom edge (`items-end sm:items-center`).
- **Viewport height:** `dvh`, never bare `100vh`, for anything that must fit the screen.
- **Safe areas:** `viewport-fit=cover` in the meta tag; `env(safe-area-inset-bottom)` on fixed bottom bars and on the scroll container's bottom padding.
- **Inputs ≥ 16px on phones** (`@media (max-width:767px) { input, select, textarea { font-size: max(16px, 1em) } }`).
- **Tap targets ≥ 44px on touch widths** (`min-height: 44px` on inputs and buttons below `lg`).
- **Hover-only affordances** (`opacity-0 group-hover:opacity-100`) must be visible under `@media (hover: none)`.
- **Tables:** wrap in `overflow-x-auto`, or collapse to cards below `md`.
- **Multi-column grids** in forms: `grid-cols-1 sm:grid-cols-2`, never bare `grid-cols-3` on a phone.
- **HTML5 drag-and-drop** does not fire on iOS/Android touch — every reorder/assign needs a tap alternative (move up/down, a picker) or a pointer-events implementation.

### Auth for the signed-in scenarios

Follow "Auth-gated apps" above: the config logs in through the app's **own**
login screen with credentials from env (`.env`, non-`VITE_`, gitignored), and
caches the signed-in browser state in `.mobileqa/state.json`. Never fetch service
keys or mint sessions to get around the gate. If the credentials aren't set, the
authed scenarios are **skipped and the run does not count as a pass** — say so in
the ship report and ask the prompter for the one-time env setup.

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

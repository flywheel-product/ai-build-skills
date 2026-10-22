# mobileqa — the mobile compatibility suite, run only when asked

How an AI runs a web app through real phone emulation and catches the failures a static screenshot hides. This is the portable guide — any assistant can read and follow it. (Companion to `screenshotqa`, the render-and-look loop, and to `builder`, the build-practice playbook.)

> Throughout, **"the prompter"** = the person directing the build.

## 0. This suite runs only when the prompter asks

**Never run `npm run mobileqa` on your own initiative.** Not after a UI change, not before a commit, not as part of a ship, not because the `screenshotqa` loop or the `builder` flow mentions mobile, and not because a pre-commit hook or a gate script in the repo demands it. If something in a repo blocks a commit until the suite has run, do not run the suite: tell the prompter what blocked and let them decide (they may disable the hook: `git config --unset core.hooksPath`).

Why this is a hard rule: one run loads **every route × every viewport × light and dark**, which is dozens of page loads. On 2026-10-21 one run of this suite against a 71-card gallery made about 3,500 requests to a metered screenshot service in a few minutes, which the prompter paid for, and the run also takes real minutes each time. The suite is valuable when a phone-specific bug is suspected or before a release the prompter is nervous about; it is the prompter's call when that is.

The install steps (§2) are equally opt-in: do not add the suite, its npm scripts, its git hook or its Claude hook to a repo unless asked.

## 1. What it is

A screenshot at 390px is necessary but not sufficient. Phones fail in ways a
static PNG hides: a modal taller than the screen whose top you can't scroll to,
a submit button under the fixed bottom nav, iOS zooming the page because an
input is 14px, tap targets a thumb can't hit, `100vh` that doesn't match the
real viewport behind Safari's toolbars. The suite in this folder catches those
automatically. It was written after the prompter had to report "I can't scroll
to the top of the modal or press submit on my phone".

## 2. Files (in this skill folder — copy into the repo when asked)

| File | Goes to | Purpose |
|---|---|---|
| `mobileqa.mjs` | `scripts/mobileqa.mjs` | The engine: real phone emulation (viewport + touch + mobile UA + DPR), screenshots per scenario × viewport × theme, in-page checks, report, `last-pass.json`. |
| `mobileqa.config.example.mjs` | `mobileqa.config.mjs` (repo root) | Base URL, viewports, scenarios (one per route + one per modal/drawer/sheet), auth via the app's own login screen, theme hook, `blockRequests`. |
| `mobileqa-gate.mjs` | `scripts/mobileqa-gate.mjs` | **Optional, off by default.** Hashes every UI source file; exits non-zero unless the suite PASSED on exactly the current source. Only for a prompter who wants a commit gate. |
| `pre-commit` | `.githooks/pre-commit` | **Optional, off by default.** Git hook: staged UI files ⇒ gate must pass. Activated only by `git config core.hooksPath .githooks`. |
| `claude-hook-mobileqa-gate.sh` | `~/.claude/hooks/` | **Optional, off by default.** A Claude Code PreToolUse hook that refuses `git commit` until the suite has passed. Install only when the prompter explicitly wants Claude gated. |

**Install (only when the prompter asks):**

```
npm i -D playwright-core
cp <skill>/mobileqa.mjs scripts/
cp <skill>/mobileqa.config.example.mjs mobileqa.config.mjs   # then edit base/routes/auth
# package.json: "mobileqa": "node scripts/mobileqa.mjs"
echo ".mobileqa/" >> .gitignore
```

The gate files are not part of the default install.

**Metered services:** if the app loads images or data from a service that bills per request (a screenshot API, a maps tiler, an LLM), add its URL glob to `blockRequests` in the config before the first run. The engine aborts those requests in every browser context it opens.

Scenario options: `path`, `public` (no auth), `fresh` (brand-new signed-out context — use it for the login screen), `devOnly` (skipped unless the base is localhost), `waitFor`, `actions` (`click`, `tap`, `fill`, `press`, `waitFor`, `wait`, `evaluate`, or `run: async (page) => {}` for anything Playwright can do), `waitForAfter`, `settle`, `noFullPage`, `phoneOnly`, `desktopOnly`, `minWidth`, `maxWidth`. Cover **every route and every modal/drawer/sheet/menu** — the overlays are where phones break.

**Pitfall learned the hard way:** never navigate away from a page that is still bootstrapping its session. Some apps treat an aborted session fetch as "signed out" and wipe the stored identity. The engine re-navigates only right after an actual login, and the config's `isLoggedOut` should wait for the app to settle on a known state rather than checking after a fixed delay.

A **dev-only component sandbox route** (e.g. `/__qa`, registered only in dev) that renders the shared primitives — the modal with a form taller than a phone, the confirm dialog, inputs, buttons — with no auth and no data gives the suite something that always runs even when the signed-in scenarios are blocked on credentials, and is where a shared-component bug is proven fixed.

## 3. Run it (when asked)

```
npm run mobileqa                       # everything: all scenarios × viewports × light/dark
npm run mobileqa -- --only add-item    # one scenario family
npm run mobileqa -- --viewports phoneSmall,desktop --themes light
npm run mobileqa -- --no-shots         # checks only
```

Run it against the production build (`npm run build && npm start`), never over a live dev server that shares the build directory. Then **open `.mobileqa/report.md`** and **look at the PNGs in `.mobileqa/shots/`** the same way you'd review any screenshot (the checklist in `screenshotqa`). A green run is the floor, not the ceiling — the checks can't see ugly. Report the result to the prompter with the FAIL/warn counts and what each FAIL was.

## 4. What it checks (FAIL vs warn)

- **viewport-meta** — present, `width=device-width`, doesn't disable pinch zoom.
- **h-overflow** — document wider than the viewport, with the outermost offenders named.
- **dialog-fit** — any full-screen overlay whose content starts above the viewport or runs below it with no scrollable region. (The exact "can't scroll to the top of the modal" bug.)
- **unreachable-control** — every button/link/input in the topmost layer can be scrolled into view and is the element actually hit at its centre (catches fixed bars, stray overlays, `pointer-events` mistakes).
- **fixed-bar-overlap** — at the end of the page, content sits under a fixed bottom bar (missing bottom padding).
- **control-font** (phones) — any input/select/textarea under 16px ⇒ iOS focus-zoom.
- **tap-target** — under 24px *and* crowded by a neighbour in the same layer fails on phones (WCAG 2.5.8 with its spacing exception); under 24px but spaced, or under 44px, warns on touch widths (Apple HIG).
- **wide-region** (warn, phones) — a region that must be panned horizontally (a wide table), with how much a sticky first column leaves to pan in. Controls inside it are exempt from the reachability check.
- **text-size** (warn) — text under 11px. **chrome-budget** (warn) — fixed/sticky bars eating >35% of a phone screen. **page-error** (warn) — uncaught JS errors.

## 5. Build rules that keep phones working (put them in the CSS once, per app)

These are worth following whether or not the suite ever runs:

- **Modals/sheets:** `max-height: calc(100dvh - safe-area)`, `display:flex; flex-direction:column`, header `shrink-0`, body `overflow-y:auto; overscroll-behavior:contain`, `role="dialog" aria-modal="true"`. On phones dock to the bottom edge (`items-end sm:items-center`).
- **Viewport height:** `dvh`, never bare `100vh`, for anything that must fit the screen.
- **Safe areas:** `viewport-fit=cover` in the meta tag; `env(safe-area-inset-bottom)` on fixed bottom bars and on the scroll container's bottom padding.
- **Inputs ≥ 16px on phones** (`@media (max-width:767px) { input, select, textarea { font-size: max(16px, 1em) } }`).
- **Tap targets ≥ 44px on touch widths** (`min-height: 44px` on inputs and buttons below `lg`).
- **Hover-only affordances** (`opacity-0 group-hover:opacity-100`) must be visible under `@media (hover: none)`.
- **Tables:** wrap in `overflow-x-auto`, or collapse to cards below `md`.
- **Multi-column grids** in forms: `grid-cols-1 sm:grid-cols-2`, never bare `grid-cols-3` on a phone.
- **HTML5 drag-and-drop** does not fire on iOS/Android touch — every reorder/assign needs a tap alternative (move up/down, a picker) or a pointer-events implementation.

## 6. Auth for the signed-in scenarios

Follow "Auth-gated apps" in `screenshotqa`: the config logs in through the app's **own**
login screen with credentials from env (`.env`, non-`VITE_`, gitignored), and
caches the signed-in browser state in `.mobileqa/state.json`. Never fetch service
keys or mint sessions to get around the gate. If the credentials aren't set, the
authed scenarios are **skipped and the run does not count as a pass** — say so in
the report and ask the prompter for the one-time env setup.

## 7. Lessons that shaped this skill

- The suite used to be mandatory before every UI commit, enforced by a git hook and a Claude hook. The prompter withdrew that on 2026-10-21: it ran far more often than it found bugs, and one run burned about 3,500 paid screenshot-service hits. It is now opt-in, and the gate files are shipped only as an option.
- Block metered third-party requests in the config before the first run, not after the bill.
- A screenshot loop (`screenshotqa`) at desktop and phone widths is still expected after every UI change; that is cheap and is not this suite.

---

*Part of the [AI Build Skills](../README.md) collection · CC BY 4.0.*

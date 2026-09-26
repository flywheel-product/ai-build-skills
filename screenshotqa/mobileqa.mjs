#!/usr/bin/env node
// scripts/mobileqa.mjs — mobile compatibility suite (from the /screenshotqa skill)
//
// Drives the system Google Chrome (playwright-core, channel 'chrome') with REAL
// phone emulation (viewport + touch + mobile UA + DPR), walks every scenario in
// mobileqa.config.mjs at every viewport, screenshots each, and runs a battery of
// in-page checks that catch the classic phone bugs a desktop screenshot never
// shows: horizontal overflow, controls you can't reach (a modal taller than the
// screen, a submit button under a fixed nav), iOS focus-zoom from <16px inputs,
// crowded tiny tap targets, content hidden behind fixed bars, missing viewport meta.
//
// Setup (once per repo): npm i -D playwright-core ; copy this file + mobileqa-gate.mjs
//   into scripts/, add mobileqa.config.mjs at the repo root, add `.mobileqa/` to .gitignore.
// Usage:
//   node scripts/mobileqa.mjs                 # all scenarios, all viewports
//   node scripts/mobileqa.mjs --only add-item # scenarios whose name contains "add-item"
//   node scripts/mobileqa.mjs --viewports phone,desktop
//   node scripts/mobileqa.mjs --themes light   # skip dark mode
//   node scripts/mobileqa.mjs --no-shots       # checks only (fast)
// Env: MOBILEQA_BASE overrides config.base. Auth secrets come from env, see config.
// Exit code: 0 = all checks passed (writes .mobileqa/last-pass.json for the commit gate),
//            1 = at least one FAIL, 2 = suite could not run.
//
// Scenario options: { name, path, public?, fresh? (new signed-out context),
//   waitFor?, actions?: [{click|tap|fill|press|waitFor|wait|evaluate|run(page)}], waitForAfter?,
//   settle?, noFullPage?, phoneOnly?, desktopOnly?, minWidth?, maxWidth? }

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { uiSourceHash } from './mobileqa-gate.mjs';

// ---------- CLI ----------
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const has = (name) => argv.includes(name);
const configPath = resolve(flag('--config') || 'mobileqa.config.mjs');
if (!existsSync(configPath)) { console.error(`mobileqa: no config at ${configPath}`); process.exit(2); }
const config = (await import(pathToFileURL(configPath).href)).default;
const base = process.env.MOBILEQA_BASE || config.base;
const outDir = resolve(config.outDir || '.mobileqa');
const only = flag('--only');
const wantViewports = flag('--viewports')?.split(',') || Object.keys(config.viewports);
const wantThemes = flag('--themes')?.split(',') || config.themes || ['light'];
const takeShots = !has('--no-shots');
const rules = { minTapTarget: 44, hardMinTapTarget: 24, controlFontPx: 16, minTextPx: 11, phoneMaxWidth: 767, touchMaxWidth: 1024, ...(config.rules || {}) };

// ---------- helpers ----------
const shotsDir = join(outDir, 'shots');
mkdirSync(shotsDir, { recursive: true });
for (const f of ['report.json', 'report.md']) { const p = join(outDir, f); if (existsSync(p)) rmSync(p); }

async function reachable(url, ms = 3000) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(ms) }); return r.ok || r.status < 500; } catch { return false; }
}
if (!(await reachable(base))) { console.error(`mobileqa: ${base} is not serving. Start the dev server first.`); process.exit(2); }

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

function contextOptions(vp) {
  const phone = vp.width <= rules.phoneMaxWidth;
  return {
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr ?? (phone ? 3 : 2),
    isMobile: vp.isMobile ?? phone,
    hasTouch: vp.hasTouch ?? phone,
    userAgent: vp.userAgent ?? (phone ? MOBILE_UA : undefined),
    colorScheme: 'light',
  };
}

// ---------- the in-page audit ----------
// Runs inside the page. Returns { findings: [{level, rule, msg, el}], meta }.
// Dependency-free and defensive: every check is wrapped so one throw never
// hides the others.
async function auditPage(page, { phone, touch, scenario }) {
  return page.evaluate(async ({ rules, phone, touch, scenario }) => {
    const findings = [];
    const push = (level, rule, msg, el) => findings.push({ level, rule, msg, el: el ? describe(el) : undefined });
    const vw = window.innerWidth, vh = window.innerHeight;

    function describe(el) {
      if (!el || !el.tagName) return String(el);
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      const txt = (el.getAttribute?.('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const r = el.getBoundingClientRect();
      return `${tag}${id}${cls}${txt ? ` "${txt}"` : ''} @${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    }
    function visible(el) {
      if (!(el instanceof Element)) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      if (el.closest('[aria-hidden="true"]')) return false;
      return true;
    }
    const all = () => Array.from(document.querySelectorAll('body *'));
    // Nearest ancestor that scrolls horizontally (a wide table wrapper).
    function hScrollAncestor(el) {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return p;
      }
      return null;
    }

    // Overlay scoping: when a full-viewport fixed layer (modal, drawer, sheet,
    // lightbox) is open, everything under it is *supposed* to be unreachable.
    // Audit interactive elements inside the topmost overlay only.
    function topOverlay() {
      const overlays = all().filter(el => {
        if (!visible(el)) return false;
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed') return false;
        const r = el.getBoundingClientRect();
        return r.width >= vw * 0.9 && r.height >= vh * 0.9;
      });
      return overlays.length ? overlays[overlays.length - 1] : null;
    }
    const overlay = topOverlay();
    const scope = overlay || document.body;
    const INTERACTIVE = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"]';

    // 1. viewport meta
    try {
      const m = document.querySelector('meta[name="viewport"]');
      const c = m?.getAttribute('content') || '';
      if (!m) push('fail', 'viewport-meta', 'No <meta name="viewport"> — the page renders at ~980px and shrinks on phones.');
      else if (!/width\s*=\s*device-width/.test(c)) push('fail', 'viewport-meta', `viewport meta lacks width=device-width (got "${c}")`);
      else if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(c)) push('warn', 'viewport-meta', `viewport meta disables pinch zoom ("${c}") — an accessibility anti-pattern; fix input font sizes instead.`);
    } catch (e) { push('warn', 'viewport-meta', `check threw: ${e.message}`); }

    // 2. horizontal overflow of the page itself
    try {
      const width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      if (width > vw + 1) {
        const offenders = all().filter(el => visible(el) && !el.closest('[data-qa-allow-overflow]') && !hScrollAncestor(el)).map(el => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ el, r }) => r.right > vw + 1 && getComputedStyle(el).position !== 'fixed')
          .filter(({ el }, _, arr) => !arr.some(o => o.el !== el && o.el.contains(el)))
          .slice(0, 8);
        push('fail', 'h-overflow', `Page is ${width}px wide in a ${vw}px viewport (horizontal scroll). Widest offenders: ${offenders.map(o => describe(o.el)).join(' | ') || 'n/a'}`);
      }
    } catch (e) { push('warn', 'h-overflow', `check threw: ${e.message}`); }

    // 2b. wide regions that scroll horizontally (tables). Legal, but a phone
    //     user has to pan; report how bad, and how much a sticky column eats.
    if (phone) {
      try {
        const regions = new Set();
        for (const el of Array.from(scope.querySelectorAll(INTERACTIVE))) { if (!visible(el)) continue; const c = hScrollAncestor(el); if (c) regions.add(c); }
        for (const c of regions) {
          const sticky = Array.from(c.querySelectorAll('*')).find(el => visible(el) && getComputedStyle(el).position === 'sticky' && getComputedStyle(el).left === '0px');
          const sw = sticky ? Math.round(sticky.getBoundingClientRect().width) : 0;
          push('warn', 'wide-region', `Horizontal panning required: ${c.scrollWidth}px of content in ${c.clientWidth}px${sw ? `, sticky first column ${sw}px leaves ${c.clientWidth - sw}px to pan in` : ''}. Consider a card layout below md. ${describe(c)}`, c);
        }
      } catch (e) { push('warn', 'wide-region', `check threw: ${e.message}`); }
    }

    // 3. controls that trigger iOS focus-zoom (font-size < 16px) — phone widths only
    if (phone) {
      try {
        const ctrls = Array.from(scope.querySelectorAll('input, select, textarea')).filter(el => visible(el) && !['checkbox', 'radio', 'range', 'hidden', 'file', 'color'].includes(el.type));
        const small = ctrls.filter(el => parseFloat(getComputedStyle(el).fontSize) < rules.controlFontPx - 0.01);
        if (small.length) push('fail', 'control-font', `${small.length} form control(s) under ${rules.controlFontPx}px — iOS Safari will zoom the page on focus. e.g. ${small.slice(0, 5).map(describe).join(' | ')}`);
      } catch (e) { push('warn', 'control-font', `check threw: ${e.message}`); }
    }

    // 4. tap targets. Hard minimum 24px (WCAG 2.5.8) WITH its spacing exception:
    //    an undersized target passes if a 24px box centred on it touches no other
    //    target. Undersized + crowded = fail on phones. Under 44px = warn on touch.
    try {
      const interactive = Array.from(scope.querySelectorAll(INTERACTIVE + ', [tabindex]:not([tabindex="-1"])'))
        .filter(el => visible(el) && !el.disabled);
      // A neighbour only counts as crowding if it lives in the same layer: a
      // fixed bar the target happens to be scrolled under is a reachability
      // matter (check 9), not a spacing one.
      const fixedRoot = el => { for (let p = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return p; return null; };
      const rects = interactive.map(el => ({ el, r: el.getBoundingClientRect(), layer: fixedRoot(el) }));
      const isInlineTextLink = el => el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement && (el.parentElement.textContent || '').trim().length > (el.textContent || '').trim().length + 10;
      const crowdedBy = ({ el, r }) => {
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2, h = rules.hardMinTapTarget / 2;
        const box = { l: cx - h, t: cy - h, r: cx + h, b: cy + h };
        const layer = fixedRoot(el);
        return rects.find(o => o.el !== el && o.layer === layer && !el.contains(o.el) && !o.el.contains(el) && o.r.left < box.r && o.r.right > box.l && o.r.top < box.b && o.r.bottom > box.t);
      };
      const hard = [], spaced = [], tooSmall = [];
      for (const t of rects) {
        if (isInlineTextLink(t.el)) continue;
        const under24 = t.r.width < rules.hardMinTapTarget || t.r.height < rules.hardMinTapTarget;
        const under44 = t.r.width < rules.minTapTarget || t.r.height < rules.minTapTarget;
        if (under24) { const n = crowdedBy(t); if (n) hard.push({ el: t.el, n: n.el }); else spaced.push(t.el); }
        else if (under44) tooSmall.push(t.el);
      }
      if (hard.length) push(phone ? 'fail' : 'warn', 'tap-target', `${hard.length} tap target(s) under ${rules.hardMinTapTarget}px AND crowded by a neighbour (WCAG 2.5.8): ${hard.slice(0, 6).map(h => `${describe(h.el)} ← ${describe(h.n)}`).join(' | ')}`);
      if (touch && spaced.length) push('warn', 'tap-target', `${spaced.length} tap target(s) under ${rules.hardMinTapTarget}px (pass by spacing, still hard to hit): ${spaced.slice(0, 6).map(describe).join(' | ')}`);
      if (touch && tooSmall.length) push('warn', 'tap-target', `${tooSmall.length} tap target(s) under ${rules.minTapTarget}px (Apple HIG comfortable minimum): ${tooSmall.slice(0, 6).map(describe).join(' | ')}`);
    } catch (e) { push('warn', 'tap-target', `check threw: ${e.message}`); }

    // 5. dialog fits the viewport (the "can't scroll to the top of the modal" bug)
    if (overlay) {
      try {
        const cards = Array.from(overlay.children).filter(visible);
        for (const card of cards) {
          const r = card.getBoundingClientRect();
          if (r.height < 40) continue; // backdrop layers
          if (r.top < -1) push('fail', 'dialog-fit', `Overlay content starts ${Math.round(-r.top)}px ABOVE the viewport — the top of the dialog is unreachable. Cap it at 100dvh and make its body scroll. ${describe(card)}`, card);
          if (r.bottom > vh + 1 && getComputedStyle(card).overflowY !== 'auto' && getComputedStyle(card).overflowY !== 'scroll') {
            const scrollableInside = Array.from(card.querySelectorAll('*')).some(el => { const cs = getComputedStyle(el); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1; });
            if (!scrollableInside) push('fail', 'dialog-fit', `Overlay content extends ${Math.round(r.bottom - vh)}px BELOW the viewport with no scrollable region — controls at the bottom are unreachable. ${describe(card)}`, card);
          }
        }
      } catch (e) { push('warn', 'dialog-fit', `check threw: ${e.message}`); }
    }

    // 6. small text (warn only)
    try {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      const seen = new Set(); let n = 0; const ex = [];
      while (walker.nextNode()) {
        const t = walker.currentNode; if (!t.textContent.trim()) continue;
        const el = t.parentElement; if (!el || seen.has(el) || !visible(el)) continue; seen.add(el);
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < rules.minTextPx) { n++; if (ex.length < 5) ex.push(describe(el)); }
      }
      if (n) push('warn', 'text-size', `${n} text element(s) under ${rules.minTextPx}px: ${ex.join(' | ')}`);
    } catch (e) { push('warn', 'text-size', `check threw: ${e.message}`); }

    // 7. content hidden behind fixed bottom bars at the end of the page
    if (!overlay) {
      try {
        const bars = all().filter(el => visible(el) && getComputedStyle(el).position === 'fixed').map(el => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.bottom >= vh - 1 && r.height < vh / 2 && r.width >= vw * 0.8);
        if (bars.length) {
          const se = document.scrollingElement || document.documentElement;
          const prev = se.scrollTop;
          se.scrollTop = se.scrollHeight; await new Promise(r => requestAnimationFrame(() => r()));
          for (const { el: bar, r: br } of bars) {
            const barRect = bar.getBoundingClientRect();
            const hidden = Array.from(document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], p, li, td, h1, h2, h3, label'))
              .filter(el => visible(el) && !bar.contains(el) && !el.closest('[data-qa-allow-overflow]'))
              .filter(el => { const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.position === 'sticky') return false; const r = el.getBoundingClientRect(); return r.bottom > barRect.top + 2 && r.top < barRect.bottom && (el.textContent || '').trim(); })
              .filter((el, _, arr) => !arr.some(o => o !== el && o.contains(el)));
            if (hidden.length) push('fail', 'fixed-bar-overlap', `At the end of the page ${hidden.length} element(s) sit under the fixed bottom bar (${Math.round(br.height)}px tall) — add bottom padding to the scroll container. e.g. ${hidden.slice(0, 5).map(describe).join(' | ')}`, bar);
          }
          se.scrollTop = prev;
        }
      } catch (e) { push('warn', 'fixed-bar-overlap', `check threw: ${e.message}`); }
    }

    // 8. fixed chrome budget (warn): top+bottom bars eating the phone screen
    if (phone) {
      try {
        const bars = all().filter(el => visible(el)).map(el => ({ cs: getComputedStyle(el), r: el.getBoundingClientRect(), el }))
          .filter(({ cs, r }) => (cs.position === 'fixed' || cs.position === 'sticky') && r.width >= vw * 0.8 && r.height < vh / 2 && (r.top <= 1 || r.bottom >= vh - 1))
          .filter(({ el }) => !overlay || !overlay.contains(el));
        const total = bars.reduce((s, b) => s + b.r.height, 0);
        if (total > vh * 0.35) push('warn', 'chrome-budget', `Fixed/sticky bars use ${Math.round(total)}px of a ${vh}px viewport (${Math.round(total / vh * 100)}%). ${bars.map(b => describe(b.el)).join(' | ')}`);
      } catch (e) { push('warn', 'chrome-budget', `check threw: ${e.message}`); }
    }

    // 9. reachability: every interactive control in scope can be scrolled into
    //    view and is the thing you'd actually hit at its centre. Catches modals
    //    that overflow the screen, buttons under fixed bars, and overlays that
    //    swallow taps. Controls inside a horizontally scrolling region are
    //    reported by 2b instead (panning them in is legitimate). Runs LAST
    //    because it scrolls things.
    try {
      const interactive = Array.from(scope.querySelectorAll(INTERACTIVE))
        .filter(el => visible(el) && !el.disabled && getComputedStyle(el).pointerEvents !== 'none' && !hScrollAncestor(el));
      const bad = [];
      for (const el of interactive) {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
        const r = el.getBoundingClientRect();
        const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
        if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) { bad.push({ el, why: `off-screen even after scrollIntoView (top=${Math.round(r.top)}, bottom=${Math.round(r.bottom)})` }); continue; }
        const hit = document.elementFromPoint(cx, cy);
        if (!hit) { bad.push({ el, why: 'nothing at its centre point' }); continue; }
        if (hit === el || el.contains(hit)) continue;
        if (el.tagName === 'INPUT' && hit.tagName === 'LABEL' && (hit.contains(el) || hit.htmlFor === el.id)) continue;
        bad.push({ el, why: `covered by ${describe(hit)}` });
      }
      if (bad.length) push('fail', 'unreachable-control', `${bad.length} control(s) cannot be reached/tapped: ${bad.slice(0, 6).map(b => `${describe(b.el)} — ${b.why}`).join(' || ')}`);
      window.scrollTo(0, 0);
    } catch (e) { push('warn', 'unreachable-control', `check threw: ${e.message}`); }

    return { findings, meta: { vw, vh, overlay: overlay ? describe(overlay) : null, scenario, docHeight: document.documentElement.scrollHeight } };
  }, { rules, phone, touch, scenario });
}

// ---------- actions ----------
async function runActions(page, actions = []) {
  for (const a of actions) {
    if (a.click) await page.locator(a.click).first().click({ timeout: 10000 });
    if (a.tap) await page.locator(a.tap).first().tap({ timeout: 10000 });
    if (a.fill) await page.locator(a.fill[0]).first().fill(a.fill[1], { timeout: 10000 });
    if (a.press) await page.keyboard.press(a.press);
    if (a.waitFor) await page.locator(a.waitFor).first().waitFor({ state: 'visible', timeout: 15000 });
    if (a.wait) await page.waitForTimeout(a.wait);
    if (a.evaluate) await page.evaluate(a.evaluate);
    if (a.run) await a.run(page); // escape hatch: any Playwright steps
  }
}

// ---------- run ----------
const scenarios = (config.scenarios || []).filter(s => !only || s.name.includes(only));
if (!scenarios.length) { console.error('mobileqa: no scenarios selected'); process.exit(2); }

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
let authState = null; // Playwright storageState reused across contexts
const statePath = join(outDir, 'state.json');
if (config.auth && existsSync(statePath)) {
  try { const st = JSON.parse(readFileSync(statePath, 'utf8')); if (Date.now() - (st.__savedAt || 0) < (config.auth.maxAgeMs || 12 * 3600e3)) authState = st; } catch { /* ignore */ }
}

// Returns 'ok' (already signed in), 'logged-in' (just signed in — caller must
// re-navigate) or false (cannot sign in).
async function ensureAuth(context, page, vpName) {
  if (!config.auth) return 'ok';
  const loggedOut = await config.auth.isLoggedOut(page);
  if (!loggedOut) return 'ok';
  if (!config.auth.canLogin?.()) return false;
  process.stdout.write(`  [${vpName}] logging in… `);
  const ok = await config.auth.login(page, base);
  console.log(ok ? 'ok' : 'FAILED');
  if (ok) { authState = await context.storageState(); authState.__savedAt = Date.now(); writeFileSync(statePath, JSON.stringify(authState)); }
  return ok ? 'logged-in' : false;
}

async function runScenario({ context, page, sc, vp, vpName, theme, phone, consoleErrors }) {
  const label = `${sc.name} @ ${vpName}${theme !== 'light' ? ` (${theme})` : ''}`;
  const rec = { scenario: sc.name, viewport: vpName, theme, width: vp.width, height: vp.height, findings: [], shots: [], skipped: false };
  results.push(rec);
  try {
    await page.goto(base + sc.path, { waitUntil: 'domcontentloaded' });
    if (theme !== 'light' && config.applyTheme) { await config.applyTheme(page, theme); }
    if (!sc.public) {
      const auth = await ensureAuth(context, page, vpName);
      if (!auth) { rec.skipped = 'auth'; console.log(`  SKIP ${label} — not signed in (set the auth env vars in mobileqa.config.mjs)`); return; }
      if (auth === 'logged-in') {
        // Only navigate again after an actual login. Never interrupt a page that
        // is still bootstrapping — some apps treat an aborted session fetch as
        // "signed out".
        await page.goto(base + sc.path, { waitUntil: 'domcontentloaded' });
        if (theme !== 'light' && config.applyTheme) { await config.applyTheme(page, theme); }
      }
    }
    if (sc.waitFor) await page.locator(sc.waitFor).first().waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForTimeout(sc.settle ?? config.settle ?? 600);
    await runActions(page, sc.actions);
    if (sc.waitForAfter) await page.locator(sc.waitForAfter).first().waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(300);

    if (takeShots) {
      const stem = `${sc.name}--${vpName}${theme !== 'light' ? `--${theme}` : ''}`;
      const p1 = join(shotsDir, `${stem}.png`);
      await page.screenshot({ path: p1, fullPage: false });
      rec.shots.push(p1);
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      if (h > vp.height + 20 && h <= 6000 && !sc.noFullPage) {
        const p2 = join(shotsDir, `${stem}--full.png`);
        await page.screenshot({ path: p2, fullPage: true });
        rec.shots.push(p2);
      }
    }
    const { findings, meta } = await auditPage(page, { phone, touch: vp.width <= rules.touchMaxWidth, scenario: sc.name });
    rec.findings = findings; rec.meta = meta;
    if (consoleErrors.length) { rec.findings.push({ level: 'warn', rule: 'page-error', msg: consoleErrors.splice(0).join(' | ').slice(0, 300) }); }
    const fails = findings.filter(f => f.level === 'fail').length, warns = findings.filter(f => f.level === 'warn').length;
    console.log(`  ${fails ? 'FAIL' : ' ok '} ${label}${fails ? ` — ${fails} fail` : ''}${warns ? ` (${warns} warn)` : ''}`);
  } catch (e) {
    rec.findings.push({ level: 'fail', rule: 'scenario-error', msg: `scenario threw: ${e.message.split('\n')[0]}` });
    console.log(`  FAIL ${label} — ${e.message.split('\n')[0]}`);
  }
}

for (const vpName of wantViewports) {
  const vp = config.viewports[vpName];
  if (!vp) { console.error(`mobileqa: unknown viewport "${vpName}"`); process.exit(2); }
  const phone = vp.width <= rules.phoneMaxWidth;
  for (const theme of wantThemes) {
    if (theme !== 'light' && !phone && !config.darkOnAllViewports) continue; // dark mode: phone only by default (bounds run time)
    const context = await browser.newContext({ ...contextOptions(vp), ...(authState ? { storageState: authState } : {}) });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('pageerror', e => consoleErrors.push(String(e.message || e)));
    for (const sc of scenarios) {
      if ((sc.phoneOnly && !phone) || (sc.desktopOnly && phone) || (sc.maxWidth && vp.width > sc.maxWidth) || (sc.minWidth && vp.width < sc.minWidth)) continue;
      if (sc.fresh) {
        // A brand-new, signed-out context (e.g. to exercise the login screen).
        const fctx = await browser.newContext(contextOptions(vp));
        const fpage = await fctx.newPage();
        const ferr = []; fpage.on('pageerror', e => ferr.push(String(e.message || e)));
        await runScenario({ context: fctx, page: fpage, sc, vp, vpName, theme, phone, consoleErrors: ferr });
        await fctx.close();
        continue;
      }
      await runScenario({ context, page, sc, vp, vpName, theme, phone, consoleErrors });
    }
    await context.close();
  }
}
await browser.close();

// ---------- report ----------
const allFindings = results.flatMap(r => r.findings.map(f => ({ ...f, scenario: r.scenario, viewport: r.viewport, theme: r.theme })));
const fails = allFindings.filter(f => f.level === 'fail');
const warns = allFindings.filter(f => f.level === 'warn');
const skipped = results.filter(r => r.skipped);
const md = [];
md.push(`# Mobile QA report — ${new Date().toISOString()}`, '', `Base: ${base}  ·  Scenarios: ${scenarios.length}  ·  Viewports: ${wantViewports.join(', ')}  ·  Themes: ${wantThemes.join(', ')}`, '');
md.push(`**${fails.length} FAIL · ${warns.length} warn · ${skipped.length} skipped**`, '');
if (fails.length) { md.push('## Failures', ''); for (const f of fails) md.push(`- **${f.rule}** · ${f.scenario} @ ${f.viewport}${f.theme !== 'light' ? ` (${f.theme})` : ''}\n  ${f.msg}`); md.push(''); }
if (warns.length) { md.push('## Warnings', ''); for (const f of warns) md.push(`- ${f.rule} · ${f.scenario} @ ${f.viewport}${f.theme !== 'light' ? ` (${f.theme})` : ''}: ${f.msg}`); md.push(''); }
if (skipped.length) { md.push('## Skipped (not signed in)', '', ...skipped.map(r => `- ${r.scenario} @ ${r.viewport}`), ''); }
md.push('## Screenshots', '', ...results.flatMap(r => r.shots.map(s => `- ${s.replace(outDir + '/', '')}`)), '');
writeFileSync(join(outDir, 'report.md'), md.join('\n'));
writeFileSync(join(outDir, 'report.json'), JSON.stringify({ at: new Date().toISOString(), base, results }, null, 2));

console.log('');
console.log(`mobileqa: ${fails.length} FAIL, ${warns.length} warn, ${skipped.length} skipped → ${join(outDir, 'report.md')}`);
for (const f of fails) console.log(`  FAIL [${f.rule}] ${f.scenario} @ ${f.viewport}: ${f.msg.slice(0, 300)}`);

if (fails.length === 0 && skipped.length === 0) {
  writeFileSync(join(outDir, 'last-pass.json'), JSON.stringify({ at: new Date().toISOString(), hash: uiSourceHash(), scenarios: scenarios.length, viewports: wantViewports }, null, 2));
  console.log('mobileqa: PASS — last-pass.json written (commit gate satisfied).');
  process.exit(0);
}
if (fails.length === 0 && skipped.length) {
  console.log('mobileqa: no failures, but auth-gated scenarios were skipped — the commit gate is NOT satisfied until they run.');
  process.exit(1);
}
process.exit(1);

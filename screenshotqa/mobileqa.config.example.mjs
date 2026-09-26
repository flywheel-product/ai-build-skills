// mobileqa.config.mjs — EXAMPLE repo config for scripts/mobileqa.mjs (copy to the repo root and edit)
//
// Auth: this is an auth-gated app (shared Supabase account + member identity).
// The suite signs in through the app's OWN login screen — no bypass, no service
// keys. Put these in `.env` (gitignored; non-VITE_ vars never reach the bundle):
//   MOBILEQA_PASSWORD=<the camp password>
//   MOBILEQA_MEMBER=<camp name of a NON-lead member to act as, e.g. "Jimbo">
// The signed-in browser state is cached in .mobileqa/state.json (gitignored).
//
// Scenarios marked `public: true` need no auth (login screen + the dev-only
// /__qa component sandbox), so the suite always has something to run.

import { readFileSync, existsSync } from 'node:fs';

// Load .env for MOBILEQA_* without pulling in a dependency.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*(MOBILEQA_[A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const password = process.env.MOBILEQA_PASSWORD;
const memberName = process.env.MOBILEQA_MEMBER;

export default {
  base: 'http://localhost:4311',
  outDir: '.mobileqa',
  settle: 700,
  themes: ['light', 'dark'],

  // Real device classes. Phones get touch + mobile UA + DPR 3 automatically.
  viewports: {
    phoneSmall: { width: 375, height: 667 },   // iPhone SE / 8 — the tightest common phone
    phone:      { width: 390, height: 844 },   // iPhone 12–15
    phoneLarge: { width: 430, height: 932 },   // iPhone Pro Max
    tablet:     { width: 768, height: 1024 },  // iPad portrait (md breakpoint edge)
    desktop:    { width: 1440, height: 1000 },
  },

  rules: { minTapTarget: 44, hardMinTapTarget: 24, controlFontPx: 16, minTextPx: 11 },

  async applyTheme(page, theme) {
    await page.evaluate((t) => {
      localStorage.setItem('theme', t);
      if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
    }, theme);
    await page.waitForTimeout(150);
  },

  auth: {
    maxAgeMs: 12 * 3600e3,
    canLogin: () => Boolean(password),
    async isLoggedOut(page) {
      await page.waitForTimeout(400);
      const u = new URL(page.url());
      if (u.pathname === '/' || u.pathname === '/select-identity') return true;
      return await page.locator('input[type="password"][placeholder="Camp password"]').count() > 0;
    },
    async login(page, base) {
      await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      // Already past the password gate? (Supabase session persisted, identity cleared)
      if (!new URL(page.url()).pathname.startsWith('/select-identity')) {
        const pw = page.locator('input[type="password"]').first();
        await pw.waitFor({ state: 'visible', timeout: 15000 });
        await pw.fill(password);
        await page.getByRole('button', { name: /enter camp/i }).click();
        await page.waitForURL(/\/select-identity/, { timeout: 20000 });
      }
      await page.waitForTimeout(800);
      const btn = memberName
        ? page.getByRole('button', { name: new RegExp(memberName, 'i') }).first()
        : page.locator('button:has(div.font-medium)').first();
      await btn.waitFor({ state: 'visible', timeout: 15000 });
      await btn.click();
      try { await page.waitForURL(/\/(home|dashboard)/, { timeout: 20000 }); } catch { return false; }
      return true;
    },
  },

  scenarios: [
    // ---- public (always run) ----
    { name: 'qa-login', path: '/', public: true, waitFor: 'input[type="password"]' },
    { name: 'qa-sandbox', path: '/__qa', public: true, waitFor: 'h1' },
    { name: 'qa-sandbox-tall-modal', path: '/__qa?modal=tall', public: true, waitFor: 'h2:has-text("Tall Form")' },
    { name: 'qa-sandbox-confirm', path: '/__qa?modal=confirm', public: true, waitFor: 'h2:has-text("Delete thing")' },

    // ---- authenticated: every route ----
    { name: 'home', path: '/home', waitFor: 'main' },
    { name: 'dashboard', path: '/dashboard', waitFor: 'main' },
    { name: 'projects', path: '/projects', waitFor: 'main' },
    { name: 'project-detail', path: '/projects', waitFor: 'main', actions: [{ click: 'main a[href^="/projects/"]' }, { waitFor: 'main h1, main h2' }, { wait: 800 }] },
    { name: 'project-add-item-modal', path: '/projects', waitFor: 'main', actions: [{ click: 'main a[href^="/projects/"]' }, { wait: 800 }, { click: 'button:has-text("Add Item")' }, { waitFor: '[role="dialog"]' }, { wait: 600 }] },
    { name: 'tasks', path: '/tasks', waitFor: 'main' },
    { name: 'tasks-add-modal', path: '/tasks', waitFor: 'main', actions: [{ click: 'main button.btn-primary:has-text("Add")' }, { waitFor: '[role="dialog"]' }, { wait: 600 }] },
    { name: 'task-detail', path: '/tasks', waitFor: 'main', actions: [{ click: 'main a[href^="/tasks/"]' }, { wait: 800 }] },
    { name: 'inventory', path: '/inventory', waitFor: 'main' },
    // The bug that started this suite: the Add Item modal on a phone.
    { name: 'inventory-add-item-modal', path: '/inventory', waitFor: 'main', actions: [{ click: 'main button.btn-primary:has-text("Add Item")' }, { waitFor: '[role="dialog"]' }, { wait: 600 }] },
    { name: 'inventory-detail', path: '/inventory', waitFor: 'main', actions: [{ click: 'main a[href^="/inventory/"]' }, { wait: 800 }] },
    { name: 'members', path: '/members', waitFor: 'main' },
    { name: 'member-detail', path: '/members', waitFor: 'main', actions: [{ click: 'main a[href^="/members/"]' }, { wait: 800 }] },
    { name: 'tags', path: '/tags', waitFor: 'main' },
    { name: 'tags-modal', path: '/tags', waitFor: 'main', actions: [{ click: 'main button:has-text("Add")' }, { waitFor: '[role="dialog"]' }, { wait: 400 }] },
    { name: 'event-years', path: '/event-years', waitFor: 'main' },
    { name: 'driving-groups', path: '/driving-groups', waitFor: 'main' },
    { name: 'sleeping-groups', path: '/sleeping-groups', waitFor: 'main' },
    { name: 'go-bag', path: '/go-bag', waitFor: 'main' },
    { name: 'personal-inventory', path: '/personal-inventory', waitFor: 'main' },
    { name: 'camp-info', path: '/camp-info', waitFor: 'main' },
    { name: 'camp-chores', path: '/camp-chores', waitFor: 'main' },
    { name: 'decisions', path: '/decisions', waitFor: 'main' },
    { name: 'camp-roles', path: '/camp-roles', waitFor: 'main' },
    // Mobile chrome: the More sheet and the sidebar drawer
    { name: 'mobile-more-menu', path: '/home', waitFor: 'main', actions: [{ click: 'nav button:has-text("More")' }, { wait: 500 }], phoneOnly: true },
    { name: 'sidebar-drawer', path: '/home', waitFor: 'main', actions: [{ click: 'header button[aria-label*="menu" i], header button:has(svg.lucide-menu)' }, { wait: 500 }] },
  ],
};

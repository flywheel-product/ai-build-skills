#!/usr/bin/env node
// scripts/mobileqa-gate.mjs — commit gate for the mobile QA suite
//
// `npm run mobileqa` writes .mobileqa/last-pass.json with a hash of every UI
// source file it was run against. This script recomputes that hash from the
// working tree and exits non-zero if the suite has not passed on the *current*
// UI code. Wired into .githooks/pre-commit and the global Claude Code hook.
//
// Usage: node scripts/mobileqa-gate.mjs        # exit 0 = gate satisfied
//        node scripts/mobileqa-gate.mjs --hash # print the current UI hash
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Which files count as "UI". Any change here must re-run the suite before commit.
const UI_GLOBS = ['src', 'index.html', 'public', 'tailwind.config.js', 'postcss.config.js'];
const UI_EXT = /\.(tsx|jsx|ts|js|css|scss|html|svg)$/;

export function uiFiles(cwd = process.cwd()) {
  // tracked + untracked-but-not-ignored, so brand-new files count too
  const out = execSync(`git ls-files -co --exclude-standard -- ${UI_GLOBS.map(g => `'${g}'`).join(' ')}`, { cwd, encoding: 'utf8' });
  return out.split('\n').filter(f => f && UI_EXT.test(f) && existsSync(resolve(cwd, f))).sort();
}

export function uiSourceHash(cwd = process.cwd()) {
  const h = createHash('sha1');
  for (const f of uiFiles(cwd)) { h.update(f); h.update('\0'); h.update(readFileSync(resolve(cwd, f))); h.update('\0'); }
  return h.digest('hex');
}

export function gateStatus(cwd = process.cwd()) {
  const p = resolve(cwd, '.mobileqa/last-pass.json');
  const current = uiSourceHash(cwd);
  if (!existsSync(p)) return { ok: false, reason: 'no .mobileqa/last-pass.json — the mobile QA suite has never passed here', current };
  let last; try { last = JSON.parse(readFileSync(p, 'utf8')); } catch { return { ok: false, reason: 'last-pass.json unreadable', current }; }
  if (last.hash !== current) return { ok: false, reason: `UI source changed since the last passing run (${last.at})`, current, last };
  return { ok: true, current, last };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  if (process.argv.includes('--hash')) { console.log(uiSourceHash()); process.exit(0); }
  const s = gateStatus();
  if (s.ok) { console.log(`mobileqa-gate: OK (suite passed at ${s.last.at} on the current UI source)`); process.exit(0); }
  console.error(`mobileqa-gate: BLOCKED — ${s.reason}.\nRun the dev server, then \`npm run mobileqa\` (must PASS), and commit again.`);
  process.exit(1);
}

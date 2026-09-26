---
name: screenshotqa
description: Render a UI and actually look at it before calling it done — the reliable screenshot-and-review loop for any web app. A clean compile and a 200 response never prove the UI is right; client-rendered layout/CSS bugs (full-width controls, overflow, collapsed rows, wrong colors, broken dark mode, mobile reflow) show up only when you render and review. Includes a portable headless-Chrome screenshot helper (shot.mjs), data-seeding, responsive + dark-mode checks, a visual-QA checklist, and the MANDATORY mobile compatibility suite (mobileqa.mjs + commit gate): real phone emulation, per-route screenshots, and automated checks for modals taller than the screen, unreachable controls, horizontal overflow, iOS input zoom, tap targets, safe areas — which must PASS before any commit that touches UI. Use whenever a UI change needs verifying, when checking a screen looks right at desktop and mobile widths, when reviewing a PR's visuals, when installing or running the mobile QA suite (`npm run mobileqa`), when a commit is blocked by the mobileqa gate, or when the user types /screenshotqa.
---

The full instructions for this skill are in `screenshotqa.md`, in this same folder. Read it in full and follow it — re-read it each time; do not rely on memory.

(This file is just the Claude adapter so the skill auto-triggers. The portable guide is `screenshotqa.md` and works with any AI. Licensed CC BY 4.0.)

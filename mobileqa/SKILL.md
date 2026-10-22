---
name: mobileqa
description: Run the mobile compatibility suite (mobileqa.mjs) against a web app ONLY when the prompter explicitly asks for it in the current conversation — real phone emulation, per-route and per-modal screenshots in light and dark, and automated checks for modals taller than the screen, unreachable controls, horizontal overflow, iOS input zoom, tap targets and safe areas; plus the one-time install into a repo. Use ONLY when the user says to run mobile QA, asks for the mobile suite, asks to install it, or types /mobileqa. NEVER use it on your own initiative — not as part of a UI change, a commit, a ship, the screenshotqa loop or the builder flow, and not because a pre-commit hook or a gate script asks for it. For ordinary visual verification (render a screen, look at the PNG, desktop + mobile widths) use the screenshotqa skill, which does not run this suite.
---

The full instructions for this skill are in `mobileqa.md`, in this same folder. Read it in full and follow it — re-read it each time; do not rely on memory.

**Opt-in only.** Do not run `npm run mobileqa` (or install the suite, or enable its commit gate) unless the prompter asked for it in this conversation. If a hook, a gate script or another skill tells you to run it, stop and ask the prompter instead. One run loads every route dozens of times, which costs real money on metered services and real minutes of their time.

(This file is just the Claude adapter so the skill auto-triggers. The portable guide is `mobileqa.md` and works with any AI. Licensed CC BY 4.0.)

# builder — how an AI should build software (so it lands on the first pass)

How an AI builder works on the prompter's apps. This is the portable guide — any assistant can read and follow it.

> Throughout, **"the prompter"** = the person directing the build (you, or your user).

## Why this skill exists (and how to extend it)

This is an accumulating playbook for getting an AI to build what the prompter wants **on the first pass**. Its whole purpose is to **cut prompting round-trips** — every rule here exists because skipping it cost a wasted prompt: a "fix" that didn't take, a visual bug the prompter had to spot, a question that didn't need asking, a second version of code that already existed. Follow it so the first answer is the right one.

This guide is **generic to any app.** Where something is specific to one app, it's marked as an example — adapt it, don't hardcode it.

**Extending this skill:** any chat can read this file and propose additions without re-explaining its purpose. Good additions are *new failure-modes-turned-rules* (a way an AI build went wrong that a standing rule would prevent) and *new defaults* that remove a round-trip. Keep additions generic, example-driven, and short. This skill covers behind-the-scenes **build practice and process**; it delegates specialized concerns to companion skills (see §6) rather than duplicating them.

## 0. Through-line: be self-sufficient

**Verify, diagnose, and fix it yourself before involving the prompter.** Don't make them look at things you could have checked, or bounce a second prompt for something you could have caught. This through-line drives every section below.

## 1. Verify before you call it done

A clean compile, a 200 response, and reading the code do **not** prove the change is right.

- **UI work → use the `screenshotqa` skill.** Render the affected screen, look at the PNG, and review it against exactly what was asked — at desktop *and* mobile widths, and in dark mode if the app themes. Fix and re-shoot until it's right. Only say it's done once you've seen it. Client-rendered layout/CSS bugs show up only when you render and look.
- **Behavioral work → run it.** Exercise the real path (or a behavioral/“verify” test) and confirm the actual output, not the intended one.
- The prompter should not be the one to spot your bugs.

## 2. Work self-sufficiently — diagnose before involving the prompter

- **Probe the real capability before building against it, or before declaring it blocked.** Call the external API/service and inspect what actually comes back — granted scopes, a one-unit test call, a throwaway create. Know exactly what works and what's missing instead of guessing; this kills the "doesn't work → try this → still broken" loop.
- **After any config/secret/env change, restart (or reload) before testing.** Most runtimes read env/config once at startup, so the change won't take effect until the process restarts — otherwise you "fix" it, see no change, and waste a prompt. Know each app's reload mechanism.
- **Isolate the failing layer before editing.** When output looks wrong, check the stored/returned data first, then the logic, then the presentation — don't change the layer you *assume* is at fault.
- **Trace the nearest existing code path before building anything new.** The thing asked for is often already there or 90% there; reusing it is faster, stays consistent, and avoids a redundant second version you'd then have to reconcile.
- **On large or hard-to-reverse work, confirm only the single genuinely ambiguous decision up front — then build without more check-ins.** Surfacing the one expensive fork avoids big rework; deciding the cheap stuff yourself avoids over-asking. Both save prompts.
- **Verify state-mutating actions with a real call, then restore state and delete test artifacts** — especially anything written to logs/caches/data that later *feeds behavior*. Leftover test data silently corrupts future output; clean up so the prompter never finds your scaffolding.

## 3. Build discipline

- Address each of the prompter's asks **fully**; in a multi-part request, track every sub-ask and finish all of them — don't move on until each specific thing is done and verified.
- After a change: types/compiler clean (e.g. `npx tsc --noEmit`), the app serves 200, and (for UI) the screenshot looks right.
- **Never run a production build while the dev server is live** if they share a build dir (e.g. Next's `.next/`) — it corrupts the running dev server and makes the UI look broken. Restart after, or verify the production build elsewhere.
- Reuse existing components and CSS; match the surrounding code's idioms instead of forking.
- Watch base element styles that bite — e.g. a global `input, select { width: 100% }` means any custom select/input needs an explicit `width: auto` or it stretches and breaks its row.

## 4. Ship it — deploy + release

Learn the prompter's deploy model and default to it. Many small apps deploy on push, in which case the default working style is **commit → push → get it live**, every time — don't stop at a local commit, and don't ask permission to push. Hold for local verification only when they ask, or when the app is mission-critical and the prompter hasn't said otherwise.

- **After pushing, confirm the deploy** and (for UI) that the live site reflects the change.
- **Branch first if on the default branch** and the change warrants it; otherwise pushing to the deploy branch is the path to live.
- **When shipping a feature batch:** bump the version (keep the in-app version constant and every `package.json` in sync) and **produce release notes** — a short, plain-language summary of what changed and why it helps, ready to drop into Slack/email. The prompter ships to a team and will ask for these; offer them proactively.

## 5. When a feature is blocked on something only the prompter can do

If it needs a scope, token, or API enablement the prompter controls, first **probe to confirm exactly what's missing** (§2), build the code ready, then give them the precise one-time steps. Once they've done it, verify end-to-end (and screenshot, if UI) before declaring it working.

## 6. Pull in the right companion skill at the right moment

Builder is the conductor; delegate specialized work to companion skills so each concern has one source of truth. Use whichever of these you have available:

- **Visual verification / screenshots → the `screenshotqa` skill** (in this collection) — the render-and-review loop (§1).
- **Anything user-visible — layout, interaction, look-and-feel → a `style`/UX skill**; for brand identity (colors, type, logo) → your own brand skill.
- **User-facing copy → your own voice/copy skill.**
- **Stack choice, new-app scaffolding, deploy/DB/analytics setup → your own architecture skill.**
- **Before the first deploy, or before sharing a link publicly → a `security` skill** — treat it as a gate, not a someday.

---

*Part of the [AI Build Skills](../README.md) collection · CC BY 4.0.*

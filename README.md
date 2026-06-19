# AI Build Skills

Portable, tool-agnostic **playbooks for building software well with any AI assistant.** Each skill is a plain-markdown guide that encodes a hard-won build practice — verify your own work, ship cleanly, catch the bugs a human shouldn't have to. They're written to be read by any AI (or any human), and they trigger natively in Claude Code / Claude.ai via a thin adapter.

These are deliberately **generic** — no company's brand, voice, or stack baked in. Use them, fork them, adapt them.

## What a skill looks like

Each skill is a folder:

```
screenshotqa/
├── screenshotqa.md   ← the guide (the real content — readable by any AI or human)
├── SKILL.md          ← thin Claude adapter so the skill auto-triggers (points to the .md)
└── shot.mjs          ← any scripts the skill uses, right in the folder
```

The guide keeps its own name (`screenshotqa.md`), so it's the canonical artifact. `SKILL.md` is just a ~3-line shim for Claude — strip it away and the skill still works anywhere.

## How to use these

- **Claude Code / Claude.ai** — copy (or symlink) a skill folder into `~/.claude/skills/`. The `SKILL.md` adapter makes Claude auto-trigger it and read the guide.
- **Any other AI / agent (Cursor, etc.)** — point it at the skill's `.md` file, or add it as a project rule / context. It's self-contained markdown.
- **A human** — just read it.

> Throughout the guides, **"the prompter"** means the person directing the build (you, or your user).

## Skills

| Skill | What it does |
|---|---|
| [builder](builder/builder.md) | The build-practice playbook: be self-sufficient (verify/diagnose/fix before asking), build & ship discipline (compile clean, don't build over a live dev server, commit→push→live, version + release notes), and which companion skills to pull in when. |
| [screenshotqa](screenshotqa/screenshotqa.md) | Render a UI and actually look at it — the screenshot-and-review loop, with a portable headless-Chrome helper, data-seeding, responsive + dark-mode checks, and a visual-QA checklist. |
| [style](style/style.md) | Universal style & usability standards for good, non-generic UI — interaction patterns, forms/tables, navigation, feedback states, accessibility, spacing/motion, light/dark, responsiveness. Brand-agnostic. |
| [security](security/security.md) | Audit a web app against a practical security checklist — auth/RLS, exposed secrets, signups, storage, IDOR, webhooks, headers, XSS — with live-verification steps and a triage table. |
| [aesthetic](aesthetic/aesthetic.md) | Pick and fully commit to ONE distinct visual aesthetic from a curated library (Glassmorphism, Swiss, Neobrutalism, Cyberpunk, … plus brand-derived looks). For a deliberate, distinctive vibe when a UI isn't bound to a specific brand. |

## License

[Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE) — free to use, adapt, and redistribute (including commercially) with attribution. © 2026 Jim Morris / Flywheel Product Group.

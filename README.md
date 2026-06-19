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
| [screenshotqa](screenshotqa/screenshotqa.md) | Render a UI and actually look at it — the screenshot-and-review loop, with a portable headless-Chrome helper, data-seeding, responsive + dark-mode checks, and a visual-QA checklist. |

_More on the way (builder, style, security)._

## License

[Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE) — free to use, adapt, and redistribute (including commercially) with attribution. © 2026 Jim Morris / Flywheel Product Group.

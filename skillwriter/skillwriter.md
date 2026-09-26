# skillwriter — how to write a skill to disk

A **skill** is a folder of plain markdown (plus any scripts) that teaches an AI one practice. This guide is the layout convention for every skill in this collection and its private siblings. It exists because skills drift: procedures creep into the adapter, guides pick up machine-specific paths, folders end up unversioned, READMEs go stale. Each rule below is a drift-turned-default.

Throughout, **"the prompter"** = the person directing the build.

## 1. The two-file shape (and why)

```
<skill>/
├── <skill>.md        ← the guide: ALL the real content, readable by any AI or human
├── SKILL.md          ← thin Claude adapter: frontmatter + a pointer to the guide
└── <scripts/assets>  ← anything the guide runs or uses, right in the folder
```

- **The guide is the canonical artifact and keeps the skill's name** (`screenshotqa.md`, not `guide.md` or `README.md`). Strip the adapter away and the skill still works in Cursor, a project rule, or a human's hands.
- **The adapter exists only so Claude auto-triggers.** Its description is what Claude matches on; its body tells Claude to go read the guide. It never carries procedure.
- Never put the full procedure in `SKILL.md`. When updating a skill, edit the guide, not the adapter — the adapter changes only when the *trigger* changes.

## 2. The adapter (`SKILL.md`) — template

```markdown
---
name: <skill>
description: <what it does, in one breath> — <the main pieces, comma-separated>. Use when <use-case 1>, <use-case 2>, <use-case 3>, or when the user types /<skill>. <One line on what it is NOT for, pointing to the sibling skill that is.>
---

The full instructions for this skill are in `<skill>.md`, in this same folder<, plus any one-line contents summary or "read X first" note>. Read it in full and follow it — re-read it each time; do not rely on memory.

(<footer — see §3>)
```

**The description is the whole trigger, so make it trigger-rich:**
- Lead with what the skill does, then list the concrete pieces it covers (these are the words a prompter will actually type).
- Include several "Use when…" phrasings, the literal `/<skill>` slash command, and the ways a prompter might ask without naming it ("make it sound like me", "get this off Bolt").
- Say what it is *not* for and name the sibling that is — this stops two skills firing on the same request.
- 400–1100 characters is the working range in this collection. Shorter under-triggers; longer buries the keywords.

**The body is three sentences and a footer.** "Read it in full … re-read it each time; do not rely on memory" is not decoration: models will otherwise answer from a stale memory of the guide. A skill whose guide depends on another skill says so here ("Read `oa-rubric/oa-rubric.md` first, then this guide").

## 3. Footers — say who owns it and where it works

Pick one and put it in parentheses as the adapter's last line:

- **Public / generic skill:** `(This file is just the Claude adapter so the skill auto-triggers. The portable guide is `<skill>.md` and works with any AI. Licensed CC BY 4.0.)`
- **Private / organization-specific skill:** `(SKILL.md is the Claude adapter; the guide is `<skill>.md`. Private to <Org>.)`
- Overlay skills add: `Companion to /<base>, /<sibling>, …`

The public guide also ends with a collection line: `*Part of the [AI Build Skills](../README.md) collection · CC BY 4.0.*`

## 4. The guide (`<skill>.md`) — what makes it portable

- **AI-agnostic.** No "Claude", no tool names that only one harness has, unless you say what any other AI should do instead ("via Chrome automation; if you have no browser, hand the prompter the list").
- **Headers, not a wall.** `# <skill> — <one-line promise>` at the top, then `##` sections a reader can jump to. Long guides (300+ lines) get a table of contents.
- **Explain the why.** Every rule states the failure it prevents. A rule with a reason survives edits; a bare rule gets "simplified" away.
- **Keep a calibration / lessons-learned section** at the end ("Calibration from past runs", "Failure modes (extend as you learn)", "Where this comes from"). This is where real runs write back what they learned, so the next run starts smarter. Say what is verified and what is not yet.
- **Reference siblings relatively, never absolutely.** Write `vibecodetransfer/vibecodetransfer.md` ("the sibling skill folder next to this one"), not `~/.claude/skills/vibecodetransfer/…` and never `/Users/<name>/…`. A guide that hardcodes one machine's path is not portable, and the path is wrong the moment the skill is symlinked or copied. Same for scripts: "run `make_favicon.py` from this skill's folder".
- **Scripts and assets ship in the folder** and the guide says how to run them. If the guide tells a repo to *copy* files in (hooks, QA suites), list every file with its destination.
- **Mark generic vs example.** Where something is specific to one app or org, label it as an example to adapt.

## 5. Patterns for related skills

- **Base + overlay.** One platform-agnostic base guide (`vibecodetransfer`) marks its extension points (`→ overlay`); each platform overlay (`bolttransfer`, `lovabletransfer`) is its own full skill whose adapter says "read BOTH, in order: the base, then this overlay", and whose guide carries only the delta. Overlays never restate the base.
- **Family with a shared rubric.** Several checkers (`oa-*-check`) each read one shared definitions skill (`oa-rubric`) first. The rubric is its own skill so it triggers alone for "what is an OA", and every family member's adapter names it.
- **Conductor.** A process skill (`builder`) does not duplicate specialized concerns; it lists which companion to pull in when (§6 there). When you add a skill that a conductor should delegate to, add the line in the conductor.

## 6. Where a skill lives

- **Every skill lives in a git collection repo**, never as a loose folder in `~/.claude/skills/`. A loose folder has no history, no undo, and no README entry; it is invisible to the next person. Generic → the public collection (CC BY). Org-specific (brand, voice, stack, internal workflows) → the private one.
- **`~/.claude/skills/<skill>` is a symlink into the repo.** Claude Code reads it there; edits land in git.
- **Add a row to the collection README's table** in the same commit. The README is how a human finds a skill; a stale table means the skill effectively does not exist.
- **Ship it like code:** branch → commit → push → PR → merge. Don't let guide edits sit uncommitted; the whole point of a living playbook is that the latest lesson is the one everyone reads.

## 7. Naming

- Lowercase, one word where possible (`builder`, `theme`, `screenshotqa`); a hyphen for compound names (`crew-exec`, `oa-rubric`). The folder, the guide, the `name:` field, and the slash command are all the same string.
- **Check the name against vendor and plugin skills before choosing it.** A synced skill with the same name (e.g. `skill-creator`) competes for the same triggers and confuses the prompter about which one fired. This guide is `skillwriter` for exactly that reason.
- Families share a prefix (`oa-*`); overlays end in the base's noun (`*transfer`).

## 8. Audit checklist (run on every skill you create or touch)

1. Folder has `SKILL.md` **and** `<skill>.md`, names matching the folder.
2. Adapter body is a pointer only — no procedure; has "re-read it each time"; has the right footer.
3. Description names the pieces, several use-cases, the `/<skill>` trigger, and what it is not for.
4. Guide starts with `# <skill> — <promise>`, has `##` sections, explains the why, ends with calibration / lessons-learned.
5. No `~/.claude/skills/…`, no `/Users/…`, no other machine-specific path anywhere. Sibling references are relative.
6. Scripts/assets are in the folder and the guide says how to run them.
7. The folder is inside a collection repo, symlinked into `~/.claude/skills/`, and has a README row.
8. If a conductor skill should delegate to it, the conductor lists it.
9. Working tree is clean: the change is committed and pushed.

## Calibration from past audits

- 2026-09-26, 25 skills across two collections: the two files were right everywhere, but five skills sat unversioned as loose folders, four guides hardcoded `~/.claude/skills/…` paths, one README was missing fourteen rows, and two repos had week-old uncommitted guide edits. The layout rule was fine; §5–§8 exist because everything *around* the layout had drifted.
- A shell comment inserted before a line-continuation backslash silently breaks a multi-line command in a guide. Put run-location notes in prose above the code block, not inside it.

---

*Part of the [AI Build Skills](../README.md) collection · CC BY 4.0.*

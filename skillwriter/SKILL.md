---
name: skillwriter
description: How to write an AI skill to disk so it is portable to any AI and auto-triggers in Claude — the two-file convention (thin SKILL.md adapter + a named <skill>.md guide that holds all the real content), the adapter template and footers, trigger-rich descriptions with the /slash command, sibling references instead of absolute paths, scripts shipped alongside, the base+overlay and family patterns, versioning in a collection repo with a README row and a symlink into ~/.claude/skills. Use when creating a new skill, restructuring or auditing existing skills for conformance, deciding where a skill should live, naming a skill, or when the user types /skillwriter. Not for Anthropic's own skill-creator (evals/benchmarks); this is the house layout convention.
---

The full instructions for this skill are in `skillwriter.md`, in this same folder. Read it in full and follow it — re-read it each time; do not rely on memory. It ends with an audit checklist; run it against every skill you create or touch.

(This file is just the Claude adapter so the skill auto-triggers. The portable guide is `skillwriter.md` and works with any AI. Licensed CC BY 4.0.)

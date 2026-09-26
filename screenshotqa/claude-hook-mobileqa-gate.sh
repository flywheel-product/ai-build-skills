#!/bin/bash
# Claude Code PreToolUse hook (Bash) — mobile QA commit gate.
# Fires when the Bash command really invokes `git commit`. Exit 2 blocks the
# tool call and feeds stderr back to Claude.
#
# Rules:
#  1. Repo has mobileqa.config.mjs → staged UI files require a PASS of
#     `npm run mobileqa` on the current UI source (scripts/mobileqa-gate.mjs).
#  2. Repo has no mobileqa.config.mjs but looks like a web UI project (react/vue/
#     svelte/next/vite in package.json) and UI files are staged → block and tell
#     Claude to install the suite from the screenshotqa skill first.
#  3. Anything else → allow.
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)

# Only inspect actual command text: strip heredoc bodies and quoted strings so a
# commit message, a doc, or a test string that merely *mentions* the words does
# not trigger the gate.
code=$(printf '%s\n' "$cmd" | awk '
  BEGIN { inh = 0 }
  inh == 1 { if ($0 == term) inh = 0; next }
  {
    line = $0
    if (match(line, /<<-?[ \t]*['"'"'"]?[A-Za-z_][A-Za-z0-9_]*['"'"'"]?/)) {
      t = substr(line, RSTART, RLENGTH); sub(/<<-?[ \t]*/, "", t); gsub(/['"'"'"]/, "", t); term = t; inh = 1
    }
    print line
  }' | sed -E "s/'[^']*'//g; s/\"[^\"]*\"//g")
segs=$(printf '%s\n' "$code" | grep -Eo '(^|[;&|(]|then |do )[[:space:]]*git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?commit\b[^;&|]*' || true)
[ -z "$segs" ] && exit 0
if printf '%s' "$segs" | grep -q -- '--no-verify'; then
  echo "mobileqa-gate: --no-verify is not allowed for Claude; run the suite instead." >&2
  exit 2
fi

cwd=$(printf '%s' "$input" | jq -r '.cwd // ""' 2>/dev/null)
[ -n "$cwd" ] && cd "$cwd" 2>/dev/null
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0
ui_staged=$(git diff --cached --name-only 2>/dev/null | grep -E '^(src/|app/|pages/|components/|index\.html|public/).*\.(tsx|jsx|ts|js|css|scss|html|svelte|vue)$' | head -1)
[ -z "$ui_staged" ] && exit 0

if [ -f mobileqa.config.mjs ]; then
  if ! out=$(node scripts/mobileqa-gate.mjs 2>&1); then
    echo "$out" >&2
    echo "mobileqa-gate: UI files are staged but the mobile QA suite has not passed on this source. Start the dev server, run \`npm run mobileqa\`, fix every FAIL, then commit." >&2
    exit 2
  fi
  exit 0
fi
if [ -f package.json ] && grep -Eq '"(react|react-dom|vue|svelte|next|vite|@angular/core|solid-js)"' package.json; then
  echo "mobileqa-gate: this web UI repo has no mobile QA suite (mobileqa.config.mjs). Install it first — see the 'Mobile compatibility suite' section of the screenshotqa skill (copy scripts/mobileqa.mjs + scripts/mobileqa-gate.mjs, add mobileqa.config.mjs, .githooks/pre-commit, npm scripts) — run it to PASS, then commit." >&2
  exit 2
fi
exit 0

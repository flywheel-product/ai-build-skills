# security — vibe-coded web-app security audit

> The single source of truth for auditing the security of a "vibe-coded" web app. Most of these are **React/Vite frontend + Supabase backend, hosted on Netlify/Vercel/Cloudflare**. The advice assumes that stack but the principles are universal — see **Other stacks** at the end if the backend is Firebase, a custom Node/Express/Next API, etc.

> Throughout, **"the prompter"** = the person directing the build (you, or your user).

## Contents

- [Applying this guide](#applying-this-guide)
- [Modes](#modes)
- [The #1 thing to understand](#the-1-thing-to-understand)
- [🔴 CRITICAL — fix before anyone uses the app](#-critical--fix-before-anyone-uses-the-app)
- [🟠 HIGH — fix soon](#-high--fix-soon)
- [🟡 MEDIUM — hardening](#-medium--hardening)
- [🟢 GOOD HYGIENE](#-good-hygiene)
- [Live verification](#-live-verification-do-this-yourself--with-permission--these-hit-a-live-server)
- [Quick triage summary](#quick-triage-summary)
- [CI hook (offline, no live server)](#ci-hook-offline-no-live-server)
- [Periodic re-audit](#periodic-re-audit)
- [Other stacks (when it's not Supabase)](#other-stacks-when-its-not-supabase)

---

## Applying this guide

When this skill runs, you are doing a **real audit of the current project**, not just handing back a checklist. Work in this order:

1. **Detect the stack first.** Look for `package.json`, `supabase/`, `.env*`, `netlify.toml` / `vercel.json` / `wrangler.toml`, and any `firebase.json`. State what you found in one line before auditing. If the backend isn't Supabase, adapt the checks (see **Other stacks**).
2. **Audit every 🔴 item, then 🟠, then 🟡.** For each item give a verdict — **PASS / FAIL / UNKNOWN** — with the **specific file, line, table, or setting** as evidence, then the **exact fix** (code or dashboard steps). Never say PASS without evidence; if you can't verify from the repo (e.g. a Supabase dashboard toggle), mark it **UNKNOWN** and tell the prompter exactly what to click to check.
3. **Grep, don't guess.** Run the search commands in each item against the actual repo. A claim like "no secrets in frontend" must be backed by a grep that returned zero hits.
4. **Never run mutating or network commands without permission.** The `curl` probes in "Live verification" hit a live server and the signup probe creates a test user — show the command and ask before running, or hand it to the prompter to run themselves.
5. **Report severity-first.** Lead with a triage table (below), then the per-item detail. End with the **top 3 things to fix right now**.
6. **Trust, but verify.** If a previous AI audit said something is secure, re-check it — models routinely call insecure things secure. This is the single most important habit.

Output shape:
```
Stack detected: <one line>

## 🔴 Critical
- C1 RLS enabled everywhere — FAIL — `supabase/migrations/003.sql:12` table `messages` has no RLS. Fix: <sql>
- C2 ...
## 🟠 High … ## 🟡 Medium …

## Fix these 3 first
1. … 2. … 3. …
```

### Modes
- **`/security`** (default) — audit and report only. Make no edits.
- **`/security --fix`** — after reporting, **apply only the safe, mechanical fixes** to a working branch (create one first if on `main`): enable RLS on tables that lack it, replace `using (true)` with a scoped policy or a clearly-marked `-- TODO: scope this` stub, add missing `with check`, move a leaked secret out of a client file into server env + add to `.gitignore`, add a `_headers`/`vercel.json` security-headers block. **Never auto-fix anything ambiguous** (deleting data, rewriting auth logic, changing business rules) — list those as manual follow-ups. Show a diff and summarize what was changed vs. left for the prompter. Rotating an already-committed secret is always a manual step — flag it, never assume it's handled.
- **`/security --grep`** — run only the offline grep checks (secrets scan + `using(true)`/`if true` detector + public-env-var scan). No live probes, no dashboard items. This is the CI-friendly subset.

---

## The #1 thing to understand

Your frontend ships a **Supabase "anon key"** (a public API key) in the JavaScript. **This is normal and by design — it is NOT a secret and NOT a vulnerability.** Anyone can read it in 10 seconds by viewing your site's source.

Because that key is public, **your entire security depends on Row-Level Security (RLS) policies in the database** — not on your login screen. If RLS is off or misconfigured, the login screen is *decorative*: a stranger can skip it entirely and talk to your database directly with `curl`.

> 🔑 **Golden rule:** The login page protects nothing. **RLS policies protect everything.**

---

## 🔴 CRITICAL — fix before anyone uses the app

### C1. Row-Level Security is ENABLED on every table
- Every table in the `public` schema must have **RLS enabled**.
- Check: Supabase → **Table Editor** → each table → it must say *"RLS enabled"*. Or run:
  ```sql
  -- Lists any table in public where RLS is OFF (these are wide open):
  select c.relname as unprotected_table
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false;
  ```
- Enable it everywhere:
  ```sql
  alter table public.your_table enable row level security;
  ```
- ⚠️ Enabling RLS with **no policies blocks ALL access** (even your app). You must add policies (C2) at the same time.
- Also check **views**: a view owned by a privileged role can bypass the RLS of its underlying tables. Prefer `security_invoker = true` on views (Postgres 15+).

### C2. Policies are SCOPED, not `USING (true)`
- A policy of `using (true)` means **"everyone can read/write everything"** — as bad as having RLS off.
- ❌ Bad: `create policy "p" on members for select using (true);`
- ✅ Good (per-user data): `create policy "p" on members for select using (auth.uid() = user_id);`
- ✅ Good (shared data, fixed team): restrict to an allowlist:
  ```sql
  create policy "team read" on members for select
  using (auth.uid() in (select user_id from allowed_users));
  ```
- Do this for **each operation** you allow: `select`, `insert`, `update`, `delete`. Don't grant `delete`/`update` unless the app actually needs it.
- **`insert`/`update` need `WITH CHECK`, not just `USING`.** `USING` filters which rows are visible; `WITH CHECK` validates the new row. A common hole: an update policy that lets a user set `user_id` to someone else's id. Use `with check (auth.uid() = user_id)`.
- Audit existing policies:
  ```sql
  select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public';
  ```
  Flag any `qual` or `with_check` that is `true` or `null`.

### C3. Public signups are DISABLED or gated
- "Authenticated users can read data" + "anyone can sign up" = **anyone can read your data.**
- Supabase → **Authentication → Providers → Email** → turn **OFF "Enable signups"**, then invite users via **Authentication → Users → Invite**.
- Or keep signups on but **require email confirmation** AND back your policies with an `allowed_users` allowlist table.
- If you gate by email domain, do it **server-side** (a trigger or Edge Function), never by a client-side check.

### C4. The `service_role` key is NEVER in the frontend
- The `service_role` key **bypasses RLS entirely**. It must only live in server-side code (Supabase Edge Functions, backend env vars) — **never** in client JavaScript, never committed to git, never in a `VITE_*` / `NEXT_PUBLIC_*` / `PUBLIC_*` variable.
- Check: search the whole repo. It should appear **zero** times in any file that ships to the browser:
  ```bash
  grep -rniE "service_role|supabaseServiceRole|SUPABASE_SERVICE" --include="*.{ts,tsx,js,jsx,vue,svelte,env,html}" .
  ```

### C5. No real secrets in the frontend or in git
- ❌ Never in client code: OpenAI/Anthropic keys (`sk-...`), Stripe **secret** keys (`sk_live_...`), AWS keys (`AKIA...`), Google/GCP keys, database passwords, SMTP creds, JWT signing secrets, any `service_role`.
- These belong in **server-side environment variables / Edge Functions** only. The browser calls *your* function; your function holds the secret.
- Public-by-design prefixes ship to the browser — **never put a secret behind them**: `VITE_*` (Vite), `NEXT_PUBLIC_*` (Next), `PUBLIC_*` (SvelteKit/Astro), `REACT_APP_*` (CRA), `EXPO_PUBLIC_*` (Expo).
- Scan the repo and history:
  ```bash
  # Current tree
  grep -rniE "sk-[a-z0-9]{20,}|sk_live_|rk_live_|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-|ghp_[A-Za-z0-9]{36}" \
    --exclude-dir=node_modules --exclude-dir=.git .
  # Git history (a deleted secret is still in history — and still compromised)
  git log -p | grep -iE "sk-|service_role|password|secret|api[_-]?key" | head
  ```
- If a real secret was ever committed, **rotate it** — deleting it from the latest code is not enough. Consider `git-filter-repo` / BFG to purge history, but rotation is mandatory regardless.
- Keep `.env*` in `.gitignore`. Verify `.env` isn't tracked: `git ls-files | grep -E "\.env"` should return nothing but `.env.example`.

---

## 🟠 HIGH — fix soon

### H1. Every API/Edge Function authorizes the caller
- A function that trusts a `user_id` sent from the client lets anyone act as anyone. **Derive identity from the verified session/JWT**, not from request body params. In a Supabase Edge Function, read the JWT from the `Authorization` header and call `supabase.auth.getUser(jwt)` — don't read `user_id` from the body.

### H2. No authorization logic that only runs in the browser
- "Hide the admin button" is not security. If the API/database would let a non-admin perform the action, hiding the UI changes nothing. Enforce roles in **RLS policies / server code**. Store roles in the DB (or JWT app_metadata), never in client state or `localStorage`.

### H3. No IDOR — object access is checked, not just object existence
- The classic vibe-coded bug: `/api/invoice/123` returns invoice 123 to **anyone logged in**, instead of only its owner. Every fetch-by-id must filter by owner (RLS does this for Supabase REST automatically; custom endpoints must do it explicitly). Test by logging in as user A and requesting user B's id.

### H4. File storage (Supabase Storage) buckets are locked down
- Public buckets = anyone can list/download every file. Set buckets to **private** and add Storage RLS policies, unless the files are genuinely meant to be public.
- Storage policies should scope by path/owner, e.g. files under `auth.uid()/...`. Don't allow arbitrary path writes (path traversal into another user's folder).

### H5. Rate limiting / abuse protection on expensive endpoints
- Especially anything that calls a paid AI API or sends email/SMS. Without limits, a stranger can run up your bill. Add Supabase rate limits, Cloudflare rules, a per-user quota table, or a Captcha on auth endpoints (Supabase supports hCaptcha/Turnstile).

### H6. Webhooks verify their signature
- Stripe / Clerk / GitHub / Supabase webhooks must verify the signing secret (`stripe.webhooks.constructEvent`, etc.) before trusting the payload. An unverified webhook endpoint lets anyone POST fake "payment succeeded" events. The signing secret is server-side only.

### H7. Server-side input that builds queries/requests is safe
- **SQL injection:** never string-concatenate user input into SQL. Use parameterized queries / the query builder. Supabase RPC functions written in plpgsql with dynamic SQL (`execute`) are a common hole — use `format(..., %L)` or quoting.
- **SSRF:** if a server endpoint fetches a user-supplied URL (image proxy, "import from URL", webhook tester), block internal ranges (`169.254.169.254`, `localhost`, `10./192.168./172.16.`) or it can read cloud metadata/credentials.

---

## 🟡 MEDIUM — hardening

### M1. Security headers
Add these on your host (Netlify `_headers` / `netlify.toml`, Vercel `vercel.json`, or Cloudflare):
```
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Content-Security-Policy: default-src 'self'; ... (scope to your domains)
  Permissions-Policy: geolocation=(), camera=(), microphone=()
```
- `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`) stops **clickjacking**.
- CSP is the strongest XSS mitigation but takes tuning — add it last. Avoid `unsafe-inline`/`unsafe-eval` in `script-src` if you can.

### M2. Input validation on writes
- Validate/sanitize on the **server/database**, not just the form. Use DB constraints (`check`, `not null`, length limits) and validate types/shape in Edge Functions (e.g. with `zod`). Don't trust client-sent enums, prices, or quantities.

### M3. No XSS sinks in the frontend
- Audit for `dangerouslySetInnerHTML`, `v-html`, `innerHTML =`, `document.write`, and `eval`. If user content must render as HTML, sanitize with DOMPurify first. Markdown renderers must disable raw HTML or sanitize.

### M4. Don't leak data in error messages or logs
- Don't return raw DB errors or stack traces to the client. Don't `console.log` tokens, emails, JWTs, or PII (they end up in host logs and browser consoles).

### M5. CORS is scoped
- Don't set `Access-Control-Allow-Origin: *` on anything that returns private data or accepts credentials. Echo only an allowlist of your own origins.

### M6. Auth tokens stored and handled safely
- Prefer Supabase's default storage. If you hand-roll, avoid putting long-lived tokens in `localStorage` where XSS can read them; httpOnly cookies are safer for session tokens. Ensure logout actually clears the session and revokes refresh tokens.

---

## 🟢 GOOD HYGIENE

- **Email confirmation ON** for any app that keeps signups open.
- **Strong password policy** (Supabase → Authentication → Policies); set a minimum length and leaked-password protection.
- **MFA** for admin accounts where supported.
- **Rotate keys** if anything sensitive ever leaked, and after offboarding collaborators.
- **Backups** enabled on the database (Supabase does daily; verify your tier) and test a restore once.
- Remove **source maps** from production builds if you don't want readable source (minor; never rely on obscurity).
- Keep dependencies updated and scan them: `npm audit --omit=dev`, and check for known-bad packages. Pin/lockfile committed.
- **Least privilege** on third-party tokens (Stripe restricted keys, scoped GitHub tokens, scoped Postgres roles).

---

## ✅ Live verification (do this yourself / with permission — these hit a live server)

For a Supabase app, replace `PROJECT` and `ANON_KEY` with yours (both are visible in your site's JS):

```bash
SB="https://PROJECT.supabase.co"
KEY="ANON_KEY"

# Can a logged-OUT stranger read a sensitive table?
curl -s -I -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
     -H "Prefer: count=exact" -H "Range: 0-0" \
     "$SB/rest/v1/YOUR_TABLE?select=id"
```
- `content-range: */0`  → ✅ **GOOD** — RLS is blocking anonymous reads.
- `content-range: 0-12/13` (a real count) → 🔴 **BAD** — your data is public. Fix C1/C2 now.

```bash
# Can a stranger WRITE? (attempts an insert; a 201 means open writes)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
     -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
     -H "Content-Type: application/json" -d '{}' \
     "$SB/rest/v1/YOUR_TABLE"
```
- `401`/`403` → ✅ writes blocked.  `201`/`200` → 🔴 anonymous writes are open.

```bash
# Are signups open? (junk email; if a token comes back, signups are ON)
curl -s -X POST -H "apikey: $KEY" -H "Content-Type: application/json" \
     -d '{"email":"check-noreply@example.com","password":"x-Decoy-123456"}' \
     "$SB/auth/v1/signup"
```
- `"signup_disabled"` / `"Signups not allowed"` → ✅ closed.
- Returns an `access_token` → ⚠️ signups are open *and* email confirmation is off. Apply C3. *(Delete the test user afterward in Authentication → Users.)*

```bash
# Are security headers present on the deployed site?
curl -s -I https://YOUR_SITE | grep -iE "strict-transport|x-frame|content-security|x-content-type"
```

---

## Quick triage summary

| Priority | Item | One-line check |
|----------|------|----------------|
| 🔴 | RLS enabled everywhere | Every table says "RLS enabled" |
| 🔴 | Policies scoped, not `using (true)` | Policies reference `auth.uid()`; inserts have `with check` |
| 🔴 | Signups disabled or allowlisted | Signup returns "not allowed" |
| 🔴 | No `service_role` / secrets in frontend | grep repo + history = 0 hits |
| 🟠 | Server enforces auth + roles | Identity from JWT, not request body |
| 🟠 | No IDOR | Fetch-by-id filters by owner |
| 🟠 | Storage buckets private | No public file listing |
| 🟠 | Webhooks verify signatures | `constructEvent` / HMAC check present |
| 🟡 | Security headers set | HSTS, X-Frame-Options, CSP |
| 🟡 | No XSS sinks | No raw `innerHTML` of user data |

> **Remember:** the login screen protects nothing. **RLS protects everything.** Get C1–C5 right and you've handled the vast majority of real-world risk for a vibe-coded app.

---

## CI hook (offline, no live server)

Drop this as a pre-push hook or a CI step. It's the highest-impact subset — secrets, wide-open policies, and secrets behind public env prefixes — and needs no database or network. Exit non-zero blocks the push.

Save as `scripts/security-grep.sh` (version-controlled) and have a thin `.git/hooks/pre-push` call it. **In a git repo, scan tracked files only** (`git grep`) — a plain `grep -r` also scans a gitignored `.env`, which false-positives and blocks every push.

```bash
#!/usr/bin/env bash
# scripts/security-grep.sh  (chmod +x). Thin pre-push hook: exec "$(git rev-parse --show-toplevel)/scripts/security-grep.sh"
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2
fail=0

scan() {  # tracked files in a git repo, else the working tree
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git grep -nIE "$1" -- . ':(exclude)scripts/security-grep.sh' ':(exclude)*.example'
  else
    grep -rnIE "$1" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next \
      --exclude="security-grep.sh" --exclude="*.example" .
  fi
}

echo "🔒 secret scan…"
if scan "sk-[a-z0-9]{20,}|sk_live_[0-9A-Za-z]{20,}|rk_live_[0-9A-Za-z]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[0-9A-Za-z-]{20,}|ghp_[A-Za-z0-9]{36}|service_role" ; then
  echo "❌ possible secret — if real, rotate it and remove from history"; fail=1
fi

echo "🔒 wide-open policy scan…"
if scan "using ?\(true\)|allow (read|write).*: ?if true" ; then
  echo "❌ a policy/rule grants access to everyone"; fail=1
fi

echo "🔒 secret-behind-public-prefix scan…"
if scan "(VITE_|NEXT_PUBLIC_|PUBLIC_|REACT_APP_|EXPO_PUBLIC_)[A-Z_]*(SECRET|SERVICE_ROLE|PRIVATE|SK_LIVE|PASSWORD)" ; then
  echo "❌ a secret is behind a browser-public env prefix"; fail=1
fi

[ "$fail" = 0 ] && echo "✅ offline security checks passed"
exit $fail
```

Tune the patterns per project (e.g. add Stripe restricted-key prefixes). Also wire it as a scheduled GitHub Action (`on: schedule` weekly + `pull_request`) — it's self-contained, so it runs in CI with no local dependency. Backstop only, not a substitute for a full `/security` audit before launch.

## Periodic re-audit

For drift over time (deps age, new tables ship without RLS), run the offline `security-grep.sh` on a **weekly GitHub Action cron** + on PRs — that's the dependable automated layer.

⚠️ **Don't rely on a cloud agent for the full `/security` audit.** A cloud routine checks out the repo but may not have this guide loaded, so `/security` can't load its source there. The deep AI audit is a **local, on-demand** action — run it before launches and after big changes. If you want a recurring *local* nudge, run it on a local loop while your machine is on, not a cloud schedule.

## Other stacks (when it's not Supabase)

- **Firebase:** the anon config is public too; **Firestore/Storage Security Rules** are your RLS. Default-deny, then scope by `request.auth.uid`. Check for `allow read, write: if true;`. Never ship the Admin SDK / service account JSON to the client.
- **Custom Node/Express/Next API routes:** there is no RLS — **every route must check the session and authorize the specific object** (C1–C2 become "auth middleware + ownership checks on every handler"). Watch for routes that trust `req.body.userId`.
- **Next.js specifically:** keep secrets out of `NEXT_PUBLIC_*`; don't leak server-only data through props/`use client` components; verify Server Actions authorize the caller (they're public endpoints).
- **All stacks:** C4 (no service/admin secret in client), C5 (no secrets in git), H1 (authorize the caller), H3 (no IDOR), H5 (rate limits), H6 (webhook signatures), and the entire 🟡/🟢 sections apply unchanged.

---

*Part of the [AI Build Skills](../README.md) collection · CC BY 4.0.*

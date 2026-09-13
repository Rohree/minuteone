# MinuteOne

Instant lead-callback qualification agent, built on [CALL-E](https://github.com/CALLE-AI/call-e-integrations)
for the "Your Code Is Calling" hackathon. When a prospect submits a lead form, MinuteOne calls
them back, runs a config-driven qualification conversation, and returns a scored LeadCard —
turning "someone filled out a form" into "someone we already know is worth a callback" within
about a minute, without a human ever having to place the first call.

MinuteOne is self-serve, Calendly-style: sign up, describe your business and the questions you
want asked, and you get your own embeddable lead-capture form
(`<iframe src=".../f/your-slug">`) plus a dashboard that shows only your own leads. No account is
required to try the core flow, though — the hosted demo on the home page and `/review` work
exactly as a single-tenant demo always did, backed by a seeded "default" business.

**Host / provider:** [CALL-E](https://github.com/CALLE-AI/call-e-integrations) is the only
external calling provider this app talks to (via its MCP server — see
[How it works](#how-it-works)). Everything else (database, hosting) is swappable infrastructure,
not a "supported host" in the Agent Skills sense.

## Setup

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. No external services, accounts, or credentials are required —
`predev` creates a local SQLite file (`local.db`) automatically, and the app runs in **dry-run
mode by default** (no real phone calls are placed; see [Dry-run vs real
calls](#dry-run-vs-real-calls)).

## Usage

**No account, quickest path (single shared demo tenant):**

1. Submit a lead on the home page (name, E.164 phone, optional email/notes, and the required
   consent checkbox).
2. Watch it move through `pending → in_progress → done` on
   [`/review`](http://localhost:3000/review) as the in-process worker dispatches it (polls every
   5s). Click a row for the full LeadCard: outcome, score, per-question answers, call metadata.

**With an account (your own business, your own embeddable form):**

1. [Sign up](http://localhost:3000/signup) with an email, password, and business name — this
   creates your own `businesses` row (seeded from the same example config below) and signs you
   in.
2. On [`/dashboard/settings`](http://localhost:3000/dashboard/settings), edit your opening line,
   3–5 qualification questions, scoring weights, and business-hours window — validated by
   `lib/config/schema.ts`'s `businessConfigSchema`, same schema as the file-based config below.
3. On [`/dashboard/embed`](http://localhost:3000/dashboard/embed), copy your shareable link or
   `<iframe>` snippet and drop it on your own site.
4. Leads submitted through your form show up only on
   [`/dashboard/leads`](http://localhost:3000/dashboard/leads) — scoped to your account, not the
   global `/review` list.

To change the seeded example config every new account starts from, edit
`lib/config/business.example.json` (validated by `lib/config/schema.ts`) — no code changes needed
for a new default opening line, questions, scoring weights, or business-hours window.

## How it works

```
Lead form / embeddable form → leads table (SQLite/Turso) → worker (poller / Netlify scheduled fn)
  → dispatchLead(): consent + business-hours check → resolve the lead's own tenant config
  → CallProvider.placeCall() → outcome + rubric score mapped to a LeadCard
  → written back → shown in /review (global) or /dashboard/leads (scoped)
```

- **Config-driven, per tenant**: each business's identity/opening line, qualification questions,
  scoring rubric, and business-hours window live as one JSON blob on its own `businesses` row
  (`lib/db/schema.ts`), validated by `lib/config/schema.ts`'s `businessConfigSchema` on every
  read/write. `lib/config/load.ts` resolves a config by business id or slug — no hardcoded call
  scripts, and no global config shared across tenants. A seeded "default" business
  (`lib/db/seed.ts`) keeps the original single-tenant demo (`/`, `/review`) working unchanged.
- **Accounts**: hand-rolled — `users`/`sessions` tables, `crypto.scrypt` password hashing,
  httpOnly session cookie (`lib/auth/`). No third-party auth service and no new native dependency
  (relevant given the native-binary bundling history documented below).
- **Embeddable form**: `/f/[slug]` resolves a business by its public slug and renders the same
  generic intake form as the home page, posting to the same `/api/leads` endpoint with the
  business slug included — one intake contract for every tenant and the legacy demo alike.
- **`CallProvider`** (`lib/call/provider.ts`): the interface CALL-E is plugged in behind.
  `lib/call/fake.ts` is the dry-run implementation (simulated delay, weighted-random outcomes,
  synthetic answers) and is the default everywhere. `lib/call/calle.ts` is the real provider —
  CALL-E has no REST/SDK surface, only an OAuth-protected MCP server (`calle mcp config` shows
  `https://seleven-mcp-sg.airudder.com/mcp/openagent_oauth`), so it's an
  `@modelcontextprotocol/sdk` client driving `plan_call` → `run_call` → poll `get_call_run`.
  There's no structured-result-schema parameter on the real API, so `task-builder.ts` spells out
  the exact field keys to use in the goal text itself, and the real provider reads back whatever
  lands in `extracted` defensively (no schema enforcement upstream).
- **`dispatchLead`** (`lib/worker/dispatch.ts`): the single shared dispatch core, called by both
  the local poller and the Netlify scheduled function. Atomically claims a lead (an
  `UPDATE ... WHERE status='pending'` in one statement, not a separate read-then-write) so two
  overlapping worker ticks can never both dispatch the same lead, enforces consent, gates on
  business hours, applies the retry policy (max 1 retry on no_answer/voicemail, never on
  declined), scores answers against the config's rubric, and maps the result onto the fixed
  LeadCard outcome enum (`qualified | not_qualified | callback_requested | no_answer |
  wrong_number | declined`).
- **Worker wiring**: locally, `instrumentation.ts` starts an in-process `setInterval` poller
  (`lib/worker/poller.ts`) once per dev server instance. The Netlify deploy uses a 1-minute
  scheduled function instead (`netlify/functions/sweep-scheduled.ts`), since Netlify functions
  have no long-running process to host a poller and an ephemeral filesystem SQLite can't survive
  on — both call the same `lib/worker/sweep.ts`.

## Side effects

- **Placing a real phone call** — only when `DRY_RUN=false` and `CALLE_API_KEY` are both set (see
  below). Every other operation (submitting a lead, viewing `/review`, editing the config) is
  local/in-memory/database-only and has no external effect.
- **A recurring background job**, disclosed, not hidden: locally, a `setInterval` poller runs
  every 5 seconds for as long as the dev server process is alive. On the deployed instance, a
  Netlify Scheduled Function (`netlify/functions/sweep-scheduled.ts`) runs every 1 minute for as
  long as the site exists. Both only ever act on leads already sitting in the database with
  `status = "pending"` — they never originate a lead or a call on their own initiative.
- **Writes to a database** — `local.db` (a plain file in this directory) by default, or a hosted
  Turso database when `TURSO_DATABASE_URL` is set (deployed instance only). Signing up creates a
  `users` row, a `sessions` row, and a `businesses` row — no other side effect; no email is sent,
  no external service is called.

## Dry-run vs real calls

Dry-run (`FakeCallProvider`) is the default everywhere. Real calls require an explicit opt-in:

```bash
DRY_RUN=false CALLE_API_KEY=... npm run dev
```

Only 20 real CALL-E calls are available for this whole project, so real calls are reserved for
verification and demo-video recording — not day-to-day iteration. CALL-E only places calls to a
specific set of supported countries (confirmed: US, UK, Canada, Australia, Singapore, Ireland —
see [CALL-E's supported regions
doc](https://github.com/CALLE-AI/call-e-integrations#supported-regions-and-languages) for the
full list); it rejects unsupported numbers at the free planning step, before anything is dialed
or spent. It also rejects reserved test numbers (555-xxxx) the same way, so real verification
needs an actual phone number in a supported region, not the masked examples used elsewhere in
this repo.

## Credential handling

- **No credentials at all are needed to run this app locally in its default mode.** Accounts use
  hand-rolled sessions (`lib/auth/`), not a third-party auth provider — no new API key to obtain,
  no new credential to configure, in local dev or deployed.
- **`CALLE_API_KEY`** (only needed for real calls): CALL-E has no separate "API key" page — it's
  a bearer token from its OAuth-protected MCP server. Get one by installing the CLI
  (`npm install -g @call-e/cli`), running `calle auth login` (opens a browser to authorize), and
  reading the `token.access_token` field from the cached token file the CLI prints the path to
  (e.g. `~/.calle-mcp/cli/<hash>/token.json`). The token is long-lived (about 1000 days), so this
  is a one-time setup step. Never commit it — `.env*` is gitignored (except `.env.example`,
  which contains no real values).
- **`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`** (deployed instance only, never needed locally):
  see [Netlify deployment](#netlify-deployment).
- Nothing in this repo reads credentials from anywhere other than environment variables, and
  nothing logs or displays a credential value anywhere in the app or its output.

## Cancellation & rollback

- **Cancel a specific lead before it's called:** every "pending" lead has a **Cancel** button on
  `/review` and on its own detail page. This sets it to `failed` with a
  "Cancelled by operator" summary and it will never be dispatched — implemented as the same
  atomic conditional `UPDATE` pattern as dispatch's own claim, so a cancel can't race a worker
  tick that's claiming the same lead at that instant. Once a lead reaches `in_progress` (a real
  call is actually in flight), there is nothing to cancel: CALL-E's own `run_call` contract has
  no abort/interrupt operation, and its guidance is explicit — "Do not call `run_call` more than
  once... once started, wait for activity" — so MinuteOne doesn't attempt one either.
- **Stop the recurring background job:** locally, stop the dev server process (`Ctrl+C`) — the
  poller is in-process and stops with it, nothing else to unsubscribe from. On the deployed
  instance, either delete the Netlify site, or remove/rename
  `netlify/functions/sweep-scheduled.ts` and redeploy — Netlify has no separate CLI toggle for a
  single scheduled function. Setting `DRY_RUN` back to unset/`true` stops it from placing *real*
  calls immediately, but does not stop the sweep itself from running (it'll keep dispatching
  through the fake provider).
- **Rollback a bad business-config change:** `lib/config/business.example.json` is a plain file
  under version control — `git checkout` or `git revert` it like any other file. There's no
  server-side state tied to a specific config version.

## Consent & safety

- **Explicit user intent, enforced twice:** the lead form's consent checkbox must be checked to
  submit at all (the intake schema requires `consent: true` literally — a request without it is
  rejected with a 400 before a row is ever created), and `dispatchLead` independently refuses to
  place a call for any lead without consent recorded, in case a row ever reached the database
  some other way.
- **E.164 phone numbers only** — validated by both the client-side input pattern and the
  server-side Zod schema (`leadIntakeSchema`).
- **Masked/example numbers everywhere in this repo** — `.env.example`, the lead-form placeholder,
  and every test/demo number use the reserved `+1555…` range. The only real number ever used
  during this build was the developer's own, for direct real-call verification, and it never
  appears in the repo.
- **No hidden recurring schedules** — see [Side effects](#side-effects); both the poller and the
  scheduled function are documented here, not discovered by reading source.
- **No duplicate jobs** — `dispatchLead`'s atomic claim (see [How it works](#how-it-works)) means
  a lead can only ever be picked up by one worker tick, not dispatched twice by two overlapping
  ones.
- **Tenant isolation, enforced at the query, not just the page** — `/dashboard/leads` and its
  detail page filter by the caller's own `businessId` in the `WHERE` clause itself; requesting
  another tenant's lead by id 404s rather than leaking whether it exists. The business-settings
  update endpoint (`/api/dashboard/business`) scopes its `UPDATE` by `ownerUserId`, not just an
  auth check earlier in the request.
- **Clear cancellation behavior** — see [Cancellation & rollback](#cancellation--rollback).
- **No credential exposure** — see [Credential handling](#credential-handling).
- **Content boundaries:** the demo business config (`business.example.json`) is a fictional home
  services company asking about repair/installation/inspection requests. Nothing in this app
  generates medical, legal, financial, or emergency-services content — a real deployment's
  business config is the operator's own responsibility, same as the script a human sales rep
  would follow.

## Netlify deployment

The submission itself only needs `npm i && npm run dev` (SQLite + in-process poller, above). This
section is for the optional live demo instance, which needs a real database since Netlify
functions have an ephemeral filesystem — a local SQLite file wouldn't survive between invocations.

**Live instance:** <https://minuteone-calle.netlify.app> (dry-run). Continuously deployed from
<https://github.com/Rohree/minuteone> (`master` branch) — a `git push` there triggers a new
production build automatically, same as `netlify deploy --build --prod`.

**Two non-obvious things this needed, in case the deploy ever breaks again:**

- `package.json`'s `build` script is pinned to `next build --webpack`, not the Turbopack default.
  Turbopack's production output externalizes `@libsql/client` under a bundler-generated hashed
  module name that Netlify's function packaging can't resolve at runtime (`Cannot find module
  '@libsql/client-<hash>'`) — webpack's build doesn't have this problem.
- `lib/db/client.ts` picks between `@libsql/client` + `drizzle-orm/libsql` (native, needs a
  platform-specific binary) and `@libsql/client/web` + `drizzle-orm/libsql/web` (pure HTTP, no
  native binary) based on whether `TURSO_DATABASE_URL` is set. This isn't just about which client
  object gets used — `drizzle-orm/libsql`'s own driver module imports the *native* `@libsql/client`
  at its own top level purely to type an internal fallback, so merely importing it (regardless of
  whether that fallback path ever runs) crashes with `Cannot find module '@libsql/linux-x64-gnu'`
  on Netlify's Linux function, whose file tracing doesn't reliably bundle that platform binary.
  Both imports use `require()`, not `import`/`await import`, because the standalone Netlify
  Function bundle (`netlify/functions/sweep-scheduled.ts`, esbuild, CJS output) doesn't support
  top-level await. Also: `process.env.NETLIFY` is **not** reliable inside the deployed Next.js
  Runtime function (only during the build step) — use `TURSO_DATABASE_URL`'s presence instead to
  tell local mode from deployed mode, as `instrumentation.ts` does.

1. **Provision a Turso database** (same SQLite dialect as local dev — one Drizzle schema serves
   both). Via the [Turso dashboard](https://turso.tech) or CLI, create a database and grab its
   `libsql://...` URL and an auth token.
2. **Push the schema to it once, then seed the default tenant:**

   ```bash
   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:push
   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:seed
   ```

   `db:seed` (`lib/db/seed.ts`) is idempotent — it creates the "default" business `/` and
   `/review` fall back to, and backfills `businessId` onto any pre-existing lead row. Safe to
   re-run any time, including against a database that already has real submitted leads.

3. **Link a Netlify site** (`netlify login`, then `netlify init` or `netlify link` from this
   directory) and set its env vars — either in the Netlify UI or:

   ```bash
   netlify env:set TURSO_DATABASE_URL "libsql://..."
   netlify env:set TURSO_AUTH_TOKEN "..."
   ```

4. **Deploy:** `netlify deploy --build --prod`, or push to a connected git remote for
   auto-deploy. `netlify.toml` wires up `@netlify/plugin-nextjs` and points
   `netlify/functions/sweep-scheduled.ts` (a 1-minute cron, the deployed-mode equivalent of the
   local poller — see `lib/worker/sweep.ts`, shared by both) at `netlify/functions`.
5. **Verify:** submit a lead on the live URL and confirm it moves off `pending` within about a
   minute on `/review`. To place real calls there too, also set `DRY_RUN=false` +
   `CALLE_API_KEY` (see [Dry-run vs real calls](#dry-run-vs-real-calls)).

## How this differs from similar apps in this repo

None of the existing `apps/typescript/` entries implement this specific pattern — an inbound web
lead calling the *business* back within about a minute, with config-driven qualification
questions scored into a routing decision, self-serve for any business that signs up (not a
single hardcoded script). The closest neighbors, and how MinuteOne differs:

- **`ai-front-desk`** is a receptionist that keeps an appointment-business's calendar full across
  three flows; MinuteOne is a single-purpose speed-to-lead qualifier with a scored outcome, not a
  calendar system.
- **`clinic-appointment-concierge`** calls in the opposite direction — on behalf of a patient,
  outbound to a clinic — rather than a business calling back its own inbound lead.
- **`evidence-grounded-callback`**, **`recallready`**, **`readyline`**, **`dispatch-pulse`**, and
  **`verify-contact-claim`** each solve a narrow, differently-shaped problem (evidence-grounding
  guardrails, product recalls, event vendor coordination, delivery verification, and scam-number
  verification, respectively) — none are lead-qualification workflows.

## Build status

**Done and verified:**

- Full local dry-run pipeline (lead form → intake → poller → dispatch → fake provider → scoring →
  review console, including cancellation), typecheck, lint, and `next build` all pass.
- Real `calle.ts` `CallProvider` verified against a real CALL-E call end-to-end: `plan_call` →
  `run_call` → polling → a completed ~2.5-minute qualification conversation. That real call
  surfaced two bugs, both fixed and re-verified: the poll ceiling was too short for a real
  conversation (`MAX_POLL_MS` 3min → 6min), and CALL-E's real API never returns structured
  answers (only prose in `summary`/`transcript`) — `lib/call/extract.ts` (LLM pass, only used if
  `ANTHROPIC_API_KEY` is set) and `lib/call/extract-heuristic.ts` (free local regex/keyword
  fallback, always available) now recover the qualification answers either way.
- Netlify deployment, live at <https://minuteone-calle.netlify.app>, continuously deployed from
  GitHub — verified end-to-end: a lead submitted via the live API lands in Turso and the
  scheduled function correctly picks it up and applies the business-hours gate.
- `scripts/validate_repository.py` run against a full clone of `awesome-phone-call-agents` with
  this app in place — passes.
- **Multi-tenant SaaS layer** (accounts, per-business config, embeddable forms, scoped dashboard —
  see [Usage](#usage) and [How it works](#how-it-works)): verified end-to-end with two real
  signed-up tenants running deliberately different questions — dispatch resolved each lead
  against its own tenant's config with no cross-tenant bleed, `/dashboard/leads` correctly scoped
  per account, and an IDOR check (requesting another tenant's lead by id) 404ed as expected. The
  original single-tenant demo (`/`, `/review`) is unchanged and unauthenticated, backed by a
  seeded default tenant.

**Left before submission:**

- 3-minute demo video + PR to `CALLE-AI/awesome-phone-call-agents` + Devpost submission.

Deadline: **2026-09-14**.

## Project layout

```text
app/
  page.tsx, lead-form.tsx      hosted demo lead form (default tenant)
  f/[slug]/                    embeddable public lead form, one per business
  login/, signup/              auth pages
  dashboard/                   authenticated: settings, leads (scoped), embed snippet
  api/leads/route.ts           lead intake webhook (Zod-validated, resolves business by slug)
  api/leads/[id]/cancel/       cancel-before-dispatch endpoint
  api/auth/                    signup / login / logout route handlers
  api/dashboard/business/      business-config update endpoint (ownership-scoped)
  review/                      global review console (list + LeadCard detail, cancel action)
components/
  leads/                       shared lead-table/stats/detail — used by /review and /dashboard/leads
lib/
  auth/                        password hashing (crypto.scrypt), sessions, current-user helpers
  config/                      business config schema, example config, DB-backed loader, slugs
  db/                          Drizzle schema + client (SQLite locally, Turso when deployed), seed
  lead/                        lead intake / LeadCard Zod schemas, rubric scoring
  call/                        CallProvider interface, fake.ts, calle.ts, task-builder.ts,
                                extract.ts (LLM) / extract-heuristic.ts (free fallback)
  worker/                      dispatchLead core (atomic claim, per-tenant config), poller
instrumentation.ts              starts the local poller once per server instance
```

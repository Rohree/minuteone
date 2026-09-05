# MinuteOne

Instant lead-callback qualification agent, built on [CALL-E](https://github.com/CALLE-AI/call-e-integrations)
for the "Your Code Is Calling" hackathon. When a prospect submits a lead form, MinuteOne calls
them back, runs a config-driven qualification conversation, and returns a scored LeadCard.

> **Status: work in progress.** This README doubles as a resume-here note — see
> [Build status](#build-status) below for exactly what's done and what's left. It will be
> rewritten into the final submission README (setup/side-effects/dry-run/credentials/
> cancellation/consent, per the `awesome-phone-call-agents` contribution rules) once the real
> CALL-E call path and the Netlify deploy are in.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. No external services or credentials are required — `predev`
creates a local SQLite file (`local.db`) automatically, and the app runs in **dry-run mode by
default** (no real phone calls are placed; see [Dry-run vs real calls](#dry-run-vs-real-calls)).

Submit a lead on the home page, then watch it move through `pending → in_progress → done` on
[`/review`](http://localhost:3000/review) as the in-process worker dispatches it (polls every 5s).

## How it works

```
Lead form / webhook → leads table (SQLite/Turso) → worker (poller / Netlify scheduled fn)
  → dispatchLead(): consent + business-hours check → CallProvider.placeCall()
  → outcome + rubric score mapped to a LeadCard → written back → shown in /review
```

- **Config-driven**: `lib/config/business.example.json` (validated by `lib/config/schema.ts`)
  defines the business identity/opening line, 3–5 qualification questions with scoring weights,
  and the business-hours window. No hardcoded scripts.
- **`CallProvider`** (`lib/call/provider.ts`): the interface CALL-E is plugged in behind.
  `lib/call/fake.ts` is the dry-run implementation (simulated delay, weighted-random outcomes,
  synthetic answers). `lib/call/calle.ts` is the real provider — CALL-E turned out to have no
  REST/SDK surface at all, only an OAuth-protected MCP server (`calle mcp config` shows
  `https://seleven-mcp-sg.airudder.com/mcp/openagent_oauth`), so it's an
  `@modelcontextprotocol/sdk` client driving `plan_call` → `run_call` → poll `get_call_run`.
  There's no structured-result-schema parameter on the real API, so `task-builder.ts` spells out
  the exact field keys to use in the goal text itself, and the real provider reads back whatever
  lands in `extracted` defensively (no schema enforcement upstream).
- **`dispatchLead`** (`lib/worker/dispatch.ts`): the single shared dispatch core. Enforces
  consent, gates on business hours, applies the retry policy (max 1 retry on no_answer/
  voicemail, never on declined), scores answers against the config's rubric, and maps the result
  onto the fixed LeadCard outcome enum (`qualified | not_qualified | callback_requested |
  no_answer | wrong_number | declined`).
- **Worker wiring**: locally, `instrumentation.ts` starts an in-process `setInterval` poller
  (`lib/worker/poller.ts`) once per dev server instance. The Netlify deploy will use a scheduled
  function instead (not built yet), since Netlify functions have no long-running process to host
  a poller and an ephemeral filesystem SQLite can't survive on.

## Dry-run vs real calls

Dry-run (`FakeCallProvider`) is the default everywhere. Real calls require an explicit opt-in:

```bash
DRY_RUN=false CALLE_API_KEY=... npm run dev
```

`CALLE_API_KEY` is a bearer token, not a classic API key — see `.env.example` for how to get one
via `calle auth login`. Only 20 real CALL-E calls are available for this whole project, so real
calls are reserved for final verification and demo-video recording — not day-to-day iteration.
**Note:** CALL-E rejects reserved test numbers (555-xxxx) at the planning stage ("calls to this
region are not supported"), so real verification needs an actual phone number, not the masked
examples used elsewhere in this repo.

## Netlify deployment

The submission itself only needs `npm i && npm run dev` (SQLite + in-process poller, above). This
section is for the optional live demo instance, which needs a real database since Netlify
functions have an ephemeral filesystem — a local SQLite file wouldn't survive between invocations.

**Live instance:** <https://minuteone-calle.netlify.app> (dry-run; two test leads from setup
verification are visible on `/review` — harmless, safe to ignore or clear via the Turso dashboard).

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
2. **Push the schema to it once:**

   ```bash
   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:push
   ```

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

## Build status

Tracking the plan at `C:\Users\beast\.claude\plans\mutable-imagining-candle.md`.

**Done, and verified end-to-end** (typecheck, lint, `next build`, and ~20 leads run through the
real HTTP API and watched through the full dispatch pipeline):

- [x] Next.js/TS/Tailwind/shadcn scaffold
- [x] Drizzle + libSQL schema, auto-provisioned locally via `predev`
- [x] Zod schemas: business config, lead intake, LeadCard
- [x] `CallProvider` interface + `fake.ts` dry-run provider
- [x] `dispatchLead` core: consent check, business-hours gate, rubric scoring, retry policy
- [x] Local poller via `instrumentation.ts`
- [x] Hosted lead form (`/`) + review console (`/review`, `/review/[id]`), auto-refreshing
- [x] Real `calle.ts` `CallProvider` — MCP client (`@modelcontextprotocol/sdk`) driving
      `plan_call` → `run_call` → poll `get_call_run`; wiring verified live against the CALL-E MCP
      server via `plan_call` (free, doesn't place a call). `run_call` itself not yet exercised —
      needs a real phone number, reserved for later verification (only 20 real calls available).
- [x] Netlify deployment, live at <https://minuteone-calle.netlify.app>: Turso DB provisioned
      and schema pushed, Netlify site linked, `netlify.toml` + `netlify/functions/
      sweep-scheduled.ts` (1-min cron via `lib/worker/sweep.ts`, shared with the local poller)
      deployed. Verified end-to-end live: lead submitted via the live API, landed in Turso, and
      the scheduled function picked it up and correctly applied the business-hours gate. See
      [Netlify deployment](#netlify-deployment) for the two non-obvious bugs this took to fix
      (Turbopack vs. webpack build; `drizzle-orm/libsql`'s native-binary import on Netlify's
      Linux function).

**Not started yet:**

- [ ] Final submission README (setup/side-effects/dry-run/credentials/cancellation/consent)
- [ ] Differentiation pass against existing similar apps in `apps/typescript/` (
      `clinic-appointment-concierge`, `evidence-grounded-callback`, `recallready`, `readyline`,
      `dispatch-pulse`, `verify-contact-claim`)
- [ ] `scripts/validate_repository.py` run against a clone before opening the PR
- [ ] 3-minute demo video + PR to `CALLE-AI/awesome-phone-call-agents` + Devpost submission

Deadline: **2026-09-14**.

## Project layout

```
app/
  page.tsx, lead-form.tsx      hosted lead form
  api/leads/route.ts           lead intake webhook (Zod-validated)
  review/                      review console (list + LeadCard detail)
lib/
  config/                      business config schema, example config, loader
  db/                          Drizzle schema + client (SQLite locally, Turso when deployed)
  lead/                        lead intake / LeadCard Zod schemas, rubric scoring
  call/                        CallProvider interface, fake.ts, calle.ts, task-builder.ts
  worker/                      dispatchLead core, business-hours check, local poller
instrumentation.ts              starts the local poller once per server instance
```

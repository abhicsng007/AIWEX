# Production deployment baseline

AIWEX can be deployed as a Next.js application to Vercel, or built as the included standalone Docker image. The platform and a learner's scenario environment must remain separate.

## Required deployment configuration

1. Create a Supabase project and run both migrations in `supabase/migrations/` in order, including `202607180002_private_simulation_runs.sql`.
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only to server-side environment variables.
3. Configure `APP_URL` with the deployed application URL and `SCENARIO_STAGING_URL` with a disposable learner-target URL.
4. Configure error monitoring before admitting learners. Do not include monitoring secrets in client-side variables.
5. Point the platform health probe at `GET /api/health`.
6. Set `SIMULATION_CRON_SECRET` and invoke `POST /api/internal/simulation/tick` with `Authorization: Bearer <secret>` every minute. This releases scheduled agent work and deadline consequences even when no learner has the app open.

## Vercel demo mode (`/demo`, `/demo?complete=1`)

Demo routes are **off in production** unless you opt in. Local `next dev` enables them by default.

In the Vercel project → **Settings → Environment Variables** (Production and Preview):

| Variable | Value | Why |
| --- | --- | --- |
| `DEMO_MODE` | `true` | Without this, `/demo` returns to the landing page (previously looked like “login required”) |
| `SUPABASE_URL` | your project URL | Multi-instance Vercel needs durable storage for demo ledgers |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key | Server-only; never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional | Only for real sign-in, not for demos |

Then **Redeploy** so the runtime picks up the vars.

Notes:

- `/demo?complete=1` builds the showcase **in-process** (one function invocation). Prefer a plan that allows **≥60s** function duration (`maxDuration` is set to 120 on the demo route).
- Without Supabase, demo events live only in memory on one instance and often disappear on the next request on Vercel.
- With `DEMO_MODE=true` + Supabase service role configured, demo cookies and complete showcases work across instances.

## Container deployment

```bash
docker build -t AIWEX .
docker run --rm -p 3000:3000 --env-file .env.local AIWEX
```

The image uses Next.js standalone output and runs as a non-root user.

## Multi-user safety before launch

- Supabase Auth is enforced at simulation route boundaries and each learner is assigned a private run ledger. Before introducing shared human teams, add explicit organization-membership records and RLS policies for that membership model.
- The current runtime now derives a private `run-<user-id>` ledger from the authenticated Supabase user. Keep the scheduler secret server-side and never call the internal tick route from browser code.
- Keep the service-role key server-only.
- Use the persistent event table as the audit ledger; do not rely on the in-process fallback in a multi-instance deployment.
- Apply per-user and per-organization rate limits at the deployment edge.
- Use separate Supabase projects or schemas for platform production and scenario data.

## Controlled scalability scenarios

The API exposes the first measurable scenario at `GET /api/simulation/performance?organizationId=<id>`. Results may be recorded only for `scenario-staging` through `POST` to the same endpoint. The scenario enforces a maximum 200 virtual users, a 10–300 second duration, synthetic data, and written validation notes.

Never load-test the AIWEX platform's production URL. Give each learner/team a disposable scenario target with an independent database and strict spending, time, and concurrency limits.

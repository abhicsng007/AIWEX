# Production deployment baseline

Shiftline can be deployed as a Next.js application to Vercel, or built as the included standalone Docker image. The platform and a learner's scenario environment must remain separate.

## Required deployment configuration

1. Create a Supabase project and run both migrations in `supabase/migrations/` in order, including `202607180002_private_simulation_runs.sql`.
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only to server-side environment variables.
3. Configure `APP_URL` with the deployed application URL and `SCENARIO_STAGING_URL` with a disposable learner-target URL.
4. Configure error monitoring before admitting learners. Do not include monitoring secrets in client-side variables.
5. Point the platform health probe at `GET /api/health`.
6. Set `SIMULATION_CRON_SECRET` and invoke `POST /api/internal/simulation/tick` with `Authorization: Bearer <secret>` every minute. This releases scheduled agent work and deadline consequences even when no learner has the app open.

## Container deployment

```bash
docker build -t shiftline .
docker run --rm -p 3000:3000 --env-file .env.local shiftline
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

Never load-test the Shiftline platform's production URL. Give each learner/team a disposable scenario target with an independent database and strict spending, time, and concurrency limits.

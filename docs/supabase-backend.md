# Supabase backend setup

The simulator runs locally without cloud credentials. To enable durable events and Team Space artifact uploads, create a Supabase project and run `supabase/migrations/202607170001_simulator_backend.sql` in its SQL editor (or through the Supabase CLI).

Add these server-only values to `.env.local`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The service-role key is used only by Next.js route handlers. Do not expose it in browser code or put it in a `NEXT_PUBLIC_` variable. The migration enables RLS and intentionally adds no anonymous policies; the current alpha routes are the sole data access path. Add authenticated organization-membership policies before exposing this app to untrusted users.

The managed backend stores:

- `simulation_events`: append-only organization history used by workflow, coaching, live feeds, and the scenario director.
- `workspace_artifacts`: metadata for Team Space artifacts.
- `workspace-artifacts` storage bucket: private object storage; the API returns 15-minute signed URLs.

Without Supabase configuration, simulation events continue using the local in-memory fallback. Artifact uploads intentionally return `503` rather than pretending that a file was stored.

# SignalDesk architecture notes

The scenario is a small Next.js B2B SaaS product. The dashboard calls `GET /api/usage/summary` with a workspace slug. The API uses an in-memory stand-in for a legacy events store so the scenario can run without customer data or external credentials.

- `app/api/usage/summary/route.ts` owns request validation and HTTP caching headers.
- `lib/usage.ts` owns legacy aggregation and nullable `threshold` handling.
- `app/components/alerts-panel.tsx` owns the empty state for non-billing users.

The project is deliberately seeded with two linked pieces of debt: a missing billing-role guard in the UI and an unbounded usage-event scan in the API path. Learners should make small, tested changes and explain trade-offs rather than replace the system wholesale.

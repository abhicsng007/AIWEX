# SignalDesk learner project

This is the curated B2B SaaS project for the first AI Work Simulator scenario. It is intentionally small enough to understand, but includes realistic legacy behavior, incomplete assumptions, API contracts, and measurable performance work.

## Learner mission

`GET /api/usage/summary` currently scans a legacy event collection for every request. `legacy-acme` has no threshold field. Improve the route without breaking that legacy contract, document the trade-off, and validate the release through review and a controlled load test.

## Run locally

```bash
npm install
npm run dev
```

Use `http://localhost:3000/api/health` for the health check and `http://localhost:3000/api/usage/summary?workspaceId=legacy-acme` for the scenario API.

## Verify the learner change

The required role-safe empty-state behavior is checked with an executable scenario test:

```bash
npm run test:usage-alerts
```

The simulator submits the learner's editor source to the same test in an isolated temporary directory. A passing result records the source hash, command, duration, and immutable verification event before the learner can continue through the delivery workflow.

## Deploy a disposable staging target

Build the included Docker image, deploy it to a learner-specific or cohort-specific non-production service, and set that URL as `SCENARIO_BASE_URL` only when running the load test.

```bash
docker build -t signaldesk-scenario .
docker run --rm -p 3000:3000 signaldesk-scenario
SCENARIO_BASE_URL=http://localhost:3000 k6 run load-tests/usage-summary.js
```

Never use the simulator platform URL as `SCENARIO_BASE_URL`. This scenario has synthetic data only and should be recreated between learner attempts.

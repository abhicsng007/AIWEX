export const signalDeskScenarioProject = {
  id: 'signaldesk-web',
  name: 'SignalDesk web',
  repositoryPath: 'scenarios/signaldesk-web',
  defaultBranch: 'main',
  learnerBranch: 'feat/usage-alerts-empty-state',
  stagingContract: 'GET /api/usage/summary?workspaceId=legacy-acme',
  healthCheck: 'GET /api/health',
  loadTest: 'k6 run load-tests/usage-summary.js',
  sourceFiles: [
    'app/components/alerts-panel.tsx',
    'app/components/empty-state.tsx',
    'app/api/usage/summary/route.ts',
    'lib/usage.ts',
    'docs/architecture.md',
    'docs/known-issues.md',
  ],
} as const

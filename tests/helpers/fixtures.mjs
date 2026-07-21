import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export const validAlertsPanelSource = readFileSync(
  resolve(root, 'scenarios/signaldesk-web/tests/fixtures/valid-alerts-panel.tsx'),
  'utf8',
)

export const brokenAlertsPanelSource = `export function AlertsPanel({ alerts }: { alerts: { id: string }[] }) {
  return <div>{alerts.length ? 'has alerts' : 'empty'}</div>
}
`

export const policyIds = ['security-baseline', 'data-protection', 'engineering-operating-model']
export const accessIds = ['workspace', 'scenario-repo', 'team-space', 'staging', 'docs']

/** Correct training quiz answers keyed by slide id. */
export const trainingAnswers = {
  'company-mandate': 1,
  'security-privacy': 1,
  'next-contracts': 1,
  'product-legacy-context': 0,
  'delivery-readiness': 1,
}

/** Correct readiness MCQ answers. */
export const readinessAnswers = {
  'permission-boundary': 1,
  'legacy-customer-state': 0,
  'security-data-handling': 0,
  'validation-evidence': 1,
  'communication-delivery': 0,
}

/** Intentionally wrong readiness answers (score 0). */
export const wrongReadinessAnswers = {
  'permission-boundary': 0,
  'legacy-customer-state': 1,
  'security-data-handling': 1,
  'validation-evidence': 0,
  'communication-delivery': 1,
}

export const tasksByLevel = {
  basic: ['PROJ-184'],
  intermediate: ['PROJ-191', 'PROJ-189'],
  advanced: ['PROJ-203', 'PROJ-204', 'PROJ-205'],
}

export const mergeRationale = (taskId) =>
  `Safe to merge ${taskId}: role guard is enforced with canManageBilling, legacy empty-state behavior is preserved, scenario checks passed, and review feedback was addressed with validation evidence.`

export const reviewResponse = (taskId) =>
  `Thanks @noah — for ${taskId} I used the canManageBilling guard for the billing CTA, kept the explanatory empty state when the action is unavailable, and re-ran the scenario contract checks covering allowed roles, restricted roles, and the legacy threshold-less workspace.`

export const standupText = (taskId) =>
  `Yesterday: prepared ${taskId}. Today: implement, validate, and open PR. Blocker: none; I will escalate if legacy threshold behavior is unclear.`

export const teammateQuestion = (taskId) =>
  `@noah For ${taskId}, I plan to protect the billing CTA with canManageBilling and keep the explanatory empty state for legacy workspaces without a threshold. Does that match the acceptance criteria for restricted roles?`

export const loadTestPassing = {
  scenarioId: 'usage-dashboard-latency',
  environment: 'scenario-staging',
  concurrency: 100,
  durationSeconds: 60,
  p95Ms: 320,
  errorRatePercent: 0.4,
  requestsPerSecond: 88,
  notes: 'After index and cache fixes on usage summary, p95 dropped below 450ms with stable error rate under 100 concurrent users.',
}

export const loadTestFailing = {
  scenarioId: 'usage-dashboard-latency',
  environment: 'scenario-staging',
  concurrency: 100,
  durationSeconds: 60,
  p95Ms: 1600,
  errorRatePercent: 2.5,
  requestsPerSecond: 40,
  notes: 'Baseline staging run before optimization; still above the p95 and throughput targets for the usage dashboard.',
}

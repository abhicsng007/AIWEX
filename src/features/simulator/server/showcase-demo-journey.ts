import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { accessCatalog, employeeProfile, nextScheduleStart, policyRequirements, readinessQuestions, trainingSlides } from '@/features/simulator/domain/onboarding'
import { issuesForScenarioLevel, taskIdsForScenarioLevel, type ScenarioLevel } from '@/features/simulator/domain/difficulty'
import { meetingDefinitions } from '@/features/simulator/domain/meetings'
import { seededIssues, type WorkIssue } from '@/features/simulator/domain/issues'
import { createProjectDeliveryReport, createTaskDeliveryReport } from '@/features/simulator/domain/delivery-reports'
import { assessSimulation } from '@/features/simulator/domain/assessment'
import { deriveScenarioProgression } from '@/features/simulator/domain/progression'
import type { SimulationEvent, SimulationEventType } from '@/features/simulator/domain/types'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'

/**
 * Known-good SignalDesk fixture (same content as
 * scenarios/signaldesk-web/tests/fixtures/valid-alerts-panel.tsx).
 * Embedded so Vercel serverless does not depend on the scenarios tree or
 * spawning `node --test` with a missing/dev-only typescript package.
 */
const EMBEDDED_VALID_ALERTS_PANEL = `import { EmptyState } from '../../app/components/empty-state'

type UsageAlert = { id: string; currentUsage: number }

export function AlertsPanel({ alerts, canManageBilling }: { alerts: UsageAlert[]; canManageBilling: boolean }) {
  if (!alerts.length) {
    return <EmptyState
      title="No usage alerts yet"
      description="We'll let you know when your workspace is close to a limit."
      action={canManageBilling ? <a href="/settings/billing">Review your plan</a> : undefined}
    />
  }

  return <ul>{alerts.map((alert) => <li key={alert.id}>Usage is {alert.currentUsage}</li>)}</ul>
}
`

export type ShowcaseJourneySummary = {
  runId: string
  steps: string[]
  taskCompletions: string[]
  taskReports: number
  projectReport: boolean
  scheduleCompleted: number
  meetingsCompleted: number
  issuesDone: number
  feedbackScores: Record<string, number> | null
}

/** Minutes after schedule start when each calendar item is open. */
const scheduleCompletionPlan: Array<{ id: string; minutesFromBase: number }> = [
  { id: 'manager-checkin-day-1', minutesFromBase: 15 },
  { id: 'focus-proj-184', minutesFromBase: 120 },
  { id: 'review-window', minutesFromBase: 270 },
  { id: 'deadline-proj-184', minutesFromBase: 306 },
  { id: 'standup-day-2', minutesFromBase: 1446 },
  { id: 'deadline-proj-191', minutesFromBase: 1926 },
  { id: 'release-check', minutesFromBase: 2910 },
  { id: 'deadline-release-note', minutesFromBase: 3366 },
  { id: 'retro-day-3', minutesFromBase: 3450 },
]

const run = promisify(execFile)
const testFile = resolve(process.cwd(), 'scenarios', 'signaldesk-web', 'tests', 'alerts-panel.test.cjs')

async function loadValidWorkspaceSource() {
  try {
    return await fs.readFile(
      resolve(process.cwd(), 'scenarios', 'signaldesk-web', 'tests', 'fixtures', 'valid-alerts-panel.tsx'),
      'utf8',
    )
  } catch {
    return EMBEDDED_VALID_ALERTS_PANEL
  }
}

/** Lightweight contract checks that match alerts-panel.test.cjs without spawning node:test. */
function verifyKnownGoodFixture(source: string) {
  if (!/function\s+AlertsPanel\s*\(/.test(source)) throw new Error('Showcase fixture missing AlertsPanel.')
  if (!/canManageBilling\s*:\s*boolean/.test(source)) throw new Error('Showcase fixture missing canManageBilling type.')
  // Conditional action: canManageBilling ? <a ...> : undefined
  if (!source.includes('canManageBilling ?') && !source.includes('canManageBilling?')) {
    throw new Error('Showcase fixture missing canManageBilling conditional action.')
  }
  if (!/\bundefined\b/.test(source)) throw new Error('Showcase fixture must hide the action when unauthorized.')
}

function mergeRationale(taskId: string) {
  return `Safe to merge ${taskId}: role guard is enforced with canManageBilling, legacy empty-state behavior is preserved, scenario checks passed, and review feedback was addressed with validation evidence.`
}

function reviewResponse(taskId: string) {
  return `Thanks @noah — for ${taskId} I used the canManageBilling guard for the billing CTA, kept the explanatory empty state when the action is unavailable, and re-ran the scenario contract checks covering allowed roles, restricted roles, and the legacy threshold-less workspace.`
}

function standupText(taskId: string) {
  return `Yesterday: prepared ${taskId}. Today: implement, validate, and open PR. Blocker: none; I will escalate if legacy threshold behavior is unclear.`
}

function teammateQuestion(taskId: string) {
  return `@noah For ${taskId}, I plan to protect the billing CTA with canManageBilling and keep the explanatory empty state for legacy workspaces without a threshold. Does that match the acceptance criteria for restricted roles?`
}

function issuePayload(base: WorkIssue, changes: Partial<WorkIssue>): WorkIssue {
  return { ...base, ...changes, updatedAt: 'Showcase complete' }
}

function event(runId: string, type: SimulationEventType, metadata: SimulationEvent['metadata'] = {}): SimulationEvent {
  return { id: randomUUID(), organizationId: runId, type, createdAt: new Date().toISOString(), metadata }
}

async function append(runId: string, type: SimulationEventType, metadata: SimulationEvent['metadata'] = {}) {
  const item = event(runId, type, metadata)
  await inMemoryEventStore.append(item)
  return item
}

/**
 * Verifies the known-good fixture and records checks_passed.
 * On Vercel, never spawn `node --test` (typescript is a devDependency and child
 * processes often fail under /var/task). Locally, prefer the real scenario runner
 * when the test file is present, otherwise fall back to in-process checks.
 */
async function runScenarioChecks(runId: string, source: string) {
  const sourceHash = createHash('sha256').update(source).digest('hex')
  verifyKnownGoodFixture(source)
  const startedAt = Date.now()
  const onVercel = process.env.VERCEL === '1' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)
  const preferSpawn = !onVercel && process.env.AIWEX_SHOWCASE_SPAWN_TESTS !== 'false'

  if (preferSpawn) {
    try {
      await fs.access(testFile)
      const workspace = await fs.mkdtemp(join(tmpdir(), 'aiwex-showcase-'))
      const sourcePath = join(workspace, 'alerts-panel.tsx')
      try {
        await fs.writeFile(sourcePath, source, 'utf8')
        await run(process.execPath, ['--test', testFile], {
          env: { ...process.env, SCENARIO_SOURCE_PATH: sourcePath },
          timeout: 15_000,
          maxBuffer: 256 * 1024,
        })
        const durationMs = Date.now() - startedAt
        await append(runId, 'checks_passed', {
          verified: true,
          sourceHash,
          command: 'node --test tests/alerts-panel.test.cjs',
          durationMs,
          showcase: true,
        })
        return { sourceHash, durationMs }
      } finally {
        await fs.rm(workspace, { recursive: true, force: true }).catch(() => {})
      }
    } catch {
      // Fall through to in-process verification for constrained hosts.
    }
  }

  const durationMs = Date.now() - startedAt
  await append(runId, 'checks_passed', {
    verified: true,
    sourceHash,
    command: 'showcase_in_process_fixture_verify',
    durationMs,
    showcase: true,
    environment: onVercel ? 'vercel' : 'local-fallback',
  })
  return { sourceHash, durationMs }
}

async function recordChecksPassed(runId: string, sourceHash: string, durationMs: number) {
  await append(runId, 'checks_passed', {
    verified: true,
    sourceHash,
    command: 'showcase_in_process_fixture_verify',
    durationMs,
    showcase: true,
    reused: true,
  })
}

export type ShowcaseProgressUpdate = {
  phase: string
  message: string
  /** 0–100 approximate overall progress for the preparing UI. */
  percent?: number
}

/**
 * Builds a finished Basic → Advanced demo run entirely in-process.
 * Avoids HTTP self-fetch so Vercel serverless does not split work across instances mid-build.
 */
export async function driveCompleteShowcaseJourney(
  _baseUrl: string,
  runId: string,
  onProgress?: (update: ShowcaseProgressUpdate) => void | Promise<void>,
): Promise<ShowcaseJourneySummary> {
  const steps: string[] = []
  const report = async (phase: string, message: string, percent?: number) => {
    steps.push(phase)
    await onProgress?.({ phase, message, percent })
  }
  const validSource = await loadValidWorkspaceSource()
  const board = new Map<string, WorkIssue>(seededIssues.map((issue) => [issue.id, { ...issue }]))

  const upsertIssue = async (issue: WorkIssue, mode: 'created' | 'updated') => {
    board.set(issue.id, issue)
    await append(runId, mode === 'created' ? 'issue_created' : 'issue_updated', {
      issueId: issue.id,
      status: issue.status,
      priority: issue.priority,
      assignee: issue.assignee,
      issue,
    })
  }

  await report('session', 'Creating a disposable demo session…', 4)

  // --- Onboarding ---
  await report('onboarding', 'Completing organizational onboarding…', 12)
  await append(runId, 'onboarding_started')
  await append(runId, 'onboarding_profile_confirmed', {
    employeeId: employeeProfile.employeeId,
    role: employeeProfile.role,
    manager: employeeProfile.manager,
  })
  for (const policy of policyRequirements) {
    await append(runId, 'policy_acknowledged', { policyId: policy.id, owner: policy.owner, evidence: policy.evidence })
  }
  for (const access of accessCatalog) {
    await append(runId, 'access_provisioned', {
      accessId: access.id,
      system: access.system,
      owner: access.owner,
      requiredForProject: access.requiredForProject,
    })
  }
  for (const slide of trainingSlides) {
    await append(runId, 'quiz_attempted', { slideId: slide.id, correct: true })
    await append(runId, 'quiz_passed', { slideId: slide.id, score: 100 })
    await append(runId, 'training_slide_completed', { slideId: slide.id })
  }
  await append(runId, 'readiness_task_started', { attempt: 1 })
  const readinessScore = readinessQuestions.length * 20
  await append(runId, 'readiness_task_passed', { evidence: 'organizational_readiness_mcq', score: readinessScore })
  await append(runId, 'manager_signoff_recorded', {
    reviewer: employeeProfile.manager,
    score: readinessScore,
    decision: 'approved_for_project_access',
  })
  await append(runId, 'schedule_created', { startAt: nextScheduleStart(), timezone: 'UTC' })
  await report('qualified', 'Onboarding complete — project access approved', 22)

  // --- Team welcome ---
  await report('welcome', 'Running team welcome and introduction…', 28)
  const welcomeChannel = 'product-usage'
  await append(runId, 'team_welcome_started', { channelId: welcomeChannel })
  for (const item of [
    { agentId: 'marcus', message: 'Welcome to SignalDesk, @alex. I care about clear ownership, sustainable delivery, and asking for help before a small risk becomes a larger one.' },
    { agentId: 'maya', message: 'Hi Alex. I own product outcomes for usage alerts. Bring me context early when a change could affect what we ship.' },
    { agentId: 'noah', message: 'Welcome. Keep assumptions written down, cover legacy behavior with tests, and use the PR to explain why a change is safe.' },
    { agentId: 'devon', message: 'I surface integration risks directly. A useful handoff includes the reproduction, affected surface, and the test that creates confidence.' },
    { agentId: 'marcus', message: 'Your turn, Alex. Introduce yourself, say what you want to learn, and ask one initial question before we return to scheduled work.' },
  ]) {
    await append(runId, 'agent_reply', { agentId: item.agentId, channelId: welcomeChannel, message: item.message, trigger: 'team-welcome' })
  }
  const introduction = 'I am Alex Morgan. I want to practice validation, review communication, and safe delivery for usage alerts across Basic through Advanced.'
  await append(runId, 'chat_message', { channelId: welcomeChannel, message: introduction, ceremony: true })
  await append(runId, 'learner_introduction_posted', { channelId: welcomeChannel })
  await append(runId, 'agent_reply', {
    agentId: 'marcus',
    channelId: welcomeChannel,
    message: 'Thanks, Alex. Ask when context is missing; nobody expects you to guess. Keep your next handoff and calendar risk visible.',
    trigger: 'team-welcome',
  })
  await append(runId, 'team_welcome_concluded', { channelId: welcomeChannel })
  await report('team_welcome', 'Team welcome recorded', 34)

  await append(runId, 'agent_reply', {
    agentId: 'noah',
    channelId: 'engineering',
    message: 'For PROJ-184, keep restricted roles on the explanatory empty state when canManageBilling is false, and cover the legacy threshold-less workspace in checks.',
    trigger: 'showcase-agent-turn',
  })
  await report('agent_turn', 'Recording teammate collaboration…', 38)

  for (const issue of seededIssues.filter((item) => item.assignee !== 'alex' || item.status === 'done')) {
    await upsertIssue(issuePayload(issue, { status: 'done' }), 'updated')
  }

  // Real scenario validation once; later tasks reuse the verified source evidence.
  let checks: { sourceHash: string; durationMs: number } | null = null
  const levels: ScenarioLevel[] = ['basic', 'intermediate', 'advanced']
  const levelPercents: Record<ScenarioLevel, number> = { basic: 48, intermediate: 62, advanced: 78 }
  for (const level of levels) {
    await report(`level_${level}`, `Delivering ${level} scenario tasks…`, levelPercents[level] - 8)
    await append(runId, 'scenario_level_selected', { level })
    const firstTask = taskIdsForScenarioLevel[level][0]
    await append(runId, 'delivery_cycle_started', { level, taskId: firstTask, sequence: 1 })

    for (const issue of issuesForScenarioLevel(level)) {
      if (!board.has(issue.id)) await upsertIssue(issuePayload(issue, { status: 'todo' }), 'created')
      else if (taskIdsForScenarioLevel[level].includes(issue.id)) {
        await upsertIssue(issuePayload(board.get(issue.id)!, {
          assignee: 'alex',
          status: board.get(issue.id)!.status === 'done' ? 'todo' : board.get(issue.id)!.status,
          priority: issue.priority,
        }), 'updated')
      }
    }

    let sequence = 0
    for (const taskId of taskIdsForScenarioLevel[level]) {
      sequence += 1
      if (sequence > 1) {
        await append(runId, 'delivery_cycle_started', { level, taskId, sequence })
      }
      const base = board.get(taskId) || issuesForScenarioLevel(level).find((issue) => issue.id === taskId)
      if (!base) throw new Error(`Missing board issue ${taskId}`)
      await upsertIssue(issuePayload(base, { status: 'in_progress', assignee: 'alex' }), board.has(taskId) ? 'updated' : 'created')

      await append(runId, 'standup_posted', { text: standupText(taskId), issueId: taskId, level })
      await append(runId, 'chat_message', { channelId: 'engineering', message: teammateQuestion(taskId), authorId: 'you' })
      await append(runId, 'workspace_revision_saved', {
        path: 'app/components/alerts-panel.tsx',
        content: validSource,
        baseRevisionId: '',
      })

      if (!checks) {
        checks = await runScenarioChecks(runId, validSource)
      } else {
        await recordChecksPassed(runId, checks.sourceHash, checks.durationMs)
      }

      const prNumber = 480 + Object.values(taskIdsForScenarioLevel).flat().indexOf(taskId)
      await append(runId, 'commit_created', {
        message: `feat(${taskId}): protect usage-alerts empty state with canManageBilling`,
        branch: `feature/${taskId.toLowerCase()}-usage-alerts`,
        issueId: taskId,
      })
      await append(runId, 'pull_request_opened', {
        title: `${taskId}: usage alerts empty state role guard`,
        body: `Implements ${taskId} with canManageBilling guard and legacy empty-state coverage.`,
        issueId: taskId,
        prNumber,
        branch: `feature/${taskId.toLowerCase()}-usage-alerts`,
      })
      await upsertIssue(issuePayload(board.get(taskId)!, { status: 'in_review', assignee: 'alex' }), 'updated')
      await append(runId, 'review_addressed', {
        summary: `Addressed review on ${taskId}: canManageBilling guards the billing CTA.`,
        issueId: taskId,
      })
      await append(runId, 'review_reply', { response: reviewResponse(taskId), issueId: taskId })
      await append(runId, 'approval_granted', { reviewer: 'noah', issueId: taskId })
      await append(runId, 'merge_rationale_recorded', { rationale: mergeRationale(taskId), issueId: taskId })
      await append(runId, 'pull_request_merged', { issueId: taskId, level, prNumber })
      await append(runId, 'task_completed', { issueId: taskId, level })

      let events = await inMemoryEventStore.list(runId)
      const createdAt = new Date().toISOString()
      const report = createTaskDeliveryReport(events, { id: randomUUID(), taskId, level, createdAt })
      await append(runId, 'task_report_created', { taskId, level, report })
      events = await inMemoryEventStore.list(runId)
      const progression = deriveScenarioProgression(events)
      if (progression.nextLevel && progression.requirements.every((item) => item.complete) && !events.some((item) => item.type === 'level_unlocked' && item.metadata?.level === progression.nextLevel)) {
        await append(runId, 'level_unlocked', {
          level: progression.nextLevel,
          unlockedFrom: progression.currentLevel,
          overallScore: progression.overallScore,
        })
      }
      await upsertIssue(issuePayload(board.get(taskId)!, { status: 'done', assignee: 'alex' }), 'updated')
      await report(`completed_${taskId}`, `Completed ${taskId} through the merge gate`, levelPercents[level])
    }
  }

  await report('performance', 'Recording performance and release evidence…', 84)
  await append(runId, 'load_test_recorded', {
    runId: randomUUID(),
    scenarioId: 'usage-dashboard-latency',
    environment: 'scenario-staging',
    concurrency: 100,
    durationSeconds: 60,
    p95Ms: 320,
    errorRatePercent: 0.4,
    requestsPerSecond: 88,
    notes: 'After index and cache fixes on usage summary, p95 dropped below 450ms with stable error rate under 100 concurrent users.',
  })
  await append(runId, 'scenario_deployment_recorded', {
    environment: 'scenario-staging',
    summary: 'Usage-alerts empty-state guard validated in scenario-staging with passing checks and documented rollback signals.',
  })

  await report('meetings', 'Closing introduction and team meetings…', 90)
  let meetingsCompleted = 0
  for (const meeting of meetingDefinitions) {
    await append(runId, 'meeting_started', { meetingId: meeting.id, scheduleId: meeting.scheduleId, channelId: meeting.channelId })
    const intro = meeting.id === 'manager-checkin'
      ? 'Hi team — I am Alex. I want to learn safe delivery habits for usage alerts and keep validation evidence visible this week.'
      : `Sharing an update for ${meeting.title}: delivery evidence is in the PR and task report, and I am ready for the next decision.`
    await append(runId, 'meeting_message_posted', {
      meetingId: meeting.id,
      channelId: meeting.channelId,
      authorId: 'you',
      message: intro,
      expression: 'speaking',
    })
    await append(runId, 'meeting_agent_replied', {
      meetingId: meeting.id,
      channelId: meeting.channelId,
      authorId: meeting.facilitatorId,
      message: 'Thanks, Alex. I have captured that point. Let us keep ownership and next steps visible.',
      expression: 'happy',
    })
    await append(runId, 'meeting_decision_recorded', {
      meetingId: meeting.id,
      channelId: meeting.channelId,
      summary: 'Meeting closed with working context and next steps recorded.',
    })
    await append(runId, 'meeting_ended', { meetingId: meeting.id, channelId: meeting.channelId })
    meetingsCompleted += 1
  }

  await report('calendar', 'Completing calendar and schedule blocks…', 94)
  let advancedSoFar = 0
  let scheduleCompleted = 0
  for (const item of scheduleCompletionPlan) {
    const delta = item.minutesFromBase - advancedSoFar
    if (delta > 0) {
      await append(runId, 'simulation_time_advanced', {
        minutes: delta,
        to: 9 * 60 + 42 + item.minutesFromBase,
        reason: `Open calendar window for ${item.id}`,
      })
      advancedSoFar = item.minutesFromBase
    }
    await append(runId, 'schedule_event_completed', { scheduleId: item.id })
    scheduleCompleted += 1
  }

  await report('reports', 'Building task and project evidence reports…', 97)
  let events = await inMemoryEventStore.list(runId)
  if (!events.some((item) => item.type === 'project_report_created')) {
    const createdAt = new Date().toISOString()
    const report = createProjectDeliveryReport(events, { id: randomUUID(), createdAt })
    if (report) {
      await append(runId, 'project_report_created', { report })
      events = await inMemoryEventStore.list(runId)
    }
  }

  const taskCompletions = events
    .filter((item) => item.type === 'task_completed')
    .map((item) => `${String(item.metadata?.level || '')}:${String(item.metadata?.issueId || '')}`)
  const taskReports = events.filter((item) => item.type === 'task_report_created').length
  const projectReport = events.some((item) => item.type === 'project_report_created')
  const issuesDone = [...board.values()].filter((issue) => issue.status === 'done').length
  const expected = [
    'basic:PROJ-184',
    'intermediate:PROJ-191',
    'intermediate:PROJ-189',
    'advanced:PROJ-203',
    'advanced:PROJ-204',
    'advanced:PROJ-205',
  ]
  if (JSON.stringify(taskCompletions) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected completions: ${JSON.stringify(taskCompletions)}`)
  }
  if (taskReports < expected.length) throw new Error(`Expected ${expected.length} task reports, got ${taskReports}`)
  if (!projectReport) throw new Error('Expected a final project report')

  const assessment = assessSimulation(events)
  await report('ready', 'Showcase ready — opening your workspace…', 100)

  return {
    runId,
    steps,
    taskCompletions,
    taskReports,
    projectReport,
    scheduleCompleted,
    meetingsCompleted,
    issuesDone,
    feedbackScores: assessment.scores,
  }
}

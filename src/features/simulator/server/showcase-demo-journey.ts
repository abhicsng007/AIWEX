import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'
import { demoCookieName } from '@/features/auth/demo-session'
import { accessCatalog, policyRequirements, readinessQuestions, trainingSlides } from '@/features/simulator/domain/onboarding'
import { issuesForScenarioLevel, taskIdsForScenarioLevel, type ScenarioLevel } from '@/features/simulator/domain/difficulty'
import { meetingDefinitions } from '@/features/simulator/domain/meetings'
import { seededIssues, type WorkIssue } from '@/features/simulator/domain/issues'

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

type ApiResult = {
  status: number
  json: Record<string, unknown> | null
  text: string
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

function cookieHeader(runId: string) {
  return `${demoCookieName}=${runId}`
}

function assertOk(step: string, result: ApiResult, ok: (status: number, json: Record<string, unknown> | null) => boolean = (status) => status >= 200 && status < 300) {
  if (!ok(result.status, result.json)) {
    const detail = result.json ? JSON.stringify(result.json).slice(0, 400) : result.text.slice(0, 400)
    throw new Error(`${step} failed (${result.status}): ${detail}`)
  }
}

async function loadValidWorkspaceSource() {
  return fs.readFile(resolve(process.cwd(), 'scenarios', 'signaldesk-web', 'tests', 'fixtures', 'valid-alerts-panel.tsx'), 'utf8')
}

function trainingAnswers() {
  return Object.fromEntries(trainingSlides.map((slide) => [slide.id, slide.correctOption])) as Record<string, number>
}

function readinessAnswers() {
  return Object.fromEntries(readinessQuestions.map((question) => [question.id, question.correctOption])) as Record<string, number>
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

/**
 * Drives a disposable demo run through the real HTTP simulation APIs:
 * onboarding → team welcome → basic/intermediate/advanced delivery →
 * calendar/meetings close-out → board + PR completion → reports.
 */
export async function driveCompleteShowcaseJourney(baseUrl: string, runId: string): Promise<ShowcaseJourneySummary> {
  const origin = baseUrl.replace(/\/$/, '')
  const steps: string[] = []
  const validSource = await loadValidWorkspaceSource()
  const cookie = cookieHeader(runId)
  /** Latest known board state for issue events. */
  const board = new Map<string, WorkIssue>(seededIssues.map((issue) => [issue.id, { ...issue }]))

  const api = async (method: string, path: string, body?: Record<string, unknown>): Promise<ApiResult> => {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Cookie: cookie,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        'x-timezone': 'UTC',
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })
    const text = await response.text()
    let json: Record<string, unknown> | null = null
    try { json = text ? JSON.parse(text) as Record<string, unknown> : null } catch { json = null }
    return { status: response.status, json, text }
  }

  const postEvent = async (type: string, metadata: Record<string, unknown> = {}) => {
    const result = await api('POST', '/api/simulation/events', { type, metadata })
    assertOk(`event ${type}`, result, (status) => status === 201)
    return result
  }

  const upsertIssue = async (issue: WorkIssue, mode: 'created' | 'updated') => {
    board.set(issue.id, issue)
    await postEvent(mode === 'created' ? 'issue_created' : 'issue_updated', {
      issueId: issue.id,
      status: issue.status,
      priority: issue.priority,
      assignee: issue.assignee,
      issue,
    })
  }

  // --- Onboarding academy (real POST actions) ---
  assertOk('onboarding start', await api('POST', '/api/simulation/onboarding', { action: 'start' }), (status) => status === 200 || status === 201)
  steps.push('onboarding_started')
  assertOk('confirm profile', await api('POST', '/api/simulation/onboarding', { action: 'confirm_profile' }), (status) => status === 200 || status === 201)
  for (const policy of policyRequirements) {
    assertOk(`policy ${policy.id}`, await api('POST', '/api/simulation/onboarding', { action: 'acknowledge_policy', policyId: policy.id }), (status) => status === 200 || status === 201)
  }
  for (const access of accessCatalog) {
    assertOk(`access ${access.id}`, await api('POST', '/api/simulation/onboarding', { action: 'provision_access', accessId: access.id }), (status) => status === 200 || status === 201)
  }

  const answers = trainingAnswers()
  for (let index = 0; index < trainingSlides.length; index += 1) {
    const state = await api('GET', '/api/simulation/onboarding')
    assertOk('onboarding state', state)
    const current = (state.json?.state as { currentSlide?: { id?: string } } | undefined)?.currentSlide
    if (!current?.id) break
    const answer = answers[current.id]
    if (typeof answer !== 'number') throw new Error(`Missing training answer for ${current.id}`)
    const quiz = await api('POST', '/api/simulation/onboarding', { action: 'submit_quiz', slideId: current.id, answer })
    assertOk(`quiz ${current.id}`, quiz, (status, json) => status === 200 && Boolean(json?.correct))
  }
  steps.push('training_complete')

  const readiness = await api('POST', '/api/simulation/onboarding', { action: 'submit_readiness', answers: readinessAnswers() })
  assertOk('readiness', readiness, (status, json) => (status === 200 || status === 201) && Boolean(json?.qualified))
  steps.push('qualified')

  // --- Team welcome ceremony ---
  assertOk('team welcome start', await api('POST', '/api/simulation/team-welcome', { action: 'start' }), (status) => status === 200 || status === 201)
  assertOk('team introduction', await api('POST', '/api/simulation/team-welcome', {
    action: 'introduce',
    introduction: 'I am Alex Morgan. I want to practice validation, review communication, and safe delivery for usage alerts across Basic through Advanced.',
  }), (status) => status === 200 || status === 201)
  steps.push('team_welcome')

  const agent = await api('POST', '/api/simulation/agent-turns', {
    channelId: 'engineering',
    userMessage: '@noah For PROJ-184, confirm restricted roles keep the empty-state copy when canManageBilling is false.',
    channelType: 'channel',
    channelPurpose: 'Engineering delivery collaboration',
  })
  assertOk('agent turn', agent, (status) => status === 201)
  steps.push('agent_turn')

  // Close teammate board items so Issues does not look half-finished after the showcase.
  for (const issue of seededIssues.filter((item) => item.assignee !== 'alex' || item.status === 'done')) {
    const next = issuePayload(issue, { status: 'done', assignee: issue.assignee })
    await upsertIssue(next, 'updated')
  }

  const levels: ScenarioLevel[] = ['basic', 'intermediate', 'advanced']
  for (const level of levels) {
    assertOk(`select ${level}`, await postEvent('scenario_level_selected', { level }))
    steps.push(`level_${level}`)

    // Ensure the board includes every issue the level exposes (advanced adds PROJ-203+).
    for (const issue of issuesForScenarioLevel(level)) {
      if (!board.has(issue.id)) await upsertIssue(issuePayload(issue, { status: 'todo' }), 'created')
      else if (taskIdsForScenarioLevel[level].includes(issue.id)) {
        const current = board.get(issue.id)!
        await upsertIssue(issuePayload(current, {
          assignee: 'alex',
          status: current.status === 'done' ? 'todo' : current.status,
          priority: issue.priority,
        }), 'updated')
      }
    }

    for (const taskId of taskIdsForScenarioLevel[level]) {
      const base = board.get(taskId) || issuesForScenarioLevel(level).find((issue) => issue.id === taskId)
      if (!base) throw new Error(`Missing board issue ${taskId}`)
      await upsertIssue(issuePayload(base, { status: 'in_progress', assignee: 'alex' }), board.has(taskId) ? 'updated' : 'created')

      await postEvent('standup_posted', { text: standupText(taskId), issueId: taskId, level })
      await postEvent('chat_message', { channelId: 'engineering', message: teammateQuestion(taskId), authorId: 'you' })

      const workspace = await api('PUT', '/api/simulation/workspace', {
        path: 'app/components/alerts-panel.tsx',
        content: validSource,
      })
      assertOk(`workspace ${taskId}`, workspace, (status) => status === 200 || status === 201)

      const validate = await api('POST', '/api/workspace/validate', { source: validSource })
      assertOk(`validate ${taskId}`, validate, (status, json) => status === 201 && Boolean(json?.passed))

      await postEvent('commit_created', {
        message: `feat(${taskId}): protect usage-alerts empty state with canManageBilling`,
        branch: `feature/${taskId.toLowerCase()}-usage-alerts`,
        issueId: taskId,
      })
      await postEvent('pull_request_opened', {
        title: `${taskId}: usage alerts empty state role guard`,
        body: `Implements ${taskId} with canManageBilling guard and legacy empty-state coverage.`,
        issueId: taskId,
        prNumber: 480 + Object.values(taskIdsForScenarioLevel).flat().indexOf(taskId),
        branch: `feature/${taskId.toLowerCase()}-usage-alerts`,
      })
      await upsertIssue(issuePayload(board.get(taskId)!, { status: 'in_review', assignee: 'alex' }), 'updated')

      await postEvent('review_addressed', {
        summary: `Addressed review on ${taskId}: canManageBilling guards the billing CTA.`,
        issueId: taskId,
      })
      await postEvent('review_reply', { response: reviewResponse(taskId), issueId: taskId })
      await postEvent('approval_granted', { reviewer: 'noah', issueId: taskId })
      await postEvent('merge_rationale_recorded', { rationale: mergeRationale(taskId), issueId: taskId })
      await postEvent('pull_request_merged', { issueId: taskId, level, prNumber: 480 + Object.values(taskIdsForScenarioLevel).flat().indexOf(taskId) })
      const complete = await postEvent('task_completed', { issueId: taskId, level })
      if (!complete.json?.taskReport) throw new Error(`Expected task report for ${taskId}`)
      await upsertIssue(issuePayload(board.get(taskId)!, { status: 'done', assignee: 'alex' }), 'updated')
      steps.push(`completed_${taskId}`)
    }
  }

  // Performance + deployment evidence for release calendar gates and feedback.
  const loadTest = await api('POST', '/api/simulation/performance', {
    result: {
      scenarioId: 'usage-dashboard-latency',
      environment: 'scenario-staging',
      concurrency: 100,
      durationSeconds: 60,
      p95Ms: 320,
      errorRatePercent: 0.4,
      requestsPerSecond: 88,
      notes: 'After index and cache fixes on usage summary, p95 dropped below 450ms with stable error rate under 100 concurrent users.',
    },
  })
  assertOk('load test', loadTest, (status) => status === 200 || status === 201)
  steps.push('load_test_recorded')

  await postEvent('scenario_deployment_recorded', {
    environment: 'scenario-staging',
    summary: 'Usage-alerts empty-state guard validated in scenario-staging with passing checks and documented rollback signals.',
  })
  steps.push('deployment_recorded')

  // --- Meetings: run and close every conference room ---
  let meetingsCompleted = 0
  for (const meeting of meetingDefinitions) {
    assertOk(`meeting start ${meeting.id}`, await api('POST', '/api/simulation/meetings', { meetingId: meeting.id, action: 'start' }), (status) => status === 200 || status === 201)
    const intro = meeting.id === 'manager-checkin'
      ? 'Hi team — I am Alex. I want to learn safe delivery habits for usage alerts and keep validation evidence visible this week.'
      : `Sharing an update for ${meeting.title}: delivery evidence is in the PR and task report, and I am ready for the next decision.`
    assertOk(`meeting message ${meeting.id}`, await api('POST', '/api/simulation/meetings', {
      meetingId: meeting.id,
      action: 'message',
      message: intro,
    }), (status) => status === 200 || status === 201)
    assertOk(`meeting reply ${meeting.id}`, await api('POST', '/api/simulation/meetings', {
      meetingId: meeting.id,
      action: 'agent_reply',
      message: intro,
    }), (status) => status === 200 || status === 201)
    assertOk(`meeting end ${meeting.id}`, await api('POST', '/api/simulation/meetings', { meetingId: meeting.id, action: 'end' }), (status) => status === 200 || status === 201)
    meetingsCompleted += 1
  }
  steps.push('meetings_complete')

  // --- Calendar: advance the simulation clock through every work block and mark complete ---
  let advancedSoFar = 0
  let scheduleCompleted = 0
  for (const item of scheduleCompletionPlan) {
    const delta = item.minutesFromBase - advancedSoFar
    if (delta > 0) {
      await postEvent('simulation_time_advanced', {
        minutes: delta,
        to: 9 * 60 + 42 + item.minutesFromBase,
        reason: `Open calendar window for ${item.id}`,
      })
      advancedSoFar = item.minutesFromBase
    }
    const complete = await api('POST', '/api/simulation/schedule', { action: 'complete', scheduleId: item.id })
    assertOk(`schedule ${item.id}`, complete, (status, json) => {
      if (status !== 200 && status !== 201) return false
      const schedule = Array.isArray(json?.schedule) ? json.schedule as Array<{ id?: string; completed?: boolean }> : []
      return schedule.some((entry) => entry.id === item.id && entry.completed)
    })
    scheduleCompleted += 1
  }
  steps.push('calendar_complete')

  const events = await api('GET', '/api/simulation/events')
  assertOk('events ledger', events)
  const ledger = Array.isArray(events.json?.events) ? events.json.events as Array<{ type: string; metadata?: Record<string, unknown> }> : []
  const taskCompletions = ledger
    .filter((event) => event.type === 'task_completed')
    .map((event) => `${String(event.metadata?.level || '')}:${String(event.metadata?.issueId || '')}`)
  const taskReports = ledger.filter((event) => event.type === 'task_report_created').length
  const projectReport = ledger.some((event) => event.type === 'project_report_created')
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
  if (scheduleCompleted < scheduleCompletionPlan.length) throw new Error(`Expected ${scheduleCompletionPlan.length} schedule completions`)
  if (meetingsCompleted < meetingDefinitions.length) throw new Error(`Expected ${meetingDefinitions.length} meetings closed`)

  const feedback = await api('GET', '/api/simulation/feedback')
  assertOk('feedback', feedback)
  const report = feedback.json?.report as { scores?: Record<string, number> } | undefined
  steps.push('feedback_ready')

  return {
    runId,
    steps,
    taskCompletions,
    taskReports,
    projectReport,
    scheduleCompleted,
    meetingsCompleted,
    issuesDone,
    feedbackScores: report?.scores || null,
  }
}

/**
 * End-to-end workflow simulation for AIWEX.
 *
 * Drives the real HTTP APIs from onboarding through Basic → Intermediate → Advanced
 * delivery cycles, including live OpenRouter teammate turns when OPENROUTER_API_KEY
 * is configured on the server.
 *
 * Usage:
 *   node scripts/e2e-workflow-simulation.mjs
 *   node scripts/e2e-workflow-simulation.mjs --base http://localhost:3000
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const baseUrl = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : process.env.AIWEX_BASE_URL || 'http://localhost:3000'

const validSource = readFileSync(
  resolve(root, 'scenarios/signaldesk-web/tests/fixtures/valid-alerts-panel.tsx'),
  'utf8',
)
const brokenSource = `export function AlertsPanel({ alerts }: { alerts: { id: string }[] }) {
  return <div>{alerts.length ? 'has alerts' : 'empty'}</div>
}
`

const policyIds = ['security-baseline', 'data-protection', 'engineering-operating-model']
const accessIds = ['workspace', 'scenario-repo', 'team-space', 'staging', 'docs']
const trainingAnswers = {
  'company-mandate': 1,
  'security-privacy': 1,
  'next-contracts': 1,
  'product-legacy-context': 0,
  'delivery-readiness': 1,
}
const readinessAnswers = {
  'permission-boundary': 1,
  'legacy-customer-state': 0,
  'security-data-handling': 0,
  'validation-evidence': 1,
  'communication-delivery': 0,
}

const tasksByLevel = {
  basic: ['PROJ-184'],
  intermediate: ['PROJ-191', 'PROJ-189'],
  advanced: ['PROJ-203', 'PROJ-204', 'PROJ-205'],
}

/** @type {{ name: string; ok: boolean; detail: string; ms?: number }[]} */
const checks = []
/** @type {string[]} */
const openRouterEvidence = []
/** @type {Record<string, unknown>} */
const report = {
  startedAt: new Date().toISOString(),
  baseUrl,
  runId: null,
  steps: [],
  gateTests: [],
  openRouter: { attempted: 0, live: 0, fallback: 0, samples: [] },
  progression: [],
  final: null,
}

function cookieJar() {
  /** @type {Map<string, string>} */
  const jar = new Map()
  return {
    store(setCookieHeaders) {
      const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : setCookieHeaders ? [setCookieHeaders] : []
      for (const header of headers) {
        const [pair] = header.split(';')
        const eq = pair.indexOf('=')
        if (eq === -1) continue
        jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    },
    get(name) {
      return jar.get(name) || null
    },
  }
}

const cookies = cookieJar()

async function request(method, path, body, { expectStatus, label } = {}) {
  const started = Date.now()
  const headers = { Accept: 'application/json' }
  const cookie = cookies.header()
  if (cookie) headers.Cookie = cookie
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  })
  const setCookie = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : response.headers.get('set-cookie')
  cookies.store(setCookie)
  const text = await response.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = { raw: text.slice(0, 500) } }
  const ms = Date.now() - started
  const entry = {
    label: label || `${method} ${path}`,
    method,
    path,
    status: response.status,
    ms,
    ok: expectStatus === undefined ? response.ok : response.status === expectStatus,
    error: json?.error,
  }
  report.steps.push(entry)
  if (expectStatus !== undefined && response.status !== expectStatus) {
    const detail = `${entry.label} expected ${expectStatus}, got ${response.status}: ${json?.error || text.slice(0, 200)}`
    checks.push({ name: entry.label, ok: false, detail, ms })
    throw new Error(detail)
  }
  return { response, json, ms, status: response.status }
}

function pass(name, detail, ms) {
  checks.push({ name, ok: true, detail, ms })
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

function fail(name, detail, ms) {
  checks.push({ name, ok: false, detail, ms })
  console.log(`  ✗ ${name} — ${detail}`)
}

function assert(name, condition, detail = '', ms) {
  if (condition) pass(name, detail, ms)
  else fail(name, detail || 'assertion failed', ms)
}

async function getEvents() {
  const { json } = await request('GET', '/api/simulation/events', undefined, { expectStatus: 200, label: 'GET events' })
  return json
}

async function postEvent(type, metadata = {}, options = {}) {
  return request('POST', '/api/simulation/events', { type, metadata }, {
    expectStatus: options.expectStatus ?? 201,
    label: options.label || `event:${type}`,
  })
}

async function onboarding(action, extra = {}, options = {}) {
  return request('POST', '/api/simulation/onboarding', { action, ...extra }, {
    expectStatus: options.expectStatus ?? 201,
    label: options.label || `onboarding:${action}`,
  })
}

async function completeOnboarding() {
  console.log('\n== 1. Onboarding academy ==')
  await onboarding('start')
  let { json } = await request('GET', '/api/simulation/onboarding', undefined, { expectStatus: 200, label: 'GET onboarding' })
  assert('onboarding starts in profile phase', json.state?.phase === 'profile', `phase=${json.state?.phase}`)

  // Gate: project work blocked before qualification
  const blocked = await request('POST', '/api/simulation/events', { type: 'standup_posted', metadata: { text: 'early standup' } }, {
    expectStatus: 409,
    label: 'gate: standup before onboarding',
  })
  assert('project work blocked before onboarding', blocked.status === 409, blocked.json?.error)
  report.gateTests.push({ name: 'standup before onboarding', expected: 409, actual: blocked.status, error: blocked.json?.error })

  await onboarding('confirm_profile')
  for (const policyId of policyIds) await onboarding('acknowledge_policy', { policyId }, { label: `policy:${policyId}` })
  for (const accessId of accessIds) await onboarding('provision_access', { accessId }, { label: `access:${accessId}` })

  // Training quizzes with correct answers
  for (let i = 0; i < Object.keys(trainingAnswers).length; i += 1) {
    const stateRes = await request('GET', '/api/simulation/onboarding', undefined, { expectStatus: 200, label: 'GET onboarding for quiz' })
    const slide = stateRes.json.state?.currentSlide
    if (!slide) break
    const answer = trainingAnswers[slide.id]
    if (typeof answer !== 'number') throw new Error(`No answer mapped for slide ${slide.id}`)
    const quiz = await onboarding('submit_quiz', { slideId: slide.id, answer }, { expectStatus: 200, label: `quiz:${slide.id}` })
    assert(`training quiz ${slide.id}`, quiz.json.correct === true, quiz.json.feedback?.slice(0, 80))
  }

  // Wrong readiness answers should not qualify
  const failReadiness = await onboarding('submit_readiness', {
    answers: {
      'permission-boundary': 0,
      'legacy-customer-state': 1,
      'security-data-handling': 1,
      'validation-evidence': 0,
      'communication-delivery': 1,
    },
  }, { expectStatus: 200, label: 'readiness:fail' })
  assert('failed readiness does not qualify', failReadiness.json.qualified === false, `score=${failReadiness.json.score}`)
  if (failReadiness.json.state?.phase === 'remediation') {
    await onboarding('resume_readiness', {}, { expectStatus: 201, label: 'readiness:resume' })
  }

  const passReadiness = await onboarding('submit_readiness', { answers: readinessAnswers }, { expectStatus: 201, label: 'readiness:pass' })
  assert('readiness + manager sign-off qualifies learner', passReadiness.json.qualified === true && passReadiness.json.state?.phase === 'qualified', `phase=${passReadiness.json.state?.phase} score=${passReadiness.json.score}`)
}

async function agentTurn(channelId, userMessage, { expectLive = true } = {}) {
  report.openRouter.attempted += 1
  const { json, ms } = await request('POST', '/api/simulation/agent-turns', {
    channelId,
    userMessage,
    channelType: 'channel',
    channelPurpose: 'Engineering delivery collaboration',
    recentDecisions: ['Protect billing CTA with canManageBilling'],
    openFollowUps: 1,
  }, { expectStatus: 201, label: `agent-turn:${channelId}` })

  const reasoning = String(json.turn?.reasoningSummary || '')
  const message = String(json.turn?.message || '')
  const isLive = /OpenRouter responded/i.test(reasoning)
  const isFallback = /based on the current workflow|Busy teammate|required evidence-based|used recent workflow/i.test(reasoning) && !isLive

  if (isLive) {
    report.openRouter.live += 1
    openRouterEvidence.push(reasoning)
  } else {
    report.openRouter.fallback += 1
  }
  report.openRouter.samples.push({
    channelId,
    agent: json.turn?.agent,
    action: json.turn?.action,
    live: isLive,
    reasoning: reasoning.slice(0, 200),
    message: message.slice(0, 280),
    ms,
  })

  assert(
    `agent turn in #${channelId}`,
    Boolean(message) && Boolean(json.turn?.agent?.id),
    `${json.turn?.agent?.name || '?'}: ${message.slice(0, 120)}${expectLive ? (isLive ? ' [OpenRouter live]' : ' [FALLBACK]') : ''}`,
    ms,
  )
  if (expectLive) {
    assert(`OpenRouter live response for #${channelId}`, isLive, isLive ? reasoning : `fallback used: ${reasoning}`)
  }
  return json
}

async function runDeliveryCycle(level, taskId, sequence) {
  console.log(`\n== Delivery ${level.toUpperCase()} · ${taskId} (${sequence}) ==`)

  // Gate: cannot open PR without standup/commit
  const earlyPr = await postEvent('pull_request_opened', { title: 'too early' }, { expectStatus: 409, label: `gate: pr-before-work ${taskId}` })
  report.gateTests.push({ name: `PR before work (${taskId})`, expected: 409, actual: earlyPr.status, error: earlyPr.json?.error })
  assert(`cannot open PR before standup/commit (${taskId})`, earlyPr.status === 409, earlyPr.json?.error)

  await postEvent('standup_posted', {
    text: `Yesterday: advanced ${taskId} prep. Today: implement, validate, and open PR for ${taskId}. Blocker: none; will escalate if legacy threshold behavior is unclear.`,
    issueId: taskId,
    level,
  }, { label: `standup ${taskId}` })

  // Learner chat message (feeds collaboration score + agent context)
  await postEvent('chat_message', {
    channelId: 'engineering',
    message: `@noah For ${taskId}, I plan to protect the billing CTA with canManageBilling and keep the explanatory empty state for legacy workspaces without a threshold. Does that match the acceptance criteria and risk for restricted roles?`,
    authorId: 'you',
  }, { label: `chat ${taskId}` })

  // Real OpenRouter teammate response
  await agentTurn(
    'engineering',
    `@noah For ${taskId}, I need confirmation: should restricted roles still see the empty-state title and description when canManageBilling is false, and should I include the legacy-threshold regression in the PR validation evidence?`,
  )

  // Workspace revision
  await request('PUT', '/api/simulation/workspace', {
    path: 'app/components/alerts-panel.tsx',
    content: validSource,
  }, { expectStatus: 201, label: `workspace save ${taskId}` })

  // Invalid source must fail checks
  const badValidate = await request('POST', '/api/workspace/validate', {
    source: brokenSource,
  }, { expectStatus: 422, label: `validate fail ${taskId}` })
  assert(`invalid source fails checks (${taskId})`, badValidate.status === 422 && badValidate.json?.passed === false, (badValidate.json?.output || '').slice(0, 120))
  report.gateTests.push({ name: `invalid checks (${taskId})`, expected: 422, actual: badValidate.status })

  // Gate: commit before checks
  const earlyCommit = await postEvent('commit_created', { message: 'too early' }, { expectStatus: 409, label: `gate: commit-before-checks ${taskId}` })
  report.gateTests.push({ name: `commit before checks (${taskId})`, expected: 409, actual: earlyCommit.status, error: earlyCommit.json?.error })
  assert(`cannot commit before checks (${taskId})`, earlyCommit.status === 409, earlyCommit.json?.error)

  const validate = await request('POST', '/api/workspace/validate', {
    source: validSource,
  }, { expectStatus: 201, label: `validate pass ${taskId}` })
  assert(`scenario checks pass (${taskId})`, validate.json?.passed === true && validate.json?.event?.type === 'checks_passed', `hash=${validate.json?.sourceHash?.slice(0, 12)} duration=${validate.json?.durationMs}ms`)

  await postEvent('commit_created', {
    message: `feat(${taskId}): protect usage-alerts empty state with canManageBilling`,
    branch: `feature/${taskId.toLowerCase()}-usage-alerts`,
    issueId: taskId,
  }, { label: `commit ${taskId}` })

  await postEvent('pull_request_opened', {
    title: `${taskId}: usage alerts empty state role guard`,
    body: `Implements ${taskId}. Protects billing CTA with canManageBilling, preserves legacy empty state, and includes validation evidence from the scenario contract tests.`,
    issueId: taskId,
  }, { label: `pr ${taskId}` })

  // Gate: approval before review response
  const earlyApproval = await postEvent('approval_granted', { reviewer: 'noah' }, { expectStatus: 409, label: `gate: approval-before-review ${taskId}` })
  report.gateTests.push({ name: `approval before review (${taskId})`, expected: 409, actual: earlyApproval.status, error: earlyApproval.json?.error })
  assert(`cannot approve before review response (${taskId})`, earlyApproval.status === 409, earlyApproval.json?.error)

  await postEvent('review_addressed', {
    summary: `Addressed Noah's request: canManageBilling now guards the billing CTA; empty state remains for restricted roles and legacy workspaces.`,
    issueId: taskId,
  }, { label: `review_addressed ${taskId}` })

  await postEvent('review_reply', {
    response: `Thanks @noah — I used the canManageBilling guard for the billing CTA, kept the explanatory empty state when the action is unavailable, and re-ran the scenario contract checks covering allowed roles, restricted roles, and the legacy threshold-less workspace. Validation output is attached in the PR checks.`,
    issueId: taskId,
  }, { label: `review_reply ${taskId}` })

  // Second teammate touch on review
  await agentTurn(
    'engineering',
    `I addressed the review on ${taskId}: canManageBilling guards the CTA, empty state preserved, and the contract tests pass for restricted roles and legacy workspaces. Ready for approval if that validation evidence is enough.`,
  )

  await postEvent('approval_granted', { reviewer: 'noah', issueId: taskId }, { label: `approval ${taskId}` })

  // Gate: short rationale rejected
  const shortRationale = await postEvent('merge_rationale_recorded', { rationale: 'looks good' }, { expectStatus: 409, label: `gate: short rationale ${taskId}` })
  report.gateTests.push({ name: `short rationale (${taskId})`, expected: 409, actual: shortRationale.status, error: shortRationale.json?.error })
  assert(`short merge rationale rejected (${taskId})`, shortRationale.status === 409, shortRationale.json?.error)

  await postEvent('merge_rationale_recorded', {
    rationale: `Safe to merge ${taskId}: role guard is enforced, legacy empty-state behavior is preserved, scenario checks passed, and review feedback was addressed with validation evidence.`,
    issueId: taskId,
  }, { label: `rationale ${taskId}` })

  // Gate: complete before merge
  const earlyComplete = await postEvent('task_completed', { issueId: taskId, level }, { expectStatus: 409, label: `gate: complete-before-merge ${taskId}` })
  report.gateTests.push({ name: `complete before merge (${taskId})`, expected: 409, actual: earlyComplete.status, error: earlyComplete.json?.error })
  assert(`cannot complete task before merge (${taskId})`, earlyComplete.status === 409, earlyComplete.json?.error)

  await postEvent('pull_request_merged', { issueId: taskId, level }, { label: `merge ${taskId}` })

  const complete = await postEvent('task_completed', { issueId: taskId, level }, { label: `task_completed ${taskId}` })
  assert(
    `task completed with evidence report (${taskId})`,
    complete.json?.event?.type === 'task_completed' && (complete.json?.taskReport?.type === 'task_report_created' || Boolean(complete.json?.taskReport)),
    `nextCycle=${complete.json?.cycle?.metadata?.taskId || 'none'} unlock=${complete.json?.unlock?.metadata?.level || 'none'}`,
  )

  const snapshot = await getEvents()
  report.progression.push({
    after: `${level}:${taskId}`,
    workflow: snapshot.workflow,
    progression: snapshot.progression,
  })
  assert(
    `workflow merged after ${taskId}`,
    snapshot.workflow?.merged === true || snapshot.progression?.completedTaskIds?.includes(taskId),
    `completed=${JSON.stringify(snapshot.progression?.completedTaskIds)} unlocked=${JSON.stringify(snapshot.progression?.unlockedLevels)} score=${snapshot.progression?.overallScore}`,
  )
  return complete.json
}

async function selectLevel(level) {
  console.log(`\n== Select scenario level: ${level} ==`)
  const { json } = await postEvent('scenario_level_selected', { level }, { label: `level:${level}` })
  assert(`selected ${level}`, json.event?.type === 'scenario_level_selected', `activeTask=${json.cycle?.metadata?.taskId || json.progression?.activeTaskId}`)
  return json
}

async function main() {
  console.log(`AIWEX end-to-end workflow simulation`)
  console.log(`Base URL: ${baseUrl}`)

  // Health
  const health = await request('GET', '/api/health', undefined, { label: 'health' })
  if (health.status >= 500) throw new Error(`Server unhealthy: ${health.status}`)
  pass('server reachable', `status=${health.status}`)

  // Start disposable onboarding demo run
  console.log('\n== 0. Demo session (onboarding=1) ==')
  const demo = await request('GET', '/demo?onboarding=1', undefined, { label: 'demo onboarding cookie' })
  const runId = cookies.get('aiwex_demo_run')
  report.runId = runId
  assert('demo cookie issued', Boolean(runId), runId || `status=${demo.status}`)
  if (!runId) throw new Error('No aiwex_demo_run cookie; is DEMO_MODE enabled?')

  await completeOnboarding()

  // Default level is basic; ensure delivery cycle for PROJ-184
  let events = await getEvents()
  if (!events.events?.some((e) => e.type === 'delivery_cycle_started' || e.type === 'scenario_level_selected')) {
    await selectLevel('basic')
  } else if (!events.events?.some((e) => e.type === 'delivery_cycle_started')) {
    await selectLevel('basic')
  } else {
    // Still record basic selection if missing so progression currentLevel is explicit
    if (!events.events.some((e) => e.type === 'scenario_level_selected')) {
      await selectLevel('basic')
    } else {
      pass('basic delivery cycle already active', events.progression?.activeTaskId || 'PROJ-184')
    }
  }

  // --- Basic ---
  for (const [index, taskId] of tasksByLevel.basic.entries()) {
    await runDeliveryCycle('basic', taskId, index + 1)
  }

  events = await getEvents()
  const unlockedAfterBasic = events.progression?.unlockedLevels || []
  assert('intermediate unlocked after basic requirements', unlockedAfterBasic.includes('intermediate'), JSON.stringify(events.progression))

  // Gate: cannot jump to advanced early
  const earlyAdvanced = await postEvent('scenario_level_selected', { level: 'advanced' }, { expectStatus: 409, label: 'gate: advanced-before-intermediate' })
  report.gateTests.push({ name: 'advanced before intermediate', expected: 409, actual: earlyAdvanced.status, error: earlyAdvanced.json?.error })
  assert('cannot start advanced before intermediate', earlyAdvanced.status === 409, earlyAdvanced.json?.error)

  // --- Intermediate ---
  await selectLevel('intermediate')
  for (const [index, taskId] of tasksByLevel.intermediate.entries()) {
    await runDeliveryCycle('intermediate', taskId, index + 1)
  }

  events = await getEvents()
  const unlockedAfterIntermediate = events.progression?.unlockedLevels || []
  assert('advanced unlocked after intermediate requirements', unlockedAfterIntermediate.includes('advanced'), JSON.stringify({
    unlocked: unlockedAfterIntermediate,
    scores: events.progression?.scores,
    overall: events.progression?.overallScore,
    requirements: events.progression?.requirements,
  }))

  // --- Advanced ---
  await selectLevel('advanced')
  for (const [index, taskId] of tasksByLevel.advanced.entries()) {
    await runDeliveryCycle('advanced', taskId, index + 1)
  }

  events = await getEvents()
  const completedAdvanced = (events.events || [])
    .filter((e) => e.type === 'task_completed' && e.metadata?.level === 'advanced')
    .map((e) => e.metadata?.issueId)
  const allAdvancedDone = tasksByLevel.advanced.every((id) => completedAdvanced.includes(id))
  assert('all advanced tasks completed', allAdvancedDone, `completed=${JSON.stringify(completedAdvanced)}`)

  // Project report may be created after first completion; ensure event ledger integrity
  const types = (events.events || []).map((e) => e.type)
  const requiredTrail = [
    'onboarding_started',
    'onboarding_profile_confirmed',
    'policy_acknowledged',
    'access_provisioned',
    'quiz_passed',
    'readiness_task_passed',
    'manager_signoff_recorded',
    'standup_posted',
    'checks_passed',
    'commit_created',
    'pull_request_opened',
    'review_addressed',
    'review_reply',
    'approval_granted',
    'merge_rationale_recorded',
    'pull_request_merged',
    'task_completed',
    'task_report_created',
    'agent_reply',
  ]
  for (const type of requiredTrail) {
    assert(`ledger includes ${type}`, types.includes(type), `count=${types.filter((t) => t === type).length}`)
  }

  report.final = {
    eventCount: events.events?.length || 0,
    progression: events.progression,
    workflow: events.workflow,
    openRouter: report.openRouter,
    completedTasks: (events.events || []).filter((e) => e.type === 'task_completed').map((e) => ({
      issueId: e.metadata?.issueId,
      level: e.metadata?.level,
    })),
  }
  report.finishedAt = new Date().toISOString()

  const passed = checks.filter((c) => c.ok).length
  const failed = checks.filter((c) => !c.ok).length
  console.log('\n== Summary ==')
  console.log(`Checks: ${passed} passed, ${failed} failed (${checks.length} total)`)
  console.log(`OpenRouter turns: ${report.openRouter.live} live / ${report.openRouter.fallback} fallback / ${report.openRouter.attempted} attempted`)
  console.log(`Events recorded: ${report.final.eventCount}`)
  console.log(`Completed tasks: ${report.final.completedTasks.map((t) => `${t.level}:${t.issueId}`).join(', ')}`)
  console.log(`Unlocked levels: ${(events.progression?.unlockedLevels || []).join(', ')}`)
  console.log(`Scores: ${JSON.stringify(events.progression?.scores)} overall=${events.progression?.overallScore}`)

  const outDir = resolve(root, 'tmp')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, 'e2e-workflow-report.json')
  writeFileSync(outPath, JSON.stringify({ report, checks }, null, 2))
  console.log(`\nFull report written to ${outPath}`)

  if (failed > 0) {
    console.log('\nFailed checks:')
    for (const item of checks.filter((c) => !c.ok)) console.log(`  - ${item.name}: ${item.detail}`)
    process.exitCode = 1
  } else {
    console.log('\nAll simulated workflow claims held under real API calls.')
  }
}

main().catch((error) => {
  console.error('\nSimulation aborted:', error instanceof Error ? error.message : error)
  try {
    const outDir = resolve(root, 'tmp')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(outDir, 'e2e-workflow-report.json'), JSON.stringify({ report, checks, fatal: String(error) }, null, 2))
  } catch { /* ignore */ }
  process.exitCode = 1
})

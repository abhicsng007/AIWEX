/**
 * High-level learner flow helpers used by HTTP e2e suites.
 */

import {
  accessIds,
  mergeRationale,
  policyIds,
  readinessAnswers,
  reviewResponse,
  standupText,
  teammateQuestion,
  trainingAnswers,
  validAlertsPanelSource,
  wrongReadinessAnswers,
} from './fixtures.mjs'

/**
 * @param {import('./client.mjs').ApiClient} client
 * @param {{ onboarding?: boolean }} [options]
 */
export async function startDemo(client, options = { onboarding: true }) {
  const path = options.onboarding === false ? '/demo' : '/demo?onboarding=1'
  const response = await client.get(path)
  if (!client.demoRunId) {
    throw new Error(`Expected aiwex_demo_run cookie after ${path} (status ${response.status})`)
  }
  return { response, runId: client.demoRunId }
}

/** @param {import('./client.mjs').ApiClient} client */
export async function completeOnboarding(client, options = { includeFailedReadiness: false }) {
  await client.post('/api/simulation/onboarding', { action: 'start' })
  await client.post('/api/simulation/onboarding', { action: 'confirm_profile' })

  for (const policyId of policyIds) {
    await client.post('/api/simulation/onboarding', { action: 'acknowledge_policy', policyId })
  }
  for (const accessId of accessIds) {
    await client.post('/api/simulation/onboarding', { action: 'provision_access', accessId })
  }

  for (let i = 0; i < Object.keys(trainingAnswers).length; i += 1) {
    const stateRes = await client.get('/api/simulation/onboarding')
    const slide = stateRes.json?.state?.currentSlide
    if (!slide) break
    const answer = trainingAnswers[slide.id]
    if (typeof answer !== 'number') throw new Error(`No training answer for slide ${slide.id}`)
    const quiz = await client.post('/api/simulation/onboarding', {
      action: 'submit_quiz',
      slideId: slide.id,
      answer,
    })
    if (!quiz.json?.correct) {
      throw new Error(`Expected correct quiz for ${slide.id}: ${quiz.json?.feedback || quiz.status}`)
    }
  }

  if (options.includeFailedReadiness) {
    const failed = await client.post('/api/simulation/onboarding', {
      action: 'submit_readiness',
      answers: wrongReadinessAnswers,
    })
    if (failed.json?.state?.phase === 'remediation') {
      await client.post('/api/simulation/onboarding', { action: 'resume_readiness' })
    }
  }

  const readiness = await client.post('/api/simulation/onboarding', {
    action: 'submit_readiness',
    answers: readinessAnswers,
  })
  if (!readiness.json?.qualified) {
    throw new Error(`Expected qualification: ${JSON.stringify(readiness.json)}`)
  }
  return readiness.json
}

/**
 * @param {import('./client.mjs').ApiClient} client
 * @param {'basic' | 'intermediate' | 'advanced'} level
 */
export async function selectLevel(client, level) {
  return client.post('/api/simulation/events', {
    type: 'scenario_level_selected',
    metadata: { level },
  })
}

/**
 * @param {import('./client.mjs').ApiClient} client
 * @param {string} type
 * @param {Record<string, unknown>} [metadata]
 */
export async function postEvent(client, type, metadata = {}) {
  return client.post('/api/simulation/events', { type, metadata })
}

/**
 * Runs one full delivery cycle through merge + task_completed.
 * @param {import('./client.mjs').ApiClient} client
 * @param {{ level: 'basic' | 'intermediate' | 'advanced', taskId: string, withAgent?: boolean }} options
 */
export async function completeDeliveryCycle(client, options) {
  const { level, taskId, withAgent = false } = options
  const steps = []

  steps.push(await postEvent(client, 'standup_posted', {
    text: standupText(taskId),
    issueId: taskId,
    level,
  }))

  steps.push(await postEvent(client, 'chat_message', {
    channelId: 'engineering',
    message: teammateQuestion(taskId),
    authorId: 'you',
  }))

  if (withAgent) {
    steps.push(await client.post('/api/simulation/agent-turns', {
      channelId: 'engineering',
      userMessage: teammateQuestion(taskId),
      channelType: 'channel',
      channelPurpose: 'Engineering delivery collaboration',
    }))
  }

  steps.push(await client.put('/api/simulation/workspace', {
    path: 'app/components/alerts-panel.tsx',
    content: validAlertsPanelSource,
  }))

  steps.push(await client.post('/api/workspace/validate', {
    source: validAlertsPanelSource,
  }))

  steps.push(await postEvent(client, 'commit_created', {
    message: `feat(${taskId}): protect usage-alerts empty state with canManageBilling`,
    branch: `feature/${taskId.toLowerCase()}-usage-alerts`,
    issueId: taskId,
  }))

  steps.push(await postEvent(client, 'pull_request_opened', {
    title: `${taskId}: usage alerts empty state role guard`,
    body: `Implements ${taskId} with canManageBilling guard and legacy empty-state coverage.`,
    issueId: taskId,
  }))

  steps.push(await postEvent(client, 'review_addressed', {
    summary: `Addressed review on ${taskId}: canManageBilling guards the billing CTA.`,
    issueId: taskId,
  }))

  steps.push(await postEvent(client, 'review_reply', {
    response: reviewResponse(taskId),
    issueId: taskId,
  }))

  steps.push(await postEvent(client, 'approval_granted', {
    reviewer: 'noah',
    issueId: taskId,
  }))

  steps.push(await postEvent(client, 'merge_rationale_recorded', {
    rationale: mergeRationale(taskId),
    issueId: taskId,
  }))

  steps.push(await postEvent(client, 'pull_request_merged', {
    issueId: taskId,
    level,
  }))

  const complete = await postEvent(client, 'task_completed', {
    issueId: taskId,
    level,
  })
  steps.push(complete)

  return { steps, complete }
}

/**
 * Prepare a qualified learner ready for project work on basic.
 * @param {import('./client.mjs').ApiClient} client
 */
export async function bootstrapQualifiedBasic(client) {
  await startDemo(client, { onboarding: true })
  await completeOnboarding(client)
  await selectLevel(client, 'basic')
  return client
}

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  accessCatalog,
  deriveOnboardingState,
  evaluateReadinessAnswers,
  policyRequirements,
  projectAccessError,
  quizAnswerFeedback,
  readinessQuestions,
  scheduleCompletionError,
  trainingSlides,
} from '../../src/features/simulator/domain/onboarding.ts'
import type { SimulationEvent } from '../../src/features/simulator/domain/types.ts'

function event(type: SimulationEvent['type'], metadata: SimulationEvent['metadata'] = {}): SimulationEvent {
  return {
    id: crypto.randomUUID(),
    organizationId: 'run-test',
    type,
    createdAt: new Date().toISOString(),
    metadata,
  }
}

const correctReadiness = Object.fromEntries(readinessQuestions.map((q) => [q.id, q.correctOption]))

describe('deriveOnboardingState', () => {
  it('starts as not_started', () => {
    assert.equal(deriveOnboardingState([]).phase, 'not_started')
  })

  it('moves through profile, policy, access, and training phases', () => {
    let events = [event('onboarding_started')]
    assert.equal(deriveOnboardingState(events).phase, 'profile')

    events = [...events, event('onboarding_profile_confirmed')]
    assert.equal(deriveOnboardingState(events).phase, 'policy')

    events = [
      ...events,
      ...policyRequirements.map((policy) => event('policy_acknowledged', { policyId: policy.id })),
    ]
    assert.equal(deriveOnboardingState(events).phase, 'access')

    events = [
      ...events,
      ...accessCatalog.map((item) => event('access_provisioned', { accessId: item.id })),
    ]
    assert.equal(deriveOnboardingState(events).phase, 'training')

    events = [
      ...events,
      ...trainingSlides.map((slide) => event('training_slide_completed', { slideId: slide.id })),
    ]
    assert.equal(deriveOnboardingState(events).phase, 'demo_task')
  })

  it('qualifies after readiness pass and manager sign-off', () => {
    const events = [
      event('onboarding_started'),
      event('onboarding_profile_confirmed'),
      ...policyRequirements.map((policy) => event('policy_acknowledged', { policyId: policy.id })),
      ...accessCatalog.map((item) => event('access_provisioned', { accessId: item.id })),
      ...trainingSlides.map((slide) => event('training_slide_completed', { slideId: slide.id })),
      event('readiness_task_passed', { score: 100 }),
      event('manager_signoff_recorded'),
      event('schedule_created', { startAt: new Date().toISOString() }),
    ]
    const state = deriveOnboardingState(events)
    assert.equal(state.phase, 'qualified')
    assert.equal(state.managerReview.status, 'approved')
    assert.ok(state.schedule.length > 0)
  })
})

describe('evaluateReadinessAnswers', () => {
  it('passes with all correct answers at score 100', () => {
    const result = evaluateReadinessAnswers(correctReadiness)
    assert.equal(result.passed, true)
    assert.equal(result.score, 100)
  })

  it('fails when score is below 80', () => {
    const wrong = Object.fromEntries(readinessQuestions.map((q) => [q.id, (q.correctOption + 1) % q.options.length]))
    const result = evaluateReadinessAnswers(wrong)
    assert.equal(result.passed, false)
    assert.equal(result.score, 0)
    assert.match(result.feedback, /Strengthen/)
  })
})

describe('quizAnswerFeedback', () => {
  it('includes Correct for right answers and the right answer when wrong', () => {
    const slide = trainingSlides[0]
    assert.match(quizAnswerFeedback(slide, true), /^Correct\./)
    assert.match(quizAnswerFeedback(slide, false), /Not quite/)
    assert.match(quizAnswerFeedback(slide, false), new RegExp(slide.options[slide.correctOption]))
  })
})

describe('projectAccessError', () => {
  it('blocks project actions before qualification', () => {
    const events = [event('onboarding_started')]
    assert.match(String(projectAccessError(events, 'standup_posted')), /onboarding/i)
    assert.match(String(projectAccessError(events, 'chat_message')), /onboarding/i)
  })

  it('allows project actions after readiness pass', () => {
    const events = [
      event('onboarding_started'),
      event('onboarding_profile_confirmed'),
      ...policyRequirements.map((policy) => event('policy_acknowledged', { policyId: policy.id })),
      ...accessCatalog.map((item) => event('access_provisioned', { accessId: item.id })),
      ...trainingSlides.map((slide) => event('training_slide_completed', { slideId: slide.id })),
      event('readiness_task_passed'),
    ]
    assert.equal(projectAccessError(events, 'standup_posted'), null)
  })
})

describe('scheduleCompletionError', () => {
  it('requires standup before manager check-in completion', () => {
    const item = {
      id: 'manager-checkin-day-1',
      title: 'Manager check-in',
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 3600_000).toISOString(),
      kind: 'ceremony' as const,
      completed: false,
      missed: false,
      extensionRequested: false,
    }
    assert.match(String(scheduleCompletionError(item, [])), /stand-up/i)
    assert.equal(scheduleCompletionError(item, [event('standup_posted')]), null)
  })

  it('requires pull request before review window completion', () => {
    const item = {
      id: 'review-window',
      title: 'Review window',
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 3600_000).toISOString(),
      kind: 'ceremony' as const,
      completed: false,
      missed: false,
      extensionRequested: false,
    }
    assert.match(String(scheduleCompletionError(item, [])), /pull request/i)
  })
})

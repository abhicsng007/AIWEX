import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { ApiClient, requireServer } from '../helpers/client.mjs'
import {
  accessIds,
  policyIds,
  readinessAnswers,
  trainingAnswers,
  wrongReadinessAnswers,
} from '../helpers/fixtures.mjs'
import { startDemo } from '../helpers/flow.mjs'

describe('onboarding academy API', () => {
  /** @type {ApiClient} */
  let client

  before(async (t) => {
    if (!(await requireServer(t))) return
    client = new ApiClient()
    await startDemo(client, { onboarding: true })
  })

  it('starts in profile phase and exposes slides without correct answers', async (t) => {
    if (!client) return t.skip('server unavailable')
    await client.post('/api/simulation/onboarding', { action: 'start' })
    const res = await client.get('/api/simulation/onboarding')
    assert.equal(res.status, 200)
    assert.equal(res.json.state.phase, 'profile')
    assert.ok(Array.isArray(res.json.slides))
    assert.ok(res.json.slides.length >= 5)
    for (const slide of res.json.slides) {
      assert.equal('correctOption' in slide, false)
    }
    for (const question of res.json.readinessQuestions || []) {
      assert.equal('correctOption' in question, false)
    }
  })

  it('enforces ordered phase transitions', async (t) => {
    if (!client) return t.skip('server unavailable')
    const earlyPolicy = await client.post('/api/simulation/onboarding', {
      action: 'acknowledge_policy',
      policyId: policyIds[0],
    })
    assert.equal(earlyPolicy.status, 409)

    await client.post('/api/simulation/onboarding', { action: 'confirm_profile' })
    let state = await client.get('/api/simulation/onboarding')
    assert.equal(state.json.state.phase, 'policy')

    for (const policyId of policyIds) {
      const res = await client.post('/api/simulation/onboarding', { action: 'acknowledge_policy', policyId })
      assert.ok(res.status === 201 || res.status === 200)
    }
    state = await client.get('/api/simulation/onboarding')
    assert.equal(state.json.state.phase, 'access')

    for (const accessId of accessIds) {
      const res = await client.post('/api/simulation/onboarding', { action: 'provision_access', accessId })
      assert.equal(res.status, 201)
    }
    state = await client.get('/api/simulation/onboarding')
    assert.equal(state.json.state.phase, 'training')
  })

  it('accepts correct training answers and rejects wrong ones with feedback', async (t) => {
    if (!client) return t.skip('server unavailable')
    const state = await client.get('/api/simulation/onboarding')
    const slide = state.json.state.currentSlide
    assert.ok(slide?.id)
    const wrongAnswer = trainingAnswers[slide.id] === 0 ? 1 : 0
    const fail = await client.post('/api/simulation/onboarding', {
      action: 'submit_quiz',
      slideId: slide.id,
      answer: wrongAnswer,
    })
    assert.equal(fail.status, 200)
    assert.equal(fail.json.correct, false)
    assert.match(String(fail.json.feedback || ''), /Not quite|correct answer/i)

    // Complete all remaining slides correctly
    for (let i = 0; i < 10; i += 1) {
      const current = await client.get('/api/simulation/onboarding')
      if (current.json.state.phase !== 'training' || !current.json.state.currentSlide) break
      const next = current.json.state.currentSlide
      const answer = trainingAnswers[next.id]
      const quiz = await client.post('/api/simulation/onboarding', {
        action: 'submit_quiz',
        slideId: next.id,
        answer,
      })
      assert.equal(quiz.json.correct, true, quiz.json.feedback)
    }
    const after = await client.get('/api/simulation/onboarding')
    assert.equal(after.json.state.phase, 'demo_task')
  })

  it('requires remediation after failed readiness, then qualifies on pass', async (t) => {
    if (!client) return t.skip('server unavailable')
    const failed = await client.post('/api/simulation/onboarding', {
      action: 'submit_readiness',
      answers: wrongReadinessAnswers,
    })
    assert.equal(failed.status, 200)
    assert.equal(failed.json.qualified, false)
    assert.ok(failed.json.score < 80)

    if (failed.json.state?.phase === 'remediation') {
      const resume = await client.post('/api/simulation/onboarding', { action: 'resume_readiness' })
      assert.equal(resume.status, 201)
    }

    const passed = await client.post('/api/simulation/onboarding', {
      action: 'submit_readiness',
      answers: readinessAnswers,
    })
    assert.equal(passed.status, 201)
    assert.equal(passed.json.qualified, true)
    assert.equal(passed.json.state.phase, 'qualified')
    assert.equal(passed.json.state.managerReview.status, 'approved')
    assert.ok((passed.json.state.schedule || []).length > 0)
  })

  it('blocks project stand-up until qualified (fresh run)', async (t) => {
    if (!client) return t.skip('server unavailable')
    const fresh = new ApiClient()
    await startDemo(fresh, { onboarding: true })
    await fresh.post('/api/simulation/onboarding', { action: 'start' })
    const blocked = await fresh.post('/api/simulation/events', {
      type: 'standup_posted',
      metadata: { text: 'too early' },
    })
    assert.equal(blocked.status, 409)
    assert.match(String(blocked.json?.error || ''), /onboarding/i)
  })
})

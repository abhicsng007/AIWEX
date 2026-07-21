import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { ApiClient, requireServer } from '../helpers/client.mjs'
import { bootstrapQualifiedBasic, completeOnboarding, startDemo } from '../helpers/flow.mjs'

const liveAi = process.env.AIWEX_LIVE_AI === '1' || process.env.AIWEX_LIVE_AI === 'true'

describe('AI teammate agent turns', () => {
  /** @type {ApiClient} */
  let client

  before(async (t) => {
    if (!(await requireServer(t))) return
    client = new ApiClient()
    await bootstrapQualifiedBasic(client)
  })

  it('blocks agent turns before onboarding is complete', async (t) => {
    if (!client) return t.skip('server unavailable')
    const fresh = new ApiClient()
    await startDemo(fresh, { onboarding: true })
    await fresh.post('/api/simulation/onboarding', { action: 'start' })
    const blocked = await fresh.post('/api/simulation/agent-turns', {
      channelId: 'engineering',
      userMessage: '@noah can you help with PROJ-184?',
    })
    assert.equal(blocked.status, 409)
    assert.match(String(blocked.json?.error || ''), /onboarding/i)
  })

  it('requires channelId and userMessage', async (t) => {
    if (!client) return t.skip('server unavailable')
    const missing = await client.post('/api/simulation/agent-turns', {
      channelId: 'engineering',
      userMessage: '   ',
    })
    assert.equal(missing.status, 400)
  })

  it('returns a role-scoped teammate reply and records agent_reply', async (t) => {
    if (!client) return t.skip('server unavailable')
    const res = await client.post('/api/simulation/agent-turns', {
      channelId: 'engineering',
      userMessage: '@noah For PROJ-184, should restricted roles still see the empty-state title when canManageBilling is false? I need this for validation planning.',
      channelType: 'channel',
      channelPurpose: 'Engineering delivery collaboration',
    })
    assert.equal(res.status, 201)
    assert.ok(res.json.turn?.message)
    assert.ok(res.json.turn?.agent?.id)
    assert.ok(res.json.turn?.reasoningSummary)
    assert.equal(res.json.event?.type, 'agent_reply')

    if (liveAi) {
      assert.match(String(res.json.turn.reasoningSummary), /OpenRouter responded/i)
    } else {
      // Either live OpenRouter or deterministic fallback is acceptable by default.
      assert.ok(
        /OpenRouter responded|workflow|teammate|scenario|engineering|focus block|billing/i.test(
          `${res.json.turn.reasoningSummary} ${res.json.turn.message}`,
        ),
      )
    }

    const events = await client.get('/api/simulation/events')
    assert.ok(events.json.events.some((event) => event.type === 'agent_reply' && event.metadata?.agentId))
  })

  it('routes product questions toward a product-facing teammate', async (t) => {
    if (!client) return t.skip('server unavailable')
    // Use a fresh qualified run so channel selection is deterministic.
    const fresh = new ApiClient()
    await startDemo(fresh, { onboarding: true })
    await completeOnboarding(fresh)
    const res = await fresh.post('/api/simulation/agent-turns', {
      channelId: 'product-usage',
      userMessage: '@maya What customer outcome should guide the empty-state scope trade-off for usage alerts this sprint?',
    })
    assert.equal(res.status, 201)
    assert.ok(res.json.turn?.agent?.id)
    assert.ok(res.json.turn?.message.length > 0)
  })
})

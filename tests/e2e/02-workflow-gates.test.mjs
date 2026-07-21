import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { ApiClient, requireServer } from '../helpers/client.mjs'
import { brokenAlertsPanelSource, mergeRationale, validAlertsPanelSource } from '../helpers/fixtures.mjs'
import { bootstrapQualifiedBasic, postEvent } from '../helpers/flow.mjs'

describe('workflow transition gates', () => {
  /** @type {ApiClient} */
  let client

  before(async (t) => {
    if (!(await requireServer(t))) return
    client = new ApiClient()
    await bootstrapQualifiedBasic(client)
  })

  it('blocks PR, commit, approval, short rationale, and early completion in order', async (t) => {
    if (!client) return t.skip('server unavailable')

    const earlyPr = await postEvent(client, 'pull_request_opened', { title: 'early' })
    assert.equal(earlyPr.status, 409)
    assert.match(String(earlyPr.json?.error || ''), /stand-up and commit/i)

    const earlyCommit = await postEvent(client, 'commit_created', { message: 'early' })
    assert.equal(earlyCommit.status, 409)
    assert.match(String(earlyCommit.json?.error || ''), /checks/i)

    const standup = await postEvent(client, 'standup_posted', {
      text: 'Yesterday: onboarding. Today: PROJ-184. Blocker: none.',
    })
    assert.equal(standup.status, 201)

    const duplicateStandup = await postEvent(client, 'standup_posted', { text: 'again' })
    assert.equal(duplicateStandup.status, 409)

    await client.put('/api/simulation/workspace', {
      path: 'app/components/alerts-panel.tsx',
      content: validAlertsPanelSource,
    })
    const checks = await client.post('/api/workspace/validate', { source: validAlertsPanelSource })
    assert.equal(checks.status, 201)

    const commit = await postEvent(client, 'commit_created', {
      message: 'feat: guard billing CTA',
      branch: 'feature/proj-184',
    })
    assert.equal(commit.status, 201)

    const pr = await postEvent(client, 'pull_request_opened', {
      title: 'PROJ-184 empty state',
      body: 'Protect billing CTA and preserve legacy empty state.',
    })
    assert.equal(pr.status, 201)

    const earlyApproval = await postEvent(client, 'approval_granted', { reviewer: 'noah' })
    assert.equal(earlyApproval.status, 409)
    assert.match(String(earlyApproval.json?.error || ''), /respond/i)

    assert.equal((await postEvent(client, 'review_addressed', { summary: 'fixed guard' })).status, 201)
    assert.equal((await postEvent(client, 'review_reply', {
      response: 'Used canManageBilling and revalidated restricted roles plus legacy empty state with scenario checks.',
    })).status, 201)
    assert.equal((await postEvent(client, 'approval_granted', { reviewer: 'noah' })).status, 201)

    const shortRationale = await postEvent(client, 'merge_rationale_recorded', { rationale: 'lgtm' })
    assert.equal(shortRationale.status, 409)

    assert.equal((await postEvent(client, 'merge_rationale_recorded', {
      rationale: mergeRationale('PROJ-184'),
    })).status, 201)

    const earlyComplete = await postEvent(client, 'task_completed', {
      issueId: 'PROJ-184',
      level: 'basic',
    })
    assert.equal(earlyComplete.status, 409)
    assert.match(String(earlyComplete.json?.error || ''), /merge/i)

    assert.equal((await postEvent(client, 'pull_request_merged', {
      issueId: 'PROJ-184',
      level: 'basic',
    })).status, 201)

    const afterMergeCommit = await postEvent(client, 'commit_created', { message: 'too late' })
    assert.equal(afterMergeCommit.status, 409)
    assert.match(String(afterMergeCommit.json?.error || ''), /already merged/i)
  })

  it('rejects invalid event types and oversized metadata', async (t) => {
    if (!client) return t.skip('server unavailable')
    const fresh = new ApiClient()
    await bootstrapQualifiedBasic(fresh)

    const badType = await fresh.post('/api/simulation/events', { type: 'not_a_real_event' })
    assert.equal(badType.status, 400)

    const huge = 'x'.repeat(130_000)
    const oversized = await fresh.post('/api/simulation/events', {
      type: 'chat_message',
      metadata: { channelId: 'engineering', message: huge },
    })
    assert.equal(oversized.status, 400)
    assert.match(String(oversized.json?.error || ''), /too large|metadata/i)
  })

  it('still rejects broken validation after standup', async (t) => {
    if (!client) return t.skip('server unavailable')
    const fresh = new ApiClient()
    await bootstrapQualifiedBasic(fresh)
    await postEvent(fresh, 'standup_posted', { text: 'Stand-up for validation gate test with enough context.' })
    const fail = await fresh.post('/api/workspace/validate', { source: brokenAlertsPanelSource })
    assert.equal(fail.status, 422)
    assert.equal(fail.json?.passed, false)
  })
})

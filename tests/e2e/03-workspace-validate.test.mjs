import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'
import { ApiClient, requireServer } from '../helpers/client.mjs'
import { brokenAlertsPanelSource, validAlertsPanelSource } from '../helpers/fixtures.mjs'
import { bootstrapQualifiedBasic, completeOnboarding, startDemo } from '../helpers/flow.mjs'

describe('workspace revisions and scenario validation', () => {
  /** @type {ApiClient} */
  let client

  before(async (t) => {
    if (!(await requireServer(t))) return
    client = new ApiClient()
    await bootstrapQualifiedBasic(client)
  })

  it('lists seeded workspace files for a qualified run', async (t) => {
    if (!client) return t.skip('server unavailable')
    const res = await client.get('/api/simulation/workspace')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.json.files))
    assert.ok(res.json.files.some((file) => file.path.includes('alerts-panel')))
  })

  it('saves a revision and returns a revision id', async (t) => {
    if (!client) return t.skip('server unavailable')
    const save = await client.put('/api/simulation/workspace', {
      path: 'app/components/alerts-panel.tsx',
      content: validAlertsPanelSource,
    })
    assert.equal(save.status, 201)
    assert.ok(save.json.file?.revisionId || save.json.event?.id)
    assert.equal(save.json.event?.type, 'workspace_revision_saved')
  })

  it('rejects unknown paths and empty source', async (t) => {
    if (!client) return t.skip('server unavailable')
    const badPath = await client.put('/api/simulation/workspace', {
      path: '../../etc/passwd',
      content: 'nope',
    })
    assert.equal(badPath.status, 400)

    const empty = await client.post('/api/workspace/validate', { source: '' })
    assert.ok(empty.status === 400 || empty.status === 422)
  })

  it('fails invalid source and passes the known-good fixture', async (t) => {
    if (!client) return t.skip('server unavailable')
    const fail = await client.post('/api/workspace/validate', { source: brokenAlertsPanelSource })
    assert.equal(fail.status, 422)
    assert.equal(fail.json.passed, false)
    assert.ok(String(fail.json.output || '').length > 0)

    const pass = await client.post('/api/workspace/validate', { source: validAlertsPanelSource })
    assert.equal(pass.status, 201)
    assert.equal(pass.json.passed, true)
    assert.equal(pass.json.event.type, 'checks_passed')
    assert.equal(pass.json.event.metadata.verified, true)
    assert.match(String(pass.json.sourceHash || ''), /^[a-f0-9]{64}$/)
  })

  it('blocks workspace save before onboarding is complete', async (t) => {
    if (!client) return t.skip('server unavailable')
    const fresh = new ApiClient()
    await startDemo(fresh, { onboarding: true })
    await fresh.post('/api/simulation/onboarding', { action: 'start' })
    const blocked = await fresh.put('/api/simulation/workspace', {
      path: 'app/components/alerts-panel.tsx',
      content: validAlertsPanelSource,
    })
    assert.equal(blocked.status, 409)
    assert.match(String(blocked.json?.error || ''), /onboarding/i)
  })

  it('detects stale baseRevisionId conflicts', async (t) => {
    if (!client) return t.skip('server unavailable')
    const fresh = new ApiClient()
    await startDemo(fresh, { onboarding: true })
    await completeOnboarding(fresh)

    const first = await fresh.put('/api/simulation/workspace', {
      path: 'app/components/alerts-panel.tsx',
      content: validAlertsPanelSource,
    })
    assert.equal(first.status, 201)
    const revisionId = first.json.file?.revisionId

    await fresh.put('/api/simulation/workspace', {
      path: 'app/components/alerts-panel.tsx',
      content: `${validAlertsPanelSource}\n// second save\n`,
    })

    if (revisionId) {
      const conflict = await fresh.put('/api/simulation/workspace', {
        path: 'app/components/alerts-panel.tsx',
        content: validAlertsPanelSource,
        baseRevisionId: revisionId,
      })
      assert.equal(conflict.status, 409)
      assert.match(String(conflict.json?.error || ''), /updated in another session|Reload/i)
    }
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildPerformanceNarrative,
  createProjectDeliveryReport,
  createTaskDeliveryReport,
  deliveryReportsFromEvents,
} from '../../src/features/simulator/domain/delivery-reports.ts'
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

function cycleEvents(issueId: string, level: 'basic' | 'intermediate' | 'advanced'): SimulationEvent[] {
  return [
    event('delivery_cycle_started', { level, taskId: issueId, sequence: 1 }),
    event('standup_posted', {
      issueId,
      level,
      text: `Yesterday: prepared ${issueId}. Today: implement, validate, and open PR. Blocker: none.`,
    }),
    event('chat_message', {
      channelId: 'engineering',
      message: `@noah For ${issueId}, confirm canManageBilling keeps restricted roles on the legacy empty state.`,
    }),
    event('workspace_revision_saved', { path: 'app/components/alerts-panel.tsx' }),
    event('checks_passed', { verified: true, sourceHash: 'abc123def456', durationMs: 420, command: 'node --test' }),
    event('commit_created', {
      issueId,
      message: `feat(${issueId}): protect usage-alerts empty state with canManageBilling`,
      branch: `feature/${issueId.toLowerCase()}-usage-alerts`,
    }),
    event('pull_request_opened', {
      issueId,
      title: `${issueId}: usage alerts empty state role guard`,
      prNumber: 482,
      branch: `feature/${issueId.toLowerCase()}-usage-alerts`,
    }),
    event('review_addressed', { issueId, summary: 'Used canManageBilling to gate the billing CTA.' }),
    event('review_reply', { response: 'Validated canManageBilling and legacy empty state with scenario checks.' }),
    event('approval_granted', { issueId, reviewer: 'noah' }),
    event('merge_rationale_recorded', { rationale: `Safe to merge ${issueId} after review and checks.` }),
    event('pull_request_merged', { issueId, level, prNumber: 482 }),
  ]
}

describe('delivery reports', () => {
  it('creates a task report from cycle evidence', () => {
    const events = cycleEvents('PROJ-184', 'basic')
    const report = createTaskDeliveryReport(events, {
      id: 'report-1',
      taskId: 'PROJ-184',
      level: 'basic',
      createdAt: new Date().toISOString(),
    })
    assert.equal(report.kind, 'task')
    assert.equal(report.taskId, 'PROJ-184')
    assert.equal(report.scenarioLevel, 'basic')
    assert.equal(report.outcome, 'completed')
    assert.ok(report.timeline.length >= 5)
    assert.ok(report.recruiterSignals.some((signal) => signal.id === 'validated_delivery'))
    assert.ok(report.summary.length > 0)
    assert.ok(report.evidenceHighlights.some((item) => /PROJ-184/.test(item)))
    const delivery = report.recruiterSignals.find((signal) => signal.id === 'validated_delivery')
    assert.ok(delivery)
    assert.equal('claim' in delivery ? delivery.claim : undefined, undefined)
    assert.ok(delivery.artifacts.some((item) => /sourceHash|Checks|Commit|PR/i.test(item)))
    assert.ok(report.timeline.some((item) => item.detail && /canManageBilling|feature\//i.test(item.detail)))
    assert.ok(!/Resume-style claim|“I shipped/i.test(JSON.stringify(report)))
  })

  it('returns null project report until the full project path is complete', () => {
    const empty = createProjectDeliveryReport([], { id: 'p1', createdAt: new Date().toISOString() })
    assert.equal(empty, null)
  })

  it('writes qualitative performance narratives without raw scores or metrics', () => {
    const events = [
      ...cycleEvents('PROJ-184', 'basic'),
      event('task_completed', { issueId: 'PROJ-184', level: 'basic' }),
      event('scenario_level_selected', { level: 'intermediate' }),
      ...cycleEvents('PROJ-191', 'intermediate'),
      event('task_completed', { issueId: 'PROJ-191', level: 'intermediate' }),
      ...cycleEvents('PROJ-189', 'intermediate'),
      event('task_completed', { issueId: 'PROJ-189', level: 'intermediate' }),
      event('scenario_level_selected', { level: 'advanced' }),
      ...cycleEvents('PROJ-203', 'advanced'),
      event('task_completed', { issueId: 'PROJ-203', level: 'advanced' }),
      ...cycleEvents('PROJ-204', 'advanced'),
      event('task_completed', { issueId: 'PROJ-204', level: 'advanced' }),
      ...cycleEvents('PROJ-205', 'advanced'),
      event('task_completed', { issueId: 'PROJ-205', level: 'advanced' }),
    ]
    const project = createProjectDeliveryReport(events, { id: 'p-final', createdAt: new Date().toISOString() })
    assert.ok(project)
    assert.ok(project.performanceNarrative)
    const narrative = project.performanceNarrative
    for (const text of Object.values(narrative)) {
      assert.ok(text.length > 80)
      assert.ok(!/\b\d+(\.\d+)?%?\b/.test(text), `narrative should not include raw numbers: ${text}`)
      assert.ok(!/score|p95|req\/s|sourceHash/i.test(text), `narrative should stay prose-only: ${text}`)
    }
    const rebuilt = buildPerformanceNarrative(events)
    assert.ok(rebuilt.workReadiness.includes('readiness') || rebuilt.workReadiness.length > 40)
  })

  it('collects task reports from ledger events', () => {
    const cycle = cycleEvents('PROJ-184', 'basic')
    const report = createTaskDeliveryReport(cycle, {
      id: 'report-1',
      taskId: 'PROJ-184',
      level: 'basic',
      createdAt: new Date().toISOString(),
    })
    const events: SimulationEvent[] = [
      ...cycle,
      event('task_completed', { issueId: 'PROJ-184', level: 'basic' }),
      event('task_report_created', { taskId: 'PROJ-184', level: 'basic', report }),
    ]
    const reports = deliveryReportsFromEvents(events)
    assert.equal(reports.length, 1)
    assert.equal(reports[0].taskId, 'PROJ-184')
    assert.equal(reports[0].kind, 'task')
  })
})

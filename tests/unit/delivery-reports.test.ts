import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
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
    event('standup_posted', { issueId, level }),
    event('checks_passed', { verified: true }),
    event('commit_created', { issueId }),
    event('pull_request_opened', { issueId }),
    event('review_addressed', { issueId }),
    event('review_reply', { response: 'Validated canManageBilling and legacy empty state with scenario checks.' }),
    event('approval_granted', { issueId }),
    event('merge_rationale_recorded', { rationale: `Safe to merge ${issueId} after review and checks.` }),
    event('pull_request_merged', { issueId, level }),
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
  })

  it('returns null project report until the full project path is complete', () => {
    const empty = createProjectDeliveryReport([], { id: 'p1', createdAt: new Date().toISOString() })
    assert.equal(empty, null)
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

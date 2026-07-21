import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  loadTestResultsFromEvents,
  meetsPerformanceTarget,
  parseLoadTestResult,
  usageDashboardLatencyScenario,
} from '../../src/features/simulator/domain/performance.ts'
import type { SimulationEvent } from '../../src/features/simulator/domain/types.ts'

describe('parseLoadTestResult', () => {
  it('accepts a valid scenario-staging result', () => {
    const parsed = parseLoadTestResult({
      scenarioId: usageDashboardLatencyScenario.id,
      environment: 'scenario-staging',
      concurrency: 100,
      durationSeconds: 60,
      p95Ms: 300,
      errorRatePercent: 0.5,
      requestsPerSecond: 80,
      notes: 'Validated after caching the usage summary endpoint for concurrent dashboard traffic.',
    })
    assert.ok(parsed.result)
    assert.equal(parsed.result?.environment, 'scenario-staging')
    assert.ok(parsed.result?.runId)
  })

  it('rejects unknown scenarios and non-staging environments', () => {
    assert.match(String(parseLoadTestResult({ scenarioId: 'other' }).error), /Unknown/i)
    assert.match(String(parseLoadTestResult({
      scenarioId: usageDashboardLatencyScenario.id,
      environment: 'production',
    }).error), /scenario-staging/i)
  })

  it('rejects short notes and invalid metrics', () => {
    assert.match(String(parseLoadTestResult({
      scenarioId: usageDashboardLatencyScenario.id,
      environment: 'scenario-staging',
      concurrency: 100,
      durationSeconds: 60,
      p95Ms: 300,
      errorRatePercent: 0.5,
      requestsPerSecond: 80,
      notes: 'too short',
    }).error), /20–1000|20-1000|characters/i)

    assert.match(String(parseLoadTestResult({
      scenarioId: usageDashboardLatencyScenario.id,
      environment: 'scenario-staging',
      concurrency: 500,
      durationSeconds: 60,
      p95Ms: 300,
      errorRatePercent: 0.5,
      requestsPerSecond: 80,
      notes: 'Validated after caching the usage summary endpoint for concurrent dashboard traffic.',
    }).error), /Concurrency/i)
  })
})

describe('meetsPerformanceTarget', () => {
  it('passes only when p95, error rate, and throughput all meet targets', () => {
    const pass = {
      scenarioId: usageDashboardLatencyScenario.id,
      runId: 'r1',
      environment: 'scenario-staging' as const,
      concurrency: 100,
      durationSeconds: 60,
      p95Ms: 400,
      errorRatePercent: 0.8,
      requestsPerSecond: 75,
      notes: 'ok',
      recordedAt: new Date().toISOString(),
    }
    assert.equal(meetsPerformanceTarget(pass), true)
    assert.equal(meetsPerformanceTarget({ ...pass, p95Ms: 900 }), false)
    assert.equal(meetsPerformanceTarget({ ...pass, errorRatePercent: 5 }), false)
    assert.equal(meetsPerformanceTarget({ ...pass, requestsPerSecond: 10 }), false)
  })
})

describe('loadTestResultsFromEvents', () => {
  it('extracts recorded load tests from the ledger', () => {
    const events: SimulationEvent[] = [{
      id: 'e1',
      organizationId: 'run',
      type: 'load_test_recorded',
      createdAt: '2026-01-01T00:00:00.000Z',
      metadata: {
        runId: 'load-1',
        concurrency: 100,
        durationSeconds: 60,
        p95Ms: 320,
        errorRatePercent: 0.4,
        requestsPerSecond: 88,
        notes: 'after fix',
      },
    }]
    const results = loadTestResultsFromEvents(events)
    assert.equal(results.length, 1)
    assert.equal(results[0].p95Ms, 320)
    assert.equal(results[0].runId, 'load-1')
  })
})

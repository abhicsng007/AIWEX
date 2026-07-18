import { assessSimulation, type AssessmentDimension } from './assessment'
import { scenarioLevelFromEvents, type ScenarioLevel } from './difficulty'
import type { SimulationEvent } from './types'

type Requirement = { label: string; complete: boolean }
export type ScenarioProgression = {
  currentLevel: ScenarioLevel
  completedTaskIds: string[]
  scores: Record<AssessmentDimension, number>
  overallScore: number
  nextLevel: Exclude<ScenarioLevel, 'advanced'> | 'advanced' | null
  requirements: Requirement[]
  unlockedLevels: ScenarioLevel[]
}

const average = (scores: Record<AssessmentDimension, number>) => Math.round(Object.values(scores).reduce((total, score) => total + score, 0) / 4)
const completionsFor = (events: SimulationEvent[], level: ScenarioLevel) => [...new Set(events.filter((event) => event.type === 'task_completed' && event.metadata?.level === level).map((event) => String(event.metadata?.issueId || '')).filter(Boolean))]

function requirementsFor(level: ScenarioLevel, events: SimulationEvent[], scores: Record<AssessmentDimension, number>, overallScore: number): Requirement[] {
  const completed = completionsFor(events, level)
  if (level === 'basic') return [
    { label: `Complete 1 Basic task through the merge gate (${completed.length}/1)`, complete: completed.length >= 1 },
    { label: `Reach overall coaching readiness of 60 (${overallScore}/60)`, complete: overallScore >= 60 },
    { label: `Reach technical and process signals of 55 (${scores.technicalExecution}/55, ${scores.processFit}/55)`, complete: scores.technicalExecution >= 55 && scores.processFit >= 55 },
  ]
  if (level === 'intermediate') return [
    { label: `Complete 2 Intermediate tasks through the merge gate (${completed.length}/2)`, complete: completed.length >= 2 },
    { label: `Reach overall coaching readiness of 70 (${overallScore}/70)`, complete: overallScore >= 70 },
    { label: `Reach technical, collaboration, and process signals of 65 (${scores.technicalExecution}/65, ${scores.collaboration}/65, ${scores.processFit}/65)`, complete: scores.technicalExecution >= 65 && scores.collaboration >= 65 && scores.processFit >= 65 },
  ]
  return []
}

export function deriveScenarioProgression(events: SimulationEvent[]): ScenarioProgression {
  const currentLevel = scenarioLevelFromEvents(events)
  const report = assessSimulation(events)
  const overallScore = average(report.scores)
  const nextLevel = currentLevel === 'basic' ? 'intermediate' : currentLevel === 'intermediate' ? 'advanced' : null
  const requirements = requirementsFor(currentLevel, events, report.scores, overallScore)
  const unlockedLevels: ScenarioLevel[] = ['basic']
  const basicRequirements = requirementsFor('basic', events, report.scores, overallScore)
  if (basicRequirements.every((item) => item.complete)) unlockedLevels.push('intermediate')
  const intermediateRequirements = requirementsFor('intermediate', events, report.scores, overallScore)
  if (unlockedLevels.includes('intermediate') && intermediateRequirements.every((item) => item.complete)) unlockedLevels.push('advanced')
  return { currentLevel, completedTaskIds: completionsFor(events, currentLevel), scores: report.scores, overallScore, nextLevel, requirements, unlockedLevels }
}

export function scenarioLevelChangeError(events: SimulationEvent[], desiredLevel: ScenarioLevel) {
  const progression = deriveScenarioProgression(events)
  if (desiredLevel === progression.currentLevel) return null
  if (desiredLevel === 'basic') return 'Scenario levels cannot move backward. Start a fresh organization to replay an earlier level.'
  if (!progression.unlockedLevels.includes(desiredLevel)) return `Complete the current level requirements before starting ${desiredLevel}.`
  if (desiredLevel === 'advanced' && progression.currentLevel !== 'intermediate') return 'Complete Intermediate before starting Advanced.'
  if (desiredLevel === 'intermediate' && progression.currentLevel !== 'basic') return 'Intermediate can only begin after Basic.'
  return null
}

export function taskCompletionError(events: SimulationEvent[], metadata: SimulationEvent['metadata']) {
  const issueId = String(metadata?.issueId || '')
  const level = metadata?.level
  if (!issueId || !['basic', 'intermediate', 'advanced'].includes(String(level))) return 'Task completion requires an assigned issue and scenario level.'
  if (level !== scenarioLevelFromEvents(events)) return 'A task can only be completed in the active scenario level.'
  if (events.some((event) => event.type === 'task_completed' && event.metadata?.issueId === issueId)) return 'This task completion was already recorded.'
  const merged = events.some((event) => event.type === 'pull_request_merged')
  if (!merged) return 'Complete the branch, review, approval, rationale, and merge gates before marking a learner task complete.'
  return null
}

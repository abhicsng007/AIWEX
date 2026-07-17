import type { SimulationEvent } from './types'

export type AssessmentDimension = 'technicalExecution' | 'collaboration' | 'ownershipReliability' | 'processFit'
export type AssessmentEvidence = { dimension: AssessmentDimension; outcome: 'positive' | 'opportunity'; title: string; detail: string; eventIds: string[] }
export type AssessmentReport = {
  generatedAt: string
  scores: Record<AssessmentDimension, number>
  evidence: AssessmentEvidence[]
  nextStep: string
  eventCount: number
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))
const event = (events: SimulationEvent[], type: SimulationEvent['type']) => events.find((item) => item.type === type)
const eventsOf = (events: SimulationEvent[], type: SimulationEvent['type']) => events.filter((item) => item.type === type)
const messageText = (item: SimulationEvent) => String(item.metadata?.message || '')
const responseText = (item: SimulationEvent) => String(item.metadata?.response || '')

function communicationQuality(text: string) {
  if (!text.trim()) return 0
  const lengthScore = text.length >= 40 && text.length <= 420 ? 14 : text.length >= 16 ? 8 : 3
  const specificity = /(because|risk|test|validate|validation|scope|trade-?off|blocked|api|customer|repro)/i.test(text) ? 8 : 0
  const questionOrMention = /\?|@[a-z0-9-]+/i.test(text) ? 5 : 0
  return lengthScore + specificity + questionOrMention
}

function elapsedMinutes(from?: SimulationEvent, to?: SimulationEvent) {
  if (!from || !to) return undefined
  return Math.max(0, (Date.parse(to.createdAt) - Date.parse(from.createdAt)) / 60_000)
}

export function assessSimulation(events: SimulationEvent[]): AssessmentReport {
  const standup = event(events, 'standup_posted')
  const checks = event(events, 'checks_passed')
  const commit = event(events, 'commit_created')
  const pullRequest = event(events, 'pull_request_opened')
  const reviewAddressed = event(events, 'review_addressed')
  const reviewReply = event(events, 'review_reply')
  const approval = event(events, 'approval_granted')
  const rationale = event(events, 'merge_rationale_recorded')
  const merge = event(events, 'pull_request_merged')
  const messages = eventsOf(events, 'chat_message')
  const agentReplies = eventsOf(events, 'agent_reply')
  const averageMessageQuality = messages.length ? messages.reduce((total, item) => total + communicationQuality(messageText(item)), 0) / messages.length : 0
  const reviewQuality = reviewReply ? communicationQuality(responseText(reviewReply)) : 0
  const reviewResponseMinutes = elapsedMinutes(pullRequest, reviewAddressed)
  const reviewWasPrompt = reviewResponseMinutes !== undefined && reviewResponseMinutes <= 60

  const technicalExecution = clamp((checks ? 24 : 0) + (commit ? 17 : 0) + (pullRequest ? 19 : 0) + (approval ? 15 : 0) + (merge ? 25 : 0))
  const collaboration = clamp(18 + Math.min(27, averageMessageQuality) + Math.min(24, reviewQuality) + (messages.some((item) => /@[a-z0-9-]+/i.test(messageText(item))) ? 12 : 0) + (agentReplies.length ? 8 : 0) + (reviewAddressed ? 11 : 0))
  const ownershipReliability = clamp(20 + (standup ? 20 : 0) + (checks ? 12 : 0) + (commit ? 13 : 0) + (reviewWasPrompt ? 18 : reviewAddressed ? 10 : 0) + (merge ? 17 : 0))
  const processFit = clamp(10 + (standup ? 13 : 0) + (checks ? 15 : 0) + (commit ? 14 : 0) + (pullRequest ? 14 : 0) + (reviewAddressed ? 12 : 0) + (approval ? 10 : 0) + (rationale ? 12 : 0))
  const evidence: AssessmentEvidence[] = []

  if (standup) evidence.push({ dimension: 'ownershipReliability', outcome: 'positive', title: 'Visible daily commitment', detail: 'You posted an async stand-up, creating a traceable commitment for your team.', eventIds: [standup.id] })
  else evidence.push({ dimension: 'ownershipReliability', outcome: 'opportunity', title: 'Stand-up is missing', detail: 'No async stand-up is recorded for this simulation. Share your plan before you begin implementation work.', eventIds: [] })
  if (checks && commit) evidence.push({ dimension: 'technicalExecution', outcome: 'positive', title: 'Validated before committing', detail: 'Branch checks were recorded before the feature-branch commit.', eventIds: [checks.id, commit.id] })
  else evidence.push({ dimension: 'technicalExecution', outcome: 'opportunity', title: 'Technical evidence is incomplete', detail: 'Run the contract checks and create a feature-branch commit to establish a technical execution trail.', eventIds: [checks?.id, commit?.id].filter(Boolean) as string[] })
  if (messages.length && averageMessageQuality >= 14) evidence.push({ dimension: 'collaboration', outcome: 'positive', title: 'Context-rich communication', detail: `Your ${messages.length} recorded message${messages.length === 1 ? '' : 's'} included enough context or a directed mention to make collaboration actionable.`, eventIds: messages.map((item) => item.id) })
  else evidence.push({ dimension: 'collaboration', outcome: 'opportunity', title: 'Make communication more actionable', detail: 'Use a mention plus a concrete question, risk, validation detail, or trade-off when you need teammate input.', eventIds: messages.map((item) => item.id) })
  if (reviewReply && reviewQuality >= 14) evidence.push({ dimension: 'collaboration', outcome: 'positive', title: 'Review feedback was addressed in writing', detail: 'Your review response included enough detail to give the reviewer a decision trail.', eventIds: [reviewReply.id] })
  else if (pullRequest) evidence.push({ dimension: 'collaboration', outcome: 'opportunity', title: 'Review response needs evidence', detail: 'Explain what changed and how you validated it before expecting approval.', eventIds: [pullRequest.id, reviewReply?.id].filter(Boolean) as string[] })
  if (rationale && merge) evidence.push({ dimension: 'processFit', outcome: 'positive', title: 'Merge followed the team gate', detail: 'The PR has an approval, a recorded rationale, and a completed merge.', eventIds: [approval?.id, rationale.id, merge.id].filter(Boolean) as string[] })
  else evidence.push({ dimension: 'processFit', outcome: 'opportunity', title: 'Process gate still open', detail: 'Complete the approval and merge-rationale steps to close the change through the organization’s process.', eventIds: [pullRequest?.id, reviewAddressed?.id, approval?.id, rationale?.id].filter(Boolean) as string[] })

  const nextStep = !standup ? 'Post your stand-up so the team can see your commitment.' : !messages.length ? 'Ask a teammate one concrete, tagged question before proceeding.' : !checks ? 'Add the required guard and run the branch checks.' : !pullRequest ? 'Open a pull request and invite review.' : !reviewReply ? 'Respond to the review with the change and validation you performed.' : !merge ? 'Record the merge rationale after approval.' : 'Choose the next prioritized work item and make your plan visible.'
  return { generatedAt: new Date().toISOString(), scores: { technicalExecution, collaboration, ownershipReliability, processFit }, evidence, nextStep, eventCount: events.length }
}

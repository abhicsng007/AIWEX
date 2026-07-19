'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SimulationEvent, SimulationEventType, SimulationMetadata } from '@/features/simulator/domain/types'
import FunctionalWorkspaceView from '@/features/simulator/components/functional-workspace-view'
import FunctionalPullRequestsView from '@/features/simulator/components/functional-pull-requests-view'
import FunctionalFeedbackView from '@/features/simulator/components/functional-feedback-view'
import FunctionalIssuesView from '@/features/simulator/components/functional-issues-view'
import FunctionalOnboardingView from '@/features/simulator/components/functional-onboarding-view'
import FunctionalCalendarView from '@/features/simulator/components/functional-calendar-view'
import FunctionalMeetingView from '@/features/simulator/components/functional-meeting-view'
import FunctionalLearnerGuideView from '@/features/simulator/components/functional-learner-guide-view'
import FunctionalTheiaWorkspaceView from '@/features/simulator/components/functional-theia-workspace-view'
import OrgActivityMap from '@/features/simulator/components/org-activity-map'
import { agentPortfolios, type AgentPortfolio } from '@/features/simulator/domain/agent-profiles'
import { seededIssues, type WorkIssue } from '@/features/simulator/domain/issues'
import { issuesForScenarioLevel, scenarioPolicies, taskIdsForScenarioLevel, type ScenarioLevel } from '@/features/simulator/domain/difficulty'
import { deriveScenarioProgression, type ScenarioProgression } from '@/features/simulator/domain/progression'
import { scenarioWorkspaceFiles, type WorkspaceFile } from '@/features/simulator/domain/workspace'
import type { ScheduleItem } from '@/features/simulator/domain/onboarding'
import { meetingForSchedule } from '@/features/simulator/domain/meetings'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import {
  Archive, ArchiveRestore, BadgeCheck,
  ArrowRight, Bell, Bot, CalendarDays, Check, ChevronDown, CircleDot, Clock3, Code2,
  Columns3, FileCode2, GitBranch, GraduationCap, Inbox, Layers3, LayoutDashboard, Lock,
  Flag, Link2, ListChecks, Pin, PinOff,
  FastForward, MessageSquare, Moon, MoreHorizontal, Paperclip, Play, Plus, Search, Send, Sun,
  FileText, Pencil, Reply, Settings2, ShieldCheck, Sparkles, TerminalSquare, Trash2, UserPlus, UsersRound, X,
} from 'lucide-react'

type View = 'guide' | 'onboarding' | 'home' | 'calendar' | 'meetings' | 'issues' | 'workspace' | 'pulls' | 'feedback' | 'team-space' | 'agent-profile'
type Toast = { id: string; title: string; message: string; tone: 'success' | 'warning'; view?: View; spaceId?: string }
type ToastOptions = Pick<Toast, 'title' | 'view' | 'spaceId'>
type SpaceType = 'project' | 'engineering' | 'release' | 'incident' | 'general'
type MessageTag = 'decision' | 'risk' | 'question' | 'handoff' | 'blocker'
type FollowUp = { id: string; sourceMessageId: number; title: string; ownerId: string; status: 'open' | 'done'; createdAt: string }
type SimulationCheckpoint = { at: number; title: string; detail: string }

const simulationCheckpoints: SimulationCheckpoint[] = [
  { at: 10 * 60, title: 'Stand-up follow-up', detail: 'Maya checks whether your plan and blockers are visible.' },
  { at: 11 * 60, title: 'Release-risk check-in', detail: 'The stakeholder update asks for any delivery risk.' },
  { at: 15 * 60, title: 'Stakeholder check-in', detail: 'The release pressure becomes visible if the PR is not open.' },
]
type TeamSpace = {
  id: string
  name: string
  unread: number
  description?: string
  purpose?: string
  spaceType?: SpaceType
  ownerId?: string
  visibility?: 'team' | 'organization' | 'restricted'
  retentionPolicy?: string
  linkedIssueIds?: string[]
  pinnedMessageIds?: number[]
  requiredMemberIds?: string[]
  memberIds?: string[]
  guidelines?: string
  archived?: boolean
}
type TeamAttachment = { name: string; size: number; type: string; path?: string; url?: string; file?: File }
type TeamMessage = { id: number; spaceId: string; author: string; role: string; initials: string; tone: string; time: string; text: string; link: string; threadId?: number; clientMessageId?: string; eventId?: string; attachment?: TeamAttachment; edited?: boolean; tags?: MessageTag[]; pinned?: boolean; acknowledgedBy?: string[]; resolved?: boolean; followUpId?: string }
type ActivityItem = { id: string; text: string }
type NotificationItem = { id: string; title: string; detail: string; view: View; spaceId?: string }
type HomeOverlay = 'none' | 'time' | 'search' | 'notifications' | 'help' | 'organization'
type ThemeMode = 'light' | 'dark' | 'system'
type WorkspaceValidation = { sourceHash: string; output: string; durationMs: number }
type LearnerProfile = { displayName: string; firstName: string; initials: string }
type CollaborationConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline'
let latestMessageId = 0

const defaultLearnerProfile: LearnerProfile = { displayName: 'Alex Morgan', firstName: 'Alex', initials: 'A' }

function learnerProfileFromUser(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null): LearnerProfile {
  const metadata = user?.user_metadata || {}
  const configuredName = [metadata.full_name, metadata.name, metadata.preferred_username, metadata.user_name, metadata.username, metadata.nickname]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
  const displayName = (configuredName || user?.email?.split('@')[0] || defaultLearnerProfile.displayName).trim()
  const nameParts = displayName.split(/\s+/).filter(Boolean)
  return {
    displayName,
    firstName: nameParts[0] || defaultLearnerProfile.firstName,
    initials: nameParts.slice(0, 2).map((part) => part[0]).join('').toUpperCase() || defaultLearnerProfile.initials,
  }
}

function shortEventText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ').slice(0, 150) : fallback
}

function simulationEventToast(event: SimulationEvent): Omit<Toast, 'id'> {
  const metadata = event.metadata || {}
  const channelId = typeof metadata.channelId === 'string' ? metadata.channelId : undefined
  const issueId = typeof metadata.issueId === 'string' ? metadata.issueId : 'A work item'
  if (event.type === 'agent_reply') {
    const agentId = typeof metadata.agentId === 'string' ? metadata.agentId : 'noah'
    const agent = agentPortfolios[agentId] || agentPortfolios.noah
    return { title: `${agent.name} sent an update`, message: shortEventText(metadata.message, 'A teammate posted a new update.'), tone: 'success', view: 'team-space', spaceId: channelId }
  }
  if (event.type === 'chat_message') return { title: 'Message sent', message: channelId ? `Your update was posted in #${channelId}.` : 'Your team update was posted.', tone: 'success', view: 'team-space', spaceId: channelId }
  const details: Partial<Record<SimulationEventType, Omit<Toast, 'id'>>> = {
    standup_posted: { title: 'Stand-up posted', message: 'Your plan is now visible to the team.', tone: 'success', view: 'home' },
    checks_passed: { title: 'Scenario checks passed', message: 'The saved workspace revision passed validation.', tone: 'success', view: 'workspace' },
    commit_created: { title: 'Commit created', message: 'Your verified branch change is ready for review.', tone: 'success', view: 'workspace' },
    pull_request_opened: { title: 'Pull request opened', message: 'Reviewers can now inspect your change.', tone: 'success', view: 'pulls' },
    review_addressed: { title: 'Review change addressed', message: 'Send a response explaining your validation.', tone: 'success', view: 'pulls' },
    review_reply: { title: 'Review response sent', message: 'Your reviewer has the context needed to continue.', tone: 'success', view: 'pulls' },
    approval_granted: { title: 'Pull request approved', message: 'Record the merge rationale to complete the gate.', tone: 'success', view: 'pulls' },
    merge_rationale_recorded: { title: 'Merge rationale recorded', message: 'The decision record is attached to this release.', tone: 'success', view: 'pulls' },
    pull_request_merged: { title: 'Pull request merged', message: 'The release branch has been updated.', tone: 'success', view: 'pulls' },
    issue_created: { title: 'Issue created', message: `${issueId} was added to the work board.`, tone: 'success', view: 'issues' },
    issue_updated: { title: 'Issue updated', message: `${issueId} has a new status or owner.`, tone: 'success', view: 'issues' },
    task_completed: { title: 'Task completed', message: `${issueId} met its delivery gate.`, tone: 'success', view: 'issues' },
    task_report_created: { title: 'Task evidence report ready', message: 'Open Feedback to review the recruiter-relevant delivery evidence.', tone: 'success', view: 'feedback' },
    project_report_created: { title: 'Final project report ready', message: 'Your completed project evidence portfolio is ready in Feedback.', tone: 'success', view: 'feedback' },
    workspace_revision_saved: { title: 'Workspace saved', message: shortEventText(metadata.path, 'Your workspace revision was saved.'), tone: 'success', view: 'workspace' },
    scenario_level_selected: { title: 'Scenario level changed', message: 'The new workflow difficulty is now active.', tone: 'success', view: 'home' },
    simulation_time_advanced: { title: 'Simulation time advanced', message: 'The next workday events are now in motion.', tone: 'success', view: 'home' },
    schedule_event_completed: { title: 'Calendar item completed', message: 'Your work calendar has been updated.', tone: 'success', view: 'calendar' },
    deadline_extension_requested: { title: 'Recovery window requested', message: 'The release channel is reviewing the deadline adjustment.', tone: 'warning', view: 'calendar' },
    deadline_extension_decided: { title: 'Recovery window decided', message: 'Check the calendar and release channel for the updated commitment.', tone: 'success', view: 'calendar' },
    deadline_missed: { title: 'Deadline missed', message: 'Open the calendar to record the recovery plan.', tone: 'warning', view: 'calendar' },
    reliability_penalty_applied: { title: 'Reliability signal updated', message: 'Repeated missed deadlines affected the simulation record.', tone: 'warning', view: 'feedback' },
    team_space_created: { title: 'Team space created', message: shortEventText(metadata.name, 'A new team space is ready.'), tone: 'success', view: 'team-space', spaceId: typeof metadata.spaceId === 'string' ? metadata.spaceId : undefined },
    team_space_updated: { title: 'Team space updated', message: shortEventText(metadata.name, 'Team-space governance was updated.'), tone: 'success', view: 'team-space', spaceId: typeof metadata.spaceId === 'string' ? metadata.spaceId : undefined },
    space_archived: { title: 'Team space archived', message: 'Use Reopen in the space header whenever it is needed again.', tone: 'success', view: 'team-space', spaceId: typeof metadata.spaceId === 'string' ? metadata.spaceId : undefined },
    followup_created: { title: 'Follow-up created', message: 'The action is now tracked in the team space.', tone: 'success', view: 'team-space', spaceId: typeof metadata.spaceId === 'string' ? metadata.spaceId : undefined },
    followup_completed: { title: 'Follow-up completed', message: 'The team action is marked done.', tone: 'success', view: 'team-space' },
    message_pinned: { title: 'Pinned context updated', message: 'The message is available from the team-space context panel.', tone: 'success', view: 'team-space', spaceId: typeof metadata.spaceId === 'string' ? metadata.spaceId : undefined },
    thread_resolved: { title: 'Thread resolved', message: 'The discussion is recorded as complete.', tone: 'success', view: 'team-space', spaceId: typeof metadata.spaceId === 'string' ? metadata.spaceId : undefined },
    chat_message_edited: { title: 'Message edited', message: 'Your team update was revised.', tone: 'success', view: 'team-space' },
    chat_message_deleted: { title: 'Message deleted', message: 'The team update was removed.', tone: 'success', view: 'team-space' },
  }
  return details[event.type] || { title: 'Simulation update', message: event.type.replace(/_/g, ' ') + ' was recorded.', tone: 'success', view: 'feedback' }
}

function createMessageId() {
  latestMessageId = Math.max(Date.now(), latestMessageId + 1)
  return latestMessageId
}

function sameTeamMessage(item: TeamMessage, next: Pick<TeamMessage, 'spaceId' | 'author' | 'text'> & { threadId?: number; clientMessageId?: string; eventId?: string }) {
  if (next.eventId && item.eventId === next.eventId) return true
  if (next.clientMessageId && item.clientMessageId === next.clientMessageId) return true
  return item.spaceId === next.spaceId && item.author === next.author && item.text === next.text && (item.threadId || 0) === (next.threadId || 0)
}

function appendTeamMessage(items: TeamMessage[], next: TeamMessage) {
  return items.some((item) => sameTeamMessage(item, next)) ? items : [...items, next]
}

function dedupeTeamMessages(items: TeamMessage[]) {
  return items.reduce<TeamMessage[]>((unique, item) => appendTeamMessage(unique, item), [])
}

const avatars: Record<string, string> = {
  maya: 'M', noah: 'N', adele: 'A', marcus: 'M', devon: 'D', you: 'Y',
}

const mentionOptions = [
  { id: 'maya', username: 'maya', label: 'Maya Chen', role: 'Product Manager', tone: 'violet' },
  { id: 'noah', username: 'noah', label: 'Noah Patel', role: 'Tech Lead', tone: 'mint' },
  { id: 'adele', username: 'adele', label: 'Adele Okafor', role: 'Designer', tone: 'orange' },
  { id: 'devon', username: 'devon', label: 'Devon Reeves', role: 'Engineer', tone: 'blue' },
  { id: 'you', username: 'alex', label: 'Alex Morgan', role: 'You', tone: 'blue' },
]

const tagLabels: Record<MessageTag, string> = {
  decision: 'Decision',
  risk: 'Risk',
  question: 'Question',
  handoff: 'Handoff',
  blocker: 'Blocker',
}

const spaceBlueprints: Record<string, Partial<TeamSpace>> = {
  'product-usage': {
    spaceType: 'project', ownerId: 'maya', visibility: 'team', retentionPolicy: 'Project record - retain decisions and handoffs',
    purpose: 'Coordinate product decisions, sprint risks, and customer-impact tradeoffs for usage alerts.',
    linkedIssueIds: ['PROJ-184', 'PROJ-191'], pinnedMessageIds: [2], requiredMemberIds: ['maya', 'noah', 'you'],
    guidelines: 'Use this space for decisions, cross-functional questions, customer-impact context, and sprint handoffs.',
  },
  engineering: {
    spaceType: 'engineering', ownerId: 'noah', visibility: 'team', retentionPolicy: 'Engineering record - retain technical decisions',
    purpose: 'Discuss implementation constraints, API contracts, validation evidence, and technical blockers.',
    linkedIssueIds: ['PROJ-176', 'PROJ-184', 'PROJ-189'], pinnedMessageIds: [], requiredMemberIds: ['noah', 'devon', 'you'],
    guidelines: 'Keep technical assumptions explicit. Use threads for investigation details and mark final calls as decisions.',
  },
  releases: {
    spaceType: 'release', ownerId: 'maya', visibility: 'organization', retentionPolicy: 'Release record - retain rollout decisions',
    purpose: 'Coordinate launch readiness, approval status, release risk, and rollout communication.',
    linkedIssueIds: ['PROJ-184'], pinnedMessageIds: [5], requiredMemberIds: ['maya', 'noah', 'you'],
    guidelines: 'Post only release-relevant updates, risks, approval state, and rollout rationale.',
  },
}

function normalizeTeamSpace(space: TeamSpace): TeamSpace {
  const blueprint = spaceBlueprints[space.id] || {}
  const requiredMemberIds = space.requiredMemberIds || blueprint.requiredMemberIds || ['you']
  const memberIds = [...new Set([...(space.memberIds || blueprint.memberIds || ['maya', 'noah', 'devon', 'you']), ...requiredMemberIds])]
  return {
    ...space,
    ...blueprint,
    ...space,
    spaceType: space.spaceType || blueprint.spaceType || 'general',
    ownerId: space.ownerId || blueprint.ownerId || 'maya',
    visibility: space.visibility || blueprint.visibility || 'team',
    retentionPolicy: space.retentionPolicy || blueprint.retentionPolicy || 'Working record - retain decisions and follow-ups',
    purpose: space.purpose || blueprint.purpose || space.description || 'A focused space for decisions, updates, and working context.',
    linkedIssueIds: space.linkedIssueIds || blueprint.linkedIssueIds || [],
    pinnedMessageIds: space.pinnedMessageIds || blueprint.pinnedMessageIds || [],
    requiredMemberIds,
    memberIds,
    guidelines: space.guidelines || blueprint.guidelines || 'Keep decisions discoverable, use threads for focused work, and mark follow-ups when ownership is needed.',
    archived: Boolean(space.archived),
  }
}

const initialMessages: Omit<TeamMessage, 'spaceId'>[] = [
  { id: 1, author: 'Maya Chen', role: 'Product Manager', initials: 'M', tone: 'violet', time: '9:12 AM', text: 'Morning team - we need the usage-alerts experience ready for the Pro plan review. @you, I moved the empty state ticket into this sprint. Please check the acceptance criteria before you start.', link: 'PROJ-184', tags: ['handoff'] },
  { id: 2, author: 'Noah Patel', role: 'Tech Lead', initials: 'N', tone: 'mint', time: '9:18 AM', text: 'A quick heads up: the billing events API is still fragile. Do not assume `threshold` is always present; we have older workspaces in production.', link: '', tags: ['risk'], pinned: true },
  { id: 3, author: 'Adele Okafor', role: 'Product Designer', initials: 'A', tone: 'orange', time: '9:26 AM', text: 'I dropped annotated states in the handoff doc. The empty state should feel calm, not like an error. Happy to answer questions before you implement.', link: 'Design handoff' },
]

const initialSpaces: TeamSpace[] = [
  normalizeTeamSpace({ id: 'product-usage', name: 'product-usage', unread: 3, description: 'Coordinate the product-usage initiative, handoffs, and customer-impact decisions.', memberIds: ['maya', 'noah', 'adele', 'devon', 'you'] }),
  normalizeTeamSpace({ id: 'engineering', name: 'engineering', unread: 0, description: 'Discuss implementation details, system health, and technical decisions.', memberIds: ['maya', 'noah', 'devon', 'you'] }),
  normalizeTeamSpace({ id: 'releases', name: 'releases', unread: 0, description: 'Coordinate launch risks, release status, and rollout decisions.', memberIds: ['maya', 'noah', 'devon', 'you'] }),
]

const seedMessages: TeamMessage[] = [
  ...initialMessages.map((message) => ({ ...message, spaceId: 'product-usage' })),
  { id: 4, spaceId: 'engineering', author: 'Devon Reeves', role: 'Peer Engineer', initials: 'D', tone: 'blue', time: '8:47 AM', text: 'I am investigating the dashboard chart tooltip issue. I will post an update before lunch.', link: 'PROJ-189', tags: ['handoff'] },
  { id: 5, spaceId: 'releases', author: 'Maya Chen', role: 'Product Manager', initials: 'M', tone: 'violet', time: 'Yesterday', text: 'Sprint 2 scope is locked. Please flag release risks early in this channel.', link: '', tags: ['decision'], pinned: true },
]

const code = `import { EmptyState } from './empty-state'

type UsageAlert = { id: string; currentUsage: number }

/** Intentional learner task: restrict the billing-management link by role. */
export function AlertsPanel({ alerts }: { alerts: UsageAlert[] }) {
  if (!alerts.length) {
    return <EmptyState
      title="No usage alerts yet"
      description="We'll let you know when your workspace is close to a limit."
      action={<a href="/settings/billing">Review your plan</a>}
    />
  }

  return <ul>{alerts.map((alert) => <li key={alert.id}>Usage is {alert.currentUsage}</li>)}</ul>
}`

function Avatar({ id, tone = 'navy', small = false, initials }: { id: string; tone?: string; small?: boolean; initials?: string }) {
  return <span className={`avatar ${tone} ${small ? 'small' : ''}`}>{initials || avatars[id] || id.slice(0, 1)}</span>
}

function MessageText({ text, openAgentPortfolio }: { text: string; openAgentPortfolio: (id: string) => void }) {
  return <>{text.split(/(@[a-z0-9-]+)/gi).map((part, index) => {
    const option = mentionOptions.find((item) => `@${item.username}`.toLowerCase() === part.toLowerCase())
    if (!option) return <span key={`${part}-${index}`}>{part}</span>
    return option.id === 'you' ? <span className="mention-chip self-mention" key={`${part}-${index}`}>{part}</span> : <button className="mention-chip" key={`${part}-${index}`} onClick={() => openAgentPortfolio(option.id)}>{part}</button>
  })}</>
}

function MentionComposer({ draft, setDraft, sendMessage, placeholder, className }: { draft: string; setDraft: (value: string) => void; sendMessage: (attachment?: TeamAttachment) => void; placeholder: string; className: string }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [attachment, setAttachment] = useState<TeamAttachment | null>(null)
  const match = draft.match(/@([a-z0-9-]*)$/i)
  const suggestions = match ? mentionOptions.filter((option) => option.username.startsWith(match[1].toLowerCase()) || option.label.toLowerCase().includes(match[1].toLowerCase())) : []
  const insertMention = (username: string) => setDraft(draft.replace(/@[a-z0-9-]*$/i, `@${username} `))
  const submit = () => { sendMessage(attachment || undefined); setAttachment(null); if (fileInput.current) fileInput.current.value = '' }
  return <div className={`${className} mention-composer`}><input ref={fileInput} className="attachment-input" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) setAttachment({ name: file.name, size: file.size, type: file.type || 'file', file }) }} /><button type="button" onClick={() => fileInput.current?.click()} aria-label="Attach a file"><Paperclip size={17} /></button><div className="mention-input-wrap"><input className="message-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { if (suggestions.length) insertMention(suggestions[0].username); else submit() } }} placeholder={placeholder}/>{attachment && <div className="attachment-chip"><FileText size={12} /> {attachment.name}<button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment"><X size={11} /></button></div>}{suggestions.length > 0 && <div className="mention-menu">{suggestions.map((option) => <button type="button" key={option.id} onMouseDown={(event) => { event.preventDefault(); insertMention(option.username) }}><Avatar id={option.id === 'you' ? 'you' : option.id} tone={option.tone} small /><span><b>{option.label}</b><small>@{option.username} · {option.role}</small></span></button>)}</div>}</div><button className="send-button" type="button" onClick={submit} aria-label="Send message"><Send size={16} /></button></div>
}

function ScoreRing({ score, label, accent }: { score: number; label: string; accent: string }) {
  return <div className="score-block">
    <div className="score-ring" style={{ '--score': `${score * 3.6}deg`, '--accent': accent } as React.CSSProperties}>
      <strong>{score}</strong>
    </div>
    <span>{label}</span>
  </div>
}

function App() {
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [runError, setRunError] = useState('')
  const [view, setView] = useState<View>('home')
  const [messages, setMessages] = useState<TeamMessage[]>(seedMessages)
  const [teamSpaces, setTeamSpaces] = useState<TeamSpace[]>(initialSpaces)
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [selectedSpaceId, setSelectedSpaceId] = useState('product-usage')
  const [newSpaceName, setNewSpaceName] = useState('')
  const [isAddingSpace, setIsAddingSpace] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState('noah')
  const [draft, setDraft] = useState('')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [standupDone, setStandupDone] = useState(false)
  const [testsPassed, setTestsPassed] = useState(false)
  const [committed, setCommitted] = useState(false)
  const [prOpen, setPrOpen] = useState(false)
  const [reviewAddressed, setReviewAddressed] = useState(false)
  const [reviewReplied, setReviewReplied] = useState(false)
  const [approved, setApproved] = useState(false)
  const [merged, setMerged] = useState(false)
  const [showCeremony, setShowCeremony] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [workspaceCode, setWorkspaceCode] = useState(code)
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>(scenarioWorkspaceFiles)
  const [workspaceSurface, setWorkspaceSurface] = useState<'built-in' | 'theia'>('built-in')
  const [workspaceValidation, setWorkspaceValidation] = useState<WorkspaceValidation | null>(null)
  const [issues, setIssues] = useState<WorkIssue[]>(seededIssues)
  const [scenarioLevel, setScenarioLevel] = useState<ScenarioLevel>('basic')
  const [liveEvents, setLiveEvents] = useState<SimulationEvent[]>([])
  const [collaborationConnection, setCollaborationConnection] = useState<CollaborationConnectionState>('connecting')
  const [collaborationLastSyncedAt, setCollaborationLastSyncedAt] = useState<string | null>(null)
  const [simulationMinutes, setSimulationMinutes] = useState(9 * 60 + 42)
  const [isAdvancingTime, setIsAdvancingTime] = useState(false)
  const [homeOverlay, setHomeOverlay] = useState<HomeOverlay>('none')
  const [searchQuery, setSearchQuery] = useState('')
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([])
  const [onboardingQualified, setOnboardingQualified] = useState(false)
  const [calendarSchedule, setCalendarSchedule] = useState<ScheduleItem[]>([])
  const [calendarSimulationNow, setCalendarSimulationNow] = useState(() => new Date().toISOString())
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [learnerProfile, setLearnerProfile] = useState<LearnerProfile>(defaultLearnerProfile)
  const backendWarningShown = useRef(false)
  const advancingTimeRef = useRef(false)
  const seenSimulationEventIds = useRef(new Set<string>())
  const announcedSimulationEventIds = useRef(new Set<string>())

  useEffect(() => {
    if (!organizationId) return
    const saved = localStorage.getItem(`shiftline-progress:${organizationId}`)
    if (saved) {
      const state = JSON.parse(saved) as { standupDone: boolean; testsPassed: boolean; committed: boolean; prOpen: boolean; reviewAddressed: boolean; reviewReplied?: boolean; approved?: boolean; merged?: boolean; activity: Array<ActivityItem | string>; workspaceCode?: string; messages?: TeamMessage[]; teamSpaces?: TeamSpace[]; followUps?: FollowUp[]; selectedSpaceId?: string; issues?: WorkIssue[]; simulationMinutes?: number; readNotificationIds?: string[]; scenarioLevel?: ScenarioLevel }
      setStandupDone(state.standupDone); setTestsPassed(state.testsPassed); setCommitted(state.committed)
      setPrOpen(state.prOpen); setReviewAddressed(state.reviewAddressed); setReviewReplied(state.reviewReplied || false); setApproved(state.approved || false); setMerged(state.merged || false); setActivity((state.activity || []).map((item, index) => typeof item === 'string' ? { id: `legacy-${index}-${item}`, text: item } : item)); setWorkspaceCode(state.workspaceCode || code); setMessages(dedupeTeamMessages(state.messages || seedMessages)); setTeamSpaces((state.teamSpaces || initialSpaces).map(normalizeTeamSpace)); setFollowUps(state.followUps || []); setSelectedSpaceId(state.selectedSpaceId || 'product-usage'); setIssues(state.issues || seededIssues); setSimulationMinutes(state.simulationMinutes || 9 * 60 + 42); setReadNotificationIds(state.readNotificationIds || []); setScenarioLevel(state.scenarioLevel || 'basic')
    }
  }, [organizationId])

  useEffect(() => {
    if (!organizationId) return
    const loadWorkspace = async () => {
      const response = await fetch(`/api/simulation/workspace?organizationId=${encodeURIComponent(organizationId)}`, { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json() as { files?: WorkspaceFile[] }
      if (!data.files?.length) return
      setWorkspaceFiles(data.files)
      const alertsPanel = data.files.find((file) => file.path === 'app/components/alerts-panel.tsx')
      if (alertsPanel) setWorkspaceCode(alertsPanel.content)
    }
    void loadWorkspace()
  }, [organizationId])

  useEffect(() => {
    const loadRun = async () => {
      try {
        const response = await fetch('/api/simulation/run', { cache: 'no-store' })
        const data = await response.json() as { run?: { id?: string }; error?: string }
        if (!response.ok || !data.run?.id) { setRunError(data.error || 'Your private simulation run could not be loaded.'); return }
        setOrganizationId(data.run.id)
      } catch { setRunError('Your private simulation run could not be loaded.') }
    }
    void loadRun()
  }, [])

  useEffect(() => {
    const savedTheme = localStorage.getItem('aiwex-theme') as ThemeMode | null
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') setThemeMode(savedTheme)
  }, [])

  useEffect(() => {
    const supabase = getSupabaseBrowser()
    if (!supabase) return
    const applyUser = (user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) => setLearnerProfile(learnerProfileFromUser(user))
    void supabase.auth.getUser().then(({ data }) => applyUser(data.user))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => applyUser(session?.user || null))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      const resolved = themeMode === 'system' ? (media.matches ? 'dark' : 'light') : themeMode
      document.documentElement.dataset.theme = resolved
      setResolvedTheme(resolved)
    }
    applyTheme()
    if (themeMode === 'system') media.addEventListener('change', applyTheme)
    localStorage.setItem('aiwex-theme', themeMode)
    return () => media.removeEventListener('change', applyTheme)
  }, [themeMode])

  useEffect(() => {
    if (!organizationId) return
    const loadOnboarding = async () => {
      try {
        const response = await fetch(`/api/simulation/onboarding?organizationId=${encodeURIComponent(organizationId)}`, { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json() as { state: { phase: string } }
        const qualified = data.state.phase === 'qualified'
        setOnboardingQualified(qualified)
        if (!qualified) setView('onboarding')
      } catch { /* The existing backend warning will surface if persistence is unavailable. */ }
    }
    void loadOnboarding()
  }, [organizationId])

  useEffect(() => {
    if (!onboardingQualified || !organizationId) return
    const checkDeadlines = () => {
      void fetch('/api/simulation/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, action: 'check_deadlines' }),
      })
    }
    checkDeadlines()
    const timer = window.setInterval(checkDeadlines, 60_000)
    return () => window.clearInterval(timer)
  }, [onboardingQualified, organizationId])

  useEffect(() => {
    if (!onboardingQualified || !organizationId) {
      setCalendarSchedule([])
      return
    }
    const loadCalendar = async () => {
      try {
        const response = await fetch('/api/simulation/schedule?organizationId=' + encodeURIComponent(organizationId), { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json() as { schedule?: ScheduleItem[]; simulationNow?: string }
        setCalendarSchedule(data.schedule || [])
        if (data.simulationNow) setCalendarSimulationNow(data.simulationNow)
      } catch { /* The schedule remains available again on the next refresh. */ }
    }
    void loadCalendar()
    const timer = window.setInterval(() => { void loadCalendar() }, 30_000)
    return () => window.clearInterval(timer)
  }, [onboardingQualified, organizationId])

  useEffect(() => {
    if (!organizationId) return
    localStorage.setItem(`shiftline-progress:${organizationId}`, JSON.stringify({ standupDone, testsPassed, committed, prOpen, reviewAddressed, reviewReplied, approved, merged, activity, workspaceCode, messages, teamSpaces, followUps, selectedSpaceId, issues, simulationMinutes, readNotificationIds, scenarioLevel }))
  }, [organizationId, standupDone, testsPassed, committed, prOpen, reviewAddressed, reviewReplied, approved, merged, activity, workspaceCode, messages, teamSpaces, followUps, selectedSpaceId, issues, simulationMinutes, readNotificationIds, scenarioLevel])

  const resetDeliveryWorkflow = () => {
    setStandupDone(false)
    setTestsPassed(false)
    setCommitted(false)
    setPrOpen(false)
    setReviewAddressed(false)
    setReviewReplied(false)
    setApproved(false)
    setMerged(false)
    setWorkspaceValidation(null)
    setShowCeremony(false)
  }

  useEffect(() => {
    const ingest = (event: SimulationEvent, announce = false) => {
      if (seenSimulationEventIds.current.has(event.id)) return
      seenSimulationEventIds.current.add(event.id)
      setLiveEvents((events) => events.some((item) => item.id === event.id) ? events : [...events, event])
      const metadata = event.metadata || {}
      const channelId = typeof metadata.channelId === 'string' ? metadata.channelId : ''
      const text = typeof metadata.message === 'string' ? metadata.message : ''
      const clientMessageId = typeof metadata.clientMessageId === 'string' ? metadata.clientMessageId : undefined
      const threadId = typeof metadata.threadId === 'number' ? metadata.threadId : typeof metadata.threadId === 'string' && metadata.threadId ? Number(metadata.threadId) : undefined
      if (event.type === 'chat_message' && channelId && text) {
        const attachment = typeof metadata.attachmentName === 'string' ? { name: metadata.attachmentName, size: Number(metadata.attachmentSize || 0), type: String(metadata.attachmentType || 'file'), path: typeof metadata.attachmentPath === 'string' ? metadata.attachmentPath : undefined } : undefined
        setMessages((items) => appendTeamMessage(items, { id: clientMessageId ? Number(clientMessageId) : Date.parse(event.createdAt), spaceId: channelId, author: 'You', role: 'Full-stack Engineer', initials: 'Y', tone: 'blue', time: 'now', text: text === '(attachment)' ? '' : text, link: '', threadId, clientMessageId, eventId: event.id, attachment }))
      }
      if (event.type === 'agent_reply' && channelId && text) {
        const agentId = typeof metadata.agentId === 'string' ? metadata.agentId : 'noah'
        const agent = agentPortfolios[agentId] || agentPortfolios.noah
        setMessages((items) => appendTeamMessage(items, { id: Date.parse(event.createdAt) + 1, spaceId: channelId, author: agent.name, role: agent.role, initials: agent.initials, tone: agent.tone, time: 'now', text, link: '', threadId, eventId: event.id }))
      }
      const revisionPath = typeof metadata.path === 'string' ? metadata.path : null
      const revisionContent = typeof metadata.content === 'string' ? metadata.content : null
      if (event.type === 'workspace_revision_saved' && revisionPath === 'app/components/alerts-panel.tsx' && revisionContent !== null) {
        setWorkspaceCode(revisionContent)
      }
      if (event.type === 'workspace_revision_saved' && revisionPath && revisionContent !== null) {
        setWorkspaceFiles((files) => files.map((file) => file.path === revisionPath ? { ...file, content: revisionContent, updatedAt: event.createdAt, revisionId: event.id } : file))
      }
      if (event.type === 'standup_posted') setStandupDone(true)
      if (event.type === 'checks_passed') setTestsPassed(true)
      if (event.type === 'commit_created') setCommitted(true)
      if (event.type === 'pull_request_opened') setPrOpen(true)
      if (event.type === 'review_addressed') setReviewAddressed(true)
      if (event.type === 'review_reply') setReviewReplied(true)
      if (event.type === 'approval_granted') setApproved(true)
      if (event.type === 'pull_request_merged') setMerged(true)
      if (event.type === 'delivery_cycle_started') resetDeliveryWorkflow()
      if (event.type === 'simulation_time_advanced' && Number.isFinite(Number(metadata.to))) setSimulationMinutes(Number(metadata.to))
      if (event.type === 'scenario_level_selected' && (metadata.level === 'basic' || metadata.level === 'intermediate' || metadata.level === 'advanced')) setScenarioLevel(metadata.level)
      if (event.type === 'team_space_created' && typeof metadata.spaceId === 'string' && typeof metadata.name === 'string') {
        setTeamSpaces((spaces) => spaces.some((space) => space.id === metadata.spaceId) ? spaces : [...spaces, normalizeTeamSpace({ id: metadata.spaceId as string, name: metadata.name as string, unread: 1, description: 'A focused space for decisions, updates, and working context.', memberIds: ['maya', 'noah', 'devon', 'you'] })])
      }
      if (event.type === 'team_space_updated' && typeof metadata.spaceId === 'string' && typeof metadata.name === 'string') setTeamSpaces((spaces) => spaces.map((space) => space.id === metadata.spaceId ? { ...space, name: metadata.name as string } : space))
      const eventSpace = metadata.space
      if ((event.type === 'team_space_created' || event.type === 'team_space_updated') && eventSpace && typeof eventSpace === 'object' && typeof (eventSpace as { id?: unknown }).id === 'string' && typeof (eventSpace as { name?: unknown }).name === 'string') {
        const normalized = normalizeTeamSpace(eventSpace as TeamSpace)
        setTeamSpaces((spaces) => event.type === 'team_space_created' ? spaces.some((space) => space.id === normalized.id) ? spaces : [...spaces, normalized] : spaces.map((space) => space.id === normalized.id ? normalized : space))
      }
      const eventIssue = metadata.issue
      if ((event.type === 'issue_created' || event.type === 'issue_updated') && eventIssue && typeof eventIssue === 'object' && typeof (eventIssue as { id?: unknown }).id === 'string') {
        const issue = eventIssue as WorkIssue
        setIssues((items) => event.type === 'issue_created' ? items.some((item) => item.id === issue.id) ? items : [...items, issue] : items.map((item) => item.id === issue.id ? issue : item))
      }
      const eventFollowUp = metadata.followUp
      if (event.type === 'followup_created' && eventFollowUp && typeof eventFollowUp === 'object' && typeof (eventFollowUp as { id?: unknown }).id === 'string') {
        const followUp = eventFollowUp as FollowUp
        setFollowUps((items) => items.some((item) => item.id === followUp.id) ? items : [...items, followUp])
      }
      if (event.type === 'followup_completed' && typeof metadata.followUpId === 'string') setFollowUps((items) => items.map((item) => item.id === metadata.followUpId ? { ...item, status: 'done' } : item))
      if (announce) announceSimulationEvent(event)
    }
    if (!organizationId) {
      setCollaborationConnection('offline')
      return
    }
    setCollaborationConnection('connecting')
    const source = new EventSource(`/api/simulation/events/stream?organizationId=${encodeURIComponent(organizationId)}`)
    const markSynced = () => {
      setCollaborationConnection('live')
      setCollaborationLastSyncedAt(new Date().toISOString())
    }
    source.onopen = markSynced
    source.onerror = () => setCollaborationConnection(window.navigator.onLine ? 'reconnecting' : 'offline')
    source.addEventListener('snapshot', (message) => {
      const events = JSON.parse((message as MessageEvent<string>).data) as SimulationEvent[]
      events.forEach((event) => ingest(event, false))
      markSynced()
    })
    source.addEventListener('simulation-event', (message) => {
      ingest(JSON.parse((message as MessageEvent<string>).data) as SimulationEvent, true)
      markSynced()
    })
    source.addEventListener('sync', markSynced)
    source.addEventListener('backend-error', (message) => {
      setCollaborationConnection('reconnecting')
      if (!backendWarningShown.current) {
        backendWarningShown.current = true
        const payload = JSON.parse((message as MessageEvent<string>).data) as { code?: string }
        notify(payload.code === 'BACKEND_SCHEMA_UNAVAILABLE' ? 'Supabase schema is not ready. Run the simulator migration, then restart the dev server.' : 'Live updates are delayed. Showing saved activity while the collaboration connection recovers.', 'warning')
      }
    })
    const refreshFromLedger = async () => {
      try {
        const response = await fetch(`/api/simulation/events?organizationId=${encodeURIComponent(organizationId)}`, { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json() as { events?: SimulationEvent[] }
        data.events?.forEach((event) => ingest(event, true))
        setCollaborationLastSyncedAt(new Date().toISOString())
      } catch { setCollaborationConnection(window.navigator.onLine ? 'reconnecting' : 'offline') }
    }
    const handleOnline = () => setCollaborationConnection('reconnecting')
    const handleOffline = () => setCollaborationConnection('offline')
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    const ledgerTimer = window.setInterval(() => { void refreshFromLedger() }, 15_000)
    return () => {
      source.close()
      window.clearInterval(ledgerTimer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [organizationId])

  useEffect(() => {
    const pulse = async () => {
      if (!organizationId) return
      const response = await fetch('/api/simulation/pulse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId }) })
      if (response.status === 503 && !backendWarningShown.current) { backendWarningShown.current = true; notify('Supabase schema is not ready. Run the simulator migration, then restart the dev server.', 'warning') }
    }
    pulse()
    const timer = window.setInterval(pulse, 20000)
    return () => window.clearInterval(timer)
  }, [organizationId])

  const progress = useMemo(() => [standupDone, testsPassed, committed, prOpen, reviewAddressed].filter(Boolean).length, [standupDone, testsPassed, committed, prOpen, reviewAddressed])
  const scenarioProgression = useMemo(() => deriveScenarioProgression(liveEvents), [liveEvents])
  const selectedSpace = teamSpaces.find((space) => space.id === selectedSpaceId) || teamSpaces[0]
  const activeMessages = useMemo(() => dedupeTeamMessages(messages.filter((message) => message.spaceId === selectedSpaceId)), [messages, selectedSpaceId])
  const selectedAgent = agentPortfolios[selectedAgentId] || agentPortfolios.noah
  const scheduleNotifications = useMemo<NotificationItem[]>(() => {
    const now = Date.parse(calendarSimulationNow)
    const currentTime = Number.isFinite(now) ? now : Date.now()
    return calendarSchedule
      .filter((item) => !item.completed)
      .map((item) => {
        if (item.missed) return { id: 'calendar-missed-' + item.id, title: 'Missed: ' + item.title, detail: 'Open Calendar to record and communicate the recovery plan.', view: 'calendar' as View, priority: 0 }
        const startsAt = Date.parse(item.startsAt)
        const endsAt = Date.parse(item.endsAt)
        const minutesUntil = Math.ceil((startsAt - currentTime) / 60_000)
        if (currentTime >= startsAt && currentTime <= endsAt) return { id: 'calendar-now-' + item.id, title: 'Now: ' + item.title, detail: item.kind === 'ceremony' ? 'The conference room is ready for this team meeting.' : 'This scheduled work block is in progress.', view: item.kind === 'ceremony' ? 'meetings' as View : 'calendar' as View, priority: 1 }
        if (minutesUntil > 0 && minutesUntil <= 30) return { id: 'calendar-soon-' + item.id, title: item.title + ' starts soon', detail: 'Starts in ' + minutesUntil + ' min. Open Calendar for context and actions.', view: 'calendar' as View, priority: 2 }
        return null
      })
      .filter((item): item is NotificationItem & { priority: number } => Boolean(item))
      .sort((left, right) => left.priority - right.priority)
      .map(({ priority: _priority, ...item }) => item)
  }, [calendarSchedule, calendarSimulationNow])
  const notifications = useMemo<NotificationItem[]>(() => [
    ...scheduleNotifications,
    !standupDone ? { id: 'standup-due', title: 'Async stand-up is due', detail: 'Share your plan before implementation.', view: 'home' } : null,
    !testsPassed && standupDone ? { id: 'branch-checks', title: 'Branch checks are your next gate', detail: 'Implement the guard and run CI before committing.', view: 'workspace' } : null,
    testsPassed && !committed ? { id: 'commit-ready', title: 'Your branch is ready to commit', detail: 'Capture the verified implementation on your feature branch.', view: 'workspace' } : null,
    committed && !prOpen ? { id: 'review-needed', title: 'PROJ-184 needs a pull request', detail: 'Request review so the release train can move.', view: 'pulls' } : null,
    prOpen && !reviewAddressed ? { id: 'review-requested', title: 'Noah requested a change on PR #482', detail: 'Address the role guard before merge.', view: 'pulls' } : null,
    prOpen && reviewAddressed && !approved ? { id: 'review-response', title: 'Explain the review update', detail: 'Your reviewer needs a clear response before approval.', view: 'pulls' } : null,
    ...teamSpaces.filter((space) => space.unread > 0).map((space) => ({ id: `unread-${space.id}`, title: `New activity in #${space.name}`, detail: `${space.unread} unread team update${space.unread === 1 ? '' : 's'}.`, view: 'team-space' as View, spaceId: space.id })),
    ...activity.slice(0, 4).map((item) => ({ id: `activity-${item.id}`, title: 'Your simulation activity', detail: item.text, view: 'feedback' as View })),
  ].filter(Boolean) as NotificationItem[], [scheduleNotifications, standupDone, testsPassed, committed, prOpen, reviewAddressed, approved, teamSpaces, activity])
  const unreadNotifications = notifications.filter((item) => !readNotificationIds.includes(item.id)).length
  const liveMeetingCount = useMemo(() => {
    const now = Date.parse(calendarSimulationNow)
    const currentTime = Number.isFinite(now) ? now : Date.now()
    return calendarSchedule.filter((item) => item.kind === 'ceremony' && !item.completed && !item.missed && currentTime >= Date.parse(item.startsAt) && currentTime <= Date.parse(item.endsAt)).length
  }, [calendarSchedule, calendarSimulationNow])
  const activeChallenges = liveEvents.filter((event) => event.type === 'agent_reply' && typeof event.metadata?.severity === 'string').slice(-2)
  const dismissToast = (id: string) => setToasts((items) => items.filter((item) => item.id !== id))
  const notify = (message: string, tone: 'success' | 'warning' = 'success', options: ToastOptions = { title: tone === 'warning' ? 'Attention needed' : 'Simulation activity' }) => {
    const toast: Toast = { id: crypto.randomUUID(), title: options.title || (tone === 'warning' ? 'Attention needed' : 'Simulation activity'), message, tone, view: options.view, spaceId: options.spaceId }
    setToasts((items) => [...items, toast].slice(-4))
    window.setTimeout(() => dismissToast(toast.id), 6000)
  }
  const announceSimulationEvent = (event: SimulationEvent) => {
    if (announcedSimulationEventIds.current.has(event.id)) return
    announcedSimulationEventIds.current.add(event.id)
    if (announcedSimulationEventIds.current.size > 300) announcedSimulationEventIds.current.clear()
    const details = simulationEventToast(event)
    notify(details.message, details.tone, { title: details.title, view: details.view, spaceId: details.spaceId })
  }
  const log = (text: string) => setActivity((items) => [{ id: crypto.randomUUID(), text }, ...items].slice(0, 8))
  const recordSimulationEvent = async (type: SimulationEventType, metadata?: SimulationMetadata) => {
    if (!organizationId) { notify('Your simulation run is still loading.', 'warning'); return false }
    const response = await fetch('/api/simulation/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, type, metadata }) })
    if (!response.ok) {
      const result = await response.json() as { error?: string }
      notify(result.error || 'The simulation could not record that action.', 'warning')
      return false
    }
    const result = await response.json() as { event: SimulationEvent; taskReport?: SimulationEvent | null; projectReport?: SimulationEvent | null; cycle?: SimulationEvent | null; unlock?: SimulationEvent | null }
    const recordedEvents = [result.event, result.taskReport, result.projectReport, result.cycle, result.unlock].filter((event): event is SimulationEvent => Boolean(event))
    setLiveEvents((events) => [...events, ...recordedEvents.filter((event) => !events.some((item) => item.id === event.id))])
    recordedEvents.forEach(announceSimulationEvent)
    return result
  }
  const requestAgentTurn = async (channelId: string, userMessage: string) => {
    const channel = teamSpaces.find((space) => space.id === channelId)
    const recentDecisions = messages.filter((message) => message.spaceId === channelId && message.tags?.some((tag) => ['decision', 'risk', 'blocker'].includes(tag))).slice(-4).map((message) => message.text.slice(0, 120))
    const openFollowUps = followUps.filter((item) => item.status === 'open' && messages.some((message) => message.spaceId === channelId && message.id === item.sourceMessageId)).length
    const response = await fetch('/api/simulation/agent-turns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, channelId, userMessage, channelType: channel?.spaceType, channelPurpose: channel?.purpose || channel?.description, recentDecisions, openFollowUps }) })
    if (!response.ok) {
      notify('Your teammates could not respond right now. Try again in a moment.', 'warning')
      return null
    }
    return response.json() as Promise<{ turn: { agent: { id: string; name: string; role: string }; message: string }; event: SimulationEvent }>
  }
  const createIssue = (draft: Omit<WorkIssue, 'id' | 'updatedAt'>) => {
    const nextNumber = Math.max(200, ...issues.map((issue) => Number(issue.id.replace('PROJ-', '')) + 1))
    const issue: WorkIssue = { ...draft, id: `PROJ-${nextNumber}`, updatedAt: 'just now' }
    setIssues((items) => [...items, issue]); log(`Created ${issue.id}: ${issue.title}`); void recordSimulationEvent('issue_created', { issueId: issue.id, title: issue.title, issue })
  }
  const updateIssue = async (issue: WorkIssue) => {
    const previous = issues.find((item) => item.id === issue.id)
    if (issue.status === 'done' && previous?.status !== 'done' && issue.assignee === 'alex') {
      const result = await recordSimulationEvent('task_completed', { issueId: issue.id, level: scenarioLevel })
      if (!result) return
      if (result.cycle) resetDeliveryWorkflow()
      log(`Completed ${issue.id} through the ${scenarioPolicies[scenarioLevel].label} merge gate`)
    }
    setIssues((items) => items.map((item) => item.id === issue.id ? issue : item)); log(`Updated ${issue.id}: ${issue.title}`); void recordSimulationEvent('issue_updated', { issueId: issue.id, status: issue.status, priority: issue.priority, assignee: issue.assignee, level: scenarioLevel, issue })
  }
  const selectScenarioLevel = async (level: ScenarioLevel) => {
    const result = await recordSimulationEvent('scenario_level_selected', { level })
    if (!result) return
    if (result.cycle) resetDeliveryWorkflow()
    setScenarioLevel(level)
    const activeTaskIds = new Set(taskIdsForScenarioLevel[level])
    setIssues((current) => issuesForScenarioLevel(level).map((nextIssue) => {
      const existing = current.find((item) => item.id === nextIssue.id)
      return existing && !activeTaskIds.has(nextIssue.id) ? { ...nextIssue, status: existing.status, updatedAt: existing.updatedAt } : nextIssue
    }))
    log(`Started the ${scenarioPolicies[level].label} scenario`)
  }
  const advanceSimulationTime = async (minutes: number) => {
    if (minutes <= 0 || advancingTimeRef.current) return
    advancingTimeRef.current = true
    setIsAdvancingTime(true)
    try {
      const from = simulationMinutes
      const next = Math.min(17 * 60, from + minutes)
      if (!await recordSimulationEvent('simulation_time_advanced', { from, to: next, minutes: next - from })) return
      setSimulationMinutes(next)
      const formatTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
      log(`Advanced simulated time from ${formatTime(from)} to ${formatTime(next)}`)
      try {
        const scheduleResponse = await fetch('/api/simulation/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, action: 'check_deadlines' }) })
        if (scheduleResponse.ok) {
          const schedule = await scheduleResponse.json() as { schedule?: ScheduleItem[]; simulationNow?: string }
          if (schedule.schedule) setCalendarSchedule(schedule.schedule)
          if (schedule.simulationNow) setCalendarSimulationNow(schedule.simulationNow)
        }
      } catch { /* The next scheduled pulse will retry durable follow-up delivery. */ }
      setHomeOverlay('none')
    } finally {
      advancingTimeRef.current = false
      setIsAdvancingTime(false)
    }
  }
  const completeStandup = async () => {
    if (!await recordSimulationEvent('standup_posted')) return
    setStandupDone(true); setShowCeremony(false); log('Posted async stand-up')
  }
  const runTests = async () => {
    if (!workspaceCode.includes('canManageBilling')) {
      log('CI blocked: billing role guard is missing')
      setTestsPassed(false)
    }
    setWorkspaceValidation(null)
    try {
      if (!await saveWorkspaceFile('app/components/alerts-panel.tsx')) return false
      const response = await fetch('/api/workspace/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, source: workspaceCode }) })
      const result = await response.json() as { passed?: boolean; sourceHash?: string; output?: string; durationMs?: number; error?: string; event?: SimulationEvent }
      setWorkspaceValidation({ sourceHash: result.sourceHash || '', output: result.output || result.error || 'Scenario validation failed.', durationMs: result.durationMs || 0 })
      if (!response.ok || !result.passed) {
        setTestsPassed(false); log('Scenario checks failed against the submitted source')
        notify('Scenario checks failed. Read the terminal output and fix the implementation.', 'warning')
        return false
      }
      if (result.event) {
        setLiveEvents((events) => events.some((event) => event.id === result.event!.id) ? events : [...events, result.event!])
        announceSimulationEvent(result.event)
      }
      setTestsPassed(true); log('Server verified the scenario test suite')
      return true
    } catch {
      setTestsPassed(false); setWorkspaceValidation({ sourceHash: '', output: 'The isolated scenario runner could not be reached.', durationMs: 0 })
      notify('The scenario runner is unavailable. Try again in a moment.', 'warning')
      return false
    }
  }
  const commit = async () => {
    if (!testsPassed || !workspaceValidation) return notify('Run the verified scenario checks before creating a commit.', 'warning')
    if (!await recordSimulationEvent('commit_created')) return
    setCommitted(true); log('Committed changes on feat/usage-alerts-empty-state')
  }
  const openPr = async () => {
    if (!committed) return notify('Commit your changes before opening a pull request.', 'warning')
    if (!await recordSimulationEvent('pull_request_opened')) return
    setPrOpen(true); log('Opened PR #482 for review')
  }
  const updateWorkspaceFile = (path: string, content: string) => {
    setWorkspaceFiles((files) => files.map((file) => file.path === path ? { ...file, content } : file))
    if (path === 'app/components/alerts-panel.tsx') setWorkspaceCode(content)
    setTestsPassed(false)
    setWorkspaceValidation(null)
  }
  const synchronizeTheiaFile = (file: WorkspaceFile) => {
    setWorkspaceFiles((files) => files.map((item) => item.path === file.path ? file : item))
    if (file.path === 'app/components/alerts-panel.tsx') setWorkspaceCode(file.content)
    setTestsPassed(false)
    setWorkspaceValidation(null)
    log(`Synchronized ${file.path} from the isolated Theia workbench`)
  }
  const saveWorkspaceFile = async (path: string) => {
    if (!organizationId) return false
    const file = workspaceFiles.find((item) => item.path === path)
    if (!file) return false
    try {
      const response = await fetch('/api/simulation/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId, path, content: file.content, baseRevisionId: file.revisionId }) })
      const result = await response.json().catch(() => ({})) as { file?: WorkspaceFile; error?: string }
      if (!response.ok || !result.file) { notify(result.error || 'The workspace revision could not be saved.', 'warning'); return false }
      setWorkspaceFiles((files) => files.map((item) => item.path === path ? result.file! : item))
      if (path === 'app/components/alerts-panel.tsx') setWorkspaceCode(result.file.content)
      log(`Saved ${path} to the shared workspace record`)
      return true
    } catch {
      notify('The workspace service is unavailable. Your local revision is still open; try saving again shortly.', 'warning')
      return false
    }
  }
  const selectTeamSpace = (spaceId: string) => {
    if (!onboardingQualified) return notify('Complete onboarding and the readiness task before joining Team Spaces.', 'warning')
    setSelectedSpaceId(spaceId)
    setTeamSpaces((spaces) => spaces.map((space) => space.id === spaceId ? { ...space, unread: 0 } : space))
    setView('team-space')
  }
  const openAgentPortfolio = (agentId: string) => {
    if (!agentPortfolios[agentId]) return
    setSelectedAgentId(agentId)
    setView('agent-profile')
  }
  const addTeamSpace = () => {
    if (!onboardingQualified) return notify('Team Spaces unlock after onboarding.', 'warning')
    const name = newSpaceName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!name) return notify('Give the new team space a name.', 'warning')
    if (teamSpaces.some((space) => space.name === name)) return notify('A team space with that name already exists.', 'warning')
    const space = normalizeTeamSpace({ id: `space-${Date.now()}`, name, unread: 0, description: 'A focused space for decisions, updates, and working context.', memberIds: ['maya', 'noah', 'devon', 'you'] })
    setTeamSpaces((spaces) => [...spaces, space]); setMessages((items) => [...items, { id: createMessageId(), spaceId: space.id, author: 'Maya Chen', role: 'Product Manager', initials: 'M', tone: 'violet', time: 'now', text: `Welcome to #${name}. Use this space to keep team decisions visible.`, link: '', tags: ['handoff'] }]); void recordSimulationEvent('team_space_created', { spaceId: space.id, name, spaceType: space.spaceType || 'general', space }); setNewSpaceName(''); setIsAddingSpace(false); selectTeamSpace(space.id); log(`Created #${name}`)
  }
  const updateTeamSpace = (nextSpace: TeamSpace) => {
    if (!onboardingQualified) return notify('Team Spaces unlock after onboarding.', 'warning')
    const name = nextSpace.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!name) return notify('A team space needs a valid name.', 'warning')
    if (teamSpaces.some((space) => space.id !== nextSpace.id && space.name === name)) return notify('A team space with that name already exists.', 'warning')
    const previous = teamSpaces.find((space) => space.id === nextSpace.id)
    const normalized = normalizeTeamSpace({ ...nextSpace, name })
    setTeamSpaces((spaces) => spaces.map((space) => space.id === normalized.id ? normalized : space))
    const added = (normalized.memberIds || []).filter((id) => !(previous?.memberIds || []).includes(id))
    const removed = (previous?.memberIds || []).filter((id) => !(normalized.memberIds || []).includes(id))
    added.forEach((memberId) => void recordSimulationEvent('space_member_added', { spaceId: normalized.id, memberId }))
    removed.forEach((memberId) => void recordSimulationEvent('space_member_removed', { spaceId: normalized.id, memberId }))
    log(`Updated #${normalized.name}`); void recordSimulationEvent('team_space_updated', { spaceId: normalized.id, name: normalized.name, memberCount: normalized.memberIds?.length || 0, space: normalized })
  }
  const togglePinMessage = (id: number) => {
    const message = messages.find((item) => item.id === id)
    if (!message) return
    const nextPinned = !message.pinned
    setMessages((items) => items.map((item) => item.id === id ? { ...item, pinned: nextPinned } : item))
    setTeamSpaces((spaces) => spaces.map((space) => space.id === message.spaceId ? { ...space, pinnedMessageIds: nextPinned ? [...new Set([...(space.pinnedMessageIds || []), id])] : (space.pinnedMessageIds || []).filter((item) => item !== id) } : space))
    void recordSimulationEvent('message_pinned', { messageId: id, spaceId: message.spaceId, pinned: nextPinned })
    log(`${nextPinned ? 'Pinned' : 'Unpinned'} a team message`)
  }
  const markMessage = (id: number, tag: MessageTag) => {
    const message = messages.find((item) => item.id === id)
    if (!message) return
    const tags = message.tags?.includes(tag) ? message.tags : [...(message.tags || []), tag]
    setMessages((items) => items.map((item) => item.id === id ? { ...item, tags } : item))
    const eventType = tag === 'decision' ? 'message_marked_decision' : tag === 'risk' ? 'message_marked_risk' : tag === 'question' ? 'message_marked_question' : tag === 'handoff' ? 'message_marked_handoff' : 'message_marked_blocker'
    void recordSimulationEvent(eventType, { messageId: id, spaceId: message.spaceId, tag })
    log(`Marked message as ${tagLabels[tag].toLowerCase()}`)
  }
  const createFollowUp = (id: number) => {
    const message = messages.find((item) => item.id === id)
    if (!message) return
    const followUp: FollowUp = { id: `fu-${Date.now()}`, sourceMessageId: id, title: message.link ? `${message.link}: follow-up` : message.text.slice(0, 72) || 'Team follow-up', ownerId: 'you', status: 'open', createdAt: new Date().toISOString() }
    setFollowUps((items) => [...items, followUp])
    setMessages((items) => items.map((item) => item.id === id ? { ...item, followUpId: followUp.id } : item))
    void recordSimulationEvent('followup_created', { followUpId: followUp.id, messageId: id, spaceId: message.spaceId, ownerId: followUp.ownerId, followUp })
    log('Created a follow-up from a team message')
  }
  const completeFollowUp = async (id: string) => {
    const followUp = followUps.find((item) => item.id === id)
    if (!followUp) return
    if (!await recordSimulationEvent('followup_completed', { followUpId: id, messageId: followUp.sourceMessageId })) return
    setFollowUps((items) => items.map((item) => item.id === id ? { ...item, status: 'done' } : item))
    log('Completed a team follow-up')
  }
  const resolveThread = (id: number) => {
    const message = messages.find((item) => item.id === id)
    if (!message) return
    setMessages((items) => items.map((item) => item.id === id ? { ...item, resolved: true } : item))
    void recordSimulationEvent('thread_resolved', { messageId: id, spaceId: message.spaceId })
    log('Resolved a team thread')
  }
  const archiveTeamSpace = (id: string) => {
    const space = teamSpaces.find((item) => item.id === id)
    if (!space) return
    setTeamSpaces((spaces) => spaces.map((item) => item.id === id ? { ...item, archived: true } : item))
    void recordSimulationEvent('space_archived', { spaceId: id, name: space.name })
    log(`Archived #${space.name}`)
  }
  const unarchiveTeamSpace = (id: string) => {
    const space = teamSpaces.find((item) => item.id === id)
    if (!space) return
    setTeamSpaces((spaces) => spaces.map((item) => item.id === id ? { ...item, archived: false } : item))
    void recordSimulationEvent('team_space_updated', { spaceId: id, name: space.name, archived: false })
    log(`Reopened #${space.name}`)
  }
  const updateMessage = (id: number, text: string) => {
    const message = messages.find((item) => item.id === id)
    if (!message || message.author !== 'You' || text.trim().length === 0) return
    setMessages((items) => items.map((item) => item.id === id ? { ...item, text: text.trim(), edited: true } : item)); log('Edited a team message'); void recordSimulationEvent('chat_message_edited', { messageId: id })
  }
  const deleteMessage = (id: number) => {
    const message = messages.find((item) => item.id === id)
    if (!message || message.author !== 'You') return
    setMessages((items) => items.filter((item) => item.id !== id && item.threadId !== id)); log('Deleted a team message'); void recordSimulationEvent('chat_message_deleted', { messageId: id })
  }
  const sendMessage = async (attachment?: TeamAttachment, messageOverride?: string, threadId?: number) => {
    if (!onboardingQualified) return notify('Complete onboarding and the readiness task before messaging the team.', 'warning')
    if (!organizationId) return notify('Your simulation run is still loading.', 'warning')
    const message = (messageOverride || draft).trim()
    if (!message && !attachment) return
    const spaceId = selectedSpaceId
    const spaceName = selectedSpace?.name || 'team space'
    let storedAttachment = attachment ? { name: attachment.name, size: attachment.size, type: attachment.type, path: attachment.path, url: attachment.url } : undefined
    if (attachment?.file) {
      const form = new FormData(); form.set('organizationId', organizationId); form.set('file', attachment.file)
      const upload = await fetch('/api/workspace/artifacts', { method: 'POST', body: form })
      if (!upload.ok) {
        const result = await upload.json() as { error?: string }
        return notify(result.error || 'The attachment could not be uploaded.', 'warning')
      }
      const result = await upload.json() as { artifact: { path: string; url: string | null } }
      storedAttachment = { name: attachment.name, size: attachment.size, type: attachment.type, path: result.artifact.path, url: result.artifact.url || undefined }
    }
    const localMessageId = createMessageId()
    const clientMessageId = String(localMessageId)
    if (!await recordSimulationEvent('chat_message', { message: message || '(attachment)', channelId: spaceId, threadId: threadId || '', clientMessageId, ...(storedAttachment ? { attachmentName: storedAttachment.name, attachmentPath: storedAttachment.path || '', attachmentSize: storedAttachment.size, attachmentType: storedAttachment.type } : {}) })) return
    setMessages((items) => appendTeamMessage(items, { id: localMessageId, spaceId, author: 'You', role: 'Full-stack Engineer', initials: 'Y', tone: 'blue', time: 'now', text: message, link: '', threadId, clientMessageId, attachment: storedAttachment }))
    log(`Sent ${threadId ? 'a thread reply' : 'a message'} in #${spaceName}`); if (!messageOverride) setDraft('')
    window.setTimeout(async () => {
      const result = await requestAgentTurn(spaceId, message)
      if (!result) return
      const tone = result.turn.agent.id === 'maya' ? 'violet' : result.turn.agent.id === 'adele' ? 'orange' : result.turn.agent.id === 'devon' ? 'blue' : 'mint'
      const role = result.turn.agent.role.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')
      setMessages((items) => appendTeamMessage(items, { id: Date.parse(result.event.createdAt), spaceId, author: result.turn.agent.name, role, initials: result.turn.agent.name[0], tone, time: 'now', text: result.turn.message, link: '', threadId, eventId: result.event.id }))
      announceSimulationEvent(result.event)
      setTeamSpaces((spaces) => spaces.map((space) => space.id === spaceId ? { ...space, unread: spaceId === selectedSpaceId ? 0 : space.unread + 1 } : space))
      log(`${result.turn.agent.name.split(' ')[0]} replied in #${spaceName}`)
    }, 700)
  }
  const addressReview = async () => {
    if (!await recordSimulationEvent('review_addressed')) return
    setReviewAddressed(true); log('Marked Noah’s review as addressed')
  }
  const replyToReview = async (response: string) => {
    if (response.trim().length < 12) return notify('Explain how you handled the feedback before submitting your response.', 'warning')
    if (!await recordSimulationEvent('review_reply', { response: response.trim() })) return
    setReviewReplied(true); log('Responded to Noah’s review')
    window.setTimeout(async () => {
      if (!await recordSimulationEvent('approval_granted')) return
      setApproved(true); log('Noah approved PR #482')
    }, 700)
  }
  const recordMergeRationale = async (rationale: string) => {
    if (!await recordSimulationEvent('merge_rationale_recorded', { rationale })) return false
    log('Recorded merge rationale')
    return true
  }
  const mergePullRequest = async (rationale: string) => {
    if (!await recordMergeRationale(rationale)) return
    if (!await recordSimulationEvent('pull_request_merged')) return
    setMerged(true); log('Merged PR #482 into main')
  }

  const nav = [
    { id: 'guide' as View, label: 'Getting started', icon: FileText },
    { id: 'onboarding' as View, label: 'Onboarding', icon: GraduationCap },
    { id: 'home' as View, label: 'Home', icon: LayoutDashboard },
    { id: 'calendar' as View, label: 'Calendar', icon: CalendarDays, badge: scheduleNotifications.length || undefined },
    { id: 'meetings' as View, label: 'Meetings', icon: UsersRound, badge: liveMeetingCount || undefined },
    { id: 'issues' as View, label: 'Issues', icon: CircleDot, badge: 3 },
    { id: 'workspace' as View, label: 'Workspace', icon: Code2 },
    { id: 'pulls' as View, label: 'Pull requests', icon: GitBranch, badge: prOpen ? 1 : undefined },
    { id: 'feedback' as View, label: 'Feedback', icon: Sparkles },
  ]
  const toggleTheme = () => setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark')

  if (!organizationId) return <main className="auth-required"><h1>{runError ? 'Simulation access needs attention.' : 'Preparing your private work simulation…'}</h1><p>{runError || 'Loading your organization, schedule, workspace, and collaboration record.'}</p></main>

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><Layers3 size={18} /></span><span>AIWEX</span></div>
      <button className="org-switch" onClick={() => setHomeOverlay(homeOverlay === 'organization' ? 'none' : 'organization')} aria-expanded={homeOverlay === 'organization'}><span className="org-icon">S</span><span><b>SignalDesk</b><small>Pro workspace</small></span><ChevronDown size={15} /></button>
      <nav className="primary-nav">
        {nav.map((item) => { const locked = !onboardingQualified && !['guide', 'onboarding', 'feedback'].includes(item.id); return <button key={item.id} disabled={locked} className={`${view === item.id ? 'active' : ''} ${locked ? 'nav-locked' : ''}`} onClick={() => locked ? notify('Complete onboarding and pass the readiness task to unlock the main project.', 'warning') : setView(item.id)}><item.icon size={18} /><span>{item.label}</span>{locked ? <Lock size={12} /> : item.badge && <i>{item.badge}</i>}</button> })}
      </nav>
      <div className="sidebar-label">Team spaces</div>
      <div className="team-spaces-list">{teamSpaces.map((space) => <button key={space.id} disabled={!onboardingQualified} className={`team-space ${selectedSpaceId === space.id ? 'active-space' : ''} ${!onboardingQualified ? 'locked-team-space' : ''}`} onClick={() => selectTeamSpace(space.id)}><span>#</span> {space.name} {!onboardingQualified ? <Lock size={11} /> : space.unread > 0 && <b>{space.unread}</b>}</button>)}</div>
      {isAddingSpace ? <div className="new-space-form"><input autoFocus value={newSpaceName} onChange={(event) => setNewSpaceName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addTeamSpace()} placeholder="space-name"/><button onClick={addTeamSpace}><Check size={13} /></button><button onClick={() => { setIsAddingSpace(false); setNewSpaceName('') }}><X size={13} /></button></div> : <button className="new-space" disabled={!onboardingQualified} onClick={() => setIsAddingSpace(true)}><Plus size={15} /> Add a space</button>}
      <div className="sidebar-bottom">
        <button className="team-row" onClick={() => openAgentPortfolio('maya')}><Avatar id="maya" tone="violet" small /><span>Maya Chen</span><i className="online" /></button>
        <button className="team-row" onClick={() => openAgentPortfolio('noah')}><Avatar id="noah" tone="mint" small /><span>Noah Patel</span><i className="online" /></button>
        <button className="team-row" onClick={() => openAgentPortfolio('adele')}><Avatar id="adele" tone="orange" small /><span>Adele Okafor</span></button>
        <div className="your-profile"><Avatar id="you" tone="blue" initials={learnerProfile.initials} /><span><b>{learnerProfile.displayName}</b><small>Full-stack engineer</small></span><MoreHorizontal size={17} /></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <div className="crumbs"><span>SignalDesk</span><ArrowRight size={13} /><b>{view === 'home' ? 'Today' : view === 'team-space' ? `# ${selectedSpace?.name}` : view === 'agent-profile' ? selectedAgent.name : nav.find((item) => item.id === view)?.label}</b></div>
        <div className="top-actions"><button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}>{resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span>{resolvedTheme === 'dark' ? 'Light' : 'Dark'}</span></button><button className="icon-button" onClick={() => setHomeOverlay(homeOverlay === 'search' ? 'none' : 'search')} aria-label="Search organization"><Search size={18} /></button><button className="icon-button notification" onClick={() => setHomeOverlay(homeOverlay === 'notifications' ? 'none' : 'notifications')} aria-label="Open notifications"><Bell size={18} />{unreadNotifications > 0 && <i />}</button><button className="help-button" onClick={() => setHomeOverlay(homeOverlay === 'help' ? 'none' : 'help')} aria-label="Open help for this page">?</button></div>
      </header>
      {homeOverlay !== 'none' && <HomeControls overlay={homeOverlay} close={() => setHomeOverlay('none')} query={searchQuery} setQuery={setSearchQuery} issues={issues} messages={messages} activity={activity} workspaceCode={workspaceCode} prOpen={prOpen} notifications={notifications} readNotificationIds={readNotificationIds} currentView={view} selectResult={(target, spaceId, notificationId) => { if (spaceId) setSelectedSpaceId(spaceId); if (notificationId) setReadNotificationIds((ids) => ids.includes(notificationId) ? ids : [...ids, notificationId]); setView(target); setHomeOverlay('none') }} markAllNotificationsRead={() => setReadNotificationIds(notifications.map((item) => item.id))} simulationMinutes={simulationMinutes} isAdvancingTime={isAdvancingTime} advanceTime={advanceSimulationTime} />}
      {view === 'guide' && <FunctionalLearnerGuideView onNavigate={(target) => setView(target)} />}
      {view === 'onboarding' && <FunctionalOnboardingView organizationId={organizationId} onQualified={() => setOnboardingQualified(true)} openProject={() => setView('home')} />}
      {view === 'home' && <HomeView learnerFirstName={learnerProfile.firstName} standupDone={standupDone} showCeremony={showCeremony} setShowCeremony={setShowCeremony} completeStandup={completeStandup} messages={activeMessages} allMessages={messages} liveEvents={liveEvents} activeChallenges={activeChallenges} scenarioLevel={scenarioLevel} scenarioProgression={scenarioProgression} selectScenarioLevel={selectScenarioLevel} selectedTeamSpace={selectedSpace} draft={draft} setDraft={setDraft} sendMessage={sendMessage} activity={activity} issues={issues} setView={setView} openAgentPortfolio={openAgentPortfolio} testsPassed={testsPassed} committed={committed} prOpen={prOpen} reviewAddressed={reviewAddressed} progress={progress} simulationMinutes={simulationMinutes} isAdvancingTime={isAdvancingTime} advanceTime={() => setHomeOverlay(homeOverlay === 'time' ? 'none' : 'time')} quickAdvance={(minutes) => void advanceSimulationTime(minutes)} collaborationConnection={collaborationConnection} collaborationLastSyncedAt={collaborationLastSyncedAt} currentIssue={issues.find((issue) => issue.id === (scenarioProgression.currentLevel === scenarioLevel ? scenarioProgression.activeTaskId : taskIdsForScenarioLevel[scenarioLevel][0])) || issues.find((issue) => issue.assignee === 'alex' && issue.status !== 'done')} />}
      {view === 'calendar' && <FunctionalCalendarView organizationId={organizationId} schedule={calendarSchedule} simulationNow={calendarSimulationNow} onScheduleUpdated={(schedule, now) => { setCalendarSchedule(schedule); setCalendarSimulationNow(now) }} onOpenMeeting={(scheduleId) => { const meeting = meetingForSchedule(scheduleId); if (!meeting) { notify('This calendar item does not use a conference room.', 'warning'); return }; setSelectedMeetingId(meeting.id); setView('meetings') }} />}
      {view === 'meetings' && <FunctionalMeetingView organizationId={organizationId} selectedMeetingId={selectedMeetingId} onMeetingSelected={setSelectedMeetingId} />}
      {view === 'team-space' && <TeamSpaceView space={selectedSpace} messages={activeMessages} allMessages={messages} followUps={followUps} draft={draft} setDraft={setDraft} sendMessage={sendMessage} sendThreadReply={(message, threadId) => sendMessage(undefined, message, threadId)} updateSpace={updateTeamSpace} updateMessage={updateMessage} deleteMessage={deleteMessage} togglePinMessage={togglePinMessage} markMessage={markMessage} createFollowUp={createFollowUp} completeFollowUp={completeFollowUp} resolveThread={resolveThread} archiveSpace={archiveTeamSpace} unarchiveSpace={unarchiveTeamSpace} learnerName={learnerProfile.displayName} openAgentPortfolio={openAgentPortfolio} />}
      {view === 'agent-profile' && <AgentPortfolioView agent={selectedAgent} openTeamSpace={() => selectTeamSpace(selectedAgent.id === 'devon' ? 'engineering' : selectedAgent.id === 'maya' ? 'releases' : 'product-usage')} />}
      {view === 'issues' && <FunctionalIssuesView issues={issues} createIssue={createIssue} updateIssue={updateIssue} openWorkspace={() => setView('workspace')} />}
      {view === 'workspace' && (workspaceSurface === 'theia'
        ? <FunctionalTheiaWorkspaceView organizationId={organizationId} onReturn={() => setWorkspaceSurface('built-in')} onFileSynchronized={synchronizeTheiaFile} />
        : <FunctionalWorkspaceView files={workspaceFiles} updateFile={updateWorkspaceFile} saveFile={saveWorkspaceFile} testsPassed={testsPassed && Boolean(workspaceValidation)} committed={committed} testOutput={workspaceValidation?.output} testDurationMs={workspaceValidation?.durationMs} runTests={runTests} commit={commit} openPr={openPr} openTheia={() => setWorkspaceSurface('theia')} />)}
      {view === 'pulls' && <FunctionalPullRequestsView prOpen={prOpen} reviewAddressed={reviewAddressed} reviewReplied={reviewReplied} approved={approved} merged={merged} files={workspaceFiles} addressReview={addressReview} replyToReview={replyToReview} mergePullRequest={mergePullRequest} />}
      {view === 'feedback' && <FunctionalFeedbackView organizationId={organizationId} />}
    </main>
    {toasts.length > 0 && <div className="toast-stack" aria-live="polite" aria-relevant="additions">{toasts.map((toast) => <div className={`toast ${toast.tone}`} key={toast.id} role="status" onClick={() => { if (toast.spaceId) setSelectedSpaceId(toast.spaceId); if (toast.view) setView(toast.view); dismissToast(toast.id) }} title={toast.view ? 'Open related work' : undefined}><Bell size={17} /><span><b>{toast.title}</b><small>{toast.message}</small></span><button onClick={(event) => { event.stopPropagation(); dismissToast(toast.id) }} aria-label="Dismiss notification"><X size={15} /></button></div>)}</div>}
  </div>
}

function formatSimulationTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function nextSimulationCheckpoint(minutes: number) {
  return simulationCheckpoints.find((checkpoint) => checkpoint.at > minutes) || null
}

function formatSimulationAdvance(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

function HomeControls({ overlay, close, query, setQuery, issues, messages, activity, workspaceCode, prOpen, notifications, readNotificationIds, currentView, selectResult, markAllNotificationsRead, simulationMinutes, isAdvancingTime, advanceTime }: { overlay: HomeOverlay; close: () => void; query: string; setQuery: (value: string) => void; issues: WorkIssue[]; messages: TeamMessage[]; activity: ActivityItem[]; workspaceCode: string; prOpen: boolean; notifications: NotificationItem[]; readNotificationIds: string[]; currentView: View; selectResult: (view: View, spaceId?: string, notificationId?: string) => void; markAllNotificationsRead: () => void; simulationMinutes: number; isAdvancingTime: boolean; advanceTime: (minutes: number) => void }) {
  const normalizedQuery = query.trim().toLowerCase()
  const issueResults = normalizedQuery ? issues.filter((issue) => `${issue.id} ${issue.title} ${issue.description}`.toLowerCase().includes(normalizedQuery)).slice(0, 4) : []
  const messageResults = normalizedQuery ? messages.filter((message) => `${message.author} ${message.text}`.toLowerCase().includes(normalizedQuery)).slice(0, 4) : []
  const pullResults = normalizedQuery && (`pull request pr #482 code review review requested changes`.includes(normalizedQuery) || normalizedQuery.includes('pr')) ? [{ id: 'pr-482', title: 'PR #482 · Usage alerts empty state', detail: 'Learner pull request and merge gate' }] : []
  const workspaceResults = normalizedQuery && workspaceCode.toLowerCase().includes(normalizedQuery) ? [{ id: 'alerts-panel', title: 'alerts-panel.tsx', detail: 'Match found in the active workspace file' }] : []
  const activityResults = normalizedQuery ? activity.filter((item) => item.text.toLowerCase().includes(normalizedQuery)).slice(0, 4) : []
  const nextCheckpoint = nextSimulationCheckpoint(simulationMinutes)
  const nextAdvance = nextCheckpoint ? nextCheckpoint.at - simulationMinutes : 0
  const help = currentView === 'workspace' ? { title: 'Workspace guide', steps: ['Make the implementation yourself; AI teammates can clarify but do not write your assigned solution.', 'Run checks only after protecting the billing CTA with canManageBilling.', 'Commit passing work on your feature branch before opening a PR.'], target: 'workspace' as View, label: 'Open workspace' } : currentView === 'pulls' ? { title: 'Code review guide', steps: ['Read each requested change before marking it addressed.', 'Explain the implementation decision in your review response.', 'Merge remains gated until approval and a rationale are recorded.'], target: 'pulls' as View, label: 'Open pull requests' } : currentView === 'team-space' ? { title: 'Team space guide', steps: ['Keep decisions in the relevant channel so teammates can find context.', 'Use @mentions for a specific teammate and threads for focused follow-up.', 'Use attachments for artifacts; message ownership controls apply only to your posts.'], target: 'team-space' as View, label: 'Open team space' } : currentView === 'issues' ? { title: 'Issue board guide', steps: ['Review acceptance criteria and dependencies before changing status.', 'Update priority, owner, and blockers as scenario facts change.', 'Use the issue workspace link when you are ready to implement.'], target: 'issues' as View, label: 'Open issue board' } : currentView === 'feedback' ? { title: 'Coaching guide', steps: ['Feedback is private and tied to immutable simulation evidence.', 'Use evidence to identify one specific process or communication improvement.', 'Refresh after meaningful actions to review new signals.'], target: 'feedback' as View, label: 'Open coaching' } : { title: 'Today guide', steps: ['Post your stand-up and make dependencies visible.', 'Clarify assumptions before implementation, then test your own change.', 'Use the PR gate to practice review, rationale, and merge discipline.'], target: 'home' as View, label: 'Open today' }
  return <div className="home-overlay-layer" role="presentation" onMouseDown={close}>
    <section className={`home-overlay ${overlay}`} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
      <button className="overlay-close" onClick={close} aria-label="Close"><X size={16} /></button>
      {overlay === 'time' && <><span className="eyebrow">SIMULATION CLOCK</span><h2>{formatSimulationTime(simulationMinutes)} · Advance the workday</h2><p>Time moves only when you choose. The next scenario trigger is shown before you advance.</p><div className="time-options">{nextCheckpoint && <button className="next-time-option" type="button" disabled={isAdvancingTime} onClick={() => advanceTime(nextAdvance)}><span><FastForward size={15} /> {isAdvancingTime ? 'Advancing…' : 'Next event'}</span><small>{nextCheckpoint.title} in {formatSimulationAdvance(nextAdvance)}</small></button>}<button type="button" disabled={isAdvancingTime} onClick={() => advanceTime(15)}>+15 min <small>Quick focus block</small></button><button type="button" disabled={isAdvancingTime} onClick={() => advanceTime(60)}>+1 hour <small>Team check-ins may arrive</small></button><button type="button" disabled={isAdvancingTime} onClick={() => advanceTime(180)}>+3 hours <small>Move toward stakeholder review</small></button></div></>}
      {overlay === 'search' && <><span className="eyebrow">ORGANIZATION SEARCH</span><h2>Find work and context</h2><input autoFocus className="global-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues, people, or messages" />{!normalizedQuery ? <p>Search across the current scenario’s issue board and team conversations.</p> : <div className="search-results">{issueResults.map((issue) => <button key={issue.id} onClick={() => selectResult('issues')}><CircleDot size={15} /><span><b>{issue.id} · {issue.title}</b><small>{issue.status.replace('_', ' ')} · {issue.priority} priority</small></span></button>)}{messageResults.map((message, index) => <button key={`${message.id}-${message.spaceId}-${index}`} onClick={() => selectResult('team-space', message.spaceId)}><MessageSquare size={15} /><span><b>{message.author} in #{message.spaceId}</b><small>{message.text.slice(0, 90)}</small></span></button>)}{!issueResults.length && !messageResults.length && <p>No scenario records match “{query}”.</p>}</div>}</>}
      {overlay === 'search' && normalizedQuery && (pullResults.length > 0 || workspaceResults.length > 0 || activityResults.length > 0) && <div className="search-results extended-search-results">{pullResults.map((result) => <button key={result.id} onClick={() => selectResult('pulls')}><GitBranch size={15} /><span><b>{result.title}</b><small>{result.detail}</small></span></button>)}{workspaceResults.map((result) => <button key={result.id} onClick={() => selectResult('workspace')}><Code2 size={15} /><span><b>{result.title}</b><small>{result.detail}</small></span></button>)}{activityResults.map((item) => <button key={item.id} onClick={() => selectResult('feedback')}><Check size={15} /><span><b>Simulation activity</b><small>{item.text}</small></span></button>)}</div>}
      {overlay === 'notifications' && <><div className="notification-title"><div><span className="eyebrow">ACTION REQUIRED</span><h2>Notifications</h2></div><button className="ghost-button" onClick={markAllNotificationsRead}>Mark all read</button></div><div className="notification-list">{notifications.length ? notifications.map((notification) => <button key={notification.id} className={readNotificationIds.includes(notification.id) ? 'notification-read' : ''} onClick={() => selectResult(notification.view, notification.spaceId, notification.id)}><Bell size={16} /><span><b>{notification.title}</b><small>{notification.detail}</small></span><ArrowRight size={14} /></button>) : <p>You are caught up. New scenario events will appear here.</p>}</div></>}
      {overlay === 'help' && <><span className="eyebrow">CONTEXTUAL HELP</span><h2>{help.title}</h2><ol className="guide-list">{help.steps.map((step) => <li key={step}>{step}</li>)}</ol><button className="primary-button" onClick={() => selectResult(help.target)}>{help.label} <ArrowRight size={15} /></button></>}
      {overlay === 'organization' && <><span className="eyebrow">CURRENT ORGANIZATION</span><h2>SignalDesk</h2><p>Pro workspace · Curated B2B SaaS scenario · Sprint 2 of 3</p><div className="org-overview"><span><UsersRound size={16} /> 6 AI teammates</span><span><CircleDot size={16} /> {issues.filter((issue) => issue.status !== 'done').length} active issues</span><span><GitBranch size={16} /> {prOpen ? '1 learner PR in progress' : 'No learner PR yet'}</span></div><button className="primary-button" onClick={() => selectResult('home')}>Open today’s work <ArrowRight size={15} /></button></>}
    </section>
  </div>
}

function ScenarioLevelPanel({ level, progression, selectLevel, challenges }: { level: ScenarioLevel; progression: ScenarioProgression; selectLevel: (level: ScenarioLevel) => void; challenges: SimulationEvent[] }) {
  const activePolicy = scenarioPolicies[level]
  return <section className="scenario-level-panel"><div className="scenario-level-head"><div><span className="eyebrow">SIMULATION DIFFICULTY</span><h2>{activePolicy.label} workplace scenario</h2><p>{activePolicy.summary}</p></div><div className="scenario-policy"><b>{activePolicy.activeTaskTarget} active learner task{activePolicy.activeTaskTarget > 1 ? 's' : ''}</b><span>{activePolicy.deadlineLabel} · {activePolicy.agentStyle}</span></div></div><div className="level-options">{(Object.keys(scenarioPolicies) as ScenarioLevel[]).map((item) => { const locked = item !== level && !progression.unlockedLevels.includes(item); return <button key={item} disabled={locked} className={`${level === item ? 'selected-level' : ''} ${locked ? 'locked-level' : ''}`} onClick={() => selectLevel(item)}><b>{scenarioPolicies[item].label}{locked ? ' · locked' : ''}</b><small>{scenarioPolicies[item].activeTaskTarget} task{scenarioPolicies[item].activeTaskTarget > 1 ? 's' : ''} · {scenarioPolicies[item].agentStyle}</small></button>})}</div>{progression.nextLevel && <div className="level-requirements"><b>Unlock {scenarioPolicies[progression.nextLevel].label}</b><span>Coaching readiness: {progression.overallScore}</span>{progression.requirements.map((requirement) => <div key={requirement.label} className={requirement.complete ? 'complete' : ''}><Check size={13} /> {requirement.label}</div>)}</div>}{challenges.length > 0 && <div className="scenario-challenges">{challenges.map((event) => <div className={`scenario-challenge ${String(event.metadata?.severity || 'info')}`} key={event.id}><Bot size={16} /><div><b>{String(event.metadata?.title || 'Scenario update')}</b><span>{String(event.metadata?.message || '')}</span></div></div>)}</div>}</section>
}

function HomeView(props: { learnerFirstName: string; standupDone: boolean; showCeremony: boolean; setShowCeremony: (v: boolean) => void; completeStandup: () => void; messages: TeamMessage[]; allMessages: TeamMessage[]; liveEvents: SimulationEvent[]; activeChallenges: SimulationEvent[]; scenarioLevel: ScenarioLevel; scenarioProgression: ScenarioProgression; selectScenarioLevel: (level: ScenarioLevel) => void; selectedTeamSpace: TeamSpace; draft: string; setDraft: (v: string) => void; sendMessage: (attachment?: TeamAttachment) => void; activity: ActivityItem[]; issues: WorkIssue[]; setView: (v: View) => void; openAgentPortfolio: (id: string) => void; testsPassed: boolean; committed: boolean; prOpen: boolean; reviewAddressed: boolean; progress: number; simulationMinutes: number; isAdvancingTime: boolean; advanceTime: () => void; quickAdvance: (minutes: number) => void; collaborationConnection: CollaborationConnectionState; collaborationLastSyncedAt: string | null; currentIssue?: WorkIssue }) {
  const { learnerFirstName, standupDone, showCeremony, setShowCeremony, completeStandup, messages, allMessages, liveEvents, activeChallenges, scenarioLevel, scenarioProgression, selectScenarioLevel, selectedTeamSpace, draft, setDraft, sendMessage, activity, issues, setView, openAgentPortfolio, testsPassed, committed, prOpen, reviewAddressed, progress, simulationMinutes, isAdvancingTime, advanceTime, quickAdvance, collaborationConnection, collaborationLastSyncedAt, currentIssue } = props
  const task = currentIssue || seededIssues[0]
  const nextCheckpoint = nextSimulationCheckpoint(simulationMinutes)
  const nextAdvance = nextCheckpoint ? nextCheckpoint.at - simulationMinutes : 0
  const nextStep = !standupDone
    ? { title: 'Post your stand-up', detail: 'Make today’s work and any dependency risks visible to the team.', label: 'Post update', action: () => setShowCeremony(true) }
    : !testsPassed
      ? { title: 'Implement the role guard', detail: 'Use the canManageBilling guard, then run the branch checks.', label: 'Open workspace', action: () => setView('workspace') }
      : !committed
        ? { title: 'Commit the verified change', detail: 'Capture the tested implementation on your feature branch.', label: 'Open workspace', action: () => setView('workspace') }
        : !prOpen
          ? { title: 'Request a review', detail: 'Open a pull request so your teammates can inspect the change.', label: 'Open pull requests', action: () => setView('pulls') }
          : !reviewAddressed
            ? { title: 'Address the review', detail: 'Resolve the requested change and explain the decision to Noah.', label: 'Open review', action: () => setView('pulls') }
            : { title: 'Keep the release moving', detail: 'Reply to the review, record the rationale, and complete the merge gate.', label: 'Open review', action: () => setView('pulls') }
  return <div className="page home-page">
    <section className="simulation-clock-card" aria-label="Simulation time controls" aria-busy={isAdvancingTime}><div className="simulation-clock-summary"><span className="eyebrow">LEARNER-CONTROLLED PACE</span><div><Clock3 size={19} /><b>{formatSimulationTime(simulationMinutes)}</b><span>Simulated time</span></div><p>{nextCheckpoint ? `${nextCheckpoint.title} is next. ${nextCheckpoint.detail}` : 'Today’s planned scenario triggers are complete. Continue with your project work or adjust the clock.'}</p></div><div className="simulation-time-actions">{nextCheckpoint && <button className="next-event-button" type="button" disabled={isAdvancingTime} onClick={() => quickAdvance(nextAdvance)}><FastForward size={16} /><span><b>{isAdvancingTime ? 'Advancing…' : 'Next event'}</b><small>{nextCheckpoint.title} · in {formatSimulationAdvance(nextAdvance)}</small></span></button>}<button className="time-increment-button" type="button" disabled={isAdvancingTime} onClick={() => quickAdvance(15)}>+15m</button><button className="time-increment-button" type="button" disabled={isAdvancingTime} onClick={() => quickAdvance(60)}>+1h</button><button className="time-adjust-button" type="button" disabled={isAdvancingTime} onClick={advanceTime}>More</button></div></section>
    <section className="welcome"><div><p className="eyebrow">WEDNESDAY, SEPTEMBER 18 · SPRINT 2 OF 3</p><h1>Good morning, {learnerFirstName} <span>✦</span></h1><p>Here’s what needs your attention in SignalDesk today.</p></div><button className="time-button" onClick={advanceTime}><Clock3 size={16} /> Simulated time <b>{formatSimulationTime(simulationMinutes)}</b><ChevronDown size={14} /></button></section>
    <ScenarioLevelPanel level={scenarioLevel} progression={scenarioProgression} selectLevel={selectScenarioLevel} challenges={activeChallenges} />
    <section className="priority-grid">
      <div className="ceremony-card"><div className="card-icon lavender"><UsersRound size={19} /></div><div><span className="pill lavender-pill">CEREMONY</span><h3>Async stand-up is due</h3><p>Share your plan and flag any blockers with the team.</p></div><button className={standupDone ? 'complete-button done' : 'complete-button'} onClick={() => setShowCeremony(!showCeremony)}>{standupDone ? <><Check size={16} /> Posted</> : <>Post update <ArrowRight size={15} /></>}</button>
        {showCeremony && !standupDone && <div className="standup-popover"><b>Today’s stand-up</b><p>What did you finish? What will you work on? Any blockers?</p><button onClick={completeStandup}>Post my update</button></div>}
      </div>
      <div className="priority-card"><div className="card-icon coral"><Bell size={19} /></div><div><span className="pill coral-pill">{task.priority.toUpperCase()} PRIORITY</span><h3>{task.title}</h3><p>{task.id} · {task.status === 'done' ? 'Completed' : task.status === 'blocked' ? 'Blocked' : 'Due tomorrow'}</p></div><button className="soft-icon" onClick={() => setView('issues')} aria-label={`Open ${task.id}`}><ArrowRight size={18} /></button></div>
      <div className="priority-card"><div className="card-icon sky"><MessageSquare size={19} /></div><div><span className="pill sky-pill">{prOpen ? reviewAddressed ? 'REVIEW IN PROGRESS' : 'WAITING ON YOU' : 'COLLABORATION'}</span><h3>{prOpen ? reviewAddressed ? 'Explain your review update' : 'Reply to Noah’s review' : 'Clarify the API edge case'}</h3><p>{prOpen ? 'PR #482 · Required review step' : 'Ask Noah before implementation'}</p></div><button className="soft-icon" onClick={() => setView(prOpen ? 'pulls' : 'team-space')} aria-label="Open collaboration task"><ArrowRight size={18} /></button></div>
    </section>
    <div className="content-grid">
      <section className="card task-card"><div className="section-head"><div><span className="eyebrow">YOUR FOCUS</span><h2>Current task</h2></div><button className="ghost-button" onClick={() => setView('issues')}>View issue <ArrowRight size={14} /></button></div>
        <div className="issue-top"><span className={`status-dot ${task.status === 'done' ? 'done' : task.status === 'blocked' ? 'blocked' : task.status === 'in_review' ? 'review' : ''}`} /><span className="issue-id">{task.id}</span><span className="pill coral-pill">{task.priority.toUpperCase()}</span><span className="sprint-chip">{task.sprint}</span></div>
        <h3>{task.title}</h3><p className="task-description">{task.description}</p>
        <div className="task-details"><div><small>ASSIGNED BY</small><span><Avatar id="maya" tone="violet" small /> Maya Chen</span></div><div><small>DEPENDENCY</small><span className="dependency"><Lock size={13} /> {task.dependencyIds.length ? task.dependencyIds.join(', ') : 'No blockers'}</span></div><div><small>ESTIMATE</small><span>{task.estimate} points</span></div></div>
        <div className="next-action"><Sparkles size={17} /><div><b>{nextStep.title}</b><span>{nextStep.detail}</span></div><button onClick={nextStep.action}>{nextStep.label}</button></div>
      </section>
      <section className="card progress-card"><div className="section-head"><div><span className="eyebrow">SIMULATION PROGRESS</span><h2>Sprint readiness</h2></div><span className="progress-score">{progress}/5</span></div>
        <div className="progress-track"><i style={{ width: `${progress * 20}%` }} /></div>
        {[
          [standupDone, 'Post stand-up'], [testsPassed, 'Pass branch checks'], [committed, 'Commit your change'], [prOpen, 'Open a pull request'], [reviewAddressed, 'Address review'],
        ].map(([done, label]) => <div className="check-row" key={String(label)}><span className={done ? 'checked' : ''}>{done ? <Check size={13} /> : ''}</span>{label}</div>)}
      </section>
    </div>
    <OrgActivityMap issues={issues} messages={allMessages} liveEvents={liveEvents} simulationMinutes={simulationMinutes} standupDone={standupDone} testsPassed={testsPassed} committed={committed} prOpen={prOpen} reviewAddressed={reviewAddressed} connectionState={collaborationConnection} lastSyncedAt={collaborationLastSyncedAt} setView={setView} />
    <div className="content-grid lower-grid">
      <section className="card conversation-card"><div className="section-head"><div><span className="eyebrow">TEAM CONVERSATION</span><h2><span className="hash">#</span> {selectedTeamSpace.name} {selectedTeamSpace.unread > 0 && <em>{selectedTeamSpace.unread} unread</em>}</h2></div><button className="ghost-button" onClick={() => setView('team-space')}>Open channel <ArrowRight size={14} /></button></div>
        <div className="messages">{messages.map((message, index) => { const agentId = message.author === 'You' ? '' : message.author.startsWith('Maya') ? 'maya' : message.author.startsWith('Noah') ? 'noah' : message.author.startsWith('Adele') ? 'adele' : 'devon'; return <div className="message" key={`${message.id}-${message.spaceId}-${index}`}><Avatar id={agentId || 'you'} tone={message.tone} /><div><div className="message-meta">{agentId ? <button className="agent-name" onClick={() => openAgentPortfolio(agentId)}>{message.author}</button> : <b>{message.author}</b>}<span>{message.role}</span><time>{message.time}</time></div><p><MessageText text={message.text} openAgentPortfolio={openAgentPortfolio} /> {message.link && <a>{message.link}</a>}</p></div></div>})}</div>
        <MentionComposer className="message-composer" draft={draft} setDraft={setDraft} sendMessage={sendMessage} placeholder={`Message #${selectedTeamSpace.name}`}/>
      </section>
      <section className="card activity-card"><div className="section-head"><div><span className="eyebrow">LIVE ORG ACTIVITY</span><h2>While you were away</h2></div><button className="ghost-button" onClick={() => setView('feedback')}>View evidence <ArrowRight size={14} /></button></div>
        <div className="activity-item"><span className="activity-icon mint"><GitBranch size={15} /></span><p><b>Devon</b> merged <a>PR #477</a><small>12 min ago</small></p></div><div className="activity-item"><span className="activity-icon orange"><CircleDot size={15} /></span><p><b>Maya</b> reprioritized <a>PROJ-191</a><small>24 min ago</small></p></div><div className="activity-item"><span className="activity-icon lavender"><Bot size={15} /></span><p><b>QA bot</b> flagged a regression risk<a>Release note</a><small>31 min ago</small></p></div>
        {activity.map((item) => <div className="activity-item learner-activity" key={item.id}><span className="activity-icon blue"><Check size={15} /></span><p><b>You</b> {item.text}<small>just now</small></p></div>)}
      </section>
    </div>
  </div>
}

function TeamSpaceView({ space, messages, followUps, draft, setDraft, sendMessage, sendThreadReply, updateSpace, updateMessage, deleteMessage, togglePinMessage, markMessage, createFollowUp, completeFollowUp, resolveThread, archiveSpace, unarchiveSpace, learnerName, openAgentPortfolio }: { space: TeamSpace; messages: TeamMessage[]; allMessages: TeamMessage[]; followUps: FollowUp[]; draft: string; setDraft: (value: string) => void; sendMessage: (attachment?: TeamAttachment) => void; sendThreadReply: (message: string, threadId: number) => void; updateSpace: (space: TeamSpace) => void; updateMessage: (id: number, text: string) => void; deleteMessage: (id: number) => void; togglePinMessage: (id: number) => void; markMessage: (id: number, tag: MessageTag) => void; createFollowUp: (id: number) => void; completeFollowUp: (id: string) => void; resolveThread: (id: number) => void; archiveSpace: (id: string) => void; unarchiveSpace: (id: string) => void; learnerName: string; openAgentPortfolio: (id: string) => void }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'messages' | 'decisions' | 'files' | 'tasks' | 'activity'>('messages')
  const [threadId, setThreadId] = useState<number | null>(null)
  const [threadDraft, setThreadDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [nameDraft, setNameDraft] = useState(space.name)
  const [descriptionDraft, setDescriptionDraft] = useState(space.description || '')
  const [purposeDraft, setPurposeDraft] = useState(space.purpose || '')
  const [guidelinesDraft, setGuidelinesDraft] = useState(space.guidelines || '')
  const [spaceTypeDraft, setSpaceTypeDraft] = useState<SpaceType>(space.spaceType || 'general')
  const [ownerDraft, setOwnerDraft] = useState(space.ownerId || 'maya')
  const [visibilityDraft, setVisibilityDraft] = useState<TeamSpace['visibility']>(space.visibility || 'team')
  const [memberIds, setMemberIds] = useState(space.memberIds || ['maya', 'noah', 'adele', 'devon', 'you'])
  useEffect(() => {
    setNameDraft(space.name); setDescriptionDraft(space.description || ''); setPurposeDraft(space.purpose || ''); setGuidelinesDraft(space.guidelines || '')
    setSpaceTypeDraft(space.spaceType || 'general'); setOwnerDraft(space.ownerId || 'maya'); setVisibilityDraft(space.visibility || 'team')
    setMemberIds(space.memberIds || ['maya', 'noah', 'adele', 'devon', 'you']); setSettingsOpen(false); setThreadId(null)
  }, [space.id, space.name, space.description, space.purpose, space.guidelines, space.spaceType, space.ownerId, space.visibility, space.memberIds])
  const agentIdFor = (message: TeamMessage) => message.author === 'You' ? 'you' : message.author.startsWith('Maya') ? 'maya' : message.author.startsWith('Noah') ? 'noah' : message.author.startsWith('Adele') ? 'adele' : 'devon'
  const roots = messages.filter((message) => !message.threadId)
  const members = memberIds.map((id) => mentionOptions.find((option) => option.id === id)).filter(Boolean)
  const owner = mentionOptions.find((member) => member.id === space.ownerId) || mentionOptions[0]
  const pinnedMessages = roots.filter((message) => message.pinned || (space.pinnedMessageIds || []).includes(message.id))
  const decisionMessages = roots.filter((message) => message.tags?.some((tag) => ['decision', 'risk', 'blocker', 'handoff'].includes(tag)))
  const fileMessages = messages.filter((message) => message.attachment)
  const spaceFollowUps = followUps.filter((item) => messages.some((message) => message.id === item.sourceMessageId))
  const openThreads = roots.filter((message) => messages.some((reply) => reply.threadId === message.id) && !message.resolved).length
  const saveSettings = () => {
    updateSpace({ ...space, name: nameDraft, description: descriptionDraft.trim() || purposeDraft.trim() || 'A focused space for decisions, updates, and working context.', purpose: purposeDraft.trim(), guidelines: guidelinesDraft.trim(), spaceType: spaceTypeDraft, ownerId: ownerDraft, visibility: visibilityDraft, memberIds })
    setSettingsOpen(false)
  }
  const toggleMember = (id: string) => setMemberIds((ids) => (space.requiredMemberIds || ['you']).includes(id) ? ids : ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])
  const renderMessage = (message: TeamMessage, messageIndex: number) => {
    const agentId = agentIdFor(message)
    const replies = messages.filter((item) => item.threadId === message.id)
    const followUp = message.followUpId ? followUps.find((item) => item.id === message.followUpId) : null
    return <div className={`message-block org-message-block ${message.resolved ? 'resolved-thread' : ''}`} key={`message-${message.id}-${message.spaceId}-${messageIndex}`}>
      <div className="message channel-message">
        <Avatar id={agentId} tone={message.tone} />
        <div className="message-content">
          <div className="message-meta">{agentId !== 'you' ? <button className="agent-name" onClick={() => openAgentPortfolio(agentId)}>{message.author}</button> : <b>{message.author}</b>}<span>{message.role}</span><time>{message.time}{message.edited && ' - edited'}</time></div>
          {editingId === message.id ? <div className="edit-message"><input autoFocus value={editDraft} onChange={(event) => setEditDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { updateMessage(message.id, editDraft); setEditingId(null) } }} /><button onClick={() => { updateMessage(message.id, editDraft); setEditingId(null) }}><Check size={13} /></button><button onClick={() => setEditingId(null)}><X size={13} /></button></div> : <><p><MessageText text={message.text} openAgentPortfolio={openAgentPortfolio} /> {message.link && <a>{message.link}</a>}</p>{message.tags?.length ? <div className="message-tags">{message.tags.map((tag) => <span className={`message-tag ${tag}`} key={tag}>{tagLabels[tag]}</span>)}</div> : null}{message.attachment && <span className="message-attachment"><FileText size={13} /> {message.attachment.name}<small>{Math.max(1, Math.round(message.attachment.size / 1024))} KB</small></span>}</>}
          {followUp && <div className={`message-followup ${followUp.status}`}><ListChecks size={13} /><span><b>{followUp.status === 'done' ? 'Completed follow-up' : 'Open follow-up'}</b>{followUp.title}</span>{followUp.status === 'open' && <button onClick={() => completeFollowUp(followUp.id)}>Complete</button>}</div>}
          <div className="message-actions org-message-actions">
            <button onClick={() => { setThreadId(threadId === message.id ? null : message.id); setThreadDraft('') }}><Reply size={13} /> {replies.length ? `${replies.length} replies` : 'Reply'}</button>
            <button onClick={() => togglePinMessage(message.id)}>{message.pinned ? <PinOff size={13} /> : <Pin size={13} />} {message.pinned ? 'Unpin' : 'Pin'}</button>
            <button onClick={() => markMessage(message.id, 'decision')}><BadgeCheck size={13} /> Decision</button>
            <button onClick={() => markMessage(message.id, 'risk')}><Flag size={13} /> Risk</button>
            <button onClick={() => createFollowUp(message.id)}><ListChecks size={13} /> Follow-up</button>
            {replies.length > 0 && !message.resolved && <button onClick={() => resolveThread(message.id)}><Check size={13} /> Resolve</button>}
            {message.author === 'You' && <><button onClick={() => { setEditingId(message.id); setEditDraft(message.text) }}><Pencil size={12} /> Edit</button><button onClick={() => deleteMessage(message.id)}><Trash2 size={12} /> Delete</button></>}
          </div>
        </div>
      </div>
      {threadId === message.id && <div className="thread-panel org-thread-panel">
        <div className="thread-head"><b>{message.resolved ? 'Resolved thread' : 'Open thread'}</b><span>{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}</span></div>
        {replies.map((reply, replyIndex) => <div className="thread-reply" key={`${reply.id}-${reply.spaceId}-${replyIndex}`}><Avatar id={agentIdFor(reply)} tone={reply.tone} small /><span><strong>{reply.author}</strong> {reply.text || (reply.attachment ? `Shared ${reply.attachment.name}` : '')}<small>{reply.time}{reply.edited && ' - edited'}</small></span></div>)}
        <div className="thread-composer"><input value={threadDraft} onChange={(event) => setThreadDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && threadDraft.trim()) { sendThreadReply(threadDraft, message.id); setThreadDraft('') } }} placeholder="Reply with a focused update" /><button onClick={() => { if (threadDraft.trim()) { sendThreadReply(threadDraft, message.id); setThreadDraft('') } }}><Send size={14} /></button></div>
      </div>}
    </div>
  }
  return <div className="page team-space-page org-team-space-page">
    <section className="channel-hero org-channel-hero">
      <div><p className="eyebrow">{(space.spaceType || 'general').toUpperCase()} SPACE</p><h1><span>#</span> {space.name}</h1><p>{space.purpose || space.description || 'Decisions and updates shared with the SignalDesk team.'}</p><div className="space-meta-strip"><span><UsersRound size={13} /> {members.length} members</span><span><BadgeCheck size={13} /> Owner: {owner.label}</span><span><ShieldCheck size={13} /> {space.visibility}</span><span><Clock3 size={13} /> {space.retentionPolicy}</span></div></div>
      <div className="channel-members"><div className="avatar-stack">{members.slice(0, 5).map((member) => <Avatar key={member!.id} id={member!.id} tone={member!.tone} small />)}</div><button className="soft-icon" onClick={() => setSettingsOpen(!settingsOpen)} aria-label="Edit team space"><Settings2 size={16} /></button>{space.archived ? <button className="soft-icon" onClick={() => unarchiveSpace(space.id)} aria-label="Reopen team space"><ArchiveRestore size={16} /></button> : <button className="soft-icon" onClick={() => archiveSpace(space.id)} aria-label="Archive team space"><Archive size={16} /></button>}</div>
    </section>
    {settingsOpen && <section className="channel-settings org-channel-settings card">
      <div><span className="eyebrow">SPACE GOVERNANCE</span><h3>Keep the channel accountable</h3></div>
      <label>Name<input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} /></label>
      <label>Type<select value={spaceTypeDraft} onChange={(event) => setSpaceTypeDraft(event.target.value as SpaceType)}><option value="project">Project</option><option value="engineering">Engineering</option><option value="release">Release</option><option value="incident">Incident</option><option value="general">General</option></select></label>
      <label>Owner<select value={ownerDraft} onChange={(event) => setOwnerDraft(event.target.value)}>{mentionOptions.filter((member) => member.id !== 'you').map((member) => <option value={member.id} key={member.id}>{member.label}</option>)}</select></label>
      <label>Visibility<select value={visibilityDraft} onChange={(event) => setVisibilityDraft(event.target.value as TeamSpace['visibility'])}><option value="team">Team</option><option value="organization">Organization</option><option value="restricted">Restricted</option></select></label>
      <label>Description<textarea value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} /></label>
      <label>Purpose<textarea value={purposeDraft} onChange={(event) => setPurposeDraft(event.target.value)} /></label>
      <label>Posting guidelines<textarea value={guidelinesDraft} onChange={(event) => setGuidelinesDraft(event.target.value)} /></label>
      <div className="member-picker"><b><UserPlus size={14} /> Members</b><div>{mentionOptions.map((member) => <button key={member.id} className={memberIds.includes(member.id) ? 'selected-member' : ''} onClick={() => toggleMember(member.id)}><Avatar id={member.id} tone={member.tone} small /> {member.label}{(space.requiredMemberIds || ['you']).includes(member.id) && <small>Required</small>}</button>)}</div></div>
      <div className="settings-actions"><button className="ghost-button" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="primary-button" onClick={saveSettings}><Check size={15} /> Save governance</button></div>
    </section>}
    <section className="space-context-row">
      <article className="card"><Pin size={16} /><span><b>{pinnedMessages.length}</b>Pinned context</span></article>
      <article className="card"><BadgeCheck size={16} /><span><b>{decisionMessages.length}</b>Decisions and risks</span></article>
      <article className="card"><ListChecks size={16} /><span><b>{spaceFollowUps.filter((item) => item.status === 'open').length}</b>Open follow-ups</span></article>
      <article className="card"><Reply size={16} /><span><b>{openThreads}</b>Open threads</span></article>
    </section>
    <section className="org-channel-layout">
      <article className="channel-thread org-channel-thread">
        <div className="space-tabs"><button className={activeTab === 'messages' ? 'selected' : ''} onClick={() => setActiveTab('messages')}>Messages</button><button className={activeTab === 'decisions' ? 'selected' : ''} onClick={() => setActiveTab('decisions')}>Decisions</button><button className={activeTab === 'files' ? 'selected' : ''} onClick={() => setActiveTab('files')}>Files</button><button className={activeTab === 'tasks' ? 'selected' : ''} onClick={() => setActiveTab('tasks')}>Tasks</button><button className={activeTab === 'activity' ? 'selected' : ''} onClick={() => setActiveTab('activity')}>Activity</button></div>
        {activeTab === 'messages' && <><div className="channel-notice"><MessageSquare size={16} /><span>{space.guidelines || 'Keep decisions discoverable for the whole team.'}</span></div><div className="channel-messages">{roots.map(renderMessage)}</div><MentionComposer className="channel-composer" draft={draft} setDraft={setDraft} sendMessage={sendMessage} placeholder={`Message #${space.name}`} /></>}
        {activeTab === 'decisions' && <div className="decision-log">{decisionMessages.length ? decisionMessages.map((message, index) => <article className="card" key={`decision-${message.id}-${message.spaceId}-${index}`}><div><span className="message-tags">{message.tags?.map((tag) => <span className={`message-tag ${tag}`} key={tag}>{tagLabels[tag]}</span>)}</span><h3>{message.link || message.text.slice(0, 90)}</h3><p>{message.text}</p><small>{message.author} - {message.time}</small></div><button className="ghost-button" onClick={() => setThreadId(message.id)}><Reply size={13} /> Open thread</button></article>) : <p className="empty-org-panel">No decisions, risks, or blockers have been marked yet.</p>}</div>}
        {activeTab === 'files' && <div className="file-register">{fileMessages.length ? fileMessages.map((message, index) => <article className="card" key={`file-${message.id}-${message.spaceId}-${index}`}><FileText size={17} /><span><b>{message.attachment?.name}</b><small>{message.author} - {Math.max(1, Math.round((message.attachment?.size || 0) / 1024))} KB</small></span></article>) : <p className="empty-org-panel">No artifacts have been attached in this space.</p>}</div>}
        {activeTab === 'tasks' && <div className="followup-register">{spaceFollowUps.length ? spaceFollowUps.map((item) => <article className={`card ${item.status}`} key={item.id}><ListChecks size={17} /><span><b>{item.title}</b><small>Owner: {learnerName} - Source message #{item.sourceMessageId}</small></span>{item.status === 'open' ? <button className="primary-button" onClick={() => completeFollowUp(item.id)}>Complete</button> : <span className="helper-success"><Check size={13} /> Done</span>}</article>) : <p className="empty-org-panel">No follow-ups have been created from messages.</p>}</div>}
        {activeTab === 'activity' && <div className="activity-register">{roots.map((message, index) => <article key={`activity-${message.id}-${message.spaceId}-${index}`}><CircleDot size={13} /><span><b>{message.author}</b>{message.pinned ? 'Pinned context' : message.tags?.length ? `Marked ${message.tags.map((tag) => tagLabels[tag]).join(', ')}` : 'Posted message'}<small>{message.time}</small></span></article>)}</div>}
      </article>
      <aside className="channel-details org-channel-details">
        <span className="eyebrow">PINNED CONTEXT</span>{pinnedMessages.length ? pinnedMessages.map((message, index) => <button className="pinned-context" key={`pinned-${message.id}-${message.spaceId}-${index}`} onClick={() => setThreadId(message.id)}><Pin size={13} /><span>{message.text.slice(0, 96)}<small>{message.author}</small></span></button>) : <p>No pinned context yet.</p>}
        <hr /><span className="eyebrow">LINKED WORK</span><div className="linked-work-list">{(space.linkedIssueIds || []).map((issueId) => <span key={issueId}><Link2 size={13} /> {issueId}</span>)}</div>
        <hr /><span className="eyebrow">MEMBERS</span>{members.map((member) => <button className="channel-member" key={member!.id} onClick={() => member!.id === 'you' ? undefined : openAgentPortfolio(member!.id)}><Avatar id={member!.id} tone={member!.tone} small /> {member!.label} <span>{member!.id === 'you' ? 'You' : member!.role}</span></button>)}
      </aside>
    </section>
  </div>
}

function LegacyTeamSpaceView({ space, messages, draft, setDraft, sendMessage, sendThreadReply, updateSpace, updateMessage, deleteMessage, openAgentPortfolio }: { space: TeamSpace; messages: TeamMessage[]; draft: string; setDraft: (value: string) => void; sendMessage: (attachment?: TeamAttachment) => void; sendThreadReply: (message: string, threadId: number) => void; updateSpace: (space: TeamSpace) => void; updateMessage: (id: number, text: string) => void; deleteMessage: (id: number) => void; openAgentPortfolio: (id: string) => void }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [threadId, setThreadId] = useState<number | null>(null)
  const [threadDraft, setThreadDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [nameDraft, setNameDraft] = useState(space.name)
  const [descriptionDraft, setDescriptionDraft] = useState(space.description || '')
  const [memberIds, setMemberIds] = useState(space.memberIds || ['maya', 'noah', 'adele', 'devon', 'you'])
  useEffect(() => { setNameDraft(space.name); setDescriptionDraft(space.description || ''); setMemberIds(space.memberIds || ['maya', 'noah', 'adele', 'devon', 'you']); setSettingsOpen(false); setThreadId(null) }, [space.id, space.name, space.description, space.memberIds])
  const agentIdFor = (message: TeamMessage) => message.author === 'You' ? '' : message.author.startsWith('Maya') ? 'maya' : message.author.startsWith('Noah') ? 'noah' : message.author.startsWith('Adele') ? 'adele' : 'devon'
  const roots = messages.filter((message) => !message.threadId)
  const members = memberIds.map((id) => mentionOptions.find((option) => option.id === id)).filter(Boolean)
  const saveSettings = () => { updateSpace({ ...space, name: nameDraft, description: descriptionDraft.trim() || 'A focused space for decisions, updates, and working context.', memberIds }); setSettingsOpen(false) }
  const toggleMember = (id: string) => setMemberIds((ids) => id === 'you' ? ids : ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])
  return <div className="page team-space-page">
    <section className="channel-hero"><div><p className="eyebrow">TEAM SPACE</p><h1><span>#</span> {space.name}</h1><p>{space.description || 'Decisions and updates shared with the SignalDesk team.'}</p></div><div className="channel-members"><div className="avatar-stack">{members.slice(0, 4).map((member) => <Avatar key={member!.id} id={member!.id} tone={member!.tone} small />)}</div><span>{members.length} members</span><button className="soft-icon" onClick={() => setSettingsOpen(!settingsOpen)} aria-label="Edit team space"><Settings2 size={16} /></button></div></section>
    {settingsOpen && <section className="channel-settings card"><div><span className="eyebrow">SPACE SETTINGS</span><h3>Keep the channel useful</h3></div><label>Name<input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} /></label><label>Description<textarea value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} /></label><div className="member-picker"><b><UserPlus size={14} /> Members</b><div>{mentionOptions.map((member) => <button key={member.id} className={memberIds.includes(member.id) ? 'selected-member' : ''} onClick={() => toggleMember(member.id)}><Avatar id={member.id} tone={member.tone} small /> {member.label}{member.id === 'you' && <small>Required</small>}</button>)}</div></div><div className="settings-actions"><button className="ghost-button" onClick={() => setSettingsOpen(false)}>Cancel</button><button className="primary-button" onClick={saveSettings}><Check size={15} /> Save space</button></div></section>}
    <section className="channel-layout"><article className="channel-thread"><div className="channel-notice"><MessageSquare size={16} /><span>This is the beginning of <b>#{space.name}</b>. Keep updates discoverable for the whole team.</span></div><div className="channel-messages">{roots.map((message, rootIndex) => { const agentId = agentIdFor(message); const replies = messages.filter((item) => item.threadId === message.id); return <div className="message-block" key={`${message.id}-${message.spaceId}-${rootIndex}`}><div className="message channel-message"><Avatar id={agentId || 'you'} tone={message.tone} /><div className="message-content"><div className="message-meta">{agentId ? <button className="agent-name" onClick={() => openAgentPortfolio(agentId)}>{message.author}</button> : <b>{message.author}</b>}<span>{message.role}</span><time>{message.time}{message.edited && ' · edited'}</time></div>{editingId === message.id ? <div className="edit-message"><input autoFocus value={editDraft} onChange={(event) => setEditDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { updateMessage(message.id, editDraft); setEditingId(null) } }} /><button onClick={() => { updateMessage(message.id, editDraft); setEditingId(null) }}><Check size={13} /></button><button onClick={() => setEditingId(null)}><X size={13} /></button></div> : <><p><MessageText text={message.text} openAgentPortfolio={openAgentPortfolio} /> {message.link && <a>{message.link}</a>}</p>{message.attachment && <span className="message-attachment"><FileText size={13} /> {message.attachment.name}<small>{Math.max(1, Math.round(message.attachment.size / 1024))} KB</small></span>}</>}<div className="message-actions"><button onClick={() => { setThreadId(threadId === message.id ? null : message.id); setThreadDraft('') }}><Reply size={13} /> {replies.length ? `${replies.length} replies` : 'Reply in thread'}</button>{message.author === 'You' && <><button onClick={() => { setEditingId(message.id); setEditDraft(message.text) }}><Pencil size={12} /> Edit</button><button onClick={() => deleteMessage(message.id)}><Trash2 size={12} /> Delete</button></>}</div></div></div>{threadId === message.id && <div className="thread-panel"><b>Thread</b>{replies.map((reply, replyIndex) => <div className="thread-reply" key={`${reply.id}-${reply.spaceId}-${replyIndex}`}><Avatar id={agentIdFor(reply) || 'you'} tone={reply.tone} small /><span><strong>{reply.author}</strong> {reply.text || (reply.attachment ? `Shared ${reply.attachment.name}` : '')}<small>{reply.time}{reply.edited && ' · edited'}</small></span></div>)}<div className="thread-composer"><input value={threadDraft} onChange={(event) => setThreadDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && threadDraft.trim()) { sendThreadReply(threadDraft, message.id); setThreadDraft('') } }} placeholder="Reply in thread"/><button onClick={() => { if (threadDraft.trim()) { sendThreadReply(threadDraft, message.id); setThreadDraft('') } }}><Send size={14} /></button></div></div>}</div>})}</div><MentionComposer className="channel-composer" draft={draft} setDraft={setDraft} sendMessage={sendMessage} placeholder={`Message #${space.name}`}/></article>
      <aside className="channel-details"><span className="eyebrow">ABOUT THIS SPACE</span><h3>Team context</h3><p>{space.description || 'Decisions and updates shared with the SignalDesk team.'}</p><hr/><span className="eyebrow">MEMBERS</span>{members.map((member) => <button className="channel-member" key={member!.id} onClick={() => member!.id === 'you' ? undefined : openAgentPortfolio(member!.id)}><Avatar id={member!.id} tone={member!.tone} small /> {member!.label} <span>{member!.id === 'you' ? 'You' : member!.role}</span></button>)}</aside></section>
  </div>
}

function AgentPortfolioView({ agent, openTeamSpace }: { agent: AgentPortfolio; openTeamSpace: () => void }) {
  return <div className="page portfolio-page">
    <section className="portfolio-hero"><div className={`portfolio-avatar ${agent.tone}`}>{agent.initials}</div><div><p className="eyebrow">AI TEAMMATE PORTFOLIO</p><h1>{agent.name}</h1><span className="portfolio-role">{agent.role}</span><p>{agent.headline}</p></div><button className="primary-button" onClick={openTeamSpace}><MessageSquare size={16} /> Message {agent.name.split(' ')[0]}</button></section>
    <div className="portfolio-grid"><section className="card portfolio-summary"><span className="eyebrow">ROLE MANDATE</span><h2>How {agent.name.split(' ')[0]} contributes</h2><p>{agent.bio}</p><div className="portfolio-section"><span className="eyebrow">COLLABORATION STYLE</span><p>{agent.collaborationStyle}</p></div></section><section className="card portfolio-focus"><span className="eyebrow">CURRENT COMMITMENTS</span><h2>What they’re focused on</h2>{agent.currentFocus.map((item) => <div className="focus-row" key={item}><CircleDot size={15} /> {item}</div>)}<button className="ghost-button" onClick={openTeamSpace}>Open their team space <ArrowRight size={14} /></button></section></div>
    <div className="portfolio-grid lower-portfolio"><section className="card"><span className="eyebrow">CORE STRENGTHS</span><h2>Working toolkit</h2><div className="strength-tags">{agent.strengths.map((strength) => <span key={strength}>{strength}</span>)}</div></section><section className="card"><span className="eyebrow">ORGANIZATION EVIDENCE</span><h2>Recent contribution trail</h2><div className="evidence-trail">{agent.evidence.map((item) => <div key={item}><Check size={15} /> {item}</div>)}</div></section></div>
  </div>
}

function IssuesView({ setView }: { setView: (v: View) => void }) {
  const columns = [
    { name: 'To do', count: 2, cards: [['PROJ-184', 'Build the usage alerts empty state', 'high'], ['PROJ-191', 'Add limit badge to settings nav', 'medium']] },
    { name: 'In progress', count: 2, cards: [['PROJ-176', 'Harden billing event mapper', 'blocked'], ['PROJ-189', 'Usage chart tooltips', 'medium']] },
    { name: 'In review', count: 1, cards: [['PROJ-179', 'Loading state for alert rules', 'review']] },
    { name: 'Done', count: 2, cards: [['PROJ-170', 'Plan usage API contract', 'done'], ['PROJ-168', 'Refresh usage dashboard copy', 'done']] },
  ]
  return <div className="page board-page"><section className="page-title"><div><p className="eyebrow">SPRINT 2 · SEPT 16–27</p><h1>Product usage</h1><p>Keep the Pro plan experience coherent as usage features expand.</p></div><button className="primary-button"><Plus size={16} /> New issue</button></section><div className="board-toolbar"><div className="tabs"><button className="selected">Board</button><button>All issues</button><button>Planning</button></div><div><button className="filter-button">Filter <ChevronDown size={15} /></button><button className="filter-button">Group: Status <ChevronDown size={15} /></button></div></div><div className="board">{columns.map((column) => <div className="board-column" key={column.name}><div className="column-head"><b>{column.name}</b><span>{column.count}</span><MoreHorizontal size={17} /></div>{column.cards.map(([id, title, state]) => <article className="issue-card" key={id} onClick={() => id === 'PROJ-184' && setView('workspace')}><div className="issue-card-top"><span className={`status-dot ${state}`} /><small>{id}</small><MoreHorizontal size={15} /></div><h3>{title}</h3><div className="issue-card-footer"><span className={`pill ${state === 'high' ? 'coral-pill' : state === 'blocked' ? 'blocked-pill' : state === 'review' ? 'sky-pill' : 'muted-pill'}`}>{state === 'high' ? 'HIGH' : state === 'blocked' ? 'BLOCKED' : state === 'review' ? 'IN REVIEW' : state === 'done' ? 'DONE' : 'MEDIUM'}</span><span>3 pts</span><Avatar id={id === 'PROJ-184' ? 'you' : id === 'PROJ-176' ? 'noah' : 'maya'} tone={id === 'PROJ-176' ? 'mint' : 'blue'} small /></div></article>)}</div>)}</div></div>
}

function WorkspaceView({ testsPassed, committed, runTests, commit, openPr }: { testsPassed: boolean; committed: boolean; runTests: () => void; commit: () => void; openPr: () => void }) {
  return <div className="workspace-page"><div className="workspace-header"><div><GitBranch size={16} /><b>feat/usage-alerts-empty-state</b><span>ahead 1</span></div><div><button className="terminal-button"><TerminalSquare size={16} /> Terminal</button><button className="test-button" onClick={runTests}><Play size={15} /> {testsPassed ? '12 checks passed' : 'Run checks'}</button><button className="primary-button" onClick={openPr}>Open pull request</button></div></div><div className="editor-shell"><aside className="file-tree"><div className="tree-title"><b>EXPLORER</b><MoreHorizontal size={15} /></div><div className="repo-title"><ChevronDown size={14} /> signaldesk-web</div><div className="tree-folder"><ChevronDown size={14} /> src</div><div className="tree-folder nested"><ChevronDown size={14} /> features</div><div className="tree-folder nested-2"><ChevronDown size={14} /> usage-alerts</div><div className="tree-file active-file"><FileCode2 size={15} /> alerts-panel.tsx</div><div className="tree-file"><FileCode2 size={15} /> alert-list.tsx</div><div className="tree-file"><FileCode2 size={15} /> types.ts</div><div className="tree-folder"><ChevronDown size={14} /> components</div><div className="tree-file"><FileCode2 size={15} /> empty-state.tsx</div><div className="tree-file"><FileCode2 size={15} /> package.json</div><div className="source-control"><GitBranch size={16} /><span>Source control</span><b>1</b></div></aside><section className="editor"><div className="editor-tabs"><div className="editor-tab active-tab"><FileCode2 size={15} /> alerts-panel.tsx <X size={13} /></div><button>+</button></div><div className="breadcrumbs">src <span>›</span> features <span>›</span> usage-alerts <span>›</span> alerts-panel.tsx</div><pre className="code-view">{code.split('\n').map((line, index) => <code key={index}><i>{String(index + 1).padStart(2, ' ')}</i>{line}</code>)}</pre><div className="editor-status"><span><span className="dot-green" /> TypeScript React</span><span>Ln 16, Col 4</span><span>Spaces: 2</span><span>UTF-8</span></div></section><aside className="context-panel"><div className="context-top"><Bot size={17} /><b>AI teammate context</b></div><div className="context-role"><Avatar id="noah" tone="mint" /><div><b>Noah · Tech lead</b><span>Review note on this task</span></div></div><blockquote>“Remember that some legacy workspaces have no threshold field. The empty state must not depend on it.”</blockquote><button className="context-link">Open API contract <ArrowRight size={14} /></button><hr/><span className="eyebrow">MERGE REQUIREMENTS</span><div className="requirement"><Check size={15} /> Branch checks pass</div><div className="requirement"><span /> 1 approving review</div><div className="requirement"><span /> Merge rationale</div><button className={committed ? 'commit-button committed' : 'commit-button'} onClick={commit}>{committed ? <><Check size={15} /> Changes committed</> : 'Commit changes'}</button></aside></div></div>
}

function PullsView({ prOpen, reviewAddressed, setReviewAddressed, notify }: { prOpen: boolean; reviewAddressed: boolean; setReviewAddressed: (v: boolean) => void; notify: (m: string, t?: 'success' | 'warning') => void }) {
  return <div className="page pulls-page"><section className="page-title"><div><p className="eyebrow">CODE REVIEW</p><h1>Pull requests</h1><p>Reviews are part of the work. Respond thoughtfully and keep the release train moving.</p></div><button className="primary-button"><Plus size={16} /> New pull request</button></section><div className="pull-tabs"><button className="selected">Open <b>{prOpen ? 2 : 1}</b></button><button>Closed</button><button>Drafts</button></div>{prOpen && <article className="pr-detail"><div className="pr-header"><div><span className="open-dot" /> <b>PR #482</b><h2>Build the usage alerts empty state</h2><p>Alex Morgan wants to merge 1 commit into <code>main</code> from <code>feat/usage-alerts-empty-state</code></p></div><span className="pill sky-pill">OPEN</span></div><div className="pr-layout"><div><div className="checks"><ShieldCheck size={19} /><div><b>All checks have passed</b><span>12 checks completed in 38s</span></div><button>View checks</button></div><section className="review-thread"><div className="review-head"><Avatar id="noah" tone="mint" /><div><b>Noah Patel <span>requested changes</span></b><small>8 min ago</small></div></div><p>Nice start. One concern: we should avoid linking users directly to billing settings if their role can’t manage plans. Can you use the existing <code>canManageBilling</code> guard?</p><div className="thread-actions"><button>Reply</button><button onClick={() => { setReviewAddressed(true); notify('Review marked as addressed. Add a response before merging.') }}>{reviewAddressed ? <><Check size={14} /> Addressed</> : 'Mark as addressed'}</button></div></section></div><aside className="merge-panel"><span className="eyebrow">MERGE GATE</span><h3>{reviewAddressed ? 'One step left' : 'Changes requested'}</h3><p>{reviewAddressed ? 'Write a merge rationale after Noah approves the update.' : 'Address Noah’s review before this pull request can merge.'}</p><div className="gate-row"><Check size={15} /> Checks passing</div><div className="gate-row"><Check size={15} className={reviewAddressed ? 'ready' : ''} /> Review response</div><div className="gate-row"><span /> Required approval</div><button className="merge-button" onClick={() => notify('Merge is locked until an approving review and rationale are recorded.', 'warning')}><Lock size={15} /> Merge blocked</button></aside></div></article>}{!prOpen && <article className="empty-pr"><GitBranch size={28} /><h2>No pull request yet</h2><p>Once you commit your work, open a pull request to invite reviews and start the merge gate.</p></article>}<article className="pr-row"><span className="open-dot" /><div><b>PR #479</b><h3>Polish loading state for alert rules</h3><p>Devon Reeves · Waiting for your response</p></div><span className="pill coral-pill">1 COMMENT</span></article></div>
}

function FeedbackView({ progress }: { progress: number }) {
  const score = 68 + progress * 4
  return <div className="page feedback-page"><section className="page-title"><div><p className="eyebrow">PRIVATE COACHING</p><h1>How you’re working</h1><p>Evidence-based feedback from your actions in this organization. This is visible only to you.</p></div><span className="private-badge"><Lock size={14} /> Private</span></section><div className="coaching-hero"><div><span className="eyebrow">CURRENT SPRINT SIGNAL</span><h2>You’re building momentum.</h2><p>You picked up the highest-priority task and have a clear next action. Keep the team looped in before you commit to an API assumption.</p><button className="secondary-button">See coaching guide <ArrowRight size={15} /></button></div><ScoreRing score={score} label="Work readiness" accent="#7c70f2" /></div><div className="score-grid"><ScoreRing score={76} label="Technical execution" accent="#3eae90" /><ScoreRing score={Math.min(95, 55 + progress * 7)} label="Collaboration" accent="#7c70f2" /><ScoreRing score={70 + progress * 3} label="Ownership & reliability" accent="#ee9d5c" /><ScoreRing score={standaloneProcess(progress)} label="Process fit" accent="#5899e7" /></div><div className="feedback-columns"><section className="card evidence-card"><div className="section-head"><div><span className="eyebrow">EVIDENCE FROM THIS SPRINT</span><h2>What we’re observing</h2></div></div><div className="evidence positive"><span><Check size={16} /></span><div><b>Priority awareness</b><p>You selected a high-priority sprint item before lower-impact work.</p></div></div><div className="evidence action"><span><MessageSquare size={16} /></span><div><b>Opportunity: clarify early</b><p>Noah identified an API edge case. Ask one concrete question before implementation to strengthen your decision trail.</p></div></div><div className="evidence neutral"><span><Clock3 size={16} /></span><div><b>Process signal pending</b><p>Complete your stand-up and review cycle to unlock feedback on reliability.</p></div></div></section><section className="card path-card"><span className="eyebrow">NEXT GROWTH STEP</span><h2>Make your assumptions visible</h2><p>Strong engineers expose uncertainty early, especially when working in legacy systems.</p><div className="coach-tip"><Bot size={18} /><span>Try: “Noah, for legacy workspaces without a threshold, should the empty state still show the plan CTA?”</span></div><button className="primary-button">Practice this message <ArrowRight size={15} /></button></section></div></div>
}

function standaloneProcess(progress: number) { return Math.min(92, 48 + progress * 8) }

export default App

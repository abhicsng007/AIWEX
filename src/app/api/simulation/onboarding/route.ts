import { NextRequest, NextResponse } from 'next/server'
import { accessCatalog, deriveOnboardingState, evaluateReadinessAnswers, nextScheduleStart, policyRequirements, publicOnboardingState, quizAnswerFeedback, readinessQuestions, trainingSlides } from '@/features/simulator/domain/onboarding'
import { inMemoryEventStore } from '@/features/simulator/server/event-store'
import type { SimulationEvent } from '@/features/simulator/domain/types'
import { simulationRunIdentity } from '@/features/auth/server-auth'

const append = (organizationId: string, type: SimulationEvent['type'], metadata: Record<string, string | number | boolean> = {}): SimulationEvent => ({ id: crypto.randomUUID(), organizationId, type, createdAt: new Date().toISOString(), metadata })
const publicReadinessQuestions = () => readinessQuestions.map(({ correctOption, ...question }) => question)

export async function GET(request: NextRequest) {
  const identity = await simulationRunIdentity(request, request.nextUrl.searchParams.get('organizationId'))
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  try { return NextResponse.json({ state: publicOnboardingState(deriveOnboardingState(await inMemoryEventStore.list(identity.runId))), slides: trainingSlides.map(({ correctOption, ...slide }) => slide), readinessQuestions: publicReadinessQuestions() }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Onboarding is unavailable.' }, { status: 503 }) }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { organizationId?: string; action?: 'start' | 'confirm_profile' | 'acknowledge_policy' | 'provision_access' | 'submit_quiz' | 'resume_readiness' | 'submit_readiness'; policyId?: string; accessId?: string; slideId?: string; answer?: number; answers?: Record<string, number> }
  if (!body.action) return NextResponse.json({ error: 'An onboarding action is required' }, { status: 400 })
  const identity = await simulationRunIdentity(request, body.organizationId)
  if (!identity) return NextResponse.json({ error: 'Sign in to access this simulation run.' }, { status: 401 })
  const organizationId = identity.runId
  const events = await inMemoryEventStore.list(organizationId)
  const state = deriveOnboardingState(events)
  if (body.action === 'start') {
    if (state.phase !== 'not_started') return NextResponse.json({ state: publicOnboardingState(state), slides: trainingSlides.map(({ correctOption, ...slide }) => slide), readinessQuestions: publicReadinessQuestions() })
    await inMemoryEventStore.append(append(organizationId, 'onboarding_started'))
  }
  if (body.action === 'confirm_profile') {
    if (state.phase !== 'profile') return NextResponse.json({ error: 'Confirm the employee profile after onboarding has started.' }, { status: 409 })
    await inMemoryEventStore.append(append(organizationId, 'onboarding_profile_confirmed', { employeeId: state.profile.employeeId, role: state.profile.role, manager: state.profile.manager }))
  }
  if (body.action === 'acknowledge_policy') {
    if (state.phase !== 'policy') return NextResponse.json({ error: 'Policy acknowledgements are not currently open.' }, { status: 409 })
    const policy = policyRequirements.find((item) => item.id === body.policyId)
    if (!policy) return NextResponse.json({ error: 'A valid policyId is required.' }, { status: 400 })
    if (!state.acknowledgedPolicyIds.includes(policy.id)) await inMemoryEventStore.append(append(organizationId, 'policy_acknowledged', { policyId: policy.id, owner: policy.owner, evidence: policy.evidence }))
  }
  if (body.action === 'provision_access') {
    if (state.phase !== 'access') return NextResponse.json({ error: 'Access provisioning is not currently open.' }, { status: 409 })
    const access = accessCatalog.find((item) => item.id === body.accessId)
    if (!access) return NextResponse.json({ error: 'A valid accessId is required.' }, { status: 400 })
    await inMemoryEventStore.append(append(organizationId, 'access_provisioned', { accessId: access.id, system: access.system, owner: access.owner, requiredForProject: access.requiredForProject }))
  }
  if (body.action === 'submit_quiz') {
    if (state.phase !== 'training' || !state.currentSlide || body.slideId !== state.currentSlide.id || typeof body.answer !== 'number') return NextResponse.json({ error: 'Submit an answer for the current training slide.' }, { status: 409 })
    const correct = body.answer === state.currentSlide.correctOption
    await inMemoryEventStore.append(append(organizationId, 'quiz_attempted', { slideId: state.currentSlide.id, correct }))
    if (!correct) return NextResponse.json({ correct: false, feedback: quizAnswerFeedback(state.currentSlide, false), state: publicOnboardingState(state), slides: trainingSlides.map(({ correctOption, ...slide }) => slide) }, { status: 200 })
    await inMemoryEventStore.append(append(organizationId, 'quiz_passed', { slideId: state.currentSlide.id, score: 100 }))
    await inMemoryEventStore.append(append(organizationId, 'training_slide_completed', { slideId: state.currentSlide.id }))
    const nextEvents = await inMemoryEventStore.list(organizationId)
    return NextResponse.json({ correct: true, correctAnswer: state.currentSlide.options[state.currentSlide.correctOption], feedback: quizAnswerFeedback(state.currentSlide, true), state: publicOnboardingState(deriveOnboardingState(nextEvents)), slides: trainingSlides.map(({ correctOption, ...slide }) => slide) })
  }
  if (body.action === 'resume_readiness') {
    if (state.phase !== 'remediation') return NextResponse.json({ error: 'Complete the assigned training review before returning to the readiness task.' }, { status: 409 })
    await inMemoryEventStore.append(append(organizationId, 'readiness_training_resumed', { completedAfterAttempt: state.readinessAttempts }))
  }
  if (body.action === 'submit_readiness') {
    if (state.phase !== 'demo_task') return NextResponse.json({ error: 'Complete the knowledge sessions before the readiness task.' }, { status: 409 })
    const answers = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : null
    const allQuestionsAnswered = answers && readinessQuestions.every((question) => {
      const answer = answers[question.id]
      return Number.isInteger(answer) && answer >= 0 && answer < question.options.length
    })
    if (!allQuestionsAnswered || !answers) return NextResponse.json({ error: 'Select one answer for every readiness question before submitting.' }, { status: 400 })
    await inMemoryEventStore.append(append(organizationId, 'readiness_task_started', { attempt: state.readinessAttempts + 1 }))
    const evaluation = evaluateReadinessAnswers(answers)
    if (!evaluation.passed) {
      await inMemoryEventStore.append(append(organizationId, 'readiness_task_retry_required', { feedback: evaluation.feedback, score: evaluation.score }))
      return NextResponse.json({ qualified: false, feedback: evaluation.feedback, score: evaluation.score, evaluation, state: publicOnboardingState(deriveOnboardingState(await inMemoryEventStore.list(organizationId))), slides: trainingSlides.map(({ correctOption, ...slide }) => slide), readinessQuestions: publicReadinessQuestions() })
    }
    await inMemoryEventStore.append(append(organizationId, 'readiness_task_passed', { evidence: 'organizational_readiness_mcq', score: evaluation.score }))
    await inMemoryEventStore.append(append(organizationId, 'manager_signoff_recorded', { reviewer: state.profile.manager, score: evaluation.score, decision: 'approved_for_project_access' }))
    await inMemoryEventStore.append(append(organizationId, 'schedule_created', { startAt: nextScheduleStart(), timezone: String(request.headers.get('x-timezone') || 'UTC') }))
    const nextEvents = await inMemoryEventStore.list(organizationId)
    return NextResponse.json({ qualified: true, feedback: evaluation.feedback, score: evaluation.score, evaluation, state: publicOnboardingState(deriveOnboardingState(nextEvents)), slides: trainingSlides.map(({ correctOption, ...slide }) => slide), readinessQuestions: publicReadinessQuestions() }, { status: 201 })
  }
  const nextEvents = await inMemoryEventStore.list(organizationId)
  return NextResponse.json({ state: publicOnboardingState(deriveOnboardingState(nextEvents)), slides: trainingSlides.map(({ correctOption, ...slide }) => slide), readinessQuestions: publicReadinessQuestions() }, { status: 201 })
}

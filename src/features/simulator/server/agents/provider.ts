import type { AgentTurn, OrganizationContext, TeamAgent } from '@/features/simulator/domain/agents'

export interface AgentTextProvider {
  createTurn(input: { agent: TeamAgent; context: OrganizationContext; userMessage: string }): Promise<Pick<AgentTurn, 'message' | 'reasoningSummary'>>
}

type OpenRouterCompletion = { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>; model?: string; error?: { message?: string } }

const defaultOpenRouterModels = ['deepseek/deepseek-chat-v3-0324', 'meta-llama/llama-3.1-8b-instruct', 'mistralai/mistral-nemo']

function configuredModels() {
  const models = process.env.OPENROUTER_MODELS?.split(',').map((model) => model.trim()).filter(Boolean)
  return models?.length ? models : process.env.OPENROUTER_MODEL ? [process.env.OPENROUTER_MODEL] : defaultOpenRouterModels
}

function contentAsText(content: string | Array<{ text?: string }> | undefined) {
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) return content.map((part) => part.text || '').join('').trim()
  return ''
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)) }

/**
 * OpenAI-compatible OpenRouter client using only standard fetch. The prompt is
 * intentionally plain text (rather than JSON mode) because inexpensive models
 * vary in structured-output support. OpenRouter handles model/provider
 * failover through the `models` routing field; retry covers transient gateway
 * failures, while the outer resilient provider protects the simulation.
 */
export class OpenRouterTeamProvider implements AgentTextProvider {
  private readonly apiKey: string
  private readonly models: string[]

  constructor(apiKey = process.env.OPENROUTER_API_KEY || '', models = configuredModels()) {
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is required to use OpenRouterTeamProvider.')
    this.apiKey = apiKey
    this.models = models
  }

  async createTurn({ agent, context, userMessage }: { agent: TeamAgent; context: OrganizationContext; userMessage: string }) {
    const system = [
      `You are ${agent.name}, a ${agent.role.replaceAll('_', ' ')} at a simulated B2B SaaS company.`,
      `Voice: ${agent.voice}. Goals: ${agent.goals.join('; ')}.`,
      'Respond as a thoughtful teammate in 1-3 concise sentences. Address the learner as @alex when helpful.',
      'You may clarify, review, prioritize, or point to a small support artifact. Never write or complete the learner’s assigned implementation, claim work you did not do, expose secrets, or invent production facts.',
      `Workflow: standup=${context.workflow.standupPosted}, checks=${context.workflow.checksPassed}, pr=${context.workflow.pullRequestOpened}, reviewAddressed=${context.workflow.reviewAddressed}, approved=${context.workflow.approvalGranted}, merged=${context.workflow.merged}.`,
      `Scenario level: ${context.scenarioLevel}. In basic be proactive and supportive; in intermediate protect focus and ask for concise context before helping; in advanced make tradeoffs explicit, be direct but fair, and provide escalation paths.`,
      `Recent organization events: ${context.recentActions.join(', ') || 'none'}.`,
    ].join('\n')
    let lastError = 'OpenRouter did not return a completion.'
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), Number(process.env.OPENROUTER_TIMEOUT_MS || 12000))
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST', signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...(process.env.OPENROUTER_SITE_URL ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL } : {}),
            'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME || 'Shiftline AI Work Simulator',
          },
          body: JSON.stringify({
            model: this.models[0], models: this.models.slice(1), stream: false,
            temperature: 0.45, max_tokens: 220,
            provider: { allow_fallbacks: true, require_parameters: false, data_collection: process.env.OPENROUTER_DATA_COLLECTION === 'deny' ? 'deny' : 'allow' },
            messages: [{ role: 'system', content: system }, { role: 'user', content: userMessage }],
          }),
        })
        const result = await response.json() as OpenRouterCompletion
        const message = contentAsText(result.choices?.[0]?.message?.content).slice(0, 1200)
        if (response.ok && message) return { message, reasoningSummary: `OpenRouter responded using ${result.model || this.models[0]} with role-scoped context.` }
        lastError = result.error?.message || `OpenRouter returned HTTP ${response.status}.`
        if (response.status < 500 && response.status !== 429) break
      } catch (error) {
        lastError = error instanceof Error && error.name === 'AbortError' ? 'OpenRouter request timed out.' : 'OpenRouter request failed.'
      } finally { clearTimeout(timeout) }
      await sleep(300 * (attempt + 1))
    }
    throw new Error(lastError)
  }
}

export class ResilientTeamProvider implements AgentTextProvider {
  constructor(private readonly primary: AgentTextProvider, private readonly fallback: AgentTextProvider) {}
  async createTurn(input: { agent: TeamAgent; context: OrganizationContext; userMessage: string }) {
    try { return await this.primary.createTurn(input) }
    catch (error) {
      console.warn('OpenRouter agent turn failed; using deterministic simulator fallback.', error instanceof Error ? error.message : 'Unknown error')
      return this.fallback.createTurn(input)
    }
  }
}

export function createConfiguredTeamProvider(): AgentTextProvider {
  const fallback = new RuleBasedTeamProvider()
  return process.env.OPENROUTER_API_KEY ? new ResilientTeamProvider(new OpenRouterTeamProvider(), fallback) : fallback
}

/**
 * Local development provider. Its explicit policy keeps the simulator usable
 * without credentials while exercising the same orchestration contract as a
 * production LLM provider.
 */
export class RuleBasedTeamProvider implements AgentTextProvider {
  async createTurn({ agent, context, userMessage }: { agent: TeamAgent; context: OrganizationContext; userMessage: string }) {
    const text = userMessage.toLowerCase()
    const specificRequest = userMessage.trim().length >= 55 || /\?|because|impact|need|risk|validate/.test(text)
    if (context.scenarioLevel === 'advanced' && agent.role === 'engineering_manager') return { message: specificRequest ? 'I can help unblock this, @alex. State the delivery impact, the smallest safe option, and the decision you need from me; I will own the escalation rather than asking you to absorb hidden work.' : 'I’m balancing release coverage, @alex. Bring me the concrete impact, options, and the decision you need—then I can remove the right obstacle.', reasoningSummary: 'Engineering manager required evidence-based escalation in the advanced scenario.' }
    if (context.scenarioLevel === 'intermediate' && !specificRequest) return { message: `I’m in a focus block, @alex. Please send the exact task or file, the decision you need, and the deadline impact; I can then give you a useful answer quickly.`, reasoningSummary: 'Busy teammate asked for a concise, actionable communication request in the intermediate scenario.' }
    if (agent.role === 'product_manager') {
      return { message: context.workflow.merged ? 'Thanks for closing the loop, @alex. Please post the customer-facing release note and pick up the next highest-priority item.' : 'Thanks for the update, @alex. Keep the customer outcome visible, call out any scope trade-off, and flag a risk before it becomes a deadline problem.', reasoningSummary: 'PM responded with scope and delivery guidance based on the current workflow state.' }
    }
    if (agent.role === 'product_designer') {
      return { message: 'Before implementation, @alex, confirm the empty state still explains what happens next for a user who cannot manage billing. I’ll review the final copy and hierarchy once you have a draft.', reasoningSummary: 'Designer focused on clarity, accessibility, and the active product surface.' }
    }
    if (agent.role === 'peer_engineer') {
      return { message: 'I’ve added that to the engineering context. @alex, please include the reproduction, affected surface, and the test that gives us confidence before handing this off.', reasoningSummary: 'Peer engineer requested implementation evidence for collaboration.' }
    }
    if (text.includes('canmanagebilling') || text.includes('billing') || text.includes('guard')) {
      return { message: 'Yes, @alex — use the existing canManageBilling guard. Preserve the explanatory empty state when the CTA is unavailable, then run the contract check and include that validation in your PR response.', reasoningSummary: 'Tech lead recognized the legacy billing-role constraint and connected it to the review workflow.' }
    }
    return { message: `I saw your update, @alex. The next organization gate is ${context.workflow.checksPassed ? context.workflow.pullRequestOpened ? context.workflow.reviewAddressed ? 'a clear review response with the validation you ran.' : 'addressing the review comment.' : 'opening the pull request for team review.' : 'running the branch checks before you commit.'} Keep your assumptions visible so the rest of the team can act on them.`, reasoningSummary: 'Tech lead used recent workflow state to identify the next collaboration action.' }
  }
}

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const tokenVersion = 'v1'
const audience = 'aiwex-theia-workbench'
const maxSessionSeconds = 10 * 60
const defaultSessionSeconds = 5 * 60

export type TheiaConfig = {
  enabled: boolean
  reason?: string
  workbenchUrlTemplate?: string
  workbenchOrigin?: string
  sessionSeconds?: number
}

export type TheiaSessionClaims = {
  audience: typeof audience
  runId: string
  userId: string
  issuedAt: number
  expiresAt: number
  nonce: string
}

function sessionSecret() {
  const secret = process.env.THEIA_SESSION_SECRET || ''
  return secret.length >= 32 ? secret : null
}

function parseWorkbenchUrl(value: string | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((!localHttp && url.protocol !== 'https:') || url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

function configuredSessionSeconds() {
  const value = Number(process.env.THEIA_SESSION_TTL_SECONDS || defaultSessionSeconds)
  if (!Number.isFinite(value)) return defaultSessionSeconds
  return Math.min(maxSessionSeconds, Math.max(60, Math.floor(value)))
}

/**
 * The workbench stays unavailable unless every explicit safety control is set.
 * A deployment must run Theia on an isolated origin; it is never embedded from
 * an arbitrary learner-provided URL.
 */
export function getTheiaConfig(): TheiaConfig {
  if (process.env.THEIA_ENABLED !== 'true') return { enabled: false, reason: 'Theia is disabled.' }
  const template = process.env.THEIA_WORKBENCH_URL_TEMPLATE || ''
  const workbench = parseWorkbenchUrl(template.replaceAll('{runId}', 'run-preview'))
  if (!workbench) return { enabled: false, reason: 'THEIA_WORKBENCH_URL_TEMPLATE must be an HTTPS URL (or localhost HTTP for development).' }
  if (process.env.NODE_ENV === 'production' && !template.includes('{runId}')) return { enabled: false, reason: 'Production Theia requires a per-run URL template containing {runId}.' }
  if (!sessionSecret()) return { enabled: false, reason: 'THEIA_SESSION_SECRET must contain at least 32 characters.' }
  return { enabled: true, workbenchUrlTemplate: template, workbenchOrigin: workbench.origin, sessionSeconds: configuredSessionSeconds() }
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function decode(value: string) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
}

function signature(input: string, secret: string) {
  return createHmac('sha256', secret).update(input).digest('base64url')
}

export function createTheiaSession(runId: string, userId: string) {
  const config = getTheiaConfig()
  const secret = sessionSecret()
  if (!config.enabled || !secret || !config.workbenchUrlTemplate || !config.workbenchOrigin || !config.sessionSeconds) throw new Error('Theia is not configured.')
  const workbenchUrl = parseWorkbenchUrl(config.workbenchUrlTemplate.replaceAll('{runId}', encodeURIComponent(runId)))
  if (!workbenchUrl) throw new Error('Theia workbench URL is invalid.')
  if (workbenchUrl.origin !== config.workbenchOrigin) throw new Error('Theia workbench template must keep a stable origin; use {runId} in its path.')
  const issuedAt = Math.floor(Date.now() / 1000)
  const claims: TheiaSessionClaims = { audience, runId, userId, issuedAt, expiresAt: issuedAt + config.sessionSeconds, nonce: randomUUID() }
  const payload = encode(claims)
  const input = `${tokenVersion}.${payload}`
  return { token: `${input}.${signature(input, secret)}`, claims, workbenchUrl: workbenchUrl.toString(), workbenchOrigin: workbenchUrl.origin }
}

export function verifyTheiaSession(token: string | null | undefined): TheiaSessionClaims | null {
  const secret = sessionSecret()
  if (!secret || !token) return null
  const [version, payload, receivedSignature, ...rest] = token.split('.')
  if (version !== tokenVersion || !payload || !receivedSignature || rest.length) return null
  const expectedSignature = signature(`${version}.${payload}`, secret)
  const expected = Buffer.from(expectedSignature)
  const received = Buffer.from(receivedSignature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  try {
    const claims = decode(payload) as Partial<TheiaSessionClaims>
    if (claims.audience !== audience || typeof claims.runId !== 'string' || typeof claims.userId !== 'string' || typeof claims.issuedAt !== 'number' || typeof claims.expiresAt !== 'number' || typeof claims.nonce !== 'string') return null
    if (claims.expiresAt <= Math.floor(Date.now() / 1000) || claims.expiresAt - claims.issuedAt > maxSessionSeconds) return null
    return claims as TheiaSessionClaims
  } catch {
    return null
  }
}

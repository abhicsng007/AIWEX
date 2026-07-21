import { existsSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const tsExtensions = ['.ts', '.tsx', '.mts', '.cts']

function resolveWithExtension(specifier, parentURL) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null
  if (extname(specifier)) return null

  const parentPath = fileURLToPath(parentURL)
  const base = join(dirname(parentPath), specifier)
  for (const extension of tsExtensions) {
    const candidate = `${base}${extension}`
    if (existsSync(candidate)) return pathToFileURL(candidate).href
  }
  for (const extension of tsExtensions) {
    const indexCandidate = join(base, `index${extension}`)
    if (existsSync(indexCandidate)) return pathToFileURL(indexCandidate).href
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL) {
    const resolved = resolveWithExtension(specifier, context.parentURL)
    if (resolved) return { shortCircuit: true, url: resolved }
  }
  return nextResolve(specifier, context)
}

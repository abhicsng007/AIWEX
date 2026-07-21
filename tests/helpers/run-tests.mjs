/**
 * Cross-platform test runner for Node's built-in test runner.
 *
 * Usage:
 *   node tests/helpers/run-tests.mjs unit
 *   node tests/helpers/run-tests.mjs e2e
 *   node tests/helpers/run-tests.mjs all
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const mode = process.argv[2] || 'all'

function walk(dir, predicate, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) walk(full, predicate, acc)
    else if (predicate(full)) acc.push(full)
  }
  return acc
}

const unitFiles = walk(join(root, 'tests/unit'), (file) => file.endsWith('.test.ts'))
const e2eFiles = walk(join(root, 'tests/e2e'), (file) => file.endsWith('.test.mjs'))

/** @type {string[]} */
let files = []
/** @type {string[]} */
const nodeArgs = ['--test']

if (mode === 'unit' || mode === 'all') {
  nodeArgs.push(
    '--experimental-strip-types',
    '--import',
    './tests/helpers/ts-resolve.mjs',
  )
  files = files.concat(unitFiles)
}
if (mode === 'e2e' || mode === 'all') {
  files = files.concat(e2eFiles)
}
if (mode === 'live-ai') {
  process.env.AIWEX_LIVE_AI = '1'
  files = e2eFiles.filter((file) => /06-agent-turns|09-full-journey/.test(file))
}

if (!files.length) {
  console.error(`No test files found for mode "${mode}".`)
  process.exit(1)
}

// When both unit and e2e run together, run them as separate node processes so
// strip-types/import hooks apply only to TypeScript unit tests.
if (mode === 'all') {
  const unit = spawnSync(process.execPath, [
    '--test',
    '--experimental-strip-types',
    '--import',
    './tests/helpers/ts-resolve.mjs',
    ...unitFiles,
  ], { cwd: root, env: process.env, stdio: 'inherit' })
  if (unit.status) process.exit(unit.status ?? 1)
  const e2e = spawnSync(process.execPath, ['--test', ...e2eFiles], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  })
  process.exit(e2e.status ?? 1)
}

const result = spawnSync(process.execPath, [...nodeArgs, ...files], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
})
process.exit(result.status ?? 1)

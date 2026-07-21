import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const hooks = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'ts-resolve-hooks.mjs')).href
register(hooks)

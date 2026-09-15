// Lets a script import the app's TypeScript directly, with Node's built-in type
// stripping (Node 22.18+ / 24):
//
//   node --import ./scripts/ts-loader.mjs scripts/gen-units-sheet.ts
//
// lib/ imports without extensions ('./eventData') and through the '@/' alias,
// neither of which Node's ESM resolver understands. This hook adds both, and
// nothing else. Kept deliberately tiny: it is not a build step, and lib/ must
// stay free of TypeScript-only syntax Node cannot strip (enums, namespaces).

import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

const root = pathToFileURL(process.cwd() + '/').href

register('data:text/javascript,' + encodeURIComponent(`
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const ROOT = ${JSON.stringify(root)}
export async function resolve(spec, ctx, next) {
  let s = spec.startsWith('@/') ? ROOT + spec.slice(2) : spec
  if ((s.startsWith('.') || s.startsWith('file:')) && !/\\.(m?[jt]sx?|json)$/.test(s)) {
    const base = s.startsWith('file:') ? s : new URL(s, ctx.parentURL).href
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      if (existsSync(fileURLToPath(base + ext))) return next(base + ext, ctx)
    }
  }
  return next(s, ctx)
}`))

// Lets a script import the app's TypeScript directly, with Node's built-in type
// stripping (Node 22.18+ / 24):
//
//   node --import ./scripts/ts-loader.mjs scripts/replay-colours.ts
//
// lib/ imports without extensions ('./eventData') and through the '@/' alias,
// and a script outside the repo imports lib/ by absolute path; Node's ESM
// resolver understands none of the three. This hook resolves all three, and
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
  // An absolute filesystem path, as a one-off script outside the repo writes it.
  if (s.startsWith('/')) s = 'file://' + s
  if ((s.startsWith('.') || s.startsWith('file:')) && !/\\.(m?[jt]sx?|json)$/.test(s)) {
    const base = s.startsWith('file:') ? s : new URL(s, ctx.parentURL).href
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      if (existsSync(fileURLToPath(base + ext))) return next(base + ext, ctx)
    }
  }
  return next(s, ctx)
}`))

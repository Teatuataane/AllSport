#!/usr/bin/env node
// ─── Does the React Compiler compile the scoring screen? ─────────────────────
// The compiler (babel-plugin-react-compiler, on in next.config.ts) memoises a
// component for us, but it SKIPS a component it cannot prove safe, silently: an
// eslint-disable of a hooks rule, a `||=` assignment, a ref written during
// render, manual memoisation it disagrees with. A skipped screen redraws all of
// itself on every state change, which on the live game was every second.
//
// This runs the compiler over the files the live game is drawn with and prints
// every function it did not compile, with the reason. It prints nothing and
// exits 0 when everything compiles. Run it after touching any of these files.
//
//   node scripts/check-react-compiler.cjs

// A CommonJS script run by plain node, so require() is the right import here.
/* eslint-disable @typescript-eslint/no-require-imports */

const path = require('path')
const fs = require('fs')
const babel = require('@babel/core')
const compiler = require('babel-plugin-react-compiler')

const root = path.join(__dirname, '..')
const playDir = path.join(root, 'components/play')
const files = [
  'app/scoring/[sessionId]/page.tsx',
  ...fs.readdirSync(playDir).filter(f => /\.tsx?$/.test(f)).map(f => `components/play/${f}`),
  'components/EventIcon.tsx',
  'lib/usePRRows.ts',
  'lib/useGameSwaps.ts',
  'lib/useContest.ts',
  'lib/useGradeProfile.ts',
  'lib/useSportRatings.ts',
  'lib/useSessionResults.ts',
]

let problems = 0
for (const rel of files) {
  const file = path.join(root, rel)
  if (!fs.existsSync(file)) continue
  const events = []
  try {
    babel.transformSync(fs.readFileSync(file, 'utf8'), {
      filename: file, babelrc: false, configFile: false,
      parserOpts: { plugins: ['typescript', 'jsx'] },
      plugins: [[compiler, { logger: { logEvent: (_fn, e) => events.push(e) } }]],
    })
  } catch (e) {
    problems++
    console.log(`${rel}: transform failed: ${e.message.split('\n')[0]}`)
    continue
  }
  for (const e of events) {
    // CompileSkip is a function the compiler does not consider a component or
    // hook (a plain helper); that is not a bail-out.
    if (e.kind === 'CompileSuccess' || e.kind === 'CompileSkip') continue
    const d = e.detail ?? {}
    const reason = d.reason ?? d.options?.reason ?? e.reason ?? e.kind
    const at = d.loc?.start?.line ?? d.options?.details?.[0]?.loc?.start?.line ?? e.fnLoc?.start?.line ?? '?'
    problems++
    console.log(`${rel}:${at} ${e.fnName ?? ''} ${e.kind}: ${String(reason).split('\n')[0]}`)
  }
}
process.exit(problems ? 1 : 0)

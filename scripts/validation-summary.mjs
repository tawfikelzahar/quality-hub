// Runs every golden check and writes lib/verification/results.json: how many
// checks each suite ran and when. The /verification page and the home trust
// strip read that file, so their numbers always come from a real run, never
// typed by hand (owner's decision, 25 Oct 2026).
//
// Runs before `next build` (package.json "prebuild") and by hand with
// `node scripts/validation-summary.mjs`. It never fails the build: if a check
// fails or this Node version can't run the tests, the committed file stays as
// it is and a warning is printed. CI (golden.yml) is what blocks red results.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const OUT = 'lib/verification/results.json'
// suite id → test file (ids are used by lib/verification/content.ts)
const SUITES = {
  spc: 'tests/golden/minitab.test.mts',
  aql: 'tests/golden/aql/check.mts',
  descriptive: 'tests/golden/descriptive/check.mts',
  doe: 'tests/golden/doe/check.mts',
  dpmo: 'tests/golden/dpmo/check.mts',
  gage: 'tests/golden/gage/check.mts',
  icmsf: 'tests/golden/icmsf/check.mts',
  oee: 'tests/golden/oee/check.mts',
  pareto: 'tests/golden/pareto/check.mts',
  regression: 'tests/golden/regression/check.mts',
  stability: 'tests/golden/stability/check.mts',
}

/** Number of checks from a suite's last line: "1742/1742 pass" or "169 checks match" */
function countOf(line) {
  const frac = line.match(/(\d+)\s*\/\s*(\d+)/)
  if (frac && frac[1] === frac[2]) return Number(frac[2])
  const n = line.match(/(\d+)\s+checks?\b/)
  return n ? Number(n[1]) : null
}

function main() {
  const suites = {}
  for (const [id, file] of Object.entries(SUITES)) {
    const r = spawnSync(process.execPath, ['--import', './tests/register.mjs', '--experimental-strip-types', '--no-warnings', file], { encoding: 'utf8' })
    const last = `${r.stdout ?? ''}`.trim().split('\n').pop() ?? ''
    const checks = r.status === 0 ? countOf(last) : null
    if (!checks) {
      console.warn(`[verification] ${id}: not counted (status ${r.status}) — keeping ${OUT} as committed\n${last}`)
      return
    }
    suites[id] = checks
  }
  const total = Object.values(suites).reduce((a, b) => a + b, 0)
  const data = { ranAt: new Date().toISOString().slice(0, 10), total, suites }
  let old = null
  try { old = JSON.parse(readFileSync(OUT, 'utf8')) } catch { /* first run */ }
  // Same counts: keep the file (and its date) unless the date moved on
  if (old && old.total === total && JSON.stringify(old.suites) === JSON.stringify(suites) && old.ranAt === data.ranAt) {
    console.log(`[verification] ${total} checks, unchanged`)
    return
  }
  writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n')
  console.log(`[verification] ${total} checks in ${Object.keys(suites).length} suites → ${OUT}`)
}

main()

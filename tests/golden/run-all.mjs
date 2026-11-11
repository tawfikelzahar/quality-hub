// Runs every golden check (the calculations against their trusted references)
// and fails if any of them fails. Used by `npm run test:all` and by CI.
// api-parity and engine-parity need a running server, so they are not here.
import { spawnSync } from 'node:child_process'

const checks = [
  'tests/golden/minitab.test.mts',
  'tests/golden/aql/check.mts',
  'tests/golden/attribute/check.mts',
  'tests/golden/descriptive/check.mts',
  'tests/golden/doe/check.mts',
  'tests/golden/dpmo/check.mts',
  'tests/golden/gage/check.mts',
  'tests/golden/icmsf/check.mts',
  'tests/golden/oee/check.mts',
  'tests/golden/pareto/check.mts',
  'tests/golden/regression/check.mts',
  'tests/golden/stability/check.mts',
  'tests/golden/paymob/check.mts',
  'tests/golden/renewal/check.mts',
  'tests/golden/founding/check.mts',
  'tests/golden/email/check.mts',
]

let failed = 0
for (const file of checks) {
  const r = spawnSync(process.execPath, ['--import', './tests/register.mjs', '--experimental-strip-types', '--no-warnings', file], { encoding: 'utf8' })
  const last = `${r.stdout}${r.stderr}`.trim().split('\n').pop()
  if (r.status === 0) {
    console.log(`✓ ${last}`)
  } else {
    failed++
    console.log(`✗ ${file}\n${r.stdout}${r.stderr}`)
  }
}
if (failed) {
  console.log(`\n${failed} golden check file(s) failed`)
  process.exit(1)
}
console.log(`\nAll ${checks.length} golden check files pass`)

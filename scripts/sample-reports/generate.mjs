// ─────────────────────────────────────────────────────────────────────────
// Makes the sample reports in public/samples/ (shown on /sample-reports).
//
// Each file is the tool's own export, not a hand-made copy: the script opens
// the tool, runs its built-in example, and presses Excel and PDF report like
// a Pro subscriber would. Branding is a placeholder ("Your Name",
// "Your Company", logo-placeholder.png) so visitors see where their own
// details go. Run it again whenever a report's design changes.
//
//   1. NEXT_PUBLIC_QH_DEV_PRO=1 NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co \
//      NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npx next dev -p 3100
//   2. NODE_PATH=$(npm root -g) node scripts/sample-reports/generate.mjs [http://localhost:3100]
//
// Needs Playwright with Chromium (installed globally in the cloud sandbox).
// The placeholder branding is set through window.__qhSetBranding, which only
// exists under `next dev` with NEXT_PUBLIC_QH_DEV_PRO=1 (lib/reportBranding.ts).
// ─────────────────────────────────────────────────────────────────────────

import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '..', '..', 'public', 'samples')
const base = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '')
const SLUG = 'mizan-quality' // SITE_SLUG in lib/site.ts

const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(here, 'logo-placeholder.png')).toString('base64')
const BRANDING = {
  preparedBy: 'Your Name', jobTitle: '', company: 'Your Company',
  logoDataUrl: logo, logoWidth: 560, logoHeight: 144,
  signPrepared: true, signApproved: true,
}
// Study details typed in the PDF panel (placeholders too)
const DETAILS = ['Your Part', 'Your Characteristic', 'Your Line', '', 'SAMPLE-001']

const TOOLS = [
  { id: 'spc', page: '/spc' },
  { id: 'gage-rr', page: '/gage-rr' },
  { id: 'oee', page: '/oee' },
]

fs.mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch()
try {
  for (const tool of TOOLS) {
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 900 } })
    const page = await ctx.newPage()
    page.on('pageerror', e => console.log(`[${tool.id}] page error:`, e.message))
    await page.goto(base + tool.page, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    const ok = await page.evaluate(b => {
      const set = window.__qhSetBranding
      if (typeof set !== 'function') return false
      set(b)
      return true
    }, BRANDING)
    if (!ok) throw new Error('window.__qhSetBranding is missing: run `next dev` with NEXT_PUBLIC_QH_DEV_PRO=1')
    // the `next dev` overlay badge can sit on top of the buttons
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; pointer-events: none !important; }' })

    // the tool's own example, then wait for the results and charts
    await page.locator('.tl-head button.tl-xbtn, button.tl-xbtn').filter({ hasText: /example/i }).first().click()
    await page.waitForTimeout(6000)

    const save = async (click, ext) => {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90_000 }), click()])
      const file = path.join(outDir, `${SLUG}-sample-${tool.id}-report.${ext}`)
      await dl.saveAs(file)
      console.log('saved', path.relative(process.cwd(), file))
    }

    await save(() => page.locator('button.tl-xbtn-pro', { hasText: 'Excel' }).first().click(), 'xlsx')

    await page.locator('button.tl-xbtn-pro', { hasText: 'PDF' }).first().click()
    const panel = page.locator('aside.tl-rd')
    await panel.waitFor()
    const fields = panel.locator('.tl-rd-grid:not(.three) input')
    for (let i = 0; i < DETAILS.length; i++) await fields.nth(i).fill(DETAILS[i])
    const signOff = panel.locator('input[type=checkbox]').first()
    if (!(await signOff.isChecked())) await signOff.check()
    const names = panel.locator('.tl-rd-grid.three input')
    await names.nth(0).fill('Your Name')
    await names.nth(1).fill('')
    await names.nth(2).fill('')
    await panel.locator('textarea').fill('')
    await save(() => panel.locator('button.tl-analyze').click(), 'pdf')
    await ctx.close()
  }
} finally {
  await browser.close()
}

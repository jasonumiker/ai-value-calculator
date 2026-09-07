import { mkdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { preview } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = join(root, 'public', 'screenshots')
const desktopViewport = { width: 1440, height: 960 }
const dialogViewport = { width: 972, height: 800 }

await mkdir(outputDirectory, { recursive: true })

let browser
let server

try {
  server = await preview({
    root,
    logLevel: 'error',
    preview: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: false,
    },
  })

  const address = server.httpServer.address()
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine the Vite preview address.')
  }

  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: desktopViewport,
    deviceScaleFactor: 2,
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
  })
  const page = await context.newPage()

  await page.addInitScript(() => localStorage.clear())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' })
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        caret-color: transparent !important;
        transition: none !important;
      }
    `,
  })
  await page.evaluate(() => document.fonts.ready)

  const capture = async (name, fullPage = true) => {
    const outputPath = join(outputDirectory, name)
    await page.evaluate(() => {
      scrollTo(0, 0)
      document.querySelectorAll('.modal').forEach((modal) => modal.scrollTo(0, 0))
    })
    await page.screenshot({ path: outputPath, fullPage, animations: 'disabled' })
    console.log(`Captured ${relative(root, outputPath)}`)
  }

  await capture('portfolio-overview.png')

  await page.setViewportSize(dialogViewport)
  await page.getByRole('button', { name: 'Preview pulse' }).click()
  await page.getByRole('dialog').waitFor({ state: 'visible' })
  await capture('survey-dialog.png', false)

  await page.getByRole('button', { name: 'Close' }).click()
  await page.setViewportSize(desktopViewport)
  await page.getByRole('button', { name: /^Pulse results/ }).click()
  await page.getByRole('heading', { name: 'Pulse results', level: 1 }).waitFor({ state: 'visible' })
  await capture('sample-responses.png')

  await page.getByRole('button', { name: 'Value hypotheses', exact: true }).click()
  await page.getByRole('heading', { name: 'Value hypotheses', level: 1 }).waitFor({ state: 'visible' })
  await capture('value-hypotheses.png')

  await page.setViewportSize(dialogViewport)
  await page.getByRole('button', { name: 'Add hypothesis', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'visible' })
  await capture('hypothesis-dialog.png', false)

  await page.getByRole('button', { name: 'Close' }).click()
  await page.setViewportSize(desktopViewport)
  await page.getByRole('button', { name: 'Outcome studies' }).click()
  await page.getByRole('heading', { name: 'Outcome studies', level: 1 }).waitFor({ state: 'visible' })
  await capture('outcome-studies.png')

  await page.getByRole('button', { name: 'Data imports', exact: true }).click()
  await page.getByRole('heading', { name: 'Data imports', level: 1 }).waitFor({ state: 'visible' })
  await capture('data-imports.png')

  await page.getByRole('button', { name: 'Value hypotheses', exact: true }).click()
  await page.getByRole('article', { name: 'Accelerate code review', exact: true }).getByRole('button', { name: /Start study/ }).click()
  const linkedStudy = page.getByRole('article', { name: 'Accelerate code review', exact: true })
  await linkedStudy.waitFor({ state: 'visible' })
  await capture('linked-study.png')

  await page.setViewportSize({ ...dialogViewport, height: 900 })
  await linkedStudy.getByRole('button', { name: 'Record evidence', exact: true }).click()
  const evidenceDialog = page.getByRole('dialog')
  await evidenceDialog.getByLabel('Study cohort').fill('Platform releases')
  await evidenceDialog.getByLabel('Study period').fill('Q3 2026')
  await evidenceDialog.getByLabel('Outcome metric').fill('Median pull request review time')
  await evidenceDialog.getByLabel('Baseline', { exact: true }).fill('4 days')
  await evidenceDialog.getByLabel('Current measurement').fill('2 days')
  await evidenceDialog.getByLabel('Comparison method').fill('Matched releases')
  await evidenceDialog.getByLabel('Observed result').fill('2 days earlier; change failure rate unchanged')
  await evidenceDialog.getByRole('combobox', { name: 'Outcome evidence', exact: true }).selectOption('Observed')
  await evidenceDialog.getByLabel('Study progress (%)').fill('100')
  await capture('study-evidence-dialog.png', false)

  await evidenceDialog.getByRole('button', { name: 'Save evidence', exact: true }).click()
  await linkedStudy.getByRole('button', { name: 'Accelerate code review', exact: true }).click()
  await page.getByRole('article', { name: 'Accelerate code review', exact: true }).getByText('Study complete', { exact: true }).waitFor({ state: 'visible' })

  await page.getByRole('article', { name: 'Accelerate code review', exact: true }).getByRole('button', { name: 'View study', exact: true }).click()
  await page.setViewportSize({ width: 1100, height: 1200 })
  await linkedStudy.getByRole('button', { name: 'Prepare valuation', exact: true }).click()
  const financeDialog = page.getByRole('dialog')
  await financeDialog.getByLabel('Prepared by').fill('Process owner (demo)')
  await financeDialog.getByLabel('Proposed gross value ($)').fill('12000')
  await financeDialog.getByLabel('Valuation formula', { exact: true }).fill('240 reused backlog hours x $50 contribution per hour')
  await financeDialog.getByLabel('Valuation source', { exact: true }).fill('Finance backlog contribution policy v1 (demo)')
  await financeDialog.getByRole('combobox', { name: 'Claim confidence', exact: true }).selectOption('High')
  await financeDialog.getByLabel('Benefit scope key').fill('platform|review-capacity|2026-q3')
  await financeDialog.getByLabel('Attribution and valuation assumptions').fill('Capacity used on committed backlog demand. Matched releases and stable quality. Claim scopes excluded from the Pulse frame.')
  await capture('financial-proposal.png', false)
  await financeDialog.getByRole('button', { name: 'Submit for review', exact: true }).click()

  await linkedStudy.getByRole('button', { name: 'Review valuation', exact: true }).click()
  await financeDialog.getByLabel('Finance reviewer', { exact: true }).fill('Finance owner (demo)')
  await financeDialog.getByLabel('Decision rationale').fill('Matched-release evidence, backlog reuse, and the contribution rate accepted. No duplicate claim or Pulse overlap.')
  await financeDialog.getByLabel('Outcome attribution and valuation evidence reviewed').check()
  await financeDialog.getByLabel('Quality, risk, and workload guardrails accepted').check()
  await financeDialog.getByLabel('Duplicate claims and Pulse scope exclusion checked').check()
  await capture('financial-review.png', false)
  await financeDialog.getByRole('button', { name: 'Approve claim', exact: true }).click()

  await linkedStudy.getByRole('button', { name: 'View approval', exact: true }).click()
  await capture('financial-approval.png', false)
  await financeDialog.getByRole('button', { name: 'Record realization', exact: true }).click()
  await financeDialog.getByLabel('Realized gross value ($)').fill('8000')
  await financeDialog.getByLabel('Finance reviewer', { exact: true }).fill('Finance owner (demo)')
  await financeDialog.getByLabel('Realized value formula').fill('160 reused backlog hours x $50 contribution per hour')
  await financeDialog.getByLabel('Reconciliation source').fill('Reconciled backlog contribution report (demo)')
  await financeDialog.getByLabel('Reconciliation and variance rationale').fill('Lower committed demand than forecast. Actual reused capacity reconciled to completed backlog work.')
  await capture('financial-realization.png', false)
  await financeDialog.getByRole('button', { name: 'Confirm realization', exact: true }).click()
  await linkedStudy.getByText('Realized', { exact: true }).waitFor({ state: 'visible' })
} finally {
  await browser?.close()
  await server?.close()
}
import { mkdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { preview } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = join(root, 'docs', 'screenshots')
const desktopViewport = { width: 1440, height: 960 }
const dialogViewport = { width: 1100, height: 980 }

await mkdir(outputDirectory, { recursive: true })

let browser
let server

try {
  server = await preview({ root, logLevel: 'error', preview: { host: '127.0.0.1', port: 4173, strictPort: false } })
  const address = server.httpServer.address()
  if (!address || typeof address === 'string') throw new Error('Could not determine the Vite preview address.')

  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: desktopViewport, deviceScaleFactor: 1.5, colorScheme: 'light', locale: 'en-US', timezoneId: 'UTC' })
  const page = await context.newPage()
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('screenshot-seeded')) {
      localStorage.clear()
      sessionStorage.setItem('screenshot-seeded', '1')
    }
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; caret-color: transparent !important; transition: none !important; } .toast { display: none !important; }' })
  await page.evaluate(() => document.fonts.ready)

  const capture = async (name, fullPage = true) => {
    const outputPath = join(outputDirectory, name)
    await page.evaluate(() => {
      scrollTo(0, 0)
      document.querySelectorAll('.modal, .drawer').forEach((element) => element.scrollTo(0, 0))
    })
    await page.screenshot({ path: outputPath, fullPage, animations: 'disabled' })
    console.log(`Captured ${relative(root, outputPath)}`)
  }
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const nav = (label) => page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: new RegExp(`^${escape(label)}`) }).click()
  const viewAs = (label) => page.getByRole('button', { name: label, exact: true }).click()
  const dialog = page.getByRole('dialog')

  // Finance & executive
  await capture('portfolio-overview.png')
  await nav('Next-dollar decisions')
  await capture('next-dollar-decisions.png')
  await nav('Financial approvals')
  await capture('financial-approvals.png')
  await nav('Hypothesis priorities')
  await capture('hypothesis-priorities.png')
  await nav('Rules & policy')
  await page.getByLabel('Modelled weight').fill('60')
  await capture('rules-and-policy.png')
  await page.getByRole('button', { name: 'Discard draft' }).click()
  await nav('Sampling engine')
  await capture('sampling-engine.png')
  await nav('Bills & usage data')
  await capture('bills-and-usage.png')

  // Manager
  await viewAs('Manager')
  await capture('manager-team.png')
  await nav('Pulse signals')
  await capture('pulse-signals.png')
  await page.setViewportSize(dialogViewport)
  await page.getByRole('row').filter({ hasText: 'Data analysis' }).getByRole('button', { name: /Nominate hypothesis/ }).click()
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByLabel('Operational evidence source').fill('Quality review log')
  await dialog.getByLabel('Quality, risk, or workload guardrail').fill('Turnaround time must not rise')
  await dialog.getByLabel('Primary metric').fill('Share of analyses needing rework')
  await dialog.getByLabel('Unit').selectOption('percent')
  await dialog.getByLabel('Guardrail metric').fill('Turnaround time')
  await capture('hypothesis-from-signal.png', false)
  await page.getByRole('button', { name: 'Close' }).click()
  await page.setViewportSize(desktopViewport)
  await nav('Studies')
  await page.getByRole('checkbox', { name: /Only/ }).uncheck()
  await capture('outcome-studies.png')

  await page.setViewportSize(dialogViewport)
  const incident = page.getByRole('article', { name: 'Incident review drafting', exact: true })
  await incident.getByRole('button', { name: 'Record evidence', exact: true }).click()
  await dialog.getByLabel('Without AI observations').fill('14')
  await dialog.getByLabel('Without AI mean').fill('5.4')
  await dialog.getByLabel('Without AI standard deviation').fill('1.7')
  await dialog.getByLabel('With AI observations').fill('15')
  await dialog.getByLabel('With AI mean').fill('3.8')
  await dialog.getByLabel('With AI standard deviation').fill('1.5')
  await dialog.getByLabel('Guardrail change (% worse)').fill('1')
  await dialog.getByLabel('Study progress (%)').fill('100')
  await capture('study-evidence-dialog.png', false)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()

  const knowledge = page.getByRole('article', { name: 'Knowledge work preparation', exact: true })
  await knowledge.getByRole('button', { name: 'Propose valuation', exact: true }).click()
  await dialog.getByLabel('Prepared by').fill('Customer Operations manager')
  await dialog.getByLabel('Proposed gross value ($)').fill('40000')
  await dialog.getByLabel('Benefit scope key').fill('customer-operations|case-prep|2026-q3')
  await dialog.getByLabel('Valuation formula', { exact: true }).fill('800 additional cases handled × $50 contribution per case')
  await dialog.getByLabel('Valuation source', { exact: true }).fill('Case throughput report (demo)')
  await dialog.getByLabel('Attribution and valuation assumptions').fill('Released preparation time absorbed the committed case backlog; case quality held.')
  await capture('financial-proposal.png', false)
  await dialog.getByRole('button', { name: /Submit for review/ }).click()

  await page.setViewportSize(desktopViewport)
  await viewAs('Finance & exec')
  await nav('Financial approvals')
  await page.setViewportSize(dialogViewport)
  await page.getByRole('button', { name: 'Review valuation', exact: true }).click()
  await dialog.getByLabel('Finance reviewer', { exact: true }).fill('Finance owner (demo)')
  await dialog.getByLabel('Decision rationale').fill('Before/after evidence accepted at the policy’s Low confidence cap. Backlog reuse confirmed.')
  await dialog.getByLabel('Outcome attribution and valuation evidence reviewed').check()
  await dialog.getByLabel('Quality, risk, and workload guardrails accepted').check()
  await dialog.getByLabel('Duplicate claims and Pulse scope exclusion checked').check()
  await capture('financial-review.png', false)
  await page.getByRole('button', { name: 'Close' }).click()

  // Employee
  await page.setViewportSize(desktopViewport)
  await viewAs('Employee')
  await page.getByRole('slider', { name: 'Task time change' }).fill('0.75')
  await page.getByLabel('What was the main immediate effect?').selectOption('Faster delivery')
  await page.getByLabel(/What did you use the saved time for/).selectOption('Other priority work')
  await capture('employee-inbox.png', false)

  await page.getByRole('button', { name: 'Assumptions & limits' }).first().click()
  await page.getByRole('dialog', { name: 'Assumptions & limits' }).waitFor({ state: 'visible' })
  await capture('assumptions-and-limits.png', false)
} finally {
  await browser?.close()
  await server?.close()
}

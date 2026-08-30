import { mkdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { preview } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = join(root, 'public', 'screenshots')
const desktopViewport = { width: 972, height: 583 }
const dialogViewport = { width: 972, height: 640 }

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

  const capture = async (name) => {
    const outputPath = join(outputDirectory, name)
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: outputPath, animations: 'disabled' })
    console.log(`Captured ${relative(root, outputPath)}`)
  }

  await capture('portfolio-overview.png')

  await page.setViewportSize(dialogViewport)
  await page.getByRole('button', { name: 'Preview pulse' }).click()
  await page.getByRole('dialog').waitFor({ state: 'visible' })
  await capture('survey-dialog.png')

  await page.getByRole('button', { name: 'Close' }).click()
  await page.setViewportSize(desktopViewport)
  await page.getByRole('button', { name: /^Pulse results/ }).click()
  await page.getByRole('heading', { name: 'Pulse results', level: 1 }).waitFor({ state: 'visible' })
  await capture('sample-responses.png')

  await page.getByRole('button', { name: 'Outcome studies' }).click()
  await page.getByRole('heading', { name: 'Outcome studies', level: 1 }).waitFor({ state: 'visible' })
  await capture('outcome-studies.png')
} finally {
  await browser?.close()
  await server?.close()
}
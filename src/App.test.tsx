import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { defaultAssumptions } from './model'

beforeEach(() => {
  localStorage.clear()
})

function summaryMetric(label: string): string {
  const strip = document.querySelector('.summary-strip') as HTMLElement
  const strong = within(strip).getByText(label).closest('.metric')!.querySelector('strong')!
  return strong.textContent ?? ''
}

function storedAssumptions() {
  return JSON.parse(localStorage.getItem('ai-value-calculator-assumptions') ?? '{}')
}

describe('Portfolio overview', () => {
  it('clearly labels demo data and renders decision-grade metrics', () => {
    render(<App />)
    expect(screen.getByText('Illustrative demo data')).toBeInTheDocument()
    expect(screen.getByText(/Not customer results/)).toBeInTheDocument()
    expect(summaryMetric('Total AI investment')).toBe('$61,460')
    expect(summaryMetric('Validated claim value')).toBe('$99,900')
    expect(summaryMetric('Validated ROI')).toBe('63%')
    expect(Number(summaryMetric('Pulse-inclusive ROI').replace('%', ''))).toBeGreaterThan(63)
    expect(within(document.querySelector('.summary-strip') as HTMLElement).getByText(/95% Pulse sampling interval/i)).toBeInTheDocument()
  })

  it('shows four pillars without assigning financial value to unvalidated innovation', () => {
    render(<App />)
    ;['Improved Performance', 'Cost Savings', 'Innovation / Transformation', 'Risk Mitigation'].forEach((pillar) => {
      expect(screen.getAllByText(pillar).length).toBeGreaterThan(0)
    })
    expect(screen.getByText('Not valued')).toBeInTheDocument()
    expect(screen.getByText(/modelled value from/i)).toBeInTheDocument()
    expect(screen.getByText(/added only to Pulse-inclusive ROI/i)).toBeInTheDocument()
  })
})

describe('Governed valuation policy', () => {
  it('includes three total-cost controls and seven locked evidence controls', () => {
    render(<App />)
    expect(screen.getAllByRole('slider')).toHaveLength(10)
    expect(screen.getByLabelText('Implementation cost')).toBeEnabled()
    expect(screen.getByLabelText('Modelled weight')).toBeDisabled()
  })

  it('requires an explicit unlock, recomputes ROI, persists changes, and resets', async () => {
    const user = userEvent.setup()
    render(<App />)
    const roiBefore = Number(summaryMetric('Validated ROI').replace('%', ''))

    await user.click(screen.getByRole('button', { name: 'Claim weights locked' }))
    expect(screen.getByLabelText('Modelled weight')).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Modelled weight'), { target: { value: '25' } })
    expect(storedAssumptions().modelledWeight).toBe(0.25)
    const roiAfter = Number(summaryMetric('Validated ROI').replace('%', ''))
    expect(roiAfter).toBeLessThan(roiBefore)

    await user.click(screen.getByRole('button', { name: 'Reset costs & claim policy' }))
    expect(storedAssumptions().modelledWeight).toBe(defaultAssumptions.modelledWeight)
  })

  it('exports an explicitly classified snapshot', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Export' }))
    expect(URL.createObjectURL).toHaveBeenCalled()
    const blob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0] as Blob
    const snapshot = JSON.parse(await blob.text())
    expect(snapshot.roiViews.validated).toMatchObject({ roi: expect.any(Number), basis: expect.stringMatching(/no Pulse extrapolation/i) })
    expect(snapshot.roiViews.pulseInclusive).toMatchObject({
      projectionEligible: true,
      roi: expect.any(Number),
      roiInterval: { low: expect.any(Number), high: expect.any(Number) },
      intervalScope: expect.stringMatching(/Pulse sampling variation only/i),
    })
    expect(await screen.findByText(/both ROI views, intervals, and policies/i)).toBeInTheDocument()
  })
})

describe('Optional employee pulse', () => {
  it('uses neutral wording, supports negative effects, and collects no personal fields', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Preview pulse' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('What effect, if any, did AI have on this task?')).toBeInTheDocument()
    const product = within(dialog).getByLabelText('Product')
    const team = within(dialog).getByLabelText('Team')
    const workType = within(dialog).getByLabelText('Work type')
    const slider = within(dialog).getByRole('slider', { name: 'Task time change' })
    const hoursInput = within(dialog).getByRole('spinbutton', { name: 'Task time change in hours' })
    expect(product).toBeVisible()
    expect(product).toHaveValue('GitHub Copilot')
    expect(team).toBeVisible()
    expect(team).toHaveValue('Digital Channels')
    expect(workType).toBeVisible()
    expect(workType).toHaveValue('Code and tests')
    await user.selectOptions(product, 'Copilot Cowork')
    await user.selectOptions(team, 'Customer Operations')
    await user.selectOptions(workType, 'Data analysis')
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument()
    expect(slider).toHaveValue('0')
    expect(hoursInput).toHaveValue(0)
    fireEvent.change(slider, { target: { value: '1.25' } })
    expect(hoursInput).toHaveValue(1.25)
    fireEvent.change(hoursInput, { target: { value: '-0.5' } })
    expect(slider).toHaveValue('-0.5')
    expect(within(dialog).getByText('0.5 hours slower')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Your role')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/business result/i)).not.toBeInTheDocument()

    await user.selectOptions(within(dialog).getByLabelText('What was the main immediate effect?'), 'More rework or lower quality')
    await user.click(within(dialog).getByRole('button', { name: /Record pulse/ }))

    expect(await screen.findByText(/excluded from Validated ROI and the Pulse-inclusive projection/i)).toBeInTheDocument()
    const stored = JSON.parse(localStorage.getItem('ai-value-calculator-responses') ?? '[]')
    expect(stored).toHaveLength(21)
    expect(stored[0]).toMatchObject({
      product: 'Copilot Cowork',
      team: 'Customer Operations',
      workType: 'Data analysis',
      timeImpact: '-0.5',
      effect: 'More rework or lower quality',
    })
    expect(stored[0]).not.toHaveProperty('role')
  })

  it('reports pulse data only in aggregate groups', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(within(screen.getByRole('navigation', { name: 'Primary navigation' })).getByRole('button', { name: /^Pulse results/ }))
    expect(screen.getByText('Aggregate random-sample results')).toBeInTheDocument()
    expect(screen.getByText(/production policy requires n≥10/i)).toBeInTheDocument()
    expect(screen.getByText('No benefit or slower')).toBeInTheDocument()
    expect(within(document.querySelector('.mini-stat-grid') as HTMLElement).getByText('Projected net task time')).toBeInTheDocument()
    expect(screen.getByText('A bounded estimate, not booked savings')).toBeInTheDocument()
    expect(screen.getByText(/finite-population correction/i)).toBeInTheDocument()
    expect(screen.getByText(/does not identify or subtract overlapping sessions itself/i)).toBeInTheDocument()
    expect(screen.getByText(/random sampling variation only/i)).toBeInTheDocument()
    expect(screen.getByText(/Sample time evidence: Estimated/i)).toBeInTheDocument()
  })
})

describe('Value hypothesis registry', () => {
  it('requires an observable outcome and guardrail', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Value hypotheses' }))
    await user.click(screen.getByRole('button', { name: /Add hypothesis/ }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('AI-assisted use case'), 'Draft release notes')
    await user.type(within(dialog).getByLabelText('Owning group'), 'Docs')
    await user.type(within(dialog).getByLabelText('Expected work effect'), 'Faster drafting')
    await user.type(within(dialog).getByLabelText('Observable operational outcome'), 'Publish notes earlier')
    await user.type(within(dialog).getByLabelText('Operational evidence source'), 'Release tracker')
    await user.type(within(dialog).getByLabelText('Quality, risk, or workload guardrail'), 'Correction rate must not rise')
    await user.click(within(dialog).getByRole('button', { name: /Add hypothesis/ }))

    expect(await screen.findByText(/hypothesis and guardrail added/i)).toBeInTheDocument()
    expect(screen.getByText('Draft release notes')).toBeInTheDocument()
    expect(screen.getByText('Correction rate must not rise')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('ai-value-calculator-hypotheses') ?? '[]')).toHaveLength(5)
  })
})

describe('Outcome studies and claim register', () => {
  it('shows study designs, dual provenance, exclusions, and an auditable claims register', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Outcome studies' }))
    expect(screen.getAllByText('Developer delivery cycle').length).toBeGreaterThan(0)
    expect(screen.getByText('84 engineers · matched teams')).toBeInTheDocument()
    expect(screen.getByText('126 participants · pre/post')).toBeInTheDocument()
    expect(screen.getByText('42 opportunities · staggered rollout')).toBeInTheDocument()
    expect(screen.getByText('Every claim, including those excluded from Validated ROI')).toBeInTheDocument()
    expect(screen.getByText('Source: Finance backlog valuation policy v1')).toBeInTheDocument()
    expect(screen.getAllByText(/excluded/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Outcome: Observed/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Value: Modelled/).length).toBeGreaterThan(0)
  })
})

describe('Aggregate CSV ingestion', () => {
  it('accepts grouped data without direct identifiers', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: 'Data imports' }))
    const csv = 'product,team,role_group,period,active_users,cost\nGitHub Copilot,Digital Channels,Engineering,2026-07,42,50\n'
    const file = new File([csv], 'test-team-usage.csv', { type: 'text/csv' })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)
    expect(await screen.findByText('test-team-usage.csv')).toBeInTheDocument()
    const stored = JSON.parse(localStorage.getItem('ai-value-calculator-imports') ?? '[]')
    expect(stored[0].status).toBe('Ready')
    expect(stored[0].note).toMatch(/no direct identifiers/i)
  })

  it('rejects a file containing a direct user identifier', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: 'Data imports' }))
    const csv = 'product,team,email,cost\nGitHub Copilot,Digital Channels,person@example.com,50\n'
    const file = new File([csv], 'unsafe.csv', { type: 'text/csv' })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, file)
    const stored = JSON.parse(localStorage.getItem('ai-value-calculator-imports') ?? '[]')
    expect(stored[0].status).toBe('Needs mapping')
    expect(stored[0].note).toMatch(/direct identifier/i)
  })
})
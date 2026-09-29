import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { DATA_KEY } from './state/storage'

beforeEach(() => {
  localStorage.clear()
})

function summaryMetric(label: string) {
  const strip = document.querySelector('.summary-strip') as HTMLElement
  return within(strip).getByText(label).closest('.metric')!.querySelector('strong')!.textContent ?? ''
}

const stored = () => JSON.parse(localStorage.getItem(DATA_KEY) ?? '{}')
const nav = () => within(screen.getByRole('navigation', { name: 'Primary navigation' }))
const persona = (name: string) => screen.getByRole('button', { name, pressed: false })

async function lastSnapshot() {
  const blob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0] as Blob
  return JSON.parse(await blob.text())
}

describe('Finance and executive portfolio', () => {
  it('shows period-aligned costs, both ROI views, and switches quarters', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByText('Illustrative demo data')).toBeInTheDocument()
    expect(summaryMetric('Total AI cost')).toBe('$45,838')
    expect(summaryMetric('Validated value')).toBe('$66,480')
    expect(summaryMetric('Validated ROI')).toBe('45%')
    expect(summaryMetric('Pulse-inclusive ROI')).toBe('150%')
    expect(screen.getByText(/95% sampling interval 89% to 210%/)).toBeInTheDocument()
    const waterfall = screen.getByRole('region', { name: 'Pulse calculation waterfall' })
    expect(within(waterfall).getByText('How the Pulse estimate was built')).toBeInTheDocument()
    expect(within(waterfall).getByRole('button', { name: /Bill population 19,847 sessions/ })).toBeInTheDocument()
    expect(within(waterfall).getByRole('button', { name: /Pulse estimate \$47,994/ })).toBeInTheDocument()
    expect(screen.getByText('Is the next credit worth it? Cost vs modelled value per task session')).toBeInTheDocument()
    expect(screen.getAllByText('Not worth it').length).toBeGreaterThan(0)

    await user.selectOptions(screen.getByLabelText('Reporting quarter'), '2026-Q2')
    expect(summaryMetric('Total AI cost')).toBe('$58,570')
    expect(summaryMetric('Validated ROI')).toBe('−39%')
  })

  it('edits change costs for the selected quarter only', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('Implementation cost'), { target: { value: '16000' } })
    expect(summaryMetric('Total AI cost')).toBe('$55,838')
    expect(stored().changeCosts['2026-Q3'].implementation).toBe(16000)
    expect(stored().changeCosts['2026-Q2'].implementation).toBe(18000)
  })

  it('exports both ROI views and the evidence without invitation routing', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Export' }))
    const snapshot = await lastSnapshot()
    expect(snapshot.reportingPeriod).toBe('2026-Q3')
    expect(snapshot.roiViews.validated.basis).toMatch(/no Pulse extrapolation/)
    expect(snapshot.roiViews.pulseInclusive.intervalScope).toMatch(/sampling variation only/)
    expect(snapshot.pulse.calculationWaterfall).toMatchObject({
      billTaskSessions: 19847,
      excludedTaskEvents: 6553,
      eligibleTaskEvents: 13294,
    })
    expect(snapshot.pulse.calculationWaterfall.estimatedValue).toBeCloseTo(47994, 0)
    expect(snapshot.pulse.calculationWaterfall.reusedHours * snapshot.pulse.calculationWaterfall.contributionValuePerHour)
      .toBeCloseTo(snapshot.pulse.calculationWaterfall.estimatedValue, 5)
    expect(snapshot.data.routing).toBeUndefined()
    expect(snapshot.unitEconomics.length).toBeGreaterThan(0)
  })

  it('drills into calibration and reconciles the Pulse-inclusive ROI', async () => {
    const user = userEvent.setup()
    render(<App />)
    const waterfall = screen.getByRole('region', { name: 'Pulse calculation waterfall' })

    await user.click(within(waterfall).getByRole('button', { name: /Self-report calibration/ }))
    expect(within(waterfall).getByRole('heading', { name: 'Discount self-reports with matching timing studies' })).toBeInTheDocument()
    expect(within(waterfall).getByText(/14% of eligible sessions use study-derived factors/)).toBeInTheDocument()
    expect(within(waterfall).getAllByText('Matching study').length).toBeGreaterThan(0)

    await user.click(within(waterfall).getByRole('button', { name: /Pulse estimate/ }))
    expect(within(waterfall).getByText('$20,268 to $75,720')).toBeInTheDocument()
    expect(within(waterfall).getByText(/sampling variation only/)).toBeInTheDocument()
    expect(within(waterfall).getByText('150% ROI')).toBeInTheDocument()
  })

  it('keeps every caveat in one Assumptions & limits drawer', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getAllByRole('button', { name: 'Assumptions & limits' })[0])
    const drawer = screen.getByRole('dialog', { name: 'Assumptions & limits' })
    expect(within(drawer).getByText(/covers sampling variation only/)).toBeInTheDocument()
    expect(within(drawer).getByText(/never joined to answers and never exported/)).toBeInTheDocument()
  })
})

describe('Employee pulse inbox', () => {
  it('answers a random invitation in seconds and moves the Pulse estimate', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(persona('Employee'))
    const card = screen.getByRole('region', { name: 'Pulse invitation' })
    expect(within(card).getByText(/you used/)).toBeInTheDocument()
    const before = document.querySelector('.impact-figure')!.textContent
    fireEvent.change(within(card).getByRole('slider', { name: 'Task time change' }), { target: { value: '2' } })
    await user.selectOptions(within(card).getByLabelText('What was the main immediate effect?'), 'Faster delivery')
    await user.selectOptions(within(card).getByLabelText(/What did you use the saved time for/), 'More of the same work')
    await user.click(within(card).getByRole('button', { name: /Send answer/ }))

    expect(await screen.findByText(/Answer recorded/)).toBeInTheDocument()
    expect(document.querySelector('.impact-figure')!.textContent).not.toBe(before)
    expect(screen.getByText(/Your last answer moved the estimate/)).toBeInTheDocument()
    const data = stored()
    const answer = data.responses.find((response: { source: string; hours: number; id: string }) => response.source === 'Random invitation' && response.hours === 2 && response.id.startsWith('r-frame-2026-q3'))
    expect(answer).toMatchObject({ effect: 'Faster delivery', reuse: 'More of the same work' })
    expect(Object.keys(answer)).not.toContain('personKey')
  })

  it('lets people skip, and keeps self-selected previews out of the estimate', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(persona('Employee'))
    const openBefore = screen.getByText(/invitations still open/).textContent
    await user.click(screen.getByRole('button', { name: 'Not this time' }))
    expect(screen.getByText(/invitations still open/).textContent).not.toBe(openBefore)

    await user.click(screen.getByRole('button', { name: /Try the survey without an invitation/ }))
    const dialog = screen.getByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('What was the main immediate effect?'), 'No material change')
    await user.click(within(dialog).getByRole('button', { name: /Record preview/ }))
    expect(await screen.findByText(/does not enter the Pulse estimate/)).toBeInTheDocument()
    expect(stored().responses.filter((response: { source: string }) => response.source === 'Preview')).toHaveLength(1)
  })
})

describe('Manager: signals to tested hypotheses', () => {
  it('shows team signals, hides small groups, and marks work measured by a study', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(persona('Manager'))
    expect(screen.getByRole('heading', { name: 'My team', level: 1 })).toBeInTheDocument()
    expect(screen.getByText(/Measured by the study “Developer delivery cycle”/)).toBeInTheDocument()
    expect(summaryMetric('Open nominations')).toBe('1 of 5')
  })

  it('nominates a sized, pre-registered hypothesis from a Pulse signal', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(persona('Manager'))
    await user.click(nav().getByRole('button', { name: 'Pulse signals' }))
    const row = screen.getAllByRole('row').find((candidate) => within(candidate).queryByText('Data analysis'))!
    await user.click(within(row).getByRole('button', { name: /Nominate hypothesis/ }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/From a Pulse signal/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('AI-assisted use case')).toHaveValue('Reduce rework in data analysis')
    expect(within(dialog).getByText(/hours per quarter/)).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Operational evidence source'), { target: { value: 'Quality review log' } })
    fireEvent.change(within(dialog).getByLabelText('Quality, risk, or workload guardrail'), { target: { value: 'Turnaround must not rise' } })
    fireEvent.change(within(dialog).getByLabelText('Primary metric'), { target: { value: 'Rework rate' } })
    fireEvent.change(within(dialog).getByLabelText('Guardrail metric'), { target: { value: 'Turnaround time' } })
    await user.click(within(dialog).getByRole('button', { name: /Nominate hypothesis/ }))
    expect(await screen.findByText(/Management prioritises which to test/)).toBeInTheDocument()
    const nominated = stored().hypotheses[0]
    expect(nominated).toMatchObject({ status: 'Nominated', owner: 'Customer Operations', workType: 'Data analysis', successCriterion: { metric: 'Rework rate' } })
    expect(nominated.sourceSignal).toMatch(/Pulse Q3 2026/)
  })

  it('needs executive approval before a study starts, then judges it against the locked criterion', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(nav().getByRole('button', { name: 'Hypothesis priorities' }))
    const nominated = screen.getByRole('article', { name: 'Reduce rework in data analysis' })
    expect(within(nominated).getByText('Awaiting prioritisation')).toBeInTheDocument()
    await user.click(within(nominated).getByRole('button', { name: /Approve for testing/ }))
    expect(within(screen.getByRole('article', { name: 'Reduce rework in data analysis' })).getByText('Ready to test')).toBeInTheDocument()

    await user.click(persona('Manager'))
    await user.click(nav().getByRole('button', { name: 'Hypotheses' }))
    await user.click(screen.getByRole('checkbox', { name: /Only/ }))
    await user.click(within(screen.getByRole('article', { name: 'Reduce rework in data analysis' })).getByRole('button', { name: /Start study/ }))
    const study = screen.getByRole('article', { name: 'Reduce rework in data analysis' })
    expect(within(study).getByText(/Pre-registered success criterion/)).toBeInTheDocument()
    await user.click(within(study).getByRole('button', { name: 'Record evidence' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/locked/)).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Study cohort'), { target: { value: '60 analyses · randomised' } })
    fireEvent.change(within(dialog).getByLabelText('Without AI observations'), { target: { value: '40' } })
    fireEvent.change(within(dialog).getByLabelText('Without AI mean'), { target: { value: '30' } })
    fireEvent.change(within(dialog).getByLabelText('Without AI standard deviation'), { target: { value: '8' } })
    fireEvent.change(within(dialog).getByLabelText('With AI observations'), { target: { value: '40' } })
    fireEvent.change(within(dialog).getByLabelText('With AI mean'), { target: { value: '20' } })
    fireEvent.change(within(dialog).getByLabelText('With AI standard deviation'), { target: { value: '8' } })
    fireEvent.change(within(dialog).getByLabelText('Guardrail change (% worse)'), { target: { value: '2' } })
    fireEvent.change(within(dialog).getByLabelText('Study progress (%)'), { target: { value: '100' } })
    expect(within(dialog).getByText('Supported')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Save evidence' }))

    const saved = screen.getByRole('article', { name: 'Reduce rework in data analysis' })
    expect(within(saved).getByText('Supported')).toBeInTheDocument()
    expect(within(saved).getByText(/33% better than comparison/)).toBeInTheDocument()
    expect(within(saved).getByText('Capacity')).toBeInTheDocument()
  })
})

describe('Financial approval and decisions', () => {
  it('values a supported study, approves it, and updates the next-dollar suggestion', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(nav().getByRole('button', { name: 'Next-dollar decisions' }))
    const before = screen.getAllByRole('row').find((row) => within(row).queryByText('Customer Operations'))!
    expect(within(before).getAllByText('Keep measuring').length).toBeGreaterThan(0)

    await user.click(nav().getByRole('button', { name: 'Financial approvals' }))
    await user.click(screen.getByRole('button', { name: 'Propose valuation' }))
    let dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('option', { name: 'High' })).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Prepared by'), { target: { value: 'Customer Operations manager' } })
    fireEvent.change(within(dialog).getByLabelText('Proposed gross value ($)'), { target: { value: '40000' } })
    fireEvent.change(within(dialog).getByLabelText('Benefit scope key'), { target: { value: 'customer-operations|case-prep|2026-q3' } })
    fireEvent.change(within(dialog).getByLabelText('Valuation formula'), { target: { value: '800 extra cases × $50' } })
    fireEvent.change(within(dialog).getByLabelText('Valuation source'), { target: { value: 'Case throughput report' } })
    fireEvent.change(within(dialog).getByLabelText('Attribution and valuation assumptions'), { target: { value: 'Released time absorbed the backlog.' } })
    await user.click(within(dialog).getByRole('button', { name: /Submit for review/ }))
    expect(await screen.findByText(/ROI unchanged until finance approves/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Review valuation' }))
    dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Finance reviewer'), { target: { value: 'Finance owner (demo)' } })
    fireEvent.change(within(dialog).getByLabelText('Decision rationale'), { target: { value: 'Accepted at low confidence.' } })
    await user.click(within(dialog).getByRole('button', { name: /Approve claim/ }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/Confirm attribution/)
    await user.click(within(dialog).getByLabelText('Outcome attribution and valuation evidence reviewed'))
    await user.click(within(dialog).getByLabelText('Quality, risk, and workload guardrails accepted'))
    await user.click(within(dialog).getByLabelText('Duplicate claims and Pulse scope exclusion checked'))
    await user.click(within(dialog).getByRole('button', { name: /Approve claim/ }))

    await user.click(nav().getByRole('button', { name: 'Portfolio' }))
    expect(summaryMetric('Validated value')).toBe('$80,480')

    await user.click(nav().getByRole('button', { name: 'Next-dollar decisions' }))
    const after = screen.getAllByRole('row').find((row) => within(row).queryByText('Customer Operations'))!
    expect(within(after).getAllByText('Scale').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Record decision for Customer Operations' }))
    dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Rationale'), { target: { value: 'Case preparation pays back; extend to all case teams.' } })
    await user.click(within(dialog).getByRole('button', { name: /Record decision/ }))
    expect(await screen.findByText(/Decision recorded for Customer Operations/)).toBeInTheDocument()
    expect(stored().decisions.at(-1)).toMatchObject({ team: 'Customer Operations', decision: 'Scale', suggested: 'Scale', period: '2026-Q3' })
  })
})

describe('Rules, sampling, and the bill', () => {
  it('publishes a new policy version after previewing its impact', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(nav().getByRole('button', { name: 'Rules & policy' }))
    fireEvent.change(screen.getByLabelText('Modelled weight'), { target: { value: '50' } })
    expect(screen.getByText('Evidence weight · Modelled: 70% → 50%')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Reason for the change'), { target: { value: 'Tighter modelled valuations' } })
    await user.click(screen.getByRole('button', { name: /Publish policy-v2/ }))
    expect(await screen.findByText(/policy-v2 published/)).toBeInTheDocument()
    expect(stored().policy).toMatchObject({ version: 2, evidenceWeights: { Modelled: 0.5 } })
    expect(stored().policyHistory[0]).toMatchObject({ version: 2, reason: 'Tighter modelled valuations' })
    await user.click(nav().getByRole('button', { name: 'Portfolio' }))
    expect(summaryMetric('Validated ROI')).toBe('14%')
  })

  it('shows the random sample, its burden, and what the studies cover', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(nav().getByRole('button', { name: 'Sampling engine' }))
    expect(screen.getByText('The survey costs seconds, not the savings')).toBeInTheDocument()
    expect(screen.getByText(/194 of 287/)).toBeInTheDocument()
    expect(screen.getByText(/2,957 sessions left out when the sample was drawn/)).toBeInTheDocument()
  })

  it('imports a new quarter’s bill, registers new products, and draws its sample', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(nav().getByRole('button', { name: 'Bills & usage data' }))
    const csv = 'period,product,team,active_users,task_sessions,credits,cost\n2026-10,GitHub Copilot,Digital Channels,87,2330,7250,2460\n2026-10,Azure AI agents,Platform Engineering,12,400,2000,900\n'
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File([csv], 'q4.csv', { type: 'text/csv' }))
    expect(await screen.findByText(/q4.csv: 2 rows applied to Q4 2026/)).toBeInTheDocument()
    expect(stored().products.map((product: { name: string }) => product.name)).toContain('Azure AI agents')

    await user.selectOptions(screen.getByLabelText('Reporting quarter'), '2026-Q4')
    expect(screen.getByText(/\$3,360 consumption spend/)).toBeInTheDocument()
    await user.click(nav().getByRole('button', { name: 'Sampling engine' }))
    await user.click(screen.getByRole('button', { name: /Draw sample for Q4 2026/ }))
    expect(await screen.findByText(/Drew \d+ invitations for Q4 2026/)).toBeInTheDocument()
    expect(stored().frames.find((frame: { period: string }) => frame.period === '2026-Q4').months).toEqual(['2026-10'])

    await user.click(nav().getByRole('button', { name: 'Bills & usage data' }))
    const november = 'period,product,team,active_users,task_sessions,credits,cost\n2026-11,GitHub Copilot,Digital Channels,88,2400,7400,2500\n'
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File([november], 'nov.csv', { type: 'text/csv' }))
    await screen.findByText(/nov.csv: 1 rows applied/)
    await user.click(nav().getByRole('button', { name: 'Sampling engine' }))
    expect(screen.getByText(/which this sample doesn’t cover/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Extend sample/ }))
    expect(await screen.findByText(/Added \d+ invitations for the new months/)).toBeInTheDocument()
    expect(stored().frames.find((frame: { period: string }) => frame.period === '2026-Q4').months).toEqual(['2026-10', '2026-11'])
  })

  it('rejects a bill with direct identifiers', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(nav().getByRole('button', { name: 'Bills & usage data' }))
    const csv = 'period,product,team,email,cost\n2026-10,GitHub Copilot,Digital Channels,person@example.com,50\n'
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File([csv], 'unsafe.csv', { type: 'text/csv' }))
    expect(await screen.findByText(/unsafe.csv was not applied/)).toBeInTheDocument()
    expect(stored().imports[0]).toMatchObject({ status: 'Rejected', note: expect.stringMatching(/Direct identifier "email"/) })
  })
})

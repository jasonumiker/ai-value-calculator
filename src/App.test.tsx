import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createStudyFromHypothesis, defaultAssumptions, submitFinancialReview } from './model'

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

describe('Linked hypothesis workflow', () => {
  it('starts, records, traces, persists, and exports a study without creating financial value', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    const initialRoi = summaryMetric('Validated ROI')
    const initialPulseRoi = summaryMetric('Pulse-inclusive ROI')
    await user.click(screen.getByRole('button', { name: 'Value hypotheses' }))
    const hypothesis = screen.getByRole('article', { name: 'Accelerate code review' })
    expect(within(hypothesis).getByText('Ready to test')).toBeInTheDocument()
    await user.click(within(hypothesis).getByRole('button', { name: /Start study/ }))

    const study = screen.getByRole('article', { name: 'Accelerate code review' })
    expect(within(study).getByText('Reduce review wait time')).toBeInTheDocument()
    expect(within(study).getAllByText('Deliver changes earlier').length).toBeGreaterThan(0)
    expect(within(study).getByText('Pull request cycle time')).toBeInTheDocument()
    expect(within(study).getByText('Change failure rate must not rise')).toBeInTheDocument()
    expect(within(study).getByText(/\$0 potential.*excluded/)).toBeInTheDocument()
    await user.click(within(study).getByRole('button', { name: 'Record evidence' }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Study cohort'), 'Platform releases')
    await user.type(within(dialog).getByLabelText('Study period'), 'Q3 2026')
    await user.clear(within(dialog).getByLabelText('Study progress (%)'))
    await user.type(within(dialog).getByLabelText('Study progress (%)'), '100')
    await user.click(within(dialog).getByRole('button', { name: 'Save evidence' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/baseline, comparison, and observed result/)
    await user.type(within(dialog).getByLabelText('Baseline'), '4 days')
    await user.type(within(dialog).getByLabelText('Current measurement'), '4 days')
    await user.type(within(dialog).getByLabelText('Comparison method'), 'Matched releases')
    await user.type(within(dialog).getByLabelText('Observed result'), 'No improvement')
    await user.selectOptions(within(dialog).getByLabelText('Outcome evidence'), 'Observed')
    await user.click(within(dialog).getByRole('button', { name: 'Save evidence' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const completed = screen.getByRole('article', { name: 'Accelerate code review' })
    expect(within(completed).getByText('No improvement')).toBeInTheDocument()
    expect(within(completed).getByText('Signal')).toBeInTheDocument()
    await user.click(within(completed).getByRole('button', { name: 'Accelerate code review' }))
    const linkedHypothesis = screen.getByRole('article', { name: 'Accelerate code review' })
    expect(within(linkedHypothesis).getByText('Study complete')).toBeInTheDocument()
    expect(within(linkedHypothesis).queryByRole('button', { name: /Start study/ })).not.toBeInTheDocument()
    await user.click(within(linkedHypothesis).getByRole('button', { name: /View study/ }))
    expect(screen.getAllByRole('article')).toHaveLength(1)

    unmount()
    render(<App />)
    expect(summaryMetric('Validated ROI')).toBe(initialRoi)
    expect(summaryMetric('Pulse-inclusive ROI')).toBe(initialPulseRoi)
    await user.click(screen.getByRole('button', { name: 'Value hypotheses' }))
    const restored = screen.getByRole('article', { name: 'Accelerate code review' })
    expect(within(restored).getByText('Study complete')).toBeInTheDocument()
    await user.click(within(restored).getByRole('button', { name: /View study/ }))
    expect(screen.getByText('No improvement')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'All studies' }))
    expect(screen.getAllByRole('article')).toHaveLength(4)

    await user.click(screen.getByRole('button', { name: 'Export' }))
    const blob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0] as Blob
    const snapshot = JSON.parse(await blob.text())
    const linkedStudies = snapshot.studies.filter((record: { hypothesisId: number }) => record.hypothesisId === 4)
    expect(linkedStudies).toHaveLength(1)
    expect(linkedStudies[0]).toMatchObject({ stage: 'Signal', grossValue: 0, progress: 100, result: 'No improvement' })
    expect(linkedStudies[0]).not.toHaveProperty('icon')
    expect(snapshot.hypotheses.find((record: { id: number }) => record.id === 4)).toMatchObject({ studyId: linkedStudies[0].id, status: 'Study complete' })
    expect(snapshot.portfolio.contributions.some((record: { id: string }) => record.id === linkedStudies[0].id)).toBe(false)
  })

  it('traces an existing validated study back to its hypothesis without creating a duplicate', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Value hypotheses' }))
    const hypothesis = screen.getByRole('article', { name: 'Generate unit tests' })
    expect(within(hypothesis).getByText('Study complete')).toBeInTheDocument()
    await user.click(within(hypothesis).getByRole('button', { name: /View study/ }))
    const study = screen.getByRole('article', { name: 'Developer delivery cycle' })
    expect(within(study).queryByRole('button', { name: 'Record evidence' })).not.toBeInTheDocument()
    await user.click(within(study).getByRole('button', { name: 'Generate unit tests' }))
    expect(screen.getAllByRole('article')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'All hypotheses' }))
    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(localStorage.getItem('ai-value-calculator-studies')).toBeNull()
  })
})

describe('In-app financial approval', () => {
  const completed = {
    ...createStudyFromHypothesis({ id: 4, useCase: 'Accelerate code review', owner: 'Platform Engineering', product: 'GitHub Copilot', expectedEffect: 'Reduce review wait time', outcome: 'Deliver changes earlier', evidence: 'Pull request cycle time', guardrail: 'Change failure rate must not rise' }),
    progress: 100, cohort: 'Platform releases', period: 'Q3 2026', baseline: '4 days', comparison: 'Matched releases', result: '2 days earlier, quality unchanged', operationalGrade: 'Observed' as const,
  }

  it('submits, approves, persists, exports, and reconciles a claim inside the app', async () => {
    localStorage.setItem('ai-value-calculator-studies', JSON.stringify([completed]))
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    expect(summaryMetric('Validated claim value')).toBe('$99,900')
    await user.click(screen.getByRole('button', { name: 'Outcome studies' }))
    await user.click(within(screen.getByRole('article', { name: completed.name })).getByRole('button', { name: 'Prepare valuation' }))
    const proposalDialog = screen.getByRole('dialog')
    expect(within(proposalDialog).getByText(/self-declared, not authenticated/)).toBeInTheDocument()
    await user.type(within(proposalDialog).getByLabelText('Prepared by'), 'Process owner (demo)')
    await user.type(within(proposalDialog).getByLabelText('Proposed gross value ($)'), '12000')
    await user.type(within(proposalDialog).getByLabelText('Valuation formula'), '240 reused backlog hours x $50')
    await user.type(within(proposalDialog).getByLabelText('Valuation source'), 'Backlog contribution report')
    await user.selectOptions(within(proposalDialog).getByLabelText('Claim confidence'), 'High')
    await user.type(within(proposalDialog).getByLabelText('Benefit scope key'), 'platform|review-capacity|2026-q3')
    await user.type(within(proposalDialog).getByLabelText('Attribution and valuation assumptions'), 'Capacity used on committed demand with unchanged quality.')
    await user.click(within(proposalDialog).getByRole('button', { name: 'Submit for review' }))
    const pending = screen.getByRole('article', { name: completed.name })
    expect(within(pending).getByText('Pending financial review')).toBeInTheDocument()
    expect(within(pending).queryByRole('button', { name: 'Record evidence' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Overview', exact: true }))
    expect(summaryMetric('Validated claim value')).toBe('$99,900')
    await user.click(screen.getByRole('button', { name: 'Outcome studies' }))
    await user.click(screen.getByRole('checkbox', { name: /Pending financial reviews/ }))
    expect(screen.getAllByRole('article')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Review valuation' }))
    const reviewDialog = screen.getByRole('dialog')
    expect(within(reviewDialog).queryByLabelText('Proposed gross value ($)')).not.toBeInTheDocument()
    await user.type(within(reviewDialog).getByLabelText('Finance reviewer'), 'Finance owner (demo)')
    await user.type(within(reviewDialog).getByLabelText('Decision rationale'), 'Evidence, value rate, and benefit scope accepted.')
    await user.click(within(reviewDialog).getByRole('button', { name: 'Approve claim' }))
    expect(within(reviewDialog).getByRole('alert')).toHaveTextContent(/Confirm attribution/)
    await user.click(within(reviewDialog).getByLabelText('Outcome attribution and valuation evidence reviewed'))
    await user.click(within(reviewDialog).getByLabelText('Quality, risk, and workload guardrails accepted'))
    await user.click(within(reviewDialog).getByLabelText('Duplicate claims and Pulse scope exclusion checked'))
    await user.click(within(reviewDialog).getByRole('button', { name: 'Approve claim' }))
    await user.click(screen.getByRole('button', { name: 'Overview', exact: true }))
    expect(summaryMetric('Validated claim value')).toBe('$108,900')

    unmount()
    render(<App />)
    expect(summaryMetric('Validated claim value')).toBe('$108,900')
    await user.click(screen.getByRole('button', { name: 'Outcome studies' }))
    await user.click(within(screen.getByRole('article', { name: completed.name })).getByRole('button', { name: 'View approval' }))
    const approvalDialog = screen.getByRole('dialog')
    expect(within(approvalDialog).getByText('Approved')).toBeInTheDocument()
    await user.click(within(approvalDialog).getByRole('button', { name: 'Record realization' }))
    await user.clear(within(approvalDialog).getByLabelText('Realized gross value ($)'))
    await user.type(within(approvalDialog).getByLabelText('Realized gross value ($)'), '8000')
    await user.type(within(approvalDialog).getByLabelText('Finance reviewer'), 'Finance owner (demo)')
    await user.clear(within(approvalDialog).getByLabelText('Realized value formula'))
    await user.type(within(approvalDialog).getByLabelText('Realized value formula'), '160 hours x $50')
    await user.type(within(approvalDialog).getByLabelText('Reconciliation source'), 'Reconciled contribution report')
    await user.type(within(approvalDialog).getByLabelText('Reconciliation and variance rationale'), 'Lower committed demand than forecast.')
    await user.click(within(approvalDialog).getByRole('button', { name: 'Confirm realization' }))
    expect(within(screen.getByRole('article', { name: completed.name })).getByText('Realized')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Overview', exact: true }))
    expect(summaryMetric('Validated claim value')).toBe('$107,900')
    await user.click(screen.getByRole('button', { name: 'Export' }))
    const blob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0] as Blob
    const snapshot = JSON.parse(await blob.text())
    const exported = snapshot.studies.find((study: { id: string }) => study.id === completed.id)
    expect(exported.financialReview.history.map((entry: { action: string }) => entry.action)).toEqual(['Submitted', 'Approved', 'Realized'])
    expect(exported.financialReview.proposal.grossValue).toBe(12000)
    expect(exported.realization.grossValue).toBe(8000)
    expect(snapshot.portfolio.validatedValue).toBe(107900)
  })

  it('returns a valuation for changes without adding value and preserves it for revision', async () => {
    const pending = submitFinancialReview(completed, {
      pillar: 'Improved Performance', grossValue: 12000, valuationFormula: '240 hours x $50', valuationSource: 'Draft valuation', valuationGrade: 'Modelled',
      confidence: 'High', overlapKey: 'platform|review-capacity|2026-q3', policyVersion: 'demo-claim-policy-v1', assumptions: 'Capacity reuse still under review.',
    }, 'Process owner (demo)', [])
    localStorage.setItem('ai-value-calculator-studies', JSON.stringify([pending]))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Outcome studies' }))
    await user.click(within(screen.getByRole('article', { name: completed.name })).getByRole('button', { name: 'Review valuation' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Finance reviewer'), 'Finance owner (demo)')
    await user.type(within(dialog).getByLabelText('Decision rationale'), 'Provide evidence of reused capacity.')
    await user.click(within(dialog).getByRole('button', { name: 'Return for changes' }))
    const rejected = screen.getByRole('article', { name: completed.name })
    expect(within(rejected).getByText('Changes requested')).toBeInTheDocument()
    expect(within(rejected).getByRole('button', { name: 'Record evidence' })).toBeEnabled()
    await user.click(within(rejected).getByRole('button', { name: 'Prepare valuation' }))
    expect(within(screen.getByRole('dialog')).getByLabelText('Proposed gross value ($)')).toHaveValue(12000)
    expect(screen.getByText('Provide evidence of reused capacity.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close', exact: true }))
    await user.click(screen.getByRole('button', { name: 'Overview', exact: true }))
    expect(summaryMetric('Validated claim value')).toBe('$99,900')
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
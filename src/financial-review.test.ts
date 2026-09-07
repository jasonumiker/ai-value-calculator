import { describe, expect, it } from 'vitest'
import { calculatePortfolio, createStudyFromHypothesis, decideFinancialReview, defaultAssumptions, isFinanciallyApproved, recordFinancialRealization, restoreStudyRecords, studies, submitFinancialReview, type FinancialDecision, type FinancialProposal } from './model'

const study = {
  ...createStudyFromHypothesis({ id: 20, useCase: 'Prepare cases', owner: 'Operations', product: 'Copilot Cowork', expectedEffect: 'Less preparation', outcome: 'More cases resolved', evidence: 'Case records', guardrail: 'Case quality remains stable' }),
  cohort: 'Operations case team',
  period: 'Q3 2026',
  baseline: '100 cases per week',
  comparison: 'Matched teams',
  result: '120 cases per week, quality unchanged',
  operationalGrade: 'Observed' as const,
  progress: 100,
}

const proposal: FinancialProposal = {
  pillar: 'Improved Performance',
  grossValue: 10000,
  valuationFormula: '200 additional cases x $50 contribution',
  valuationSource: 'Finance contribution policy',
  valuationGrade: 'Modelled',
  confidence: 'High',
  overlapKey: 'operations|case-throughput|2026-q3',
  policyVersion: 'claim-policy-v1',
  assumptions: 'Committed demand absorbed additional throughput; quality unchanged.',
}

const decision: FinancialDecision = { actor: 'Finance reviewer (demo)', notes: 'Operational records and contribution rate accepted.', evidenceChecked: true, guardrailsChecked: true, overlapChecked: true, riskOwner: '' }
const submittedAt = '2026-09-07T10:00:00.000Z'

describe('Financial review workflow', () => {
  it('freezes a submitted valuation without approving it and records an explicit approval', () => {
    const pending = submitFinancialReview(study, proposal, 'Process owner (demo)', [], submittedAt)
    expect(pending.stage).toBe('Signal')
    expect(pending.grossValue).toBe(0)
    expect(isFinanciallyApproved(pending)).toBe(false)
    const approved = decideFinancialReview(pending, 'Approved', decision, [])
    expect(approved).toMatchObject({ stage: 'Validated', grossValue: 10000, approvedBy: decision.actor })
    expect(isFinanciallyApproved(approved)).toBe(true)
    expect(calculatePortfolio(defaultAssumptions, [approved]).validatedValue).toBe(7500)
    expect(approved.financialReview?.history.map((event) => event.action)).toEqual(['Submitted', 'Approved'])
    expect(approved.financialReview?.history[0].recordedAt).toBe(submittedAt)
    expect(isFinanciallyApproved({ ...approved, grossValue: 100000 })).toBe(false)
    expect(isFinanciallyApproved({ ...approved, result: 'Changed after approval' })).toBe(false)
  })

  it('blocks incomplete evidence, missing attestations, and overlapping benefit scopes', () => {
    expect(() => submitFinancialReview({ ...study, progress: 99 }, proposal, 'Owner', [])).toThrow(/Complete the study/)
    expect(() => submitFinancialReview({ ...study, baseline: '' }, proposal, 'Owner', [])).toThrow(/baseline/)
    expect(() => submitFinancialReview(study, { ...proposal, grossValue: Number.NaN }, 'Owner', [])).toThrow(/positive/)
    const pending = submitFinancialReview(study, proposal, 'Owner', [])
    expect(() => decideFinancialReview(pending, 'Approved', { ...decision, overlapChecked: false }, [])).toThrow(/overlap/)
    expect(() => submitFinancialReview({ ...study, id: 'other-study' }, proposal, 'Owner', [pending])).toThrow(/already reserved/)
    expect(() => decideFinancialReview({ ...pending, result: 'Changed after submission' }, 'Approved', decision, [])).toThrow(/changed/)
  })

  it('retains rejected decisions and supports a revised submission', () => {
    const pending = submitFinancialReview(study, proposal, 'Owner', [])
    const rejected = decideFinancialReview(pending, 'Rejected', { ...decision, notes: 'Contribution rate needs evidence.', overlapChecked: false }, [])
    expect(isFinanciallyApproved(rejected)).toBe(false)
    expect(rejected.stage).toBe('Signal')
    const resubmitted = submitFinancialReview(rejected, { ...proposal, grossValue: 8000 }, 'Owner', [])
    expect(resubmitted.financialReview?.history.map((event) => event.action)).toEqual(['Submitted', 'Rejected', 'Submitted'])
    expect(resubmitted.financialReview?.history[0].proposal?.grossValue).toBe(10000)
  })

  it('requires risk-owner sign-off for expected-loss claims', () => {
    const pending = submitFinancialReview(study, { ...proposal, pillar: 'Risk Mitigation' }, 'Owner', [])
    expect(() => decideFinancialReview(pending, 'Approved', decision, [])).toThrow(/risk-owner/)
    const approved = decideFinancialReview(pending, 'Approved', { ...decision, riskOwner: 'Risk committee reference 42' }, [])
    expect(isFinanciallyApproved(approved)).toBe(true)
  })

  it('reconciles actual value without losing the approved valuation or earlier decisions', () => {
    const approved = decideFinancialReview(submitFinancialReview(study, proposal, 'Owner', []), 'Approved', decision, [])
    const realized = recordFinancialRealization(approved, { grossValue: 7500, formula: '150 cases x $50', source: 'Reconciled case margin report', actor: decision.actor, notes: 'Lower demand than planned.' })
    expect(realized.stage).toBe('Realized')
    expect(realized.grossValue).toBe(7500)
    expect(realized.financialReview?.proposal.grossValue).toBe(10000)
    expect(isFinanciallyApproved(realized)).toBe(true)
    expect(calculatePortfolio(defaultAssumptions, [realized]).validatedValue).toBe(7500)
    expect(realized.financialReview?.history.map((event) => event.action)).toEqual(['Submitted', 'Approved', 'Realized'])
    expect(() => recordFinancialRealization(study, { ...realized.realization! })).toThrow(/Only an approved/)
    expect(() => recordFinancialRealization(approved, { ...realized.realization!, source: '' })).toThrow(/reconciliation source/)
    const noRealizedBenefit = recordFinancialRealization(approved, { ...realized.realization!, grossValue: 0, notes: 'No value realized.' })
    expect(noRealizedBenefit.stage).toBe('Realized')
    expect(calculatePortfolio(defaultAssumptions, [noRealizedBenefit]).validatedValue).toBe(0)
  })

  it('adds demo approval metadata only to unchanged legacy seed records', () => {
    const { icon: _icon, financialReview: _review, ...legacy } = studies[0]
    const unchanged = restoreStudyRecords([legacy]).find((record) => record.id === legacy.id)!
    expect(isFinanciallyApproved(unchanged)).toBe(true)
    const changed = restoreStudyRecords([{ ...legacy, grossValue: 100000 }]).find((record) => record.id === legacy.id)!
    expect(changed.grossValue).toBe(100000)
    expect(changed.financialReview).toBeUndefined()
    expect(isFinanciallyApproved(changed)).toBe(false)
  })
})
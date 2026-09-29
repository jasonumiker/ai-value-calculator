import { describe, expect, it } from 'vitest'
import { derivePeriod, deriveTrend } from '../state/derive'
import { buildSnapshot } from '../state/exportSnapshot'
import { recordDecision, suggestDecision, type TeamEvidence } from './decisions'
import { withRecordedApproval } from './finance'
import { defaultPolicy } from './policy'
import { calculatePortfolio } from './portfolio'
import { createDemoData } from './seed'

const noEvidence: TeamEvidence = { supported: [], notSupported: [], inconclusive: [], inStudy: [], readyToTest: [], awaitingValuation: [], pendingReviews: [], guardrailBreaches: [] }

describe('period-aligned portfolio', () => {
  it('compares each quarter’s approved claims with the same quarter’s bill and change costs', () => {
    const data = createDemoData()
    const claims = [...data.studies, ...data.claims]
    const q2 = calculatePortfolio({ period: '2026-Q2', claims, usage: data.usage, changeCosts: data.changeCosts, policy: data.policy })
    const q3 = calculatePortfolio({ period: '2026-Q3', claims, usage: data.usage, changeCosts: data.changeCosts, policy: data.policy })
    expect(q2.contributions.every((claim) => claim.period === '2026-Q2')).toBe(true)
    expect(q3.contributions.every((claim) => claim.period === '2026-Q3')).toBe(true)
    expect(q2.changeCost).toBe(33000)
    expect(q3.changeCost).toBe(17000)
    expect(q3.productCost).toBe(data.usage.filter((record) => record.period === '2026-Q3').reduce((sum, record) => sum + record.cost, 0))
    expect(q3.totalCost).toBe(q3.productCost + q3.changeCost)
    expect(q3.roi).toBeCloseTo((q3.adjustedValue - q3.totalCost) / q3.totalCost, 10)
  })

  it('applies the lower of outcome and valuation weights, then the confidence multiplier', () => {
    const data = createDemoData()
    const q3 = calculatePortfolio({ period: '2026-Q3', claims: [...data.studies, ...data.claims], usage: data.usage, changeCosts: data.changeCosts, policy: data.policy })
    const developer = q3.contributions.find((claim) => claim.id === 'developer-delivery')!
    expect(developer.limitingGrade).toBe('Modelled')
    expect(developer.adjustedValue).toBeCloseTo(84000 * defaultPolicy.evidenceWeights.Modelled * defaultPolicy.confidenceWeights.Medium, 5)
  })

  it('measures claim readiness across the whole pipeline, not only approved claims', () => {
    const data = createDemoData()
    const q3 = calculatePortfolio({ period: '2026-Q3', claims: [...data.studies, ...data.claims], usage: data.usage, changeCosts: data.changeCosts, policy: data.policy })
    expect(q3.readiness.claims).toBeGreaterThan(q3.contributions.length)
    expect(q3.readiness.percent).toBeGreaterThan(0)
    expect(q3.readiness.percent).toBeLessThan(1)
  })

  it('counts a benefit scope once even if two claims are approved for it', () => {
    const data = createDemoData()
    const original = data.claims.find((claim) => claim.id === 'external-research-spend-2026-q3')!
    const { financialReview: _review, realization: _realization, ...unapproved } = original
    const duplicate = withRecordedApproval({ ...unapproved, id: 'duplicate', name: 'Duplicate' }, { preparer: 'A', approver: 'B', policyVersion: 'policy-v1', recordedAt: '2026-09-30T00:00:00.000Z', notes: 'Second approval of the same benefit.' })
    const portfolio = calculatePortfolio({ period: '2026-Q3', claims: [...data.claims, duplicate], usage: data.usage, changeCosts: data.changeCosts, policy: data.policy })
    expect(portfolio.excludedDuplicates.map((claim) => claim.id)).toEqual(['duplicate'])
  })
})

describe('next-dollar decisions', () => {
  it('applies the decision rules in order', () => {
    expect(suggestDecision({ validatedValue: 50000, benefitCostRatio: 3, evidence: { ...noEvidence, guardrailBreaches: ['X'] } }, defaultPolicy).decision).toBe('Redesign')
    expect(suggestDecision({ validatedValue: 50000, benefitCostRatio: 3, evidence: noEvidence }, defaultPolicy).decision).toBe('Scale')
    expect(suggestDecision({ validatedValue: 100, benefitCostRatio: 0.1, evidence: { ...noEvidence, inStudy: ['Y'] } }, defaultPolicy).decision).toBe('Keep measuring')
    expect(suggestDecision({ validatedValue: 100, benefitCostRatio: 0.1, evidence: { ...noEvidence, supported: ['Y'] } }, defaultPolicy).decision).toBe('Redesign')
    expect(suggestDecision({ validatedValue: 0, benefitCostRatio: 0, evidence: { ...noEvidence, notSupported: ['Z'] } }, defaultPolicy).decision).toBe('Stop')
    expect(suggestDecision({ validatedValue: 0, benefitCostRatio: 0, evidence: noEvidence }, defaultPolicy).decision).toBe('Keep measuring')
  })

  it('records the decision and its reasoning separately from the suggestion', () => {
    expect(() => recordDecision([], { period: '2026-Q3', team: 'A', decision: 'Stop', suggested: 'Scale', rationale: ' ', decidedBy: 'CFO' })).toThrow(/reasoning/)
    const [record] = recordDecision([], { period: '2026-Q3', team: 'A', decision: 'Stop', suggested: 'Scale', rationale: 'Budget moved.', decidedBy: 'CFO' }, '2026-10-01T00:00:00.000Z', 'd1')
    expect(record).toMatchObject({ id: 'd1', decision: 'Stop', suggested: 'Scale' })
  })
})

describe('demo story', () => {
  it('is deterministic', () => {
    expect(JSON.stringify(createDemoData())).toBe(JSON.stringify(createDemoData()))
  })

  it('shows a material long tail beside validated claims, with studies and the Pulse kept apart', () => {
    const data = createDemoData()
    const q3 = derivePeriod(data, '2026-Q3')
    expect(q3.projection.projectionEligible).toBe(true)
    expect(q3.projection.estimatedValue).toBeGreaterThan(q3.portfolio.validatedValue * 0.4)
    expect(q3.combined.roi).toBeGreaterThan(q3.portfolio.roi)
    expect(q3.projection.frameExclusions.map((exclusion) => exclusion.claimName)).toContain('Developer delivery cycle')
    expect(q3.teams.map((row) => [row.team, row.suggestion.decision])).toEqual(expect.arrayContaining([
      ['Digital Channels', 'Scale'], ['Customer Operations', 'Keep measuring'], ['Platform Engineering', 'Keep measuring'], ['Enterprise Sales', 'Redesign'],
    ]))
    const trend = deriveTrend(data)
    expect(trend.map((point) => point.period)).toEqual(['2026-Q2', '2026-Q3'])
    expect(trend[1].validatedRoi).toBeGreaterThan(trend[0].validatedRoi)
  })

  it('exports both ROI views and the evidence, without the invitation routing', () => {
    const data = createDemoData()
    const snapshot = buildSnapshot(data, '2026-Q3', '2026-10-01T00:00:00.000Z')
    expect(snapshot.roiViews.validated.basis).toMatch(/no Pulse extrapolation/)
    expect(snapshot.roiViews.pulseInclusive).toMatchObject({ projectionEligible: true, roi: expect.any(Number), intervalScope: expect.stringMatching(/sampling variation only/) })
    expect(snapshot.data).not.toHaveProperty('routing')
    const personKey = Object.values(data.routing)[0]
    expect(JSON.stringify(snapshot)).not.toContain(personKey)
  })
})

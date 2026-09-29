import { describe, expect, it } from 'vitest'
import { decideFinancialReview, isFinanciallyApproved, recordFinancialRealization, submitFinancialReview } from './finance'
import { MAX_ACTIVE_NOMINATIONS, activeNominations, hypothesisProgress, nominateHypothesis, portfolioHitRate, prioritiseHypothesis, rankHypotheses, sizeHypothesis, type HypothesisInput } from './hypotheses'
import { breakEvenRatio, defaultPolicy, describePolicyChanges, policyWarnings, publishPolicy } from './policy'
import { seedHypotheses } from './seed'
import { analyzeStudy, createStudyFromHypothesis, recordStudyEvidence, studyStatus, type StudyEvidenceInput } from './studies'
import type { FinancialDecision, FinancialProposal, Hypothesis } from './types'

const hypothesis: Hypothesis = { ...seedHypotheses[3], id: 40, status: 'Approved for testing' }

const completeEvidence: StudyEvidenceInput = {
  cohort: '60 reviews · randomised', period: '2026-Q3', design: 'Randomised', operationalSource: 'Review timestamps',
  control: { n: 40, mean: 40, sd: 10 }, treatment: { n: 40, mean: 30, sd: 10 }, guardrailChangePct: 1, progress: 100,
}

const proposal: FinancialProposal = {
  pillar: 'Improved Performance', grossValue: 10000, valuationFormula: '200 hours × $50', valuationSource: 'Finance policy',
  valuationGrade: 'Modelled', confidence: 'High', overlapKey: 'platform|review|2026-q3', policyVersion: 'policy-v1', assumptions: 'Capacity used on backlog.',
}
const decision: FinancialDecision = { actor: 'Finance (demo)', notes: 'Accepted.', evidenceChecked: true, guardrailsChecked: true, overlapChecked: true, riskOwner: '' }

const supportedStudy = () => recordStudyEvidence(createStudyFromHypothesis(hypothesis, '2026-07-01T00:00:00.000Z'), completeEvidence, defaultPolicy)

describe('pre-registered studies and verdicts', () => {
  it('copies and locks the success criterion when a study starts', () => {
    const study = createStudyFromHypothesis(hypothesis, '2026-07-01T00:00:00.000Z')
    expect(study).toMatchObject({ hypothesisId: 40, stage: 'Signal', grossValue: 0, progress: 0, preRegisteredAt: '2026-07-01T00:00:00.000Z' })
    expect(study.successCriterion).toEqual(hypothesis.successCriterion)
    expect(study.successCriterion).not.toBe(hypothesis.successCriterion)
    expect(study.pulseScope).toEqual({ team: 'Platform Engineering', product: 'GitHub Copilot', workTypes: ['Code review'] })
  })

  it('supports a hypothesis only when the interval clears zero and the estimate meets the threshold', () => {
    const study = supportedStudy()
    const analysis = analyzeStudy(study)!
    expect(analysis.verdict).toBe('Supported')
    expect(analysis.improvement).toBeCloseTo(0.25, 5)
    expect(analysis.low).toBeGreaterThan(0)
    expect(study.result).toMatch(/25% better than comparison \(95% CI \+\d+% to \+\d+%\)/)
    expect(study.stage).toBe('Capacity')
  })

  it('returns Not supported, Inconclusive, or In progress for the other outcomes', () => {
    const base = supportedStudy()
    expect(studyStatus({ ...base, guardrailChangePct: 9 })).toBe('Not supported')
    expect(analyzeStudy({ ...base, guardrailChangePct: 9 })!.reasons[0]).toMatch(/Guardrail breached/)
    expect(studyStatus({ ...base, treatment: { n: 40, mean: 39, sd: 10 } })).toBe('Not supported')
    expect(studyStatus({ ...base, control: { n: 8, mean: 40, sd: 12 }, treatment: { n: 8, mean: 30, sd: 12 } })).toBe('Inconclusive')
    expect(studyStatus({ ...base, control: { n: 40, mean: 40, sd: 30 }, treatment: { n: 40, mean: 33, sd: 30 } })).toBe('Inconclusive')
    expect(studyStatus({ ...base, progress: 60 })).toBe('In progress')
  })

  it('takes the evidence grade from the policy’s design cap and validates completed studies', () => {
    const study = createStudyFromHypothesis(hypothesis)
    expect(recordStudyEvidence(study, { ...completeEvidence, design: 'Before/after' }, defaultPolicy).operationalGrade).toBe('Estimated')
    expect(recordStudyEvidence(study, { ...completeEvidence, design: 'Anecdotal' }, defaultPolicy).operationalGrade).toBe('Anecdotal')
    expect(() => recordStudyEvidence(study, { ...completeEvidence, control: undefined, treatment: undefined }, defaultPolicy)).toThrow(/both arms/)
    expect(() => recordStudyEvidence(study, { ...completeEvidence, period: 'soon' }, defaultPolicy)).toThrow(/quarter/)
    expect(() => recordStudyEvidence(study, { ...completeEvidence, treatment: { n: 1, mean: 3, sd: 1 } }, defaultPolicy)).toThrow(/at least 2/)
    expect(() => recordStudyEvidence(study, { ...completeEvidence, treatment: { n: 40, mean: Number.NaN, sd: 10 } }, defaultPolicy)).toThrow(/mean/)
    expect(() => recordStudyEvidence(study, { ...completeEvidence, control: { n: 40, mean: 40, sd: 0 }, treatment: { n: 40, mean: 30, sd: 0 } }, defaultPolicy)).toThrow(/above 0/)
    expect(createStudyFromHypothesis(hypothesis, '2026-07-01T00:00:00.000Z', '2026-Q3').period).toBe('2026-Q3')
    expect(recordStudyEvidence(study, { ...completeEvidence, control: undefined, treatment: undefined, guardrailChangePct: undefined, progress: 30 }, defaultPolicy).result).toBe('Not measured yet')
  })
})

describe('hypothesis sizing, prioritisation, and hit rate', () => {
  const input: HypothesisInput = {
    useCase: 'Summarise tickets', owner: 'Support', nominatedBy: 'Support manager', product: 'Copilot Cowork', workType: 'Research and synthesis',
    expectedEffect: 'Faster triage', outcome: 'Shorter queue', evidence: 'Ticket timestamps', guardrail: 'CSAT must not fall',
    frequencyPerWeek: 4, peopleAffected: 30, expectedMinutesSaved: 10, studyEffort: 'Medium',
    successCriterion: { metric: 'Triage time', unit: 'minutes per task', direction: 'decrease', minimumImprovementPct: 15, guardrailMetric: 'CSAT', guardrailMaxWorseningPct: 2, minimumSamplePerArm: 20 },
  }

  it('sizes value if true from frequency × people × minutes at the CFO’s rates and ranks by value ÷ effort', () => {
    const sizing = sizeHypothesis(input, defaultPolicy)
    expect(sizing.hoursPerQuarter).toBeCloseTo(4 * 30 * 13 * 10 / 60, 5)
    expect(sizing.valueIfTrue).toBeCloseTo(sizing.hoursPerQuarter * 50 * 0.6, 5)
    expect(sizing.priorityScore).toBeCloseTo(sizing.valueIfTrue / 2, 5)
    const ranked = rankHypotheses(seedHypotheses, defaultPolicy)
    expect(ranked[0].rank).toBe(1)
    expect(ranked.every((entry, index) => index === 0 || entry.priorityScore <= ranked[index - 1].priorityScore)).toBe(true)
  })

  it('caps each manager at five active nominations and needs management approval before testing', () => {
    const existing = Array.from({ length: MAX_ACTIVE_NOMINATIONS }, (_, index) => nominateHypothesis([], input, '2026-09-01T00:00:00.000Z', index + 100))
    expect(() => nominateHypothesis(existing, input)).toThrow(/5 open nominations/)
    const parked = [prioritiseHypothesis(existing[0], 'Parked', 'Exec'), ...existing.slice(1)]
    expect(nominateHypothesis(parked, input).status).toBe('Nominated')
    expect(hypothesisProgress(existing[0], [])).toBe('Awaiting prioritisation')
    expect(hypothesisProgress(prioritiseHypothesis(existing[0], 'Approved for testing', 'Exec'), [])).toBe('Ready to test')
    expect(() => nominateHypothesis([], { ...input, frequencyPerWeek: 0 })).toThrow(/Size the hypothesis/)
  })

  it('frees a nomination slot once a hypothesis reaches a verdict', () => {
    const approved = Array.from({ length: MAX_ACTIVE_NOMINATIONS }, (_, index) => prioritiseHypothesis(nominateHypothesis([], input, '2026-09-01T00:00:00.000Z', index + 200), 'Approved for testing', 'Exec'))
    expect(activeNominations(approved, 'Support manager')).toBe(MAX_ACTIVE_NOMINATIONS)
    const concluded = recordStudyEvidence(createStudyFromHypothesis(approved[0], '2026-09-02T00:00:00.000Z', '2026-Q3'), completeEvidence, defaultPolicy)
    expect(activeNominations(approved, 'Support manager', [concluded])).toBe(MAX_ACTIVE_NOMINATIONS - 1)
    expect(nominateHypothesis(approved, input, undefined, 300, [concluded]).status).toBe('Nominated')
    expect(() => nominateHypothesis(approved, input, undefined, 301, [])).toThrow(/open nominations/)
  })

  it('reports verdicts and a portfolio hit rate', () => {
    const study = supportedStudy()
    expect(hypothesisProgress(hypothesis, [study])).toBe('Supported')
    const failed = { ...study, hypothesisId: 41, guardrailChangePct: 20 }
    const hit = portfolioHitRate([hypothesis, { ...hypothesis, id: 41 }], [study, failed])
    expect(hit).toMatchObject({ supported: 1, notSupported: 1, tested: 2, hitRate: 0.5 })
  })
})

describe('financial approval: proposed → approved → realized', () => {
  it('approves only a supported study, within the design’s confidence cap', () => {
    const study = supportedStudy()
    const proposed = submitFinancialReview(study, proposal, 'Manager', [], defaultPolicy, '2026-09-01T00:00:00.000Z')
    expect(proposed.stage).toBe('Capacity')
    expect(isFinanciallyApproved(proposed)).toBe(false)
    const approved = decideFinancialReview(proposed, 'Approved', decision, [])
    expect(approved).toMatchObject({ stage: 'Validated', grossValue: 10000, approvedBy: 'Finance (demo)' })
    expect(isFinanciallyApproved(approved)).toBe(true)
    expect(isFinanciallyApproved({ ...approved, grossValue: 99999 })).toBe(false)
    expect(isFinanciallyApproved({ ...approved, treatment: { n: 40, mean: 20, sd: 10 } })).toBe(false)

    expect(() => submitFinancialReview({ ...study, guardrailChangePct: 9 }, proposal, 'Manager', [])).toThrow(/Only a supported hypothesis/)
    const matched = recordStudyEvidence(createStudyFromHypothesis(hypothesis), { ...completeEvidence, design: 'Matched groups' }, defaultPolicy)
    expect(() => submitFinancialReview(matched, proposal, 'Manager', [])).toThrow(/capped at Medium confidence/)
    expect(submitFinancialReview(matched, { ...proposal, confidence: 'Medium' }, 'Manager', []).financialReview?.status).toBe('Pending')
  })

  it('blocks overlapping benefit scopes, changed evidence, and missing checks', () => {
    const study = supportedStudy()
    const pending = submitFinancialReview(study, proposal, 'Manager', [])
    expect(() => submitFinancialReview({ ...study, id: 'other' }, proposal, 'Manager', [pending])).toThrow(/already reserved/)
    expect(() => decideFinancialReview(pending, 'Approved', { ...decision, overlapChecked: false }, [])).toThrow(/overlap/)
    expect(() => decideFinancialReview({ ...pending, cohort: 'Changed' }, 'Approved', decision, [])).toThrow(/changed after submission/)
    expect(() => decideFinancialReview(submitFinancialReview(study, { ...proposal, pillar: 'Risk Mitigation' }, 'Manager', []), 'Approved', decision, [])).toThrow(/risk-owner/)
  })

  it('keeps returned proposals in history and reconciles realized value without adding a second benefit', () => {
    const study = supportedStudy()
    const returned = decideFinancialReview(submitFinancialReview(study, proposal, 'Manager', []), 'Rejected', { ...decision, notes: 'Evidence the reuse.' }, [])
    expect(returned.stage).toBe('Capacity')
    const approved = decideFinancialReview(submitFinancialReview(returned, { ...proposal, grossValue: 8000 }, 'Manager', []), 'Approved', decision, [])
    expect(approved.financialReview?.history.map((event) => event.action)).toEqual(['Submitted', 'Rejected', 'Submitted', 'Approved'])
    const realized = recordFinancialRealization(approved, { grossValue: 6000, formula: '120 h × $50', source: 'Ledger', actor: 'Finance', notes: 'Less demand.' })
    expect(realized).toMatchObject({ stage: 'Realized', grossValue: 6000, valuationGrade: 'Observed' })
    expect(isFinanciallyApproved(realized)).toBe(true)
    expect(() => recordFinancialRealization(study, { grossValue: 1, formula: 'f', source: 's', actor: 'a', notes: 'n' })).toThrow(/Only an approved/)
  })
})

describe('CFO policy', () => {
  it('orders default evidence weights from strongest to weakest', () => {
    expect(policyWarnings(defaultPolicy)).toEqual([])
    const { Observed, Estimated, Modelled, Anecdotal } = defaultPolicy.evidenceWeights
    expect(Observed >= Estimated && Estimated >= Modelled && Modelled >= Anecdotal).toBe(true)
    expect(policyWarnings({ ...defaultPolicy, evidenceWeights: { ...defaultPolicy.evidenceWeights, Modelled: 0.9 } })[0]).toMatch(/should not increase/)
  })

  it('publishes a new version with a readable change log and rejects invalid drafts', () => {
    const draft = { ...defaultPolicy, contributionValuePerHour: 60, lossTreatment: 'Same discounts' as const }
    expect(describePolicyChanges(defaultPolicy, draft)).toEqual(['Contribution value per hour: $50 → $60', 'Slower-task treatment: Full rate → Same discounts'])
    const { policy, change } = publishPolicy(defaultPolicy, draft, 'CFO', 'Annual rate review', '2026-10-01T00:00:00.000Z')
    expect(policy.version).toBe(2)
    expect(change).toMatchObject({ version: 2, changedBy: 'CFO', reason: 'Annual rate review' })
    expect(() => publishPolicy(defaultPolicy, defaultPolicy, 'CFO', 'No change')).toThrow(/no policy changes/)
    expect(() => publishPolicy(defaultPolicy, { ...defaultPolicy, minimumResponsesPerStratum: 1 }, 'CFO', 'x')).toThrow(/two responses/)
  })

  it('makes the asymmetric treatment of slower tasks explicit as a break-even ratio', () => {
    expect(breakEvenRatio(0.75, 0.6, 'Full rate')).toBeCloseTo(2.22, 2)
    expect(breakEvenRatio(0.75, 0.6, 'Same discounts')).toBe(1)
    expect(breakEvenRatio(0, 0.6, 'Full rate')).toBe(Number.POSITIVE_INFINITY)
  })
})

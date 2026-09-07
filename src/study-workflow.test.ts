import { describe, expect, it } from 'vitest'
import { calculatePortfolio, createStudyFromHypothesis, defaultAssumptions, getHypothesisStatus, studies, type Hypothesis } from './model'

const hypothesis: Hypothesis = {
  id: 17,
  useCase: 'Draft release notes',
  owner: 'Documentation',
  product: 'Copilot Cowork',
  expectedEffect: 'Faster drafting',
  outcome: 'Publish notes earlier',
  evidence: 'Release tracker',
  guardrail: 'Correction rate must not rise',
}

describe('Hypothesis-to-study workflow', () => {
  it('creates a serializable study that inherits the hypothesis and starts unvalued', () => {
    const study = createStudyFromHypothesis(hypothesis)

    expect(study).toMatchObject({
      hypothesisId: hypothesis.id,
      name: hypothesis.useCase,
      team: hypothesis.owner,
      product: hypothesis.product,
      expectedEffect: hypothesis.expectedEffect,
      outcome: hypothesis.outcome,
      metric: hypothesis.outcome,
      operationalSource: hypothesis.evidence,
      guardrail: hypothesis.guardrail,
      stage: 'Signal',
      grossValue: 0,
      progress: 0,
    })
    expect(JSON.parse(JSON.stringify(study))).toEqual(study)
    expect(study).not.toHaveProperty('approvedBy')
    expect(calculatePortfolio(defaultAssumptions, [study]).validatedValue).toBe(0)
  })

  it('derives workflow progress without treating completion as financial validation', () => {
    const study = createStudyFromHypothesis(hypothesis)
    expect(getHypothesisStatus(hypothesis.id, [])).toBe('Ready to test')
    expect(getHypothesisStatus(hypothesis.id, [study])).toBe('In study')

    const completed = { ...study, progress: 100, result: 'No improvement' }
    expect(getHypothesisStatus(hypothesis.id, [completed])).toBe('Study complete')
    expect(calculatePortfolio(defaultAssumptions, [completed]).validatedValue).toBe(0)
  })

  it('links the existing studies to distinct originating hypotheses', () => {
    expect(studies.map((study) => study.hypothesisId)).toEqual([1, 2, 3])
    expect(getHypothesisStatus(1, studies)).toBe('Study complete')
    expect(getHypothesisStatus(2, studies)).toBe('In study')
    expect(getHypothesisStatus(4, studies)).toBe('Ready to test')
  })
})
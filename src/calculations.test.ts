import { describe, expect, it } from 'vitest'
import {
  calculatePortfolio,
  combinePulseWithPortfolio,
  copilotSpend,
  defaultAssumptions,
  estimatePulseValue,
  formatCurrency,
  formatPercent,
  formatShort,
  pulseProjectionPolicy,
  studies,
  summarizePulse,
  valueClaims,
  type Assumptions,
  type ResponseRecord,
  type ValueClaim,
} from './model'

const response = (timeImpact: string, id = 1): ResponseRecord => ({
  id,
  product: 'GitHub Copilot',
  workType: 'Code and tests',
  timeImpact,
  effect: 'No material change',
  date: 'Today',
})

const sampledResponse = (product: ResponseRecord['product'], timeImpact: number, id: number): ResponseRecord => ({
  ...response(String(timeImpact), id),
  product,
  sampleFrameId: pulseProjectionPolicy.id,
})

describe('governed defaults and total cost', () => {
  it('includes product, implementation, enablement, and operating costs', () => {
    const portfolio = calculatePortfolio(defaultAssumptions)
    expect(copilotSpend).toBe(28460)
    expect(defaultAssumptions).toMatchObject({
      implementationCost: 18000,
      enablementCost: 9000,
      operationsCost: 6000,
    })
    expect(portfolio.totalCost).toBe(61460)
  })

  it('uses standard ROI math for the explicit Validated view', () => {
    const portfolio = calculatePortfolio(defaultAssumptions)
    expect(portfolio.netValue).toBeCloseTo(portfolio.adjustedValue - portfolio.totalCost, 5)
    expect(portfolio.roi).toBeCloseTo(portfolio.netValue / portfolio.totalCost, 5)
    expect(portfolio.benefitCostRatio).toBeCloseTo(portfolio.adjustedValue / portfolio.totalCost, 5)
    expect(portfolio.validatedValue).toBe(portfolio.adjustedValue)
    expect(portfolio.validatedNetValue).toBe(portfolio.netValue)
    expect(portfolio.validatedRoi).toBe(portfolio.roi)
    expect(portfolio.validatedBenefitCostRatio).toBe(portfolio.benefitCostRatio)
  })
})

describe('Validated ROI eligibility', () => {
  it('counts only validated and realized claims with a valuation source', () => {
    const portfolio = calculatePortfolio(defaultAssumptions)
    expect(portfolio.contributions.map((claim) => claim.stage)).toEqual(['Validated', 'Realized', 'Validated'])
    expect(portfolio.rawValue).toBe(84000 + 16500 + 32000)
    expect(portfolio.pipelineValue).toBe(44100)
    expect(portfolio.contributions.some((claim) => claim.name === 'Knowledge work preparation')).toBe(false)
    expect(portfolio.contributions.some((claim) => claim.name === 'New AI-assisted service concept')).toBe(false)
  })

  it('keeps operational and valuation evidence separate and applies the conservative weight', () => {
    const developer = calculatePortfolio(defaultAssumptions).contributions.find((claim) => claim.id === 'developer-delivery')!
    expect(developer.operationalGrade).toBe('Observed')
    expect(developer.valuationGrade).toBe('Modelled')
    expect(developer.limitingGrade).toBe('Modelled')
    expect(developer.adjustedValue).toBeCloseTo(84000 * 0.75, 5)
  })

  it('uses transparent demo values and computes evidence retention', () => {
    const portfolio = calculatePortfolio(defaultAssumptions)
    expect(portfolio.adjustedValue).toBeCloseTo(99900, 5)
    expect(portfolio.retentionRate).toBe(Math.round(99900 / 132500 * 100))
    expect(portfolio.evidenceCoverage).toBe(100)
  })

  it('prevents two eligible claims with the same cohort-period overlap key from being counted', () => {
    const original = valueClaims.find((claim) => claim.id === 'external-research-spend')!
    const duplicate: ValueClaim = { ...original, id: 'duplicate', name: 'Duplicate claim', grossValue: 999999 }
    const portfolio = calculatePortfolio(defaultAssumptions, [...valueClaims, duplicate])
    expect(portfolio.rawValue).toBe(132500)
    expect(portfolio.excludedDuplicates).toHaveLength(1)
    expect(portfolio.excludedDuplicates[0].id).toBe('duplicate')
  })
})

describe('evidence policy', () => {
  it('adjusts eligible value without changing gross value or total cost', () => {
    const stricter: Assumptions = { ...defaultAssumptions, modelledWeight: 0.25 }
    const baseline = calculatePortfolio(defaultAssumptions)
    const reduced = calculatePortfolio(stricter)
    expect(reduced.rawValue).toBe(baseline.rawValue)
    expect(reduced.totalCost).toBe(baseline.totalCost)
    expect(reduced.adjustedValue).toBeLessThan(baseline.adjustedValue)
  })

  it('returns all four pillars without inventing innovation value', () => {
    const pillars = calculatePortfolio(defaultAssumptions).pillars
    expect(pillars.map((pillar) => pillar.label)).toEqual([
      'Improved Performance',
      'Cost Savings',
      'Innovation / Transformation',
      'Risk Mitigation',
    ])
    expect(pillars.find((pillar) => pillar.label === 'Innovation / Transformation')?.value).toBe(0)
  })

  it('retains observed, estimated, and modelled study provenance', () => {
    expect(studies.some((study) => study.operationalGrade === 'Observed')).toBe(true)
    expect(studies.some((study) => study.operationalGrade === 'Estimated')).toBe(true)
    expect(studies.some((study) => study.valuationGrade === 'Modelled')).toBe(true)
    expect(studies.some((study) => study.stage === 'Capacity')).toBe(true)
  })
})

describe('optional employee pulse', () => {
  it('summarizes only the collected sample and disables population projection', () => {
    const summary = summarizePulse([response('1–4 hours faster')])
    expect(summary.low).toBe(1)
    expect(summary.mid).toBe(2.5)
    expect(summary.responseCount).toBe(1)
    expect(summary.projectionEligible).toBe(false)
    expect(summary.projectionReason).toMatch(/sampling frame/i)
  })

  it('preserves neutral and negative responses', () => {
    const summary = summarizePulse([
      response('No meaningful difference'),
      response('15–30 minutes slower', 2),
      response('30–60 minutes faster', 3),
    ])
    expect(summary.faster).toBe(1)
    expect(summary.neutral).toBe(1)
    expect(summary.slower).toBe(1)
    expect(summary.low).toBe(0)
  })

  it('uses exact hours entered by the synchronized pulse controls', () => {
    const summary = summarizePulse([
      response('-1.25'),
      response('2.5', 2),
    ])
    expect(summary.low).toBe(1.25)
    expect(summary.mid).toBe(1.25)
    expect(summary.faster).toBe(1)
    expect(summary.slower).toBe(1)
  })

  it('does not feed pulse responses into the portfolio calculation', () => {
    const before = calculatePortfolio(defaultAssumptions)
    summarizePulse(Array.from({ length: 100 }, (_, index) => response('1–4 hours faster', index)))
    const after = calculatePortfolio(defaultAssumptions)
    expect(after.adjustedValue).toBe(before.adjustedValue)
    expect(after.roi).toBe(before.roi)
  })
})

describe('governed Pulse projection', () => {
  const effects = [1, 0.5, 0.25, 0, -0.25, 0.5, 0.25, 0, -0.25, 0.25]
  const sampled = (['GitHub Copilot', 'Copilot Cowork'] as const).flatMap((product, productIndex) =>
    effects.map((effect, index) => sampledResponse(product, effect, productIndex * 10 + index)),
  )

  it('requires a known random frame rather than extrapolating convenience responses', () => {
    const projection = estimatePulseValue(Array.from({ length: 20 }, (_, index) => response('1', index)))
    expect(projection.projectionEligible).toBe(false)
    expect(projection.sampledResponseCount).toBe(0)
    expect(projection.projectionReason).toMatch(/fewer than 10 sampled responses/i)
  })

  it('requires certification that registered claim scopes were removed upstream', () => {
    const projection = estimatePulseValue(sampled, {
      ...pulseProjectionPolicy,
      registeredClaimScopesExcludedUpstream: false,
    })
    expect(projection.projectionEligible).toBe(false)
    expect(projection.projectionReason).toMatch(/not certified as excluding registered claim scopes upstream/i)
  })

  it('post-stratifies sampled task effects and returns a wide 95% interval', () => {
    const projection = estimatePulseValue(sampled)
    expect(projection.projectionEligible).toBe(true)
    expect(projection.sampledResponseCount).toBe(20)
    expect(projection.populationTaskEvents).toBe(1200)
    expect(projection.estimatedHours).toBeCloseTo(270, 5)
    expect(projection.hoursInterval.low).toBeLessThan(projection.estimatedHours)
    expect(projection.hoursInterval.high).toBeGreaterThan(projection.estimatedHours)
    expect(projection.valueInterval.low).toBeLessThan(projection.estimatedValue)
    expect(projection.valueInterval.high).toBeGreaterThan(projection.estimatedValue)
  })

  it('discounts positive capacity but charges slower-task time at full value', () => {
    const projection = estimatePulseValue(sampled)
    expect(projection.estimatedValue).toBeGreaterThan(0)
    expect(projection.estimatedValue).toBeLessThan(projection.estimatedHours * pulseProjectionPolicy.contributionValuePerHour)

    const slower = pulseProjectionPolicy.strata.flatMap((stratum, productIndex) =>
      Array.from({ length: 10 }, (_, index) => sampledResponse(stratum.product, -1, productIndex * 10 + index)),
    )
    expect(estimatePulseValue(slower).estimatedValue).toBe(-1200 * pulseProjectionPolicy.contributionValuePerHour)
  })

  it('keeps validated ROI intact and exposes the Pulse-inclusive ROI separately', () => {
    const portfolio = calculatePortfolio(defaultAssumptions)
    const projection = estimatePulseValue(sampled)
    const combined = combinePulseWithPortfolio(portfolio.adjustedValue, portfolio.totalCost, projection)
    expect(portfolio.roi).toBeCloseTo((portfolio.adjustedValue - portfolio.totalCost) / portfolio.totalCost, 5)
    expect(combined.roi).toBeGreaterThan(portfolio.roi)
    expect(combined.benefitCostRatio).toBeCloseTo(combined.value / portfolio.totalCost, 5)
    expect(combined.roiInterval.low).toBeLessThan(combined.roi)
    expect(combined.roiInterval.high).toBeGreaterThan(combined.roi)
    expect(combined.benefitCostRatioInterval.low).toBeLessThan(combined.benefitCostRatio)
    expect(combined.benefitCostRatioInterval.high).toBeGreaterThan(combined.benefitCostRatio)
  })
})

describe('formatting helpers', () => {
  it('formats money, short money, and standard ROI percentages', () => {
    expect(formatCurrency(28460)).toBe('$28,460')
    expect(formatCurrency(-1200)).toBe('−$1,200')
    expect(formatShort(84000)).toBe('$84.0k')
    expect(formatPercent(0.625)).toBe('63%')
  })
})
import { isFinanciallyApproved } from './finance'
import type { PulseProjection } from './pulse'
import { changeCostTotal, productSpend } from './usage'
import {
  evidenceGrades,
  pillarLabels,
  type ChangeCosts,
  type EvidenceGrade,
  type PeriodKey,
  type PillarLabel,
  type Policy,
  type UsageRecord,
  type ValueClaim,
  type ValueStage,
} from './types'

export const pillarMetadata: Record<PillarLabel, { color: string; description: string }> = {
  'Improved Performance': { color: '#087f6b', description: 'Measured throughput and delivery outcomes' },
  'Cost Savings': { color: '#de7b22', description: 'Reconciled avoided or reduced spend' },
  'Innovation / Transformation': { color: '#2f6fce', description: 'New capabilities, valued only after adoption' },
  'Risk Mitigation': { color: '#8391a7', description: 'Expected-loss reduction with stable controls' },
}

const validatedStages = new Set<ValueStage>(['Validated', 'Realized'])

export function isValidatedStage(stage: ValueStage) {
  return validatedStages.has(stage)
}

/** Approved claims for the period, keeping only the first claim per benefit scope (overlap key). */
export function eligibleClaims(claims: ValueClaim[], period: PeriodKey) {
  const seen = new Set<string>()
  const duplicates: ValueClaim[] = []
  const eligible = claims.filter((claim) => {
    if (claim.period !== period || !validatedStages.has(claim.stage) || claim.grossValue <= 0 || !claim.valuationGrade || !isFinanciallyApproved(claim)) return false
    const key = claim.overlapKey.trim().toLowerCase()
    if (seen.has(key)) {
      duplicates.push(claim)
      return false
    }
    seen.add(key)
    return true
  })
  return { eligible, duplicates }
}

export type ValueContribution = ValueClaim & { adjustedValue: number; limitingGrade: EvidenceGrade }

export function calculatePortfolio(input: { period: PeriodKey; claims: ValueClaim[]; usage: UsageRecord[]; changeCosts: Record<PeriodKey, ChangeCosts>; policy: Policy }) {
  const { period, policy } = input
  const { eligible, duplicates } = eligibleClaims(input.claims, period)
  const contributions: ValueContribution[] = eligible.map((claim) => {
    const operationalWeight = policy.evidenceWeights[claim.operationalGrade]
    const valuationWeight = policy.evidenceWeights[claim.valuationGrade!]
    return {
      ...claim,
      limitingGrade: valuationWeight <= operationalWeight ? claim.valuationGrade! : claim.operationalGrade,
      adjustedValue: claim.grossValue * Math.min(operationalWeight, valuationWeight) * policy.confidenceWeights[claim.confidence],
    }
  })
  const rawValue = contributions.reduce((sum, claim) => sum + claim.grossValue, 0)
  const adjustedValue = contributions.reduce((sum, claim) => sum + claim.adjustedValue, 0)
  const productCost = productSpend(input.usage, period)
  const changeCost = changeCostTotal(input.changeCosts[period])
  const totalCost = productCost + changeCost
  const netValue = adjustedValue - totalCost

  const pillars = pillarLabels.map((label) => {
    const matches = contributions.filter((claim) => claim.pillar === label)
    return {
      label,
      ...pillarMetadata[label],
      rawValue: matches.reduce((sum, claim) => sum + claim.grossValue, 0),
      value: matches.reduce((sum, claim) => sum + claim.adjustedValue, 0),
      sourceCount: matches.length,
    }
  })
  const evidenceMix = evidenceGrades.map((grade) => ({
    grade,
    percentage: rawValue === 0 ? 0 : contributions.filter((claim) => claim.limitingGrade === grade).reduce((sum, claim) => sum + claim.grossValue, 0) / rawValue * 100,
  }))

  const periodClaims = input.claims.filter((claim) => claim.period === period)
  const readinessChecks = periodClaims.flatMap((claim) => [
    claim.baseline, claim.comparison, claim.operationalSource, claim.guardrail, claim.valuationFormula, claim.valuationSource,
    isFinanciallyApproved(claim) ? 'approved' : '',
  ])
  const presentChecks = readinessChecks.filter((value) => !!value?.trim()).length

  return {
    period,
    contributions,
    excludedDuplicates: duplicates,
    rawValue,
    adjustedValue,
    validatedValue: adjustedValue,
    productCost,
    changeCost,
    totalCost,
    netValue,
    roi: totalCost === 0 ? 0 : netValue / totalCost,
    benefitCostRatio: totalCost === 0 ? 0 : adjustedValue / totalCost,
    retentionRate: rawValue === 0 ? 0 : adjustedValue / rawValue,
    pillars,
    evidenceMix,
    pipelineValue: periodClaims.filter((claim) => !validatedStages.has(claim.stage)).reduce((sum, claim) => sum + claim.grossValue, 0),
    readiness: {
      claims: periodClaims.length,
      present: presentChecks,
      required: readinessChecks.length,
      percent: readinessChecks.length === 0 ? 0 : presentChecks / readinessChecks.length,
    },
  }
}

export type Portfolio = ReturnType<typeof calculatePortfolio>

export function combinePulseWithPortfolio(adjustedValue: number, totalCost: number, projection: Pick<PulseProjection, 'projectionEligible' | 'estimatedValue' | 'valueInterval'>) {
  const pulseValue = projection.projectionEligible ? projection.estimatedValue : 0
  const pulseLow = projection.projectionEligible ? projection.valueInterval.low : 0
  const pulseHigh = projection.projectionEligible ? projection.valueInterval.high : 0
  const value = adjustedValue + pulseValue
  const roiFor = (candidate: number) => (totalCost === 0 ? 0 : (candidate - totalCost) / totalCost)
  const ratioFor = (candidate: number) => (totalCost === 0 ? 0 : candidate / totalCost)
  return {
    value,
    pulseValue,
    netValue: value - totalCost,
    roi: roiFor(value),
    benefitCostRatio: ratioFor(value),
    roiInterval: { low: roiFor(adjustedValue + pulseLow), high: roiFor(adjustedValue + pulseHigh) },
    benefitCostRatioInterval: { low: ratioFor(adjustedValue + pulseLow), high: ratioFor(adjustedValue + pulseHigh) },
  }
}

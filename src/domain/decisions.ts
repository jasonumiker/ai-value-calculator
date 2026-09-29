import { isFinanciallyApproved } from './finance'
import type { Portfolio } from './portfolio'
import { analyzeStudy, studyStatus } from './studies'
import { teamCosts, type TeamCost } from './usage'
import type { ChangeCosts, DecisionOption, DecisionRecord, Hypothesis, PeriodKey, Policy, StudyRecord, UsageRecord } from './types'

export type TeamEvidence = {
  supported: string[]
  notSupported: string[]
  inconclusive: string[]
  inStudy: string[]
  readyToTest: string[]
  awaitingValuation: string[]
  pendingReviews: string[]
  guardrailBreaches: string[]
}

export function teamEvidence(team: string, period: PeriodKey, hypotheses: Hypothesis[], studies: StudyRecord[]): TeamEvidence {
  const evidence: TeamEvidence = { supported: [], notSupported: [], inconclusive: [], inStudy: [], readyToTest: [], awaitingValuation: [], pendingReviews: [], guardrailBreaches: [] }
  studies.filter((study) => study.team === team && (study.period === period || !study.period)).forEach((study) => {
    const status = studyStatus(study)
    if (status === 'Supported') {
      evidence.supported.push(study.name)
      if (study.financialReview?.status === 'Pending') evidence.pendingReviews.push(study.name)
      else if (!isFinanciallyApproved(study)) evidence.awaitingValuation.push(study.name)
    } else if (status === 'Not supported') {
      evidence.notSupported.push(study.name)
      if (analyzeStudy(study)?.guardrailBreached) evidence.guardrailBreaches.push(study.name)
    } else if (status === 'Inconclusive') {
      evidence.inconclusive.push(study.name)
    } else {
      evidence.inStudy.push(study.name)
    }
  })
  hypotheses.filter((hypothesis) => hypothesis.owner === team && hypothesis.status === 'Approved for testing' && !studies.some((study) => study.hypothesisId === hypothesis.id))
    .forEach((hypothesis) => evidence.readyToTest.push(hypothesis.useCase))
  return evidence
}

/** Rule-based suggestion; executives record the actual decision and their reasoning separately. */
export function suggestDecision(input: { validatedValue: number; benefitCostRatio: number; evidence: TeamEvidence }, policy: Policy): { decision: DecisionOption; reason: string } {
  const { evidence } = input
  if (evidence.guardrailBreaches.length > 0) {
    return { decision: 'Redesign', reason: `Guardrail breached in ${evidence.guardrailBreaches.join(', ')}. Fix the workflow before adding spend.` }
  }
  if (input.validatedValue > 0 && input.benefitCostRatio >= policy.scaleBenefitCostRatio) {
    return { decision: 'Scale', reason: `Validated value covers ${input.benefitCostRatio.toFixed(1)}× the allocated cost (threshold ${policy.scaleBenefitCostRatio}×).` }
  }
  const maturing = evidence.inStudy.length + evidence.readyToTest.length + evidence.awaitingValuation.length + evidence.pendingReviews.length + evidence.inconclusive.length
  if (maturing > 0) {
    const parts = [
      evidence.inStudy.length && `${evidence.inStudy.length} in study`,
      evidence.readyToTest.length && `${evidence.readyToTest.length} ready to test`,
      evidence.awaitingValuation.length && `${evidence.awaitingValuation.length} awaiting valuation`,
      evidence.pendingReviews.length && `${evidence.pendingReviews.length} in financial review`,
      evidence.inconclusive.length && `${evidence.inconclusive.length} inconclusive`,
    ].filter(Boolean)
    return { decision: 'Keep measuring', reason: `Evidence is still maturing: ${parts.join(', ')}.` }
  }
  if (evidence.supported.length > 0) {
    return { decision: 'Redesign', reason: 'The effect is proven but validated value does not yet cover cost. Redesign how the released capacity is used.' }
  }
  if (evidence.notSupported.length > 0) {
    return { decision: 'Stop', reason: `Tested hypotheses were not supported (${evidence.notSupported.join(', ')}) and nothing else is in progress.` }
  }
  return { decision: 'Keep measuring', reason: 'No evidence for this period yet. Nominate and prioritise hypotheses to test.' }
}

export type TeamDecisionRow = TeamCost & {
  validatedValue: number
  benefitCostRatio: number
  roi: number
  evidence: TeamEvidence
  suggestion: { decision: DecisionOption; reason: string }
  recorded?: DecisionRecord
}

export function teamDecisionRows(input: {
  period: PeriodKey
  usage: UsageRecord[]
  changeCosts: Record<PeriodKey, ChangeCosts>
  portfolio: Portfolio
  hypotheses: Hypothesis[]
  studies: StudyRecord[]
  decisions: DecisionRecord[]
  policy: Policy
}): TeamDecisionRow[] {
  return teamCosts(input.usage, input.period, input.changeCosts[input.period]).map((team) => {
    const validatedValue = input.portfolio.contributions.filter((claim) => claim.team === team.team).reduce((sum, claim) => sum + claim.adjustedValue, 0)
    const benefitCostRatio = team.totalCost === 0 ? 0 : validatedValue / team.totalCost
    const evidence = teamEvidence(team.team, input.period, input.hypotheses, input.studies)
    return {
      ...team,
      validatedValue,
      benefitCostRatio,
      roi: team.totalCost === 0 ? 0 : (validatedValue - team.totalCost) / team.totalCost,
      evidence,
      suggestion: suggestDecision({ validatedValue, benefitCostRatio, evidence }, input.policy),
      recorded: input.decisions.filter((decision) => decision.team === team.team && decision.period === input.period).at(-1),
    }
  })
}

export function recordDecision(existing: DecisionRecord[], input: Omit<DecisionRecord, 'id' | 'decidedAt'>, decidedAt = new Date().toISOString(), id = `decision-${Date.now()}`) {
  if (!input.rationale.trim() || !input.decidedBy.trim()) throw new Error('Record who made the decision and the reasoning behind it.')
  return [...existing, { ...input, rationale: input.rationale.trim(), decidedBy: input.decidedBy.trim(), id, decidedAt }]
}

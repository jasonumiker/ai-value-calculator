import { WEEKS_PER_QUARTER } from './periods'
import { studyStatus } from './studies'
import type { Hypothesis, HypothesisStatus, Policy, StudyEffort, StudyRecord, SuccessCriterion, Verdict } from './types'

export const MAX_ACTIVE_NOMINATIONS = 5
export const effortWeights: Record<StudyEffort, number> = { Small: 1, Medium: 2, Large: 4 }

/** "Happens X often with Y improvement": the quarterly value if the hypothesis holds, at the CFO's rates. */
export function sizeHypothesis(hypothesis: Pick<Hypothesis, 'frequencyPerWeek' | 'peopleAffected' | 'expectedMinutesSaved' | 'studyEffort'>, policy: Policy) {
  const hoursPerQuarter = hypothesis.frequencyPerWeek * hypothesis.peopleAffected * WEEKS_PER_QUARTER * hypothesis.expectedMinutesSaved / 60
  const valueIfTrue = hoursPerQuarter * policy.contributionValuePerHour * policy.defaultCapacityRealization
  return { hoursPerQuarter, valueIfTrue, priorityScore: valueIfTrue / effortWeights[hypothesis.studyEffort] }
}

export type HypothesisProgress = 'Awaiting prioritisation' | 'Parked' | 'Ready to test' | 'In study' | Verdict

export function hypothesisProgress(hypothesis: Hypothesis, studies: StudyRecord[]): HypothesisProgress {
  if (hypothesis.status === 'Parked') return 'Parked'
  if (hypothesis.status === 'Nominated') return 'Awaiting prioritisation'
  const study = studies.find((record) => record.hypothesisId === hypothesis.id)
  if (!study) return 'Ready to test'
  const status = studyStatus(study)
  return status === 'In progress' || status === 'Not started' ? 'In study' : status
}

export function rankHypotheses(hypotheses: Hypothesis[], policy: Policy) {
  return hypotheses
    .map((hypothesis) => ({ hypothesis, ...sizeHypothesis(hypothesis, policy) }))
    .sort((first, second) => second.priorityScore - first.priorityScore)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

const openProgress = new Set<HypothesisProgress>(['Awaiting prioritisation', 'Ready to test', 'In study'])

/** Open nominations only: parked ones and those with a verdict free the manager's slot. */
export function activeNominations(hypotheses: Hypothesis[], nominatedBy: string, studies: StudyRecord[] = []) {
  return hypotheses.filter((hypothesis) => hypothesis.nominatedBy === nominatedBy && openProgress.has(hypothesisProgress(hypothesis, studies))).length
}

export type HypothesisInput = Omit<Hypothesis, 'id' | 'status' | 'nominatedAt' | 'prioritisedBy' | 'prioritisedAt'>

export function nominateHypothesis(existing: Hypothesis[], input: HypothesisInput, nominatedAt = new Date().toISOString(), id = Date.now(), studies: StudyRecord[] = []): Hypothesis {
  const text = [input.useCase, input.owner, input.nominatedBy, input.product, input.expectedEffect, input.outcome, input.evidence, input.guardrail,
    input.successCriterion.metric, input.successCriterion.guardrailMetric]
  if (!text.every((value) => value?.trim())) throw new Error('Complete the use case, outcome, evidence source, guardrail, and success criterion.')
  if (!(input.frequencyPerWeek > 0) || !(input.peopleAffected >= 1) || !(input.expectedMinutesSaved >= 0)) {
    throw new Error('Size the hypothesis: how often it happens, how many people do it, and the expected minutes saved.')
  }
  const criterion = input.successCriterion
  if (!(criterion.minimumImprovementPct > 0) || !(criterion.guardrailMaxWorseningPct >= 0) || !(criterion.minimumSamplePerArm >= 2)) {
    throw new Error('Set a positive success threshold, a guardrail limit, and at least 2 observations per arm.')
  }
  if (activeNominations(existing, input.nominatedBy, studies) >= MAX_ACTIVE_NOMINATIONS) {
    throw new Error(`${input.nominatedBy} already has ${MAX_ACTIVE_NOMINATIONS} open nominations. Park one, or finish a study, before nominating another.`)
  }
  return { ...input, useCase: input.useCase.trim(), id, status: 'Nominated', nominatedAt }
}

export function prioritiseHypothesis(hypothesis: Hypothesis, status: Exclude<HypothesisStatus, 'Nominated'>, actor: string, at = new Date().toISOString()): Hypothesis {
  if (!actor.trim()) throw new Error('Record who made the prioritisation decision.')
  return { ...hypothesis, status, prioritisedBy: actor.trim(), prioritisedAt: at }
}

export function portfolioHitRate(hypotheses: Hypothesis[], studies: StudyRecord[]) {
  const progress = hypotheses.map((hypothesis) => hypothesisProgress(hypothesis, studies))
  const count = (value: HypothesisProgress) => progress.filter((entry) => entry === value).length
  const supported = count('Supported')
  const notSupported = count('Not supported')
  const inconclusive = count('Inconclusive')
  const tested = supported + notSupported + inconclusive
  return {
    supported,
    notSupported,
    inconclusive,
    tested,
    inStudy: count('In study'),
    readyToTest: count('Ready to test'),
    awaiting: count('Awaiting prioritisation'),
    parked: count('Parked'),
    hitRate: tested === 0 ? 0 : supported / tested,
  }
}

export function criterionSummary({ successCriterion: criterion }: { successCriterion: SuccessCriterion }) {
  return `${criterion.metric} at least ${criterion.minimumImprovementPct}% ${criterion.direction === 'decrease' ? 'lower' : 'higher'} · ${criterion.guardrailMetric} no more than ${criterion.guardrailMaxWorseningPct}% worse · ≥${criterion.minimumSamplePerArm} per group`
}

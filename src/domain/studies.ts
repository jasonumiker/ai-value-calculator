import { normalizePeriod } from './periods'
import { designCap, designDescriptions } from './policy'
import { welchDifference } from './stats'
import type { ArmSummary, Hypothesis, MetricUnit, PeriodKey, Policy, StudyDesign, StudyRecord, SuccessCriterion, ValueStage, Verdict } from './types'

export const defaultCriterion: SuccessCriterion = {
  metric: 'Outcome metric',
  unit: 'other',
  direction: 'decrease',
  minimumImprovementPct: 10,
  guardrailMetric: 'Guardrail',
  guardrailMaxWorseningPct: 5,
  minimumSamplePerArm: 10,
}

const validArm = (arm?: ArmSummary): arm is ArmSummary => !!arm && Number.isInteger(arm.n) && arm.n >= 2 && Number.isFinite(arm.mean) && Number.isFinite(arm.sd) && arm.sd > 0

export type StudyAnalysis = {
  improvement: number
  low: number
  high: number
  difference: number
  verdict: Verdict | 'In progress'
  reasons: string[]
  guardrailBreached: boolean
}

/** Compares the AI arm with the comparison arm and judges it against the criterion registered before the study. */
export function analyzeStudy(study: Pick<StudyRecord, 'control' | 'treatment' | 'successCriterion' | 'guardrailChangePct' | 'progress'>): StudyAnalysis | null {
  const { control, treatment } = study
  if (!validArm(control) || !validArm(treatment) || !(control!.mean > 0)) return null
  const criterion = study.successCriterion ?? defaultCriterion
  const interval = welchDifference(control!, treatment!)
  const sign = criterion.direction === 'decrease' ? -1 : 1
  const improvement = sign * interval.difference / control!.mean
  const [low, high] = [sign * interval.low / control!.mean, sign * interval.high / control!.mean].sort((first, second) => first - second)
  const threshold = criterion.minimumImprovementPct / 100
  const guardrailBreached = (study.guardrailChangePct ?? 0) > criterion.guardrailMaxWorseningPct
  const reasons: string[] = []
  let verdict: StudyAnalysis['verdict']
  if (study.progress < 100) {
    verdict = 'In progress'
    reasons.push('Interim numbers only; the verdict is set when the study completes.')
  } else if (Math.min(control!.n, treatment!.n) < criterion.minimumSamplePerArm) {
    verdict = 'Inconclusive'
    reasons.push(`Below the pre-registered minimum of ${criterion.minimumSamplePerArm} per arm.`)
  } else if (guardrailBreached) {
    verdict = 'Not supported'
    reasons.push(`Guardrail breached: ${criterion.guardrailMetric} worsened ${study.guardrailChangePct}% against a ${criterion.guardrailMaxWorseningPct}% limit.`)
  } else if (low > 0 && improvement >= threshold) {
    verdict = 'Supported'
    reasons.push(`The whole 95% interval shows improvement and the estimate meets the ${criterion.minimumImprovementPct}% threshold.`)
  } else if (high < threshold) {
    verdict = 'Not supported'
    reasons.push(`The 95% interval rules out the ${criterion.minimumImprovementPct}% improvement that was registered.`)
  } else {
    verdict = 'Inconclusive'
    reasons.push(`The interval is too wide to confirm or rule out a ${criterion.minimumImprovementPct}% improvement.`)
  }
  return { improvement, low, high, difference: interval.difference, verdict, reasons, guardrailBreached }
}

export type StudyStatus = Verdict | 'In progress' | 'Not started'

export function studyStatus(study: StudyRecord): StudyStatus {
  const analysis = analyzeStudy(study)
  if (analysis) return analysis.verdict
  if (study.progress === 100) return 'Inconclusive'
  return study.progress === 0 ? 'Not started' : 'In progress'
}

/** Stage before any financial approval: a supported effect is capacity; everything else is still a signal. */
export function baseStage(study: StudyRecord): ValueStage {
  return studyStatus(study) === 'Supported' ? 'Capacity' : 'Signal'
}

const unitSuffix: Record<MetricUnit, string> = { 'minutes per task': 'min', 'hours per task': 'h', days: 'days', percent: '%', count: '', other: '' }

export function formatMeasure(value: number, unit: MetricUnit = 'other') {
  const rounded = Math.round(value * 10) / 10
  return `${rounded.toLocaleString('en-US')}${unit === 'percent' ? '%' : unitSuffix[unit] ? ` ${unitSuffix[unit]}` : ''}`
}

const signedPercent = (value: number) => {
  const rounded = Math.round(value * 100)
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)}%`
}

export function describeResult(analysis: StudyAnalysis) {
  const size = Math.round(Math.abs(analysis.improvement) * 100)
  return `${size}% ${analysis.improvement >= 0 ? 'better' : 'worse'} than comparison (95% CI ${signedPercent(analysis.low)} to ${signedPercent(analysis.high)})`
}

export function createStudyFromHypothesis(hypothesis: Hypothesis, preRegisteredAt = new Date().toISOString(), period: PeriodKey = ''): StudyRecord {
  return {
    id: `hypothesis-${hypothesis.id}`,
    hypothesisId: hypothesis.id,
    name: hypothesis.useCase,
    team: hypothesis.owner,
    product: hypothesis.product,
    workType: hypothesis.workType,
    expectedEffect: hypothesis.expectedEffect,
    outcome: hypothesis.outcome,
    metric: hypothesis.successCriterion.metric,
    metricUnit: hypothesis.successCriterion.unit,
    operationalSource: hypothesis.evidence,
    guardrail: hypothesis.guardrail,
    successCriterion: { ...hypothesis.successCriterion },
    preRegisteredAt,
    design: 'Randomised',
    pillar: 'Improved Performance',
    stage: 'Signal',
    grossValue: 0,
    confidence: 'Low',
    operationalGrade: 'Anecdotal',
    cohort: '',
    period,
    result: 'Not measured yet',
    progress: 0,
    overlapKey: `hypothesis-${hypothesis.id}|unvalidated`,
    pulseScope: { team: hypothesis.owner, product: hypothesis.product, workTypes: hypothesis.workType ? [hypothesis.workType] : [] },
  }
}

export type StudyEvidenceInput = {
  cohort: string
  period: string
  design: StudyDesign
  operationalSource: string
  control?: ArmSummary
  treatment?: ArmSummary
  guardrailChangePct?: number
  progress: number
}


/** Records measured evidence; the outcome grade comes from the policy's cap for the study design, not the owner. */
export function recordStudyEvidence(study: StudyRecord, input: StudyEvidenceInput, policy: Policy): StudyRecord {
  if (study.financialReview?.status === 'Pending' || study.financialReview?.status === 'Approved') {
    throw new Error('Evidence is locked while a valuation is under review or approved.')
  }
  if (!input.cohort.trim() || !input.operationalSource.trim()) throw new Error('Enter the cohort and the operational evidence source.')
  const period = normalizePeriod(input.period)
  if (!period) throw new Error('Enter the study period as a quarter, for example 2026-Q3.')
  if (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100) throw new Error('Progress must be a whole number from 0 to 100.')
  const hasArms = !!input.control || !!input.treatment
  if (hasArms && !(validArm(input.control) && validArm(input.treatment))) {
    throw new Error('Each group needs at least 2 observations, a mean, and a standard deviation above 0.')
  }
  if (input.control && !(input.control.mean > 0)) throw new Error('The comparison mean must be positive so the change can be expressed as a percentage.')
  if (input.progress === 100 && (!hasArms || input.guardrailChangePct === undefined || !Number.isFinite(input.guardrailChangePct))) {
    throw new Error('A completed study needs both arms and the guardrail result, including null or negative results.')
  }
  const unit = study.metricUnit ?? study.successCriterion?.unit ?? 'other'
  const updated: StudyRecord = {
    ...study,
    cohort: input.cohort.trim(),
    period,
    design: input.design,
    operationalSource: input.operationalSource.trim(),
    control: input.control,
    treatment: input.treatment,
    guardrailChangePct: input.guardrailChangePct,
    progress: input.progress,
    operationalGrade: designCap(policy, input.design).grade,
    baseline: input.control ? formatMeasure(input.control.mean, unit) : undefined,
    current: input.treatment ? formatMeasure(input.treatment.mean, unit) : undefined,
    comparison: input.control && input.treatment
      ? `${input.design}: ${input.treatment.n} with AI vs ${input.control.n} without`
      : designDescriptions[input.design],
  }
  const analysis = analyzeStudy(updated)
  return { ...updated, result: analysis ? describeResult(analysis) : 'Not measured yet', stage: baseStage(updated) }
}

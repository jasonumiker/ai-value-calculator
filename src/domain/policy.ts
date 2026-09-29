import {
  confidenceLevels,
  evidenceGrades,
  reuseCategories,
  studyDesigns,
  type Confidence,
  type DesignCap,
  type Policy,
  type PolicyChange,
  type StudyDesign,
} from './types'

export const defaultPolicy: Policy = {
  version: 1,
  evidenceWeights: { Observed: 1, Estimated: 0.75, Modelled: 0.7, Anecdotal: 0 },
  confidenceWeights: { High: 1, Medium: 0.85, Low: 0.5 },
  designCaps: {
    Randomised: { grade: 'Observed', confidence: 'High' },
    'Matched groups': { grade: 'Observed', confidence: 'Medium' },
    'Staggered rollout': { grade: 'Estimated', confidence: 'Medium' },
    'Before/after': { grade: 'Estimated', confidence: 'Low' },
    Anecdotal: { grade: 'Anecdotal', confidence: 'Low' },
  },
  contributionValuePerHour: 50,
  defaultSelfReportCalibration: 0.75,
  useStudyCalibration: true,
  defaultCapacityRealization: 0.6,
  useSurveyReuse: true,
  reuseWeights: {
    'More of the same work': 1,
    'Other priority work': 1,
    'Learning or improvement': 0.5,
    'Finished earlier or nothing specific': 0,
  },
  minimumReuseAnswers: 20,
  lossTreatment: 'Full rate',
  minimumResponsesPerStratum: 8,
  minimumResponseRate: 0.4,
  designEffect: 1.25,
  cadenceDays: 14,
  maxInvitationsPerPersonPerQuarter: 3,
  invitationsPerWeek: 24,
  scaleBenefitCostRatio: 1,
  minimumReportingGroup: 5,
}

export const designDescriptions: Record<StudyDesign, string> = {
  Randomised: 'Tasks or people randomly assigned to the AI way or the usual way',
  'Matched groups': 'Comparable teams or work items, with and without AI',
  'Staggered rollout': 'Groups adopt at different times; later adopters are the comparison',
  'Before/after': 'The same group measured before and after adoption',
  Anecdotal: 'Interviews or examples without a comparison',
}

export function policyLabel(policy: Pick<Policy, 'version'>) {
  return `policy-v${policy.version}`
}

const confidenceRank: Record<Confidence, number> = { High: 0, Medium: 1, Low: 2 }

export function confidenceWithinCap(requested: Confidence, cap: Confidence) {
  return confidenceRank[requested] >= confidenceRank[cap]
}

export function designCap(policy: Policy, design: StudyDesign): DesignCap {
  return policy.designCaps[design] ?? { grade: 'Anecdotal', confidence: 'Low' }
}

/** How many hours a tool must save for each hour it loses before the Pulse model shows net value. */
export function breakEvenRatio(calibration: number, reuseRate: number, lossTreatment: Policy['lossTreatment']) {
  if (lossTreatment === 'Same discounts') return 1
  const retained = calibration * reuseRate
  return retained <= 0 ? Number.POSITIVE_INFINITY : 1 / retained
}

export function policyWarnings(policy: Policy) {
  const warnings: string[] = []
  const nonIncreasing = (values: number[]) => values.every((value, index) => index === 0 || value <= values[index - 1])
  if (!nonIncreasing(evidenceGrades.map((grade) => policy.evidenceWeights[grade]))) {
    warnings.push('Evidence weights should not increase as evidence weakens (Observed ≥ Estimated ≥ Modelled ≥ Anecdotal).')
  }
  if (!nonIncreasing(confidenceLevels.map((level) => policy.confidenceWeights[level]))) {
    warnings.push('Confidence multipliers should not increase as confidence falls (High ≥ Medium ≥ Low).')
  }
  return warnings
}

export function validatePolicy(policy: Policy) {
  const errors: string[] = []
  const inUnitRange = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1
  if (![...Object.values(policy.evidenceWeights), ...Object.values(policy.confidenceWeights), ...Object.values(policy.reuseWeights)].every(inUnitRange)) {
    errors.push('Weights and multipliers must be between 0% and 100%.')
  }
  if (!inUnitRange(policy.defaultSelfReportCalibration) || !inUnitRange(policy.defaultCapacityRealization) || !inUnitRange(policy.minimumResponseRate)) {
    errors.push('Calibration, reuse, and response-rate settings must be between 0% and 100%.')
  }
  if (!(policy.contributionValuePerHour > 0)) errors.push('The contribution value per hour must be positive.')
  if (!(policy.minimumResponsesPerStratum >= 2)) errors.push('At least two responses per stratum are needed to estimate variance.')
  if (!(policy.minimumReportingGroup >= 3)) errors.push('Aggregate reporting groups must contain at least three responses.')
  if (!(policy.invitationsPerWeek >= 1) || !(policy.maxInvitationsPerPersonPerQuarter >= 1) || !(policy.cadenceDays >= 0)) {
    errors.push('Sampling needs at least one invitation per week and per person, and a non-negative cadence.')
  }
  if (!(policy.designEffect >= 1)) errors.push('The design effect cannot be below 1.')
  if (!(policy.scaleBenefitCostRatio > 0)) errors.push('The scale threshold must be positive.')
  return errors
}

const percent = (value: number) => `${Math.round(value * 100)}%`
const onOff = (value: boolean) => (value ? 'on' : 'off')

const scalarFields: [keyof Policy, string, (value: never) => string][] = [
  ['contributionValuePerHour', 'Contribution value per hour', (value: number) => `$${value}`],
  ['defaultSelfReportCalibration', 'Default self-report calibration', percent],
  ['useStudyCalibration', 'Calibrate self-reports with studies', onOff],
  ['defaultCapacityRealization', 'Default share of saved time reused', percent],
  ['useSurveyReuse', 'Use surveyed time reuse', onOff],
  ['minimumReuseAnswers', 'Minimum reuse answers', String],
  ['lossTreatment', 'Slower-task treatment', String],
  ['minimumResponsesPerStratum', 'Minimum responses per stratum', String],
  ['minimumResponseRate', 'Minimum response rate', percent],
  ['designEffect', 'Design effect', (value: number) => `${value}×`],
  ['cadenceDays', 'Days between invitations per person', String],
  ['maxInvitationsPerPersonPerQuarter', 'Maximum invitations per person per quarter', String],
  ['invitationsPerWeek', 'Invitations per week', String],
  ['scaleBenefitCostRatio', 'Scale threshold (benefit ÷ cost)', (value: number) => `${value}×`],
  ['minimumReportingGroup', 'Minimum reporting group', String],
]

export function describePolicyChanges(before: Policy, after: Policy) {
  const changes: string[] = []
  evidenceGrades.forEach((grade) => {
    if (before.evidenceWeights[grade] !== after.evidenceWeights[grade]) {
      changes.push(`Evidence weight · ${grade}: ${percent(before.evidenceWeights[grade])} → ${percent(after.evidenceWeights[grade])}`)
    }
  })
  confidenceLevels.forEach((level) => {
    if (before.confidenceWeights[level] !== after.confidenceWeights[level]) {
      changes.push(`Confidence multiplier · ${level}: ${percent(before.confidenceWeights[level])} → ${percent(after.confidenceWeights[level])}`)
    }
  })
  studyDesigns.forEach((design) => {
    const previous = before.designCaps[design]
    const next = after.designCaps[design]
    if (previous.grade !== next.grade || previous.confidence !== next.confidence) {
      changes.push(`Design cap · ${design}: ${previous.grade}/${previous.confidence} → ${next.grade}/${next.confidence}`)
    }
  })
  reuseCategories.forEach((category) => {
    if (before.reuseWeights[category] !== after.reuseWeights[category]) {
      changes.push(`Reuse weight · ${category}: ${percent(before.reuseWeights[category])} → ${percent(after.reuseWeights[category])}`)
    }
  })
  scalarFields.forEach(([key, label, format]) => {
    if (before[key] !== after[key]) changes.push(`${label}: ${format(before[key] as never)} → ${format(after[key] as never)}`)
  })
  return changes
}

export function publishPolicy(current: Policy, draft: Policy, actor: string, reason: string, changedAt = new Date().toISOString()): { policy: Policy; change: PolicyChange } {
  const errors = validatePolicy(draft)
  if (errors.length > 0) throw new Error(errors[0])
  const changes = describePolicyChanges(current, draft)
  if (changes.length === 0) throw new Error('There are no policy changes to publish.')
  if (!actor.trim() || !reason.trim()) throw new Error('Record who is publishing this version and why.')
  const version = current.version + 1
  return { policy: { ...draft, version }, change: { version, changedAt, changedBy: actor.trim(), reason: reason.trim(), changes } }
}

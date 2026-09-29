import { monthLabel, periodLabel } from './periods'
import { inScope, sessionMonths, uncoveredMonths } from './sampling'
import { mean, stratumTotalVariance, tCritical95 } from './stats'
import { studyStatus } from './studies'
import {
  reuseCategories,
  type ExclusionScope,
  type Invitation,
  type PeriodKey,
  type Policy,
  type Product,
  type ResponseRecord,
  type ReuseCategory,
  type SamplingFrame,
  type StudyRecord,
  type TaskSession,
  type UsageRecord,
} from './types'
import { spendByProduct } from './usage'

export const pulseEffectOptions = [
  'No material change',
  'Faster delivery',
  'Higher-quality output',
  'Broader scope',
  'Better-informed decisions',
  'Stronger control coverage',
  'More rework or lower quality',
] as const

export const stratumKey = (product: Product, workType: string) => `${product}|${workType}`

export function isRandomResponse(response: ResponseRecord) {
  return response.source === 'Random invitation' && !!response.frameId && !!response.invitationId
}

export type ReuseSummary = {
  rate: number
  source: 'Survey' | 'Policy default'
  answers: number
  distribution: { category: ReuseCategory | 'Not answered'; count: number }[]
}

/** Share of reported saved time that went to productive work, weighted by hours and the CFO's reuse weights. */
export function reuseSummary(responses: ResponseRecord[], policy: Policy): ReuseSummary {
  const faster = responses.filter((response) => response.hours > 0)
  const answered = faster.filter((response) => response.reuse)
  const distribution = [
    ...reuseCategories.map((category) => ({ category, count: answered.filter((response) => response.reuse === category).length })),
    { category: 'Not answered' as const, count: faster.length - answered.length },
  ]
  const hours = answered.reduce((sum, response) => sum + response.hours, 0)
  if (!policy.useSurveyReuse || answered.length < policy.minimumReuseAnswers || hours === 0) {
    return { rate: policy.defaultCapacityRealization, source: 'Policy default', answers: answered.length, distribution }
  }
  const productiveHours = answered.reduce((sum, response) => sum + response.hours * policy.reuseWeights[response.reuse!], 0)
  return { rate: productiveHours / hours, source: 'Survey', answers: answered.length, distribution }
}

export type CalibrationEntry = {
  key: string
  product: Product
  workType: string
  studyId: string
  studyName: string
  studyN: number
  measuredHours: number
  reportedHours: number
  reportedResponses: number
  rawRatio: number
  factor: number
  note?: string
}

/**
 * Where a completed study measured time per task for work the Pulse also samples, compare the measured saving with
 * what people reported. The ratio (bounded 0–100%) replaces the flat self-report discount for that work type.
 */
export function calibrationEntries(studies: StudyRecord[], responses: ResponseRecord[]): CalibrationEntry[] {
  return studies.flatMap((study) => {
    const unit = study.metricUnit ?? study.successCriterion?.unit
    if (study.progress !== 100 || !study.workType || !study.control || !study.treatment || (unit !== 'minutes per task' && unit !== 'hours per task')) return []
    if (studyStatus(study) === 'In progress') return []
    const reported = responses.filter((response) => isRandomResponse(response) && response.product === study.product && response.workType === study.workType)
    const reportedHours = mean(reported.map((response) => response.hours))
    if (reported.length < 5 || reportedHours <= 0) return []
    const measuredHours = (study.control.mean - study.treatment.mean) * (unit === 'minutes per task' ? 1 / 60 : 1)
    const rawRatio = measuredHours / reportedHours
    return [{
      key: stratumKey(study.product, study.workType),
      product: study.product,
      workType: study.workType,
      studyId: study.id,
      studyName: study.name,
      studyN: study.control.n + study.treatment.n,
      measuredHours,
      reportedHours,
      reportedResponses: reported.length,
      rawRatio,
      factor: Math.min(1, Math.max(0, rawRatio)),
      note: rawRatio < 0 ? 'Measured a slowdown where people reported speed-ups' : rawRatio > 1 ? 'Measured more than reported; capped at 100%' : undefined,
    }]
  })
}

export function calibrationForStratum(key: string, entries: CalibrationEntry[], policy: Policy) {
  const matches = policy.useStudyCalibration ? entries.filter((entry) => entry.key === key) : []
  if (matches.length === 0) return { factor: policy.defaultSelfReportCalibration, source: 'Policy default' as const, entries: matches }
  const weight = matches.reduce((sum, entry) => sum + entry.studyN, 0)
  return { factor: matches.reduce((sum, entry) => sum + entry.factor * entry.studyN, 0) / weight, source: 'Study' as const, entries: matches }
}

export function modelledTaskValue(hours: number, calibration: number, reuseRate: number, policy: Policy) {
  if (hours >= 0 || policy.lossTreatment === 'Same discounts') return hours * calibration * reuseRate * policy.contributionValuePerHour
  return hours * policy.contributionValuePerHour
}

export type StratumEstimate = {
  key: string
  product: Product
  workType: string
  population: number
  excluded: number
  invitations: number
  closed: number
  pending: number
  responses: number
  responseRate: number
  meanHours: number
  meanValue: number
  calibration: number
  calibrationSource: 'Study' | 'Policy default'
  estimatedPositiveHours: number
  estimatedNegativeHours: number
  estimatedHours: number
  calibratedHours: number
  reusedHours: number
  estimatedValue: number
  hoursVariance: number
  valueVariance: number
  valuePerSessionLow: number
  valuePerSessionHigh: number
}

export type PulseProjection = ReturnType<typeof estimatePulse>

export function estimatePulse(input: {
  period: PeriodKey
  frames: SamplingFrame[]
  invitations: Invitation[]
  responses: ResponseRecord[]
  sessions: TaskSession[]
  exclusions: ExclusionScope[]
  calibration: CalibrationEntry[]
  policy: Policy
  /** Months in the quarter's bill; defaults to the months that have task sessions. */
  billMonths?: string[]
}) {
  const { period, policy } = input
  const frame = input.frames.find((candidate) => candidate.period === period)
  // Scopes excluded when the frame was drawn are already outside its population. Claims approved later are removed
  // using the per-team counts recorded at draw time, so nothing is subtracted twice or from a changed usage log.
  const unhandled = input.exclusions.filter((exclusion) => !frame?.excludedScopes.some((excluded) => excluded.claimId === exclusion.claimId))
  const claimFor = (team: string, product: Product, workType: string) => unhandled.find(({ scope }) => inScope(scope, team, product, workType))
  const lateCounts = new Map<string, number>()
  frame?.strata.forEach((stratum) => Object.entries(stratum.teamSessions ?? {}).forEach(([team, count]) => {
    const claim = claimFor(team, stratum.product, stratum.workType)
    if (claim) lateCounts.set(claim.claimId, (lateCounts.get(claim.claimId) ?? 0) + count)
  }))
  const lateExclusions = unhandled.filter((exclusion) => lateCounts.has(exclusion.claimId)).map((exclusion) => ({ ...exclusion, sessions: lateCounts.get(exclusion.claimId)! }))
  const excludedSession = (team: string | undefined, product: Product, workType: string) => !!team && !!claimFor(team, product, workType)
  const frameInvitations = frame ? input.invitations.filter((invitation) => invitation.frameId === frame.id && !excludedSession(invitation.team, invitation.product, invitation.workType)) : []
  const frameResponses = frame ? input.responses.filter((response) => response.frameId === frame.id && isRandomResponse(response) && !excludedSession(response.team, response.product, response.workType)) : []
  const reuse = reuseSummary(frameResponses, policy)

  const strata: StratumEstimate[] = (frame?.strata ?? []).map((stratum) => {
    const key = stratumKey(stratum.product, stratum.workType)
    const excluded = Object.entries(stratum.teamSessions ?? {}).reduce((sum, [team, count]) => sum + (claimFor(team, stratum.product, stratum.workType) ? count : 0), 0)
    const population = Math.max(0, stratum.eligibleSessions - excluded)
    const invitations = frameInvitations.filter((invitation) => invitation.product === stratum.product && invitation.workType === stratum.workType)
    const pending = invitations.filter((invitation) => invitation.status === 'Pending').length
    const responses = frameResponses.filter((response) => response.product === stratum.product && response.workType === stratum.workType)
    const calibration = calibrationForStratum(key, input.calibration, policy)
    const hours = responses.map((response) => response.hours)
    const values = hours.map((value) => modelledTaskValue(value, calibration.factor, reuse.rate, policy))
    const estimatedPositiveHours = population * mean(hours.map((value) => Math.max(0, value)))
    const estimatedNegativeHours = population * mean(hours.map((value) => Math.min(0, value)))
    const calibratedNegativeHours = policy.lossTreatment === 'Same discounts'
      ? estimatedNegativeHours * calibration.factor
      : estimatedNegativeHours
    const calibratedHours = estimatedPositiveHours * calibration.factor + calibratedNegativeHours
    const reusedHours = estimatedPositiveHours * calibration.factor * reuse.rate
      + (policy.lossTreatment === 'Same discounts' ? calibratedNegativeHours * reuse.rate : calibratedNegativeHours)
    const meanHours = mean(hours)
    const meanValue = mean(values)
    const valueVariance = stratumTotalVariance(values, population, policy.designEffect)
    const perSessionMargin = population === 0 || responses.length < 2 ? 0 : tCritical95(responses.length - 1) * Math.sqrt(valueVariance) / population
    const closed = invitations.length - pending
    return {
      key,
      product: stratum.product,
      workType: stratum.workType,
      population,
      excluded,
      invitations: invitations.length,
      closed,
      pending,
      responses: responses.length,
      responseRate: closed === 0 ? 0 : responses.length / closed,
      meanHours,
      meanValue,
      calibration: calibration.factor,
      calibrationSource: calibration.source,
      estimatedPositiveHours,
      estimatedNegativeHours,
      estimatedHours: population * meanHours,
      calibratedHours,
      reusedHours,
      estimatedValue: population * meanValue,
      hoursVariance: stratumTotalVariance(hours, population, policy.designEffect),
      valueVariance,
      valuePerSessionLow: meanValue - perSessionMargin,
      valuePerSessionHigh: meanValue + perSessionMargin,
    }
  })

  const reasons: string[] = []
  if (!frame) reasons.push(`No random sample has been drawn for ${periodLabel(period)}`)
  const missingMonths = frame ? uncoveredMonths(frame, input.billMonths ?? sessionMonths(input.sessions)) : []
  const sampleable = sessionMonths(input.sessions)
  const unsampleable = missingMonths.filter((month) => !sampleable.includes(month))
  const extendable = missingMonths.filter((month) => sampleable.includes(month))
  if (extendable.length > 0) reasons.push(`The sample doesn’t cover ${extendable.map(monthLabel).join(', ')} yet; extend it before projecting`)
  if (unsampleable.length > 0) reasons.push(`${unsampleable.map(monthLabel).join(', ')} has cost but no task sessions to sample`)
  const active = strata.filter((stratum) => stratum.population > 0)
  if (frame && active.length === 0) reasons.push('All sampled work is now measured by studies or approved claims')
  active.forEach((stratum) => {
    const label = `${stratum.product} · ${stratum.workType}`
    if (stratum.responses < policy.minimumResponsesPerStratum) reasons.push(`${label} has ${stratum.responses} of ${policy.minimumResponsesPerStratum} required responses`)
    else if (stratum.responseRate < policy.minimumResponseRate) reasons.push(`${label} response rate is below ${Math.round(policy.minimumResponseRate * 100)}%`)
  })
  const projectionEligible = reasons.length === 0 && active.length > 0
  const degreesOfFreedom = Math.max(1, Math.min(...active.map((stratum) => Math.max(1, stratum.responses - 1)), Number.POSITIVE_INFINITY))
  const criticalValue = tCritical95(degreesOfFreedom)
  const estimatedPositiveHours = active.reduce((sum, stratum) => sum + stratum.estimatedPositiveHours, 0)
  const estimatedNegativeHours = active.reduce((sum, stratum) => sum + stratum.estimatedNegativeHours, 0)
  const estimatedHours = active.reduce((sum, stratum) => sum + stratum.estimatedHours, 0)
  const calibratedHours = active.reduce((sum, stratum) => sum + stratum.calibratedHours, 0)
  const reusedHours = active.reduce((sum, stratum) => sum + stratum.reusedHours, 0)
  const estimatedValue = active.reduce((sum, stratum) => sum + stratum.estimatedValue, 0)
  const hoursMargin = criticalValue * Math.sqrt(active.reduce((sum, stratum) => sum + stratum.hoursVariance, 0))
  const valueMargin = criticalValue * Math.sqrt(active.reduce((sum, stratum) => sum + stratum.valueVariance, 0))
  const populationTaskEvents = active.reduce((sum, stratum) => sum + stratum.population, 0)
  const closedInvitations = strata.reduce((sum, stratum) => sum + stratum.closed, 0)
  const calibratedPopulation = active.filter((stratum) => stratum.calibrationSource === 'Study').reduce((sum, stratum) => sum + stratum.population, 0)

  return {
    period,
    frame,
    projectionEligible,
    reasons,
    projectionReason: projectionEligible
      ? 'Random sample, response thresholds met, and claim-covered sessions removed from the population.'
      : reasons.slice(0, 2).join('; ') + (reasons.length > 2 ? `; and ${reasons.length - 2} more` : ''),
    invitations: frameInvitations.length,
    closedInvitations,
    pendingInvitations: strata.reduce((sum, stratum) => sum + stratum.pending, 0),
    sampledResponseCount: frameResponses.length,
    responseRate: closedInvitations === 0 ? 0 : frameResponses.length / closedInvitations,
    populationTaskEvents,
    excludedTaskEvents: strata.reduce((sum, stratum) => sum + stratum.excluded, 0) + (frame?.excludedScopes.reduce((sum, scope) => sum + scope.sessions, 0) ?? 0),
    frameExclusions: frame?.excludedScopes ?? [],
    lateExclusions,
    estimatedPositiveHours,
    estimatedNegativeHours,
    estimatedHours,
    calibratedHours,
    reusedHours,
    hoursInterval: { low: estimatedHours - hoursMargin, high: estimatedHours + hoursMargin },
    estimatedValue,
    valueInterval: { low: estimatedValue - valueMargin, high: estimatedValue + valueMargin },
    strata,
    reuse,
    calibratedShare: populationTaskEvents === 0 ? 0 : calibratedPopulation / populationTaskEvents,
    criticalValue,
  }
}

export type UnitEconomicsStatus = 'Worth it' | 'Not worth it' | 'Uncertain' | 'Not estimable'

export type UnitEconomicsRow = {
  key: string
  product: Product
  workType: string
  sessions: number
  population: number
  cost: number
  costPerSession: number
  valuePerSession: number
  valueLow: number
  valueHigh: number
  ratio: number
  responses: number
  status: UnitEconomicsStatus
}

/** Cost per task session (consumption share of the bill) against the modelled value of a sampled session. */
export function unitEconomics(projection: PulseProjection, sessions: TaskSession[], usage: UsageRecord[], policy: Policy): UnitEconomicsRow[] {
  const spend = new Map(spendByProduct(usage, projection.period).map((entry) => [entry.product, entry.cost]))
  const creditsByProduct = new Map<Product, number>()
  const byStratum = new Map<string, { sessions: number; credits: number }>()
  sessions.forEach((session) => {
    creditsByProduct.set(session.product, (creditsByProduct.get(session.product) ?? 0) + session.credits)
    const key = stratumKey(session.product, session.workType)
    const entry = byStratum.get(key) ?? { sessions: 0, credits: 0 }
    entry.sessions += 1
    entry.credits += session.credits
    byStratum.set(key, entry)
  })
  return projection.strata.map((stratum) => {
    const usageEntry = byStratum.get(stratum.key) ?? { sessions: 0, credits: 0 }
    const productCredits = creditsByProduct.get(stratum.product) ?? 0
    const cost = productCredits === 0 ? 0 : (spend.get(stratum.product) ?? 0) * usageEntry.credits / productCredits
    const costPerSession = usageEntry.sessions === 0 ? 0 : cost / usageEntry.sessions
    const estimable = stratum.population > 0 && stratum.responses >= policy.minimumResponsesPerStratum
    const status: UnitEconomicsStatus = !estimable ? 'Not estimable'
      : stratum.valuePerSessionLow > costPerSession ? 'Worth it'
        : stratum.valuePerSessionHigh < costPerSession ? 'Not worth it' : 'Uncertain'
    return {
      key: stratum.key,
      product: stratum.product,
      workType: stratum.workType,
      sessions: usageEntry.sessions,
      population: stratum.population,
      cost,
      costPerSession,
      valuePerSession: stratum.meanValue,
      valueLow: stratum.valuePerSessionLow,
      valueHigh: stratum.valuePerSessionHigh,
      ratio: costPerSession === 0 ? 0 : stratum.meanValue / costPerSession,
      responses: stratum.responses,
      status,
    }
  })
}

export function productEconomics(rows: UnitEconomicsRow[], projection: PulseProjection) {
  const products = [...new Set(rows.map((row) => row.product))]
  return products.map((product) => {
    const productRows = rows.filter((row) => row.product === product)
    const strata = projection.strata.filter((stratum) => stratum.product === product)
    const sessions = productRows.reduce((sum, row) => sum + row.sessions, 0)
    const cost = productRows.reduce((sum, row) => sum + row.cost, 0)
    const population = strata.reduce((sum, stratum) => sum + stratum.population, 0)
    const value = strata.reduce((sum, stratum) => sum + stratum.estimatedValue, 0)
    const costPerSession = sessions === 0 ? 0 : cost / sessions
    const valuePerSession = population === 0 ? 0 : value / population
    return { product, sessions, cost, costPerSession, valuePerSession, ratio: costPerSession === 0 ? 0 : valuePerSession / costPerSession }
  })
}

export type SignalRow = {
  key: string
  product: Product
  workType: string
  responses: number
  suppressed: boolean
  meanHours: number
  fasterShare: number
  slowerShare: number
  topEffect: string
}

/** Aggregate Pulse signals by product and work type; groups below the reporting threshold are suppressed. */
export function signalRows(responses: ResponseRecord[], minimumGroup: number): SignalRow[] {
  const groups = new Map<string, ResponseRecord[]>()
  responses.forEach((response) => {
    const key = stratumKey(response.product, response.workType)
    const group = groups.get(key)
    if (group) group.push(response)
    else groups.set(key, [response])
  })
  return [...groups.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([key, group]) => {
    const effects = new Map<string, number>()
    group.forEach((response) => effects.set(response.effect, (effects.get(response.effect) ?? 0) + 1))
    const suppressed = group.length < minimumGroup
    return {
      key,
      product: group[0].product,
      workType: group[0].workType,
      responses: group.length,
      suppressed,
      meanHours: suppressed ? 0 : mean(group.map((response) => response.hours)),
      fasterShare: suppressed ? 0 : group.filter((response) => response.hours > 0).length / group.length,
      slowerShare: suppressed ? 0 : group.filter((response) => response.hours < 0).length / group.length,
      topEffect: suppressed ? '' : [...effects.entries()].sort((first, second) => second[1] - first[1])[0][0],
    }
  })
}

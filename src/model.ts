import { BookOpenCheck, Code2, TrendingUp, type LucideIcon } from 'lucide-react'

export type Product = 'GitHub Copilot' | 'Copilot Cowork'
export type EvidenceGrade = 'Observed' | 'Estimated' | 'Modelled' | 'Anecdotal'
export type Confidence = 'High' | 'Medium' | 'Low'
export type PillarLabel = 'Improved Performance' | 'Cost Savings' | 'Innovation / Transformation' | 'Risk Mitigation'
export type ValueStage = 'Signal' | 'Capacity' | 'Validated' | 'Realized'

export type ResponseRecord = {
  id: number
  product: Product
  team?: string
  workType: string
  timeImpact: string
  effect: string
  date: string
  sampleFrameId?: string
}

export type PulseProjectionStratum = {
  product: Product
  eligibleTaskEvents: number
  invitations: number
}

export type PulseProjectionPolicy = {
  id: string
  period: string
  method: string
  samplingUnit: string
  confidenceLevel: 0.95
  minimumResponsesPerStratum: number
  minimumResponseRate: number
  designEffect: number
  selfReportCalibration: number
  capacityRealizationRate: number
  contributionValuePerHour: number
  randomSelection: boolean
  registeredClaimScopesExcludedUpstream: boolean
  strata: PulseProjectionStratum[]
}

export const pulseTimeOptions = [
  '30–60 minutes slower',
  '15–30 minutes slower',
  'No meaningful difference',
  '<15 minutes faster',
  '15–30 minutes faster',
  '30–60 minutes faster',
  '1–4 hours faster',
] as const

export const pulseEffectOptions = [
  'No material change',
  'Faster delivery',
  'Higher-quality output',
  'Broader scope',
  'Better-informed decisions',
  'Stronger control coverage',
  'More rework or lower quality',
] as const

export const timeImpactHours: Record<string, { low: number; mid: number }> = {
  '30–60 minutes slower': { low: -1, mid: -0.75 },
  '15–30 minutes slower': { low: -0.5, mid: -0.375 },
  'No meaningful difference': { low: 0, mid: 0 },
  '<15 minutes faster': { low: 0.1, mid: 0.2 },
  '15–30 minutes faster': { low: 0.25, mid: 0.375 },
  '30–60 minutes faster': { low: 0.5, mid: 0.75 },
  '1–4 hours faster': { low: 1, mid: 2.5 },
}

export const pulseProjectionPolicy: PulseProjectionPolicy = {
  id: 'q3-2026-random-task-pulse',
  period: 'Q3 2026',
  method: 'Stratified random task-event sample',
  samplingUnit: 'Deduplicated credit-consuming task session from a cadence-capped invitation frame',
  confidenceLevel: 0.95,
  minimumResponsesPerStratum: 10,
  minimumResponseRate: 0.5,
  designEffect: 1.25,
  selfReportCalibration: 0.75,
  capacityRealizationRate: 0.6,
  contributionValuePerHour: 50,
  randomSelection: true,
  registeredClaimScopesExcludedUpstream: true,
  strata: [
    { product: 'GitHub Copilot', eligibleTaskEvents: 600, invitations: 16 },
    { product: 'Copilot Cowork', eligibleTaskEvents: 600, invitations: 16 },
  ],
}

export function resolveTimeImpactHours(timeImpact: string | number) {
  const exactHours = typeof timeImpact === 'number' ? timeImpact : Number(timeImpact)
  return Number.isFinite(exactHours)
    ? { low: exactHours, mid: exactHours }
    : timeImpactHours[String(timeImpact)] ?? { low: 0, mid: 0 }
}

export type ValueClaim = {
  id: string
  name: string
  team: string
  product: Product
  pillar: PillarLabel
  stage: ValueStage
  grossValue: number
  confidence: Confidence
  operationalGrade: EvidenceGrade
  valuationGrade?: EvidenceGrade
  cohort: string
  period: string
  baseline?: string
  comparison?: string
  operationalSource: string
  valuationFormula?: string
  valuationSource?: string
  guardrail: string
  overlapKey: string
  approvedBy?: string
}

export type Study = ValueClaim & {
  metric: string
  result: string
  progress: number
  icon: LucideIcon
  current?: string
  capacityHours?: number
}

export const studies: Study[] = [
  {
    id: 'developer-delivery',
    name: 'Developer delivery cycle',
    team: 'Digital Channels',
    product: 'GitHub Copilot',
    pillar: 'Improved Performance',
    stage: 'Validated',
    grossValue: 84000,
    confidence: 'High',
    operationalGrade: 'Observed',
    valuationGrade: 'Modelled',
    cohort: '84 engineers · matched teams',
    period: 'Q2 2026',
    metric: 'Median pull request cycle time',
    result: '18% faster',
    baseline: '5.2 days',
    current: '4.3 days',
    comparison: 'Matched teams and prior-quarter baseline',
    operationalSource: 'Pull request and deployment timestamps',
    valuationFormula: '1,680 backlog hours used × $50 approved contribution per hour',
    valuationSource: 'Finance backlog valuation policy v1',
    guardrail: 'Escaped defects did not increase',
    overlapKey: 'digital-channels|delivery|2026-q2',
    approvedBy: 'Finance review · demo',
    progress: 100,
    icon: Code2,
  },
  {
    id: 'knowledge-preparation',
    name: 'Knowledge work preparation',
    team: 'Customer Operations',
    product: 'Copilot Cowork',
    pillar: 'Cost Savings',
    stage: 'Capacity',
    grossValue: 0,
    confidence: 'Medium',
    operationalGrade: 'Estimated',
    cohort: '126 participants · pre/post',
    period: 'Q3 2026',
    metric: 'Preparation time per case',
    result: '31 min faster',
    operationalSource: 'Case sampling and participant pulse',
    guardrail: 'Case quality review remains stable',
    overlapKey: 'customer-operations|case-prep|2026-q3',
    progress: 72,
    capacityHours: 282,
    icon: BookOpenCheck,
  },
  {
    id: 'sales-proposal',
    name: 'Sales proposal response',
    team: 'Enterprise Sales',
    product: 'Copilot Cowork',
    pillar: 'Improved Performance',
    stage: 'Signal',
    grossValue: 44100,
    confidence: 'Medium',
    operationalGrade: 'Observed',
    valuationGrade: 'Modelled',
    cohort: '42 opportunities · staggered rollout',
    period: 'Q3 2026',
    metric: 'Time to first proposal',
    result: '2.1 days earlier',
    baseline: '6.4 days',
    current: '4.3 days',
    comparison: 'Staggered-rollout comparison cohort',
    operationalSource: 'CRM proposal timestamps',
    valuationFormula: '42 opportunities × 2.1 days × $500 potential margin per day',
    valuationSource: 'Sales finance scenario · not approved',
    guardrail: 'Win rate and discounting monitored',
    overlapKey: 'enterprise-sales|proposal|2026-q3',
    progress: 46,
    icon: TrendingUp,
  },
]

const additionalClaims: ValueClaim[] = [
  {
    id: 'external-research-spend',
    name: 'External research spend reduction',
    team: 'Customer Operations',
    product: 'Copilot Cowork',
    pillar: 'Cost Savings',
    stage: 'Realized',
    grossValue: 16500,
    confidence: 'High',
    operationalGrade: 'Observed',
    valuationGrade: 'Observed',
    cohort: 'Customer Operations',
    period: 'Q2 2026',
    baseline: '$12,500 per month',
    comparison: 'Three-month pre-adoption invoice baseline',
    operationalSource: 'Vendor invoices and purchase orders',
    valuationFormula: '($12,500 − $7,000) × 3 months',
    valuationSource: 'General ledger actuals',
    guardrail: 'Research quality and turnaround unchanged',
    overlapKey: 'customer-operations|research-spend|2026-q2',
    approvedBy: 'Finance review · demo',
  },
  {
    id: 'production-risk',
    name: 'Production risk reduction',
    team: 'Platform Engineering',
    product: 'GitHub Copilot',
    pillar: 'Risk Mitigation',
    stage: 'Validated',
    grossValue: 32000,
    confidence: 'Medium',
    operationalGrade: 'Observed',
    valuationGrade: 'Modelled',
    cohort: 'Platform services · matched releases',
    period: 'Q2 2026',
    baseline: 'Severity-weighted incident rate',
    comparison: 'Matched releases with stable severity definitions',
    operationalSource: 'Incident and change-management records',
    valuationFormula: '4 severity-weighted incidents avoided × $8,000 expected loss',
    valuationSource: 'Risk committee expected-loss policy v2',
    guardrail: 'Change failure rate and review time monitored',
    overlapKey: 'platform|production-risk|2026-q2',
    approvedBy: 'Risk and finance review · demo',
  },
  {
    id: 'new-capability',
    name: 'New AI-assisted service concept',
    team: 'Enterprise Sales',
    product: 'Copilot Cowork',
    pillar: 'Innovation / Transformation',
    stage: 'Signal',
    grossValue: 0,
    confidence: 'Low',
    operationalGrade: 'Anecdotal',
    cohort: 'Three discovery interviews',
    period: 'Q3 2026',
    operationalSource: 'Documented customer interviews',
    guardrail: 'No revenue attributed before customer adoption',
    overlapKey: 'enterprise-sales|new-service|2026-q3',
  },
]

export const valueClaims: ValueClaim[] = [...studies, ...additionalClaims]

export const copilotSpend = 28460

const pillarMetadata: Record<PillarLabel, { color: string; description: string }> = {
  'Improved Performance': { color: '#087f6b', description: 'Measured throughput and delivery outcomes' },
  'Cost Savings': { color: '#de7b22', description: 'Reconciled avoided or reduced spend' },
  'Innovation / Transformation': { color: '#2f6fce', description: 'New capabilities, valued only after adoption' },
  'Risk Mitigation': { color: '#8391a7', description: 'Expected-loss reduction with stable controls' },
}

export type Assumptions = {
  implementationCost: number
  enablementCost: number
  operationsCost: number
  observedWeight: number
  estimatedWeight: number
  modelledWeight: number
  anecdotalWeight: number
  highConfidenceWeight: number
  mediumConfidenceWeight: number
  lowConfidenceWeight: number
}

export const defaultAssumptions: Assumptions = {
  implementationCost: 18000,
  enablementCost: 9000,
  operationsCost: 6000,
  observedWeight: 1,
  estimatedWeight: 0.7,
  modelledWeight: 0.75,
  anecdotalWeight: 0,
  highConfidenceWeight: 1,
  mediumConfidenceWeight: 0.85,
  lowConfidenceWeight: 0.5,
}

export const evidenceWeightKeys: Record<EvidenceGrade, keyof Assumptions> = {
  Observed: 'observedWeight',
  Estimated: 'estimatedWeight',
  Modelled: 'modelledWeight',
  Anecdotal: 'anecdotalWeight',
}

export const confidenceWeightKeys: Record<Confidence, keyof Assumptions> = {
  High: 'highConfidenceWeight',
  Medium: 'mediumConfidenceWeight',
  Low: 'lowConfidenceWeight',
}

export type ValueContribution = ValueClaim & {
  adjustedValue: number
  limitingGrade: EvidenceGrade
}

const validatedRoiStages = new Set<ValueStage>(['Validated', 'Realized'])

export function calculatePortfolio(assumptions: Assumptions, claims: ValueClaim[] = valueClaims) {
  const evidenceWeights = Object.fromEntries(
    (Object.keys(evidenceWeightKeys) as EvidenceGrade[]).map((grade) => [grade, assumptions[evidenceWeightKeys[grade]]]),
  ) as Record<EvidenceGrade, number>
  const confidenceWeights = Object.fromEntries(
    (Object.keys(confidenceWeightKeys) as Confidence[]).map((confidence) => [confidence, assumptions[confidenceWeightKeys[confidence]]]),
  ) as Record<Confidence, number>

  const seenOverlapKeys = new Set<string>()
  const excludedDuplicates: ValueClaim[] = []
  const eligibleClaims = claims.filter((claim) => {
    if (!validatedRoiStages.has(claim.stage) || claim.grossValue <= 0 || !claim.valuationGrade) return false
    if (seenOverlapKeys.has(claim.overlapKey)) {
      excludedDuplicates.push(claim)
      return false
    }
    seenOverlapKeys.add(claim.overlapKey)
    return true
  })

  const contributions: ValueContribution[] = eligibleClaims.map((claim) => {
    const operationalWeight = evidenceWeights[claim.operationalGrade]
    const valuationWeight = evidenceWeights[claim.valuationGrade!]
    const limitingGrade = valuationWeight <= operationalWeight ? claim.valuationGrade! : claim.operationalGrade
    return {
      ...claim,
      limitingGrade,
      adjustedValue: claim.grossValue * Math.min(operationalWeight, valuationWeight) * confidenceWeights[claim.confidence],
    }
  })

  const rawValue = contributions.reduce((sum, claim) => sum + claim.grossValue, 0)
  const adjustedValue = contributions.reduce((sum, claim) => sum + claim.adjustedValue, 0)
  const totalCost = copilotSpend + assumptions.implementationCost + assumptions.enablementCost + assumptions.operationsCost
  const netValue = adjustedValue - totalCost
  const roi = totalCost === 0 ? 0 : netValue / totalCost
  const benefitCostRatio = totalCost === 0 ? 0 : adjustedValue / totalCost
  const retentionRate = rawValue === 0 ? 0 : Math.round((adjustedValue / rawValue) * 100)

  const pillars = (Object.keys(pillarMetadata) as PillarLabel[]).map((label) => {
    const matches = contributions.filter((claim) => claim.pillar === label)
    return {
      label,
      ...pillarMetadata[label],
      rawValue: matches.reduce((sum, claim) => sum + claim.grossValue, 0),
      value: matches.reduce((sum, claim) => sum + claim.adjustedValue, 0),
      sourceCount: matches.length,
    }
  })

  const evidenceMix = (Object.keys(evidenceWeights) as EvidenceGrade[]).map((grade) => ({
    grade,
    percentage: rawValue === 0
      ? 0
      : contributions.filter((claim) => claim.limitingGrade === grade).reduce((sum, claim) => sum + claim.grossValue, 0) / rawValue * 100,
  }))

  const requiredEvidence = (claim: ValueClaim) => [
    claim.baseline,
    claim.comparison,
    claim.operationalSource,
    claim.valuationFormula,
    claim.valuationSource,
    claim.guardrail,
    claim.approvedBy,
  ]
  const evidenceChecks = eligibleClaims.flatMap(requiredEvidence)
  const evidenceCoverage = evidenceChecks.length === 0
    ? 0
    : Math.round(evidenceChecks.filter(Boolean).length / evidenceChecks.length * 100)
  const pipelineValue = claims
    .filter((claim) => !validatedRoiStages.has(claim.stage))
    .reduce((sum, claim) => sum + claim.grossValue, 0)

  return {
    rawValue,
    adjustedValue,
    validatedValue: adjustedValue,
    totalCost,
    netValue,
    validatedNetValue: netValue,
    roi,
    validatedRoi: roi,
    benefitCostRatio,
    validatedBenefitCostRatio: benefitCostRatio,
    retentionRate,
    evidenceCoverage,
    pillars,
    evidenceMix,
    evidenceWeights,
    confidenceWeights,
    contributions,
    pipelineValue,
    excludedDuplicates,
  }
}

export function summarizePulse(responses: ResponseRecord[]) {
  const totals = responses.reduce((result, response) => {
    const impact = resolveTimeImpactHours(response.timeImpact)
    return {
      low: result.low + impact.low,
      mid: result.mid + impact.mid,
      faster: result.faster + Number(impact.mid > 0),
      neutral: result.neutral + Number(impact.mid === 0),
      slower: result.slower + Number(impact.mid < 0),
    }
  }, { low: 0, mid: 0, faster: 0, neutral: 0, slower: 0 })

  return {
    ...totals,
    responseCount: responses.length,
    representedProducts: new Set(responses.map((response) => response.product)).size,
    projectionEligible: false,
    projectionReason: 'A descriptive sample is not projected unless responses are tied to a governed sampling frame.',
  }
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function sampleVariance(values: number[], mean: number) {
  return values.length < 2
    ? 0
    : values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
}

function conservativeTCritical95(degreesOfFreedom: number) {
  const table: [number, number][] = [
    [1, 12.706], [2, 4.303], [3, 3.182], [4, 2.776], [5, 2.571], [6, 2.447],
    [7, 2.365], [8, 2.306], [9, 2.262], [10, 2.228], [12, 2.179], [15, 2.131],
    [20, 2.086], [30, 2.042], [60, 2], [120, 1.98],
  ]
  return [...table].reverse().find(([minimum]) => degreesOfFreedom >= minimum)?.[1] ?? table[0][1]
}

function projectedVariance(values: number[], population: number, designEffect: number) {
  if (values.length < 2 || population <= 1) return 0
  const mean = average(values)
  const finitePopulationCorrection = Math.max(0, 1 - values.length / population)
  return population ** 2 * finitePopulationCorrection * sampleVariance(values, mean) / values.length * designEffect
}

function modelledTaskValue(hours: number, policy: PulseProjectionPolicy) {
  if (hours <= 0) return hours * policy.contributionValuePerHour
  return hours
    * policy.selfReportCalibration
    * policy.capacityRealizationRate
    * policy.contributionValuePerHour
}

export function estimatePulseValue(
  responses: ResponseRecord[],
  policy: PulseProjectionPolicy = pulseProjectionPolicy,
) {
  const sampledResponses = responses.filter((response) => response.sampleFrameId === policy.id)
  const strata = policy.strata.map((frame) => {
    const matches = sampledResponses.filter((response) => response.product === frame.product)
    const hours = matches.map((response) => resolveTimeImpactHours(response.timeImpact).mid)
    const modelledValues = hours.map((value) => modelledTaskValue(value, policy))
    const meanTaskHours = average(hours)
    const meanTaskValue = average(modelledValues)
    const responseRate = frame.invitations === 0 ? 0 : matches.length / frame.invitations
    return {
      ...frame,
      responses: matches.length,
      responseRate,
      meanTaskHours,
      projectedHours: frame.eligibleTaskEvents * meanTaskHours,
      estimatedValue: frame.eligibleTaskEvents * meanTaskValue,
      hoursVariance: projectedVariance(hours, frame.eligibleTaskEvents, policy.designEffect),
      valueVariance: projectedVariance(modelledValues, frame.eligibleTaskEvents, policy.designEffect),
    }
  })

  const reasons: string[] = []
  if (!policy.randomSelection) reasons.push('invitations are not randomly selected')
  if (!policy.registeredClaimScopesExcludedUpstream) {
    reasons.push('the source frame is not certified as excluding registered claim scopes upstream')
  }
  strata.forEach((stratum) => {
    if (stratum.responses < policy.minimumResponsesPerStratum) {
      reasons.push(`${stratum.product} has fewer than ${policy.minimumResponsesPerStratum} sampled responses`)
    }
    if (stratum.responses > stratum.invitations) reasons.push(`${stratum.product} has more responses than invitations`)
    if (stratum.responseRate < policy.minimumResponseRate) {
      reasons.push(`${stratum.product} response rate is below ${Math.round(policy.minimumResponseRate * 100)}%`)
    }
  })

  const projectionEligible = reasons.length === 0
  const estimatedHours = strata.reduce((sum, stratum) => sum + stratum.projectedHours, 0)
  const estimatedValue = strata.reduce((sum, stratum) => sum + stratum.estimatedValue, 0)
  const degreesOfFreedom = Math.max(1, Math.min(...strata.map((stratum) => Math.max(1, stratum.responses - 1))))
  const criticalValue = conservativeTCritical95(degreesOfFreedom)
  const hoursMargin = criticalValue * Math.sqrt(strata.reduce((sum, stratum) => sum + stratum.hoursVariance, 0))
  const valueMargin = criticalValue * Math.sqrt(strata.reduce((sum, stratum) => sum + stratum.valueVariance, 0))
  const populationTaskEvents = strata.reduce((sum, stratum) => sum + stratum.eligibleTaskEvents, 0)
  const invitations = strata.reduce((sum, stratum) => sum + stratum.invitations, 0)

  return {
    projectionEligible,
    projectionReason: projectionEligible
      ? 'Known random sample, response thresholds met, and source frame certified as prefiltered for registered claim scopes.'
      : reasons.join('; '),
    sampledResponseCount: sampledResponses.length,
    populationTaskEvents,
    invitations,
    responseRate: invitations === 0 ? 0 : sampledResponses.length / invitations,
    estimatedHours,
    hoursInterval: { low: estimatedHours - hoursMargin, high: estimatedHours + hoursMargin },
    estimatedValue,
    valueInterval: { low: estimatedValue - valueMargin, high: estimatedValue + valueMargin },
    strata,
    policy,
  }
}

export function combinePulseWithPortfolio(
  adjustedValue: number,
  totalCost: number,
  projection: ReturnType<typeof estimatePulseValue>,
) {
  const pulseValue = projection.projectionEligible ? projection.estimatedValue : 0
  const pulseValueLow = projection.projectionEligible ? projection.valueInterval.low : 0
  const pulseValueHigh = projection.projectionEligible ? projection.valueInterval.high : 0
  const value = adjustedValue + pulseValue
  const netValue = value - totalCost
  const roiForValue = (candidate: number) => totalCost === 0 ? 0 : (candidate - totalCost) / totalCost
  const benefitCostRatioForValue = (candidate: number) => totalCost === 0 ? 0 : candidate / totalCost
  return {
    value,
    netValue,
    roi: roiForValue(value),
    benefitCostRatio: benefitCostRatioForValue(value),
    roiInterval: {
      low: roiForValue(adjustedValue + pulseValueLow),
      high: roiForValue(adjustedValue + pulseValueHigh),
    },
    benefitCostRatioInterval: {
      low: benefitCostRatioForValue(adjustedValue + pulseValueLow),
      high: benefitCostRatioForValue(adjustedValue + pulseValueHigh),
    },
    pulseValue,
  }
}

export function formatCurrency(value: number) {
  const sign = value < 0 ? '−' : ''
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString('en-US')}`
}

export function formatShort(value: number) {
  const sign = value < 0 ? '−' : ''
  return `${sign}$${(Math.abs(value) / 1000).toFixed(1)}k`
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}
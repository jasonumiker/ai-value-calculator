import { BookOpenCheck, Code2, TrendingUp, type LucideIcon } from 'lucide-react'

export type Product = 'GitHub Copilot' | 'Copilot Cowork'
export type EvidenceGrade = 'Observed' | 'Estimated' | 'Modelled' | 'Anecdotal'
export type Confidence = 'High' | 'Medium' | 'Low'
export type PillarLabel = 'Improved Performance' | 'Cost Savings' | 'Innovation / Transformation' | 'Risk Mitigation'
export type ValueStage = 'Signal' | 'Capacity' | 'Validated' | 'Realized'

export type Hypothesis = {
  id: number
  useCase: string
  owner: string
  product: Product
  expectedEffect: string
  outcome: string
  evidence: string
  guardrail: string
}

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
  financialReview?: FinancialReview
  realization?: FinancialRealization
}

export type FinancialProposal = {
  pillar: PillarLabel
  grossValue: number
  valuationFormula: string
  valuationSource: string
  valuationGrade: EvidenceGrade
  confidence: Confidence
  overlapKey: string
  policyVersion: string
  assumptions: string
}

type FinancialEvidence = Pick<ValueClaim, 'id' | 'name' | 'team' | 'product' | 'cohort' | 'period' | 'baseline' | 'comparison' | 'operationalSource' | 'operationalGrade' | 'guardrail'> & {
  metric?: string
  result?: string
  progress?: number
}

export type FinancialReviewEvent = {
  action: 'Submitted' | 'Approved' | 'Rejected' | 'Realized'
  actor: string
  recordedAt: string
  notes: string
  proposal?: FinancialProposal
  evidence?: FinancialEvidence
  realization?: FinancialRealization
  riskOwner?: string
  checks?: Pick<FinancialDecision, 'evidenceChecked' | 'guardrailsChecked' | 'overlapChecked'>
}

export type FinancialReview = {
  status: 'Pending' | 'Approved' | 'Rejected'
  proposal: FinancialProposal
  evidence: FinancialEvidence
  history: FinancialReviewEvent[]
}

export type FinancialDecision = {
  actor: string
  notes: string
  evidenceChecked: boolean
  guardrailsChecked: boolean
  overlapChecked: boolean
  riskOwner: string
}

export type FinancialRealization = {
  grossValue: number
  formula: string
  source: string
  actor: string
  notes: string
  recordedAt: string
}

export type Study = ValueClaim & {
  hypothesisId?: Hypothesis['id']
  expectedEffect?: string
  outcome?: string
  metric: string
  result: string
  progress: number
  icon: LucideIcon
  current?: string
  capacityHours?: number
}

export type StudyRecord = Omit<Study, 'icon'>

export function createStudyFromHypothesis(hypothesis: Hypothesis): StudyRecord {
  return {
    id: `hypothesis-${hypothesis.id}`,
    hypothesisId: hypothesis.id,
    name: hypothesis.useCase,
    team: hypothesis.owner,
    product: hypothesis.product,
    expectedEffect: hypothesis.expectedEffect,
    outcome: hypothesis.outcome,
    metric: hypothesis.outcome,
    operationalSource: hypothesis.evidence,
    guardrail: hypothesis.guardrail,
    pillar: 'Improved Performance',
    stage: 'Signal',
    grossValue: 0,
    confidence: 'Low',
    operationalGrade: 'Anecdotal',
    cohort: '',
    period: '',
    result: 'Not measured yet',
    progress: 0,
    overlapKey: `hypothesis-${hypothesis.id}|unvalidated`,
  }
}

export function getHypothesisStatus(hypothesisId: number, records: StudyRecord[]) {
  const study = records.find((record) => record.hypothesisId === hypothesisId)
  if (!study) return 'Ready to test'
  return study.progress === 100 ? 'Study complete' : 'In study'
}

function financialEvidence(claim: ValueClaim): FinancialEvidence {
  const study = claim as Partial<StudyRecord>
  return {
    id: claim.id,
    name: claim.name,
    team: claim.team,
    product: claim.product,
    cohort: claim.cohort,
    period: claim.period,
    baseline: claim.baseline,
    comparison: claim.comparison,
    operationalSource: claim.operationalSource,
    operationalGrade: claim.operationalGrade,
    guardrail: claim.guardrail,
    metric: study.metric,
    result: study.result,
    progress: study.progress,
  }
}

function matchesFinancialEvidence(claim: ValueClaim, evidence: FinancialEvidence) {
  const current = financialEvidence(claim)
  return (Object.keys(current) as (keyof FinancialEvidence)[]).every((key) => current[key] === evidence[key])
}

export function isFinanciallyApproved(claim: ValueClaim) {
  const review = claim.financialReview
  if (!review || review.status !== 'Approved' || !matchesFinancialEvidence(claim, review.evidence)) return false
  const decision = review.history.findLast((event) => event.action === 'Approved')
  const latest = review.history.at(-1)
  const proposal = review.proposal
  if (!decision?.actor.trim() || !decision.recordedAt || !decision.notes.trim() || !proposal.policyVersion.trim()) return false
  if (!decision.checks?.evidenceChecked || !decision.checks.guardrailsChecked || !decision.checks.overlapChecked) return false
  if (proposal.pillar === 'Risk Mitigation' && !decision.riskOwner?.trim()) return false
  if (!Number.isFinite(proposal.grossValue) || proposal.grossValue <= 0 || !proposal.assumptions.trim()
    || !proposal.valuationFormula.trim() || !proposal.valuationSource.trim() || !proposal.overlapKey.trim()) return false
  if (claim.pillar !== proposal.pillar || claim.confidence !== proposal.confidence || claim.overlapKey !== proposal.overlapKey) return false
  if (claim.stage === 'Realized') {
    const realized = claim.realization
    return !!realized && latest?.action === 'Realized' && !!realized.source.trim() && !!realized.formula.trim()
      && !!realized.actor.trim() && !!realized.notes.trim() && !!realized.recordedAt
      && Number.isFinite(realized.grossValue) && realized.grossValue >= 0
      && !!latest.realization && (Object.keys(realized) as (keyof FinancialRealization)[]).every((key) => realized[key] === latest.realization?.[key])
      && claim.grossValue === realized.grossValue && claim.valuationSource === realized.source
      && claim.valuationFormula === realized.formula && claim.valuationGrade === 'Observed' && claim.approvedBy === realized.actor
  }
  return claim.stage === 'Validated' && latest?.action === 'Approved' && claim.approvedBy === decision.actor
    && claim.grossValue === proposal.grossValue && claim.valuationGrade === proposal.valuationGrade
    && claim.valuationFormula === proposal.valuationFormula && claim.valuationSource === proposal.valuationSource
}

function assertReviewableStudy(study: StudyRecord) {
  if (study.progress !== 100) throw new Error('Complete the study before requesting financial review.')
  if (![study.cohort, study.period, study.metric, study.baseline, study.comparison, study.result, study.operationalSource, study.guardrail].every((value) => value?.trim()) || study.result === 'Not measured yet') {
    throw new Error('Financial review requires a cohort, period, metric, baseline, comparison, result, source, and guardrail.')
  }
  if (!['Observed', 'Estimated', 'Modelled'].includes(study.operationalGrade)) throw new Error('Anecdotal evidence alone is not eligible for financial approval.')
}

function assertNoFinancialOverlap(studyId: string, overlapKey: string, claims: ValueClaim[]) {
  const duplicate = claims.find((claim) => claim.id !== studyId && (claim.financialReview?.status === 'Pending' || isFinanciallyApproved(claim))
    && (claim.financialReview?.proposal.overlapKey ?? claim.overlapKey).trim().toLowerCase() === overlapKey.trim().toLowerCase())
  if (duplicate) throw new Error(`This benefit scope is already reserved by "${duplicate.name}". Resolve the overlap before approval.`)
}

export function submitFinancialReview(study: StudyRecord, proposal: FinancialProposal, actor: string, claims: ValueClaim[], recordedAt = new Date().toISOString()): StudyRecord {
  assertReviewableStudy(study)
  if (study.financialReview?.status === 'Pending' || study.financialReview?.status === 'Approved') throw new Error('This study already has a pending or approved financial review.')
  if (!actor.trim() || ![proposal.valuationFormula, proposal.valuationSource, proposal.overlapKey, proposal.policyVersion, proposal.assumptions].every((value) => value.trim())) {
    throw new Error('Provide the preparer, valuation formula, source, benefit scope, policy version, and assumptions.')
  }
  if (!Number.isFinite(proposal.grossValue) || proposal.grossValue <= 0) throw new Error('Proposed gross value must be a positive, finite amount.')
  if (!['Observed', 'Estimated', 'Modelled'].includes(proposal.valuationGrade) || !['High', 'Medium', 'Low'].includes(proposal.confidence)
    || !['Improved Performance', 'Cost Savings', 'Innovation / Transformation', 'Risk Mitigation'].includes(proposal.pillar)) throw new Error('Choose valid valuation evidence, confidence, and a business-value pillar.')
  if (proposal.overlapKey.endsWith('|unvalidated')) throw new Error('Replace the draft scope with a cohort, benefit mechanism, and period key.')
  assertNoFinancialOverlap(study.id, proposal.overlapKey, claims)
  const evidence = financialEvidence(study)
  const submitted: FinancialReviewEvent = { action: 'Submitted', actor: actor.trim(), recordedAt, notes: proposal.assumptions, proposal: { ...proposal }, evidence }
  return {
    ...study,
    stage: study.stage === 'Validated' || study.stage === 'Realized' ? 'Signal' : study.stage,
    approvedBy: undefined,
    realization: undefined,
    financialReview: { status: 'Pending', proposal: { ...proposal }, evidence, history: [...(study.financialReview?.history ?? []), submitted] },
  }
}

export function decideFinancialReview(study: StudyRecord, decision: 'Approved' | 'Rejected', input: FinancialDecision, claims: ValueClaim[], recordedAt = new Date().toISOString()): StudyRecord {
  const review = study.financialReview
  if (!review || review.status !== 'Pending') throw new Error('Only a pending financial review can be decided.')
  if (!input.actor.trim() || !input.notes.trim()) throw new Error('Record the finance reviewer and decision rationale.')
  if (decision === 'Approved') {
    assertReviewableStudy(study)
    if (!matchesFinancialEvidence(study, review.evidence)) throw new Error('Study evidence changed after submission. Return it for changes and resubmit.')
    if (!input.evidenceChecked || !input.guardrailsChecked || !input.overlapChecked) throw new Error('Confirm attribution, guardrails, and claim/Pulse overlap checks before approval.')
    if (review.proposal.pillar === 'Risk Mitigation' && !input.riskOwner.trim()) throw new Error('Risk mitigation requires a risk-owner sign-off reference.')
    assertNoFinancialOverlap(study.id, review.proposal.overlapKey, claims)
  }
  const updatedReview: FinancialReview = {
    ...review,
    status: decision,
    history: [...review.history, {
      action: decision,
      actor: input.actor.trim(),
      recordedAt,
      notes: input.notes.trim(),
      riskOwner: input.riskOwner.trim() || undefined,
      checks: { evidenceChecked: input.evidenceChecked, guardrailsChecked: input.guardrailsChecked, overlapChecked: input.overlapChecked },
    }],
  }
  if (decision === 'Rejected') return { ...study, financialReview: updatedReview }
  const { policyVersion: _policyVersion, assumptions: _assumptions, ...valuation } = review.proposal
  return { ...study, ...valuation, stage: 'Validated', approvedBy: input.actor.trim(), financialReview: updatedReview }
}

export function recordFinancialRealization(study: StudyRecord, input: Omit<FinancialRealization, 'recordedAt'>, recordedAt = new Date().toISOString()): StudyRecord {
  if (study.stage !== 'Validated' || !isFinanciallyApproved(study)) throw new Error('Only an approved Validated claim can be reconciled as Realized.')
  if (!Number.isFinite(input.grossValue) || input.grossValue < 0) throw new Error('Realized gross value must be a non-negative, finite amount.')
  if (![input.formula, input.source, input.actor, input.notes].every((value) => value.trim())) throw new Error('Provide the realized-value formula, reconciliation source, finance reviewer, and explanation of any variance.')
  const realization = { ...input, recordedAt }
  return {
    ...study,
    stage: 'Realized',
    grossValue: input.grossValue,
    valuationGrade: 'Observed',
    valuationFormula: input.formula,
    valuationSource: input.source,
    approvedBy: input.actor,
    realization,
    financialReview: {
      ...study.financialReview!,
      history: [...study.financialReview!.history, { action: 'Realized', actor: input.actor, recordedAt, notes: input.notes, realization }],
    },
  }
}

function withDemoFinancialApproval<Claim extends ValueClaim>(claim: Claim): Claim {
  if (!claim.approvedBy || !['Validated', 'Realized'].includes(claim.stage)) return claim
  const recordedAt = '2026-07-15T12:00:00.000Z'
  const proposal: FinancialProposal = {
    pillar: claim.pillar,
    grossValue: claim.grossValue,
    valuationFormula: claim.valuationFormula!,
    valuationSource: claim.valuationSource!,
    valuationGrade: claim.valuationGrade!,
    confidence: claim.confidence,
    overlapKey: claim.overlapKey,
    policyVersion: 'demo-claim-policy-v1',
    assumptions: 'Fictional review of attribution, contribution value, quality, and claim/Pulse overlap. Not a customer approval.',
  }
  const evidence = financialEvidence(claim)
  const history: FinancialReviewEvent[] = [
    { action: 'Submitted', actor: 'Process owner (demo)', recordedAt, notes: proposal.assumptions, proposal, evidence },
    {
      action: 'Approved', actor: claim.approvedBy, recordedAt, notes: 'Fictional finance approval for demonstration only.',
      checks: { evidenceChecked: true, guardrailsChecked: true, overlapChecked: true },
      riskOwner: claim.pillar === 'Risk Mitigation' ? 'Risk committee review (demo)' : undefined,
    },
  ]
  const realization: FinancialRealization | undefined = claim.stage === 'Realized'
    ? { grossValue: claim.grossValue, formula: claim.valuationFormula!, source: claim.valuationSource!, actor: claim.approvedBy, notes: 'Fictional reconciliation to finance records.', recordedAt }
    : undefined
  if (realization) history.push({ action: 'Realized', actor: realization.actor, recordedAt, notes: realization.notes, realization })
  return { ...claim, realization, financialReview: { status: 'Approved', proposal, evidence, history } }
}

const seedStudies: Study[] = [
  {
    id: 'developer-delivery',
    hypothesisId: 1,
    expectedEffect: 'Shorter development cycle',
    outcome: 'Increase release throughput',
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
    hypothesisId: 2,
    expectedEffect: 'Less preparation time',
    outcome: 'Handle more cases per week',
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
    hypothesisId: 3,
    expectedEffect: 'Faster response to clients',
    outcome: 'Improve proposal conversion',
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

export const studies: Study[] = seedStudies.map(withDemoFinancialApproval)

export function restoreStudyRecords(saved: StudyRecord[]): StudyRecord[] {
  const restored = saved.map((record) => {
    const seed = studies.find((study) => study.id === record.id)
    if (!record.financialReview && seed?.financialReview) {
      const migrated = { ...record, financialReview: seed.financialReview, realization: seed.realization }
      if (isFinanciallyApproved(migrated)) return migrated
    }
    return record
  })
  return [...studies.filter((seed) => !restored.some((record) => record.id === seed.id)).map(({ icon: _icon, ...record }) => record), ...restored]
}

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

export const valueClaims: ValueClaim[] = [...studies, ...additionalClaims.map(withDemoFinancialApproval)]

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
    if (!validatedRoiStages.has(claim.stage) || claim.grossValue <= 0 || !claim.valuationGrade || !isFinanciallyApproved(claim)) return false
    const overlapKey = claim.overlapKey.trim().toLowerCase()
    if (seenOverlapKeys.has(overlapKey)) {
      excludedDuplicates.push(claim)
      return false
    }
    seenOverlapKeys.add(overlapKey)
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
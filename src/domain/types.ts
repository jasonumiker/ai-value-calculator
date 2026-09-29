export type Product = string
export type PeriodKey = string
export type Persona = 'employee' | 'manager' | 'executive'

export type ProductCategory = 'Coding assistant' | 'Knowledge work' | 'Agent or other'
export type ProductDefinition = { name: Product; category: ProductCategory; workTypes: string[] }

export type EvidenceGrade = 'Observed' | 'Estimated' | 'Modelled' | 'Anecdotal'
export type Confidence = 'High' | 'Medium' | 'Low'
export type PillarLabel = 'Improved Performance' | 'Cost Savings' | 'Innovation / Transformation' | 'Risk Mitigation'
export type ValueStage = 'Signal' | 'Capacity' | 'Validated' | 'Realized'
export type StudyDesign = 'Randomised' | 'Matched groups' | 'Staggered rollout' | 'Before/after' | 'Anecdotal'
export type Verdict = 'Supported' | 'Not supported' | 'Inconclusive'
export type MetricUnit = 'minutes per task' | 'hours per task' | 'days' | 'percent' | 'count' | 'other'
export type ReuseCategory = 'More of the same work' | 'Other priority work' | 'Learning or improvement' | 'Finished earlier or nothing specific'

export const evidenceGrades: EvidenceGrade[] = ['Observed', 'Estimated', 'Modelled', 'Anecdotal']
export const confidenceLevels: Confidence[] = ['High', 'Medium', 'Low']
export const pillarLabels: PillarLabel[] = ['Improved Performance', 'Cost Savings', 'Innovation / Transformation', 'Risk Mitigation']
export const studyDesigns: StudyDesign[] = ['Randomised', 'Matched groups', 'Staggered rollout', 'Before/after', 'Anecdotal']
export const metricUnits: MetricUnit[] = ['minutes per task', 'hours per task', 'days', 'percent', 'count', 'other']
export const reuseCategories: ReuseCategory[] = ['More of the same work', 'Other priority work', 'Learning or improvement', 'Finished earlier or nothing specific']

/** Task sessions a claim already values, so they are removed from the Pulse population. */
export type PulseScope = { team: string; product: Product; workTypes: string[] }
export type ExclusionScope = { claimId: string; claimName: string; scope: PulseScope }
export type FrameExclusion = ExclusionScope & { sessions: number }

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

export type FinancialEvidence = Record<string, string | number | undefined>

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
  period: PeriodKey
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
  pulseScope?: PulseScope
}

export type ArmSummary = { n: number; mean: number; sd: number }

export type SuccessCriterion = {
  metric: string
  unit: MetricUnit
  direction: 'decrease' | 'increase'
  minimumImprovementPct: number
  guardrailMetric: string
  guardrailMaxWorseningPct: number
  minimumSamplePerArm: number
}

export type HypothesisStatus = 'Nominated' | 'Approved for testing' | 'Parked'
export type StudyEffort = 'Small' | 'Medium' | 'Large'

export type Hypothesis = {
  id: number
  useCase: string
  owner: string
  nominatedBy: string
  product: Product
  workType?: string
  expectedEffect: string
  outcome: string
  evidence: string
  guardrail: string
  frequencyPerWeek: number
  peopleAffected: number
  expectedMinutesSaved: number
  studyEffort: StudyEffort
  successCriterion: SuccessCriterion
  status: HypothesisStatus
  sourceSignal?: string
  nominatedAt: string
  prioritisedBy?: string
  prioritisedAt?: string
}

export type StudyRecord = ValueClaim & {
  hypothesisId?: number
  expectedEffect?: string
  outcome?: string
  workType?: string
  design: StudyDesign
  successCriterion?: SuccessCriterion
  preRegisteredAt?: string
  metric: string
  metricUnit?: MetricUnit
  control?: ArmSummary
  treatment?: ArmSummary
  guardrailChangePct?: number
  result: string
  progress: number
  current?: string
}

export type ResponseRecord = {
  id: string
  period: PeriodKey
  product: Product
  team?: string
  workType: string
  hours: number
  effect: string
  reuse?: ReuseCategory
  date: string
  source: 'Random invitation' | 'Preview'
  frameId?: string
  invitationId?: string
  secondsToAnswer?: number
}

export type UsageRecord = {
  period: PeriodKey
  month?: string
  product: Product
  team: string
  cost: number
  credits?: number
  activeUsers?: number
  taskSessions?: number
  source: string
}

export type ChangeCosts = { implementation: number; enablement: number; operations: number }

export type TaskSession = {
  id: string
  period: PeriodKey
  month?: string
  week: number
  day: number
  product: Product
  team: string
  workType: string
  personKey: string
  credits: number
}

export type FrameStratum = {
  product: Product
  workType: string
  eligibleSessions: number
  /** Eligible sessions by team when drawn, so later claim exclusions never depend on a changed usage log. */
  teamSessions: Record<string, number>
  planned: number
  drawn: number
}

export type SamplingFrame = {
  id: string
  period: PeriodKey
  createdAt: string
  seed: number
  status: 'Open' | 'Closed'
  policyVersion: string
  cadenceDays: number
  maxInvitationsPerPerson: number
  invitationsPerWeek: number
  workforce: number
  /** Months of usage the sample was drawn from; empty when the bill had quarter-level rows only. */
  months: string[]
  strata: FrameStratum[]
  /** Work under a registered study when the sample was drawn; the study measures it instead of the Pulse. */
  excludedScopes: FrameExclusion[]
}

export type InvitationStatus = 'Pending' | 'Responded' | 'Declined' | 'Expired'

export type Invitation = {
  id: string
  frameId: string
  period: PeriodKey
  week: number
  day: number
  product: Product
  team: string
  workType: string
  status: InvitationStatus
}

export type DecisionOption = 'Scale' | 'Redesign' | 'Keep measuring' | 'Stop'
export const decisionOptions: DecisionOption[] = ['Scale', 'Redesign', 'Keep measuring', 'Stop']

export type DecisionRecord = {
  id: string
  period: PeriodKey
  team: string
  decision: DecisionOption
  suggested: DecisionOption
  rationale: string
  decidedBy: string
  decidedAt: string
}

export type ImportRecord = {
  id: string
  name: string
  rows: number
  date: string
  status: 'Applied' | 'Rejected'
  note: string
  periods: PeriodKey[]
  totalCost: number
}

export type DesignCap = { grade: EvidenceGrade; confidence: Confidence }

export type Policy = {
  version: number
  evidenceWeights: Record<EvidenceGrade, number>
  confidenceWeights: Record<Confidence, number>
  designCaps: Record<StudyDesign, DesignCap>
  contributionValuePerHour: number
  defaultSelfReportCalibration: number
  useStudyCalibration: boolean
  defaultCapacityRealization: number
  useSurveyReuse: boolean
  reuseWeights: Record<ReuseCategory, number>
  minimumReuseAnswers: number
  lossTreatment: 'Full rate' | 'Same discounts'
  minimumResponsesPerStratum: number
  minimumResponseRate: number
  designEffect: number
  cadenceDays: number
  maxInvitationsPerPersonPerQuarter: number
  invitationsPerWeek: number
  scaleBenefitCostRatio: number
  minimumReportingGroup: number
}

export type PolicyChange = {
  version: number
  changedAt: string
  changedBy: string
  reason: string
  changes: string[]
}

export type AppData = {
  version: number
  products: ProductDefinition[]
  usage: UsageRecord[]
  changeCosts: Record<PeriodKey, ChangeCosts>
  policy: Policy
  policyHistory: PolicyChange[]
  hypotheses: Hypothesis[]
  studies: StudyRecord[]
  claims: ValueClaim[]
  frames: SamplingFrame[]
  invitations: Invitation[]
  /** Invitation service only: maps invitation IDs to pseudonymous people. Never exported or joined to responses. */
  routing: Record<string, string>
  responses: ResponseRecord[]
  decisions: DecisionRecord[]
  imports: ImportRecord[]
}

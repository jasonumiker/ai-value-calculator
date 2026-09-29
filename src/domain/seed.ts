import { decideFinancialReview, submitFinancialReview, withRecordedApproval } from './finance'
import { quarterFromMonth, sessionDate } from './periods'
import { defaultPolicy, policyLabel } from './policy'
import { defaultProducts } from './products'
import { createRandom, hashString } from './random'
import { drawSample, priorInvitations, synthesizeSessions, type PriorInvitation } from './sampling'
import { createStudyFromHypothesis, recordStudyEvidence, type StudyEvidenceInput } from './studies'
import { SHARED_TEAM } from './usage'
import {
  reuseCategories,
  type AppData,
  type DecisionRecord,
  type Hypothesis,
  type ImportRecord,
  type Invitation,
  type PeriodKey,
  type ResponseRecord,
  type ReuseCategory,
  type SamplingFrame,
  type StudyRecord,
  type SuccessCriterion,
  type UsageRecord,
  type ValueClaim,
} from './types'

export const STATE_VERSION = 6
export const CURRENT_PERIOD: PeriodKey = '2026-Q3'
/** In the open quarter, invitations from this week onward have been sent but not yet answered. */
export const FIRST_PENDING_WEEK = 12

type TeamPlan = {
  team: string
  product: string
  users: [number, number]
  sessionsPerUser: number
  creditsPerSession: number
  costPerUser: number
  responseRate: number
  reuseWeights: number[]
}

const teamPlans: TeamPlan[] = [
  { team: 'Digital Channels', product: 'GitHub Copilot', users: [78, 86], sessionsPerUser: 26, creditsPerSession: 3.1, costPerUser: 27, responseRate: 0.7, reuseWeights: [0.32, 0.22, 0.12, 0.26, 0.08] },
  { team: 'Platform Engineering', product: 'GitHub Copilot', users: [36, 42], sessionsPerUser: 26, creditsPerSession: 3.4, costPerUser: 28, responseRate: 0.68, reuseWeights: [0.28, 0.25, 0.14, 0.25, 0.08] },
  { team: 'Customer Operations', product: 'Copilot Cowork', users: [116, 128], sessionsPerUser: 17, creditsPerSession: 2.4, costPerUser: 30, responseRate: 0.74, reuseWeights: [0.36, 0.14, 0.1, 0.32, 0.08] },
  { team: 'Enterprise Sales', product: 'Copilot Cowork', users: [27, 31], sessionsPerUser: 17, creditsPerSession: 2.6, costPerUser: 31, responseRate: 0.66, reuseWeights: [0.22, 0.28, 0.1, 0.32, 0.08] },
]

const sharedPlans = [
  { product: 'GitHub Copilot', cost: [320, 380] },
  { product: 'Copilot Cowork', cost: [420, 480] },
]

const seedMonths = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
const usageFiles: Record<string, string> = {
  'GitHub Copilot': 'github-copilot-usage-apr-sep-2026.csv',
  'Copilot Cowork': 'copilot-cowork-usage-apr-sep-2026.csv',
}

function seedUsage(): UsageRecord[] {
  return seedMonths.flatMap((month, index) => {
    const progress = index / (seedMonths.length - 1)
    const period = quarterFromMonth(month)!
    const teams = teamPlans.map((plan) => {
      const activeUsers = Math.round(plan.users[0] + (plan.users[1] - plan.users[0]) * progress)
      const taskSessions = Math.round(activeUsers * plan.sessionsPerUser * (1 + 0.03 * index))
      return {
        period, month, product: plan.product, team: plan.team, activeUsers, taskSessions,
        credits: Math.round(taskSessions * plan.creditsPerSession),
        cost: Math.round(activeUsers * plan.costPerUser * (1 + 0.02 * index)),
        source: usageFiles[plan.product],
      }
    })
    const shared = sharedPlans.map((plan) => ({
      period, month, product: plan.product, team: SHARED_TEAM,
      cost: Math.round(plan.cost[0] + (plan.cost[1] - plan.cost[0]) * progress),
      source: usageFiles[plan.product],
    }))
    return [...teams, ...shared]
  })
}

/** Illustrative self-reported effects (hours per task session) for the simulated Pulse responses. */
const reportedEffects: Record<string, { mean: number; sd: number }> = {
  'GitHub Copilot|Code and tests': { mean: 0.35, sd: 0.45 },
  'GitHub Copilot|Code review': { mean: 0.25, sd: 0.3 },
  'GitHub Copilot|Debugging': { mean: 0.3, sd: 0.45 },
  'GitHub Copilot|Documentation': { mean: 0.25, sd: 0.25 },
  'GitHub Copilot|Incident analysis': { mean: 0.2, sd: 0.4 },
  'Copilot Cowork|Research and synthesis': { mean: 0.55, sd: 0.45 },
  'Copilot Cowork|Document drafting': { mean: 0.4, sd: 0.4 },
  'Copilot Cowork|Customer communication': { mean: 0.2, sd: 0.25 },
  'Copilot Cowork|Data analysis': { mean: -0.2, sd: 0.45 },
  'Copilot Cowork|Meeting follow-up': { mean: 0.15, sd: 0.18 },
}

const positiveEffects: Record<string, string[]> = {
  'Code and tests': ['Faster delivery', 'Faster delivery', 'Higher-quality output'],
  'Code review': ['Faster delivery', 'Stronger control coverage', 'Higher-quality output'],
  Debugging: ['Faster delivery'],
  Documentation: ['Faster delivery', 'Higher-quality output'],
  'Incident analysis': ['Better-informed decisions', 'Faster delivery'],
  'Research and synthesis': ['Better-informed decisions', 'Faster delivery'],
  'Document drafting': ['Faster delivery', 'Higher-quality output', 'Broader scope'],
  'Customer communication': ['Faster delivery', 'Higher-quality output'],
  'Data analysis': ['Better-informed decisions'],
  'Meeting follow-up': ['Faster delivery'],
}

function simulateResponses(frame: SamplingFrame, invitations: Invitation[], firstPendingWeek?: number) {
  const learningCurve = frame.period === '2026-Q2' ? 0.75 : 1
  const responses: ResponseRecord[] = []
  const updated = invitations.map((invitation): Invitation => {
    if (firstPendingWeek && invitation.week >= firstPendingWeek) return invitation
    // One stream per invitation keeps each simulated answer stable when other work types' settings change.
    const random = createRandom(hashString(`response|${invitation.id}`))
    const plan = teamPlans.find((candidate) => candidate.team === invitation.team)
    if (random.next() > (plan?.responseRate ?? 0.6)) return { ...invitation, status: random.next() < 0.3 ? 'Declined' : 'Expired' }
    const reported = reportedEffects[`${invitation.product}|${invitation.workType}`] ?? { mean: 0.2, sd: 0.4 }
    const hours = Math.max(-4, Math.min(4, Math.round(random.normal(reported.mean * learningCurve, reported.sd) * 4) / 4))
    const options = positiveEffects[invitation.workType] ?? ['Faster delivery']
    const effect = hours < 0
      ? random.next() < 0.8 ? 'More rework or lower quality' : 'No material change'
      : hours === 0
        ? random.next() < 0.7 ? 'No material change' : 'Higher-quality output'
        : options[Math.floor(random.next() * options.length)]
    const reuse = hours > 0
      ? random.weighted<ReuseCategory | undefined>([...reuseCategories, undefined], plan?.reuseWeights ?? [1, 1, 1, 1, 1])
      : undefined
    responses.push({
      id: `r-${invitation.id}`,
      period: frame.period,
      product: invitation.product,
      team: invitation.team,
      workType: invitation.workType,
      hours,
      effect,
      reuse,
      date: sessionDate(frame.period, invitation.week, Math.min(4, invitation.day + 1)),
      source: 'Random invitation',
      frameId: frame.id,
      invitationId: invitation.id,
      secondsToAnswer: random.int(11, 38),
    })
    return { ...invitation, status: 'Responded' }
  })
  return { invitations: updated, responses }
}

function seedFrame(usage: UsageRecord[], period: PeriodKey, createdAt: string, registered: StudyRecord[], prior: PriorInvitation[], firstPendingWeek?: number) {
  const sessions = synthesizeSessions(usage, period, defaultProducts)
  const draw = drawSample(sessions, {
    period,
    policy: defaultPolicy,
    policyVersion: policyLabel(defaultPolicy),
    seed: hashString(`frame|${period}`),
    frameId: `frame-${period.toLowerCase()}`,
    createdAt,
    exclusions: registered
      .filter((study) => study.pulseScope && study.preRegisteredAt && study.preRegisteredAt < createdAt)
      .map((study) => ({ claimId: study.id, claimName: study.name, scope: study.pulseScope! })),
    prior,
  })
  const simulated = simulateResponses(draw.frame, draw.invitations, firstPendingWeek)
  return {
    frame: { ...draw.frame, status: firstPendingWeek ? 'Open' as const : 'Closed' as const },
    invitations: simulated.invitations,
    responses: simulated.responses,
    routing: draw.routing,
  }
}

const criterion = (metric: string, unit: SuccessCriterion['unit'], minimumImprovementPct: number, guardrailMetric: string, guardrailMaxWorseningPct: number, minimumSamplePerArm: number): SuccessCriterion => ({
  metric, unit, direction: 'decrease', minimumImprovementPct, guardrailMetric, guardrailMaxWorseningPct, minimumSamplePerArm,
})

const prioritised = { status: 'Approved for testing' as const, prioritisedBy: 'Executive committee (demo)', prioritisedAt: '2026-06-10T09:00:00.000Z' }

export const seedHypotheses: Hypothesis[] = [
  {
    id: 1, useCase: 'Generate unit tests', owner: 'Digital Channels', nominatedBy: 'Digital Channels manager', product: 'GitHub Copilot', workType: 'Code and tests',
    expectedEffect: 'Shorter development cycle', outcome: 'Increase release throughput', evidence: 'Pull request and deployment timestamps', guardrail: 'Escaped defects must not increase',
    frequencyPerWeek: 3, peopleAffected: 84, expectedMinutesSaved: 20, studyEffort: 'Medium',
    successCriterion: criterion('Median pull request cycle time', 'days', 10, 'Escaped defects', 5, 30), nominatedAt: '2026-06-02T09:00:00.000Z', ...prioritised,
  },
  {
    id: 2, useCase: 'Summarise case material', owner: 'Customer Operations', nominatedBy: 'Customer Operations manager', product: 'Copilot Cowork', workType: 'Research and synthesis',
    expectedEffect: 'Less preparation time', outcome: 'Handle more cases per week', evidence: 'Case-management timestamps', guardrail: 'Case quality must remain stable',
    frequencyPerWeek: 5, peopleAffected: 126, expectedMinutesSaved: 25, studyEffort: 'Small',
    successCriterion: criterion('Preparation time per case', 'minutes per task', 15, 'Case quality score', 3, 40), nominatedAt: '2026-06-03T09:00:00.000Z', ...prioritised,
  },
  {
    id: 3, useCase: 'Draft sales proposals', owner: 'Enterprise Sales', nominatedBy: 'Enterprise Sales manager', product: 'Copilot Cowork', workType: 'Document drafting',
    expectedEffect: 'Faster response to clients', outcome: 'Improve proposal conversion', evidence: 'CRM opportunity data', guardrail: 'Win rate and discounting must not worsen',
    frequencyPerWeek: 2, peopleAffected: 30, expectedMinutesSaved: 45, studyEffort: 'Medium',
    successCriterion: criterion('Time to first proposal', 'days', 15, 'Win rate', 5, 20), nominatedAt: '2026-06-03T09:00:00.000Z', ...prioritised,
  },
  {
    id: 4, useCase: 'Accelerate code review', owner: 'Platform Engineering', nominatedBy: 'Platform Engineering manager', product: 'GitHub Copilot', workType: 'Code review',
    expectedEffect: 'Reduce review wait time', outcome: 'Deliver changes earlier', evidence: 'Pull request review timestamps', guardrail: 'Change failure rate must not rise',
    frequencyPerWeek: 4, peopleAffected: 40, expectedMinutesSaved: 15, studyEffort: 'Small',
    successCriterion: criterion('Review time per pull request', 'minutes per task', 15, 'Change failure rate', 5, 30), nominatedAt: '2026-06-04T09:00:00.000Z', ...prioritised,
  },
  {
    id: 5, useCase: 'Debug production issues', owner: 'Platform Engineering', nominatedBy: 'Platform Engineering manager', product: 'GitHub Copilot', workType: 'Debugging',
    expectedEffect: 'Faster diagnosis', outcome: 'Resolve defects sooner', evidence: 'Issue tracker timestamps', guardrail: 'Reopened defects must not rise',
    frequencyPerWeek: 3, peopleAffected: 40, expectedMinutesSaved: 30, studyEffort: 'Medium',
    successCriterion: criterion('Time per debugging task', 'minutes per task', 15, 'Reopened defects', 5, 30), nominatedAt: '2026-06-04T09:00:00.000Z', ...prioritised,
  },
  {
    id: 6, useCase: 'Reduce rework in data analysis', owner: 'Customer Operations', nominatedBy: 'Customer Operations manager', product: 'Copilot Cowork', workType: 'Data analysis',
    expectedEffect: 'Fewer corrections after review', outcome: 'Analysis right first time', evidence: 'Quality review log', guardrail: 'Turnaround time must not rise',
    frequencyPerWeek: 2, peopleAffected: 126, expectedMinutesSaved: 12, studyEffort: 'Small',
    successCriterion: criterion('Share of analyses needing rework', 'percent', 25, 'Turnaround time', 10, 30),
    status: 'Nominated', nominatedAt: '2026-09-18T09:00:00.000Z',
    sourceSignal: 'Pulse Q3 2026 · Copilot Cowork · Data analysis: more sampled tasks were slower than faster, mostly "More rework or lower quality"',
  },
  {
    id: 7, useCase: 'Draft incident reviews', owner: 'Digital Channels', nominatedBy: 'Digital Channels manager', product: 'GitHub Copilot', workType: 'Incident analysis',
    expectedEffect: 'Faster post-incident write-ups', outcome: 'Agree follow-up actions sooner', evidence: 'Incident management records', guardrail: 'Action quality score must not fall',
    frequencyPerWeek: 0.5, peopleAffected: 84, expectedMinutesSaved: 60, studyEffort: 'Small',
    successCriterion: criterion('Time to publish an incident review', 'hours per task', 20, 'Action quality score', 5, 12), nominatedAt: '2026-07-01T09:00:00.000Z', ...prioritised,
  },
]

function seedStudy(hypothesisId: number, id: string, name: string, preRegisteredAt: string, evidence: StudyEvidenceInput): StudyRecord {
  const hypothesis = seedHypotheses.find((candidate) => candidate.id === hypothesisId)!
  return recordStudyEvidence({ ...createStudyFromHypothesis(hypothesis, preRegisteredAt), id, name }, evidence, defaultPolicy)
}

function seedStudies(): StudyRecord[] {
  const developer = seedStudy(1, 'developer-delivery', 'Developer delivery cycle', '2026-06-12T09:00:00.000Z', {
    cohort: '84 engineers · matched teams', period: '2026-Q3', design: 'Matched groups', operationalSource: 'Pull request and deployment timestamps',
    control: { n: 180, mean: 5.2, sd: 3.1 }, treatment: { n: 210, mean: 4.3, sd: 2.8 }, guardrailChangePct: 2, progress: 100,
  })
  const proposed = submitFinancialReview(developer, {
    pillar: 'Improved Performance',
    grossValue: 84000,
    valuationFormula: '1,680 backlog hours delivered × $50 approved contribution per hour',
    valuationSource: 'Finance backlog valuation policy v1',
    valuationGrade: 'Modelled',
    confidence: 'Medium',
    overlapKey: 'digital-channels|delivery|2026-q3',
    policyVersion: policyLabel(defaultPolicy),
    assumptions: 'Released capacity went to committed backlog work and escaped defects held steady. Digital Channels code-and-test sessions are removed from the Pulse population.',
  }, 'Digital Channels manager', [], defaultPolicy, '2026-09-08T09:00:00.000Z')
  const approvedDeveloper = decideFinancialReview(proposed, 'Approved', {
    actor: 'Finance business partner (demo)', notes: 'Matched-team evidence, backlog reuse, and the contribution rate accepted.',
    evidenceChecked: true, guardrailsChecked: true, overlapChecked: true, riskOwner: '',
  }, [], '2026-09-12T09:00:00.000Z')

  return [
    approvedDeveloper,
    seedStudy(2, 'knowledge-preparation', 'Knowledge work preparation', '2026-06-12T09:00:00.000Z', {
      cohort: '126 case workers · before/after', period: '2026-Q3', design: 'Before/after', operationalSource: 'Case-management timestamps',
      control: { n: 60, mean: 95, sd: 28 }, treatment: { n: 66, mean: 77, sd: 30 }, guardrailChangePct: 1, progress: 100,
    }),
    seedStudy(3, 'sales-proposal', 'Sales proposal response', '2026-06-12T09:00:00.000Z', {
      cohort: '42 opportunities · staggered rollout', period: '2026-Q3', design: 'Staggered rollout', operationalSource: 'CRM proposal timestamps',
      control: { n: 20, mean: 6.4, sd: 2.5 }, treatment: { n: 22, mean: 4.3, sd: 2.2 }, guardrailChangePct: 8, progress: 100,
    }),
    seedStudy(5, 'debugging-trial', 'Debugging with AI assistance', '2026-06-15T09:00:00.000Z', {
      cohort: '70 debugging tasks · randomised', period: '2026-Q3', design: 'Randomised', operationalSource: 'Issue tracker timestamps',
      control: { n: 34, mean: 52, sd: 20 }, treatment: { n: 36, mean: 56, sd: 24 }, guardrailChangePct: 0, progress: 100,
    }),
    seedStudy(7, 'incident-reviews', 'Incident review drafting', '2026-07-03T09:00:00.000Z', {
      cohort: 'Incident reviews · randomised', period: '2026-Q3', design: 'Randomised', operationalSource: 'Incident management records',
      control: { n: 6, mean: 5.5, sd: 1.8 }, treatment: { n: 7, mean: 3.9, sd: 1.6 }, progress: 40,
    }),
  ]
}

const researchSpend = (period: PeriodKey, recordedAt: string) => withRecordedApproval<ValueClaim>({
  id: `external-research-spend-${period.toLowerCase()}`,
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
  period,
  baseline: '$12,500 per month',
  comparison: 'Three-month pre-adoption invoice baseline',
  operationalSource: 'Vendor invoices and purchase orders',
  valuationFormula: '($12,500 − $7,000) × 3 months',
  valuationSource: 'General ledger actuals',
  guardrail: 'Research quality and turnaround unchanged',
  overlapKey: `customer-operations|research-spend|${period.toLowerCase()}`,
}, { preparer: 'Customer Operations manager', approver: 'Finance business partner (demo)', policyVersion: 'policy-v1', recordedAt, notes: 'Invoice reduction reconciled to the general ledger (demo).' })

function seedClaims(): ValueClaim[] {
  return [
    researchSpend('2026-Q2', '2026-07-08T09:00:00.000Z'),
    researchSpend('2026-Q3', '2026-09-24T09:00:00.000Z'),
    withRecordedApproval<ValueClaim>({
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
      period: '2026-Q2',
      baseline: 'Severity-weighted incident rate',
      comparison: 'Matched releases with stable severity definitions',
      operationalSource: 'Incident and change-management records',
      valuationFormula: '4 severity-weighted incidents avoided × $8,000 expected loss',
      valuationSource: 'Risk committee expected-loss policy v2',
      guardrail: 'Change failure rate and review time monitored',
      overlapKey: 'platform|production-risk|2026-q2',
    }, { preparer: 'Platform Engineering manager', approver: 'Risk and finance review (demo)', policyVersion: 'policy-v1', recordedAt: '2026-07-02T09:00:00.000Z', notes: 'Expected-loss reduction accepted by the risk committee (demo).', riskOwner: 'Risk committee reference RC-114 (demo)' }),
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
      period: '2026-Q3',
      operationalSource: 'Documented customer interviews',
      guardrail: 'No revenue attributed before customer adoption',
      overlapKey: 'enterprise-sales|new-service|2026-q3',
    },
  ]
}

const seedDecisions: DecisionRecord[] = [
  {
    id: 'decision-2026-q2-platform', period: '2026-Q2', team: 'Platform Engineering', decision: 'Scale', suggested: 'Scale',
    rationale: 'Risk reduction validated with the risk committee. Extend AI-assisted reviews to all platform services.', decidedBy: 'CFO (demo)', decidedAt: '2026-07-10T09:00:00.000Z',
  },
  {
    id: 'decision-2026-q2-digital', period: '2026-Q2', team: 'Digital Channels', decision: 'Keep measuring', suggested: 'Keep measuring',
    rationale: 'The matched-team delivery study reports in Q3. Hold spend flat until it does.', decidedBy: 'CFO (demo)', decidedAt: '2026-07-10T09:00:00.000Z',
  },
]

function seedImports(usage: UsageRecord[]): ImportRecord[] {
  return Object.values(usageFiles).map((file, index) => {
    const rows = usage.filter((record) => record.source === file)
    return {
      id: `seed-import-${index + 1}`,
      name: file,
      rows: rows.length,
      date: '28 Sep 2026',
      status: 'Applied' as const,
      note: 'Aggregate team rows · no direct identifiers',
      periods: [...new Set(rows.map((record) => record.period))].sort(),
      totalCost: rows.reduce((sum, record) => sum + record.cost, 0),
    }
  })
}

export function createDemoData(): AppData {
  const usage = seedUsage()
  const studies = seedStudies()
  const q2 = seedFrame(usage, '2026-Q2', '2026-03-25T09:00:00.000Z', [], [])
  const q3 = seedFrame(usage, '2026-Q3', '2026-06-24T09:00:00.000Z', studies, priorInvitations(q2.invitations, q2.routing), FIRST_PENDING_WEEK)
  return {
    version: STATE_VERSION,
    products: defaultProducts.map((product) => ({ ...product, workTypes: [...product.workTypes] })),
    usage,
    changeCosts: {
      '2026-Q2': { implementation: 18000, enablement: 9000, operations: 6000 },
      '2026-Q3': { implementation: 6000, enablement: 5000, operations: 6000 },
    },
    policy: { ...defaultPolicy },
    policyHistory: [{ version: 1, changedAt: '2026-03-20T09:00:00.000Z', changedBy: 'CFO office (demo)', reason: 'Initial evidence, valuation, and sampling rules.', changes: ['Initial policy published'] }],
    hypotheses: seedHypotheses.map((hypothesis) => ({ ...hypothesis })),
    studies,
    claims: seedClaims(),
    frames: [q2.frame, q3.frame],
    invitations: [...q2.invitations, ...q3.invitations],
    routing: { ...q2.routing, ...q3.routing },
    responses: [...q3.responses, ...q2.responses],
    decisions: seedDecisions.map((decision) => ({ ...decision })),
    imports: seedImports(usage),
  }
}

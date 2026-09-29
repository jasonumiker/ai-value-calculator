import { confidenceWithinCap, defaultPolicy, designCap, policyLabel } from './policy'
import { baseStage, studyStatus } from './studies'
import {
  confidenceLevels,
  evidenceGrades,
  pillarLabels,
  type FinancialDecision,
  type FinancialEvidence,
  type FinancialProposal,
  type FinancialRealization,
  type FinancialReview,
  type FinancialReviewEvent,
  type Policy,
  type StudyRecord,
  type ValueClaim,
} from './types'

/** Snapshot of the evidence a valuation relies on; any later change invalidates the approval. */
export function financialEvidence(claim: ValueClaim): FinancialEvidence {
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
    design: study.design,
    control: study.control ? JSON.stringify(study.control) : undefined,
    treatment: study.treatment ? JSON.stringify(study.treatment) : undefined,
    guardrailChangePct: study.guardrailChangePct,
  }
}

export function sameEvidence(claim: ValueClaim, evidence: FinancialEvidence) {
  const current = financialEvidence(claim)
  return [...new Set([...Object.keys(current), ...Object.keys(evidence)])].every((key) => current[key] === evidence[key])
}

export function isFinanciallyApproved(claim: ValueClaim) {
  const review = claim.financialReview
  if (review?.status !== 'Approved' || !sameEvidence(claim, review.evidence)) return false
  const approval = review.history.findLast((event) => event.action === 'Approved')
  if (!approval?.actor.trim() || !approval.notes.trim()) return false
  const { proposal } = review
  if (claim.pillar !== proposal.pillar || claim.confidence !== proposal.confidence || claim.overlapKey !== proposal.overlapKey) return false
  const latest = review.history.at(-1)
  if (claim.stage === 'Realized') {
    const realization = claim.realization
    return !!realization && latest?.action === 'Realized' && claim.grossValue === realization.grossValue
      && claim.valuationFormula === realization.formula && claim.valuationSource === realization.source && claim.valuationGrade === 'Observed'
  }
  return claim.stage === 'Validated' && latest?.action === 'Approved' && claim.grossValue === proposal.grossValue
    && claim.valuationGrade === proposal.valuationGrade && claim.valuationFormula === proposal.valuationFormula
    && claim.valuationSource === proposal.valuationSource
}

function assertReviewableStudy(study: StudyRecord) {
  if (study.progress !== 100) throw new Error('Complete the study before requesting financial review.')
  const required = [study.cohort, study.period, study.metric, study.baseline, study.comparison, study.result, study.operationalSource, study.guardrail]
  if (!required.every((value) => value?.trim()) || study.result === 'Not measured yet') {
    throw new Error('Financial review requires a cohort, period, metric, both arms, a result, source, and guardrail.')
  }
  if (study.operationalGrade === 'Anecdotal') throw new Error('Anecdotal evidence alone is not eligible for financial approval.')
  const status = studyStatus(study)
  if (status !== 'Supported') throw new Error(`Only a supported hypothesis can be valued; this study is ${status.toLowerCase()}.`)
}

function assertNoOverlap(studyId: string, overlapKey: string, claims: ValueClaim[]) {
  const key = overlapKey.trim().toLowerCase()
  const duplicate = claims.find((claim) => claim.id !== studyId
    && (claim.financialReview?.status === 'Pending' || isFinanciallyApproved(claim))
    && (claim.financialReview?.proposal.overlapKey ?? claim.overlapKey).trim().toLowerCase() === key)
  if (duplicate) throw new Error(`This benefit scope is already reserved by "${duplicate.name}". Resolve the overlap first.`)
}

export function submitFinancialReview(study: StudyRecord, proposal: FinancialProposal, actor: string, claims: ValueClaim[], policy: Policy = defaultPolicy, recordedAt = new Date().toISOString()): StudyRecord {
  assertReviewableStudy(study)
  if (study.financialReview?.status === 'Pending' || study.financialReview?.status === 'Approved') {
    throw new Error('This study already has a proposed or approved valuation.')
  }
  if (!actor.trim() || ![proposal.valuationFormula, proposal.valuationSource, proposal.overlapKey, proposal.policyVersion, proposal.assumptions].every((value) => value.trim())) {
    throw new Error('Provide the preparer, valuation formula, source, benefit scope, policy version, and assumptions.')
  }
  if (!Number.isFinite(proposal.grossValue) || proposal.grossValue <= 0) throw new Error('Proposed gross value must be a positive, finite amount.')
  if (!evidenceGrades.slice(0, 3).includes(proposal.valuationGrade) || !confidenceLevels.includes(proposal.confidence) || !pillarLabels.includes(proposal.pillar)) {
    throw new Error('Choose valid valuation evidence, confidence, and a business-value pillar.')
  }
  const cap = designCap(policy, study.design)
  if (!confidenceWithinCap(proposal.confidence, cap.confidence)) {
    throw new Error(`${study.design} studies are capped at ${cap.confidence} confidence by ${policyLabel(policy)}.`)
  }
  if (proposal.overlapKey.endsWith('|unvalidated')) throw new Error('Replace the draft scope with a team, benefit mechanism, and period key.')
  assertNoOverlap(study.id, proposal.overlapKey, claims)
  const evidence = financialEvidence(study)
  const submitted: FinancialReviewEvent = { action: 'Submitted', actor: actor.trim(), recordedAt, notes: proposal.assumptions, proposal: { ...proposal }, evidence }
  return {
    ...study,
    stage: baseStage(study),
    approvedBy: undefined,
    realization: undefined,
    financialReview: { status: 'Pending', proposal: { ...proposal }, evidence, history: [...(study.financialReview?.history ?? []), submitted] },
  }
}

export function decideFinancialReview(study: StudyRecord, decision: 'Approved' | 'Rejected', input: FinancialDecision, claims: ValueClaim[], recordedAt = new Date().toISOString()): StudyRecord {
  const review = study.financialReview
  if (!review || review.status !== 'Pending') throw new Error('Only a proposed valuation can be decided.')
  if (!input.actor.trim() || !input.notes.trim()) throw new Error('Record the finance reviewer and decision rationale.')
  if (decision === 'Approved') {
    assertReviewableStudy(study)
    if (!sameEvidence(study, review.evidence)) throw new Error('Study evidence changed after submission. Return it for changes and resubmit.')
    if (!input.evidenceChecked || !input.guardrailsChecked || !input.overlapChecked) {
      throw new Error('Confirm attribution, guardrails, and claim/Pulse overlap checks before approval.')
    }
    if (review.proposal.pillar === 'Risk Mitigation' && !input.riskOwner.trim()) throw new Error('Risk mitigation requires a risk-owner sign-off reference.')
    assertNoOverlap(study.id, review.proposal.overlapKey, claims)
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
  if (decision === 'Rejected') return { ...study, stage: baseStage(study), financialReview: updatedReview }
  const { pillar, grossValue, valuationFormula, valuationSource, valuationGrade, confidence, overlapKey } = review.proposal
  return {
    ...study,
    pillar, grossValue, valuationFormula, valuationSource, valuationGrade, confidence, overlapKey,
    stage: 'Validated',
    approvedBy: input.actor.trim(),
    financialReview: updatedReview,
  }
}

export function recordFinancialRealization(study: StudyRecord, input: Omit<FinancialRealization, 'recordedAt'>, recordedAt = new Date().toISOString()): StudyRecord {
  if (study.stage !== 'Validated' || !isFinanciallyApproved(study)) throw new Error('Only an approved Validated claim can be reconciled as Realized.')
  if (!Number.isFinite(input.grossValue) || input.grossValue < 0) throw new Error('Realized gross value must be a non-negative, finite amount.')
  if (![input.formula, input.source, input.actor, input.notes].every((value) => value.trim())) {
    throw new Error('Provide the realized-value formula, reconciliation source, finance reviewer, and explanation of any variance.')
  }
  const realization: FinancialRealization = { ...input, recordedAt }
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

/** Builds an approval record for claims that arrive from outside the study workflow (demo seed only). */
export function withRecordedApproval<Claim extends ValueClaim>(claim: Claim, approval: { preparer: string; approver: string; policyVersion: string; recordedAt: string; notes: string; riskOwner?: string }): Claim {
  const proposal: FinancialProposal = {
    pillar: claim.pillar,
    grossValue: claim.grossValue,
    valuationFormula: claim.valuationFormula ?? '',
    valuationSource: claim.valuationSource ?? '',
    valuationGrade: claim.stage === 'Realized' ? 'Observed' : claim.valuationGrade ?? 'Modelled',
    confidence: claim.confidence,
    overlapKey: claim.overlapKey,
    policyVersion: approval.policyVersion,
    assumptions: approval.notes,
  }
  const evidence = financialEvidence(claim)
  const history: FinancialReviewEvent[] = [
    { action: 'Submitted', actor: approval.preparer, recordedAt: approval.recordedAt, notes: approval.notes, proposal, evidence },
    {
      action: 'Approved', actor: approval.approver, recordedAt: approval.recordedAt, notes: approval.notes,
      riskOwner: approval.riskOwner, checks: { evidenceChecked: true, guardrailsChecked: true, overlapChecked: true },
    },
  ]
  const realization = claim.stage === 'Realized'
    ? { grossValue: claim.grossValue, formula: proposal.valuationFormula, source: proposal.valuationSource, actor: approval.approver, notes: 'Reconciled to the general ledger (demo).', recordedAt: approval.recordedAt }
    : undefined
  if (realization) history.push({ action: 'Realized', actor: approval.approver, recordedAt: approval.recordedAt, notes: realization.notes, realization })
  return { ...claim, approvedBy: approval.approver, realization, financialReview: { status: 'Approved', proposal, evidence, history } }
}

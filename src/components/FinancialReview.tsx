import { useState, type FormEvent } from 'react'
import { Check, CircleDollarSign, X } from 'lucide-react'
import { decideFinancialReview, isFinanciallyApproved, recordFinancialRealization, submitFinancialReview } from '../domain/finance'
import { formatCurrency } from '../domain/format'
import { periodLabel } from '../domain/periods'
import { confidenceWithinCap, designCap, policyLabel } from '../domain/policy'
import { confidenceLevels, pillarLabels, type Confidence, type EvidenceGrade, type FinancialProposal, type PillarLabel, type Policy, type StudyRecord, type ValueClaim } from '../domain/types'
import { FormError } from './ui'
import { errorMessage } from './helpers'

type Mode = 'proposal' | 'decision' | 'history' | 'realization'

export function FinancialReview({ study, claims, policy, onSave }: { study: StudyRecord; claims: ValueClaim[]; policy: Policy; onSave: (study: StudyRecord) => void }) {
  const review = study.financialReview
  const proposal = review?.proposal
  const [mode, setMode] = useState<Mode>(review?.status === 'Pending' ? 'decision' : review?.status === 'Approved' ? 'history' : 'proposal')
  const [error, setError] = useState('')
  const cap = designCap(policy, study.design)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const field = (name: string) => String(form.get(name) ?? '').trim()
    try {
      if (mode === 'proposal') {
        const next: FinancialProposal = {
          pillar: field('pillar') as PillarLabel,
          grossValue: Number(form.get('grossValue')),
          valuationFormula: field('valuationFormula'),
          valuationSource: field('valuationSource'),
          valuationGrade: field('valuationGrade') as EvidenceGrade,
          confidence: field('confidence') as Confidence,
          overlapKey: field('overlapKey'),
          policyVersion: policyLabel(policy),
          assumptions: field('assumptions'),
        }
        onSave(submitFinancialReview(study, next, field('actor'), claims, policy))
      } else if (mode === 'decision') {
        const decision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'Rejected' ? 'Rejected' : 'Approved'
        onSave(decideFinancialReview(study, decision, {
          actor: field('actor'),
          notes: field('notes'),
          riskOwner: field('riskOwner'),
          evidenceChecked: form.has('evidenceChecked'),
          guardrailsChecked: form.has('guardrailsChecked'),
          overlapChecked: form.has('overlapChecked'),
        }, claims))
      } else if (mode === 'realization') {
        onSave(recordFinancialRealization(study, {
          grossValue: Number(form.get('grossValue')),
          formula: field('formula'),
          source: field('source'),
          actor: field('actor'),
          notes: field('notes'),
        }))
      }
    } catch (failure) {
      setError(errorMessage(failure, 'The financial review could not be saved.'))
    }
  }

  return (
    <div className="finance-content">
      <details className="finance-evidence">
        <summary>Study evidence</summary>
        <dl className="finance-values">
          <div><dt>Cohort</dt><dd>{study.cohort}</dd></div><div><dt>Period</dt><dd>{periodLabel(study.period)}</dd></div>
          <div><dt>Design</dt><dd>{study.design} · capped at {cap.grade}/{cap.confidence}</dd></div><div><dt>Metric</dt><dd>{study.metric}</dd></div>
          <div><dt>Without AI</dt><dd>{study.baseline}</dd></div><div><dt>With AI</dt><dd>{study.current}</dd></div>
          <div className="finance-wide"><dt>Result</dt><dd>{study.result}</dd></div>
          <div><dt>Operational source</dt><dd>{study.operationalSource}</dd></div><div><dt>Guardrail</dt><dd>{study.guardrail}</dd></div>
        </dl>
      </details>

      {proposal && mode !== 'proposal' && (
        <section className="finance-summary">
          <h3>{review?.status === 'Approved' ? 'Approved valuation' : 'Proposed valuation'}</h3>
          <dl className="finance-values">
            <div><dt>Proposed gross value</dt><dd className="finance-amount">{formatCurrency(proposal.grossValue)}</dd></div><div><dt>Value pillar</dt><dd>{proposal.pillar}</dd></div>
            <div><dt>Valuation evidence</dt><dd>{proposal.valuationGrade}</dd></div><div><dt>Claim confidence</dt><dd>{proposal.confidence}</dd></div>
            <div><dt>Policy version</dt><dd>{proposal.policyVersion}</dd></div><div><dt>Benefit scope key</dt><dd>{proposal.overlapKey}</dd></div>
            <div className="finance-wide"><dt>Valuation formula</dt><dd>{proposal.valuationFormula}</dd></div>
            <div className="finance-wide"><dt>Valuation source</dt><dd>{proposal.valuationSource}</dd></div>
            <div className="finance-wide"><dt>Attribution and valuation assumptions</dt><dd>{proposal.assumptions}</dd></div>
          </dl>
        </section>
      )}

      {mode === 'proposal' && (
        <form className="modal-form finance-form" onSubmit={submit}>
          <h3>{review?.status === 'Rejected' ? 'Revise valuation' : 'Propose a valuation'}</h3>
          <div className="form-row">
            <label>Prepared by<input name="actor" required placeholder="Process owner (demo)" /></label>
            <label>Business value pillar<select name="pillar" defaultValue={proposal?.pillar ?? study.pillar}>{pillarLabels.map((pillar) => <option key={pillar}>{pillar}</option>)}</select></label>
          </div>
          <div className="form-row">
            <label>Proposed gross value ($)<input name="grossValue" type="number" min="0.01" step="0.01" required defaultValue={proposal?.grossValue ?? (study.grossValue || '')} /></label>
            <label>Benefit scope key<input name="overlapKey" required defaultValue={proposal?.overlapKey ?? (study.overlapKey.endsWith('|unvalidated') ? '' : study.overlapKey)} placeholder="team|benefit-mechanism|period" /></label>
          </div>
          <label>Valuation formula<textarea name="valuationFormula" rows={2} required defaultValue={proposal?.valuationFormula ?? study.valuationFormula} placeholder="e.g. 240 reused backlog hours × $50 contribution per hour" /></label>
          <label>Valuation source<input name="valuationSource" required defaultValue={proposal?.valuationSource ?? study.valuationSource} /></label>
          <div className="form-row">
            <label>Valuation evidence<select name="valuationGrade" defaultValue={proposal?.valuationGrade ?? study.valuationGrade ?? 'Modelled'}><option>Observed</option><option>Estimated</option><option>Modelled</option></select></label>
            <label>Claim confidence
              <select name="confidence" defaultValue={proposal?.confidence ?? cap.confidence}>
                {confidenceLevels.map((level) => <option key={level} disabled={!confidenceWithinCap(level, cap.confidence)}>{level}</option>)}
              </select>
            </label>
          </div>
          <p className="design-cap">{study.design} studies are capped at {cap.confidence} confidence by {policyLabel(policy)}. Released time needs a reuse mechanism, not just hours × salary.</p>
          <label>Attribution and valuation assumptions<textarea name="assumptions" rows={3} required defaultValue={proposal?.assumptions} /></label>
          <FormError message={error} />
          <div className="modal-actions"><span>Excluded from Validated ROI until approved</span><button className="primary-button" type="submit"><CircleDollarSign size={16} /> Submit for review</button></div>
        </form>
      )}

      {mode === 'decision' && (
        <form className="modal-form finance-form" onSubmit={submit}>
          <h3>Finance decision</h3>
          <label>Finance reviewer<input name="actor" required placeholder="Finance owner (demo)" /></label>
          <label>Decision rationale<textarea name="notes" rows={3} required /></label>
          {proposal?.pillar === 'Risk Mitigation' && <label>Risk owner sign-off reference<input name="riskOwner" /></label>}
          <fieldset className="finance-checks"><legend>Approval checks</legend>
            <label><input type="checkbox" name="evidenceChecked" />Outcome attribution and valuation evidence reviewed</label>
            <label><input type="checkbox" name="guardrailsChecked" />Quality, risk, and workload guardrails accepted</label>
            <label><input type="checkbox" name="overlapChecked" />Duplicate claims and Pulse scope exclusion checked</label>
          </fieldset>
          <FormError message={error} />
          <div className="modal-actions finance-decision-actions">
            <button className="secondary-button" type="submit" name="decision" value="Rejected"><X size={16} /> Return for changes</button>
            <button className="primary-button" type="submit" name="decision" value="Approved"><Check size={16} /> Approve claim</button>
          </div>
        </form>
      )}

      {mode === 'history' && study.stage === 'Validated' && isFinanciallyApproved(study) && (
        <div className="finance-next"><button className="primary-button" onClick={() => setMode('realization')}><CircleDollarSign size={16} /> Record realization</button></div>
      )}

      {mode === 'realization' && (
        <form className="modal-form finance-form" onSubmit={submit}>
          <h3>Reconcile realized value</h3>
          <div className="form-row">
            <label>Realized gross value ($)<input name="grossValue" type="number" min="0" step="0.01" required defaultValue={study.grossValue} /></label>
            <label>Finance reviewer<input name="actor" required placeholder="Finance owner (demo)" /></label>
          </div>
          <label>Realized value formula<textarea name="formula" rows={2} required defaultValue={study.valuationFormula} /></label>
          <label>Reconciliation source<input name="source" required placeholder="Invoice, ledger, or realized contribution reference" /></label>
          <label>Reconciliation and variance rationale<textarea name="notes" rows={3} required /></label>
          <FormError message={error} />
          <div className="modal-actions"><span>Replaces the approved gross value; not an additional benefit</span><button className="primary-button" type="submit"><Check size={16} /> Confirm realization</button></div>
        </form>
      )}

      {study.realization && (
        <section className="finance-summary">
          <h3>Realized value</h3>
          <dl className="finance-values">
            <div><dt>Reconciled amount</dt><dd className="finance-amount">{formatCurrency(study.realization.grossValue)}</dd></div><div><dt>Finance reviewer</dt><dd>{study.realization.actor}</dd></div>
            <div className="finance-wide"><dt>Source and formula</dt><dd>{study.realization.source}<br />{study.realization.formula}</dd></div>
            <div className="finance-wide"><dt>Variance rationale</dt><dd>{study.realization.notes}</dd></div>
          </dl>
        </section>
      )}

      {review && (
        <details className="finance-history" open={mode === 'history' || review.status === 'Rejected'}>
          <summary>Review history ({review.history.length})</summary>
          <ol>{review.history.map((entry, index) => (
            <li key={`${entry.recordedAt}-${index}`}>
              <div><strong>{entry.action === 'Rejected' ? 'Returned for changes' : entry.action === 'Submitted' ? 'Proposed' : entry.action}</strong><time dateTime={entry.recordedAt}>{new Date(entry.recordedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })}</time></div>
              <p>{entry.actor}</p>
              <p>{entry.notes}</p>
              {entry.proposal && <p>{formatCurrency(entry.proposal.grossValue)} · {entry.proposal.policyVersion}<br />{entry.proposal.valuationFormula}</p>}
              {entry.riskOwner && <p>Risk sign-off: {entry.riskOwner}</p>}
              {entry.realization && <p>{formatCurrency(entry.realization.grossValue)} · {entry.realization.source}</p>}
            </li>
          ))}</ol>
        </details>
      )}
    </div>
  )
}

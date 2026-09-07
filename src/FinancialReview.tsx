import { useState, type FormEvent } from 'react'
import { Check, CircleDollarSign, ShieldCheck, X } from 'lucide-react'
import { decideFinancialReview, formatCurrency, isFinanciallyApproved, recordFinancialRealization, submitFinancialReview, type Confidence, type EvidenceGrade, type FinancialProposal, type PillarLabel, type StudyRecord, type ValueClaim } from './model'

export default function FinancialReview({ study, claims, onSave }: { study: StudyRecord; claims: ValueClaim[]; onSave: (study: StudyRecord) => void }) {
  const review = study.financialReview
  const proposal = review?.proposal
  const [mode, setMode] = useState<'proposal' | 'decision' | 'history' | 'realization'>(review?.status === 'Pending' ? 'decision' : review?.status === 'Approved' ? 'history' : 'proposal')
  const [error, setError] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const field = (name: string) => String(data.get(name) ?? '').trim()
    try {
      if (mode === 'proposal') {
        const next: FinancialProposal = {
          pillar: field('pillar') as PillarLabel,
          grossValue: Number(data.get('grossValue')),
          valuationFormula: field('valuationFormula'),
          valuationSource: field('valuationSource'),
          valuationGrade: field('valuationGrade') as EvidenceGrade,
          confidence: field('confidence') as Confidence,
          overlapKey: field('overlapKey'),
          policyVersion: field('policyVersion'),
          assumptions: field('assumptions'),
        }
        onSave(submitFinancialReview(study, next, field('actor'), claims))
      } else if (mode === 'decision') {
        const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'Rejected' ? 'Rejected' : 'Approved'
        onSave(decideFinancialReview(study, action, {
          actor: field('actor'), notes: field('notes'), riskOwner: field('riskOwner'),
          evidenceChecked: data.has('evidenceChecked'), guardrailsChecked: data.has('guardrailsChecked'), overlapChecked: data.has('overlapChecked'),
        }, claims))
      } else if (mode === 'realization') {
        onSave(recordFinancialRealization(study, {
          grossValue: Number(data.get('grossValue')), formula: field('formula'), source: field('source'), actor: field('actor'), notes: field('notes'),
        }))
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The financial review could not be saved.')
    }
  }

  return <div className="finance-content">
    <p className="finance-demo-note"><ShieldCheck size={17} /><span>Local demo sign-off. Reviewer identity is self-declared, not authenticated.</span></p>
    <details className="finance-evidence">
      <summary>Study evidence</summary>
      <dl className="finance-values">
        <div><dt>Cohort</dt><dd>{study.cohort}</dd></div><div><dt>Period</dt><dd>{study.period}</dd></div>
        <div><dt>Baseline</dt><dd>{study.baseline}</dd></div><div><dt>Comparison</dt><dd>{study.comparison}</dd></div>
        <div><dt>Metric</dt><dd>{study.metric}</dd></div><div><dt>Result</dt><dd>{study.result}</dd></div>
        <div><dt>Operational source</dt><dd>{study.operationalSource}</dd></div><div><dt>Guardrail</dt><dd>{study.guardrail}</dd></div>
      </dl>
    </details>

    {proposal && mode !== 'proposal' && <section className="finance-summary">
      <h3>{review?.status === 'Approved' ? 'Approved valuation' : 'Submitted valuation'}</h3>
      <dl className="finance-values">
        <div><dt>Proposed gross value</dt><dd className="finance-amount">{formatCurrency(proposal.grossValue)}</dd></div><div><dt>Value pillar</dt><dd>{proposal.pillar}</dd></div>
        <div><dt>Valuation evidence</dt><dd>{proposal.valuationGrade}</dd></div><div><dt>Claim confidence</dt><dd>{proposal.confidence}</dd></div>
        <div><dt>Policy version</dt><dd>{proposal.policyVersion}</dd></div><div><dt>Benefit scope key</dt><dd>{proposal.overlapKey}</dd></div>
        <div className="finance-wide"><dt>Valuation formula</dt><dd>{proposal.valuationFormula}</dd></div>
        <div className="finance-wide"><dt>Valuation source</dt><dd>{proposal.valuationSource}</dd></div>
        <div className="finance-wide"><dt>Attribution and valuation assumptions</dt><dd>{proposal.assumptions}</dd></div>
      </dl>
    </section>}

    {mode === 'proposal' && <form className="modal-form finance-form" onSubmit={submit}>
      <h3>{review?.status === 'Rejected' ? 'Revise valuation' : 'Prepare valuation'}</h3>
      <div className="form-row"><label>Prepared by<input name="actor" required placeholder="Process owner (demo)" /></label><label>Policy version<input name="policyVersion" required defaultValue={proposal?.policyVersion ?? 'demo-claim-policy-v1'} /></label></div>
      <div className="form-row"><label>Business value pillar<select name="pillar" defaultValue={proposal?.pillar ?? study.pillar}><option>Improved Performance</option><option>Cost Savings</option><option>Innovation / Transformation</option><option>Risk Mitigation</option></select></label><label>Proposed gross value ($)<input name="grossValue" type="number" min="0.01" step="0.01" required defaultValue={proposal?.grossValue ?? (study.grossValue || '')} /></label></div>
      <label>Valuation formula<textarea name="valuationFormula" rows={2} required defaultValue={proposal?.valuationFormula ?? study.valuationFormula} /></label>
      <label>Valuation source<input name="valuationSource" required defaultValue={proposal?.valuationSource ?? study.valuationSource} /></label>
      <div className="form-row"><label>Valuation evidence<select name="valuationGrade" defaultValue={proposal?.valuationGrade ?? study.valuationGrade ?? 'Modelled'}><option>Observed</option><option>Estimated</option><option>Modelled</option></select></label><label>Claim confidence<select name="confidence" defaultValue={proposal?.confidence ?? study.confidence}><option>High</option><option>Medium</option><option>Low</option></select></label></div>
      <label>Benefit scope key<input name="overlapKey" required defaultValue={proposal?.overlapKey ?? (study.overlapKey.endsWith('|unvalidated') ? '' : study.overlapKey)} placeholder="group|benefit-mechanism|period" /></label>
      <label>Attribution and valuation assumptions<textarea name="assumptions" rows={3} required defaultValue={proposal?.assumptions} /></label>
      {error && <p className="study-error" role="alert">{error}</p>}
      <div className="modal-actions"><span>Excluded from Validated ROI until approved</span><button className="primary-button" type="submit"><CircleDollarSign size={16} /> Submit for review</button></div>
    </form>}

    {mode === 'decision' && <form className="modal-form finance-form" onSubmit={submit}>
      <h3>Finance decision</h3>
      <label>Finance reviewer<input name="actor" required placeholder="Finance owner (demo)" /></label>
      <label>Decision rationale<textarea name="notes" rows={3} required /></label>
      {proposal?.pillar === 'Risk Mitigation' && <label>Risk owner sign-off reference<input name="riskOwner" /></label>}
      <fieldset className="finance-checks"><legend>Approval checks</legend>
        <label><input type="checkbox" name="evidenceChecked" />Outcome attribution and valuation evidence reviewed</label>
        <label><input type="checkbox" name="guardrailsChecked" />Quality, risk, and workload guardrails accepted</label>
        <label><input type="checkbox" name="overlapChecked" />Duplicate claims and Pulse scope exclusion checked</label>
      </fieldset>
      {error && <p className="study-error" role="alert">{error}</p>}
      <div className="modal-actions finance-decision-actions"><button className="secondary-button" type="submit" name="decision" value="Rejected"><X size={16} /> Return for changes</button><button className="primary-button" type="submit" name="decision" value="Approved"><Check size={16} /> Approve claim</button></div>
    </form>}

    {mode === 'history' && study.stage === 'Validated' && isFinanciallyApproved(study) && <div className="finance-next"><button className="primary-button" onClick={() => setMode('realization')}><CircleDollarSign size={16} /> Record realization</button></div>}

    {mode === 'realization' && <form className="modal-form finance-form" onSubmit={submit}>
      <h3>Reconcile realized value</h3>
      <div className="form-row"><label>Realized gross value ($)<input name="grossValue" type="number" min="0" step="0.01" required defaultValue={study.grossValue} /></label><label>Finance reviewer<input name="actor" required placeholder="Finance owner (demo)" /></label></div>
      <label>Realized value formula<textarea name="formula" rows={2} required defaultValue={study.valuationFormula} /></label>
      <label>Reconciliation source<input name="source" required placeholder="Invoice, ledger, or realized contribution reference" /></label>
      <label>Reconciliation and variance rationale<textarea name="notes" rows={3} required /></label>
      {error && <p className="study-error" role="alert">{error}</p>}
      <div className="modal-actions"><span>Replaces the approved gross value; not an additional benefit</span><button className="primary-button" type="submit"><Check size={16} /> Confirm realization</button></div>
    </form>}

    {study.realization && <section className="finance-summary"><h3>Realized value</h3><dl className="finance-values"><div><dt>Reconciled amount</dt><dd className="finance-amount">{formatCurrency(study.realization.grossValue)}</dd></div><div><dt>Finance reviewer</dt><dd>{study.realization.actor}</dd></div><div className="finance-wide"><dt>Source and formula</dt><dd>{study.realization.source}<br />{study.realization.formula}</dd></div><div className="finance-wide"><dt>Variance rationale</dt><dd>{study.realization.notes}</dd></div></dl></section>}

    {review && <details className="finance-history" open={mode === 'history' || review.status === 'Rejected'}><summary>Review history ({review.history.length})</summary><ol>{review.history.map((entry, index) => <li key={`${entry.recordedAt}-${index}`}><div><strong>{entry.action === 'Rejected' ? 'Returned for changes' : entry.action}</strong><time dateTime={entry.recordedAt}>{new Date(entry.recordedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</time></div><p>{entry.actor}</p><p>{entry.notes}</p>{entry.proposal && <p>{formatCurrency(entry.proposal.grossValue)} · {entry.proposal.policyVersion}<br />{entry.proposal.valuationFormula}<br />{entry.proposal.valuationSource}</p>}{entry.riskOwner && <p>Risk sign-off: {entry.riskOwner}</p>}{entry.realization && <p>{formatCurrency(entry.realization.grossValue)} · {entry.realization.source}</p>}</li>)}</ol></details>}
  </div>
}
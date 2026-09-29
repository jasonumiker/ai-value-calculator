import { ArrowRight, CircleDollarSign, FileSpreadsheet, FlaskConical, Lightbulb, Lock } from 'lucide-react'
import { isFinanciallyApproved } from '../domain/finance'
import { formatCurrency } from '../domain/format'
import { criterionSummary } from '../domain/hypotheses'
import { periodLabel } from '../domain/periods'
import { designCap } from '../domain/policy'
import { analyzeStudy, defaultCriterion, formatMeasure, studyStatus } from '../domain/studies'
import type { Hypothesis, Policy, ProductDefinition, StudyRecord } from '../domain/types'
import { EffectInterval } from './charts'
import { ProductChip, StageBadge, VerdictBadge } from './ui'

function financeStatus(study: StudyRecord) {
  const review = study.financialReview?.status
  if (review === 'Pending') return { label: 'Valuation proposed · awaiting finance', tone: 'pending' }
  if (review === 'Rejected') return { label: 'Valuation returned for changes', tone: 'rejected' }
  if (isFinanciallyApproved(study)) {
    return study.stage === 'Realized'
      ? { label: `Realized · ${formatCurrency(study.grossValue)} reconciled`, tone: 'approved' }
      : { label: `Approved · ${formatCurrency(study.grossValue)} gross`, tone: 'approved' }
  }
  const status = studyStatus(study)
  if (status === 'Supported') return { label: 'Supported · awaiting valuation', tone: 'awaiting' }
  if (status === 'Not supported' || status === 'Inconclusive') return { label: 'No financial value claimed', tone: 'none' }
  return { label: 'Not yet eligible for valuation', tone: 'none' }
}

export function StudyCard({ study, hypothesis, policy, products, onViewHypothesis, onEdit, onReview }: {
  study: StudyRecord
  hypothesis?: Hypothesis
  policy: Policy
  products: ProductDefinition[]
  onViewHypothesis: (hypothesisId: number) => void
  onEdit: () => void
  onReview: () => void
}) {
  const analysis = analyzeStudy(study)
  const status = studyStatus(study)
  const criterion = study.successCriterion ?? defaultCriterion
  const unit = study.metricUnit ?? criterion.unit
  const cap = designCap(policy, study.design)
  const review = study.financialReview?.status
  const finance = financeStatus(study)
  const titleId = `study-title-${study.id}`
  const locked = review === 'Pending' || review === 'Approved'
  const canValue = status === 'Supported' && !locked
  return (
    <article className="study-card" aria-labelledby={titleId}>
      <div className="study-heading">
        <div className="study-icon"><FlaskConical size={20} /></div>
        <div><ProductChip product={study.product} products={products} detail={study.workType} /><h3 id={titleId}>{study.name}</h3></div>
        <div className="study-badges"><VerdictBadge status={status} /><StageBadge stage={study.stage} /></div>
      </div>
      <div className="study-origin">
        <span>Originating hypothesis</span>
        {hypothesis ? <button className="text-button" onClick={() => onViewHypothesis(hypothesis.id)}><Lightbulb size={14} />{hypothesis.useCase}<ArrowRight size={14} /></button> : <strong>Registered outside the hypothesis workflow</strong>}
      </div>
      <div className="study-design">
        <span><strong>{study.design}</strong> · {study.cohort || 'Cohort not set'} · {periodLabel(study.period)}</span>
        <span className="cap-note">Policy cap: {cap.grade} evidence, {cap.confidence} confidence</span>
      </div>
      <div className="criterion-row"><Lock size={13} /><div><span>Pre-registered success criterion</span><strong>{study.successCriterion ? criterionSummary({ successCriterion: study.successCriterion }) : 'No criterion registered'}</strong></div></div>
      {study.control && study.treatment ? (
        <div className="study-arms">
          <table>
            <thead><tr><th>{study.metric}</th><th>n</th><th>Mean</th><th>Std dev</th></tr></thead>
            <tbody>
              <tr><td>Without AI</td><td>{study.control.n}</td><td>{formatMeasure(study.control.mean, unit)}</td><td>{formatMeasure(study.control.sd, unit)}</td></tr>
              <tr><td>With AI</td><td>{study.treatment.n}</td><td>{formatMeasure(study.treatment.mean, unit)}</td><td>{formatMeasure(study.treatment.sd, unit)}</td></tr>
            </tbody>
          </table>
          {analysis && <EffectInterval analysis={analysis} threshold={criterion.minimumImprovementPct / 100} />}
          <p className="study-result-line"><strong>{study.result}</strong>{study.guardrailChangePct !== undefined && <span className={analysis?.guardrailBreached ? 'guardrail-breach' : ''}> · {criterion.guardrailMetric} {study.guardrailChangePct > 0 ? '+' : ''}{study.guardrailChangePct}% (limit {criterion.guardrailMaxWorseningPct}%)</span>}</p>
          {analysis && <p className="verdict-reason">{analysis.reasons[0]}</p>}
        </div>
      ) : <p className="no-arms">No measurements recorded yet.</p>}
      <div className="study-progress"><div><i style={{ width: `${study.progress}%` }} /></div><span>{study.progress === 100 ? 'Study complete' : `${study.progress}% of data collected`}</span></div>
      <div className={`study-finance ${finance.tone}`}><CircleDollarSign size={14} />{finance.label}</div>
      <div className="study-actions">
        {!locked && <button className="secondary-button" onClick={onEdit}><FileSpreadsheet size={15} /> Record evidence</button>}
        {(canValue || locked || review === 'Rejected') && (
          <button className={review === 'Pending' ? 'primary-button' : 'secondary-button'} onClick={onReview}>
            <CircleDollarSign size={15} />{review === 'Pending' ? 'Review valuation' : review === 'Approved' ? 'View approval' : 'Propose valuation'}
          </button>
        )}
      </div>
    </article>
  )
}

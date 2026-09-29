import { ArrowRight, Check, FlaskConical, Lock, PauseCircle, ShieldCheck, Target, Users } from 'lucide-react'
import { formatCurrency, formatNumber } from '../domain/format'
import { criterionSummary, hypothesisProgress, sizeHypothesis } from '../domain/hypotheses'
import type { Hypothesis, Persona, Policy, ProductDefinition, StudyRecord } from '../domain/types'
import { ProductChip, StageBadge, VerdictBadge } from './ui'

export function HypothesisCard({ hypothesis, rank, studies, policy, products, persona, onPrioritise, onStartStudy, onViewStudy }: {
  hypothesis: Hypothesis
  rank?: number
  studies: StudyRecord[]
  policy: Policy
  products: ProductDefinition[]
  persona: Persona
  onPrioritise: (status: 'Approved for testing' | 'Parked') => void
  onStartStudy: () => void
  onViewStudy: (studyId: string) => void
}) {
  const study = studies.find((record) => record.hypothesisId === hypothesis.id)
  const progress = hypothesisProgress(hypothesis, studies)
  const sizing = sizeHypothesis(hypothesis, policy)
  const titleId = `hypothesis-title-${hypothesis.id}`
  return (
    <article className="hypothesis-card" aria-labelledby={titleId}>
      <div className="hypothesis-top">
        {rank !== undefined && <span className="rank-badge" title="Priority rank: value if true ÷ study effort">#{rank}</span>}
        <ProductChip product={hypothesis.product} products={products} detail={hypothesis.workType} />
        <VerdictBadge status={progress} />
      </div>
      <h3 id={titleId}>{hypothesis.useCase}</h3>
      <p className="owner"><Users size={14} />{hypothesis.owner} · nominated by {hypothesis.nominatedBy}</p>
      <div className="sizing-row">
        <div><span>How often</span><strong>{hypothesis.frequencyPerWeek}×/week × {hypothesis.peopleAffected} people</strong></div>
        <div><span>Expected saving</span><strong>{hypothesis.expectedMinutesSaved} min each</strong></div>
        <div><span>Value if true</span><strong>{formatCurrency(sizing.valueIfTrue)}/qtr</strong><small>{formatNumber(sizing.hoursPerQuarter)} h · {hypothesis.studyEffort} study</small></div>
      </div>
      <div className="hypothesis-flow"><div><span>Expected work effect</span><strong>{hypothesis.expectedEffect}</strong></div><ArrowRight size={16} /><div><span>Operational outcome</span><strong>{hypothesis.outcome}</strong></div></div>
      <div className="criterion-row"><Lock size={13} /><div><span>Success criterion{study?.preRegisteredAt ? ' · locked' : ''}</span><strong>{criterionSummary(hypothesis)}</strong></div></div>
      <div className="guardrail-row"><ShieldCheck size={14} /><div><span>Guardrail</span><strong>{hypothesis.guardrail}</strong></div></div>
      {hypothesis.sourceSignal && <p className="source-signal"><Target size={13} />{hypothesis.sourceSignal}</p>}
      {study && <div className="linked-study"><span>Study</span><strong>{study.name}</strong><StageBadge stage={study.stage} /></div>}
      <div className="card-footer">
        <span className="card-meta">{hypothesis.prioritisedBy ? `${hypothesis.status === 'Parked' ? 'Parked' : 'Prioritised'} by ${hypothesis.prioritisedBy}` : 'Awaiting management prioritisation'}</span>
        <div className="card-actions">
          {persona === 'executive' && hypothesis.status === 'Nominated' && <>
            <button onClick={() => onPrioritise('Parked')}><PauseCircle size={14} /> Park</button>
            <button onClick={() => onPrioritise('Approved for testing')}><Check size={14} /> Approve for testing</button>
          </>}
          {persona === 'executive' && hypothesis.status === 'Approved for testing' && !study && <button onClick={() => onPrioritise('Parked')}><PauseCircle size={14} /> Park</button>}
          {persona !== 'executive' && hypothesis.status === 'Approved for testing' && !study && <button onClick={onStartStudy}><FlaskConical size={14} /> Start study <ArrowRight size={14} /></button>}
          {study && <button onClick={() => onViewStudy(study.id)}><FlaskConical size={14} /> View study <ArrowRight size={14} /></button>}
        </div>
      </div>
    </article>
  )
}

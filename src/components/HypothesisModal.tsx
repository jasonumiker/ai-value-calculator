import { useState, type FormEvent } from 'react'
import { ArrowRight, Target } from 'lucide-react'
import { formatCurrency, formatNumber } from '../domain/format'
import { MAX_ACTIVE_NOMINATIONS, activeNominations, sizeHypothesis, type HypothesisInput } from '../domain/hypotheses'
import { workTypesFor } from '../domain/products'
import { metricUnits, type AppData, type MetricUnit, type StudyEffort } from '../domain/types'
import { FormError, ModalShell } from './ui'
import { errorMessage } from './helpers'

export type HypothesisDraft = Partial<Omit<HypothesisInput, 'successCriterion'>> & { successCriterion?: Partial<HypothesisInput['successCriterion']> }

export function HypothesisModal({ data, teams, defaultTeam, draft, onClose, onSubmit }: {
  data: AppData
  teams: string[]
  defaultTeam: string
  draft?: HypothesisDraft
  onClose: () => void
  onSubmit: (input: HypothesisInput) => void
}) {
  const [team, setTeam] = useState(draft?.owner ?? defaultTeam)
  const [product, setProduct] = useState(draft?.product ?? data.products[0]?.name ?? '')
  const [sizing, setSizing] = useState({
    frequencyPerWeek: draft?.frequencyPerWeek ?? 2,
    peopleAffected: draft?.peopleAffected ?? 20,
    expectedMinutesSaved: draft?.expectedMinutesSaved ?? 15,
    studyEffort: (draft?.studyEffort ?? 'Small') as StudyEffort,
  })
  const [error, setError] = useState('')
  const nominatedBy = `${team} manager`
  const used = activeNominations(data.hypotheses, nominatedBy, data.studies)
  const preview = sizeHypothesis(sizing, data.policy)
  const workTypes = workTypesFor(data.products, product)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? '').trim()
    const number = (name: string) => Number(form.get(name))
    try {
      onSubmit({
        useCase: text('useCase'),
        owner: team,
        nominatedBy,
        product,
        workType: text('workType') || undefined,
        expectedEffect: text('expectedEffect'),
        outcome: text('outcome'),
        evidence: text('evidence'),
        guardrail: text('guardrail'),
        frequencyPerWeek: sizing.frequencyPerWeek,
        peopleAffected: sizing.peopleAffected,
        expectedMinutesSaved: sizing.expectedMinutesSaved,
        studyEffort: sizing.studyEffort,
        sourceSignal: draft?.sourceSignal,
        successCriterion: {
          metric: text('metric'),
          unit: text('unit') as MetricUnit,
          direction: text('direction') === 'increase' ? 'increase' : 'decrease',
          minimumImprovementPct: number('minimumImprovementPct'),
          guardrailMetric: text('guardrailMetric'),
          guardrailMaxWorseningPct: number('guardrailMaxWorseningPct'),
          minimumSamplePerArm: number('minimumSamplePerArm'),
        },
      })
    } catch (failure) {
      setError(errorMessage(failure, 'The hypothesis could not be saved.'))
    }
  }

  const criterion = draft?.successCriterion
  return (
    <ModalShell eyebrow="Nominate a value hypothesis" title="What happens often, and how much could AI improve it?" onClose={onClose} className="wide-modal">
      <form onSubmit={submit} className="modal-form">
        {draft?.sourceSignal && <p className="source-signal"><Target size={14} />From a Pulse signal: {draft.sourceSignal}</p>}
        <label>AI-assisted use case<input name="useCase" required defaultValue={draft?.useCase} placeholder="e.g. Generate unit tests" /></label>
        <div className="form-row three">
          <label>Owning team
            <select name="owner" value={team} onChange={(event) => setTeam(event.target.value)}>
              {[...new Set([...teams, team])].map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label>Product
            <select name="product" value={product} onChange={(event) => setProduct(event.target.value)}>
              {data.products.map((option) => <option key={option.name}>{option.name}</option>)}
            </select>
          </label>
          <label>Work type
            <select name="workType" defaultValue={draft?.workType ?? ''} key={product}>
              <option value="">Not specific to one work type</option>
              {workTypes.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>Expected work effect<input name="expectedEffect" required defaultValue={draft?.expectedEffect} placeholder="e.g. Shorter development cycle" /></label>
          <label>Observable operational outcome<input name="outcome" required defaultValue={draft?.outcome} placeholder="e.g. Increase release throughput" /></label>
        </div>
        <div className="form-row">
          <label>Operational evidence source<input name="evidence" required defaultValue={draft?.evidence} placeholder="e.g. Pull request timestamps" /></label>
          <label>Quality, risk, or workload guardrail<input name="guardrail" required defaultValue={draft?.guardrail} placeholder="e.g. Escaped defects must not increase" /></label>
        </div>

        <fieldset className="form-section">
          <legend>Size it: happens X often, with Y improvement</legend>
          <div className="form-row four">
            <label>Times per person per week<input type="number" min="0.1" step="0.1" required value={sizing.frequencyPerWeek} onChange={(event) => setSizing({ ...sizing, frequencyPerWeek: event.target.valueAsNumber })} /></label>
            <label>People who do it<input type="number" min="1" step="1" required value={sizing.peopleAffected} onChange={(event) => setSizing({ ...sizing, peopleAffected: event.target.valueAsNumber })} /></label>
            <label>Minutes saved each time<input type="number" min="0" step="1" required value={sizing.expectedMinutesSaved} onChange={(event) => setSizing({ ...sizing, expectedMinutesSaved: event.target.valueAsNumber })} /></label>
            <label>Study effort
              <select value={sizing.studyEffort} onChange={(event) => setSizing({ ...sizing, studyEffort: event.target.value as StudyEffort })}>
                <option>Small</option><option>Medium</option><option>Large</option>
              </select>
            </label>
          </div>
          <p className="sizing-preview">
            If true: <strong>{Number.isFinite(preview.hoursPerQuarter) ? formatNumber(preview.hoursPerQuarter) : '—'} hours per quarter</strong>, worth about
            <strong> {Number.isFinite(preview.valueIfTrue) ? formatCurrency(preview.valueIfTrue) : '—'}</strong> at the CFO's ${data.policy.contributionValuePerHour}/h rate and {Math.round(data.policy.defaultCapacityRealization * 100)}% reuse.
          </p>
        </fieldset>

        <fieldset className="form-section">
          <legend>Pre-register success (locked when the study starts)</legend>
          <div className="form-row three">
            <label>Primary metric<input name="metric" required defaultValue={criterion?.metric} placeholder="e.g. Review time per pull request" /></label>
            <label>Unit
              <select name="unit" defaultValue={criterion?.unit ?? 'minutes per task'}>{metricUnits.map((unit) => <option key={unit}>{unit}</option>)}</select>
            </label>
            <label>Better means
              <select name="direction" defaultValue={criterion?.direction ?? 'decrease'}><option value="decrease">Lower</option><option value="increase">Higher</option></select>
            </label>
          </div>
          <div className="form-row four">
            <label>Minimum improvement (%)<input name="minimumImprovementPct" type="number" min="1" step="1" required defaultValue={criterion?.minimumImprovementPct ?? 15} /></label>
            <label>Guardrail metric<input name="guardrailMetric" required defaultValue={criterion?.guardrailMetric} placeholder="e.g. Change failure rate" /></label>
            <label>Guardrail may worsen by (%)<input name="guardrailMaxWorseningPct" type="number" min="0" step="1" required defaultValue={criterion?.guardrailMaxWorseningPct ?? 5} /></label>
            <label>Minimum per group<input name="minimumSamplePerArm" type="number" min="2" step="1" required defaultValue={criterion?.minimumSamplePerArm ?? 20} /></label>
          </div>
        </fieldset>
        <FormError message={error} />
        <div className="modal-actions">
          <span className={used >= MAX_ACTIVE_NOMINATIONS ? 'limit-reached' : ''}>{nominatedBy}: {used} of {MAX_ACTIVE_NOMINATIONS} open nominations</span>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit">Nominate hypothesis <ArrowRight size={16} /></button>
        </div>
      </form>
    </ModalShell>
  )
}

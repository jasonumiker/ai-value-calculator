import { useState, type FormEvent } from 'react'
import { Check, Lock } from 'lucide-react'
import { periodLabel } from '../domain/periods'
import { designCap, designDescriptions } from '../domain/policy'
import { analyzeStudy, defaultCriterion, type StudyEvidenceInput } from '../domain/studies'
import { studyDesigns, type ArmSummary, type PeriodKey, type Policy, type StudyDesign, type StudyRecord } from '../domain/types'
import { EffectInterval } from './charts'
import { FormError, ModalShell, VerdictBadge } from './ui'
import { errorMessage } from './helpers'

type ArmFields = { n: string; mean: string; sd: string }
const toFields = (arm?: ArmSummary): ArmFields => ({ n: arm ? String(arm.n) : '', mean: arm ? String(arm.mean) : '', sd: arm ? String(arm.sd) : '' })
const toArm = (fields: ArmFields): ArmSummary | undefined => {
  if (!fields.n.trim() && !fields.mean.trim() && !fields.sd.trim()) return undefined
  const parse = (value: string) => (value.trim() === '' ? Number.NaN : Number(value))
  return { n: parse(fields.n), mean: parse(fields.mean), sd: parse(fields.sd) }
}

export function StudyEvidenceModal({ study, policy, periods, onClose, onSave }: {
  study: StudyRecord
  policy: Policy
  periods: PeriodKey[]
  onClose: () => void
  onSave: (input: StudyEvidenceInput) => void
}) {
  const criterion = study.successCriterion ?? defaultCriterion
  const [design, setDesign] = useState<StudyDesign>(study.design)
  const [control, setControl] = useState(toFields(study.control))
  const [treatment, setTreatment] = useState(toFields(study.treatment))
  const [guardrail, setGuardrail] = useState(study.guardrailChangePct === undefined ? '' : String(study.guardrailChangePct))
  const [progress, setProgress] = useState(String(study.progress))
  const [error, setError] = useState('')
  const cap = designCap(policy, design)
  const preview = analyzeStudy({
    control: toArm(control),
    treatment: toArm(treatment),
    successCriterion: criterion,
    guardrailChangePct: guardrail === '' ? undefined : Number(guardrail),
    progress: Number(progress),
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      onSave({
        cohort: String(form.get('cohort') ?? ''),
        period: String(form.get('period') ?? ''),
        design,
        operationalSource: String(form.get('operationalSource') ?? ''),
        control: toArm(control),
        treatment: toArm(treatment),
        guardrailChangePct: guardrail === '' ? undefined : Number(guardrail),
        progress: Number(progress),
      })
    } catch (failure) {
      setError(errorMessage(failure, 'The evidence could not be saved.'))
    }
  }

  const armInputs = (label: string, fields: ArmFields, update: (fields: ArmFields) => void) => (
    <fieldset className="arm-fields">
      <legend>{label}</legend>
      <label>Observations<input type="number" min="0" step="1" aria-label={`${label} observations`} value={fields.n} onChange={(event) => update({ ...fields, n: event.target.value })} /></label>
      <label>Mean<input type="number" step="any" aria-label={`${label} mean`} value={fields.mean} onChange={(event) => update({ ...fields, mean: event.target.value })} /></label>
      <label>Std dev<input type="number" min="0" step="any" required={!!(fields.n || fields.mean)} aria-label={`${label} standard deviation`} value={fields.sd} onChange={(event) => update({ ...fields, sd: event.target.value })} /></label>
    </fieldset>
  )

  return (
    <ModalShell eyebrow={study.name} title="Record study evidence" onClose={onClose} className="wide-modal">
      <form onSubmit={submit} className="modal-form">
        <div className="preregistered">
          <Lock size={14} />
          <div>
            <strong>Pre-registered{study.preRegisteredAt ? ` ${new Date(study.preRegisteredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''} · locked</strong>
            <span>Success if {criterion.metric} ({criterion.unit}) is at least {criterion.minimumImprovementPct}% {criterion.direction === 'decrease' ? 'lower' : 'higher'} with AI, {criterion.guardrailMetric} worsens by no more than {criterion.guardrailMaxWorseningPct}%, and each group has at least {criterion.minimumSamplePerArm} observations.</span>
          </div>
        </div>
        <div className="form-row">
          <label>Study cohort<input name="cohort" required defaultValue={study.cohort} placeholder="e.g. 40 engineers · randomised tasks" /></label>
          <label>Study period
            <select name="period" defaultValue={study.period || periods[periods.length - 1]}>
              {periods.map((period) => <option key={period} value={period}>{periodLabel(period)}</option>)}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>Study design
            <select name="design" value={design} onChange={(event) => setDesign(event.target.value as StudyDesign)}>
              {studyDesigns.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label>Operational evidence source<input name="operationalSource" required defaultValue={study.operationalSource} /></label>
        </div>
        <p className="design-cap">{designDescriptions[design]}. Policy caps this design at <strong>{cap.grade}</strong> evidence and <strong>{cap.confidence}</strong> confidence.</p>
        <div className="arm-grid">
          {armInputs('Without AI', control, setControl)}
          {armInputs('With AI', treatment, setTreatment)}
        </div>
        <div className="form-row">
          <label>Guardrail change (% worse; negative if better)<input type="number" step="any" value={guardrail} onChange={(event) => setGuardrail(event.target.value)} aria-label="Guardrail change (% worse)" /></label>
          <label>Study progress (%)<input type="number" min="0" max="100" step="1" required value={progress} onChange={(event) => setProgress(event.target.value)} /></label>
        </div>
        {preview && (
          <div className="verdict-preview">
            <div className="verdict-preview-head"><span>Preview</span><VerdictBadge status={preview.verdict} /></div>
            <EffectInterval analysis={preview} threshold={criterion.minimumImprovementPct / 100} />
            <p>{preview.reasons[0]}</p>
          </div>
        )}
        <FormError message={error} />
        <div className="modal-actions">
          <span>Null and negative results are valid findings</span>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit"><Check size={16} /> Save evidence</button>
        </div>
      </form>
    </ModalShell>
  )
}

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { pulseEffectOptions } from '../domain/pulse'
import { MAX_SURVEY_HOURS, type SurveyAnswer } from '../domain/survey'
import { reuseCategories, type ReuseCategory } from '../domain/types'
import { FormError } from './ui'

export function SurveyForm({ onSubmit, submitLabel, secondary, error, children, idPrefix = 'pulse' }: {
  onSubmit: (answer: SurveyAnswer, form: FormData) => void
  submitLabel: string
  secondary?: { label: string; onClick: () => void }
  error?: string
  children?: ReactNode
  idPrefix?: string
}) {
  const startedAt = useRef(0)
  const [hours, setHours] = useState<number | null>(0)
  const hoursInput = useRef<HTMLInputElement>(null)
  const displayed = hours ?? 0
  const position = (displayed + MAX_SURVEY_HOURS) / (2 * MAX_SURVEY_HOURS) * 100
  const [start, end] = [Math.min(50, position), Math.max(50, position)]
  const color = displayed < 0 ? 'var(--orange)' : 'var(--green)'
  const absolute = Math.abs(displayed)
  const description = hours === null ? 'Enter an amount' : displayed === 0 ? 'No change in task time'
    : `${absolute.toLocaleString('en-US', { maximumFractionDigits: 2 })} hour${absolute === 1 ? '' : 's'} ${displayed < 0 ? 'slower' : 'faster'}`

  const markStarted = () => {
    if (startedAt.current === 0) startedAt.current = performance.now()
  }
  const clamp = (value: number) => Math.max(-MAX_SURVEY_HOURS, Math.min(MAX_SURVEY_HOURS, value))
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const elapsed = startedAt.current === 0 ? 20 : (performance.now() - startedAt.current) / 1000
    onSubmit({
      hours: clamp(Number(form.get('timeImpact')) || 0),
      effect: String(form.get('effect') ?? ''),
      reuse: (String(form.get('reuse') ?? '') || undefined) as ReuseCategory | undefined,
      secondsToAnswer: Math.min(600, Math.max(1, elapsed)),
    }, form)
  }

  return (
    <form onSubmit={submit} onFocusCapture={markStarted} onPointerDownCapture={markStarted} className="modal-form survey-form">
      {children}
      <fieldset className="pulse-time-field">
        <legend>Compared with your usual approach, how did task time change?</legend>
        <div className="pulse-hours-control">
          <div className="pulse-slider-column">
            <input
              id={`${idPrefix}-hours-slider`}
              className="pulse-hours-slider"
              type="range"
              min={-MAX_SURVEY_HOURS}
              max={MAX_SURVEY_HOURS}
              step={0.25}
              value={displayed}
              aria-label="Task time change"
              aria-valuetext={description}
              onChange={(event) => {
                const value = Number(event.target.value)
                setHours(value)
                if (hoursInput.current) hoursInput.current.value = String(value)
              }}
              style={{ background: `linear-gradient(to right, #e4eae7 0%, #e4eae7 ${start}%, ${color} ${start}%, ${color} ${end}%, #e4eae7 ${end}%, #e4eae7 100%)` }}
            />
            <div className="pulse-hours-scale" aria-hidden="true"><span>{MAX_SURVEY_HOURS} h slower</span><span>0</span><span>{MAX_SURVEY_HOURS} h faster</span></div>
          </div>
          <label className="pulse-hours-field" htmlFor={`${idPrefix}-hours-input`}>
            <span>Hours</span>
            <div className="pulse-hours-input">
              <input
                ref={hoursInput}
                id={`${idPrefix}-hours-input`}
                name="timeImpact"
                type="number"
                inputMode="decimal"
                min={-MAX_SURVEY_HOURS}
                max={MAX_SURVEY_HOURS}
                step="any"
                defaultValue="0"
                required
                aria-label="Task time change in hours"
                onChange={(event) => {
                  const value = event.currentTarget.valueAsNumber
                  setHours(Number.isFinite(value) ? clamp(value) : null)
                }}
                onBlur={(event) => {
                  const value = event.currentTarget.valueAsNumber
                  const normalized = Number.isFinite(value) ? clamp(value) : 0
                  event.currentTarget.value = String(normalized)
                  setHours(normalized)
                }}
              />
              <span aria-hidden="true">hrs</span>
            </div>
          </label>
        </div>
        <output className={`pulse-hours-summary ${displayed < 0 ? 'slower' : displayed > 0 ? 'faster' : ''}`}>{description}</output>
      </fieldset>
      <label>What was the main immediate effect?
        <select name="effect" required defaultValue="">
          <option value="" disabled>Select an effect</option>
          {pulseEffectOptions.map((effect) => <option key={effect}>{effect}</option>)}
        </select>
      </label>
      {displayed > 0 && (
        <label>What did you use the saved time for? <span className="optional">Optional</span>
          <select name="reuse" defaultValue="">
            <option value="">Prefer not to say or not sure</option>
            {reuseCategories.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
      )}
      <FormError message={error ?? ''} />
      <div className="modal-actions">
        <span><ShieldCheck size={15} />Grouped reporting only · about 20 seconds</span>
        {secondary && <button type="button" className="secondary-button" onClick={secondary.onClick}>{secondary.label}</button>}
        <button className="primary-button" type="submit">{submitLabel} <ArrowRight size={16} /></button>
      </div>
    </form>
  )
}

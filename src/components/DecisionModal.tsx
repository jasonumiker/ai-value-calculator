import { useState, type FormEvent } from 'react'
import { Check } from 'lucide-react'
import { periodLabel } from '../domain/periods'
import type { TeamDecisionRow } from '../domain/decisions'
import { decisionOptions, type DecisionOption, type DecisionRecord, type PeriodKey } from '../domain/types'
import { DecisionBadge, FormError, ModalShell } from './ui'
import { errorMessage } from './helpers'

export function DecisionModal({ row, period, onClose, onSave }: {
  row: TeamDecisionRow
  period: PeriodKey
  onClose: () => void
  onSave: (input: Omit<DecisionRecord, 'id' | 'decidedAt'>) => void
}) {
  const [error, setError] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      onSave({
        period,
        team: row.team,
        decision: String(form.get('decision')) as DecisionOption,
        suggested: row.suggestion.decision,
        rationale: String(form.get('rationale') ?? ''),
        decidedBy: String(form.get('decidedBy') ?? ''),
      })
    } catch (failure) {
      setError(errorMessage(failure, 'The decision could not be recorded.'))
    }
  }
  return (
    <ModalShell eyebrow={`${row.team} · ${periodLabel(period)}`} title="Record where the next dollar goes" onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <div className="suggestion-box"><span>Suggested by policy</span><DecisionBadge decision={row.suggestion.decision} /><p>{row.suggestion.reason}</p></div>
        <label>Decision
          <select name="decision" defaultValue={row.recorded?.decision ?? row.suggestion.decision}>
            {decisionOptions.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <label>Rationale<textarea name="rationale" rows={3} required placeholder="Why this decision, and what would change it" /></label>
        <label>Decided by<input name="decidedBy" required defaultValue="CFO (demo)" /></label>
        <FormError message={error} />
        <div className="modal-actions"><span>Overriding the suggestion is fine; the reason is recorded</span><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Check size={16} /> Record decision</button></div>
      </form>
    </ModalShell>
  )
}

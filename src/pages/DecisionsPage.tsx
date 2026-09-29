import { useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { DecisionModal } from '../components/DecisionModal'
import { DecisionBadge, PageIntro, PanelHeader } from '../components/ui'
import type { TeamDecisionRow } from '../domain/decisions'
import { formatCurrency, formatRatio } from '../domain/format'
import { periodLabel } from '../domain/periods'
import type { PageContext } from './types'

function evidenceChips(row: TeamDecisionRow) {
  const { evidence } = row
  return [
    ...evidence.supported.map((name) => ({ name, tone: 'supported', label: 'Supported' })),
    ...evidence.notSupported.map((name) => ({ name, tone: 'not-supported', label: evidence.guardrailBreaches.includes(name) ? 'Guardrail breached' : 'Not supported' })),
    ...evidence.inconclusive.map((name) => ({ name, tone: 'inconclusive', label: 'Inconclusive' })),
    ...evidence.inStudy.map((name) => ({ name, tone: 'in-study', label: 'In study' })),
    ...evidence.readyToTest.map((name) => ({ name, tone: 'ready-to-test', label: 'Ready to test' })),
  ]
}

export function DecisionsPage({ data, actions, view, period, notify }: PageContext) {
  const [selected, setSelected] = useState<TeamDecisionRow | null>(null)
  const history = [...data.decisions].sort((first, second) => second.decidedAt.localeCompare(first.decidedAt))
  return (
    <div className="page-content">
      <PageIntro
        kicker={`Next-dollar decisions · ${periodLabel(period)}`}
        title="Scale, redesign, keep measuring, or stop"
        text={`Suggestions apply the published policy to each team’s evidence: a guardrail breach means redesign; validated value at ${data.policy.scaleBenefitCostRatio}× cost or more means scale; maturing evidence means keep measuring; proven effects that don’t pay back mean redesign; nothing supported means stop.`}
      />
      <section className="panel">
        <PanelHeader kicker="By team" title="Cost, validated value, and evidence" />
        <div className="table-scroll">
          <table className="decisions-table">
            <thead><tr><th>Team</th><th>Allocated cost</th><th>Validated value</th><th>Benefit ÷ cost</th><th>Evidence</th><th>Suggested</th><th>Recorded</th></tr></thead>
            <tbody>
              {view.teams.map((row) => (
                <tr key={row.team}>
                  <td><strong>{row.team}</strong><span className="cell-subtitle">{row.products.join(', ')}</span></td>
                  <td>{formatCurrency(row.totalCost)}<span className="cell-subtitle">{formatCurrency(row.directCost)} direct</span></td>
                  <td>{formatCurrency(row.validatedValue)}</td>
                  <td><span className={`roi-pill ${row.benefitCostRatio < 1 ? 'negative' : ''}`}>{formatRatio(row.benefitCostRatio)}</span></td>
                  <td><div className="chip-list">{evidenceChips(row).map((chip) => <span key={chip.name} className={`evidence-chip ${chip.tone}`} title={chip.name}>{chip.label}: {chip.name}</span>)}{evidenceChips(row).length === 0 && <span className="cell-subtitle">No studies this quarter</span>}</div></td>
                  <td><DecisionBadge decision={row.suggestion.decision} /><span className="cell-subtitle reason">{row.suggestion.reason}</span></td>
                  <td>
                    <div className="decision-cell">
                      {row.recorded ? <><DecisionBadge decision={row.recorded.decision} /><span className="cell-subtitle">{row.recorded.decidedBy}</span></> : <span className="cell-subtitle">Not recorded</span>}
                      <button className="secondary-button" onClick={() => setSelected(row)} aria-label={`Record decision for ${row.team}`}><ClipboardCheck size={14} /> Record</button>
                    </div>
                  </td>
                </tr>
              ))}
              {view.teams.length === 0 && <tr><td colSpan={7} className="table-empty">No spend recorded for {periodLabel(period)}.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="panel-foot">Shared platform and change costs are allocated by each team’s share of direct consumption spend. Pulse value stays portfolio-level and is not allocated to teams.</p>
      </section>
      <section className="panel">
        <PanelHeader kicker="Decision log" title="What was decided, and why" />
        <ul className="decision-log">
          {history.map((decision) => (
            <li key={decision.id}>
              <div><DecisionBadge decision={decision.decision} /><strong>{decision.team}</strong><span>{periodLabel(decision.period)} · {decision.decidedBy} · {new Date(decision.decidedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
              <p>{decision.rationale}{decision.decision !== decision.suggested && <em> (overrode suggested “{decision.suggested}”)</em>}</p>
            </li>
          ))}
          {history.length === 0 && <li className="table-empty">No decisions recorded yet.</li>}
        </ul>
      </section>
      {selected && (
        <DecisionModal
          row={selected}
          period={period}
          onClose={() => setSelected(null)}
          onSave={(input) => {
            actions.recordDecision(input)
            setSelected(null)
            notify(`Decision recorded for ${input.team}.`)
          }}
        />
      )}
    </div>
  )
}

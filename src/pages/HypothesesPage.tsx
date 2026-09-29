import { useState } from 'react'
import { LayoutDashboard, Plus } from 'lucide-react'
import { HypothesisCard } from '../components/HypothesisCard'
import { MiniStat, PageIntro } from '../components/ui'
import { errorMessage } from '../components/helpers'
import { formatPercent } from '../domain/format'
import type { PageContext } from './types'

export function HypothesesPage({ data, actions, persona, team, period, global, focus, navigate, notify, openHypothesis }: PageContext) {
  const [teamOnly, setTeamOnly] = useState(persona === 'manager')
  const hit = global.hitRate
  const visible = global.ranked.filter(({ hypothesis }) => (focus.hypothesisId !== undefined ? hypothesis.id === focus.hypothesisId : !teamOnly || hypothesis.owner === team))
  const awaiting = data.hypotheses.filter((hypothesis) => hypothesis.status === 'Nominated').length

  const act = (action: () => void, message: string) => {
    try {
      action()
      notify(message)
    } catch (failure) {
      notify(errorMessage(failure, 'That action could not be completed.'))
    }
  }

  return (
    <div className="page-content">
      <PageIntro
        kicker={persona === 'executive' ? 'Management prioritisation' : 'Value hypotheses'}
        title={persona === 'executive' ? 'Prioritise the few hypotheses worth a proper test' : 'Nominate what happens often and could improve a lot'}
        text={persona === 'executive'
          ? `Managers nominate up to five each; you approve which to test. Ranked by value if true ÷ study effort.${awaiting ? ` ${awaiting} awaiting your decision.` : ''}`
          : 'Size each idea by how often it happens and how much it could improve, then register what success means before you measure it.'}
        action={(
          <div className="workflow-actions">
            {focus.hypothesisId !== undefined && <button className="secondary-button" onClick={() => navigate('hypotheses')}><LayoutDashboard size={16} /> All hypotheses</button>}
            {persona === 'manager' && <button className="primary-button" onClick={() => openHypothesis({ owner: team })}><Plus size={17} /> Nominate hypothesis</button>}
          </div>
        )}
      />
      <section className="mini-stat-grid hit-rate">
        <MiniStat label="Tested" value={String(hit.tested)} note={`${hit.inStudy} in study · ${hit.readyToTest} ready to test`} />
        <MiniStat label="Supported" value={String(hit.supported)} note="effect confirmed" />
        <MiniStat label="Not supported" value={String(hit.notSupported)} note="useful to know, too" />
        <MiniStat label="Hit rate" value={formatPercent(hit.hitRate)} note="Not every test needs to succeed; the portfolio does" />
      </section>
      {persona === 'manager' && focus.hypothesisId === undefined && (
        <div className="filter-row"><label><input type="checkbox" checked={teamOnly} onChange={(event) => setTeamOnly(event.target.checked)} />Only {team}</label></div>
      )}
      <section className={`hypothesis-grid ${focus.hypothesisId !== undefined ? 'focused-hypothesis' : ''}`}>
        {visible.map(({ hypothesis, rank }) => (
          <HypothesisCard
            key={hypothesis.id}
            hypothesis={hypothesis}
            rank={rank}
            studies={data.studies}
            policy={data.policy}
            products={data.products}
            persona={persona}
            onPrioritise={(status) => act(() => actions.prioritise(hypothesis.id, status, 'Executive committee (demo)'), status === 'Parked' ? 'Hypothesis parked.' : 'Approved for testing. The manager can now start a study.')}
            onStartStudy={() => act(() => navigate('studies', { studyId: actions.startStudy(hypothesis.id, period) }), 'Study started with the pre-registered criterion locked.')}
            onViewStudy={(studyId) => navigate('studies', { studyId })}
          />
        ))}
        {visible.length === 0 && <p className="table-empty">No hypotheses match this view.</p>}
      </section>
    </div>
  )
}

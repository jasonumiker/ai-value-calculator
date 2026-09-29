import { CalendarPlus, Lock, Shuffle } from 'lucide-react'
import { WeeklyBars } from '../components/charts'
import { MiniStat, PageIntro, PanelHeader, ProductMark } from '../components/ui'
import { errorMessage } from '../components/helpers'
import { formatHours, formatNumber, formatPercent, formatSmallPercent } from '../domain/format'
import { monthLabel, periodLabel } from '../domain/periods'
import { billMonths as monthsInBill } from '../domain/usage'
import { invitationCounts, sessionMonths, uncoveredMonths, weeklyInvitations } from '../domain/sampling'
import type { PageContext } from './types'

export function SamplingPage({ data, actions, view, period, notify }: PageContext) {
  const projection = view.projection
  const frame = projection.frame
  const burden = view.burden
  const counts = frame ? invitationCounts(data.invitations, frame.id) : undefined
  const policy = data.policy
  const draw = () => {
    try {
      const result = actions.drawFrame(period)
      notify(`Drew ${result.invitations.length} invitations for ${periodLabel(period)}${result.shortfall ? `; ${result.shortfall} fewer than planned because the cadence caps left too few eligible people` : ''}.`)
    } catch (failure) {
      notify(errorMessage(failure, 'The sample could not be drawn.'))
    }
  }
  const extend = () => {
    try {
      const result = actions.extendFrame(period)
      notify(`Added ${result.invitations.length} invitations for the new months at each stratum’s original sampling rate.`)
    } catch (failure) {
      notify(errorMessage(failure, 'The sample could not be extended.'))
    }
  }
  const billMonths = monthsInBill(data.usage, period)
  const missing = frame ? uncoveredMonths(frame, billMonths) : []
  const extendable = missing.filter((month) => sessionMonths(view.sessions).includes(month))

  if (!frame) {
    return (
      <div className="page-content">
        <PageIntro kicker={`Sampling engine · ${periodLabel(period)}`} title="No random sample for this quarter yet" text="Draw a stratified random sample of task sessions from the bill’s usage. Work under a registered study is left to the study." />
        <section className="panel empty-state">
          <Shuffle size={28} />
          <p>{view.sessions.length.toLocaleString()} task sessions available for {periodLabel(period)}{billMonths.length > 0 && billMonths.length < 3 ? ` (the bill covers ${billMonths.map(monthLabel).join(', ')} so far; you can extend the sample as later months arrive)` : ''}. The sample follows {policy.invitationsPerWeek} invitations a week, at most one per person every {policy.cadenceDays} days and {policy.maxInvitationsPerPersonPerQuarter} per quarter.</p>
          <button className="primary-button" onClick={draw} disabled={view.sessions.length === 0}><Shuffle size={15} /> Draw sample for {periodLabel(period)}</button>
        </section>
      </div>
    )
  }

  return (
    <div className="page-content">
      <PageIntro
        kicker={`Sampling engine · ${periodLabel(period)} · ${frame.status}`}
        title="Random, occasional, and spread across people, work, and weeks"
        text={`Drawn ${new Date(frame.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} under ${frame.policyVersion} from ${frame.months.length ? frame.months.map(monthLabel).join(', ') : 'the whole quarter'}: stratified by product and work type, weighted to each week’s sessions, no one asked twice within ${frame.cadenceDays} days or more than ${frame.maxInvitationsPerPerson} times a quarter.`}
        action={frame.status === 'Open' ? <button className="secondary-button" onClick={() => { actions.closeFrame(frame.id); notify('Sample closed; open invitations expired.') }}><Lock size={15} /> Close sample</button> : undefined}
      />
      {missing.length > 0 && (
        <section className="panel coverage-callout">
          <CalendarPlus size={20} />
          <p>
            The bill now includes <strong>{missing.map(monthLabel).join(', ')}</strong>, which this sample doesn’t cover, so the Pulse estimate is withheld.{' '}
            {extendable.length > 0
              ? 'Extending invites a share of the new sessions at each stratum’s original rate.'
              : 'Those months have cost but no task sessions, so there is nothing to sample; import task_sessions for them.'}
          </p>
          {extendable.length > 0 && <button className="primary-button" onClick={extend}><CalendarPlus size={15} /> Extend sample</button>}
        </section>
      )}
      <section className="mini-stat-grid">
        <MiniStat label="Invitations" value={formatNumber(counts?.total ?? 0)} note={`${counts?.responded ?? 0} answered · ${counts?.declined ?? 0} declined · ${counts?.expired ?? 0} expired · ${counts?.pending ?? 0} open`} />
        <MiniStat label="Response rate" value={formatPercent(projection.responseRate)} note={`of closed invitations · policy minimum ${formatPercent(policy.minimumResponseRate)} per stratum`} />
        <MiniStat label="People asked" value={burden ? `${burden.peopleInvited} of ${burden.workforce}` : '—'} note={burden ? `${formatPercent(burden.shareInvited)} of AI users · at most ${burden.maxPerPerson} each` : ''} />
        <MiniStat label="Estimate status" value={projection.projectionEligible ? 'Eligible' : 'Not estimable'} note={projection.projectionEligible ? 'every stratum meets the thresholds' : projection.projectionReason} />
      </section>

      <div className="two-column">
        <section className="panel burden-panel">
          <PanelHeader kicker="Measurement burden" title="The survey costs seconds, not the savings" />
          {burden && (
            <>
              <div className="burden-compare">
                <div><span>Time spent answering</span><strong>{formatHours(burden.answerHours).replace('+', '')}</strong><small>{burden.responses} answers · median {burden.medianSeconds}s</small></div>
                <div><span>Net task time estimated</span><strong>{formatHours(projection.estimatedHours)}</strong><small>across {projection.populationTaskEvents.toLocaleString()} sessions</small></div>
              </div>
              <p className="panel-foot">Answering took {projection.estimatedHours > 0 ? formatSmallPercent(burden.answerHours / projection.estimatedHours) : '—'} of the time it helped measure. Asking everyone after every task would take roughly {formatHours(view.sessions.length * (burden.medianSeconds || 20) / 3600).replace('+', '')}.</p>
            </>
          )}
        </section>
        <section className="panel">
          <PanelHeader kicker="Spread over time" title="Invitations and answers by week" />
          <WeeklyBars weeks={weeklyInvitations(data.invitations, frame.id)} />
          <div className="chart-legend"><span><i className="invited" />Invited</span><span><i className="responded" />Answered</span></div>
        </section>
      </div>

      <section className="panel">
        <PanelHeader kicker="Strata" title="Sample plan and results by product and work type" />
        <div className="table-scroll">
          <table>
            <thead><tr><th>Product · work type</th><th>Eligible sessions</th><th>Planned</th><th>Drawn</th><th>Answered</th><th>Response rate</th><th>Open</th><th>Status</th></tr></thead>
            <tbody>{projection.strata.map((stratum) => {
              const meets = stratum.responses >= policy.minimumResponsesPerStratum && stratum.responseRate >= policy.minimumResponseRate
              const planned = frame.strata.find((entry) => entry.product === stratum.product && entry.workType === stratum.workType)
              return (
                <tr key={stratum.key}>
                  <td><span className="product-cell"><ProductMark product={stratum.product} products={data.products} /><strong>{stratum.workType}</strong></span><span className="cell-subtitle">{stratum.product}</span></td>
                  <td>{stratum.population.toLocaleString()}{stratum.excluded > 0 && <span className="cell-subtitle">−{stratum.excluded.toLocaleString()} now claimed</span>}</td>
                  <td>{planned?.planned ?? '—'}</td><td>{planned?.drawn ?? '—'}</td><td>{stratum.responses}</td>
                  <td>{formatPercent(stratum.responseRate)}</td><td>{stratum.pending}</td>
                  <td>{stratum.population === 0 ? <span className="cell-subtitle">Fully claimed</span> : meets ? <span className="eligibility yes">Meets policy</span> : <span className="eligibility">Below minimum</span>}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <PanelHeader kicker="No double counting" title="Work measured by studies instead of the Pulse" />
        <ul className="exclusion-list">
          {projection.frameExclusions.map((exclusion) => <li key={exclusion.claimId}><strong>{exclusion.claimName}</strong><span>{exclusion.scope.team} · {exclusion.scope.product} · {exclusion.scope.workTypes.join(', ') || 'all work types'} · {exclusion.sessions.toLocaleString()} sessions left out when the sample was drawn</span></li>)}
          {projection.lateExclusions.map((exclusion) => <li key={exclusion.claimId}><strong>{exclusion.claimName}</strong><span>{exclusion.scope.team} · {exclusion.scope.product} · {exclusion.scope.workTypes.join(', ') || 'all work types'} · {exclusion.sessions.toLocaleString()} sessions removed after approval</span></li>)}
          {projection.frameExclusions.length + projection.lateExclusions.length === 0 && <li className="table-empty">No work is under a registered study or approved claim this quarter.</li>}
        </ul>
      </section>
    </div>
  )
}

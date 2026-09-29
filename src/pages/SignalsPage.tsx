import { FlaskConical, Lightbulb } from 'lucide-react'
import { DistributionBar } from '../components/charts'
import { SignalsTable } from '../components/SignalsTable'
import { MiniStat, PageIntro, PanelHeader } from '../components/ui'
import { formatHours, formatPercent } from '../domain/format'
import { periodLabel } from '../domain/periods'
import { breakEvenRatio } from '../domain/policy'
import { calibrationForStratum, isRandomResponse, stratumKey } from '../domain/pulse'
import { draftFromSignal } from '../state/drafts'
import type { PageContext } from './types'

const reuseTones = ['tone-green', 'tone-teal', 'tone-blue', 'tone-orange', 'tone-grey']

export function SignalsPage({ data, view, period, openHypothesis }: PageContext) {
  const policy = data.policy
  const projection = view.projection
  const responses = data.responses.filter((response) => isRandomResponse(response) && response.period === period)
  const previews = data.responses.filter((response) => response.source === 'Preview' && response.period === period).length
  const calibration = (key: string) => calibrationForStratum(key, view.calibration, policy)
  const underStudy = (projection.frame?.excludedScopes ?? []).flatMap((exclusion) => exclusion.scope.workTypes.map((workType) => ({
    key: stratumKey(exclusion.scope.product, workType), product: exclusion.scope.product, workType, study: exclusion.claimName,
  })))
  const uncalibrated = projection.strata
    .filter((stratum) => stratum.calibrationSource === 'Policy default' && stratum.population > 0)
    .sort((first, second) => second.population - first.population)[0]
  const faster = responses.filter((response) => response.hours > 0).length
  const slower = responses.filter((response) => response.hours < 0).length
  const reuse = projection.reuse

  return (
    <div className="page-content">
      <PageIntro kicker={`Pulse signals · ${periodLabel(period)}`} title="Turn what people observe into hypotheses worth testing" text="Aggregate answers to random invitations, by product and work type. Strong positive or negative signals are candidates for a proper study." />
      <section className="mini-stat-grid">
        <MiniStat label="Random-sample answers" value={String(responses.length)} note={`${formatPercent(projection.responseRate)} response rate`} />
        <MiniStat label="Faster" value={formatPercent(responses.length ? faster / responses.length : 0)} note="of sampled tasks" />
        <MiniStat label="Slower" value={formatPercent(responses.length ? slower / responses.length : 0)} note="kept in every estimate" />
        <MiniStat label="Preview answers" value={String(previews)} note="self-selected · discovery only" />
      </section>

      <section className="panel">
        <PanelHeader kicker="By product and work type" title="What the random sample says" />
        <SignalsTable
          rows={view.signals}
          products={data.products}
          minimumGroup={policy.minimumReportingGroup}
          calibration={calibration}
          underStudy={underStudy}
          onNominate={(signal) => openHypothesis(draftFromSignal(signal, view.sessions, period, calibration(signal.key).factor))}
        />
      </section>

      <div className="two-column">
        <section className="panel">
          <PanelHeader kicker="Studies calibrate self-reports" title="How far can we trust reported time savings?" />
          <p className="panel-lead">Where a study timed the same kind of task, measured ÷ reported time replaces the default {formatPercent(policy.defaultSelfReportCalibration)} discount for that work type. In METR’s 2025 randomised trial, experienced developers were 19% slower with AI while believing they were 20% faster.</p>
          <div className="table-scroll">
            <table className="calibration-table">
              <thead><tr><th>Work type and study</th><th>Measured vs reported, per task</th><th>Trust factor</th></tr></thead>
              <tbody>
                {view.calibration.map((entry) => (
                  <tr key={entry.studyId}>
                    <td><strong>{entry.product} · {entry.workType}</strong><span className="cell-subtitle">{entry.studyName} · {entry.studyN} observations</span></td>
                    <td><span className={entry.measuredHours < 0 ? 'value-negative' : ''}>{formatHours(entry.measuredHours)}</span> measured vs {formatHours(entry.reportedHours)} reported<span className="cell-subtitle">{entry.reportedResponses} random answers</span></td>
                    <td><strong>{formatPercent(entry.factor)}</strong>{entry.note && <span className="cell-subtitle">{entry.note}</span>}</td>
                  </tr>
                ))}
                {view.calibration.length === 0 && <tr><td colSpan={3} className="table-empty">No completed timing study matches a sampled work type yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="panel-foot">
            Study calibration covers {formatPercent(projection.calibratedShare)} of sampled sessions.
            {uncalibrated && <> The largest uncalibrated work is <strong>{uncalibrated.product} · {uncalibrated.workType}</strong> ({uncalibrated.population.toLocaleString()} sessions).{' '}
              <button className="text-button" onClick={() => openHypothesis({
                useCase: `Time ${uncalibrated.workType.toLowerCase()} with and without AI`,
                product: uncalibrated.product,
                workType: uncalibrated.workType,
                expectedEffect: 'Less time per task',
                outcome: 'Calibrated Pulse estimate',
                evidence: 'Task timestamps',
                successCriterion: { metric: `Time per ${uncalibrated.workType.toLowerCase()} task`, unit: 'minutes per task', direction: 'decrease' },
              })}><FlaskConical size={13} /> Nominate a timing study</button></>}
          </p>
        </section>
        <section className="panel">
          <PanelHeader kicker="Where saved time went" title="Capacity is only value when it’s reused" />
          <DistributionBar items={reuse.distribution.map((entry, index) => ({ label: entry.category, count: entry.count, tone: reuseTones[index] ?? 'tone-grey' }))} />
          <p className="panel-foot">
            <strong>{formatPercent(reuse.rate)}</strong> of reported saved time counts as productively reused ({reuse.source === 'Survey' ? `from ${reuse.answers} answers, weighted by hours and the CFO’s reuse weights` : `policy default; ${reuse.answers} of ${policy.minimumReuseAnswers} answers needed`}).
            With slower tasks charged at {policy.lossTreatment === 'Full rate' ? 'the full rate' : 'the same discounts'}, a work type must save about {formatHoursRatio(breakEvenRatio(policy.defaultSelfReportCalibration, reuse.rate, policy.lossTreatment))} the time it loses to break even.
          </p>
          <p className="panel-foot"><Lightbulb size={13} /> Employees answer what they can observe. They never convert minutes into dollars.</p>
        </section>
      </div>
    </div>
  )
}

function formatHoursRatio(value: number) {
  return Number.isFinite(value) ? `${value.toFixed(1)}×` : 'infinitely more than'
}

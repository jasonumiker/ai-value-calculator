import { ArrowRight, CircleDollarSign, Gauge, Lightbulb, Target } from 'lucide-react'
import { SignalsTable } from '../components/SignalsTable'
import { DecisionBadge, Metric, PanelHeader, VerdictBadge } from '../components/ui'
import { formatCurrency, formatRatio } from '../domain/format'
import { MAX_ACTIVE_NOMINATIONS, activeNominations, hypothesisProgress, sizeHypothesis } from '../domain/hypotheses'
import { periodLabel } from '../domain/periods'
import { calibrationForStratum, isRandomResponse, signalRows, stratumKey } from '../domain/pulse'
import { studyStatus } from '../domain/studies'
import { draftFromSignal } from '../state/drafts'
import type { PageContext } from './types'

export function TeamPage({ data, view, team, period, navigate, openHypothesis, openEvidence, openReview }: PageContext) {
  const policy = data.policy
  const row = view.teams.find((candidate) => candidate.team === team)
  const responses = data.responses.filter((response) => isRandomResponse(response) && response.period === period && response.team === team)
  const signals = signalRows(responses, policy.minimumReportingGroup)
  const underStudy = (view.projection.frame?.excludedScopes ?? [])
    .filter((exclusion) => exclusion.scope.team === team)
    .flatMap((exclusion) => exclusion.scope.workTypes.map((workType) => ({ key: stratumKey(exclusion.scope.product, workType), product: exclusion.scope.product, workType, study: exclusion.claimName })))
  const hypotheses = data.hypotheses.filter((hypothesis) => hypothesis.owner === team)
  const studies = data.studies.filter((study) => study.team === team)
  const nominations = activeNominations(data.hypotheses, `${team} manager`, data.studies)
  const calibration = (key: string) => calibrationForStratum(key, view.calibration, policy)

  return (
    <div className="page-content">
      <section className="summary-strip">
        <div className="summary-heading"><div><span className="live-dot" />{team} · {periodLabel(period)}</div><p>Manager view: your team’s signals, hypotheses, and studies</p></div>
        <div className="metric-grid">
          <Metric label="Allocated AI cost" value={formatCurrency(row?.totalCost ?? 0)} detail={`${formatCurrency(row?.directCost ?? 0)} direct + shared and change costs`} icon={CircleDollarSign} />
          <Metric label="Validated value" value={formatCurrency(row?.validatedValue ?? 0)} detail={`${formatRatio(row?.benefitCostRatio ?? 0)} of allocated cost`} icon={Target} tone="emphasis" />
          <div className="metric"><div className="metric-label"><Gauge size={16} />Suggested decision</div><strong>{row ? <DecisionBadge decision={row.suggestion.decision} /> : '—'}</strong><span>{row?.suggestion.reason ?? 'No spend recorded for this team.'}</span></div>
          <Metric label="Open nominations" value={`${nominations} of ${MAX_ACTIVE_NOMINATIONS}`} detail="Awaiting approval, ready, or in study" icon={Lightbulb} />
        </div>
      </section>

      <section className="panel">
        <PanelHeader kicker="Signals from your team" title="Where the random Pulse sees AI helping, or not">
          <button className="secondary-button" onClick={() => openHypothesis({ owner: team })}><Lightbulb size={15} /> Nominate hypothesis</button>
        </PanelHeader>
        <SignalsTable
          rows={signals}
          products={data.products}
          minimumGroup={policy.minimumReportingGroup}
          calibration={calibration}
          underStudy={underStudy}
          onNominate={(signal) => openHypothesis(draftFromSignal(signal, view.sessions, period, calibration(signal.key).factor, team))}
          caption={`Random-sample answers from ${team} in ${periodLabel(period)}. Groups under ${policy.minimumReportingGroup} are hidden.`}
        />
      </section>

      <div className="two-column">
        <section className="panel">
          <PanelHeader kicker="Your nominations" title="Hypotheses">
            <button className="text-button" onClick={() => navigate('hypotheses')}>All hypotheses <ArrowRight size={14} /></button>
          </PanelHeader>
          <ul className="compact-list">
            {hypotheses.map((hypothesis) => (
              <li key={hypothesis.id}>
                <div><strong>{hypothesis.useCase}</strong><span>{formatCurrency(sizeHypothesis(hypothesis, policy).valueIfTrue)} per quarter if true</span></div>
                <VerdictBadge status={hypothesisProgress(hypothesis, data.studies)} />
              </li>
            ))}
            {hypotheses.length === 0 && <li className="table-empty">No nominations yet.</li>}
          </ul>
        </section>
        <section className="panel">
          <PanelHeader kicker="Your studies" title="Evidence in progress">
            <button className="text-button" onClick={() => navigate('studies')}>All studies <ArrowRight size={14} /></button>
          </PanelHeader>
          <ul className="compact-list">
            {studies.map((study) => {
              const status = studyStatus(study)
              const review = study.financialReview?.status
              return (
                <li key={study.id}>
                  <div><strong>{study.name}</strong><span>{study.result}</span></div>
                  <VerdictBadge status={status} />
                  {review !== 'Pending' && review !== 'Approved' && status !== 'Supported' && <button className="text-button" onClick={() => openEvidence(study.id)}>Record evidence</button>}
                  {status === 'Supported' && review !== 'Approved' && review !== 'Pending' && <button className="text-button" onClick={() => openReview(study.id)}>Propose valuation</button>}
                  {(review === 'Approved' || review === 'Pending') && <button className="text-button" onClick={() => navigate('studies', { studyId: study.id })}>View</button>}
                </li>
              )
            })}
            {studies.length === 0 && <li className="table-empty">No studies yet. Start one from an approved hypothesis.</li>}
          </ul>
        </section>
      </div>
    </div>
  )
}

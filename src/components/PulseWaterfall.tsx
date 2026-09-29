import { Fragment, useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { formatCurrency, formatHours, formatNumber, formatPercent, formatShort } from '../domain/format'
import { monthLabel } from '../domain/periods'
import type { PulseProjection } from '../domain/pulse'
import type { Policy } from '../domain/types'
import { PanelHeader } from './ui'

type StepId = 'bill' | 'exclusions' | 'eligible' | 'sample' | 'reported' | 'calibration' | 'reuse' | 'rate' | 'result'

type WaterfallStep = {
  id: StepId
  label: string
  value: string
  note: string
}

type PulseWaterfallProps = {
  billSessions: number
  productCost: number
  totalCost: number
  validatedValue: number
  projection: PulseProjection
  policy: Policy
  combinedRoi: number
  combinedRoiInterval: { low: number; high: number }
}

function StepLane({ label, steps, active, onSelect }: {
  label: string
  steps: WaterfallStep[]
  active: StepId
  onSelect: (step: StepId) => void
}) {
  return (
    <div className="waterfall-lane-group">
      <p>{label}</p>
      <div className="waterfall-lane">
        {steps.map((step, index) => (
          <Fragment key={step.id}>
            <button
              className={`waterfall-step ${active === step.id ? 'active' : ''}`}
              type="button"
              aria-pressed={active === step.id}
              onClick={() => onSelect(step.id)}
            >
              <span>{step.label}</span>
              <strong>{step.value}</strong>
              <small>{step.note}</small>
            </button>
            {index < steps.length - 1 && <ArrowRight className="waterfall-connector" size={17} aria-hidden="true" />}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function DetailStats({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="waterfall-detail-stats">
      {items.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
    </dl>
  )
}

export function PulseWaterfall({
  billSessions,
  productCost,
  totalCost,
  validatedValue,
  projection,
  policy,
  combinedRoi,
  combinedRoiInterval,
}: PulseWaterfallProps) {
  const [active, setActive] = useState<StepId>('result')
  const frame = projection.frame
  const activeStrata = projection.strata.filter((stratum) => stratum.population > 0)
  const exclusions = [
    ...projection.frameExclusions.map((entry) => ({ ...entry, timing: 'Registered before the sample' })),
    ...projection.lateExclusions.map((entry) => ({ ...entry, timing: 'Approved after the sample' })),
  ]

  const populationSteps: WaterfallStep[] = [
    { id: 'bill', label: 'Bill population', value: `${formatNumber(billSessions)} sessions`, note: `${formatCurrency(productCost)} consumption` },
    { id: 'exclusions', label: 'Study and claim exclusions', value: `-${formatNumber(projection.excludedTaskEvents)} sessions`, note: 'removed before projection' },
    { id: 'eligible', label: 'Eligible population', value: `${formatNumber(projection.populationTaskEvents)} sessions`, note: `${activeStrata.length} product-work strata` },
    { id: 'sample', label: 'Random sample', value: `${formatNumber(projection.sampledResponseCount)} answers`, note: `from ${formatNumber(projection.invitations)} invitations` },
  ]
  const valuationSteps: WaterfallStep[] = [
    { id: 'reported', label: 'Reported task time', value: formatHours(projection.estimatedHours), note: 'projected net time' },
    { id: 'calibration', label: 'Self-report calibration', value: formatHours(projection.calibratedHours), note: `${formatPercent(projection.calibratedShare)} study-calibrated` },
    { id: 'reuse', label: 'Productive reuse', value: formatHours(projection.reusedHours), note: `${formatPercent(projection.reuse.rate)} reuse rate` },
    { id: 'rate', label: 'Contribution rate', value: `$${formatNumber(policy.contributionValuePerHour)}/h`, note: 'finance policy' },
    {
      id: 'result',
      label: 'Pulse estimate',
      value: projection.projectionEligible ? formatCurrency(projection.estimatedValue) : 'Withheld',
      note: projection.projectionEligible
        ? `95% ${formatShort(projection.valueInterval.low)} to ${formatShort(projection.valueInterval.high)}`
        : 'thresholds not met',
    },
  ]

  const details: Record<StepId, { title: string; body: ReactNode }> = {
    bill: {
      title: 'Start with the consumption bill and its task-session population',
      body: (
        <>
          <p>The grouped bill anchors both cost and scale for the quarter. The prototype synthesizes session detail from these aggregate task-session counts; a production invitation service would use the product’s governed event log.</p>
          <DetailStats items={[
            { label: 'Consumption spend', value: formatCurrency(productCost) },
            { label: 'Task sessions in bill', value: formatNumber(billSessions) },
            { label: 'Bill coverage', value: frame?.months.length ? frame.months.map(monthLabel).join(', ') : 'Quarter-level rows' },
          ]} />
        </>
      ),
    },
    exclusions: {
      title: 'Remove work already measured by studies or approved claims',
      body: (
        <>
          <p>These sessions stay outside the Pulse projection so the same work cannot create both study value and sampled long-tail value.</p>
          {exclusions.length > 0 ? (
            <ul className="waterfall-detail-list">
              {exclusions.map((entry) => (
                <li key={`${entry.timing}-${entry.claimId}`}>
                  <div><strong>{entry.claimName}</strong><span>{entry.timing}</span></div>
                  <b>-{formatNumber(entry.sessions)} sessions</b>
                </li>
              ))}
            </ul>
          ) : <p className="waterfall-empty">No study or approved-claim exclusions apply in this quarter.</p>}
        </>
      ),
    },
    eligible: {
      title: 'Project only across the remaining eligible population',
      body: (
        <>
          <p>The population recorded when the sample was drawn is preserved by product, work type, and team. Later claim exclusions use those frozen counts rather than a changed usage log.</p>
          <DetailStats items={[
            { label: 'Bill sessions', value: formatNumber(billSessions) },
            { label: 'Excluded sessions', value: `-${formatNumber(projection.excludedTaskEvents)}` },
            { label: 'Eligible sessions', value: formatNumber(projection.populationTaskEvents) },
            { label: 'Active strata', value: formatNumber(activeStrata.length) },
          ]} />
        </>
      ),
    },
    sample: {
      title: 'Use random answers only after every stratum clears the gates',
      body: (
        <>
          <p>Answers are projected only when each active product-work stratum meets the minimum response count and response rate. Open invitations are not counted in the response-rate denominator.</p>
          <DetailStats items={[
            { label: 'Invitations', value: formatNumber(projection.invitations) },
            { label: 'Answers', value: formatNumber(projection.sampledResponseCount) },
            { label: 'Still open', value: formatNumber(projection.pendingInvitations) },
            { label: 'Closed response rate', value: formatPercent(projection.responseRate) },
            { label: 'Minimum per stratum', value: formatNumber(policy.minimumResponsesPerStratum) },
            { label: 'Minimum response rate', value: formatPercent(policy.minimumResponseRate) },
          ]} />
        </>
      ),
    },
    reported: {
      title: 'Project reported time before putting a dollar value on it',
      body: (
        <>
          <p>Each stratum’s mean answer is expanded to its eligible sessions. Faster and slower task reports remain visible separately before any trust or reuse adjustment.</p>
          <DetailStats items={[
            { label: 'Reported gains', value: formatHours(projection.estimatedPositiveHours) },
            { label: 'Reported losses', value: formatHours(projection.estimatedNegativeHours) },
            { label: 'Net reported task time', value: formatHours(projection.estimatedHours) },
          ]} />
        </>
      ),
    },
    calibration: {
      title: 'Discount self-reports with matching timing studies',
      body: (
        <>
          <p>Where a completed timing study matches the product and work type, measured divided by reported time replaces the policy default. Factors are capped at 100%, so calibration can never inflate a self-report.</p>
          <div className="table-scroll waterfall-table">
            <table>
              <thead><tr><th>Product - work type</th><th>Eligible sessions</th><th>Factor</th><th>Source</th></tr></thead>
              <tbody>{activeStrata.map((stratum) => (
                <tr key={stratum.key}>
                  <td><strong>{stratum.workType}</strong><span className="cell-subtitle">{stratum.product}</span></td>
                  <td>{formatNumber(stratum.population)}</td>
                  <td>{formatPercent(stratum.calibration)}</td>
                  <td>{stratum.calibrationSource === 'Study' ? 'Matching study' : 'Policy default'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="waterfall-foot">{formatHours(projection.estimatedHours)} reported becomes {formatHours(projection.calibratedHours)} after calibration. {formatPercent(projection.calibratedShare)} of eligible sessions use study-derived factors.</p>
        </>
      ),
    },
    reuse: {
      title: 'Count only the share of saved time put to productive use',
      body: (
        <>
          <p>The surveyed reuse mix replaces the policy default once enough faster-task answers include a reuse response. Slower tasks follow the policy’s “{policy.lossTreatment}” treatment.</p>
          <DetailStats items={[
            { label: 'Reuse source', value: projection.reuse.source },
            { label: 'Reuse answers', value: formatNumber(projection.reuse.answers) },
            { label: 'Weighted reuse rate', value: formatPercent(projection.reuse.rate) },
            { label: 'Net hours after reuse', value: formatHours(projection.reusedHours) },
          ]} />
          <ul className="waterfall-reuse-list">
            {projection.reuse.distribution.map((entry) => <li key={entry.category}><span>{entry.category}</span><strong>{formatNumber(entry.count)}</strong></li>)}
          </ul>
        </>
      ),
    },
    rate: {
      title: 'Apply the finance-owned contribution rate last',
      body: (
        <>
          <p>The rate represents the approved contribution value of productively reused capacity, not an employee’s salary or an automatic cash saving.</p>
          <div className="waterfall-equation">
            <strong>{formatNumber(projection.reusedHours, 1)} h</strong><span>x</span>
            <strong>${formatNumber(policy.contributionValuePerHour)}/h</strong><span>=</span>
            <strong>{formatCurrency(projection.estimatedValue)}</strong>
          </div>
        </>
      ),
    },
    result: {
      title: 'Reconcile the modelled Pulse with the validated ROI headline',
      body: projection.projectionEligible ? (
        <>
          <div className="waterfall-equation roi-equation">
            <strong>{formatCurrency(validatedValue)} validated</strong><span>+</span>
            <strong>{formatCurrency(projection.estimatedValue)} Pulse</strong><span>-</span>
            <strong>{formatCurrency(totalCost)} cost</strong><span>/</span>
            <strong>{formatCurrency(totalCost)}</strong><span>=</span>
            <strong>{formatPercent(combinedRoi)} ROI</strong>
          </div>
          <DetailStats items={[
            { label: 'Pulse estimate', value: formatCurrency(projection.estimatedValue) },
            { label: 'Pulse 95% interval', value: `${formatCurrency(projection.valueInterval.low)} to ${formatCurrency(projection.valueInterval.high)}` },
            { label: 'Pulse-inclusive ROI', value: formatPercent(combinedRoi) },
            { label: 'ROI interval', value: `${formatPercent(combinedRoiInterval.low)} to ${formatPercent(combinedRoiInterval.high)}` },
          ]} />
          <p className="waterfall-foot">The interval covers Pulse sampling variation only. Validated claims, costs, calibration, reuse, and the dollar rate are held fixed.</p>
        </>
      ) : <p>The Pulse estimate is withheld: {projection.projectionReason}.</p>,
    },
  }

  return (
    <section className="panel pulse-waterfall" role="region" aria-label="Pulse calculation waterfall">
      <PanelHeader kicker="Calculation audit trail" title="How the Pulse estimate was built" />
      <p className="waterfall-intro">Select any step to inspect the population, evidence, assumption, or formula behind it.</p>
      <StepLane label="1. From the bill to a representative sample" steps={populationSteps} active={active} onSelect={setActive} />
      <StepLane label="2. From reported time to modelled value" steps={valuationSteps} active={active} onSelect={setActive} />
      <div className="waterfall-detail" aria-live="polite">
        <p className="section-kicker">Selected step</p>
        <h3>{details[active].title}</h3>
        <div>{details[active].body}</div>
      </div>
    </section>
  )
}

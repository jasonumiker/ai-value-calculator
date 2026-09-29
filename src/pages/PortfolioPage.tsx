import { ArrowRight, CircleDollarSign, Gauge, Target, TrendingUp } from 'lucide-react'
import { MonthlySpendChart, TrendChart } from '../components/charts'
import { EconomicsBadge, EvidenceBadge, Metric, PanelHeader, ProductMark } from '../components/ui'
import { formatCurrency, formatHours, formatMoneyPrecise, formatPercent, formatRatio, formatShort } from '../domain/format'
import { periodLabel } from '../domain/periods'
import { changeCostTotal } from '../domain/usage'
import type { ChangeCosts } from '../domain/types'
import type { PageContext } from './types'

const costFields: { key: keyof ChangeCosts; label: string; max: number }[] = [
  { key: 'implementation', label: 'Implementation', max: 50000 },
  { key: 'enablement', label: 'Enablement and training', max: 30000 },
  { key: 'operations', label: 'Operations and governance', max: 25000 },
]

export function PortfolioPage({ data, actions, view, trend, global, period, navigate }: PageContext) {
  const { portfolio, projection, combined } = view
  const costs = data.changeCosts[period] ?? { implementation: 0, enablement: 0, operations: 0 }
  const products = data.products.map((product) => product.name)
  const hit = global.hitRate
  const maxPillar = Math.max(1, ...portfolio.pillars.map((pillar) => pillar.value))

  return (
    <div className="page-content overview-page">
      <section className="summary-strip">
        <div className="summary-heading"><div><span className="live-dot" />{periodLabel(period)} · costs and value for the same quarter</div><p>Validated claims and the Pulse estimate stay visibly separate</p></div>
        <div className="metric-grid">
          <Metric label="Total AI cost" value={formatCurrency(portfolio.totalCost)} detail={`${formatCurrency(portfolio.productCost)} from bills + ${formatCurrency(portfolio.changeCost)} change costs`} icon={CircleDollarSign} />
          <Metric label="Validated value" value={formatCurrency(portfolio.validatedValue)} detail={`Evidence-adjusted · gross ${formatShort(portfolio.rawValue)}`} icon={Target} tone="emphasis" />
          <Metric label="Validated ROI" value={formatPercent(portfolio.roi)} detail={`Approved claims only · ${formatRatio(portfolio.benefitCostRatio)} benefit-cost`} icon={Gauge} />
          <Metric
            label="Pulse-inclusive ROI"
            value={projection.projectionEligible ? formatPercent(combined.roi) : 'Not estimable'}
            detail={projection.projectionEligible ? `95% sampling interval ${formatPercent(combined.roiInterval.low)} to ${formatPercent(combined.roiInterval.high)}` : projection.projectionReason}
            icon={TrendingUp}
            tone="modelled"
          />
        </div>
      </section>

      <div className="two-column">
        <section className="panel long-tail-panel">
          <PanelHeader kicker="The long tail · random Pulse" title={projection.projectionEligible ? `${formatCurrency(projection.estimatedValue)} estimated from everyday tasks` : 'Pulse estimate not available yet'}>
            <button className="text-button" onClick={() => navigate('sampling')}>Sampling engine <ArrowRight size={14} /></button>
          </PanelHeader>
          <dl className="fact-grid">
            <div><dt>95% sampling interval</dt><dd>{projection.projectionEligible ? `${formatCurrency(projection.valueInterval.low)} to ${formatCurrency(projection.valueInterval.high)}` : '—'}</dd></div>
            <div><dt>Net task time</dt><dd>{projection.projectionEligible ? formatHours(projection.estimatedHours) : '—'}</dd></div>
            <div><dt>Task sessions covered</dt><dd>{projection.populationTaskEvents.toLocaleString()}</dd></div>
            <div><dt>Left to studies (no double count)</dt><dd>{projection.excludedTaskEvents.toLocaleString()} sessions</dd></div>
            <div><dt>Self-reports calibrated by studies</dt><dd>{formatPercent(projection.calibratedShare)} of sessions</dd></div>
            <div><dt>Saved time reused</dt><dd>{formatPercent(projection.reuse.rate)} ({projection.reuse.source === 'Survey' ? 'surveyed' : 'default'})</dd></div>
          </dl>
        </section>
        <section className="panel">
          <PanelHeader kicker="Scientific method" title={`${hit.tested} hypotheses tested · ${formatPercent(hit.hitRate)} supported`}>
            <button className="text-button" onClick={() => navigate('hypotheses')}>Prioritise <ArrowRight size={14} /></button>
          </PanelHeader>
          <div className="hit-bars">
            {[['Supported', hit.supported, 'tone-green'], ['Not supported', hit.notSupported, 'tone-red'], ['Inconclusive', hit.inconclusive, 'tone-orange'], ['In study', hit.inStudy, 'tone-blue'], ['Ready to test', hit.readyToTest, 'tone-teal'], ['Awaiting prioritisation', hit.awaiting, 'tone-grey']].map(([label, count, tone]) => (
              <div key={label as string}><span>{label}</span><i className={tone as string} style={{ width: `${Math.max(4, (count as number) * 14)}px` }} /><strong>{count}</strong></div>
            ))}
          </div>
          <p className="panel-foot">Not every experiment needs to succeed. The supported ones, together with the long tail, need to justify the whole budget.</p>
        </section>
      </div>

      <div className="two-column">
        <section className="panel">
          <PanelHeader kicker="Trend" title="Cost and value by quarter" />
          <TrendChart points={trend} />
          <div className="table-scroll">
            <table className="compact-table">
              <thead><tr><th>Quarter</th><th>Total cost</th><th>Validated ROI</th><th>Pulse-inclusive ROI</th></tr></thead>
              <tbody>{trend.map((point) => (
                <tr key={point.period} className={point.period === period ? 'current-row' : ''}>
                  <td>{periodLabel(point.period)}</td><td>{formatCurrency(point.totalCost)}</td><td>{formatPercent(point.validatedRoi)}</td>
                  <td>{point.pulseInclusiveRoi === null ? 'Not estimable' : formatPercent(point.pulseInclusiveRoi)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <PanelHeader kicker="The bill" title="Monthly consumption spend by product">
            <button className="text-button" onClick={() => navigate('imports')}>Bills & usage <ArrowRight size={14} /></button>
          </PanelHeader>
          <MonthlySpendChart months={global.monthly} products={products} />
          <div className="cost-controls">
            <p className="section-kicker">Change costs for {periodLabel(period)}</p>
            {costFields.map((field) => (
              <label className="assumption" key={field.key}>
                <div className="assumption-top"><span>{field.label}</span><strong>{formatCurrency(costs[field.key])}</strong></div>
                <input
                  type="range" min={0} max={field.max} step={1000} value={costs[field.key]} aria-label={`${field.label} cost`}
                  style={{ backgroundSize: `${costs[field.key] / field.max * 100}% 100%` }}
                  onChange={(event) => actions.setChangeCosts(period, { ...costs, [field.key]: Number(event.target.value) })}
                />
              </label>
            ))}
            <p className="panel-foot">Change costs {formatCurrency(changeCostTotal(costs))} + consumption {formatCurrency(portfolio.productCost)} = {formatCurrency(portfolio.totalCost)}.</p>
          </div>
        </section>
      </div>

      <section className="panel">
        <PanelHeader kicker="Unit economics" title="Is the next credit worth it? Cost vs modelled value per task session" />
        <div className="product-economics">
          {view.productEconomics.map((entry) => (
            <div key={entry.product}>
              <span className="product-cell"><ProductMark product={entry.product} products={data.products} /><strong>{entry.product}</strong></span>
              <p><strong>{formatMoneyPrecise(entry.valuePerSession)}</strong> value vs <strong>{formatMoneyPrecise(entry.costPerSession)}</strong> cost per session · {formatRatio(entry.ratio)}</p>
            </div>
          ))}
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Product · work type</th><th>Sessions</th><th>Cost / session</th><th>Value / session (95%)</th><th>Value ÷ cost</th><th>Marginal credit</th></tr></thead>
            <tbody>{view.economics.map((row) => (
              <tr key={row.key}>
                <td><span className="product-cell"><ProductMark product={row.product} products={data.products} /><strong>{row.workType}</strong></span><span className="cell-subtitle">{row.product}</span></td>
                <td>{row.sessions.toLocaleString()}{row.population < row.sessions && <span className="cell-subtitle">{row.population.toLocaleString()} in Pulse scope</span>}</td>
                <td>{formatMoneyPrecise(row.costPerSession)}</td>
                <td className={row.valuePerSession < 0 ? 'value-negative' : ''}>{row.status === 'Not estimable' ? '—' : <>{formatMoneyPrecise(row.valuePerSession)}<span className="cell-subtitle">{formatMoneyPrecise(row.valueLow)} to {formatMoneyPrecise(row.valueHigh)}</span></>}</td>
                <td>{row.status === 'Not estimable' ? '—' : formatRatio(row.ratio)}</td>
                <td><EconomicsBadge status={row.status} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <div className="two-column">
        <section className="panel">
          <PanelHeader kicker="Business Value framework" title="Validated value by pillar" />
          <div className="mechanism-list">
            {portfolio.pillars.map((pillar) => (
              <div className="mechanism-row" key={pillar.label}>
                <span className="legend-dot" style={{ background: pillar.color }} /><span>{pillar.label}</span>
                <div className="micro-bar"><i style={{ width: `${pillar.value / maxPillar * 100}%`, background: pillar.color }} /></div>
                <strong>{pillar.value === 0 ? 'Not valued' : formatShort(pillar.value)}</strong>
              </div>
            ))}
          </div>
          <p className="panel-foot">Pulse value is portfolio-level and not allocated to pillars or teams.</p>
        </section>
        <section className="panel">
          <PanelHeader kicker="Claim readiness" title={`${formatPercent(portfolio.readiness.percent)} of required evidence present across ${portfolio.readiness.claims} claims`}>
            <button className="text-button" onClick={() => navigate('approvals')}>Approvals <ArrowRight size={14} /></button>
          </PanelHeader>
          <div className="evidence-legend inline">
            {portfolio.evidenceMix.map((entry) => <div key={entry.grade}><EvidenceBadge grade={entry.grade} /><strong>{Math.round(entry.percentage)}%</strong></div>)}
          </div>
          <p className="panel-foot">{formatPercent(portfolio.retentionRate)} of approved gross value remains after the evidence and confidence discounts. Readiness counts baseline, comparison, sources, guardrail, valuation, and approval for every claim this quarter, including those still in progress.</p>
        </section>
      </div>
    </div>
  )
}

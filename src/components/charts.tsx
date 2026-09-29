import { formatShort } from '../domain/format'
import { monthLabel, periodLabel } from '../domain/periods'
import type { StudyAnalysis } from '../domain/studies'
import type { TrendPoint } from '../state/derive'

const productColors = ['#087f6b', '#2f6fce', '#de7b22', '#8391a7', '#9b5bb5']

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const maximum = Math.max(1, ...points.flatMap((point) => [point.totalCost, point.validatedValue + Math.max(0, point.pulseHigh ?? 0)]))
  const height = 150
  const scale = (value: number) => Math.max(0, value) / maximum * height
  return (
    <div className="trend-chart" role="img" aria-label="Cost, validated value, and Pulse value by quarter">
      <div className="trend-bars">
        {points.map((point) => (
          <div className="trend-group" key={point.period}>
            <div className="trend-columns" style={{ height }}>
              <div className="trend-bar cost" style={{ height: scale(point.totalCost) }} title={`Total cost ${formatShort(point.totalCost)}`}><span>{formatShort(point.totalCost)}</span></div>
              <div className="trend-stack" style={{ height: scale(point.validatedValue + Math.max(0, point.pulseValue ?? 0)) }}>
                {point.pulseValue !== null && point.pulseValue > 0 && <div className="trend-bar pulse" style={{ height: scale(point.pulseValue) }} title={`Pulse ${formatShort(point.pulseValue)}`} />}
                <div className="trend-bar validated" style={{ height: scale(point.validatedValue) }} title={`Validated ${formatShort(point.validatedValue)}`} />
                <span>{formatShort(point.validatedValue + Math.max(0, point.pulseValue ?? 0))}</span>
              </div>
            </div>
            <strong>{periodLabel(point.period)}</strong>
          </div>
        ))}
      </div>
      <div className="chart-legend"><span><i className="cost" />Total cost</span><span><i className="validated" />Validated value</span><span><i className="pulse" />Pulse estimate</span></div>
    </div>
  )
}

export function MonthlySpendChart({ months, products }: { months: { month: string; total: number; byProduct: Record<string, number> }[]; products: string[] }) {
  const maximum = Math.max(1, ...months.map((month) => month.total))
  return (
    <div className="monthly-chart" role="img" aria-label="Monthly AI spend by product">
      <div className="monthly-bars">
        {months.map((month) => (
          <div className="monthly-group" key={month.month} title={`${monthLabel(month.month)}: ${formatShort(month.total)}`}>
            <div className="monthly-stack" style={{ height: `${month.total / maximum * 100}%` }}>
              {products.map((product, index) => (month.byProduct[product] ?? 0) > 0 && (
                <i key={product} style={{ flexGrow: month.byProduct[product], background: productColors[index % productColors.length] }} />
              ))}
            </div>
            <span>{monthLabel(month.month)}</span>
          </div>
        ))}
      </div>
      <div className="chart-legend">{products.map((product, index) => <span key={product}><i style={{ background: productColors[index % productColors.length] }} />{product}</span>)}</div>
    </div>
  )
}

export function WeeklyBars({ weeks }: { weeks: { week: number; invited: number; responded: number }[] }) {
  const maximum = Math.max(1, ...weeks.map((week) => week.invited))
  return (
    <div className="weekly-bars" role="img" aria-label="Invitations and responses by week">
      {weeks.map((week) => (
        <div className="weekly-bar" key={week.week} title={`Week ${week.week}: ${week.responded} of ${week.invited} answered`}>
          <div className="weekly-track">
            <i className="invited" style={{ height: `${week.invited / maximum * 100}%` }} />
            <i className="responded" style={{ height: `${week.responded / maximum * 100}%` }} />
          </div>
          <span>{week.week}</span>
        </div>
      ))}
    </div>
  )
}

/** Improvement interval against zero and the pre-registered threshold. */
export function EffectInterval({ analysis, threshold }: { analysis: StudyAnalysis; threshold: number }) {
  const minimum = Math.min(-0.2, analysis.low - 0.05)
  const maximum = Math.max(threshold + 0.1, analysis.high + 0.05)
  const position = (value: number) => `${(value - minimum) / (maximum - minimum) * 100}%`
  return (
    <div className="effect-interval" role="img" aria-label={`Improvement ${Math.round(analysis.improvement * 100)}%, 95% interval ${Math.round(analysis.low * 100)}% to ${Math.round(analysis.high * 100)}%, threshold ${Math.round(threshold * 100)}%`}>
      <div className="effect-track">
        <span className="effect-zero" style={{ left: position(0) }} />
        <span className="effect-threshold" style={{ left: position(threshold) }}><em>{Math.round(threshold * 100)}% target</em></span>
        <span className="effect-range" style={{ left: position(analysis.low), width: `calc(${position(analysis.high)} - ${position(analysis.low)})` }} />
        <span className="effect-point" style={{ left: position(analysis.improvement) }} />
      </div>
      <div className="effect-scale"><span>{Math.round(minimum * 100)}%</span><span className="effect-scale-zero" style={{ left: position(0) }}>0</span><span>+{Math.round(maximum * 100)}%</span></div>
    </div>
  )
}

export function DistributionBar({ items }: { items: { label: string; count: number; tone: string }[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  return (
    <div className="distribution">
      <div className="distribution-bar">{items.map((item) => item.count > 0 && <i key={item.label} className={item.tone} style={{ flexGrow: item.count }} title={`${item.label}: ${item.count}`} />)}</div>
      <ul>{items.map((item) => <li key={item.label}><i className={item.tone} />{item.label}<strong>{total === 0 ? '0%' : `${Math.round(item.count / total * 100)}%`}</strong></li>)}</ul>
    </div>
  )
}

import { FlaskConical, Lightbulb } from 'lucide-react'
import { formatHours, formatPercent } from '../domain/format'
import type { SignalRow } from '../domain/pulse'
import type { ProductDefinition } from '../domain/types'
import { ProductMark } from './ui'

export function SignalsTable({ rows, products, minimumGroup, calibration, underStudy = [], onNominate, caption }: {
  rows: SignalRow[]
  products: ProductDefinition[]
  minimumGroup: number
  calibration?: (key: string) => { factor: number; source: 'Study' | 'Policy default' }
  underStudy?: { key: string; product: string; workType: string; study: string }[]
  onNominate?: (row: SignalRow) => void
  caption?: string
}) {
  const studied = underStudy.filter((entry) => !rows.some((row) => row.key === entry.key))
  return (
    <div className="table-scroll">
      <table className="signals-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th>Product · work type</th><th>Responses</th><th>Mean time effect</th><th>Faster</th><th>Slower</th><th>Most common effect</th>
            {calibration && <th>Self-report trust</th>}
            {onNominate && <th><span className="visually-hidden">Action</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const trust = calibration?.(row.key)
            return (
              <tr key={row.key} className={row.slowerShare > row.fasterShare ? 'negative-signal' : ''}>
                <td><span className="product-cell"><ProductMark product={row.product} products={products} /><strong>{row.workType}</strong></span><span className="cell-subtitle">{row.product}</span></td>
                <td>{row.responses}</td>
                {row.suppressed
                  ? <td colSpan={4} className="suppressed-cell">Hidden: fewer than {minimumGroup} responses</td>
                  : <>
                      <td className={row.meanHours < 0 ? 'value-negative' : ''}>{formatHours(row.meanHours)}</td>
                      <td>{formatPercent(row.fasterShare)}</td>
                      <td>{formatPercent(row.slowerShare)}</td>
                      <td>{row.topEffect}</td>
                    </>}
                {trust && <td>{trust.source === 'Study' ? <span className="trust-study">{formatPercent(trust.factor)} · from study</span> : <span className="trust-default">{formatPercent(trust.factor)} · default</span>}</td>}
                {onNominate && <td>{!row.suppressed && <button className="text-button" onClick={() => onNominate(row)}><Lightbulb size={14} /> Nominate hypothesis</button>}</td>}
              </tr>
            )
          })}
          {studied.map((entry) => (
            <tr key={entry.key} className="studied-row">
              <td><span className="product-cell"><ProductMark product={entry.product} products={products} /><strong>{entry.workType}</strong></span><span className="cell-subtitle">{entry.product}</span></td>
              <td colSpan={(calibration ? 7 : 6) - (onNominate ? 0 : 1)}><FlaskConical size={13} /> Measured by the study “{entry.study}”, not sampled by the Pulse</td>
            </tr>
          ))}
          {rows.length === 0 && studied.length === 0 && <tr><td colSpan={8} className="table-empty">No random-sample responses for this period yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

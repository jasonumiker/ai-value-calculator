import type { RefObject } from 'react'
import { Download, FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react'
import { downloadBlob } from '../components/helpers'
import { PageIntro, PanelHeader, ProductMark } from '../components/ui'
import { formatCurrency, formatNumber } from '../domain/format'
import { periodLabel } from '../domain/periods'
import { SHARED_TEAM, usageTemplateCsv } from '../domain/usage'
import type { PageContext } from './types'

export function ImportsPage({ data, period, fileInput, onImport }: PageContext & { fileInput: RefObject<HTMLInputElement | null>; onImport: (file: File) => void }) {
  const rows = data.usage.filter((record) => record.period === period)
  const grouped = new Map<string, { team: string; product: string; cost: number; sessions: number; credits: number; users: number; months: number }>()
  rows.forEach((record) => {
    const key = `${record.team}|${record.product}`
    const entry = grouped.get(key) ?? { team: record.team, product: record.product, cost: 0, sessions: 0, credits: 0, users: 0, months: 0 }
    entry.cost += record.cost
    entry.sessions += record.taskSessions ?? 0
    entry.credits += record.credits ?? 0
    entry.users = Math.max(entry.users, record.activeUsers ?? 0)
    entry.months += 1
    grouped.set(key, entry)
  })
  const bill = [...grouped.values()].sort((first, second) => (first.team === SHARED_TEAM ? 1 : 0) - (second.team === SHARED_TEAM ? 1 : 0) || second.cost - first.cost)
  const total = bill.reduce((sum, entry) => sum + entry.cost, 0)

  return (
    <div className="page-content">
      <PageIntro kicker="Bills & usage data" title="The consumption bill drives cost, team split, and the sampling frame" text="Import grouped billing and usage exports. Each file replaces the rows it covers, adds new products and teams, and feeds every calculation. Rows with direct identifiers are rejected." />
      <section className="import-layout">
        <div className="upload-panel" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) onImport(file) }}>
          <div className="upload-icon"><Upload size={26} /></div>
          <h3>Import a grouped usage CSV</h3>
          <p>Columns: period (YYYY-MM or YYYY-Qn), product, team, cost; optionally active_users, task_sessions, and credits. Use team “Portfolio-wide” for shared platform costs.</p>
          <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = '' }} />
          <div className="upload-actions">
            <button className="secondary-button" onClick={() => fileInput.current?.click()}><FileSpreadsheet size={16} /> Choose CSV file</button>
            <button className="text-button" onClick={() => downloadBlob('ai-value-calculator-usage-template.csv', usageTemplateCsv, 'text/csv')}><Download size={15} /> Download template</button>
          </div>
        </div>
        <div className="privacy-panel">
          <ShieldCheck size={22} />
          <div>
            <p className="section-kicker">What the import accepts</p>
            <h3>Aggregates only</h3>
            <ul>
              <li><span className="control-status implemented">Enforced</span>Files with user, email, name, UPN, or employee ID columns are rejected</li>
              <li><span className="control-status implemented">Enforced</span>Sub-group rows are summed to team level</li>
              <li><span className="control-status prototype">Demo</span>Session-level sampling detail is synthesized from these counts</li>
              <li><span className="control-status planned">Production</span>Governed connectors to billing and usage APIs</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="panel">
        <PanelHeader kicker={`The bill · ${periodLabel(period)}`} title={`${formatCurrency(total)} consumption spend across ${bill.length} team and product lines`} />
        <div className="table-scroll">
          <table>
            <thead><tr><th>Team</th><th>Product</th><th>Active users</th><th>Task sessions</th><th>Credits</th><th>Cost</th><th>Cost / session</th></tr></thead>
            <tbody>
              {bill.map((entry) => (
                <tr key={`${entry.team}-${entry.product}`}>
                  <td><strong>{entry.team}</strong>{entry.team === SHARED_TEAM && <span className="cell-subtitle">Shared cost, allocated by direct spend</span>}</td>
                  <td><span className="product-cell"><ProductMark product={entry.product} products={data.products} />{entry.product}</span></td>
                  <td>{entry.users ? formatNumber(entry.users) : '—'}</td>
                  <td>{entry.sessions ? formatNumber(entry.sessions) : '—'}</td>
                  <td>{entry.credits ? formatNumber(entry.credits) : '—'}</td>
                  <td>{formatCurrency(entry.cost)}</td>
                  <td>{entry.sessions ? `$${(entry.cost / entry.sessions).toFixed(2)}` : '—'}</td>
                </tr>
              ))}
              {bill.length === 0 && <tr><td colSpan={7} className="table-empty">No usage imported for {periodLabel(period)}.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel records-panel">
        <PanelHeader kicker="Import history" title="Files applied to the bill" />
        <div className="table-scroll">
          <table>
            <thead><tr><th>File</th><th>Rows</th><th>Imported</th><th>Periods</th><th>Cost</th><th>Result</th></tr></thead>
            <tbody>{data.imports.map((item) => (
              <tr key={item.id}>
                <td><span className="file-cell"><FileSpreadsheet size={15} /><strong>{item.name}</strong></span><span className="cell-subtitle">{item.note}</span></td>
                <td>{item.rows.toLocaleString()}</td>
                <td>{item.date}</td>
                <td>{item.periods.map(periodLabel).join(', ') || '—'}</td>
                <td>{item.totalCost ? formatCurrency(item.totalCost) : '—'}</td>
                <td><span className={`import-status ${item.status === 'Rejected' ? 'mapping' : ''}`}><span />{item.status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

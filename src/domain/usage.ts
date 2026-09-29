import { normalizeMonth, normalizePeriod, quarterFromMonth, sortPeriods } from './periods'
import { canonicalProductName } from './products'
import type { ChangeCosts, PeriodKey, Product, ProductDefinition, UsageRecord } from './types'

/** Rows for this team hold shared platform costs that are allocated across teams rather than valued directly. */
export const SHARED_TEAM = 'Portfolio-wide'

export const usageTemplateCsv = [
  'period,product,team,role_group,active_users,task_sessions,credits,cost',
  '2026-10,GitHub Copilot,Digital Channels,Engineering,87,2330,7250,2460',
  '2026-10,GitHub Copilot,Platform Engineering,Engineering,42,1130,3850,1230',
  '2026-10,Copilot Cowork,Customer Operations,Case workers,129,2270,5450,4020',
  '2026-10,Copilot Cowork,Enterprise Sales,Sellers,31,540,1400,1010',
  '2026-10,GitHub Copilot,Portfolio-wide,,0,0,0,390',
  '2026-10,Copilot Cowork,Portfolio-wide,,0,0,0,490',
].join('\n') + '\n'

export function changeCostTotal(costs?: ChangeCosts) {
  return costs ? costs.implementation + costs.enablement + costs.operations : 0
}

export function usagePeriods(usage: UsageRecord[]) {
  return sortPeriods(usage.map((record) => record.period))
}

/** Months that appear anywhere in the quarter's bill, with or without task sessions. */
export function billMonths(usage: UsageRecord[], period: PeriodKey) {
  return [...new Set(usage.flatMap((record) => (record.period === period && record.month ? [record.month] : [])))].sort()
}

export function productSpend(usage: UsageRecord[], period: PeriodKey) {
  return usage.filter((record) => record.period === period).reduce((sum, record) => sum + record.cost, 0)
}

export function spendByProduct(usage: UsageRecord[], period: PeriodKey) {
  const totals = new Map<Product, { product: Product; cost: number; sessions: number; credits: number }>()
  usage.filter((record) => record.period === period).forEach((record) => {
    const current = totals.get(record.product) ?? { product: record.product, cost: 0, sessions: 0, credits: 0 }
    current.cost += record.cost
    current.sessions += record.taskSessions ?? 0
    current.credits += record.credits ?? 0
    totals.set(record.product, current)
  })
  return [...totals.values()]
}

export type TeamCost = {
  team: string
  products: Product[]
  directCost: number
  sharedAllocation: number
  changeAllocation: number
  totalCost: number
  sessions: number
  activeUsers: number
}

/** Splits the bill by team; shared platform and change costs follow each team's share of direct spend. */
export function teamCosts(usage: UsageRecord[], period: PeriodKey, changeCosts?: ChangeCosts): TeamCost[] {
  const records = usage.filter((record) => record.period === period)
  const sharedCost = records.filter((record) => record.team === SHARED_TEAM).reduce((sum, record) => sum + record.cost, 0)
  const teams = new Map<string, { products: Set<Product>; directCost: number; sessions: number; users: Map<Product, number> }>()
  records.filter((record) => record.team !== SHARED_TEAM).forEach((record) => {
    const team = teams.get(record.team) ?? { products: new Set(), directCost: 0, sessions: 0, users: new Map() }
    team.products.add(record.product)
    team.directCost += record.cost
    team.sessions += record.taskSessions ?? 0
    team.users.set(record.product, Math.max(team.users.get(record.product) ?? 0, record.activeUsers ?? 0))
    teams.set(record.team, team)
  })
  const totalDirect = [...teams.values()].reduce((sum, team) => sum + team.directCost, 0)
  const changeCost = changeCostTotal(changeCosts)
  return [...teams.entries()].map(([team, value]) => {
    const share = totalDirect === 0 ? 0 : value.directCost / totalDirect
    const sharedAllocation = sharedCost * share
    const changeAllocation = changeCost * share
    return {
      team,
      products: [...value.products],
      directCost: value.directCost,
      sharedAllocation,
      changeAllocation,
      totalCost: value.directCost + sharedAllocation + changeAllocation,
      sessions: value.sessions,
      activeUsers: [...value.users.values()].reduce((sum, users) => sum + users, 0),
    }
  }).sort((first, second) => second.directCost - first.directCost)
}

export function monthlySpend(usage: UsageRecord[]) {
  const months = new Map<string, { month: string; total: number; byProduct: Record<Product, number> }>()
  usage.filter((record) => record.month).forEach((record) => {
    const entry = months.get(record.month!) ?? { month: record.month!, total: 0, byProduct: {} }
    entry.total += record.cost
    entry.byProduct[record.product] = (entry.byProduct[record.product] ?? 0) + record.cost
    months.set(record.month!, entry)
  })
  return [...months.values()].sort((first, second) => first.month.localeCompare(second.month))
}

const identifierColumns = ['user', 'user_id', 'userid', 'user_login', 'login', 'employee_id', 'employeeid', 'email', 'name', 'upn', 'person', 'person_id']
const columnAliases = {
  period: ['period', 'month', 'quarter'],
  product: ['product', 'tool'],
  team: ['team', 'department', 'group', 'cost_center'],
  cost: ['cost', 'spend', 'amount', 'net_cost'],
  credits: ['credits', 'consumption', 'premium_requests', 'units'],
  activeUsers: ['active_users', 'users'],
  taskSessions: ['task_sessions', 'sessions', 'tasks'],
} as const

type ColumnKey = keyof typeof columnAliases

export type UsageImportResult = { records: UsageRecord[]; errors: string[]; missing: string[]; identifier?: string }

function parseAmount(value: unknown) {
  const text = String(value ?? '').replace(/[$,\s]/g, '')
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseUsageRows(rows: Record<string, string>[], fields: string[], source: string, products: ProductDefinition[]): UsageImportResult {
  const normalized = fields.map((field) => field.trim().toLowerCase().replace(/[\s-]+/g, '_'))
  const identifier = normalized.find((field) => identifierColumns.includes(field))
  if (identifier) return { records: [], errors: [], missing: [], identifier }
  const column = (key: ColumnKey) => {
    const index = normalized.findIndex((field) => (columnAliases[key] as readonly string[]).includes(field))
    return index === -1 ? undefined : fields[index]
  }
  const columns = Object.fromEntries((Object.keys(columnAliases) as ColumnKey[]).map((key) => [key, column(key)])) as Record<ColumnKey, string | undefined>
  const missing = (['period', 'product', 'team', 'cost'] as ColumnKey[]).filter((key) => !columns[key])
  if (missing.length > 0) return { records: [], errors: [], missing }

  const records: UsageRecord[] = []
  const errors: string[] = []
  const optional = (row: Record<string, string>, key: ColumnKey) => {
    const name = columns[key]
    const value = name ? parseAmount(row[name]) : null
    return value === null || value < 0 ? undefined : value
  }
  rows.forEach((row, index) => {
    const rawPeriod = String(row[columns.period!] ?? '').trim()
    const month = normalizeMonth(rawPeriod)
    const period = month ? quarterFromMonth(month) : normalizePeriod(rawPeriod)
    const product = canonicalProductName(products, String(row[columns.product!] ?? ''))
    const rawTeam = String(row[columns.team!] ?? '').trim()
    const cost = parseAmount(row[columns.cost!])
    if (!period || !product || !rawTeam || cost === null || cost < 0) {
      errors.push(`Row ${index + 2}: needs a period (YYYY-MM or YYYY-Qn), product, team, and a non-negative cost.`)
      return
    }
    const team = ['shared', 'portfolio-wide', 'portfolio wide'].includes(rawTeam.toLowerCase()) ? SHARED_TEAM : rawTeam
    records.push({
      period,
      month: month ?? undefined,
      product,
      team,
      cost,
      credits: optional(row, 'credits'),
      activeUsers: optional(row, 'activeUsers'),
      taskSessions: optional(row, 'taskSessions'),
      source,
    })
  })
  return { records, errors, missing: [] }
}

const usageKey = (record: UsageRecord) => `${record.month ?? record.period}|${record.product}|${record.team}`

/** Replaces existing rows for the same team, product, and month (or quarter); sub-group rows are summed. */
export function upsertUsage(existing: UsageRecord[], incoming: UsageRecord[]) {
  const merged = new Map<string, UsageRecord>()
  incoming.forEach((record) => {
    const current = merged.get(usageKey(record))
    const add = (first?: number, second?: number) => (first === undefined && second === undefined ? undefined : (first ?? 0) + (second ?? 0))
    merged.set(usageKey(record), current
      ? {
          ...current,
          cost: current.cost + record.cost,
          credits: add(current.credits, record.credits),
          activeUsers: add(current.activeUsers, record.activeUsers),
          taskSessions: add(current.taskSessions, record.taskSessions),
        }
      : { ...record })
  })
  const replacements = [...merged.values()]
  const conflicts = (first: UsageRecord, second: UsageRecord) => first.period === second.period && first.product === second.product
    && first.team === second.team && (first.month === second.month || !first.month || !second.month)
  return [...existing.filter((record) => !replacements.some((replacement) => conflicts(record, replacement))), ...replacements]
}

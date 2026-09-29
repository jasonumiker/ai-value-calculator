import type { PeriodKey } from './types'

export const WEEKS_PER_QUARTER = 13
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function quarterFromMonth(month: string): PeriodKey | null {
  const match = /^(\d{4})-(\d{1,2})$/.exec(month.trim())
  if (!match) return null
  const value = Number(match[2])
  if (value < 1 || value > 12) return null
  return `${match[1]}-Q${Math.ceil(value / 3)}`
}

export function normalizeMonth(input: string): string | null {
  const match = /^(\d{4})-(\d{1,2})$/.exec(input.trim())
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return null
  return `${match[1]}-${match[2].padStart(2, '0')}`
}

/** Accepts 2026-Q3, Q3 2026, or a month such as 2026-07 and returns the quarter key. */
export function normalizePeriod(input: string): PeriodKey | null {
  const text = input.trim()
  const isoQuarter = /^(\d{4})-?Q([1-4])$/i.exec(text)
  if (isoQuarter) return `${isoQuarter[1]}-Q${isoQuarter[2]}`
  const labelQuarter = /^Q([1-4])\s+(\d{4})$/i.exec(text)
  if (labelQuarter) return `${labelQuarter[2]}-Q${labelQuarter[1]}`
  return quarterFromMonth(text)
}

export function periodLabel(period: PeriodKey) {
  const match = /^(\d{4})-Q([1-4])$/.exec(period)
  return match ? `Q${match[2]} ${match[1]}` : period || 'Period not set'
}

export function monthsOfPeriod(period: PeriodKey): string[] {
  const match = /^(\d{4})-Q([1-4])$/.exec(period)
  if (!match) return []
  const first = (Number(match[2]) - 1) * 3 + 1
  return [0, 1, 2].map((offset) => `${match[1]}-${String(first + offset).padStart(2, '0')}`)
}

export function monthLabel(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  return match ? `${monthNames[Number(match[2]) - 1]} ${match[1]}` : month
}

export function sortPeriods(periods: Iterable<PeriodKey>) {
  return [...new Set(periods)].filter((period) => /^\d{4}-Q[1-4]$/.test(period)).sort()
}

function quarterStart(period: PeriodKey) {
  const match = /^(\d{4})-Q([1-4])$/.exec(period)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), (Number(match[2]) - 1) * 3, 1))
}

/** Calendar date for a sampled session, used to give invitations recognisable context. */
export function sessionDate(period: PeriodKey, week: number, day: number) {
  const start = quarterStart(period)
  if (!start) return ''
  const date = new Date(start.getTime() + ((week - 1) * 7 + day) * 86_400_000)
  const weekday = dayNames[(date.getUTCDay() + 6) % 7]
  return `${weekday} ${date.getUTCDate()} ${monthNames[date.getUTCMonth()]}`
}

/** Days since the Unix epoch for a session's position in its quarter, so cadence rules work across quarters. */
export function absoluteDay(period: PeriodKey, week: number, day: number) {
  const start = quarterStart(period)
  return (start ? Math.round(start.getTime() / 86_400_000) : 0) + (week - 1) * 7 + day
}

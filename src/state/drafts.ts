import type { HypothesisDraft } from '../components/HypothesisModal'
import { formatHours, formatPercent } from '../domain/format'
import { WEEKS_PER_QUARTER, periodLabel } from '../domain/periods'
import type { SignalRow } from '../domain/pulse'
import type { PeriodKey, TaskSession } from '../domain/types'

/** Prefills a hypothesis from a Pulse signal, sized from the usage log so the manager starts from observed frequency. */
export function draftFromSignal(row: SignalRow, sessions: TaskSession[], period: PeriodKey, calibration: number, team?: string): HypothesisDraft {
  const matching = sessions.filter((session) => session.product === row.product && session.workType === row.workType && (!team || session.team === team))
  const people = new Set(matching.map((session) => session.personKey)).size
  const teamCounts = new Map<string, number>()
  matching.forEach((session) => teamCounts.set(session.team, (teamCounts.get(session.team) ?? 0) + 1))
  const owner = team ?? [...teamCounts.entries()].sort((first, second) => second[1] - first[1])[0]?.[0]
  const slower = row.slowerShare > row.fasterShare
  const workType = row.workType.toLowerCase()
  return {
    useCase: slower ? `Reduce rework in ${workType}` : `Scale AI-assisted ${workType}`,
    owner,
    product: row.product,
    workType: row.workType,
    expectedEffect: slower ? 'Fewer slower tasks and less rework' : row.topEffect,
    outcome: slower ? `${row.workType} delivered right first time` : `More ${workType} completed per week`,
    frequencyPerWeek: people === 0 ? 1 : Math.max(0.1, Math.round(matching.length / people / WEEKS_PER_QUARTER * 10) / 10),
    peopleAffected: Math.max(1, people),
    expectedMinutesSaved: Math.max(5, Math.round(Math.abs(row.meanHours) * 60 * (slower ? 1 : calibration))),
    studyEffort: 'Small',
    sourceSignal: `Pulse ${periodLabel(period)} · ${row.product} · ${row.workType}: ${row.responses} responses, mean ${formatHours(row.meanHours)}, ${formatPercent(row.slowerShare)} slower, most often "${row.topEffect}"`,
    successCriterion: { metric: `Time per ${workType} task`, unit: 'minutes per task', direction: 'decrease' },
  }
}

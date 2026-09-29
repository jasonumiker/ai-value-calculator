import { WEEKS_PER_QUARTER, absoluteDay, monthsOfPeriod } from './periods'
import { workTypesFor } from './products'
import { createRandom, hashString } from './random'
import { SHARED_TEAM } from './usage'
import type {
  ExclusionScope,
  FrameExclusion,
  Invitation,
  PeriodKey,
  Policy,
  ProductDefinition,
  PulseScope,
  ResponseRecord,
  SamplingFrame,
  TaskSession,
  UsageRecord,
} from './types'

export function inScope(scope: PulseScope, team: string | undefined, product: string, workType: string) {
  return team === scope.team && product === scope.product && (scope.workTypes.length === 0 || scope.workTypes.includes(workType))
}

const sessionInScope = (scope: PulseScope, session: TaskSession) => inScope(scope, session.team, session.product, session.workType)

/** Illustrative work-type mix per team; imported teams without a profile get an even mix. */
export const demoWorkMix: Record<string, Record<string, number>> = {
  'Digital Channels|GitHub Copilot': { 'Code and tests': 0.4, 'Code review': 0.2, Debugging: 0.2, Documentation: 0.1, 'Incident analysis': 0.1 },
  'Platform Engineering|GitHub Copilot': { 'Code and tests': 0.3, 'Code review': 0.25, Debugging: 0.15, Documentation: 0.1, 'Incident analysis': 0.2 },
  'Customer Operations|Copilot Cowork': { 'Research and synthesis': 0.35, 'Document drafting': 0.2, 'Customer communication': 0.3, 'Data analysis': 0.1, 'Meeting follow-up': 0.05 },
  'Enterprise Sales|Copilot Cowork': { 'Research and synthesis': 0.2, 'Document drafting': 0.35, 'Customer communication': 0.25, 'Data analysis': 0.1, 'Meeting follow-up': 0.1 },
}

const creditIntensity: Record<string, number> = {
  'Code and tests': 1.3, 'Code review': 0.8, Debugging: 1.2, Documentation: 0.7, 'Incident analysis': 1.1,
  'Research and synthesis': 1.4, 'Document drafting': 1, 'Customer communication': 0.6, 'Data analysis': 1.3, 'Meeting follow-up': 0.5,
}

export function workMixFor(team: string, product: string, products: ProductDefinition[]) {
  const workTypes = workTypesFor(products, product)
  const configured = demoWorkMix[`${team}|${product}`]
  const weights = workTypes.map((type) => (configured ? configured[type] ?? 0 : 1))
  return { workTypes, weights: weights.some((weight) => weight > 0) ? weights : workTypes.map(() => 1) }
}

function personKey(team: string, index: number) {
  return `p-${hashString(`${team}|${index}`).toString(16).padStart(8, '0').slice(0, 6)}`
}

const sessionCache = new Map<string, TaskSession[]>()

/**
 * Builds a session-level log from aggregate usage rows. In production the invitation service would read the
 * product's own session log; the browser demo synthesizes one that matches the imported counts.
 */
export function synthesizeSessions(usage: UsageRecord[], period: PeriodKey, products: ProductDefinition[]): TaskSession[] {
  const records = usage.filter((record) => record.period === period && record.team !== SHARED_TEAM && (record.taskSessions ?? 0) > 0)
  const cacheKey = JSON.stringify([period, records.map((record) => [record.month, record.product, record.team, record.taskSessions, record.activeUsers, record.credits]), products.map((product) => [product.name, product.workTypes])])
  const cached = sessionCache.get(cacheKey)
  if (cached) return cached

  const months = monthsOfPeriod(period)
  const sessions: TaskSession[] = []
  records.forEach((record) => {
    const random = createRandom(hashString(`${period}|${record.month ?? 'quarter'}|${record.team}|${record.product}`))
    const count = Math.round(record.taskSessions ?? 0)
    const people = Math.max(1, Math.round(record.activeUsers ?? Math.ceil(count / 20)))
    const cumulative: number[] = []
    for (let index = 0; index < people; index += 1) {
      const weight = 0.35 + createRandom(hashString(`${record.team}|weight|${index}`)).next() * 1.65
      cumulative.push((cumulative[index - 1] ?? 0) + weight)
    }
    const totalWeight = cumulative[cumulative.length - 1]
    const { workTypes, weights } = workMixFor(record.team, record.product, products)
    const monthIndex = record.month ? months.indexOf(record.month) : -1
    const firstDay = monthIndex >= 0 ? Math.round(monthIndex * 91 / 3) : 0
    const lastDay = monthIndex >= 0 ? Math.round((monthIndex + 1) * 91 / 3) : 91
    const rowSessions: TaskSession[] = []
    for (let index = 0; index < count; index += 1) {
      const dayOfQuarter = firstDay + Math.floor(random.next() * (lastDay - firstDay))
      const target = random.next() * totalWeight
      let low = 0
      let high = cumulative.length - 1
      while (low < high) {
        const middle = (low + high) >> 1
        if (cumulative[middle] < target) low = middle + 1
        else high = middle
      }
      const workType = random.weighted(workTypes, weights)
      rowSessions.push({
        id: '',
        period,
        month: record.month,
        week: Math.min(WEEKS_PER_QUARTER, Math.floor(dayOfQuarter / 7) + 1),
        day: random.int(0, 4),
        product: record.product,
        team: record.team,
        workType,
        personKey: personKey(record.team, low),
        credits: (creditIntensity[workType] ?? 1) * (0.6 + random.next() * 0.8),
      })
    }
    const intensity = rowSessions.reduce((sum, session) => sum + session.credits, 0)
    const credits = record.credits ?? count
    rowSessions.forEach((session) => { session.credits = intensity === 0 ? 0 : credits * session.credits / intensity })
    sessions.push(...rowSessions)
  })
  sessions.forEach((session, index) => { session.id = `${period}-s${index + 1}` })
  if (sessionCache.size > 12) sessionCache.clear()
  sessionCache.set(cacheKey, sessions)
  return sessions
}

export type SampleDraw = { frame: SamplingFrame; invitations: Invitation[]; routing: Record<string, string>; shortfall: number }

/** An earlier invitation, from the invitation service's routing, used to keep cadence caps across draws and quarters. */
export type PriorInvitation = { personKey: string; period: PeriodKey; day: number }

export function priorInvitations(invitations: Invitation[], routing: Record<string, string>): PriorInvitation[] {
  return invitations.flatMap((invitation) => {
    const personKey = routing[invitation.id]
    return personKey ? [{ personKey, period: invitation.period, day: absoluteDay(invitation.period, invitation.week, invitation.day) }] : []
  })
}

const stratumOf = (session: Pick<TaskSession, 'product' | 'workType'>) => `${session.product}|${session.workType}`

/** Largest-remainder split of a total in proportion to weights, with random tie-breaking. */
function proportionalSplit(total: number, weights: number[], random: ReturnType<typeof createRandom>) {
  const sum = weights.reduce((acc, weight) => acc + weight, 0)
  if (sum === 0 || total === 0) return weights.map(() => 0)
  const shares = weights.map((weight) => total * weight / sum)
  const counts = shares.map(Math.floor)
  let leftover = total - counts.reduce((acc, count) => acc + count, 0)
  random.shuffle(shares.map((share, index) => ({ index, fraction: share - Math.floor(share) })))
    .sort((first, second) => second.fraction - first.fraction)
    .forEach(({ index }) => {
      if (leftover > 0) { counts[index] += 1; leftover -= 1 }
    })
  return counts
}

/**
 * Stratified random sample of task sessions (product × work type). Each stratum's invitations are spread over the
 * weeks in proportion to that week's sessions, so every session has a similar chance of selection, and anyone invited
 * within the cadence window (including earlier samples) or already at the quarterly cap is skipped.
 */
export function drawSample(allSessions: TaskSession[], options: {
  period: PeriodKey
  policy: Pick<Policy, 'cadenceDays' | 'maxInvitationsPerPersonPerQuarter' | 'invitationsPerWeek' | 'minimumResponsesPerStratum' | 'minimumResponseRate'>
  policyVersion: string
  seed: number
  frameId: string
  createdAt: string
  exclusions?: ExclusionScope[]
  prior?: PriorInvitation[]
  /** Extension mode: invite this fraction of each stratum instead of applying the weekly budget. */
  fractions?: { byStratum: Record<string, number>; fallback: number }
  idPrefix?: string
}): SampleDraw {
  const { policy, frameId, period } = options
  const random = createRandom(options.seed)
  const exclusions = options.exclusions ?? []
  const excludedScopes: FrameExclusion[] = exclusions.map((exclusion) => ({
    ...exclusion,
    sessions: allSessions.filter((session) => sessionInScope(exclusion.scope, session)).length,
  }))
  const sessions = allSessions.filter((session) => !exclusions.some((exclusion) => sessionInScope(exclusion.scope, session)))
  const strataMap = new Map<string, TaskSession[]>()
  sessions.forEach((session) => {
    const members = strataMap.get(stratumOf(session))
    if (members) members.push(session)
    else strataMap.set(stratumOf(session), [session])
  })
  const strataKeys = [...strataMap.keys()].sort()
  const strata = strataKeys.map((key) => strataMap.get(key)!)

  let planned: number[]
  if (options.fractions) {
    const { byStratum, fallback } = options.fractions
    planned = strata.map((members, index) => Math.min(members.length, Math.round(members.length * (byStratum[strataKeys[index]] ?? fallback))))
  } else {
    // A draw from part of a quarter gets the matching share of the quarterly plan, leaving budget and cap room for
    // the months added later by extendSample.
    const months = new Set(sessions.map((session) => session.month))
    const share = sessions.length > 0 && sessions.every((session) => session.month) ? Math.min(1, months.size / 3) : 1
    const budget = Math.round(policy.invitationsPerWeek * WEEKS_PER_QUARTER * share)
    const minimum = Math.ceil(policy.minimumResponsesPerStratum / Math.max(policy.minimumResponseRate, 0.25) * 1.2 * share)
    const base = strata.map((members) => Math.min(members.length, minimum))
    const extra = proportionalSplit(Math.max(0, budget - base.reduce((sum, value) => sum + value, 0)), strata.map((members) => members.length), random)
    planned = strata.map((members, index) => Math.min(members.length, base[index] + extra[index]))
  }

  const weeks = Array.from({ length: WEEKS_PER_QUARTER }, (_, index) => index + 1)
  const byWeek = strata.map((members) => {
    const grouped = new Map<number, TaskSession[]>()
    members.forEach((session) => {
      const week = grouped.get(session.week)
      if (week) week.push(session)
      else grouped.set(session.week, [session])
    })
    return grouped
  })
  const weeklyTargets = planned.map((count, index) => proportionalSplit(count, weeks.map((week) => byWeek[index].get(week)?.length ?? 0), random))

  const invitedDays = new Map<string, number[]>()
  const quarterCounts = new Map<string, number>()
  ;(options.prior ?? []).forEach((earlier) => {
    invitedDays.set(earlier.personKey, [...(invitedDays.get(earlier.personKey) ?? []), earlier.day])
    if (earlier.period === period) quarterCounts.set(earlier.personKey, (quarterCounts.get(earlier.personKey) ?? 0) + 1)
  })
  const invitations: Invitation[] = []
  const routing: Record<string, string> = {}
  const drawn = strata.map(() => 0)
  const idPrefix = options.idPrefix ?? frameId
  let shortfall = 0
  weeks.forEach((week) => {
    random.shuffle(strata.map((_, index) => index)).forEach((index) => {
      let needed = weeklyTargets[index][week - 1]
      for (const session of random.shuffle(byWeek[index].get(week) ?? [])) {
        if (needed === 0) break
        const day = absoluteDay(period, week, session.day)
        const previous = invitedDays.get(session.personKey) ?? []
        if ((quarterCounts.get(session.personKey) ?? 0) >= policy.maxInvitationsPerPersonPerQuarter) continue
        if (previous.some((earlier) => Math.abs(earlier - day) < policy.cadenceDays)) continue
        invitedDays.set(session.personKey, [...previous, day])
        quarterCounts.set(session.personKey, (quarterCounts.get(session.personKey) ?? 0) + 1)
        const id = `${idPrefix}-i${invitations.length + 1}`
        invitations.push({ id, frameId, period, week, day: session.day, product: session.product, team: session.team, workType: session.workType, status: 'Pending' })
        routing[id] = session.personKey
        needed -= 1
        drawn[index] += 1
      }
      shortfall += needed
    })
  })
  invitations.sort((first, second) => first.week - second.week || first.day - second.day)

  return {
    frame: {
      id: frameId,
      period,
      createdAt: options.createdAt,
      seed: options.seed,
      status: 'Open',
      policyVersion: options.policyVersion,
      cadenceDays: policy.cadenceDays,
      maxInvitationsPerPerson: policy.maxInvitationsPerPersonPerQuarter,
      invitationsPerWeek: policy.invitationsPerWeek,
      workforce: new Set(allSessions.map((session) => session.personKey)).size,
      months: [...new Set(allSessions.flatMap((session) => (session.month ? [session.month] : [])))].sort(),
      excludedScopes,
      strata: strata.map((members, index) => {
        const teamSessions: Record<string, number> = {}
        members.forEach((session) => { teamSessions[session.team] = (teamSessions[session.team] ?? 0) + 1 })
        return { product: members[0].product, workType: members[0].workType, eligibleSessions: members.length, teamSessions, planned: planned[index], drawn: drawn[index] }
      }),
    },
    invitations,
    routing,
    shortfall,
  }
}

/** Months in the quarter's bill that the sample has not covered yet, whether or not they have task sessions. */
export function uncoveredMonths(frame: SamplingFrame, months: string[]) {
  if (frame.months.length === 0) return []
  return [...new Set(months)].filter((month) => !frame.months.includes(month)).sort()
}

export const sessionMonths = (sessions: TaskSession[]) => [...new Set(sessions.flatMap((session) => (session.month ? [session.month] : [])))].sort()

/**
 * Adds invitations for months that arrived after the sample was drawn, at each stratum's original sampling fraction so
 * sessions from every month keep a similar chance of selection. Cadence caps include every earlier invitation.
 */
export function extendSample(frame: SamplingFrame, allSessions: TaskSession[], invitations: Invitation[], routing: Record<string, string>, seed: number): SampleDraw {
  const months = uncoveredMonths(frame, sessionMonths(allSessions))
  if (months.length === 0) throw new Error('No new months with task sessions to add. Months with cost but no task sessions cannot be sampled.')
  const newSessions = allSessions.filter((session) => session.month && months.includes(session.month))
  const eligible = frame.strata.reduce((sum, stratum) => sum + stratum.eligibleSessions, 0)
  const drawnTotal = frame.strata.reduce((sum, stratum) => sum + stratum.drawn, 0)
  const extension = drawSample(newSessions, {
    period: frame.period,
    policy: { cadenceDays: frame.cadenceDays, maxInvitationsPerPersonPerQuarter: frame.maxInvitationsPerPerson, invitationsPerWeek: frame.invitationsPerWeek, minimumResponsesPerStratum: 0, minimumResponseRate: 1 },
    policyVersion: frame.policyVersion,
    seed,
    frameId: frame.id,
    createdAt: frame.createdAt,
    exclusions: frame.excludedScopes,
    prior: priorInvitations(invitations, routing),
    fractions: {
      byStratum: Object.fromEntries(frame.strata.map((stratum) => [stratumOf(stratum), stratum.eligibleSessions === 0 ? 0 : stratum.drawn / stratum.eligibleSessions])),
      fallback: eligible === 0 ? 0 : drawnTotal / eligible,
    },
    idPrefix: `${frame.id}-${months[0]}`,
  })
  const merged = new Map(frame.strata.map((stratum) => [stratumOf(stratum), { ...stratum, teamSessions: { ...stratum.teamSessions } }]))
  extension.frame.strata.forEach((stratum) => {
    const current = merged.get(stratumOf(stratum))
    if (!current) {
      merged.set(stratumOf(stratum), stratum)
      return
    }
    current.eligibleSessions += stratum.eligibleSessions
    current.planned += stratum.planned
    current.drawn += stratum.drawn
    Object.entries(stratum.teamSessions).forEach(([team, count]) => { current.teamSessions[team] = (current.teamSessions[team] ?? 0) + count })
  })
  const excludedScopes = frame.excludedScopes.map((scope) => ({
    ...scope,
    sessions: scope.sessions + (extension.frame.excludedScopes.find((added) => added.claimId === scope.claimId)?.sessions ?? 0),
  }))
  return {
    ...extension,
    frame: {
      ...frame,
      months: [...new Set([...frame.months, ...months])].sort(),
      workforce: new Set(allSessions.map((session) => session.personKey)).size,
      excludedScopes,
      strata: [...merged.values()].sort((first, second) => stratumOf(first).localeCompare(stratumOf(second))),
    },
  }
}

export function invitationCounts(invitations: Invitation[], frameId: string) {
  const frameInvitations = invitations.filter((invitation) => invitation.frameId === frameId)
  const count = (status: Invitation['status']) => frameInvitations.filter((invitation) => invitation.status === status).length
  const pending = count('Pending')
  return { total: frameInvitations.length, pending, responded: count('Responded'), declined: count('Declined'), expired: count('Expired'), closed: frameInvitations.length - pending }
}

export function weeklyInvitations(invitations: Invitation[], frameId: string) {
  return Array.from({ length: WEEKS_PER_QUARTER }, (_, index) => {
    const week = invitations.filter((invitation) => invitation.frameId === frameId && invitation.week === index + 1)
    return { week: index + 1, invited: week.length, responded: week.filter((invitation) => invitation.status === 'Responded').length }
  })
}

/** Aggregate burden only: the per-person routing never leaves the invitation service. */
export function burdenStats(frame: SamplingFrame, invitations: Invitation[], responses: ResponseRecord[], routing: Record<string, string>) {
  const frameInvitations = invitations.filter((invitation) => invitation.frameId === frame.id)
  const perPerson = new Map<string, number>()
  frameInvitations.forEach((invitation) => {
    const person = routing[invitation.id]
    if (person) perPerson.set(person, (perPerson.get(person) ?? 0) + 1)
  })
  const answered = responses.filter((response) => response.frameId === frame.id && response.source === 'Random invitation')
  const seconds = answered.map((response) => response.secondsToAnswer ?? 0).sort((first, second) => first - second)
  const answerSeconds = seconds.reduce((sum, value) => sum + value, 0)
  return {
    invitations: frameInvitations.length,
    peopleInvited: perPerson.size,
    workforce: frame.workforce,
    shareInvited: frame.workforce === 0 ? 0 : perPerson.size / frame.workforce,
    maxPerPerson: Math.max(0, ...perPerson.values()),
    meanPerInvitedPerson: perPerson.size === 0 ? 0 : frameInvitations.length / perPerson.size,
    responses: answered.length,
    answerSeconds,
    answerHours: answerSeconds / 3600,
    medianSeconds: seconds.length === 0 ? 0 : seconds[Math.floor((seconds.length - 1) / 2)],
  }
}

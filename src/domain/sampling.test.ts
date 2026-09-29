import { describe, expect, it } from 'vitest'
import { defaultPolicy } from './policy'
import { defaultProducts, registerProducts } from './products'
import { absoluteDay } from './periods'
import { burdenStats, drawSample, extendSample, invitationCounts, priorInvitations, sessionMonths, synthesizeSessions, uncoveredMonths } from './sampling'
import { createDemoData } from './seed'
import { answerInvitation, closeFrame, declineInvitation, nextPendingInvitation, previewResponse } from './survey'
import type { UsageRecord } from './types'
import { SHARED_TEAM, parseUsageRows, teamCosts, upsertUsage } from './usage'

const usage: UsageRecord[] = [
  { period: '2026-Q3', month: '2026-07', product: 'GitHub Copilot', team: 'Alpha', cost: 1000, credits: 3000, activeUsers: 20, taskSessions: 600, source: 'test' },
  { period: '2026-Q3', month: '2026-08', product: 'GitHub Copilot', team: 'Alpha', cost: 1000, credits: 3000, activeUsers: 20, taskSessions: 600, source: 'test' },
  { period: '2026-Q3', month: '2026-09', product: 'GitHub Copilot', team: 'Alpha', cost: 1000, credits: 3000, activeUsers: 20, taskSessions: 600, source: 'test' },
  { period: '2026-Q3', month: '2026-07', product: 'Copilot Cowork', team: 'Beta', cost: 3000, credits: 2000, activeUsers: 30, taskSessions: 900, source: 'test' },
  { period: '2026-Q3', month: '2026-07', product: 'Copilot Cowork', team: SHARED_TEAM, cost: 400, source: 'test' },
]

const drawOptions = { period: '2026-Q3', policy: defaultPolicy, policyVersion: 'policy-v1', seed: 42, frameId: 'frame-test', createdAt: '2026-06-24T00:00:00.000Z' }

describe('bill import and team split', () => {
  it('accepts aliases, sums sub-group rows, and rejects direct identifiers', () => {
    const rows = [
      { Month: '2026-10', Tool: 'GitHub Copilot', Department: 'Alpha', Spend: '$1,200', Sessions: '300', Users: '10' },
      { Month: '2026-10', Tool: 'GitHub Copilot', Department: 'Alpha', Spend: '800', Sessions: '200', Users: '5' },
      { Month: '2026-13', Tool: 'GitHub Copilot', Department: 'Alpha', Spend: '5', Sessions: '1', Users: '1' },
    ]
    const parsed = parseUsageRows(rows, ['Month', 'Tool', 'Department', 'Spend', 'Sessions', 'Users'], 'upload.csv', defaultProducts)
    expect(parsed.records).toHaveLength(2)
    expect(parsed.errors).toHaveLength(1)
    const merged = upsertUsage([], parsed.records)
    expect(merged).toEqual([expect.objectContaining({ period: '2026-Q4', month: '2026-10', cost: 2000, taskSessions: 500, activeUsers: 15 })])

    expect(parseUsageRows([{ email: 'a@b.c', cost: '1' }], ['email', 'product', 'team', 'period', 'cost'], 'x.csv', defaultProducts).identifier).toBe('email')
    expect(parseUsageRows([], ['product', 'cost'], 'x.csv', defaultProducts).missing).toEqual(['period', 'team'])
  })

  it('replaces rows for the same team, product, and month, including quarter-level conflicts', () => {
    const replaced = upsertUsage(usage, [{ ...usage[0], cost: 5, source: 'new' }])
    expect(replaced.filter((record) => record.team === 'Alpha' && record.month === '2026-07')).toEqual([expect.objectContaining({ cost: 5 })])
    const quarterly = upsertUsage(usage, [{ period: '2026-Q3', product: 'GitHub Copilot', team: 'Alpha', cost: 9, source: 'q' }])
    const alphaRows = quarterly.filter((record) => record.team === 'Alpha')
    expect(alphaRows).toHaveLength(1)
    expect(alphaRows[0]).toMatchObject({ cost: 9 })
    expect(alphaRows[0].month).toBeUndefined()
  })

  it('allocates shared and change costs by each team’s share of direct spend', () => {
    const teams = teamCosts(usage, '2026-Q3', { implementation: 1000, enablement: 0, operations: 0 })
    const alpha = teams.find((team) => team.team === 'Alpha')!
    expect(alpha.directCost).toBe(3000)
    expect(alpha.sharedAllocation).toBeCloseTo(200, 5)
    expect(alpha.changeAllocation).toBeCloseTo(500, 5)
    expect(teams.some((team) => team.team === SHARED_TEAM)).toBe(false)
    expect(teams.reduce((sum, team) => sum + team.totalCost, 0)).toBeCloseTo(6000 + 400 + 1000, 5)
  })

  it('registers unknown products from imports with category defaults', () => {
    const products = registerProducts(defaultProducts, ['Azure AI agents', 'github copilot'])
    expect(products.map((product) => product.name)).toEqual(['GitHub Copilot', 'Copilot Cowork', 'Azure AI agents'])
    expect(products[2].workTypes.length).toBeGreaterThan(0)
  })
})

describe('sampling engine', () => {
  it('synthesizes a deterministic session log that matches the bill’s counts and credits', () => {
    const sessions = synthesizeSessions(usage, '2026-Q3', defaultProducts)
    expect(sessions).toHaveLength(2700)
    expect(synthesizeSessions(usage, '2026-Q3', defaultProducts)).toBe(sessions)
    const alphaCredits = sessions.filter((session) => session.team === 'Alpha').reduce((sum, session) => sum + session.credits, 0)
    expect(alphaCredits).toBeCloseTo(9000, 5)
    expect(new Set(sessions.filter((session) => session.team === 'Alpha').map((session) => session.personKey)).size).toBeLessThanOrEqual(20)
    expect(sessions.every((session) => session.week >= 1 && session.week <= 13 && session.day >= 0 && session.day <= 4)).toBe(true)
  })

  it('stratifies by product and work type and never breaks the cadence or quarterly cap', () => {
    const sessions = synthesizeSessions(usage, '2026-Q3', defaultProducts)
    const { frame, invitations, routing } = drawSample(sessions, drawOptions)
    expect(frame.strata.map((stratum) => `${stratum.product}|${stratum.workType}`)).toContain('GitHub Copilot|Code and tests')
    expect(frame.strata.every((stratum) => stratum.drawn <= stratum.planned && stratum.planned <= stratum.eligibleSessions)).toBe(true)
    const days = new Map<string, number[]>()
    invitations.forEach((invitation) => {
      const person = routing[invitation.id]
      days.set(person, [...(days.get(person) ?? []), (invitation.week - 1) * 7 + invitation.day])
    })
    days.forEach((personDays) => {
      expect(personDays.length).toBeLessThanOrEqual(defaultPolicy.maxInvitationsPerPersonPerQuarter)
      const sorted = [...personDays].sort((first, second) => first - second)
      sorted.slice(1).forEach((day, index) => expect(day - sorted[index]).toBeGreaterThanOrEqual(defaultPolicy.cadenceDays))
    })
    expect(invitations.every((invitation) => !('personKey' in invitation))).toBe(true)
  })

  it('gives sessions in busy and quiet weeks a similar chance of selection', () => {
    const ramp: UsageRecord[] = [
      { period: '2026-Q4', month: '2026-10', product: 'GitHub Copilot', team: 'Alpha', cost: 100, activeUsers: 400, taskSessions: 300, source: 't' },
      { period: '2026-Q4', month: '2026-11', product: 'GitHub Copilot', team: 'Alpha', cost: 100, activeUsers: 400, taskSessions: 1500, source: 't' },
      { period: '2026-Q4', month: '2026-12', product: 'GitHub Copilot', team: 'Alpha', cost: 100, activeUsers: 400, taskSessions: 4500, source: 't' },
    ]
    const sessions = synthesizeSessions(ramp, '2026-Q4', defaultProducts)
    const { invitations } = drawSample(sessions, { ...drawOptions, period: '2026-Q4', policy: { ...defaultPolicy, cadenceDays: 0, maxInvitationsPerPersonPerQuarter: 50 } })
    const rate = (weeks: number[]) => invitations.filter((invitation) => weeks.includes(invitation.week)).length / sessions.filter((session) => weeks.includes(session.week)).length
    const early = rate([1, 2, 3, 4])
    const late = rate([10, 11, 12, 13])
    expect(late / early).toBeGreaterThan(0.7)
    expect(late / early).toBeLessThan(1.4)
  })

  it('keeps the cadence rule across quarters using earlier invitations', () => {
    const data = createDemoData()
    const days = new Map<string, number[]>()
    data.invitations.forEach((invitation) => {
      const person = data.routing[invitation.id]
      days.set(person, [...(days.get(person) ?? []), absoluteDay(invitation.period, invitation.week, invitation.day)])
    })
    days.forEach((personDays) => {
      const sorted = [...personDays].sort((first, second) => first - second)
      sorted.slice(1).forEach((day, index) => expect(day - sorted[index]).toBeGreaterThanOrEqual(defaultPolicy.cadenceDays))
    })
    const sessions = synthesizeSessions(usage, '2026-Q3', defaultProducts)
    const everyone = [...new Set(sessions.map((session) => session.personKey))]
    const blocked = everyone.map((personKey) => ({ personKey, period: '2026-Q2', day: absoluteDay('2026-Q3', 1, 0) - 1 }))
    const { invitations } = drawSample(sessions, { ...drawOptions, prior: blocked })
    expect(invitations.every((invitation) => invitation.week > 2)).toBe(true)
    expect(priorInvitations(data.invitations, data.routing)).toHaveLength(data.invitations.length)
  })

  it('records team counts and covered months, and extends a partial sample at the original rate', () => {
    const july = usage.filter((record) => record.month !== '2026-08' && record.month !== '2026-09')
    const partial = drawSample(synthesizeSessions(july, '2026-Q3', defaultProducts), drawOptions)
    expect(partial.frame.months).toEqual(['2026-07'])
    expect(partial.frame.strata.reduce((sum, stratum) => sum + Object.values(stratum.teamSessions).reduce((acc, count) => acc + count, 0), 0)).toBe(1500)
    const full = synthesizeSessions(usage, '2026-Q3', defaultProducts)
    expect(uncoveredMonths(partial.frame, sessionMonths(full))).toEqual(['2026-08', '2026-09'])

    const extended = extendSample(partial.frame, full, partial.invitations, partial.routing, 7)
    expect(extended.frame.months).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(extended.frame.strata.reduce((sum, stratum) => sum + stratum.eligibleSessions, 0)).toBe(2700)
    expect(extended.invitations.every((invitation) => invitation.week >= 5 && invitation.id.startsWith('frame-test-2026-08'))).toBe(true)
    expect(uncoveredMonths(extended.frame, sessionMonths(full))).toEqual([])
    expect(() => extendSample(extended.frame, full, [...partial.invitations, ...extended.invitations], { ...partial.routing, ...extended.routing }, 8)).toThrow(/No new months/)
  })

  it('sizes a partial-quarter draw to its share of the plan, so draw plus extension stays near the quarterly budget', () => {
    const data = createDemoData()
    const q3 = data.usage.filter((record) => record.period === '2026-Q3')
    const policy = { ...defaultPolicy, cadenceDays: 0, maxInvitationsPerPersonPerQuarter: 50 }
    const july = drawSample(synthesizeSessions(q3.filter((record) => record.month === '2026-07'), '2026-Q3', defaultProducts), { ...drawOptions, policy })
    const plan = defaultPolicy.invitationsPerWeek * 13
    expect(july.invitations.length).toBeLessThan(plan * 0.45)
    const extended = extendSample(july.frame, synthesizeSessions(q3, '2026-Q3', defaultProducts), july.invitations, july.routing, 11)
    const total = july.invitations.length + extended.invitations.length
    expect(total).toBeGreaterThan(plan * 0.8)
    expect(total).toBeLessThan(plan * 1.25)
  })

  it('spreads the demo sample across every week of the quarter', () => {
    const data = createDemoData()
    const weeks = new Set(data.invitations.filter((invitation) => invitation.period === '2026-Q2').map((invitation) => invitation.week))
    expect(weeks.size).toBe(13)
  })

  it('leaves registered study scopes out of the frame before sampling', () => {
    const sessions = synthesizeSessions(usage, '2026-Q3', defaultProducts)
    const scope = { claimId: 'study-a', claimName: 'Study A', scope: { team: 'Alpha', product: 'GitHub Copilot', workTypes: [] } }
    const { frame, invitations } = drawSample(sessions, { ...drawOptions, exclusions: [scope] })
    expect(frame.excludedScopes).toEqual([expect.objectContaining({ claimId: 'study-a', sessions: 1800 })])
    expect(invitations.some((invitation) => invitation.team === 'Alpha')).toBe(false)
    expect(frame.strata.reduce((sum, stratum) => sum + stratum.eligibleSessions, 0)).toBe(900)
  })

  it('spreads a partial quarter only across weeks with sessions', () => {
    const july = usage.filter((record) => record.month === '2026-07')
    const { invitations, shortfall } = drawSample(synthesizeSessions(july, '2026-Q3', defaultProducts), drawOptions)
    expect(Math.max(...invitations.map((invitation) => invitation.week))).toBeLessThanOrEqual(5)
    expect(invitations.length + shortfall).toBeGreaterThan(0)
  })

  it('reports burden in aggregate from the invitation service', () => {
    const data = createDemoData()
    const frame = data.frames.find((candidate) => candidate.period === '2026-Q3')!
    const burden = burdenStats(frame, data.invitations, data.responses, data.routing)
    expect(burden.maxPerPerson).toBeLessThanOrEqual(defaultPolicy.maxInvitationsPerPersonPerQuarter)
    expect(burden.peopleInvited).toBeLessThan(burden.workforce)
    expect(burden.answerHours).toBeLessThan(3)
    expect(invitationCounts(data.invitations, frame.id).pending).toBeGreaterThan(0)
  })
})

describe('random invitations and answers', () => {
  it('records the stratum but never the person, and closes the invitation', () => {
    const data = createDemoData()
    const invitation = nextPendingInvitation(data.invitations, data.frames)!
    expect(invitation.status).toBe('Pending')
    const answered = answerInvitation(data.invitations, data.responses, invitation.id, { hours: 1, effect: 'Faster delivery', reuse: 'Other priority work', secondsToAnswer: 18 })
    const response = answered.responses[0]
    expect(response).toMatchObject({ invitationId: invitation.id, frameId: invitation.frameId, team: invitation.team, workType: invitation.workType, hours: 1, source: 'Random invitation' })
    expect(JSON.stringify(response)).not.toContain(data.routing[invitation.id])
    expect(answered.invitations.find((candidate) => candidate.id === invitation.id)?.status).toBe('Responded')
    expect(() => answerInvitation(answered.invitations, answered.responses, invitation.id, { hours: 1, effect: 'Faster delivery', secondsToAnswer: 5 })).toThrow(/no longer open/)
    expect(() => answerInvitation(data.invitations, data.responses, invitation.id, { hours: 9, effect: 'Faster delivery', secondsToAnswer: 5 })).toThrow(/between/)
  })

  it('drops the reuse answer for tasks that were not faster and keeps previews out of the random sample', () => {
    const data = createDemoData()
    const invitation = nextPendingInvitation(data.invitations, data.frames)!
    const slower = answerInvitation(data.invitations, data.responses, invitation.id, { hours: -0.5, effect: 'More rework or lower quality', reuse: 'Other priority work', secondsToAnswer: 12 })
    expect(slower.responses[0].reuse).toBeUndefined()
    const preview = previewResponse({ hours: 2, effect: 'Faster delivery', secondsToAnswer: 10, period: '2026-Q3', product: 'GitHub Copilot', team: 'Alpha', workType: 'Code review' })
    expect(preview).toMatchObject({ source: 'Preview' })
    expect(preview.invitationId).toBeUndefined()
  })

  it('counts declines and expires open invitations when a sample closes', () => {
    const data = createDemoData()
    const invitation = nextPendingInvitation(data.invitations, data.frames)!
    expect(declineInvitation(data.invitations, invitation.id).find((candidate) => candidate.id === invitation.id)?.status).toBe('Declined')
    const closed = closeFrame(data.frames, data.invitations, invitation.frameId)
    expect(closed.frames.find((frame) => frame.id === invitation.frameId)?.status).toBe('Closed')
    expect(closed.invitations.filter((candidate) => candidate.frameId === invitation.frameId && candidate.status === 'Pending')).toHaveLength(0)
    expect(nextPendingInvitation(closed.invitations, closed.frames)).toBeUndefined()
  })
})

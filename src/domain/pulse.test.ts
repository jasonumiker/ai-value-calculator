import { describe, expect, it } from 'vitest'
import { combinePulseWithPortfolio } from './portfolio'
import { defaultPolicy } from './policy'
import { calibrationEntries, calibrationForStratum, estimatePulse, modelledTaskValue, reuseSummary, signalRows, unitEconomics } from './pulse'
import { createDemoData } from './seed'
import type { Invitation, ResponseRecord, SamplingFrame, StudyRecord, TaskSession, UsageRecord } from './types'

const frame: SamplingFrame = {
  id: 'frame-t', period: '2026-Q3', createdAt: '', seed: 1, status: 'Closed', policyVersion: 'policy-v1', cadenceDays: 14,
  maxInvitationsPerPerson: 3, invitationsPerWeek: 24, workforce: 100, excludedScopes: [], months: ['2026-07', '2026-08', '2026-09'],
  strata: [{ product: 'GitHub Copilot', workType: 'Code review', eligibleSessions: 1000, teamSessions: { Alpha: 600, Beta: 400 }, planned: 12, drawn: 12 }],
}

const answers = (hours: number[], team = 'Alpha', workType = 'Code review'): { invitations: Invitation[]; responses: ResponseRecord[] } => {
  const invitations: Invitation[] = hours.map((_, index) => ({ id: `i${team}${index}`, frameId: 'frame-t', period: '2026-Q3', week: 1, day: 0, product: 'GitHub Copilot', team, workType, status: 'Responded' }))
  const responses: ResponseRecord[] = hours.map((value, index) => ({
    id: `r${team}${index}`, period: '2026-Q3', product: 'GitHub Copilot', team, workType, hours: value, effect: 'Faster delivery',
    reuse: value > 0 ? 'More of the same work' : undefined, date: '', source: 'Random invitation', frameId: 'frame-t', invitationId: `i${team}${index}`, secondsToAnswer: 20,
  }))
  return { invitations, responses }
}

const sessions: TaskSession[] = Array.from({ length: 1000 }, (_, index) => ({
  id: `s${index}`, period: '2026-Q3', month: ['2026-07', '2026-08', '2026-09'][index % 3], week: 1 + (index % 13), day: index % 5, product: 'GitHub Copilot',
  team: index < 600 ? 'Alpha' : 'Beta', workType: 'Code review', personKey: `p${index % 50}`, credits: 1,
}))

const baseInput = (hours: number[], policy = defaultPolicy) => {
  const { invitations, responses } = answers(hours)
  return { period: '2026-Q3', frames: [frame], invitations, responses, sessions, exclusions: [], calibration: [], policy }
}

describe('reuse and calibration', () => {
  it('weights surveyed reuse by hours and falls back to the policy default below the answer threshold', () => {
    const responses: ResponseRecord[] = [
      { ...answers([3]).responses[0], reuse: 'More of the same work' },
      { ...answers([1]).responses[0], id: 'x', reuse: 'Finished earlier or nothing specific' },
    ]
    expect(reuseSummary(responses, defaultPolicy)).toMatchObject({ source: 'Policy default', rate: defaultPolicy.defaultCapacityRealization })
    expect(reuseSummary(responses, { ...defaultPolicy, minimumReuseAnswers: 2 })).toMatchObject({ source: 'Survey', rate: 0.75 })
  })

  it('calibrates self-reports with a matching timing study and bounds the factor to 0–100%', () => {
    const reported = answers([0.5, 0.5, 0.5, 0.5, 0.5]).responses
    const study = { id: 'study', name: 'Review timing', product: 'GitHub Copilot', workType: 'Code review', progress: 100, metricUnit: 'minutes per task', control: { n: 30, mean: 40, sd: 10 }, treatment: { n: 30, mean: 25, sd: 10 } } as StudyRecord
    const [entry] = calibrationEntries([study], reported)
    expect(entry.factor).toBeCloseTo(0.5, 5)
    expect(calibrationForStratum('GitHub Copilot|Code review', [entry], defaultPolicy)).toMatchObject({ source: 'Study', factor: entry.factor })
    expect(calibrationForStratum('GitHub Copilot|Code review', [entry], { ...defaultPolicy, useStudyCalibration: false }).source).toBe('Policy default')

    const slower = calibrationEntries([{ ...study, treatment: { n: 30, mean: 45, sd: 10 } }], reported)[0]
    expect(slower.factor).toBe(0)
    expect(slower.note).toMatch(/slowdown/)
    expect(calibrationEntries([{ ...study, metricUnit: 'days' }], reported)).toHaveLength(0)
  })

  it('charges slower tasks at the full rate unless the CFO chooses symmetric discounts', () => {
    expect(modelledTaskValue(1, 0.5, 0.5, defaultPolicy)).toBe(12.5)
    expect(modelledTaskValue(-1, 0.5, 0.5, defaultPolicy)).toBe(-50)
    expect(modelledTaskValue(-1, 0.5, 0.5, { ...defaultPolicy, lossTreatment: 'Same discounts' })).toBe(-12.5)
  })
})

describe('stratified Pulse projection', () => {
  it('projects the stratum mean to its population with a sampling interval', () => {
    const projection = estimatePulse(baseInput([1, 0.5, 0, 0.5, 1, 0.5, -0.25, 0.25, 0.5, 1]))
    expect(projection.projectionEligible).toBe(true)
    expect(projection.estimatedHours).toBeCloseTo(1000 * 0.5, 5)
    expect(projection.valueInterval.low).toBeLessThan(projection.estimatedValue)
    expect(projection.valueInterval.high).toBeGreaterThan(projection.estimatedValue)
    expect(projection.responseRate).toBe(1)
  })

  it('withholds the projection when a stratum lacks responses or a sample', () => {
    expect(estimatePulse(baseInput([1, 1, 1])).reasons[0]).toMatch(/3 of 8 required responses/)
    const noFrame = estimatePulse({ ...baseInput([1]), frames: [] })
    expect(noFrame.projectionEligible).toBe(false)
    expect(noFrame.projectionReason).toMatch(/No random sample/)
  })

  it('removes the sessions and answers of claims approved after the draw, but not scopes already excluded', () => {
    const { invitations, responses } = answers(Array(10).fill(1), 'Alpha')
    const beta = answers(Array(10).fill(0.5), 'Beta')
    const scope = { claimId: 'claim-a', claimName: 'Claim A', scope: { team: 'Alpha', product: 'GitHub Copilot', workTypes: ['Code review'] } }
    const input = { ...baseInput([]), invitations: [...invitations, ...beta.invitations], responses: [...responses, ...beta.responses] }
    const late = estimatePulse({ ...input, exclusions: [scope] })
    expect(late.strata[0]).toMatchObject({ population: 400, excluded: 600, responses: 10, meanHours: 0.5 })
    expect(late.lateExclusions).toEqual([expect.objectContaining({ claimId: 'claim-a', sessions: 600 })])

    const alreadyExcluded = estimatePulse({ ...input, frames: [{ ...frame, excludedScopes: [{ ...scope, sessions: 600 }] }], exclusions: [scope] })
    expect(alreadyExcluded.lateExclusions).toHaveLength(0)
    expect(alreadyExcluded.strata[0].population).toBe(1000)
  })

  it('never subtracts sessions a sample had already left out when a second claim covers the same work', () => {
    const study = { claimId: 'study-a', claimName: 'Study A', scope: { team: 'Alpha', product: 'GitHub Copilot', workTypes: ['Code review'] } }
    const drawnWithout: SamplingFrame = { ...frame, excludedScopes: [{ ...study, sessions: 600 }], strata: [{ ...frame.strata[0], eligibleSessions: 400, teamSessions: { Beta: 400 } }] }
    const beta = answers(Array(10).fill(0.5), 'Beta')
    const second = { claimId: 'claim-b', claimName: 'Claim B', scope: { team: 'Alpha', product: 'GitHub Copilot', workTypes: [] } }
    const projection = estimatePulse({ ...baseInput([]), frames: [drawnWithout], invitations: beta.invitations, responses: beta.responses, exclusions: [study, second] })
    expect(projection.strata[0]).toMatchObject({ population: 400, excluded: 0, responses: 10 })
    expect(projection.lateExclusions).toHaveLength(0)
    expect(projection.projectionEligible).toBe(true)
  })

  it('withholds the projection when the bill has months the sample does not cover', () => {
    const partial = estimatePulse({ ...baseInput([1, 0.5, 0, 0.5, 1, 0.5, -0.25, 0.25, 0.5, 1]), frames: [{ ...frame, months: ['2026-07'] }] })
    expect(partial.projectionEligible).toBe(false)
    expect(partial.projectionReason).toMatch(/doesn’t cover Aug 2026, Sep 2026/)
    const costOnly = estimatePulse({ ...baseInput([1, 0.5, 0, 0.5, 1, 0.5, -0.25, 0.25, 0.5, 1]), billMonths: ['2026-07', '2026-08', '2026-09', '2026-10'] })
    expect(costOnly.projectionEligible).toBe(false)
    expect(costOnly.projectionReason).toMatch(/Oct 2026 has cost but no task sessions/)
  })

  it('keeps validated ROI separate and exposes a Pulse-inclusive interval', () => {
    const projection = estimatePulse(baseInput([1, 0.5, 0, 0.5, 1, 0.5, -0.25, 0.25, 0.5, 1]))
    const combined = combinePulseWithPortfolio(10000, 20000, projection)
    expect(combined.value).toBeCloseTo(10000 + projection.estimatedValue, 5)
    expect(combined.roiInterval.low).toBeLessThan(combined.roi)
    expect(combinePulseWithPortfolio(10000, 20000, { ...projection, projectionEligible: false }).roi).toBe(-0.5)
  })
})

describe('unit economics and signals', () => {
  it('compares cost per session with modelled value per session', () => {
    const projection = estimatePulse(baseInput(Array(10).fill(1)))
    const usage: UsageRecord[] = [{ period: '2026-Q3', product: 'GitHub Copilot', team: 'Alpha', cost: 2000, source: 't' }]
    const [row] = unitEconomics(projection, sessions, usage, defaultPolicy)
    expect(row.costPerSession).toBeCloseTo(2, 5)
    expect(row.valuePerSession).toBeCloseTo(50 * 0.75 * defaultPolicy.defaultCapacityRealization, 5)
    expect(row.status).toBe('Worth it')
    const [loss] = unitEconomics(estimatePulse(baseInput(Array(10).fill(-1))), sessions, usage, defaultPolicy)
    expect(loss.status).toBe('Not worth it')
  })

  it('hides aggregate signals for groups below the reporting threshold', () => {
    const rows = signalRows([...answers([1, 1, 1, 1, 1]).responses, ...answers([1, 1], 'Beta', 'Debugging').responses], 5)
    expect(rows.find((row) => row.workType === 'Code review')).toMatchObject({ suppressed: false, meanHours: 1 })
    expect(rows.find((row) => row.workType === 'Debugging')).toMatchObject({ suppressed: true, meanHours: 0, topEffect: '' })
  })

  it('makes the long tail material in the demo while showing a METR-style calibration', () => {
    const data = createDemoData()
    const entries = calibrationEntries(data.studies, data.responses)
    const debugging = entries.find((entry) => entry.workType === 'Debugging')!
    const research = entries.find((entry) => entry.workType === 'Research and synthesis')!
    expect(debugging.factor).toBe(0)
    expect(research.factor).toBeGreaterThan(0.4)
    expect(research.factor).toBeLessThan(0.9)
  })
})

import { teamDecisionRows } from '../domain/decisions'
import { portfolioHitRate, rankHypotheses } from '../domain/hypotheses'
import { sortPeriods } from '../domain/periods'
import { calculatePortfolio, combinePulseWithPortfolio, eligibleClaims } from '../domain/portfolio'
import { calibrationEntries, estimatePulse, isRandomResponse, productEconomics, signalRows, unitEconomics } from '../domain/pulse'
import { burdenStats, synthesizeSessions } from '../domain/sampling'
import { billMonths, monthlySpend, usagePeriods } from '../domain/usage'
import type { AppData, ExclusionScope, PeriodKey, Policy, ValueClaim } from '../domain/types'

export function allClaims(data: AppData): ValueClaim[] {
  return [...data.studies, ...data.claims]
}

export function availablePeriods(data: AppData) {
  return sortPeriods([...usagePeriods(data.usage), ...data.frames.map((frame) => frame.period), ...allClaims(data).map((claim) => claim.period)])
}

export function exclusionScopes(claims: ValueClaim[], period: PeriodKey): ExclusionScope[] {
  return eligibleClaims(claims, period).eligible
    .filter((claim) => claim.pulseScope)
    .map((claim) => ({ claimId: claim.id, claimName: claim.name, scope: claim.pulseScope! }))
}

/** Scopes to remove when drawing a new sample: work under a registered study for the period, plus approved claims. */
export function registeredScopes(data: AppData, period: PeriodKey): ExclusionScope[] {
  const studyScopes = data.studies
    .filter((study) => (study.period === period || (!study.period && !!study.preRegisteredAt)) && study.pulseScope)
    .map((study) => ({ claimId: study.id, claimName: study.name, scope: study.pulseScope! }))
  const claimScopes = exclusionScopes(allClaims(data), period).filter((scope) => !studyScopes.some((study) => study.claimId === scope.claimId))
  return [...studyScopes, ...claimScopes]
}

/** Everything the screens need for one reporting period, under the published policy or a draft being previewed. */
export function derivePeriod(data: AppData, period: PeriodKey, policy: Policy = data.policy) {
  const claims = allClaims(data)
  const sessions = synthesizeSessions(data.usage, period, data.products)
  const randomResponses = data.responses.filter(isRandomResponse)
  const calibration = calibrationEntries(data.studies, randomResponses)
  const projection = estimatePulse({
    period,
    frames: data.frames,
    invitations: data.invitations,
    responses: data.responses,
    sessions,
    exclusions: exclusionScopes(claims, period),
    calibration,
    policy,
    billMonths: billMonths(data.usage, period),
  })
  const portfolio = calculatePortfolio({ period, claims, usage: data.usage, changeCosts: data.changeCosts, policy })
  const combined = combinePulseWithPortfolio(portfolio.adjustedValue, portfolio.totalCost, projection)
  const economics = unitEconomics(projection, sessions, data.usage, policy)
  const frame = projection.frame
  return {
    period,
    policy,
    claims,
    sessions,
    calibration,
    projection,
    portfolio,
    combined,
    economics,
    productEconomics: productEconomics(economics, projection),
    burden: frame ? burdenStats(frame, data.invitations, data.responses, data.routing) : undefined,
    signals: signalRows(randomResponses.filter((response) => response.period === period), policy.minimumReportingGroup),
    teams: teamDecisionRows({ period, usage: data.usage, changeCosts: data.changeCosts, portfolio, hypotheses: data.hypotheses, studies: data.studies, decisions: data.decisions, policy }),
  }
}

export type PeriodView = ReturnType<typeof derivePeriod>

export function deriveTrend(data: AppData, policy: Policy = data.policy) {
  return availablePeriods(data).map((period) => {
    const view = derivePeriod(data, period, policy)
    return {
      period,
      productCost: view.portfolio.productCost,
      changeCost: view.portfolio.changeCost,
      totalCost: view.portfolio.totalCost,
      validatedValue: view.portfolio.validatedValue,
      validatedRoi: view.portfolio.roi,
      pulseValue: view.projection.projectionEligible ? view.projection.estimatedValue : null,
      pulseLow: view.projection.projectionEligible ? view.projection.valueInterval.low : null,
      pulseHigh: view.projection.projectionEligible ? view.projection.valueInterval.high : null,
      pulseInclusiveRoi: view.projection.projectionEligible ? view.combined.roi : null,
    }
  })
}

export type TrendPoint = ReturnType<typeof deriveTrend>[number]

export function deriveGlobal(data: AppData, policy: Policy = data.policy) {
  return {
    hitRate: portfolioHitRate(data.hypotheses, data.studies),
    ranked: rankHypotheses(data.hypotheses, policy),
    monthly: monthlySpend(data.usage),
  }
}

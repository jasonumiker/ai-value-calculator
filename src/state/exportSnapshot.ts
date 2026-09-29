import { hypothesisProgress, sizeHypothesis } from '../domain/hypotheses'
import { policyLabel } from '../domain/policy'
import type { AppData, PeriodKey } from '../domain/types'
import { derivePeriod, deriveTrend } from './derive'

/** Everything behind the numbers for one quarter; invitation routing (pseudonymous people) is deliberately left out. */
export function buildSnapshot(data: AppData, period: PeriodKey, exportedAt = new Date().toISOString()) {
  const view = derivePeriod(data, period)
  const { portfolio, projection, combined } = view
  const { routing: _routing, ...rest } = data
  return {
    classification: 'ILLUSTRATIVE_DEMO_DATA_NOT_CUSTOMER_RESULTS',
    methodologyVersion: 'ai-value-calculator-v6',
    exportedAt,
    reportingPeriod: period,
    policyVersion: policyLabel(data.policy),
    approvalControl: 'Local demo workflow; reviewer identities are self-declared and records are not tamper-proof.',
    privacy: 'Invitation routing (pseudonymous person keys) stays in the invitation service and is excluded from this export.',
    roiViews: {
      validated: {
        value: portfolio.validatedValue,
        totalCost: portfolio.totalCost,
        netValue: portfolio.netValue,
        roi: portfolio.roi,
        benefitCostRatio: portfolio.benefitCostRatio,
        basis: 'Evidence-adjusted Validated and Realized claims for the quarter; no Pulse extrapolation.',
      },
      pulseInclusive: {
        projectionEligible: projection.projectionEligible,
        value: projection.projectionEligible ? combined.value : null,
        pulseValue: projection.projectionEligible ? combined.pulseValue : null,
        roi: projection.projectionEligible ? combined.roi : null,
        roiInterval: projection.projectionEligible ? combined.roiInterval : null,
        benefitCostRatio: projection.projectionEligible ? combined.benefitCostRatio : null,
        intervalScope: 'Pulse sampling variation only; validated value, costs, and valuation settings are held fixed.',
        reason: projection.projectionReason,
      },
    },
    portfolio,
    pulse: {
      calculationWaterfall: {
        billTaskSessions: view.sessions.length,
        consumptionSpend: portfolio.productCost,
        excludedTaskEvents: projection.excludedTaskEvents,
        eligibleTaskEvents: projection.populationTaskEvents,
        invitations: projection.invitations,
        responses: projection.sampledResponseCount,
        estimatedPositiveHours: projection.estimatedPositiveHours,
        estimatedNegativeHours: projection.estimatedNegativeHours,
        estimatedHours: projection.estimatedHours,
        calibratedHours: projection.calibratedHours,
        reusedHours: projection.reusedHours,
        contributionValuePerHour: data.policy.contributionValuePerHour,
        estimatedValue: projection.estimatedValue,
        valueInterval: projection.valueInterval,
      },
      estimatedValue: projection.estimatedValue,
      valueInterval: projection.valueInterval,
      estimatedHours: projection.estimatedHours,
      responseRate: projection.responseRate,
      sampledResponseCount: projection.sampledResponseCount,
      populationTaskEvents: projection.populationTaskEvents,
      excludedTaskEvents: projection.excludedTaskEvents,
      frameExclusions: projection.frameExclusions,
      lateExclusions: projection.lateExclusions,
      reuse: projection.reuse,
      strata: projection.strata,
    },
    calibration: view.calibration,
    unitEconomics: view.economics,
    burden: view.burden,
    decisions: {
      suggested: view.teams.map((row) => ({ team: row.team, totalCost: row.totalCost, validatedValue: row.validatedValue, suggestion: row.suggestion, recorded: row.recorded ?? null })),
      log: data.decisions,
    },
    trend: deriveTrend(data),
    hypotheses: data.hypotheses.map((hypothesis) => ({
      ...hypothesis,
      progress: hypothesisProgress(hypothesis, data.studies),
      sizing: sizeHypothesis(hypothesis, data.policy),
      studyId: data.studies.find((study) => study.hypothesisId === hypothesis.id)?.id ?? null,
    })),
    data: rest,
  }
}

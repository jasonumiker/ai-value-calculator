import type { ArmSummary } from './types'

export function mean(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

export function sampleVariance(values: number[], center = mean(values)) {
  return values.length < 2 ? 0 : values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1)
}

/** Two-sided 95% t critical value, rounded down to the nearest tabulated df so intervals stay conservative. */
export function tCritical95(degreesOfFreedom: number) {
  const table: [number, number][] = [
    [1, 12.706], [2, 4.303], [3, 3.182], [4, 2.776], [5, 2.571], [6, 2.447],
    [7, 2.365], [8, 2.306], [9, 2.262], [10, 2.228], [12, 2.179], [15, 2.131],
    [20, 2.086], [30, 2.042], [60, 2], [120, 1.98],
  ]
  return [...table].reverse().find(([minimum]) => degreesOfFreedom >= minimum)?.[1] ?? table[0][1]
}

/** Variance of an estimated population total from a simple random sample within one stratum. */
export function stratumTotalVariance(values: number[], population: number, designEffect: number) {
  if (values.length < 2 || population <= 1) return 0
  const finitePopulationCorrection = Math.max(0, 1 - values.length / population)
  return population ** 2 * finitePopulationCorrection * sampleVariance(values) / values.length * designEffect
}

/** Welch's unequal-variance interval for treatment minus control. */
export function welchDifference(control: ArmSummary, treatment: ArmSummary) {
  const controlTerm = control.sd ** 2 / control.n
  const treatmentTerm = treatment.sd ** 2 / treatment.n
  const variance = controlTerm + treatmentTerm
  const standardError = Math.sqrt(variance)
  const welchDf = variance ** 2 / (controlTerm ** 2 / (control.n - 1) + treatmentTerm ** 2 / (treatment.n - 1))
  const degreesOfFreedom = Number.isFinite(welchDf) ? welchDf : control.n + treatment.n - 2
  const difference = treatment.mean - control.mean
  const margin = tCritical95(Math.floor(degreesOfFreedom)) * standardError
  return { difference, standardError, degreesOfFreedom, low: difference - margin, high: difference + margin }
}

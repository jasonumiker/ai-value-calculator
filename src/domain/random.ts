/** Deterministic PRNG (mulberry32) so the simulated usage log and demo sample are reproducible. */
export function createRandom(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  const normal = (mean: number, sd: number) => {
    const u = 1 - next()
    const v = next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const weighted = <T>(items: T[], weights: number[]) => {
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    let target = next() * total
    for (let index = 0; index < items.length; index += 1) {
      target -= weights[index]
      if (target < 0) return items[index]
    }
    return items[items.length - 1]
  }
  const shuffle = <T>(items: T[]) => {
    const copy = [...items]
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(next() * (index + 1))
      ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
    }
    return copy
  }
  return { next, normal, weighted, shuffle, int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)) }
}

export function hashString(text: string) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

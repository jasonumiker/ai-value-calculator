export function formatCurrency(value: number) {
  const sign = value < 0 ? '−' : ''
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString('en-US')}`
}

export function formatShort(value: number) {
  const sign = value < 0 ? '−' : ''
  return `${sign}$${(Math.abs(value) / 1000).toFixed(1)}k`
}

export function formatPercent(value: number) {
  const rounded = Math.round(value * 100)
  return `${rounded < 0 ? '−' : ''}${Math.abs(rounded)}%`
}

export function formatSignedPercent(value: number) {
  const rounded = Math.round(value * 100)
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)}%`
}

export function formatHours(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const absolute = Math.abs(value)
  return `${sign}${absolute >= 100 ? Math.round(absolute).toLocaleString('en-US') : absolute.toFixed(1)} h`
}

export function formatRatio(value: number) {
  return `${value.toFixed(1)}×`
}

export function formatNumber(value: number, digits = 0) {
  return value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function formatMoneyPrecise(value: number) {
  const sign = value < 0 ? '−' : ''
  return `${sign}$${Math.abs(value).toFixed(2)}`
}

/** Keeps very small shares visible instead of rounding them to 0%. */
export function formatSmallPercent(value: number) {
  return value > 0 && value < 0.01 ? `${(value * 100).toFixed(2)}%` : formatPercent(value)
}

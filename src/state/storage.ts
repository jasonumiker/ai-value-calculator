import { CURRENT_PERIOD, STATE_VERSION, createDemoData } from '../domain/seed'
import type { AppData, PeriodKey, Persona } from '../domain/types'

export const DATA_KEY = 'ai-value-calculator-data'
export const UI_KEY = 'ai-value-calculator-ui'
const legacyKeys = [
  'ai-value-calculator-responses', 'ai-value-calculator-hypotheses', 'ai-value-calculator-studies',
  'ai-value-calculator-imports', 'ai-value-calculator-assumptions', 'ai-value-calculator-version',
]

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppData
      if (parsed?.version === STATE_VERSION) return parsed
    }
    legacyKeys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // Unreadable or unavailable storage falls back to the demo seed.
  }
  return createDemoData()
}

export function saveData(data: AppData) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data))
  } catch {
    // The demo stays usable in memory when browser storage is full or blocked.
  }
}

export type UiPrefs = { persona: Persona; team: string; period: PeriodKey }
export const defaultUiPrefs: UiPrefs = { persona: 'executive', team: 'Digital Channels', period: CURRENT_PERIOD }

export function loadUi(): UiPrefs {
  try {
    const parsed = JSON.parse(localStorage.getItem(UI_KEY) ?? '{}') as Partial<UiPrefs>
    const persona = parsed.persona && ['employee', 'manager', 'executive'].includes(parsed.persona) ? parsed.persona : defaultUiPrefs.persona
    return { ...defaultUiPrefs, ...parsed, persona }
  } catch {
    return defaultUiPrefs
  }
}

export function saveUi(prefs: UiPrefs) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(prefs))
  } catch {
    // Preferences are optional.
  }
}

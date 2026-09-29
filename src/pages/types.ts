import type { HypothesisDraft } from '../components/HypothesisModal'
import type { AppData, PeriodKey, Persona } from '../domain/types'
import type { PeriodView, TrendPoint, deriveGlobal } from '../state/derive'
import type { AppActions } from '../state/useAppData'

export type PageId = 'inbox' | 'team' | 'signals' | 'hypotheses' | 'studies' | 'overview' | 'decisions' | 'approvals' | 'policy' | 'sampling' | 'imports'

export type Focus = { studyId?: string; hypothesisId?: number }

export type PageContext = {
  data: AppData
  actions: AppActions
  persona: Persona
  team: string
  teams: string[]
  period: PeriodKey
  periods: PeriodKey[]
  view: PeriodView
  trend: TrendPoint[]
  global: ReturnType<typeof deriveGlobal>
  focus: Focus
  navigate: (page: PageId, focus?: Focus) => void
  notify: (message: string) => void
  openHypothesis: (draft?: HypothesisDraft) => void
  openEvidence: (studyId: string) => void
  openReview: (studyId: string) => void
  openPreview: () => void
}

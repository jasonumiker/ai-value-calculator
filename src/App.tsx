import { useMemo, useRef, useState, type ReactNode } from 'react'
import Papa from 'papaparse'
import {
  Activity,
  AlertTriangle,
  Briefcase,
  Check,
  CircleDollarSign,
  Database,
  Download,
  FlaskConical,
  Inbox,
  Info,
  LayoutDashboard,
  Lightbulb,
  Menu,
  MessageSquareText,
  Scale,
  Shuffle,
  Target,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import './App.css'
import { FinancialReview } from './components/FinancialReview'
import { HypothesisModal, type HypothesisDraft } from './components/HypothesisModal'
import { LimitsDrawer } from './components/LimitsDrawer'
import { StudyEvidenceModal } from './components/StudyEvidenceModal'
import { SurveyPreviewModal } from './components/SurveyPreviewModal'
import { downloadBlob } from './components/helpers'
import { ModalShell } from './components/ui'
import { periodLabel } from './domain/periods'
import { SHARED_TEAM } from './domain/usage'
import type { Persona } from './domain/types'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { DecisionsPage } from './pages/DecisionsPage'
import { HypothesesPage } from './pages/HypothesesPage'
import { ImportsPage } from './pages/ImportsPage'
import { InboxPage } from './pages/InboxPage'
import { PolicyPage } from './pages/PolicyPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { SamplingPage } from './pages/SamplingPage'
import { SignalsPage } from './pages/SignalsPage'
import { StudiesPage } from './pages/StudiesPage'
import { TeamPage } from './pages/TeamPage'
import type { Focus, PageContext, PageId } from './pages/types'
import { availablePeriods, derivePeriod, deriveGlobal, deriveTrend } from './state/derive'
import { buildSnapshot } from './state/exportSnapshot'
import { loadUi, saveUi, type UiPrefs } from './state/storage'
import { useAppData } from './state/useAppData'

type NavItem = { id: PageId; label: string; icon: LucideIcon; title: string }

const personas: { id: Persona; label: string; icon: LucideIcon; description: string }[] = [
  { id: 'employee', label: 'Employee', icon: User, description: 'Answers an occasional random question' },
  { id: 'manager', label: 'Manager', icon: Users, description: 'Turns signals into tested hypotheses' },
  { id: 'executive', label: 'Finance & exec', icon: Briefcase, description: 'Sets the rules and funds what works' },
]

const navigation: Record<Persona, NavItem[]> = {
  employee: [{ id: 'inbox', label: 'Pulse inbox', icon: Inbox, title: 'Pulse inbox' }],
  manager: [
    { id: 'team', label: 'My team', icon: Users, title: 'My team' },
    { id: 'signals', label: 'Pulse signals', icon: MessageSquareText, title: 'Pulse signals' },
    { id: 'hypotheses', label: 'Hypotheses', icon: Lightbulb, title: 'Value hypotheses' },
    { id: 'studies', label: 'Studies', icon: FlaskConical, title: 'Outcome studies' },
  ],
  executive: [
    { id: 'overview', label: 'Portfolio', icon: LayoutDashboard, title: 'Portfolio' },
    { id: 'decisions', label: 'Next-dollar decisions', icon: Target, title: 'Next-dollar decisions' },
    { id: 'approvals', label: 'Financial approvals', icon: CircleDollarSign, title: 'Financial approvals' },
    { id: 'hypotheses', label: 'Hypothesis priorities', icon: Lightbulb, title: 'Hypothesis priorities' },
    { id: 'policy', label: 'Rules & policy', icon: Scale, title: 'Rules & policy' },
    { id: 'sampling', label: 'Sampling engine', icon: Shuffle, title: 'Sampling engine' },
    { id: 'imports', label: 'Bills & usage data', icon: Database, title: 'Bills & usage data' },
  ],
}

function App() {
  const { data, actions } = useAppData()
  const [ui, setUi] = useState<UiPrefs>(loadUi)
  const [page, setPage] = useState<PageId>(() => navigation[loadUi().persona][0].id)
  const [focus, setFocus] = useState<Focus>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [hypothesisDraft, setHypothesisDraft] = useState<HypothesisDraft | null>(null)
  const [evidenceStudyId, setEvidenceStudyId] = useState<string | null>(null)
  const [reviewStudyId, setReviewStudyId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<number | undefined>(undefined)
  const fileInput = useRef<HTMLInputElement>(null)

  const periods = useMemo(() => availablePeriods(data), [data])
  const period = periods.includes(ui.period) ? ui.period : periods[periods.length - 1] ?? ui.period
  const view = useMemo(() => derivePeriod(data, period), [data, period])
  const trend = useMemo(() => deriveTrend(data), [data])
  const global = useMemo(() => deriveGlobal(data), [data])
  const teams = useMemo(() => [...new Set([...data.usage.map((record) => record.team), ...data.hypotheses.map((hypothesis) => hypothesis.owner)])].filter((team) => team !== SHARED_TEAM).sort(), [data])
  const team = teams.includes(ui.team) ? ui.team : teams[0] ?? ui.team

  const updateUi = (next: Partial<UiPrefs>) => {
    const merged = { ...ui, ...next }
    setUi(merged)
    saveUi(merged)
  }
  const notify = (message: string) => {
    setNotice(message)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3600)
  }
  const navigate = (next: PageId, nextFocus: Focus = {}) => {
    setPage(next)
    setFocus(nextFocus)
    setMenuOpen(false)
  }
  const switchPersona = (persona: Persona) => {
    updateUi({ persona })
    navigate(navigation[persona][0].id)
  }
  const exportSnapshot = () => {
    downloadBlob(`ai-value-calculator-${period.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(buildSnapshot(data, period), null, 2), 'application/json')
    notify('Snapshot exported with both ROI views, the policy, evidence, and decisions.')
  }
  const importCsv = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data: rows, meta, errors }) => {
        const record = actions.importUsage(file.name, rows, meta.fields ?? [], errors.length)
        notify(record.status === 'Applied' ? `${file.name}: ${record.note}.` : `${file.name} was not applied. ${record.note}`)
      },
    })
  }

  const items = navigation[ui.persona]
  const current = items.find((item) => item.id === page) ?? items[0]
  const evidenceStudy = data.studies.find((study) => study.id === evidenceStudyId)
  const reviewStudy = data.studies.find((study) => study.id === reviewStudyId)

  const context: PageContext = {
    data, actions, persona: ui.persona, team, teams, period, periods, view, trend, global, focus, navigate, notify,
    openHypothesis: (draft) => setHypothesisDraft(draft ?? {}),
    openEvidence: setEvidenceStudyId,
    openReview: setReviewStudyId,
    openPreview: () => setPreviewOpen(true),
  }

  const pages: Record<PageId, () => ReactNode> = {
    inbox: () => <InboxPage {...context} />,
    team: () => <TeamPage {...context} />,
    signals: () => <SignalsPage {...context} />,
    hypotheses: () => <HypothesesPage {...context} />,
    studies: () => <StudiesPage {...context} />,
    overview: () => <PortfolioPage {...context} />,
    decisions: () => <DecisionsPage {...context} />,
    approvals: () => <ApprovalsPage {...context} />,
    policy: () => <PolicyPage key={data.policy.version} {...context} />,
    sampling: () => <SamplingPage {...context} />,
    imports: () => <ImportsPage {...context} fileInput={fileInput} onImport={importCsv} />,
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Activity size={20} /></div><span>AI Value Calculator</span></div>
        <div className="persona-switcher" role="group" aria-label="View as">
          <p className="nav-label">View as</p>
          {personas.map(({ id, label, icon: Icon, description }) => (
            <button key={id} className={ui.persona === id ? 'active' : ''} aria-pressed={ui.persona === id} onClick={() => switchPersona(id)} title={description}>
              <Icon size={16} />{label}
            </button>
          ))}
        </div>
        {ui.persona === 'manager' && (
          <label className="team-select"><span>My team</span>
            <select value={team} onChange={(event) => updateUi({ team: event.target.value })}>{teams.map((option) => <option key={option}>{option}</option>)}</select>
          </label>
        )}
        <nav aria-label="Primary navigation">
          {items.map(({ id, label, icon: Icon }) => (
            <button className={current.id === id ? 'active' : ''} onClick={() => navigate(id)} key={id}>
              <Icon size={18} />{label}
              {id === 'approvals' && data.studies.some((study) => study.financialReview?.status === 'Pending') && <span className="nav-count">{data.studies.filter((study) => study.financialReview?.status === 'Pending').length}</span>}
            </button>
          ))}
        </nav>
        <button className="limits-link" onClick={() => setLimitsOpen(true)}><Info size={16} /> Assumptions & limits</button>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><Menu size={20} /></button>
          <div><p className="eyebrow">{personas.find((persona) => persona.id === ui.persona)?.label} view</p><h1>{current.title}</h1></div>
          <div className="header-actions">
            {ui.persona !== 'employee' && (
              <label className="period-select"><span>Quarter</span>
                <select aria-label="Reporting quarter" value={period} onChange={(event) => updateUi({ period: event.target.value })}>
                  {periods.map((option) => <option key={option} value={option}>{periodLabel(option)}</option>)}
                </select>
              </label>
            )}
            {ui.persona === 'executive' && <button className="secondary-button" onClick={exportSnapshot}><Download size={16} /> Export</button>}
          </div>
        </header>
        <div className="demo-banner"><AlertTriangle size={15} /><strong>Illustrative demo data</strong><span>Fictional organisation and results.</span><button className="text-button" onClick={() => setLimitsOpen(true)}>Assumptions & limits</button></div>
        {(pages[current.id] ?? pages.overview)()}
      </main>

      {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
      {limitsOpen && <LimitsDrawer policy={data.policy} onClose={() => setLimitsOpen(false)} onReset={() => { actions.reset(); setLimitsOpen(false); navigate(items[0].id); notify('Demo data reset.') }} />}
      {previewOpen && (
        <SurveyPreviewModal
          products={data.products}
          teams={teams}
          onClose={() => setPreviewOpen(false)}
          onSubmit={(answer, surveyContext) => {
            actions.recordPreview({ ...answer, ...surveyContext, period })
            setPreviewOpen(false)
            notify('Preview recorded as a discovery signal. It does not enter the Pulse estimate.')
          }}
        />
      )}
      {hypothesisDraft && (
        <HypothesisModal
          data={data}
          teams={teams}
          defaultTeam={team}
          draft={hypothesisDraft}
          onClose={() => setHypothesisDraft(null)}
          onSubmit={(input) => {
            actions.nominate(input)
            setHypothesisDraft(null)
            notify('Hypothesis nominated. Management prioritises which to test.')
          }}
        />
      )}
      {evidenceStudy && (
        <StudyEvidenceModal
          study={evidenceStudy}
          policy={data.policy}
          periods={periods}
          onClose={() => setEvidenceStudyId(null)}
          onSave={(input) => {
            actions.saveEvidence(evidenceStudy.id, input)
            setEvidenceStudyId(null)
            notify('Study evidence saved. The verdict follows the pre-registered criterion.')
          }}
        />
      )}
      {reviewStudy && (
        <ModalShell title="Financial review" eyebrow={reviewStudy.name} className="financial-modal" onClose={() => setReviewStudyId(null)}>
          <FinancialReview
            study={reviewStudy}
            claims={view.claims}
            policy={data.policy}
            onSave={(updated) => {
              actions.replaceStudy(updated)
              setReviewStudyId(null)
              const action = updated.financialReview?.history.at(-1)?.action
              notify(action === 'Submitted' ? 'Valuation proposed; ROI unchanged until finance approves.'
                : action === 'Rejected' ? 'Valuation returned for changes.'
                  : action === 'Realized' ? 'Realized value reconciled.' : 'Approval recorded; portfolio updated.')
            }}
          />
        </ModalShell>
      )}
    </div>
  )
}

export default App

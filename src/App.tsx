import { useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import Papa from 'papaparse'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleDollarSign,
  Database,
  Download,
  FileSpreadsheet,
  FlaskConical,
  Gauge,
  GitBranch,
  Info,
  LayoutDashboard,
  Lightbulb,
  Lock,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Unlock,
  Upload,
  Users,
  X,
} from 'lucide-react'
import './App.css'
import FinancialReview from './FinancialReview'
import {
  calculatePortfolio,
  combinePulseWithPortfolio,
  confidenceWeightKeys,
  copilotSpend,
  createStudyFromHypothesis,
  defaultAssumptions,
  estimatePulseValue,
  evidenceWeightKeys,
  formatCurrency,
  formatPercent,
  formatShort,
  getHypothesisStatus,
  isFinanciallyApproved,
  pulseEffectOptions,
  pulseProjectionPolicy,
  resolveTimeImpactHours,
  restoreStudyRecords,
  studies,
  summarizePulse,
  valueClaims,
  type Assumptions,
  type Confidence,
  type EvidenceGrade,
  type Hypothesis,
  type Product,
  type ResponseRecord,
  type StudyRecord,
  type ValueClaim,
  type ValueStage,
} from './model'

type Page = 'overview' | 'responses' | 'hypotheses' | 'studies' | 'imports'

type ImportRecord = {
  id: number
  name: string
  source: string
  rows: number
  date: string
  status: 'Ready' | 'Needs mapping'
  columns?: number
  note?: string
}

type CsvRow = Record<string, string>

const navigation = [
  { id: 'overview' as Page, label: 'Overview', icon: LayoutDashboard },
  { id: 'responses' as Page, label: 'Pulse results', icon: MessageSquareText },
  { id: 'hypotheses' as Page, label: 'Value hypotheses', icon: Lightbulb },
  { id: 'studies' as Page, label: 'Outcome studies', icon: FlaskConical },
  { id: 'imports' as Page, label: 'Data imports', icon: Database },
]

const seedResponses: ResponseRecord[] = [
  { id: 1, product: 'GitHub Copilot', workType: 'Code and tests', timeImpact: '1–4 hours faster', effect: 'Faster delivery', date: '07 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 2, product: 'GitHub Copilot', workType: 'Code review', timeImpact: '30–60 minutes faster', effect: 'Higher-quality output', date: '07 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 3, product: 'GitHub Copilot', workType: 'Code and tests', timeImpact: 'No meaningful difference', effect: 'No material change', date: '06 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 4, product: 'GitHub Copilot', workType: 'Incident analysis', timeImpact: '15–30 minutes slower', effect: 'More rework or lower quality', date: '06 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 5, product: 'GitHub Copilot', workType: 'Code review', timeImpact: '15–30 minutes faster', effect: 'Stronger control coverage', date: '05 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 6, product: 'Copilot Cowork', workType: 'Research and synthesis', timeImpact: '30–60 minutes faster', effect: 'Better-informed decisions', date: '07 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 7, product: 'Copilot Cowork', workType: 'Document drafting', timeImpact: 'No meaningful difference', effect: 'No material change', date: '06 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 8, product: 'Copilot Cowork', workType: 'Customer communication', timeImpact: '15–30 minutes faster', effect: 'Higher-quality output', date: '05 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 9, product: 'Copilot Cowork', workType: 'Data analysis', timeImpact: '15–30 minutes slower', effect: 'More rework or lower quality', date: '05 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 10, product: 'Copilot Cowork', workType: 'Meeting follow-up', timeImpact: '<15 minutes faster', effect: 'Faster delivery', date: '04 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 11, product: 'GitHub Copilot', workType: 'Documentation', timeImpact: '<15 minutes faster', effect: 'Faster delivery', date: '04 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 12, product: 'GitHub Copilot', workType: 'Code and tests', timeImpact: '30–60 minutes faster', effect: 'Higher-quality output', date: '03 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 13, product: 'GitHub Copilot', workType: 'Debugging', timeImpact: '15–30 minutes slower', effect: 'More rework or lower quality', date: '03 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 14, product: 'GitHub Copilot', workType: 'Code review', timeImpact: 'No meaningful difference', effect: 'No material change', date: '02 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 15, product: 'GitHub Copilot', workType: 'Code and tests', timeImpact: '30–60 minutes faster', effect: 'Faster delivery', date: '02 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 16, product: 'Copilot Cowork', workType: 'Meeting follow-up', timeImpact: '<15 minutes faster', effect: 'Faster delivery', date: '04 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 17, product: 'Copilot Cowork', workType: 'Research and synthesis', timeImpact: '15–30 minutes faster', effect: 'Better-informed decisions', date: '03 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 18, product: 'Copilot Cowork', workType: 'Document drafting', timeImpact: 'No meaningful difference', effect: 'No material change', date: '03 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 19, product: 'Copilot Cowork', workType: 'Data analysis', timeImpact: '30–60 minutes slower', effect: 'More rework or lower quality', date: '02 Aug', sampleFrameId: pulseProjectionPolicy.id },
  { id: 20, product: 'Copilot Cowork', workType: 'Customer communication', timeImpact: '15–30 minutes faster', effect: 'Higher-quality output', date: '02 Aug', sampleFrameId: pulseProjectionPolicy.id },
]

const pulseWorkTypeOptions = [
  'Code and tests',
  'Code review',
  'Incident analysis',
  'Research and synthesis',
  'Document drafting',
  'Customer communication',
  'Data analysis',
  'Meeting follow-up',
] as const

const seedHypotheses: Hypothesis[] = [
  { id: 1, useCase: 'Generate unit tests', owner: 'Digital Channels', product: 'GitHub Copilot', expectedEffect: 'Shorter development cycle', outcome: 'Increase release throughput', evidence: 'Pull request and deployment timestamps', guardrail: 'Escaped defects must not increase' },
  { id: 2, useCase: 'Summarize case material', owner: 'Customer Operations', product: 'Copilot Cowork', expectedEffect: 'Less preparation time', outcome: 'Handle more cases per week', evidence: 'Case-management throughput', guardrail: 'Case quality must remain stable' },
  { id: 3, useCase: 'Draft sales proposals', owner: 'Enterprise Sales', product: 'Copilot Cowork', expectedEffect: 'Faster response to clients', outcome: 'Improve proposal conversion', evidence: 'CRM opportunity data', guardrail: 'Discounting and win rate monitored' },
  { id: 4, useCase: 'Accelerate code review', owner: 'Platform Engineering', product: 'GitHub Copilot', expectedEffect: 'Reduce review wait time', outcome: 'Deliver changes earlier', evidence: 'Pull request cycle time', guardrail: 'Change failure rate must not rise' },
]

const initialImports: ImportRecord[] = [
  { id: 1, name: 'github-copilot-team-usage-july.csv', source: 'GitHub Copilot', rows: 24, date: '02 Aug 2026', status: 'Ready', note: 'Aggregate team rows' },
  { id: 2, name: 'm365-cowork-team-consumption-july.csv', source: 'Microsoft 365', rows: 18, date: '02 Aug 2026', status: 'Ready', note: 'Aggregate team rows' },
  { id: 3, name: 'finance-cost-summary.csv', source: 'Finance', rows: 7, date: '01 Aug 2026', status: 'Ready', note: 'No direct identifiers' },
]

const teamCostAllocation: {
  team: string
  product: Product | 'Portfolio-wide'
  licenseCost: number
  changeCostShare: number
  decision: string
}[] = [
  { team: 'Digital Channels', product: 'GitHub Copilot', licenseCost: 6840, changeCostShare: 0.27, decision: 'Scale with quality guardrail' },
  { team: 'Customer Operations', product: 'Copilot Cowork', licenseCost: 5190, changeCostShare: 0.21, decision: 'Continue measurement' },
  { team: 'Enterprise Sales', product: 'Copilot Cowork', licenseCost: 4720, changeCostShare: 0.18, decision: 'Do not value yet' },
  { team: 'Platform Engineering', product: 'GitHub Copilot', licenseCost: 3960, changeCostShare: 0.22, decision: 'Scale carefully' },
  { team: 'Portfolio governance', product: 'Portfolio-wide', licenseCost: 7750, changeCostShare: 0.12, decision: 'Shared cost allocation' },
]

const pulseTeamOptions = teamCostAllocation
  .filter(({ product }) => product !== 'Portfolio-wide')
  .map(({ team }) => team)

const minimumReportingGroup = 5
const importTemplateCsv = 'product,team,role_group,period,active_users,consumption,cost\nGitHub Copilot,Digital Channels,Engineering,2026-07,42,12800,6840\nCopilot Cowork,Customer Operations,Case workers,2026-07,58,9300,5190\n'

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function saveStored<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

const storageKeys = ['ai-value-calculator-responses', 'ai-value-calculator-hypotheses', 'ai-value-calculator-studies', 'ai-value-calculator-imports', 'ai-value-calculator-assumptions']
const storageVersion = '4'

function ensureStorageVersion() {
  try {
    if (localStorage.getItem('ai-value-calculator-version') !== storageVersion) {
      storageKeys.forEach((key) => localStorage.removeItem(key))
      localStorage.setItem('ai-value-calculator-version', storageVersion)
    }
  } catch {
    // The prototype remains usable when browser storage is unavailable.
  }
}

ensureStorageVersion()

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function ProductMark({ product }: { product: Product }) {
  return product === 'GitHub Copilot' ? <GitBranch size={15} /> : <Sparkles size={15} />
}

function EvidenceBadge({ grade, prefix }: { grade: EvidenceGrade; prefix?: string }) {
  return <span className={`evidence-badge ${grade.toLowerCase()}`}><span />{prefix}{grade}</span>
}

function StageBadge({ stage }: { stage: ValueStage }) {
  return <span className={`stage-badge ${stage.toLowerCase()}`}>{stage}</span>
}

function formatHours(value: number) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toFixed(1)} h`
}

function App() {
  const [page, setPage] = useState<Page>('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [surveyOpen, setSurveyOpen] = useState(false)
  const [hypothesisOpen, setHypothesisOpen] = useState(false)
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<number | null>(null)
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null)
  const [editingStudy, setEditingStudy] = useState<StudyRecord | null>(null)
  const [reviewingStudy, setReviewingStudy] = useState<StudyRecord | null>(null)
  const [studyError, setStudyError] = useState('')
  const [notice, setNotice] = useState('')
  const [responses, setResponses] = useState<ResponseRecord[]>(() => readStored('ai-value-calculator-responses', seedResponses))
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>(() => readStored('ai-value-calculator-hypotheses', seedHypotheses))
  const [studyRecords, setStudyRecords] = useState<StudyRecord[]>(() => {
    const saved = readStored<StudyRecord[]>('ai-value-calculator-studies', [])
    return restoreStudyRecords(Array.isArray(saved) ? saved : [])
  })
  const [imports, setImports] = useState<ImportRecord[]>(() => readStored('ai-value-calculator-imports', initialImports))
  const [assumptions, setAssumptions] = useState<Assumptions>(() => ({ ...defaultAssumptions, ...readStored('ai-value-calculator-assumptions', defaultAssumptions) }))
  const fileInput = useRef<HTMLInputElement>(null)
  const claims: ValueClaim[] = [...studyRecords, ...valueClaims.filter((claim) => !studies.some((study) => study.id === claim.id))]
  const portfolio = calculatePortfolio(assumptions, claims)
  const pulseProjection = estimatePulseValue(responses)
  const pulseInclusive = combinePulseWithPortfolio(portfolio.validatedValue, portfolio.totalCost, pulseProjection)

  const navigate = (next: Page) => {
    setPage(next)
    setMenuOpen(false)
    setSelectedHypothesisId(null)
    setSelectedStudyId(null)
  }

  const viewStudy = (studyId: string) => {
    navigate('studies')
    setSelectedStudyId(studyId)
  }

  const viewHypothesis = (hypothesisId: number) => {
    navigate('hypotheses')
    setSelectedHypothesisId(hypothesisId)
  }

  const startStudy = (hypothesis: Hypothesis) => {
    const existing = studyRecords.find((study) => study.hypothesisId === hypothesis.id)
    if (existing) {
      viewStudy(existing.id)
      return
    }
    const study = createStudyFromHypothesis(hypothesis)
    const updated = [study, ...studyRecords]
    setStudyRecords(updated)
    saveStored('ai-value-calculator-studies', updated)
    viewStudy(study.id)
  }

  const saveStudyEvidence = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingStudy || editingStudy.financialReview?.status === 'Pending' || editingStudy.financialReview?.status === 'Approved') return
    const data = new FormData(event.currentTarget)
    const field = (name: string) => String(data.get(name) ?? '').trim()
    const progress = Number(data.get('progress'))
    if (!['cohort', 'period', 'metric', 'operationalSource'].every((name) => field(name))) {
      setStudyError('Enter a cohort, period, metric, and evidence source.')
      return
    }
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      setStudyError('Progress must be a whole number from 0 to 100.')
      return
    }
    if (progress === 100 && (!field('baseline') || !field('comparison') || !field('result'))) {
      setStudyError('A completed study needs a baseline, comparison, and observed result, including a null or negative result.')
      return
    }
    const updatedStudy: StudyRecord = {
      ...editingStudy,
      cohort: field('cohort'),
      period: field('period'),
      metric: field('metric'),
      operationalSource: field('operationalSource'),
      baseline: field('baseline'),
      current: field('current'),
      comparison: field('comparison'),
      result: field('result') || 'Not measured yet',
      operationalGrade: field('operationalGrade') as EvidenceGrade,
      progress,
    }
    const updated = studyRecords.map((study) => study.id === updatedStudy.id ? updatedStudy : study)
    setStudyRecords(updated)
    saveStored('ai-value-calculator-studies', updated)
    setEditingStudy(null)
    showNotice('Study evidence saved; financial stage unchanged.')
  }

  const saveFinancialReview = (updatedStudy: StudyRecord) => {
    const updated = studyRecords.map((study) => study.id === updatedStudy.id ? updatedStudy : study)
    setStudyRecords(updated)
    saveStored('ai-value-calculator-studies', updated)
    setReviewingStudy(null)
    const action = updatedStudy.financialReview?.history.at(-1)?.action
    showNotice(action === 'Submitted' ? 'Valuation submitted for financial review; ROI unchanged.'
      : action === 'Rejected' ? 'Valuation returned for changes; no approved value added.'
        : action === 'Realized' ? 'Realized value reconciled; portfolio updated.' : 'Financial approval recorded; portfolio updated.')
  }

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3200)
  }

  const updateAssumption = (key: keyof Assumptions, value: number) => {
    const next = { ...assumptions, [key]: value }
    setAssumptions(next)
    saveStored('ai-value-calculator-assumptions', next)
  }

  const resetAssumptions = () => {
    setAssumptions(defaultAssumptions)
    saveStored('ai-value-calculator-assumptions', defaultAssumptions)
  }

  const exportPortfolio = () => {
    const snapshot = {
      classification: 'ILLUSTRATIVE_DEMO_DATA_NOT_CUSTOMER_RESULTS',
      methodologyVersion: 'ai-value-calculator-v5-financial-review',
      approvalControl: 'Local demo workflow; reviewer identities are self-declared and records are not tamper-proof.',
      exportedAt: new Date().toISOString(),
      assumptions,
      portfolio,
      pulseProjection,
      roiViews: {
        validated: {
          value: portfolio.validatedValue,
          netValue: portfolio.validatedNetValue,
          roi: portfolio.validatedRoi,
          benefitCostRatio: portfolio.validatedBenefitCostRatio,
          basis: 'Evidence-adjusted Validated and Realized claims; no Pulse extrapolation.',
        },
        pulseInclusive: {
          projectionEligible: pulseProjection.projectionEligible,
          value: pulseProjection.projectionEligible ? pulseInclusive.value : null,
          pulseValue: pulseProjection.projectionEligible ? pulseInclusive.pulseValue : null,
          netValue: pulseProjection.projectionEligible ? pulseInclusive.netValue : null,
          roi: pulseProjection.projectionEligible ? pulseInclusive.roi : null,
          roiInterval: pulseProjection.projectionEligible ? pulseInclusive.roiInterval : null,
          benefitCostRatio: pulseProjection.projectionEligible ? pulseInclusive.benefitCostRatio : null,
          benefitCostRatioInterval: pulseProjection.projectionEligible ? pulseInclusive.benefitCostRatioInterval : null,
          intervalScope: 'Pulse sampling variation only; validated value, cost, and modelling parameters are held fixed.',
        },
      },
      responses,
      hypotheses: hypotheses.map((hypothesis) => ({
        ...hypothesis,
        status: getHypothesisStatus(hypothesis.id, studyRecords),
        studyId: studyRecords.find((study) => study.hypothesisId === hypothesis.id)?.id ?? null,
      })),
      studies: studyRecords,
      imports,
    }
    downloadBlob(`ai-value-calculator-demo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snapshot, null, 2), 'application/json')
    showNotice('Snapshot exported with both ROI views, intervals, and policies.')
  }

  const submitSurvey = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const enteredTimeImpact = Number(data.get('timeImpact'))
    const next: ResponseRecord = {
      id: Date.now(),
      product: String(data.get('product')) as Product,
      team: String(data.get('team')),
      workType: String(data.get('workType')),
      timeImpact: String(Number.isFinite(enteredTimeImpact) ? enteredTimeImpact : 0),
      effect: String(data.get('effect')),
      date: 'Today',
    }
    const updated = [next, ...responses]
    setResponses(updated)
    saveStored('ai-value-calculator-responses', updated)
    setSurveyOpen(false)
    showNotice('Preview recorded as discovery only—excluded from Validated ROI and the Pulse-inclusive projection.')
  }

  const submitHypothesis = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const next: Hypothesis = {
      id: Date.now(),
      useCase: String(data.get('useCase')),
      owner: String(data.get('owner')),
      product: String(data.get('product')) as Product,
      expectedEffect: String(data.get('expectedEffect')),
      outcome: String(data.get('outcome')),
      evidence: String(data.get('evidence')),
      guardrail: String(data.get('guardrail')),
    }
    const updated = [next, ...hypotheses]
    setHypotheses(updated)
    saveStored('ai-value-calculator-hypotheses', updated)
    setSelectedHypothesisId(null)
    setHypothesisOpen(false)
    showNotice('Value hypothesis and guardrail added.')
  }

  const importCsv = (file: File) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta, errors }) => {
        const fields = meta.fields ?? []
        const lower = fields.map((field) => field.trim().toLowerCase())
        const directIdentifiers = ['user', 'user_id', 'userid', 'employee_id', 'email', 'name', 'upn']
        const detectedIdentifier = lower.find((field) => directIdentifiers.includes(field))
        const hasGroup = lower.some((field) => ['team', 'department', 'role_group'].includes(field))
        const hasMeasure = lower.some((field) => ['product', 'consumption', 'cost', 'spend', 'active_users'].includes(field))
        const costField = fields.find((field) => ['cost', 'spend'].includes(field.toLowerCase()))
        const totalCost = costField ? data.reduce((sum, row) => sum + (Number(row[costField]) || 0), 0) : 0
        const ready = errors.length === 0 && hasGroup && hasMeasure && !detectedIdentifier
        const note = detectedIdentifier
          ? `Direct identifier “${detectedIdentifier}” detected; aggregate before import`
          : [`${fields.length} columns`, costField ? `${formatCurrency(totalCost)} total cost` : null, 'no direct identifiers'].filter(Boolean).join(' · ')
        const next: ImportRecord = {
          id: Date.now(),
          name: file.name,
          source: file.name.toLowerCase().includes('github') ? 'GitHub Copilot' : file.name.toLowerCase().includes('finance') ? 'Finance' : 'Microsoft 365',
          rows: data.length,
          columns: fields.length,
          note,
          date: 'Today',
          status: ready ? 'Ready' : 'Needs mapping',
        }
        const updated = [next, ...imports]
        setImports(updated)
        saveStored('ai-value-calculator-imports', updated)
        showNotice(ready
          ? `${data.length.toLocaleString()} aggregate rows imported from ${file.name}.`
          : `${file.name} is not eligible: use grouped fields and remove direct identifiers.`)
      },
    })
  }

  const currentTitle = navigation.find((item) => item.id === page)?.label ?? 'Overview'

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Activity size={20} /></div><span>AI Value Calculator</span></div>
      <div className="workspace-switcher"><div className="workspace-avatar">CT</div><div><strong>Contoso Group</strong><span>Illustrative portfolio</span></div><ChevronDown size={16} /></div>
      <nav aria-label="Primary navigation">
        <p className="nav-label">Measure</p>
        {navigation.slice(0, 4).map(({ id, label, icon: Icon }) => <button className={page === id ? 'active' : ''} onClick={() => navigate(id)} key={id}><Icon size={18} />{label}{id === 'responses' && <span className="nav-count">{responses.length}</span>}</button>)}
        <p className="nav-label data-label">Manage</p>
        {navigation.slice(4).map(({ id, label, icon: Icon }) => <button className={page === id ? 'active' : ''} onClick={() => navigate(id)} key={id}><Icon size={18} />{label}</button>)}
      </nav>
      <div className="method-card"><div className="method-icon"><ShieldCheck size={18} /></div><div><strong>Claim evidence coverage</strong><span>Validated-claim fields present</span></div><div className="health-score">{portfolio.evidenceCoverage}</div></div>
      <div className="sidebar-user"><div className="user-avatar">AM</div><div><strong>Alex Morgan</strong><span>Portfolio owner</span></div><MoreHorizontal size={18} /></div>
    </aside>

    <main>
      <header className="topbar">
        <button className="icon-button menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><Menu size={20} /></button>
        <div><p className="eyebrow">AI value evidence</p><h1>{currentTitle}</h1></div>
        <div className="header-actions"><button className="secondary-button desktop-action" onClick={exportPortfolio}><Download size={16} /> Export</button><button className="primary-button" onClick={() => setSurveyOpen(true)}><Send size={16} /> Preview pulse</button></div>
      </header>
      <div className="demo-banner" role="note"><AlertTriangle size={16} /><strong>Illustrative demo data</strong><span>Not customer results. Values, studies, approvals, and organizations are fictional.</span></div>
      {page === 'overview' && <Overview onNavigate={navigate} responses={responses} assumptions={assumptions} claims={claims} onAssumptionChange={updateAssumption} onResetAssumptions={resetAssumptions} />}
      {page === 'responses' && <Responses responses={responses} onOpenSurvey={() => setSurveyOpen(true)} />}
      {page === 'hypotheses' && <Hypotheses hypotheses={hypotheses} studyRecords={studyRecords} selectedId={selectedHypothesisId} onClearSelection={() => setSelectedHypothesisId(null)} onOpen={() => setHypothesisOpen(true)} onStartStudy={startStudy} onViewStudy={viewStudy} />}
      {page === 'studies' && <Studies records={studyRecords} hypotheses={hypotheses} claims={claims} assumptions={assumptions} selectedId={selectedStudyId} onClearSelection={() => setSelectedStudyId(null)} onViewHypothesis={viewHypothesis} onEdit={(study) => { setStudyError(''); setEditingStudy(study) }} onReview={setReviewingStudy} />}
      {page === 'imports' && <Imports imports={imports} fileInput={fileInput} onImport={importCsv} />}
    </main>
    {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    {notice && <div className="toast"><Check size={17} />{notice}</div>}
    {surveyOpen && <SurveyModal onClose={() => setSurveyOpen(false)} onSubmit={submitSurvey} />}
    {hypothesisOpen && <HypothesisModal onClose={() => setHypothesisOpen(false)} onSubmit={submitHypothesis} />}
    {editingStudy && <StudyModal study={editingStudy} error={studyError} onClose={() => setEditingStudy(null)} onSubmit={saveStudyEvidence} />}
    {reviewingStudy && <ModalShell title="Financial review" eyebrow={reviewingStudy.name} className="financial-modal" onClose={() => setReviewingStudy(null)}><FinancialReview study={reviewingStudy} claims={claims} onSave={saveFinancialReview} /></ModalShell>}
  </div>
}

function Overview({
  onNavigate,
  responses,
  assumptions,
  claims,
  onAssumptionChange,
  onResetAssumptions,
}: {
  onNavigate: (page: Page) => void
  responses: ResponseRecord[]
  assumptions: Assumptions
  claims: ValueClaim[]
  onAssumptionChange: (key: keyof Assumptions, value: number) => void
  onResetAssumptions: () => void
}) {
  const [teamQuery, setTeamQuery] = useState('')
  const [policyLocked, setPolicyLocked] = useState(true)
  const portfolio = calculatePortfolio(assumptions, claims)
  const pulse = summarizePulse(responses)
  const pulseProjection = estimatePulseValue(responses)
  const pulseInclusive = combinePulseWithPortfolio(portfolio.validatedValue, portfolio.totalCost, pulseProjection)
  const pillars = portfolio.pillars
  const maxPillar = Math.max(1, ...pillars.map((item) => item.value))
  const nonLicenseCost = portfolio.totalCost - copilotSpend
  const teamRows = teamCostAllocation.map((team) => {
    const adjustedValue = portfolio.contributions.filter((claim) => claim.team === team.team).reduce((sum, claim) => sum + claim.adjustedValue, 0)
    const totalCost = team.licenseCost + nonLicenseCost * team.changeCostShare
    const roi = totalCost === 0 ? 0 : (adjustedValue - totalCost) / totalCost
    const eligibleClaim = portfolio.contributions.find((claim) => claim.team === team.team)
    const pipelineClaim = claims.find((claim) => claim.team === team.team)
    return { ...team, adjustedValue, totalCost, roi, stage: eligibleClaim?.stage ?? pipelineClaim?.stage }
  }).filter((row) => row.team.toLowerCase().includes(teamQuery.trim().toLowerCase()))

  return <div className="page-content overview-page">
    <section className="summary-strip">
      <div className="summary-heading"><div><span className="live-dot" />Two ROI views</div><p>Claim-backed and Pulse-modelled value remain visibly separate</p></div>
      <div className="metric-grid">
        <Metric label="Total AI investment" value={formatCurrency(portfolio.totalCost)} detail={`${formatCurrency(copilotSpend)} product cost + change costs`} icon={CircleDollarSign} />
        <Metric label="Validated claim value" value={formatCurrency(portfolio.validatedValue)} detail={`Evidence-adjusted · gross ${formatShort(portfolio.rawValue)}`} icon={Target} emphasis />
        <Metric label="Validated ROI" value={formatPercent(portfolio.validatedRoi)} detail={`Claims only · ${portfolio.validatedBenefitCostRatio.toFixed(1)}× benefit-cost`} icon={Gauge} />
        <Metric label="Pulse-inclusive ROI" value={pulseProjection.projectionEligible ? formatPercent(pulseInclusive.roi) : 'Not estimable'} detail={pulseProjection.projectionEligible ? `95% Pulse sampling interval ${formatPercent(pulseInclusive.roiInterval.low)} to ${formatPercent(pulseInclusive.roiInterval.high)}` : pulseProjection.projectionReason} icon={TrendingUp} modelled />
      </div>
    </section>

    <section className="signal-panel panel">
      <div className="signal-icon"><MessageSquareText size={20} /></div>
      <div>{pulseProjection.projectionEligible
        ? <><p className="section-kicker">Pulse value component · added only to Pulse-inclusive ROI</p><h2>{formatCurrency(pulseProjection.estimatedValue)} modelled value from {formatHours(pulseProjection.estimatedHours)} projected net task-time effect</h2><p>{pulseProjection.sampledResponseCount} responses from {pulseProjection.invitations} random invitations are projected across {pulseProjection.populationTaskEvents.toLocaleString()} deduplicated task events in a source-certified, prefiltered frame. The 95% Pulse sampling interval is {formatCurrency(pulseProjection.valueInterval.low)} to {formatCurrency(pulseProjection.valueInterval.high)}; neutral and slower tasks are retained.</p></>
        : <><p className="section-kicker">Discovery only · excluded from both ROI calculations</p><h2>The descriptive pulse sample totals {formatHours(pulse.low)} to {formatHours(pulse.mid)} net task time</h2><p>{pulseProjection.projectionReason}</p></>}
      </div>
      <button className="text-button" onClick={() => onNavigate('responses')}>Review Pulse model <ArrowRight size={15} /></button>
    </section>

    <section className="panel assumptions-panel">
      <div className="assumptions-head">
        <div><p className="section-kicker">Cost and validated-claim policy</p><h2>Total cost is editable; claim weights are locked by default</h2><p className="assumptions-sub">These evidence weights and confidence multipliers affect Validated ROI only; they are governance discounts, not statistical confidence. The separate Pulse model uses the sampling and valuation policy shown on Pulse results.</p></div>
        <div className="assumptions-actions"><button className="text-button" onClick={onResetAssumptions}>Reset costs &amp; claim policy</button><button className="secondary-button policy-lock" onClick={() => setPolicyLocked(!policyLocked)}>{policyLocked ? <Lock size={14} /> : <Unlock size={14} />}{policyLocked ? 'Claim weights locked' : 'Lock claim weights'}</button></div>
      </div>
      <div className="cost-policy-grid">
        <CostControl label="Implementation" value={assumptions.implementationCost} max={50000} onChange={(value) => onAssumptionChange('implementationCost', value)} />
        <CostControl label="Enablement and training" value={assumptions.enablementCost} max={30000} onChange={(value) => onAssumptionChange('enablementCost', value)} />
        <CostControl label="Operations and governance" value={assumptions.operationsCost} max={25000} onChange={(value) => onAssumptionChange('operationsCost', value)} />
        <div className="assumption-readout"><div><span>Total investment</span><strong>{formatCurrency(portfolio.totalCost)}</strong></div><div><span>Validated ROI</span><strong className="readout-roi">{formatPercent(portfolio.validatedRoi)}</strong></div><div><span>Pulse-inclusive ROI</span><strong className="readout-modelled">{pulseProjection.projectionEligible ? formatPercent(pulseInclusive.roi) : 'Off'}</strong></div></div>
      </div>
      <div className="weight-policy">
        <section><span>Claim evidence weights · policy v1.0</span><div className="weight-grid">{(Object.keys(evidenceWeightKeys) as EvidenceGrade[]).map((grade) => <WeightControl key={grade} label={grade} grade={grade} value={assumptions[evidenceWeightKeys[grade]]} disabled={policyLocked} onChange={(value) => onAssumptionChange(evidenceWeightKeys[grade], value)} />)}</div></section>
        <section><span>Claim confidence multipliers</span><div className="weight-grid confidence-grid">{(Object.keys(confidenceWeightKeys) as Confidence[]).map((confidence) => <WeightControl key={confidence} label={confidence} value={assumptions[confidenceWeightKeys[confidence]]} disabled={policyLocked} onChange={(value) => onAssumptionChange(confidenceWeightKeys[confidence], value)} />)}</div></section>
      </div>
    </section>

    <section className="dashboard-grid">
      <article className="panel value-panel">
        <PanelTitle kicker="Validated ROI evidence" title="Validated and realized claim value" />
        <div className="value-total"><strong>{formatShort(portfolio.adjustedValue)}</strong><span className="value-tag">adjusted</span><span className="value-upside"><TrendingUp size={14} /> gross {formatShort(portfolio.rawValue)}</span></div>
        <div className="stacked-bar">{pillars.map((item) => <span key={item.label} style={{ width: `${portfolio.adjustedValue === 0 ? 0 : item.value / portfolio.adjustedValue * 100}%`, background: item.color }} />)}</div>
        <div className="mechanism-list">{pillars.map((item) => <div className="mechanism-row" key={item.label}><span className="legend-dot" style={{ background: item.color }} /><span>{item.label}</span><div className="micro-bar"><i style={{ width: `${item.value / maxPillar * 100}%`, background: item.color }} /></div><strong>{formatShort(item.value)}</strong></div>)}</div>
      </article>

      <article className="panel evidence-panel">
        <div className="panel-header"><div><p className="section-kicker">Validated-claim completeness</p><h2>How auditable are eligible claims?</h2></div><button className="text-button" onClick={() => onNavigate('studies')}>View register <ArrowRight size={15} /></button></div>
        <div className="evidence-donut-wrap"><div className="evidence-donut coverage-donut" style={{ background: `conic-gradient(var(--green) 0 ${portfolio.evidenceCoverage}%, #dfe5e1 ${portfolio.evidenceCoverage}% 100%)` }}><div><strong>{portfolio.evidenceCoverage}</strong><span>evidence coverage</span></div></div><div className="evidence-legend">{portfolio.evidenceMix.map((item) => <div key={item.grade}><EvidenceBadge grade={item.grade} /><span><strong>{Math.round(item.percentage)}%</strong><small>limiting evidence</small></span></div>)}</div></div>
        <div className="evidence-callout"><Info size={17} /><span><strong>{portfolio.retentionRate}% of eligible gross claim value remains after policy.</strong> Each claim uses the lower of its operational and valuation evidence weights, then its confidence multiplier. These adjustments affect Validated ROI only.</span></div>
      </article>

      <article className="panel pillars-panel">
        <div className="panel-header"><div><p className="section-kicker">Business Value framework</p><h2>Validated claim value across four strategic pillars</h2></div><span className="response-count">Pulse value is not allocated here</span></div>
        <div className="pillar-grid">{pillars.map((pillar) => <div className="pillar-summary" key={pillar.label}><span className="pillar-swatch" style={{ background: pillar.color }} /><div><span>{pillar.label}</span><strong>{pillar.value === 0 ? 'Not valued' : formatCurrency(pillar.value)}</strong><p>{pillar.description}</p><small>{pillar.sourceCount === 0 ? 'No claim is eligible for Validated ROI' : `Gross ${formatCurrency(pillar.rawValue)} · ${pillar.sourceCount} eligible claim${pillar.sourceCount === 1 ? '' : 's'}`}</small></div></div>)}</div>
      </article>
    </section>

    <section className="panel team-panel">
      <div className="panel-header"><div><p className="section-kicker">Process-level validated view</p><h2>Claim value and total cost by group</h2><p className="table-caption">Pulse-modelled value is portfolio-only and is not allocated to groups. For investment decisions—not employee ranking or individual performance management.</p></div><div className="table-actions"><label><Search size={15} /><input placeholder="Find a group" aria-label="Find a group" value={teamQuery} onChange={(event) => setTeamQuery(event.target.value)} /></label></div></div>
      <div className="table-scroll"><table><thead><tr><th>Group</th><th>Product</th><th>Total cost</th><th>Validated claim value</th><th>Validated ROI</th><th>Evidence stage</th><th>Decision</th></tr></thead><tbody>{teamRows.map((row) => <tr key={row.team}><td><strong>{row.team}</strong></td><td>{row.product === 'Portfolio-wide' ? row.product : <span className="product-cell"><ProductMark product={row.product} />{row.product}</span>}</td><td>{formatCurrency(row.totalCost)}</td><td><strong>{formatCurrency(row.adjustedValue)}</strong></td><td><span className={`roi-pill ${row.roi < 0 ? 'negative' : ''}`}>{formatPercent(row.roi)}</span></td><td>{row.stage ? <StageBadge stage={row.stage} /> : <span className="stage-badge cost">Cost only</span>}</td><td>{row.decision}</td></tr>)}{teamRows.length === 0 && <tr><td colSpan={7} className="table-empty">No groups match “{teamQuery}”.</td></tr>}</tbody></table></div>
      <button className="table-footer" onClick={() => onNavigate('hypotheses')}>Review testable hypotheses <ArrowRight size={15} /></button>
    </section>
  </div>
}

function PanelTitle({ kicker, title }: { kicker: string; title: string }) {
  return <div className="panel-header"><div><p className="section-kicker">{kicker}</p><h2>{title}</h2></div></div>
}

function Metric({ label, value, detail, icon: Icon, emphasis = false, modelled = false }: { label: string; value: string; detail: string; icon: typeof Activity; emphasis?: boolean; modelled?: boolean }) {
  return <div className={`metric ${emphasis ? 'emphasis' : ''} ${modelled ? 'modelled' : ''}`}><div className="metric-label"><Icon size={16} />{label}</div><strong>{value}</strong><span>{detail}</span></div>
}

function MiniStat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="mini-stat"><span>{label}</span><strong>{value}</strong><p>{note}</p></div>
}

function CostControl({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return <div className="assumption"><div className="assumption-top"><span>{label}</span><strong>{formatCurrency(value)}</strong></div><input type="range" min={0} max={max} step={1000} value={value} onChange={(event) => onChange(Number(event.target.value))} aria-label={`${label} cost`} style={{ backgroundSize: `${value / max * 100}% 100%` }} /><div className="assumption-scale"><span>$0</span><span>{formatCurrency(max)}</span></div></div>
}

function WeightControl({ label, grade, value, disabled, onChange }: { label: string; grade?: EvidenceGrade; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label className={`weight-control ${disabled ? 'locked' : ''}`}><span>{grade ? <EvidenceBadge grade={grade} /> : label}<strong>{Math.round(value * 100)}%</strong></span><input type="range" min={0} max={100} step={5} value={Math.round(value * 100)} disabled={disabled} onChange={(event) => onChange(Number(event.target.value) / 100)} aria-label={`${label} weight`} style={{ backgroundSize: `${Math.round(value * 100)}% 100%` }} /></label>
}

function Responses({ responses, onOpenSurvey }: { responses: ResponseRecord[]; onOpenSurvey: () => void }) {
  const projection = estimatePulseValue(responses)
  const projectionResponses = responses.filter((response) => response.sampleFrameId === projection.policy.id)
  const reportingResponses = projectionResponses.length > 0 ? projectionResponses : responses
  const pulse = summarizePulse(reportingResponses)
  const impactMidpoint = (response: ResponseRecord) => resolveTimeImpactHours(response.timeImpact).mid
  const midpoints = reportingResponses.map(impactMidpoint).sort((a, b) => a - b)
  const median = midpoints.length === 0 ? 0 : midpoints[Math.floor((midpoints.length - 1) / 2)]
  const noBenefitRate = reportingResponses.length === 0 ? 0 : (pulse.neutral + pulse.slower) / reportingResponses.length
  const productRows = (['GitHub Copilot', 'Copilot Cowork'] as Product[]).map((product) => {
    const matches = reportingResponses.filter((response) => response.product === product)
    const faster = matches.filter((response) => impactMidpoint(response) > 0).length
    const neutral = matches.filter((response) => impactMidpoint(response) === 0).length
    const slower = matches.length - faster - neutral
    const effects = matches.reduce<Record<string, number>>((result, response) => ({ ...result, [response.effect]: (result[response.effect] ?? 0) + 1 }), {})
    const commonEffect = Object.entries(effects).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No responses'
    return { product, count: matches.length, faster, neutral, slower, commonEffect }
  })
  const reportableRows = productRows.filter((row) => row.count >= minimumReportingGroup)
  const suppressed = productRows.filter((row) => row.count > 0 && row.count < minimumReportingGroup).length

  return <div className="page-content">
    <section className="sampling-banner">
      <div className="sampling-icon"><MessageSquareText size={24} /></div>
      <div><p className="section-kicker">Occasional 20-second random pulse</p><h2>Estimate ad-hoc task value without surveying every task</h2><p>Only responses tied to the governed random task-event frame enter the Pulse-inclusive projection. Manually opened previews remain discovery-only.</p></div>
      <div className="sampling-progress"><strong>{projection.projectionEligible ? 'Projection eligible' : 'Projection off'}</strong><span>{projection.projectionReason}</span></div>
      <button className="primary-button" onClick={onOpenSurvey}><Send size={16} /> Preview pulse</button>
    </section>
    <section className="mini-stat-grid">
      <MiniStat label="Random-sample responses" value={projection.sampledResponseCount.toLocaleString()} note={`${formatPercent(projection.responseRate)} of ${projection.invitations} invitations`} />
      <MiniStat label="Median task effect" value={formatHours(median)} note="within this sample" />
      <MiniStat label="No benefit or slower" value={formatPercent(noBenefitRate)} note="negative results retained" />
      <MiniStat label="Projected net task time" value={projection.projectionEligible ? formatHours(projection.estimatedHours) : 'Off'} note={projection.projectionEligible ? `95% sampling interval: ${formatHours(projection.hoursInterval.low)} to ${formatHours(projection.hoursInterval.high)}` : 'sampling gate not met'} />
    </section>
    <section className="panel projection-panel">
      <div className="panel-header"><div><p className="section-kicker">Pulse-inclusive model · {projection.policy.period}</p><h2>A bounded estimate, not booked savings</h2><p className="table-caption">Validated ROI never changes with Pulse data. The interval below covers sampling variation in the Pulse component only; claim value, costs, and modelling parameters are held fixed.</p></div><span className={`projection-status ${projection.projectionEligible ? 'eligible' : ''}`}>{projection.projectionEligible ? 'Projection eligible' : 'Not estimable'}</span></div>
      <div className="projection-summary">
        <div><span>Pulse-modelled value</span><strong>{projection.projectionEligible ? formatCurrency(projection.estimatedValue) : '—'}</strong><small>95% sampling interval {formatCurrency(projection.valueInterval.low)} to {formatCurrency(projection.valueInterval.high)}</small></div>
        <div><span>Eligible task frame</span><strong>{projection.populationTaskEvents.toLocaleString()}</strong><small>Source-certified as prefiltered for registered claim scopes</small></div>
        <div><span>Positive-time treatment</span><strong>{Math.round(projection.policy.selfReportCalibration * 100)}% × {Math.round(projection.policy.capacityRealizationRate * 100)}%</strong><small>Self-report calibration × demonstrated reuse</small></div>
        <div><span>Modelled value rate</span><strong>{formatCurrency(projection.policy.contributionValuePerHour)}/h</strong><small>Slower-task hours are charged at 100%</small></div>
      </div>
      <div className="table-scroll"><table><thead><tr><th>Product stratum</th><th>Eligible tasks</th><th>Invited</th><th>Responded</th><th>Response rate</th><th>Mean task effect</th><th>Projected net task time</th><th>Pulse-modelled value</th></tr></thead><tbody>{projection.strata.map((stratum) => <tr key={stratum.product}><td><span className="product-cell"><ProductMark product={stratum.product} /><strong>{stratum.product}</strong></span></td><td>{stratum.eligibleTaskEvents.toLocaleString()}</td><td>{stratum.invitations}</td><td>{stratum.responses}</td><td>{formatPercent(stratum.responseRate)}</td><td>{formatHours(stratum.meanTaskHours)}</td><td>{formatHours(stratum.projectedHours)}</td><td><strong>{formatCurrency(stratum.estimatedValue)}</strong></td></tr>)}</tbody></table></div>
      <div className="projection-method"><Info size={16} /><span><strong>{projection.policy.method} · frame {projection.policy.id}.</strong> {projection.policy.samplingUnit}. Variance includes finite-population correction and a {projection.policy.designEffect.toFixed(2)}× design effect. This browser prototype accepts source-certified, prefiltered frame totals; it does not identify or subtract overlapping sessions itself. The 95% interval covers random sampling variation only—not non-response, recall/self-report, frame, overlap-classification, or valuation-parameter uncertainty.</span></div>
    </section>
    <section className="panel records-panel">
      <div className="panel-header"><div><p className="section-kicker">Privacy-thresholded output</p><h2>Aggregate random-sample results</h2><p className="table-caption">Convenience previews are excluded. Groups below n={minimumReportingGroup} are suppressed in this local prototype; production policy requires n≥10.</p></div><EvidenceBadge grade="Estimated" prefix="Sample time evidence: " /></div>
      <div className="table-scroll"><table><thead><tr><th>Product group</th><th>Responses</th><th>Faster</th><th>No difference</th><th>Slower</th><th>Most common immediate effect</th></tr></thead><tbody>{reportableRows.map((row) => <tr key={row.product}><td><span className="product-cell"><ProductMark product={row.product} /><strong>{row.product}</strong></span></td><td>{row.count}</td><td>{row.faster}</td><td>{row.neutral}</td><td>{row.slower}</td><td>{row.commonEffect}</td></tr>)}{reportableRows.length === 0 && <tr><td colSpan={6} className="table-empty">No group has reached the reporting threshold.</td></tr>}</tbody></table></div>
      {suppressed > 0 && <div className="suppression-note"><Lock size={13} />{suppressed} group{suppressed === 1 ? '' : 's'} suppressed below n={minimumReportingGroup}.</div>}
    </section>
    <section className="staff-promise panel"><ShieldCheck size={24} /><div><p className="section-kicker">Staff promise</p><h2>Measure value, never individual productivity</h2><ul><li>No prompts, documents, messages, or source code</li><li>No names, email addresses, employee IDs, rankings, or manager-level raw responses</li><li>No response enters Validated ROI; projection requires a governed sample and versioned valuation policy</li><li>Negative and null findings remain visible and slower time is not discounted</li></ul></div></section>
  </div>
}

function Hypotheses({ hypotheses, studyRecords, selectedId, onClearSelection, onOpen, onStartStudy, onViewStudy }: {
  hypotheses: Hypothesis[]
  studyRecords: StudyRecord[]
  selectedId: number | null
  onClearSelection: () => void
  onOpen: () => void
  onStartStudy: (hypothesis: Hypothesis) => void
  onViewStudy: (studyId: string) => void
}) {
  const visible = hypotheses.filter((hypothesis) => selectedId === null || hypothesis.id === selectedId)
  return <div className="page-content">
    <PageIntro kicker="Quarterly value planning" title="Connect AI use to an outcome before measuring it" text="Workflow progress follows the linked outcome study. Financial eligibility remains a separate evidence and approval decision." action={<div className="workflow-actions">{selectedId !== null && <button className="secondary-button" onClick={onClearSelection}><LayoutDashboard size={16} /> All hypotheses</button>}<button className="primary-button" onClick={onOpen}><Plus size={17} /> Add hypothesis</button></div>} />
    <section className={`hypothesis-grid ${selectedId !== null ? 'focused-hypothesis' : ''}`}>{visible.map((item) => {
      const study = studyRecords.find((record) => record.hypothesisId === item.id)
      const status = getHypothesisStatus(item.id, studyRecords)
      return <article className="hypothesis-card" aria-labelledby={`hypothesis-title-${item.id}`} key={item.id}>
        <div className="hypothesis-top"><span className="product-chip"><ProductMark product={item.product} />{item.product}</span></div>
        <h3 id={`hypothesis-title-${item.id}`}>{item.useCase}</h3>
        <p className="owner"><Users size={15} />{item.owner}</p>
        <div className="hypothesis-flow"><div><span>Expected work effect</span><strong>{item.expectedEffect}</strong></div><ArrowRight size={18} /><div><span>Operational outcome</span><strong>{item.outcome}</strong></div></div>
        <div className="evidence-source"><Database size={15} /><div><span>Operational source</span><strong>{item.evidence}</strong></div></div>
        <div className="guardrail-row"><ShieldCheck size={15} /><div><span>Guardrail</span><strong>{item.guardrail}</strong></div></div>
        {study && <div className="linked-study"><span>Outcome study</span><strong>{study.name}</strong><StageBadge stage={study.stage} /></div>}
        <div className="card-footer"><span className={`status-pill ${status.toLowerCase().replaceAll(' ', '-')}`}><span />{status}</span>{study
          ? <button onClick={() => onViewStudy(study.id)}><FlaskConical size={15} /> View study <ArrowRight size={15} /></button>
          : <button onClick={() => onStartStudy(item)}><FlaskConical size={15} /> Start study <ArrowRight size={15} /></button>}</div>
      </article>
    })}</section>
  </div>
}

function Studies({ records, hypotheses, claims, assumptions, selectedId, onClearSelection, onViewHypothesis, onEdit, onReview }: {
  records: StudyRecord[]
  hypotheses: Hypothesis[]
  claims: ValueClaim[]
  assumptions: Assumptions
  selectedId: string | null
  onClearSelection: () => void
  onViewHypothesis: (hypothesisId: number) => void
  onEdit: (study: StudyRecord) => void
  onReview: (study: StudyRecord) => void
}) {
  const [pendingOnly, setPendingOnly] = useState(false)
  const ordered = records.filter((study) => selectedId !== null ? study.id === selectedId : !pendingOnly || study.financialReview?.status === 'Pending').sort((first, second) => second.progress - first.progress)
  const visibleClaims = claims.filter((claim) => selectedId === null || claim.id === selectedId)
  const validatedRoiClaimIds = new Set(calculatePortfolio(assumptions, claims).contributions.map((claim) => claim.id))
  return <div className="page-content">
    <PageIntro kicker="Incremental-effect evidence" title="Focused studies for the claims that matter most" text="Matched, pre/post, or staggered studies support the claim-backed Validated ROI path. The Pulse-inclusive projection remains separate, and null or negative results are retained in both paths." action={selectedId !== null ? <button className="secondary-button" onClick={onClearSelection}><LayoutDashboard size={16} /> All studies</button> : undefined} />
    {selectedId === null && <div className="finance-filter"><label><input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} />Pending financial reviews ({records.filter((study) => study.financialReview?.status === 'Pending').length})</label></div>}
    {ordered.length === 0 && <p className="finance-empty">No studies awaiting financial review.</p>}
    <section className={`study-grid ${selectedId !== null ? 'focused-study' : ''}`}>{ordered.map((study) => {
      const Icon = studies.find((seed) => seed.id === study.id)?.icon ?? FlaskConical
      const origin = hypotheses.find((hypothesis) => hypothesis.id === study.hypothesisId)
      const reviewStatus = study.financialReview?.status
      const approved = isFinanciallyApproved(study)
      return <article className="study-card" aria-labelledby={`study-title-${study.id}`} key={study.id}>
      <div className="study-heading"><div className="study-icon"><Icon size={21} /></div><div><span className="product-chip"><ProductMark product={study.product} />{study.product}</span><h3 id={`study-title-${study.id}`}>{study.name}</h3></div><StageBadge stage={study.stage} /></div>
      <div className="study-origin"><span>Originating hypothesis</span>{origin ? <button className="text-button" onClick={() => onViewHypothesis(origin.id)}><Lightbulb size={14} />{origin.useCase}<ArrowRight size={14} /></button> : <strong>Original hypothesis unavailable</strong>}</div>
      <div className="study-design"><FlaskConical size={16} /><span>{study.cohort || 'Cohort not set'}</span></div>
      <div className="study-result"><span>{study.metric}</span><strong>{study.result}</strong>{study.baseline && study.current ? <div className="study-baseline"><span className="baseline-from">{study.baseline}</span><ArrowRight size={13} /><span className="baseline-to">{study.current}</span></div> : <span className="no-baseline">Baseline incomplete</span>}{study.comparison && <div className="study-comparison"><span>Basis</span>{study.comparison}</div>}</div>
      <div className="study-progress"><div><i style={{ width: `${study.progress}%` }} /></div><span>{study.progress === 100 ? 'Study complete' : `${study.progress}% data collected`}</span></div>
      <div className="study-provenance">{study.expectedEffect && <div><span>Expected work effect</span><strong>{study.expectedEffect}</strong></div>}{study.outcome && <div><span>Target operational outcome</span><strong>{study.outcome}</strong></div>}<div><span>Period</span><strong>{study.period || 'Period not set'}</strong></div><div><span>Operational source</span><strong>{study.operationalSource}</strong></div><div><span>Guardrail</span><strong>{study.guardrail}</strong></div>{study.valuationFormula && <div><span>Valuation formula</span><strong>{study.valuationFormula}</strong></div>}</div>
      <div className="study-footer"><EvidenceBadge grade={study.operationalGrade} prefix="Outcome: " />{study.valuationGrade && <EvidenceBadge grade={study.valuationGrade} prefix="Value: " />}<span className={`confidence-pill ${study.confidence.toLowerCase()}`}>{study.confidence}</span><span className="study-value">{validatedRoiClaimIds.has(study.id) ? `${formatCurrency(study.grossValue)} gross · eligible for Validated ROI` : study.capacityHours ? `${study.capacityHours} h capacity · excluded from Validated ROI` : `${formatCurrency(study.grossValue)} potential · excluded from Validated ROI`}</span></div>
      <div className="study-finance"><span className={`finance-status ${(reviewStatus ?? 'unsubmitted').toLowerCase()}`}>{reviewStatus === 'Pending' ? 'Pending financial review' : reviewStatus === 'Rejected' ? 'Changes requested' : approved ? study.stage === 'Realized' ? 'Reconciled' : 'Financially approved' : 'Not financially approved'}</span>{study.approvedBy && approved && <span>{study.approvedBy}</span>}</div>
      <div className="study-actions">
        {reviewStatus !== 'Pending' && reviewStatus !== 'Approved' && <button className="secondary-button" onClick={() => onEdit(study)}><FileSpreadsheet size={15} /> Record evidence</button>}
        <button className={reviewStatus === 'Pending' ? 'primary-button' : 'secondary-button'} disabled={!study.financialReview && study.progress !== 100} title={!study.financialReview && study.progress !== 100 ? 'Complete the study before preparing a valuation' : undefined} onClick={() => onReview(study)}><CircleDollarSign size={15} />{reviewStatus === 'Pending' ? 'Review valuation' : reviewStatus === 'Approved' ? 'View approval' : 'Prepare valuation'}</button>
      </div>
    </article>})}</section>
    <section className="methodology-note"><ShieldCheck size={22} /><div><strong>Validated ROI guardrail</strong><p>Claims need a baseline, comparison, stable metric definitions, quality guardrails, a transparent valuation source, finance approval, positive gross value, and a unique overlap key before entering Validated ROI. Completing a study does not guarantee eligibility or a positive result.</p></div></section>
    <section className="panel claim-register"><div className="panel-header"><div><p className="section-kicker">Auditable claims register</p><h2>{selectedId !== null ? 'Linked study claim' : 'Every claim, including those excluded from Validated ROI'}</h2></div><span className="response-count">Overlap keys prevent double counting</span></div><div className="table-scroll"><table><thead><tr><th>Claim</th><th>Stage</th><th>Outcome evidence</th><th>Valuation evidence</th><th>Formula and source</th><th>Validated ROI</th><th>Approval</th></tr></thead><tbody>{visibleClaims.map((claim) => { const eligible = validatedRoiClaimIds.has(claim.id); return <tr key={claim.id}><td><strong>{claim.name}</strong><span className="cell-subtitle">{claim.period || 'Period not set'} · {claim.overlapKey}</span></td><td><StageBadge stage={claim.stage} /></td><td><EvidenceBadge grade={claim.operationalGrade} /></td><td>{claim.valuationGrade ? <EvidenceBadge grade={claim.valuationGrade} /> : 'Not valued'}</td><td className="formula-cell">{claim.valuationFormula ?? 'Operational discovery only'}{claim.valuationSource && <span className="cell-subtitle">Source: {claim.valuationSource}</span>}</td><td>{eligible ? <span className="eligibility yes"><Check size={12} />Eligible</span> : <span className="eligibility">Excluded</span>}</td><td>{claim.approvedBy ?? 'Not approved'}</td></tr> })}</tbody></table></div></section>
  </div>
}

function Imports({ imports, fileInput, onImport }: { imports: ImportRecord[]; fileInput: RefObject<HTMLInputElement | null>; onImport: (file: File) => void }) {
  return <div className="page-content">
    <PageIntro kicker="Aggregate portfolio inputs" title="Bring cost, usage, and organization data together" text="Upload grouped exports. Direct identifiers and work content are neither required nor accepted by the prototype." />
    <section className="import-layout"><div className="upload-panel" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) onImport(file) }}><div className="upload-icon"><Upload size={26} /></div><h3>Import an aggregate CSV export</h3><p>Drop a grouped GitHub Copilot, Microsoft 365, finance, or organization export here.</p><input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = '' }} /><button className="secondary-button" onClick={() => fileInput.current?.click()}><FileSpreadsheet size={16} /> Choose CSV file</button><span className="upload-hint">Expected: product, team or department, period, aggregate usage, and cost. Do not include names, email, UPN, or employee IDs.</span></div><div className="privacy-panel"><ShieldCheck size={22} /><div><p className="section-kicker">Control status</p><h3>Privacy claims are explicit</h3><ul><li><span className="control-status implemented">Implemented</span>No prompt or content fields</li><li><span className="control-status implemented">Implemented</span>Direct identifier rejection</li><li><span className="control-status prototype">Prototype</span>Aggregate display threshold n≥{minimumReportingGroup}</li><li><span className="control-status planned">Production</span>RBAC, n≥10, retention, and audit logs</li></ul></div></div></section>
    <section className="panel records-panel"><div className="panel-header"><div><p className="section-kicker">Import history</p><h2>Aggregate datasets</h2></div><button className="text-button" onClick={() => downloadBlob('ai-value-calculator-aggregate-import-template.csv', importTemplateCsv, 'text/csv')}><Download size={15} /> Download template</button></div><div className="table-scroll"><table><thead><tr><th>File</th><th>Source</th><th>Rows</th><th>Imported</th><th>Validation</th><th>Status</th></tr></thead><tbody>{imports.map((item) => <tr key={item.id}><td><span className="file-cell"><FileSpreadsheet size={15} /><strong>{item.name}</strong></span></td><td>{item.source}</td><td>{item.rows.toLocaleString()}</td><td>{item.date}</td><td>{item.note ?? `${item.columns ?? 0} columns`}</td><td><span className={`import-status ${item.status === 'Needs mapping' ? 'mapping' : ''}`}><span />{item.status}</span></td></tr>)}</tbody></table></div></section>
  </div>
}

function PageIntro({ kicker, title, text, action }: { kicker: string; title: string; text: string; action?: ReactNode }) {
  return <section className="page-intro"><div><p className="section-kicker">{kicker}</p><h2>{title}</h2><p>{text}</p></div>{action}</section>
}

function ModalShell({ title, eyebrow, onClose, children, className = '' }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; className?: string }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><p className="section-kicker">{eyebrow}</p><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>{children}</div></div>
}

function SurveyModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const minimumHours = -4
  const maximumHours = 4
  const [timeImpact, setTimeImpact] = useState<number | null>(0)
  const hoursInput = useRef<HTMLInputElement>(null)
  const displayedHours = timeImpact ?? 0
  const sliderPosition = (displayedHours - minimumHours) / (maximumHours - minimumHours) * 100
  const highlightedStart = Math.min(50, sliderPosition)
  const highlightedEnd = Math.max(50, sliderPosition)
  const highlightColor = displayedHours < 0 ? 'var(--orange)' : 'var(--green)'
  const absoluteHours = Math.abs(displayedHours)
  const formattedHours = absoluteHours.toLocaleString('en-US', { maximumFractionDigits: 2 })
  const timeImpactDescription = timeImpact === null
    ? 'Enter an amount'
    : displayedHours === 0
      ? 'No change in task time'
      : `${formattedHours} hour${absoluteHours === 1 ? '' : 's'} ${displayedHours < 0 ? 'slower' : 'faster'}`

  const updateFromSlider = (value: number) => {
    setTimeImpact(value)
    if (hoursInput.current) hoursInput.current.value = String(value)
  }

  const updateFromHoursInput = (input: HTMLInputElement) => {
    const value = input.valueAsNumber
    setTimeImpact(Number.isFinite(value) ? Math.max(minimumHours, Math.min(maximumHours, value)) : null)
  }

  const normalizeHoursInput = (input: HTMLInputElement) => {
    const value = input.valueAsNumber
    const normalized = Number.isFinite(value) ? Math.max(minimumHours, Math.min(maximumHours, value)) : 0
    input.value = String(normalized)
    setTimeImpact(normalized)
  }

  return <ModalShell eyebrow="Optional 20-second pulse" title="What effect, if any, did AI have on this task?" onClose={onClose}>
    <form onSubmit={onSubmit} className="modal-form">
      <div className="survey-context">
        <span>Preview context · prefilled</span>
        <div className="form-row survey-context-fields">
          <label>Product<select name="product" required defaultValue="GitHub Copilot"><option>GitHub Copilot</option><option>Copilot Cowork</option></select></label>
          <label>Team<select name="team" required defaultValue="Digital Channels">{pulseTeamOptions.map((team) => <option key={team}>{team}</option>)}</select></label>
          <label>Work type<select name="workType" required defaultValue="Code and tests">{pulseWorkTypeOptions.map((workType) => <option key={workType}>{workType}</option>)}</select></label>
        </div>
        <p>Check and correct these details if needed. Team is recorded as group context; no name, email, employee ID, prompt, or work content is collected.</p>
      </div>
      <fieldset className="pulse-time-field">
        <legend>Compared with your usual approach, how did task time change?</legend>
        <div className="pulse-hours-control">
          <div className="pulse-slider-column">
            <input
              id="pulse-hours-slider"
              className="pulse-hours-slider"
              type="range"
              min={minimumHours}
              max={maximumHours}
              step={0.25}
              value={displayedHours}
              aria-label="Task time change"
              aria-valuetext={timeImpactDescription}
              aria-describedby="pulse-hours-help"
              onChange={(event) => updateFromSlider(Number(event.target.value))}
              style={{ background: `linear-gradient(to right, #e4eae7 0%, #e4eae7 ${highlightedStart}%, ${highlightColor} ${highlightedStart}%, ${highlightColor} ${highlightedEnd}%, #e4eae7 ${highlightedEnd}%, #e4eae7 100%)` }}
            />
            <div className="pulse-hours-scale" aria-hidden="true"><span>4 h slower</span><span>0</span><span>4 h faster</span></div>
          </div>
          <label className="pulse-hours-field" htmlFor="pulse-hours-input"><span>Hours</span><div className="pulse-hours-input"><input ref={hoursInput} id="pulse-hours-input" name="timeImpact" type="number" inputMode="decimal" min={minimumHours} max={maximumHours} step="any" defaultValue="0" required aria-label="Task time change in hours" aria-describedby="pulse-hours-help" onChange={(event) => updateFromHoursInput(event.currentTarget)} onBlur={(event) => normalizeHoursInput(event.currentTarget)} /><span aria-hidden="true">hrs</span></div></label>
        </div>
        <output className={`pulse-hours-summary ${displayedHours < 0 ? 'slower' : displayedHours > 0 ? 'faster' : ''}`} htmlFor="pulse-hours-slider pulse-hours-input">{timeImpactDescription}</output>
        <p id="pulse-hours-help" className="pulse-hours-help">Use a negative number for slower and a positive number for faster.</p>
      </fieldset>
      <label>What was the main immediate effect?<select name="effect" required defaultValue=""><option value="" disabled>Select an effect</option>{pulseEffectOptions.map((effect) => <option key={effect}>{effect}</option>)}</select></label>
      <div className="pulse-disclaimer"><Info size={15} /><span>This convenience preview is discovery-only. It enters neither Validated ROI nor the governed Pulse-inclusive projection; only responses carrying the registered random-frame ID are projected.</span></div>
      <div className="modal-actions"><span><ShieldCheck size={15} />Grouped reporting only</span><button type="button" className="secondary-button" onClick={onClose}>Skip</button><button className="primary-button" type="submit">Record pulse <ArrowRight size={16} /></button></div>
    </form>
  </ModalShell>
}

function StudyModal({ study, error, onClose, onSubmit }: {
  study: StudyRecord
  error: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return <ModalShell eyebrow={study.name} title="Record study evidence" onClose={onClose}>
    <form onSubmit={onSubmit} className="modal-form">
      <div className="form-row"><label>Study cohort<input name="cohort" required defaultValue={study.cohort} /></label><label>Study period<input name="period" required defaultValue={study.period} placeholder="e.g. Q3 2026" /></label></div>
      <label>Outcome metric<input name="metric" required defaultValue={study.metric} /></label>
      <label>Operational evidence source<input name="operationalSource" required defaultValue={study.operationalSource} /></label>
      <div className="form-row"><label>Baseline<input name="baseline" defaultValue={study.baseline} /></label><label>Current measurement<input name="current" defaultValue={study.current} /></label></div>
      <label>Comparison method<input name="comparison" defaultValue={study.comparison} /></label>
      <label>Observed result<input name="result" defaultValue={study.result === 'Not measured yet' ? '' : study.result} /></label>
      <div className="form-row"><label>Outcome evidence<select name="operationalGrade" defaultValue={study.operationalGrade}>{(Object.keys(evidenceWeightKeys) as EvidenceGrade[]).map((grade) => <option key={grade}>{grade}</option>)}</select></label><label>Study progress (%)<input name="progress" type="number" min="0" max="100" step="1" required defaultValue={study.progress} /></label></div>
      <div className="guardrail-row"><ShieldCheck size={15} /><div><span>Original guardrail</span><strong>{study.guardrail}</strong></div></div>
      {error && <p className="study-error" role="alert">{error}</p>}
      <div className="modal-actions"><span><StageBadge stage={study.stage} />Not financially validated</span><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Check size={16} /> Save evidence</button></div>
    </form>
  </ModalShell>
}

function HypothesisModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <ModalShell eyebrow="Value hypothesis" title="Define a claim worth testing" onClose={onClose}><form onSubmit={onSubmit} className="modal-form"><label>AI-assisted use case<input name="useCase" required placeholder="e.g. Generate unit tests" /></label><div className="form-row"><label>Owning group<input name="owner" required placeholder="e.g. Digital Channels" /></label><label>Product<select name="product"><option>GitHub Copilot</option><option>Copilot Cowork</option></select></label></div><label>Expected work effect<input name="expectedEffect" required placeholder="e.g. Shorter development cycle" /></label><label>Observable operational outcome<input name="outcome" required placeholder="e.g. Increase release throughput" /></label><label>Operational evidence source<input name="evidence" required placeholder="e.g. Deployment and pull request data" /></label><label>Quality, risk, or workload guardrail<input name="guardrail" required placeholder="e.g. Escaped defects must not increase" /></label><div className="modal-actions"><span><Target size={15} />Null and negative results remain visible</span><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit">Add hypothesis <ArrowRight size={16} /></button></div></form></ModalShell>
}

export default App
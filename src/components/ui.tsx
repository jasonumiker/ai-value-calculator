import type { ReactNode } from 'react'
import { Bot, GitBranch, Sparkles, X, type LucideIcon } from 'lucide-react'
import { productDefinition } from '../domain/products'
import type { HypothesisProgress } from '../domain/hypotheses'
import type { UnitEconomicsStatus } from '../domain/pulse'
import type { StudyStatus } from '../domain/studies'
import type { DecisionOption, EvidenceGrade, Product, ProductDefinition, ValueStage } from '../domain/types'

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export function ProductMark({ product, products }: { product: Product; products: ProductDefinition[] }) {
  const category = productDefinition(products, product).category
  const Icon = category === 'Coding assistant' ? GitBranch : category === 'Knowledge work' ? Sparkles : Bot
  return <Icon size={14} aria-hidden="true" />
}

export function ProductChip({ product, products, detail }: { product: Product; products: ProductDefinition[]; detail?: string }) {
  return <span className="product-chip"><ProductMark product={product} products={products} />{product}{detail && <span className="chip-detail">· {detail}</span>}</span>
}

export function EvidenceBadge({ grade, prefix }: { grade: EvidenceGrade; prefix?: string }) {
  return <span className={`evidence-badge ${grade.toLowerCase()}`}><span />{prefix}{grade}</span>
}

export function StageBadge({ stage }: { stage: ValueStage }) {
  return <span className={`stage-badge ${stage.toLowerCase()}`}>{stage}</span>
}

export function VerdictBadge({ status }: { status: StudyStatus | HypothesisProgress }) {
  return <span className={`verdict-badge ${slug(status)}`}>{status}</span>
}

export function DecisionBadge({ decision }: { decision: DecisionOption }) {
  return <span className={`decision-badge ${slug(decision)}`}>{decision}</span>
}

export function EconomicsBadge({ status }: { status: UnitEconomicsStatus }) {
  return <span className={`economics-badge ${slug(status)}`}>{status}</span>
}

export function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: 'emphasis' | 'modelled' }) {
  return (
    <div className={`metric ${tone ?? ''}`}>
      <div className="metric-label"><Icon size={16} />{label}</div>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  )
}

export function MiniStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="mini-stat"><span>{label}</span><strong>{value}</strong>{note && <p>{note}</p>}</div>
}

export function PanelHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="panel-header">
      <div><p className="section-kicker">{kicker}</p><h2>{title}</h2></div>
      {children}
    </div>
  )
}

export function PageIntro({ kicker, title, text, action }: { kicker: string; title: string; text: string; action?: ReactNode }) {
  return (
    <section className="page-intro">
      <div><p className="section-kicker">{kicker}</p><h2>{title}</h2><p>{text}</p></div>
      {action}
    </section>
  )
}

export function ModalShell({ title, eyebrow, onClose, children, className = '' }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; className?: string }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div><p className="section-kicker">{eyebrow}</p><h2 id="modal-title">{title}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function FormError({ message }: { message: string }) {
  return message ? <p className="study-error" role="alert">{message}</p> : null
}

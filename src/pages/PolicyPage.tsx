import { useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, History, Plus, Send } from 'lucide-react'
import { FormError, PageIntro, PanelHeader, ProductMark } from '../components/ui'
import { errorMessage } from '../components/helpers'
import { formatCurrency, formatPercent } from '../domain/format'
import { periodLabel } from '../domain/periods'
import { breakEvenRatio, describePolicyChanges, designDescriptions, policyLabel, policyWarnings } from '../domain/policy'
import { productCategories } from '../domain/products'
import { confidenceLevels, evidenceGrades, reuseCategories, studyDesigns, type Confidence, type EvidenceGrade, type Policy, type ProductCategory } from '../domain/types'
import { derivePeriod } from '../state/derive'
import type { PageContext } from './types'

function PercentControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="weight-control">
      <span>{label}<strong>{Math.round(value * 100)}%</strong></span>
      <input type="range" min={0} max={100} step={5} value={Math.round(value * 100)} aria-label={label} style={{ backgroundSize: `${Math.round(value * 100)}% 100%` }} onChange={(event) => onChange(Number(event.target.value) / 100)} />
    </label>
  )
}

function NumberControl({ label, value, step = 1, min = 0, onChange }: { label: string; value: number; step?: number; min?: number; onChange: (value: number) => void }) {
  return <label className="number-control">{label}<input type="number" min={min} step={step} value={value} onChange={(event) => onChange(event.target.valueAsNumber)} /></label>
}

export function PolicyPage({ data, actions, view, period, notify }: PageContext) {
  const [draft, setDraft] = useState<Policy>(data.policy)
  const [error, setError] = useState('')
  const [productError, setProductError] = useState('')
  const changes = describePolicyChanges(data.policy, draft)
  const warnings = policyWarnings(draft)
  const preview = useMemo(() => (changes.length > 0 ? derivePeriod(data, period, draft) : view), [changes.length, data, period, draft, view])
  const set = <K extends keyof Policy>(key: K, value: Policy[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const breakEven = breakEvenRatio(draft.defaultSelfReportCalibration, draft.defaultCapacityRealization, draft.lossTreatment)

  const publish = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const published = actions.publishPolicy(draft, String(form.get('actor') ?? ''), String(form.get('reason') ?? ''))
      setDraft(published)
      setError('')
      event.currentTarget.reset()
      notify(`${policyLabel(published)} published. New valuations and samples use it.`)
    } catch (failure) {
      setError(errorMessage(failure, 'The policy could not be published.'))
    }
  }

  const addProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      actions.addProduct({ name: String(form.get('name') ?? ''), category: String(form.get('category')) as ProductCategory, workTypes: String(form.get('workTypes') ?? '') })
      setProductError('')
      event.currentTarget.reset()
      notify('Product added. It appears in hypotheses, surveys, and imports.')
    } catch (failure) {
      setProductError(errorMessage(failure, 'The product could not be added.'))
    }
  }

  return (
    <div className="page-content policy-page">
      <PageIntro kicker={`Rules & policy · ${policyLabel(data.policy)} in force`} title="Finance sets the rules for evidence and valuation" text="Edit a draft, preview its effect on this quarter, then publish a new version. Every valuation records the policy version it was prepared under." />
      <div className="policy-layout">
        <div className="policy-sections">
          <section className="panel">
            <PanelHeader kicker="Claims" title="Evidence weights and confidence multipliers" />
            <div className="weight-grid">{evidenceGrades.map((grade) => <PercentControl key={grade} label={`${grade} weight`} value={draft.evidenceWeights[grade]} onChange={(value) => set('evidenceWeights', { ...draft.evidenceWeights, [grade]: value })} />)}</div>
            <div className="weight-grid confidence-grid">{confidenceLevels.map((level) => <PercentControl key={level} label={`${level} confidence`} value={draft.confidenceWeights[level]} onChange={(value) => set('confidenceWeights', { ...draft.confidenceWeights, [level]: value })} />)}</div>
            <p className="panel-foot">Each approved claim keeps the lower of its outcome and valuation weights, times its confidence multiplier. These are governance discounts, not statistical confidence.</p>
          </section>
          <section className="panel">
            <PanelHeader kicker="Studies" title="Strongest evidence each study design can claim" />
            <div className="table-scroll">
              <table className="design-table">
                <thead><tr><th>Design</th><th>Maximum outcome evidence</th><th>Maximum confidence</th></tr></thead>
                <tbody>{studyDesigns.map((design) => (
                  <tr key={design}>
                    <td><strong>{design}</strong><span className="cell-subtitle">{designDescriptions[design]}</span></td>
                    <td><select aria-label={`${design} maximum evidence`} value={draft.designCaps[design].grade} onChange={(event) => set('designCaps', { ...draft.designCaps, [design]: { ...draft.designCaps[design], grade: event.target.value as EvidenceGrade } })}>{evidenceGrades.map((grade) => <option key={grade}>{grade}</option>)}</select></td>
                    <td><select aria-label={`${design} maximum confidence`} value={draft.designCaps[design].confidence} onChange={(event) => set('designCaps', { ...draft.designCaps, [design]: { ...draft.designCaps[design], confidence: event.target.value as Confidence } })}>{confidenceLevels.map((level) => <option key={level}>{level}</option>)}</select></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <PanelHeader kicker="Pulse valuation" title="How reported time becomes modelled value" />
            <div className="control-grid">
              <NumberControl label="Contribution value per hour ($)" value={draft.contributionValuePerHour} min={1} onChange={(value) => set('contributionValuePerHour', value)} />
              <label className="number-control">Slower-task treatment
                <select value={draft.lossTreatment} onChange={(event) => set('lossTreatment', event.target.value as Policy['lossTreatment'])}>
                  <option value="Full rate">Charge at the full rate (conservative)</option>
                  <option value="Same discounts">Apply the same discounts as gains</option>
                </select>
              </label>
              <PercentControl label="Default self-report calibration" value={draft.defaultSelfReportCalibration} onChange={(value) => set('defaultSelfReportCalibration', value)} />
              <label className="toggle-control"><input type="checkbox" checked={draft.useStudyCalibration} onChange={(event) => set('useStudyCalibration', event.target.checked)} />Replace the default with study calibration where a timing study exists</label>
              <PercentControl label="Default share of saved time reused" value={draft.defaultCapacityRealization} onChange={(value) => set('defaultCapacityRealization', value)} />
              <label className="toggle-control"><input type="checkbox" checked={draft.useSurveyReuse} onChange={(event) => set('useSurveyReuse', event.target.checked)} />Use surveyed reuse once there are enough answers</label>
              <NumberControl label="Answers needed for surveyed reuse" value={draft.minimumReuseAnswers} min={1} onChange={(value) => set('minimumReuseAnswers', value)} />
            </div>
            <div className="weight-grid">{reuseCategories.map((category) => <PercentControl key={category} label={category} value={draft.reuseWeights[category]} onChange={(value) => set('reuseWeights', { ...draft.reuseWeights, [category]: value })} />)}</div>
            <p className="panel-foot">At the defaults, a work type must save {Number.isFinite(breakEven) ? `${breakEven.toFixed(1)}×` : 'infinitely more than'} the time it loses to break even{draft.lossTreatment === 'Full rate' ? ', because losses are charged in full while gains are discounted' : ''}.</p>
          </section>
          <section className="panel">
            <PanelHeader kicker="Sampling, privacy, and decisions" title="Rules for the random Pulse" />
            <div className="control-grid">
              <NumberControl label="Minimum responses per stratum" value={draft.minimumResponsesPerStratum} min={2} onChange={(value) => set('minimumResponsesPerStratum', value)} />
              <PercentControl label="Minimum response rate" value={draft.minimumResponseRate} onChange={(value) => set('minimumResponseRate', value)} />
              <NumberControl label="Design effect (×)" value={draft.designEffect} step={0.05} min={1} onChange={(value) => set('designEffect', value)} />
              <NumberControl label="Days between invitations per person" value={draft.cadenceDays} onChange={(value) => set('cadenceDays', value)} />
              <NumberControl label="Maximum invitations per person per quarter" value={draft.maxInvitationsPerPersonPerQuarter} min={1} onChange={(value) => set('maxInvitationsPerPersonPerQuarter', value)} />
              <NumberControl label="Invitations per week" value={draft.invitationsPerWeek} min={1} onChange={(value) => set('invitationsPerWeek', value)} />
              <NumberControl label="Minimum reporting group" value={draft.minimumReportingGroup} min={3} onChange={(value) => set('minimumReportingGroup', value)} />
              <NumberControl label="Scale when benefit ÷ cost reaches (×)" value={draft.scaleBenefitCostRatio} step={0.1} min={0.1} onChange={(value) => set('scaleBenefitCostRatio', value)} />
            </div>
            <p className="panel-foot">Sampling changes apply to the next sample drawn; existing samples keep the rules they were drawn under.</p>
          </section>
        </div>

        <aside className="policy-side">
          <section className="panel sticky-panel">
            <PanelHeader kicker="Draft" title={changes.length === 0 ? 'No changes yet' : `${changes.length} change${changes.length === 1 ? '' : 's'} to publish`} />
            {changes.length > 0 && <ul className="change-list">{changes.map((change) => <li key={change}>{change}</li>)}</ul>}
            {warnings.map((warning) => <p key={warning} className="policy-warning"><AlertTriangle size={14} />{warning}</p>)}
            <dl className="impact-grid">
              <div><dt>Validated ROI · {periodLabel(period)}</dt><dd>{formatPercent(view.portfolio.roi)} → <strong>{formatPercent(preview.portfolio.roi)}</strong></dd></div>
              <div><dt>Pulse estimate</dt><dd>{view.projection.projectionEligible ? formatCurrency(view.projection.estimatedValue) : '—'} → <strong>{preview.projection.projectionEligible ? formatCurrency(preview.projection.estimatedValue) : 'Not estimable'}</strong></dd></div>
              <div><dt>Pulse-inclusive ROI</dt><dd>{view.projection.projectionEligible ? formatPercent(view.combined.roi) : '—'} → <strong>{preview.projection.projectionEligible ? formatPercent(preview.combined.roi) : 'Not estimable'}</strong></dd></div>
            </dl>
            <form className="modal-form" onSubmit={publish}>
              <label>Published by<input name="actor" required defaultValue="CFO (demo)" /></label>
              <label>Reason for the change<input name="reason" required placeholder="e.g. Align reuse weights with the finance manual" /></label>
              <FormError message={error} />
              <div className="publish-actions">
                <button type="button" className="secondary-button" disabled={changes.length === 0} onClick={() => setDraft(data.policy)}>Discard draft</button>
                <button type="submit" className="primary-button" disabled={changes.length === 0}><Send size={15} /> Publish {policyLabel({ version: data.policy.version + 1 })}</button>
              </div>
            </form>
          </section>
          <section className="panel">
            <PanelHeader kicker="Version history" title="Published policies" />
            <ol className="policy-history">
              {data.policyHistory.map((change) => (
                <li key={change.version}>
                  <div><History size={13} /><strong>{policyLabel(change)}</strong><span>{new Date(change.changedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {change.changedBy}</span></div>
                  <p>{change.reason}</p>
                  <ul>{change.changes.map((line) => <li key={line}>{line}</li>)}</ul>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel">
            <PanelHeader kicker="Configuration" title="Products and work types" />
            <ul className="product-list">
              {data.products.map((product) => (
                <li key={product.name}><span className="product-cell"><ProductMark product={product.name} products={data.products} /><strong>{product.name}</strong></span><span className="cell-subtitle">{product.category} · {product.workTypes.join(', ')}</span></li>
              ))}
            </ul>
            <form className="modal-form" onSubmit={addProduct}>
              <div className="form-row"><label>Product name<input name="name" required placeholder="e.g. Azure AI Foundry agents" /></label>
                <label>Category<select name="category" defaultValue="Agent or other">{productCategories.map((category) => <option key={category}>{category}</option>)}</select></label></div>
              <label>Work types (comma separated)<input name="workTypes" placeholder="Leave blank for the category defaults" /></label>
              <FormError message={productError} />
              <button className="secondary-button" type="submit"><Plus size={15} /> Add product</button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  )
}

import { Check, CircleDollarSign } from 'lucide-react'
import { EvidenceBadge, PageIntro, PanelHeader, StageBadge } from '../components/ui'
import { isFinanciallyApproved } from '../domain/finance'
import { formatCurrency } from '../domain/format'
import { periodLabel } from '../domain/periods'
import { studyStatus } from '../domain/studies'
import type { PageContext } from './types'

export function ApprovalsPage({ data, view, period, openReview, navigate }: PageContext) {
  const pending = data.studies.filter((study) => study.financialReview?.status === 'Pending')
  const awaiting = data.studies.filter((study) => studyStatus(study) === 'Supported' && !study.financialReview)
  const returned = data.studies.filter((study) => study.financialReview?.status === 'Rejected')
  const toRealize = data.studies.filter((study) => study.stage === 'Validated' && isFinanciallyApproved(study))
  const eligible = new Set(view.portfolio.contributions.map((claim) => claim.id))
  const claims = view.claims.filter((claim) => claim.period === period)

  const queue = [
    ...pending.map((study) => ({ study, label: 'Proposed · decide', primary: true })),
    ...awaiting.map((study) => ({ study, label: 'Supported · awaiting a proposed valuation', primary: false })),
    ...returned.map((study) => ({ study, label: 'Returned for changes', primary: false })),
    ...toRealize.map((study) => ({ study, label: 'Approved · reconcile when realized', primary: false })),
  ]

  return (
    <div className="page-content">
      <PageIntro kicker="Financial approvals" title="Proposed → approved → realized" text="Only supported studies can be valued. Approval accepts a specific valuation for a cohort and period; realization reconciles it to the ledger. Changing the evidence afterwards voids the approval." />
      <section className="panel">
        <PanelHeader kicker="Queue" title={`${pending.length} proposed valuation${pending.length === 1 ? '' : 's'} awaiting a decision`} />
        <ul className="approval-queue">
          {queue.map(({ study, label, primary }) => (
            <li key={study.id}>
              <div><strong>{study.name}</strong><span>{study.team} · {periodLabel(study.period)} · {study.result}</span></div>
              <span className="queue-label">{label}</span>
              <button className={primary ? 'primary-button' : 'secondary-button'} onClick={() => openReview(study.id)}>
                <CircleDollarSign size={14} />{study.financialReview?.status === 'Pending' ? 'Review valuation' : study.financialReview?.status === 'Approved' ? 'Record realization' : study.financialReview?.status === 'Rejected' ? 'Revise valuation' : 'Propose valuation'}
              </button>
            </li>
          ))}
          {queue.length === 0 && <li className="table-empty">Nothing waiting. Supported studies will appear here.</li>}
        </ul>
      </section>
      <section className="panel claim-register">
        <PanelHeader kicker={`Claims register · ${periodLabel(period)}`} title="Every claim this quarter, including those excluded from Validated ROI">
          <button className="text-button" onClick={() => navigate('decisions')}>Decisions</button>
        </PanelHeader>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Claim</th><th>Stage</th><th>Outcome evidence</th><th>Valuation evidence</th><th>Formula and source</th><th>Validated ROI</th><th>Approval</th></tr></thead>
            <tbody>
              {claims.map((claim) => (
                <tr key={claim.id}>
                  <td><strong>{claim.name}</strong><span className="cell-subtitle">{claim.team} · {claim.overlapKey}</span></td>
                  <td><StageBadge stage={claim.stage} /></td>
                  <td><EvidenceBadge grade={claim.operationalGrade} /></td>
                  <td>{claim.valuationGrade ? <EvidenceBadge grade={claim.valuationGrade} /> : 'Not valued'}</td>
                  <td className="formula-cell">{claim.valuationFormula ?? 'No valuation yet'}{claim.valuationSource && <span className="cell-subtitle">Source: {claim.valuationSource}</span>}</td>
                  <td>{eligible.has(claim.id) ? <span className="eligibility yes"><Check size={12} />{formatCurrency(view.portfolio.contributions.find((entry) => entry.id === claim.id)?.adjustedValue ?? 0)}</span> : <span className="eligibility">Excluded</span>}</td>
                  <td>{isFinanciallyApproved(claim) ? claim.approvedBy : 'Not approved'}</td>
                </tr>
              ))}
              {claims.length === 0 && <tr><td colSpan={7} className="table-empty">No claims for {periodLabel(period)}.</td></tr>}
            </tbody>
          </table>
        </div>
        {view.portfolio.excludedDuplicates.length > 0 && <p className="panel-foot">{view.portfolio.excludedDuplicates.length} duplicate claim(s) excluded by benefit scope key.</p>}
      </section>
    </div>
  )
}

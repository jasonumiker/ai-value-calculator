import { RotateCcw, X } from 'lucide-react'
import type { Policy } from '../domain/types'

const sections = (policy: Policy): { title: string; items: string[] }[] => [
  {
    title: 'Demo data',
    items: [
      'Every organisation, cost, response, study, approval, and decision is fictional and generated for illustration.',
      'The app runs entirely in your browser and stores changes in localStorage. Do not enter real employee or customer data.',
    ],
  },
  {
    title: 'Sampling and the Pulse estimate',
    items: [
      'Session-level usage is synthesized from the aggregate counts in the bill. In production, the invitation service would sample the product’s own session log.',
      `Invitations are stratified by product and work type and spread over the weeks in proportion to each week’s sessions. Nobody is invited within ${policy.cadenceDays} days of an earlier invitation, across quarters too, or more than ${policy.maxInvitationsPerPersonPerQuarter} times a quarter. The caps make selection slightly unequal; the ${policy.designEffect}× design effect widens intervals to allow for it.`,
      'A sample drawn from part of a quarter gets that share of the quarter’s invitations and covers only those months. The estimate is withheld until the sample is extended to months added to the bill later.',
      'The 95% interval covers sampling variation only. It does not cover non-response bias, recall errors, how tasks are defined, or uncertainty in valuation settings, validated claims, and costs.',
      'Work under a registered study when the sample was drawn is left to the study. Later approved claims are removed from the Pulse population so value is not counted twice.',
    ],
  },
  {
    title: 'Calibration and valuation',
    items: [
      `Where a study measured time per task for work the Pulse also samples, measured ÷ reported time replaces the default ${Math.round(policy.defaultSelfReportCalibration * 100)}% self-report discount for that work type. The factor is bounded 0–100%, so self-reports are never inflated.`,
      'Calibration assumes the study cohort resembles the wider population for that work type. It does not transfer to other work types.',
      `Saved time is valued at the CFO’s $${policy.contributionValuePerHour}/h contribution rate, reduced by the share of time reused productively (from survey answers when there are at least ${policy.minimumReuseAnswers}).`,
      policy.lossTreatment === 'Full rate'
        ? 'Slower tasks are charged at the full rate while gains are discounted. This is deliberately conservative and can turn net-positive hours into negative value.'
        : 'Slower tasks receive the same discounts as gains.',
    ],
  },
  {
    title: 'Studies, approvals, and decisions',
    items: [
      'Verdicts use Welch’s 95% interval on the summary statistics entered for each group, judged against the criterion registered before the study started. They do not replace a statistician’s review of the design.',
      'Evidence grades follow the policy’s cap for each study design; the evidence weights are governance discounts, not statistical confidence levels.',
      'Reviewer identities are self-declared. Records are not tamper-proof and there is no authentication or role-based access.',
      'Suggested decisions are rules applied to the evidence on screen. Executives record the actual decision and its reasoning.',
    ],
  },
  {
    title: 'Privacy',
    items: [
      'The survey collects the task’s product, team, and work type plus the answer. It never collects names, prompts, documents, or source code.',
      'Pseudonymous person keys exist only in the invitation service’s routing table. They are never joined to answers and never exported.',
      `Aggregate results are hidden for groups below ${policy.minimumReportingGroup} responses. This is for decisions about investments and processes, not individual performance.`,
      'Production use needs authentication, role-based access, audit logs, retention rules, and agreement with privacy teams and employee representatives.',
    ],
  },
]

export function LimitsDrawer({ policy, onClose, onReset }: { policy: Policy; onClose: () => void; onReset: () => void }) {
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="limits-title">
        <div className="modal-header">
          <div><p className="section-kicker">One place for the caveats</p><h2 id="limits-title">Assumptions & limits</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="drawer-body">
          {sections(policy).map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          ))}
          <button className="secondary-button" onClick={onReset}><RotateCcw size={15} /> Reset demo data</button>
        </div>
      </aside>
    </div>
  )
}

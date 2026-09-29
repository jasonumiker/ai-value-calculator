import { useMemo, useState } from 'react'
import { CalendarCheck, ShieldCheck, Shuffle, Sparkles } from 'lucide-react'
import { SurveyForm } from '../components/SurveyForm'
import { PageIntro } from '../components/ui'
import { errorMessage } from '../components/helpers'
import { formatCurrency, formatSignedPercent } from '../domain/format'
import { periodLabel, sessionDate } from '../domain/periods'
import { nextPendingInvitation } from '../domain/survey'
import { derivePeriod } from '../state/derive'
import type { PageContext } from './types'

export function InboxPage({ data, actions, view, notify, openPreview }: PageContext) {
  const invitation = nextPendingInvitation(data.invitations, data.frames)
  const [error, setError] = useState('')
  const [previousEstimate, setPreviousEstimate] = useState<number | null>(null)
  const projection = useMemo(
    () => (invitation && invitation.period !== view.period ? derivePeriod(data, invitation.period).projection : view.projection),
    [data, invitation, view],
  )
  const openFrames = new Set(data.frames.filter((frame) => frame.status === 'Open').map((frame) => frame.id))
  const pending = data.invitations.filter((candidate) => candidate.status === 'Pending' && openFrames.has(candidate.frameId)).length
  const policy = data.policy
  const change = previousEstimate === null || previousEstimate === 0 ? null : (projection.estimatedValue - previousEstimate) / Math.abs(previousEstimate)

  const respond = (action: () => void, message: string) => {
    try {
      setPreviousEstimate(projection.estimatedValue)
      action()
      setError('')
      notify(message)
    } catch (failure) {
      setError(errorMessage(failure, 'The answer could not be recorded.'))
    }
  }

  return (
    <div className="page-content inbox-page">
      <PageIntro kicker="Employee view" title="Your pulse inbox" text="Occasionally, a randomly chosen AI-assisted task comes back with one short question. Answer what you observed; finance does the valuation." />
      <div className="inbox-layout">
        <section className="panel invitation-card" aria-label="Pulse invitation">
          {invitation ? (
            <>
              <p className="section-kicker"><Shuffle size={12} /> Randomly selected task · {periodLabel(invitation.period)}</p>
              <h2>What effect, if any, did AI have on this task?</h2>
              <p className="invitation-context">On <strong>{sessionDate(invitation.period, invitation.week, invitation.day)}</strong> you used <strong>{invitation.product}</strong> for <strong>{invitation.workType.toLowerCase()}</strong> ({invitation.team}).</p>
              <p className="invitation-person">Demo: you are answering as pseudonymous employee <code>{data.routing[invitation.id] ?? 'unknown'}</code>. Only the invitation service holds that key; it is never stored with the answer.</p>
              <SurveyForm
                key={invitation.id}
                idPrefix="inbox"
                submitLabel="Send answer"
                error={error}
                secondary={{ label: 'Not this time', onClick: () => respond(() => actions.declineInvitation(invitation.id), 'Skipped. Declines count toward the response rate, never against you.') }}
                onSubmit={(answer) => respond(() => actions.answerInvitation(invitation.id, answer), 'Thanks. Answer recorded; showing the next randomly selected employee.')}
              />
            </>
          ) : (
            <div className="empty-state">
              <CalendarCheck size={28} />
              <h2>No open invitations</h2>
              <p>Every invitation in the open sample has been answered, declined, or expired. Finance can draw the next quarter’s sample from the Sampling engine.</p>
            </div>
          )}
        </section>
        <aside className="inbox-side">
          <section className="panel side-panel">
            <h3>Why you were asked</h3>
            <ul>
              <li>Tasks are chosen at random from AI usage, across teams, work types, and weeks.</li>
              <li>You’ll get at most one invitation every {policy.cadenceDays} days and {policy.maxInvitationsPerPersonPerQuarter} per quarter.</li>
              <li>Answering is optional and takes about 20 seconds.</li>
            </ul>
          </section>
          <section className="panel side-panel live-impact">
            <h3>What your answer feeds</h3>
            <p className="impact-figure">{projection.projectionEligible ? formatCurrency(projection.estimatedValue) : 'Not estimable yet'}</p>
            <p>Estimated value of everyday AI tasks in {periodLabel(projection.period)} from {projection.sampledResponseCount} random answers{projection.projectionEligible ? ` (95% interval ${formatCurrency(projection.valueInterval.low)} to ${formatCurrency(projection.valueInterval.high)})` : ''}.</p>
            {change !== null && <p className="impact-change">Your last answer moved the estimate {formatSignedPercent(change)}.</p>}
            <p className="impact-pending">{pending} invitation{pending === 1 ? '' : 's'} still open</p>
          </section>
          <section className="panel side-panel">
            <h3><ShieldCheck size={15} /> What is and isn’t collected</h3>
            <ul>
              <li>Collected: product, team, work type, time change, main effect, and optionally how saved time was used.</li>
              <li>Never collected: your name, prompts, documents, messages, or code.</li>
              <li>Results are only shown for groups of {policy.minimumReportingGroup} or more, and never used to rate individuals.</li>
            </ul>
          </section>
          <button className="secondary-button preview-button" onClick={openPreview}><Sparkles size={15} /> Try the survey without an invitation</button>
        </aside>
      </div>
    </div>
  )
}

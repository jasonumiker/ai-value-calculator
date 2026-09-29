import { pulseEffectOptions } from './pulse'
import { reuseCategories, type Invitation, type PeriodKey, type Product, type ResponseRecord, type ReuseCategory, type SamplingFrame } from './types'

export type SurveyAnswer = { hours: number; effect: string; reuse?: ReuseCategory; secondsToAnswer: number }

export const MAX_SURVEY_HOURS = 4

export function validateAnswer(answer: SurveyAnswer) {
  if (!Number.isFinite(answer.hours) || Math.abs(answer.hours) > MAX_SURVEY_HOURS) throw new Error(`Enter a time change between −${MAX_SURVEY_HOURS} and ${MAX_SURVEY_HOURS} hours.`)
  if (!(pulseEffectOptions as readonly string[]).includes(answer.effect)) throw new Error('Choose the main immediate effect.')
  if (answer.reuse && !reuseCategories.includes(answer.reuse)) throw new Error('Choose how the saved time was used, or leave it blank.')
}

export function todayLabel(date = new Date()) {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

/** Stores the answer against the invitation's stratum only; the person who answered is never recorded. */
export function answerInvitation(invitations: Invitation[], responses: ResponseRecord[], invitationId: string, answer: SurveyAnswer, date = todayLabel()) {
  validateAnswer(answer)
  const invitation = invitations.find((candidate) => candidate.id === invitationId)
  if (!invitation || invitation.status !== 'Pending') throw new Error('This invitation is no longer open.')
  const response: ResponseRecord = {
    id: `r-${invitation.id}`,
    period: invitation.period,
    product: invitation.product,
    team: invitation.team,
    workType: invitation.workType,
    hours: answer.hours,
    effect: answer.effect,
    reuse: answer.hours > 0 ? answer.reuse : undefined,
    date,
    source: 'Random invitation',
    frameId: invitation.frameId,
    invitationId: invitation.id,
    secondsToAnswer: Math.max(1, Math.round(answer.secondsToAnswer)),
  }
  return {
    invitations: invitations.map((candidate) => (candidate.id === invitationId ? { ...candidate, status: 'Responded' as const } : candidate)),
    responses: [response, ...responses],
  }
}

export function declineInvitation(invitations: Invitation[], invitationId: string) {
  const invitation = invitations.find((candidate) => candidate.id === invitationId)
  if (!invitation || invitation.status !== 'Pending') throw new Error('This invitation is no longer open.')
  return invitations.map((candidate) => (candidate.id === invitationId ? { ...candidate, status: 'Declined' as const } : candidate))
}

/** A self-selected preview answer: kept for discovery, never projected. */
export function previewResponse(input: SurveyAnswer & { period: PeriodKey; product: Product; team: string; workType: string }, date = todayLabel(), id = `preview-${Date.now()}`): ResponseRecord {
  validateAnswer(input)
  return {
    id,
    period: input.period,
    product: input.product,
    team: input.team,
    workType: input.workType,
    hours: input.hours,
    effect: input.effect,
    reuse: input.hours > 0 ? input.reuse : undefined,
    date,
    source: 'Preview',
    secondsToAnswer: Math.max(1, Math.round(input.secondsToAnswer)),
  }
}

export function nextPendingInvitation(invitations: Invitation[], frames: SamplingFrame[]) {
  const open = new Set(frames.filter((frame) => frame.status === 'Open').map((frame) => frame.id))
  return invitations
    .filter((invitation) => invitation.status === 'Pending' && open.has(invitation.frameId))
    .sort((first, second) => first.period.localeCompare(second.period) || first.week - second.week || first.day - second.day || first.id.localeCompare(second.id))[0]
}

export function closeFrame(frames: SamplingFrame[], invitations: Invitation[], frameId: string) {
  return {
    frames: frames.map((frame) => (frame.id === frameId ? { ...frame, status: 'Closed' as const } : frame)),
    invitations: invitations.map((invitation) => (invitation.frameId === frameId && invitation.status === 'Pending' ? { ...invitation, status: 'Expired' as const } : invitation)),
  }
}

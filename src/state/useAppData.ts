import { useMemo, useRef, useState } from 'react'
import { recordDecision } from '../domain/decisions'
import { nominateHypothesis, prioritiseHypothesis, type HypothesisInput } from '../domain/hypotheses'
import { periodLabel } from '../domain/periods'
import { policyLabel, publishPolicy } from '../domain/policy'
import { addProduct, registerProducts } from '../domain/products'
import { hashString } from '../domain/random'
import { drawSample, extendSample, priorInvitations, synthesizeSessions } from '../domain/sampling'
import { createDemoData } from '../domain/seed'
import { createStudyFromHypothesis, recordStudyEvidence, type StudyEvidenceInput } from '../domain/studies'
import { answerInvitation, closeFrame, declineInvitation, previewResponse, todayLabel, type SurveyAnswer } from '../domain/survey'
import type { AppData, ChangeCosts, DecisionRecord, HypothesisStatus, ImportRecord, PeriodKey, Policy, Product, ProductCategory, StudyRecord } from '../domain/types'
import { parseUsageRows, upsertUsage } from '../domain/usage'
import { registeredScopes } from './derive'
import { loadData, saveData } from './storage'

export function useAppData() {
  const [data, setData] = useState<AppData>(loadData)
  const latest = useRef(data)

  const actions = useMemo(() => {
    const commit = (next: AppData) => {
      latest.current = next
      setData(next)
      saveData(next)
      return next
    }
    const current = () => latest.current

    return {
      answerInvitation(invitationId: string, answer: SurveyAnswer) {
        const data = current()
        commit({ ...data, ...answerInvitation(data.invitations, data.responses, invitationId, answer) })
      },
      declineInvitation(invitationId: string) {
        const data = current()
        commit({ ...data, invitations: declineInvitation(data.invitations, invitationId) })
      },
      recordPreview(input: SurveyAnswer & { period: PeriodKey; product: Product; team: string; workType: string }) {
        const data = current()
        commit({ ...data, responses: [previewResponse(input), ...data.responses] })
      },
      nominate(input: HypothesisInput) {
        const data = current()
        const hypothesis = nominateHypothesis(data.hypotheses, input, undefined, undefined, data.studies)
        commit({ ...data, hypotheses: [hypothesis, ...data.hypotheses] })
        return hypothesis
      },
      prioritise(hypothesisId: number, status: Exclude<HypothesisStatus, 'Nominated'>, actor: string) {
        const data = current()
        commit({ ...data, hypotheses: data.hypotheses.map((hypothesis) => (hypothesis.id === hypothesisId ? prioritiseHypothesis(hypothesis, status, actor) : hypothesis)) })
      },
      startStudy(hypothesisId: number, period: PeriodKey) {
        const data = current()
        const existing = data.studies.find((study) => study.hypothesisId === hypothesisId)
        if (existing) return existing.id
        const hypothesis = data.hypotheses.find((candidate) => candidate.id === hypothesisId)
        if (!hypothesis || hypothesis.status !== 'Approved for testing') throw new Error('Only hypotheses approved for testing can start a study.')
        const study = createStudyFromHypothesis(hypothesis, undefined, period)
        commit({ ...data, studies: [study, ...data.studies] })
        return study.id
      },
      saveEvidence(studyId: string, input: StudyEvidenceInput) {
        const data = current()
        const study = data.studies.find((candidate) => candidate.id === studyId)
        if (!study) throw new Error('Study not found.')
        commit({ ...data, studies: data.studies.map((candidate) => (candidate.id === studyId ? recordStudyEvidence(study, input, data.policy) : candidate)) })
      },
      replaceStudy(study: StudyRecord) {
        const data = current()
        commit({ ...data, studies: data.studies.map((candidate) => (candidate.id === study.id ? study : candidate)) })
      },
      setChangeCosts(period: PeriodKey, costs: ChangeCosts) {
        const data = current()
        commit({ ...data, changeCosts: { ...data.changeCosts, [period]: costs } })
      },
      publishPolicy(draft: Policy, actor: string, reason: string) {
        const data = current()
        const { policy, change } = publishPolicy(data.policy, draft, actor, reason)
        commit({ ...data, policy, policyHistory: [change, ...data.policyHistory] })
        return policy
      },
      addProduct(input: { name: string; category: ProductCategory; workTypes: string }) {
        const data = current()
        commit({ ...data, products: addProduct(data.products, input) })
      },
      importUsage(fileName: string, rows: Record<string, string>[], fields: string[], parseErrors: number): ImportRecord {
        const data = current()
        const result = parseUsageRows(rows, fields, fileName, data.products)
        const base = { id: `import-${Date.now()}`, name: fileName, rows: rows.length, date: todayLabel(), periods: [] as PeriodKey[], totalCost: 0 }
        let record: ImportRecord
        if (result.identifier) {
          record = { ...base, status: 'Rejected', note: `Direct identifier "${result.identifier}" detected. Aggregate by team before importing.` }
        } else if (result.missing.length > 0) {
          record = { ...base, status: 'Rejected', note: `Missing required column${result.missing.length > 1 ? 's' : ''}: ${result.missing.join(', ')}.` }
        } else if (result.records.length === 0) {
          record = { ...base, status: 'Rejected', note: result.errors[0] ?? 'No usable rows found.' }
        } else {
          const periods = [...new Set(result.records.map((usage) => usage.period))].sort()
          const skipped = result.errors.length + parseErrors
          record = {
            ...base,
            status: 'Applied',
            periods,
            totalCost: result.records.reduce((sum, usage) => sum + usage.cost, 0),
            note: `${result.records.length} rows applied to ${periods.map(periodLabel).join(', ')}${skipped ? ` · ${skipped} rows skipped` : ''} · no direct identifiers`,
          }
          commit({
            ...data,
            usage: upsertUsage(data.usage, result.records),
            products: registerProducts(data.products, result.records.map((usage) => usage.product)),
            imports: [record, ...data.imports],
          })
          return record
        }
        commit({ ...data, imports: [record, ...data.imports] })
        return record
      },
      drawFrame(period: PeriodKey) {
        const data = current()
        if (data.frames.some((frame) => frame.period === period)) throw new Error(`${periodLabel(period)} already has a sample.`)
        const sessions = synthesizeSessions(data.usage, period, data.products)
        if (sessions.length === 0) throw new Error(`The bill for ${periodLabel(period)} has no task sessions to sample. Import usage with a task_sessions column first.`)
        const draw = drawSample(sessions, {
          period,
          policy: data.policy,
          policyVersion: policyLabel(data.policy),
          seed: hashString(`frame|${period}|${Date.now()}`),
          frameId: `frame-${period.toLowerCase()}`,
          createdAt: new Date().toISOString(),
          exclusions: registeredScopes(data, period),
          prior: priorInvitations(data.invitations, data.routing),
        })
        commit({ ...data, frames: [...data.frames, draw.frame], invitations: [...data.invitations, ...draw.invitations], routing: { ...data.routing, ...draw.routing } })
        return draw
      },
      extendFrame(period: PeriodKey) {
        const data = current()
        const frame = data.frames.find((candidate) => candidate.period === period)
        if (!frame) throw new Error(`${periodLabel(period)} has no sample to extend.`)
        const draw = extendSample(frame, synthesizeSessions(data.usage, period, data.products), data.invitations, data.routing, hashString(`extend|${period}|${Date.now()}`))
        commit({
          ...data,
          frames: data.frames.map((candidate) => (candidate.id === frame.id ? { ...draw.frame, status: 'Open' as const } : candidate)),
          invitations: [...data.invitations, ...draw.invitations],
          routing: { ...data.routing, ...draw.routing },
        })
        return draw
      },
      closeFrame(frameId: string) {
        const data = current()
        commit({ ...data, ...closeFrame(data.frames, data.invitations, frameId) })
      },
      recordDecision(input: Omit<DecisionRecord, 'id' | 'decidedAt'>) {
        const data = current()
        commit({ ...data, decisions: recordDecision(data.decisions, input) })
      },
      reset() {
        commit(createDemoData())
      },
    }
  }, [])

  return { data, actions }
}

export type AppActions = ReturnType<typeof useAppData>['actions']

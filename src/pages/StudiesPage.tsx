import { useState } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { StudyCard } from '../components/StudyCard'
import { PageIntro } from '../components/ui'
import type { PageContext } from './types'

export function StudiesPage({ data, persona, team, focus, navigate, openEvidence, openReview }: PageContext) {
  const [teamOnly, setTeamOnly] = useState(persona === 'manager')
  const studies = data.studies
    .filter((study) => (focus.studyId ? study.id === focus.studyId : !teamOnly || study.team === team))
    .sort((first, second) => second.progress - first.progress || first.name.localeCompare(second.name))
  return (
    <div className="page-content">
      <PageIntro
        kicker="Outcome studies"
        title="Test the AI way against the usual way"
        text="Record both groups, and the app judges the result against the criterion registered before the study began. Null and negative results count."
        action={focus.studyId ? <button className="secondary-button" onClick={() => navigate('studies')}><LayoutDashboard size={16} /> All studies</button> : undefined}
      />
      {!focus.studyId && <div className="filter-row"><label><input type="checkbox" checked={teamOnly} onChange={(event) => setTeamOnly(event.target.checked)} />Only {team}</label></div>}
      <section className={`study-grid ${focus.studyId ? 'focused-study' : ''}`}>
        {studies.map((study) => (
          <StudyCard
            key={study.id}
            study={study}
            hypothesis={data.hypotheses.find((hypothesis) => hypothesis.id === study.hypothesisId)}
            policy={data.policy}
            products={data.products}
            onViewHypothesis={(hypothesisId) => navigate('hypotheses', { hypothesisId })}
            onEdit={() => openEvidence(study.id)}
            onReview={() => openReview(study.id)}
          />
        ))}
        {studies.length === 0 && <p className="table-empty">No studies for this view yet. Start one from an approved hypothesis.</p>}
      </section>
    </div>
  )
}

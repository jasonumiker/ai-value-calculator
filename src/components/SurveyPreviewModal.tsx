import { useState } from 'react'
import { Info } from 'lucide-react'
import { workTypesFor } from '../domain/products'
import type { SurveyAnswer } from '../domain/survey'
import type { ProductDefinition } from '../domain/types'
import { SurveyForm } from './SurveyForm'
import { ModalShell } from './ui'
import { errorMessage } from './helpers'

export function SurveyPreviewModal({ products, teams, onClose, onSubmit }: {
  products: ProductDefinition[]
  teams: string[]
  onClose: () => void
  onSubmit: (answer: SurveyAnswer, context: { product: string; team: string; workType: string }) => void
}) {
  const [product, setProduct] = useState(products[0]?.name ?? '')
  const [error, setError] = useState('')
  return (
    <ModalShell eyebrow="Preview · not a random invitation" title="What effect, if any, did AI have on this task?" onClose={onClose}>
      <SurveyForm
        idPrefix="preview"
        submitLabel="Record preview"
        secondary={{ label: 'Skip', onClick: onClose }}
        error={error}
        onSubmit={(answer, form) => {
          try {
            onSubmit(answer, { product, team: String(form.get('team')), workType: String(form.get('workType')) })
          } catch (failure) {
            setError(errorMessage(failure, 'The preview could not be recorded.'))
          }
        }}
      >
        <div className="survey-context">
          <span>Context · normally prefilled from the invitation</span>
          <div className="form-row survey-context-fields">
            <label>Product<select name="product" value={product} onChange={(event) => setProduct(event.target.value)}>{products.map((option) => <option key={option.name}>{option.name}</option>)}</select></label>
            <label>Team<select name="team" defaultValue={teams[0]}>{teams.map((team) => <option key={team}>{team}</option>)}</select></label>
            <label>Work type<select name="workType" key={product}>{workTypesFor(products, product).map((type) => <option key={type}>{type}</option>)}</select></label>
          </div>
        </div>
        <div className="pulse-disclaimer"><Info size={15} /><span>Self-selected previews are kept as discovery signals only. Only answers to random invitations enter the Pulse estimate.</span></div>
      </SurveyForm>
    </ModalShell>
  )
}

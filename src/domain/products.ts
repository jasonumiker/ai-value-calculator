import type { Product, ProductCategory, ProductDefinition } from './types'

export const categoryWorkTypes: Record<ProductCategory, string[]> = {
  'Coding assistant': ['Code and tests', 'Code review', 'Debugging', 'Documentation', 'Incident analysis'],
  'Knowledge work': ['Research and synthesis', 'Document drafting', 'Customer communication', 'Data analysis', 'Meeting follow-up'],
  'Agent or other': ['Automated workflow', 'General task'],
}

export const productCategories = Object.keys(categoryWorkTypes) as ProductCategory[]

export const defaultProducts: ProductDefinition[] = [
  { name: 'GitHub Copilot', category: 'Coding assistant', workTypes: [...categoryWorkTypes['Coding assistant']] },
  { name: 'Copilot Cowork', category: 'Knowledge work', workTypes: [...categoryWorkTypes['Knowledge work']] },
]

export function guessCategory(name: string): ProductCategory {
  if (/github|code|cursor|developer/i.test(name)) return 'Coding assistant'
  if (/copilot|chat|cowork|365|gpt|claude|gemini/i.test(name)) return 'Knowledge work'
  return 'Agent or other'
}

export function canonicalProductName(products: ProductDefinition[], name: string) {
  const trimmed = name.trim()
  return products.find((product) => product.name.toLowerCase() === trimmed.toLowerCase())?.name ?? trimmed
}

/** Registers any product names that are not yet configured, using category defaults for work types. */
export function registerProducts(products: ProductDefinition[], names: Iterable<Product>) {
  const known = new Set(products.map((product) => product.name.toLowerCase()))
  const added: ProductDefinition[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name || known.has(name.toLowerCase())) continue
    known.add(name.toLowerCase())
    const category = guessCategory(name)
    added.push({ name, category, workTypes: [...categoryWorkTypes[category]] })
  }
  return added.length === 0 ? products : [...products, ...added]
}

export function addProduct(products: ProductDefinition[], input: { name: string; category: ProductCategory; workTypes: string }) {
  const name = input.name.trim()
  if (!name) throw new Error('Enter a product name.')
  if (products.some((product) => product.name.toLowerCase() === name.toLowerCase())) throw new Error(`${name} is already configured.`)
  const workTypes = [...new Set(input.workTypes.split(',').map((type) => type.trim()).filter(Boolean))]
  return [...products, { name, category: input.category, workTypes: workTypes.length > 0 ? workTypes : [...categoryWorkTypes[input.category]] }]
}

export function productDefinition(products: ProductDefinition[], product: Product): ProductDefinition {
  return products.find((candidate) => candidate.name === product)
    ?? { name: product, category: guessCategory(product), workTypes: [...categoryWorkTypes[guessCategory(product)]] }
}

export function workTypesFor(products: ProductDefinition[], product: Product) {
  return productDefinition(products, product).workTypes
}

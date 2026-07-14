import type { ProjectFingerprint } from '../types.js'
import { fetchCategorySkills, type CatalogEntry } from './fetcher.js'

const ALL_CATEGORIES = [
  'ai-agents',
  'mcp-servers',
  'cli-tools',
  'ide-extensions',
  'api-integration',
  'devops',
  'testing',
  'data-processing',
  'code-generation',
  'documentation',
] as const

export type Category = (typeof ALL_CATEGORIES)[number]

function relevantCategories(fp: ProjectFingerprint): Category[] {
  const cats = new Set<Category>(['ai-agents'])

  if (fp.frameworks.some(f => ['react', 'vue', 'svelte', 'nextjs', 'nuxt'].includes(f))) {
    cats.add('code-generation')
  }
  if (fp.testFrameworks.length > 0) cats.add('testing')
  if (fp.languages.includes('python')) cats.add('data-processing')
  if (fp.ciProvider) cats.add('devops')
  if (fp.packageManagers.includes('npm')) cats.add('cli-tools')
  if (fp.frameworks.some(f => ['fastapi', 'express', 'fastify'].includes(f))) {
    cats.add('api-integration')
  }
  cats.add('mcp-servers')

  return [...cats] as Category[]
}

export async function fetchCatalog(fp: ProjectFingerprint): Promise<CatalogEntry[]> {
  const categories = relevantCategories(fp)

  const results = await Promise.all(
    categories.map(cat => fetchCategorySkills(cat, 2))
  )

  const seen = new Set<string>()
  const all: CatalogEntry[] = []
  for (const batch of results) {
    for (const entry of batch) {
      if (!seen.has(entry.slug)) {
        seen.add(entry.slug)
        all.push(entry)
      }
    }
  }

  return all
}

import type { ProjectFingerprint } from '../types.js'
import { fetchCategorySkills, type CatalogEntry } from './fetcher.js'

// mcp-servers excluded — MCP servers require config-file setup, not SKILL.md install
const SKILL_CATEGORIES = [
  'ai-agents',
  'cli-tools',
  'ide-extensions',
  'api-integration',
  'devops',
  'testing',
  'data-processing',
  'code-generation',
  'documentation',
] as const

export type Category = (typeof SKILL_CATEGORIES)[number]

// Slugs that are AI platforms/tools themselves, not installable skills
const PLATFORM_SLUGS = new Set([
  'claude-code', 'anthropics-claude-code', 'claude', 'claude-cli',
  'codex', 'codex-cli', 'openai-codex',
  'gemini-cli', 'gemini', 'google-gemini',
  'cursor', 'github-copilot', 'copilot',
  'opencode', 'antigravity', 'kimi-code', 'pi',
  'github-mcp-server', 'codebase-memory-mcp', 'n8n-mcp', 'n8n',
])

function relevantCategories(fp: ProjectFingerprint): Category[] {
  const cats = new Set<Category>(['ai-agents'])

  if (fp.testFrameworks.length > 0) cats.add('testing')
  if (fp.ciProvider) cats.add('devops')
  if (fp.packageManagers.includes('npm')) cats.add('cli-tools')
  if (fp.languages.includes('python')) cats.add('data-processing')
  if (fp.frameworks.some(f => ['fastapi', 'express', 'fastify'].includes(f))) {
    cats.add('api-integration')
  }
  if (fp.frameworks.some(f => ['react', 'vue', 'svelte', 'nextjs', 'nuxt'].includes(f))) {
    cats.add('code-generation')
  }

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
      if (!seen.has(entry.slug) && !PLATFORM_SLUGS.has(entry.slug)) {
        seen.add(entry.slug)
        all.push(entry)
      }
    }
  }

  return all
}

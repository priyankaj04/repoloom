import Anthropic from '@anthropic-ai/sdk'
import type { ProjectFingerprint, RankedSkill } from '../types.js'
import type { CatalogEntry } from '../catalog/fetcher.js'
import { fetchCatalog } from '../catalog/index.js'

export async function rankSkills(fingerprint: ProjectFingerprint): Promise<RankedSkill[]> {
  const available = await fetchCatalog(fingerprint)
  if (available.length === 0) return []

  const candidates = available.filter(
    s => !fingerprint.installedSkills.includes(s.slug)
  )
  if (candidates.length === 0) return []

  if (!process.env.ANTHROPIC_API_KEY) {
    return tagBasedRanking(fingerprint, candidates)
  }

  return claudeRanking(fingerprint, candidates)
}

async function claudeRanking(
  fingerprint: ProjectFingerprint,
  candidates: CatalogEntry[]
): Promise<RankedSkill[]> {
  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a developer tool recommending AI agent skills and plugins for software projects.

Project fingerprint:
${JSON.stringify(fingerprint, null, 2)}

Available skills (from skillsllm.com):
${JSON.stringify(
  candidates.slice(0, 100).map(c => ({
    slug: c.slug,
    name: c.name,
    description: c.description,
    tags: c.tags,
    category: c.category,
    stars: c.stars,
  })),
  null,
  2
)}

Return a JSON array of the top 10 most relevant skills for this project, most relevant first.
Each item: { "slug": string, "rank": number, "explanation": string (one sentence why it fits this project) }
Only include skills from the available list. Return only valid JSON, no markdown fences.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  let rankings: Array<{ slug: string; rank: number; explanation: string }> = []
  try {
    rankings = JSON.parse(text) as typeof rankings
  } catch {
    return []
  }

  return rankings
    .map(r => {
      const entry = candidates.find(c => c.slug === r.slug)
      if (!entry) return null
      return { ...entry, rank: r.rank, explanation: r.explanation }
    })
    .filter((r): r is RankedSkill => r !== null)
}

function tagBasedRanking(
  fingerprint: ProjectFingerprint,
  candidates: CatalogEntry[]
): RankedSkill[] {
  const projectTags = new Set([
    ...fingerprint.languages,
    ...fingerprint.frameworks,
    ...fingerprint.testFrameworks,
    ...(fingerprint.ciProvider ? [fingerprint.ciProvider] : []),
  ])

  return candidates
    .map(c => {
      const matched = c.tags.filter(t => projectTags.has(t))
      const score = matched.length + (c.stars > 1000 ? 1 : 0)
      return { ...c, score, explanation: matched.length > 0 ? `Matches: ${matched.join(', ')}` : 'Popular in category' }
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((c, i) => ({ ...c, rank: i + 1 }))
}

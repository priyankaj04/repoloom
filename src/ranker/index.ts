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
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are brutally honest at rating AI agent skills for software projects. No fluff.

Project fingerprint:
${JSON.stringify(fingerprint, null, 2)}

Available skills from skillsllm.com (sorted by stars descending):
${JSON.stringify(
  [...candidates]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 80)
    .map(c => ({
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

Pick the top 10 most useful skills for this specific project. Hard rules:
- EXCLUDE anything that is an AI platform/tool itself (claude-code, codex, gemini-cli, cursor, copilot, n8n, etc.) — those are platforms, not skills.
- EXCLUDE MCP servers — they require config-file setup, not skill install.
- EXCLUDE anything where installation means "run this CLI tool" rather than providing AI instructions.
- ONLY include actual skill/plugin repos that contain SKILL.md or .claude-plugin and provide AI coding instructions.
- If a skill is vague, generic, or just wraps a CLI tool, score it low.
- High stars ≠ high quality. Judge on fit and actual utility for THIS project.
- Prefer skills with real patterns, checklists, domain expertise the LLM can directly use.
- Security, testing, and stack-specific skills are almost always high value.

Return a JSON array. Each item:
{
  "slug": string,
  "rank": number,
  "explanation": string (one brutal sentence on WHY this fits — no filler),
  "relevance": number 1-10 (how much the project stack needs this),
  "usefulness": number 1-10 (actual day-to-day value — most skills are 4-6, exceptional ones are 8+),
  "quality": number 1-10 (packaging and content quality based on description — be harsh)
}

Return only valid JSON array, no markdown fences.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  let rankings: Array<{
    slug: string
    rank: number
    explanation: string
    relevance: number
    usefulness: number
    quality: number
  }> = []
  try {
    rankings = JSON.parse(text) as typeof rankings
  } catch {
    return []
  }

  return rankings
    .map(r => {
      const entry = candidates.find(c => c.slug === r.slug)
      if (!entry) return null
      const overall = Math.round((r.relevance * 0.4 + r.usefulness * 0.4 + r.quality * 0.2) * 10) / 10
      return {
        ...entry,
        rank: r.rank,
        explanation: r.explanation,
        relevance: r.relevance,
        usefulness: r.usefulness,
        quality: r.quality,
        overall,
      }
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
      const tagHits = c.tags.filter(t => projectTags.has(t)).length
      const starScore = c.stars >= 50000 ? 4 : c.stars >= 10000 ? 3 : c.stars >= 1000 ? 2 : 1
      const relevance = Math.min(tagHits * 2 + 2, 10)
      const usefulness = Math.min(starScore + tagHits, 8)
      const quality = starScore
      const overall = Math.round((relevance * 0.4 + usefulness * 0.4 + quality * 0.2) * 10) / 10
      return {
        ...c,
        score: tagHits + starScore,
        explanation: tagHits > 0 ? `Matches: ${c.tags.filter(t => projectTags.has(t)).join(', ')}` : 'Popular in category',
        relevance,
        usefulness,
        quality,
        overall,
      }
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((c, i) => ({ ...c, rank: i + 1 }))
}

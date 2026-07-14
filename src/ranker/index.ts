import Anthropic from '@anthropic-ai/sdk'
import type { ProjectFingerprint, RankedSkill } from '../types.js'
import type { CatalogEntry } from '../catalog/fetcher.js'
import { fetchCatalog } from '../catalog/index.js'

const INCREMENTAL_VALUE_THRESHOLD = 5

export interface RankResult {
  skills: RankedSkill[]
  wellCovered: boolean
  coverageSummary: string
}

export async function rankSkills(fingerprint: ProjectFingerprint): Promise<RankResult> {
  const available = await fetchCatalog(fingerprint)
  if (available.length === 0) {
    return { skills: [], wellCovered: false, coverageSummary: 'No skills found in catalog.' }
  }

  const candidates = available.filter(
    s => !fingerprint.installedSkills.includes(s.slug)
  )

  if (candidates.length === 0) {
    return { skills: [], wellCovered: true, coverageSummary: 'All catalog skills already installed.' }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    const skills = tagBasedRanking(fingerprint, candidates)
    return {
      skills,
      wellCovered: skills.length === 0,
      coverageSummary: 'Tag-based matching (set ANTHROPIC_API_KEY for smarter analysis)',
    }
  }

  return claudeRanking(fingerprint, candidates)
}

async function claudeRanking(
  fingerprint: ProjectFingerprint,
  candidates: CatalogEntry[]
): Promise<RankResult> {
  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a brutal, no-nonsense senior engineer evaluating AI agent skills for a software project.

Project fingerprint:
${JSON.stringify(fingerprint, null, 2)}

Already installed skills (EXCLUDE from recommendations — do NOT repeat these):
${fingerprint.installedSkills.length > 0 ? fingerprint.installedSkills.join(', ') : 'none'}

Available candidate skills NOT yet installed:
${JSON.stringify(
  [...candidates]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 100)
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

TASK: Think about what a complete, production-ready skill set looks like for this specific project.
Consider ALL dimensions:
- Code quality & review patterns
- Testing strategy (unit, integration, E2E, security)
- Security & hardening
- Performance optimization
- CI/CD & deployment
- Observability & debugging
- Architecture & API design
- Frontend patterns (if applicable)
- Backend patterns (if applicable)
- Git workflow & versioning
- Documentation

Then look at what's already installed and find EVERY candidate skill that fills a real gap.
Return ALL skills worth having — not just the top 1. A project typically needs 8-15 skills total.

Hard rules:
- EXCLUDE AI platforms/tools (claude-code, codex, gemini-cli, cursor, copilot, n8n)
- EXCLUDE MCP servers (config-file setup, not SKILL.md)
- EXCLUDE pure CLI tool wrappers
- ONLY skills providing AI coding instructions (SKILL.md / .claude-plugin)
- Penalize skills that heavily overlap with already-installed ones
- Be honest: skill bundles (like agent-skills with 20+ sub-skills) count as covering many areas

Return a JSON object:
{
  "coverage_summary": string (2-3 sentences: what's covered, what's missing),
  "well_covered": boolean (true only if installed skills genuinely cover all major areas),
  "recommendations": [
    {
      "slug": string,
      "rank": number (1 = most important gap to fill),
      "explanation": string (one sentence: what specific gap does this fill?),
      "relevance": number 1-10,
      "usefulness": number 1-10,
      "quality": number 1-10,
      "incremental_value": number 1-10 (value added beyond installed skills — be realistic, not stingy)
    }
  ]
}

Return only valid JSON, no markdown fences.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '{}'
  let parsed: {
    coverage_summary: string
    well_covered: boolean
    recommendations: Array<{
      slug: string
      rank: number
      explanation: string
      relevance: number
      usefulness: number
      quality: number
      incremental_value: number
    }>
  }

  try {
    parsed = JSON.parse(text) as typeof parsed
  } catch {
    return { skills: [], wellCovered: false, coverageSummary: 'Failed to parse Claude response.' }
  }

  const skills = (parsed.recommendations ?? [])
    .filter(r => r.incremental_value >= INCREMENTAL_VALUE_THRESHOLD)
    .map(r => {
      const entry = candidates.find(c => c.slug === r.slug)
      if (!entry) return null
      const overall = Math.round(
        (r.relevance * 0.3 + r.usefulness * 0.3 + r.quality * 0.1 + r.incremental_value * 0.3) * 10
      ) / 10
      return {
        ...entry,
        rank: r.rank,
        explanation: r.explanation,
        relevance: r.relevance,
        usefulness: r.usefulness,
        quality: r.quality,
        overall,
        incrementalValue: r.incremental_value,
      }
    })
    .filter((r): r is RankedSkill => r !== null)
    .sort((a, b) => b.incrementalValue - a.incrementalValue || b.overall - a.overall)

  return {
    skills,
    wellCovered: parsed.well_covered ?? false,
    coverageSummary: parsed.coverage_summary ?? '',
  }
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
      const incrementalValue = tagHits > 0 ? Math.min(tagHits * 3 + starScore, 10) : 2
      const overall = Math.round(
        (relevance * 0.3 + usefulness * 0.3 + quality * 0.1 + incrementalValue * 0.3) * 10
      ) / 10
      return {
        ...c,
        score: tagHits + starScore,
        explanation: tagHits > 0 ? `Matches: ${c.tags.filter(t => projectTags.has(t)).join(', ')}` : 'Popular in category',
        relevance,
        usefulness,
        quality,
        overall,
        incrementalValue,
      }
    })
    .filter(c => c.score > 0 && c.incrementalValue >= INCREMENTAL_VALUE_THRESHOLD)
    .sort((a, b) => b.incrementalValue - a.incrementalValue)
    .map((c, i) => ({ ...c, rank: i + 1 }))
}

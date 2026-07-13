import Anthropic from '@anthropic-ai/sdk'
import type { ProjectFingerprint, RankedSkill, SkillPackage } from '../types.js'
import { searchSkillPackages } from './npm.js'
import { getCacheKey, readCache, writeCache } from './cache.js'

export async function rankSkills(fingerprint: ProjectFingerprint): Promise<RankedSkill[]> {
  const key = getCacheKey(fingerprint)
  const cached = readCache(key)
  if (cached) return cached

  const available = await searchSkillPackages()
  if (available.length === 0) return []

  const candidates = available.filter(
    s => !fingerprint.installedSkills.includes(s.packageName)
  )
  if (candidates.length === 0) return []

  if (!process.env.ANTHROPIC_API_KEY) {
    return tagBasedRanking(fingerprint, candidates)
  }

  const ranked = await claudeRanking(fingerprint, candidates)
  writeCache(key, ranked)
  return ranked
}

async function claudeRanking(
  fingerprint: ProjectFingerprint,
  candidates: SkillPackage[]
): Promise<RankedSkill[]> {
  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a developer tool recommending Claude Code skills for software projects.

Project fingerprint:
${JSON.stringify(fingerprint, null, 2)}

Available skills:
${JSON.stringify(candidates.map(c => ({ packageName: c.packageName, manifest: c.manifest })), null, 2)}

Return a JSON array of the top 5 most relevant skills, most relevant first.
Each item: { "packageName": string, "rank": number, "explanation": string (one sentence) }
Only include skills from the available list. Return only valid JSON, no markdown fences.`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]'
  const rankings = JSON.parse(text) as Array<{
    packageName: string
    rank: number
    explanation: string
  }>

  return rankings
    .map(r => {
      const pkg = candidates.find(c => c.packageName === r.packageName)
      if (!pkg) return null
      return { ...pkg, rank: r.rank, explanation: r.explanation }
    })
    .filter((r): r is RankedSkill => r !== null)
}

function tagBasedRanking(
  fingerprint: ProjectFingerprint,
  candidates: SkillPackage[]
): RankedSkill[] {
  const projectTags = new Set([
    ...fingerprint.languages,
    ...fingerprint.frameworks,
    ...fingerprint.testFrameworks,
    ...(fingerprint.ciProvider ? [fingerprint.ciProvider] : []),
  ])

  return candidates
    .map(c => {
      const matched = c.manifest.tags.filter(t => projectTags.has(t))
      return { ...c, score: matched.length, explanation: `Matches your stack: ${matched.join(', ')}` }
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((c, i) => ({ ...c, rank: i + 1 }))
}

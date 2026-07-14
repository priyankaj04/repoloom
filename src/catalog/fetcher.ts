import { parse } from 'node-html-parser'

const BASE = 'https://skillsllm.com'

export type Platform =
  | 'claude-code'
  | 'codex-cli'
  | 'cursor'
  | 'copilot'
  | 'gemini-cli'
  | 'antigravity'
  | 'kimi-code'
  | 'opencode'
  | 'pi'
  | 'chatgpt'
  | 'npm'
  | 'git'

export interface CatalogEntry {
  name: string
  slug: string
  description: string
  tags: string[]
  stars: number
  language: string
  githubUrl: string
  category: string
}

export interface SkillDetail extends CatalogEntry {
  installCommands: Partial<Record<Platform, string>>
}

const PLATFORM_KEYWORDS: Record<Platform, string[]> = {
  'claude-code': ['claude code', 'claude-code'],
  'codex-cli': ['codex'],
  'cursor': ['cursor'],
  'copilot': ['copilot', 'github copilot'],
  'gemini-cli': ['gemini'],
  'antigravity': ['antigravity'],
  'kimi-code': ['kimi'],
  'opencode': ['opencode'],
  'pi': ['pi.dev', ' pi '],
  'chatgpt': ['chatgpt'],
  'npm': ['npm install', 'npm i '],
  'git': ['git clone'],
}

export async function fetchCategorySkills(
  category: string,
  maxPages = 3
): Promise<CatalogEntry[]> {
  const skills: CatalogEntry[] = []
  const seen = new Set<string>()

  for (let page = 1; page <= maxPages; page++) {
    const url = `${BASE}/category/${category}?page=${page}`
    let html: string
    try {
      const res = await fetch(url)
      if (!res.ok) break
      html = await res.text()
    } catch {
      break
    }

    const entries = parseListingPage(html, category)
    if (entries.length === 0) break

    for (const e of entries) {
      if (!seen.has(e.slug)) {
        seen.add(e.slug)
        skills.push(e)
      }
    }
  }

  return skills
}

export async function fetchSkillDetail(entry: CatalogEntry): Promise<SkillDetail> {
  const url = `${BASE}/skill/${entry.slug}`
  try {
    const res = await fetch(url)
    if (!res.ok) return { ...entry, installCommands: {} }
    const html = await res.text()
    const installCommands = parseInstallCommands(html)
    return { ...entry, installCommands }
  } catch {
    return { ...entry, installCommands: {} }
  }
}

function parseListingPage(html: string, category: string): CatalogEntry[] {
  const root = parse(html)
  const entries: CatalogEntry[] = []

  // Skill links are anchors pointing to /skill/{slug}
  const skillLinks = root.querySelectorAll('a[href^="/skill/"]')
  const seen = new Set<string>()

  for (const link of skillLinks) {
    const href = link.getAttribute('href') ?? ''
    const slug = href.replace('/skill/', '').split('?')[0].trim()
    if (!slug || seen.has(slug)) continue
    seen.add(slug)

    // Walk up to find the card container
    const card = link.closest('[class*="card"]') ?? link.parentNode ?? link

    const name = link.textContent.trim() || slug
    const description = extractDescription(card.toString())
    const tags = extractTags(card.toString())
    const stars = extractStars(card.toString())
    const language = extractLanguage(card.toString())
    const githubUrl = extractGithubUrl(card.toString()) ?? `https://github.com/search?q=${slug}`

    entries.push({ name, slug, description, tags, stars, language, githubUrl, category })
  }

  return entries
}

function parseInstallCommands(html: string): Partial<Record<Platform, string>> {
  const root = parse(html)
  const commands: Partial<Record<Platform, string>> = {}

  // Gather all code blocks
  const codeBlocks = root.querySelectorAll('code, pre')
  for (const block of codeBlocks) {
    const text = block.textContent.trim()
    if (!text) continue

    // Look at surrounding context (parent's text) to determine platform
    const context = (block.parentNode?.textContent ?? '').toLowerCase()

    for (const [platform, keywords] of Object.entries(PLATFORM_KEYWORDS) as [Platform, string[]][]) {
      if (commands[platform]) continue
      const matched = keywords.some(kw => context.includes(kw) || text.toLowerCase().includes(kw))
      if (matched && looksLikeInstallCommand(text)) {
        commands[platform] = text
      }
    }
  }

  // Also scan raw text for inline patterns like "Claude Code: /plugin install ..."
  const bodyText = root.textContent
  const inlinePatterns: Array<[Platform, RegExp]> = [
    ['claude-code', /(?:claude code[:\s]+)(`[^`]+`|\/plugin install [^\n]+)/i],
    ['npm', /(npm install [^\n]+)/i],
    ['git', /(git clone https?:\/\/[^\n]+)/i],
  ]
  for (const [platform, pattern] of inlinePatterns) {
    if (commands[platform]) continue
    const m = bodyText.match(pattern)
    if (m) commands[platform] = m[1].replace(/`/g, '').trim()
  }

  return commands
}

function looksLikeInstallCommand(text: string): boolean {
  return /^(\/plugin|npm |npx |git clone|pip |cargo |brew |curl |wget )/.test(text)
}

function extractDescription(html: string): string {
  const root = parse(html)
  const p = root.querySelector('p')
  return p?.textContent.trim().slice(0, 200) ?? ''
}

function extractTags(html: string): string[] {
  const root = parse(html)
  const tagEls = root.querySelectorAll('[class*="tag"], [class*="badge"], [class*="label"]')
  return tagEls
    .map(el => el.textContent.trim().toLowerCase())
    .filter(t => t.length > 0 && t.length < 30)
}

function extractStars(html: string): number {
  const m = html.match(/(\d[\d,]+)\s*(?:stars?|⭐)/i)
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0
}

function extractLanguage(html: string): string {
  const root = parse(html)
  const langEl = root.querySelector('[class*="lang"], [class*="language"]')
  return langEl?.textContent.trim() ?? ''
}

function extractGithubUrl(html: string): string | null {
  const m = html.match(/https:\/\/github\.com\/[\w./-]+/)
  return m ? m[0].replace(/["'>].*/, '') : null
}

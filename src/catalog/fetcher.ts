import { parse } from 'node-html-parser'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

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
  primaryGitRepo: string | null
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
    if (!res.ok) return { ...entry, installCommands: {}, primaryGitRepo: entry.githubUrl || null }
    const html = await res.text()
    const installCommands = parseInstallCommands(html)
    const primaryGitRepo = extractPrimaryGitRepo(html) ?? entry.githubUrl ?? null
    return { ...entry, installCommands, primaryGitRepo }
  } catch {
    return { ...entry, installCommands: {}, primaryGitRepo: entry.githubUrl || null }
  }
}

// Auto-install a skill from its GitHub repo into .claude/skills/{slug}/
export function installSkillFromGit(
  githubUrl: string,
  slug: string,
  targetDir: string
): 'installed' | 'no-skill-file' | 'git-failed' {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repoloom-'))
  try {
    execFileSync('git', ['clone', '--depth', '1', githubUrl, tmp], {
      stdio: 'pipe',
      timeout: 30000,
    })

    // Search for SKILL.md / skill.md in common locations
    const skillDir = findSkillDir(tmp, slug)
    if (!skillDir) return 'no-skill-file'

    fs.mkdirSync(targetDir, { recursive: true })
    // Copy all files from the skill directory
    for (const file of fs.readdirSync(skillDir, { withFileTypes: true })) {
      if (file.isFile()) {
        fs.copyFileSync(
          path.join(skillDir, file.name),
          path.join(targetDir, file.name)
        )
      }
    }
    return 'installed'
  } catch {
    return 'git-failed'
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

function findSkillDir(repoRoot: string, slug: string): string | null {
  // 1. Root level SKILL.md / skill.md
  const rootFiles = fs.readdirSync(repoRoot)
  if (rootFiles.some(f => f.toLowerCase() === 'skill.md')) return repoRoot

  // 2. skills/{slug}/ subdirectory (plugin format)
  const skillsDir = path.join(repoRoot, 'skills')
  if (fs.existsSync(skillsDir)) {
    const subdirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
    for (const sub of subdirs) {
      const subPath = path.join(skillsDir, sub.name)
      const files = fs.readdirSync(subPath)
      if (files.some(f => f.toLowerCase() === 'skill.md')) return subPath
    }
  }

  // 3. .claude/skills/{slug}/ (nested plugin format)
  const claudeSkillsDir = path.join(repoRoot, '.claude', 'skills')
  if (fs.existsSync(claudeSkillsDir)) {
    const subdirs = fs.readdirSync(claudeSkillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
    for (const sub of subdirs) {
      const subPath = path.join(claudeSkillsDir, sub.name)
      const files = fs.readdirSync(subPath)
      if (files.some(f => f.toLowerCase() === 'skill.md')) return subPath
    }
  }

  return null
}

function parseListingPage(html: string, category: string): CatalogEntry[] {
  const root = parse(html)
  const entries: CatalogEntry[] = []
  const seen = new Set<string>()

  const skillLinks = root.querySelectorAll('a[href^="/skill/"]')

  for (const link of skillLinks) {
    const href = link.getAttribute('href') ?? ''
    const slug = href.replace('/skill/', '').split('?')[0].trim()
    if (!slug || seen.has(slug)) continue
    seen.add(slug)

    const card = link.closest('[data-slot="card"]') ?? link.parentNode ?? link
    const cardHtml = card.toString()

    const name = link.textContent.trim() || slug
    const description = extractDescription(card)
    const tags = extractTags(card)
    const stars = extractStars(cardHtml)
    const language = extractLanguage(card)
    const githubUrl = extractGithubUrl(cardHtml) ?? ''

    entries.push({ name, slug, description, tags, stars, language, githubUrl, category })
  }

  return entries
}

function parseInstallCommands(html: string): Partial<Record<Platform, string>> {
  const root = parse(html)
  const commands: Partial<Record<Platform, string>> = {}

  // Strategy: find h2/h3 headings, then look at the next pre>code block
  // The heading text tells us the platform/option
  const headings = root.querySelectorAll('h1, h2, h3, h4')

  for (const heading of headings) {
    const headingText = heading.textContent.toLowerCase()

    // Find the next <pre><code> or <code> after this heading
    let sibling = heading.nextElementSibling
    let codeBlock: string | null = null

    // Walk forward up to 5 siblings to find a code block
    for (let i = 0; i < 5 && sibling; i++) {
      const pre = sibling.querySelector('pre') ?? sibling
      const code = pre.querySelector('code') ?? (sibling.tagName === 'CODE' ? sibling : null)
      if (code) {
        codeBlock = code.textContent.trim()
        break
      }
      sibling = sibling.nextElementSibling
    }

    if (!codeBlock || !looksLikeInstallCommand(codeBlock)) continue

    // Map heading to platform
    const platform = headingTextToPlatform(headingText)
    if (platform && !commands[platform]) {
      commands[platform] = codeBlock
    }
  }

  // Fallback: scan all code blocks for known patterns
  if (Object.keys(commands).length === 0) {
    const codeBlocks = root.querySelectorAll('pre code, code')
    for (const block of codeBlocks) {
      const text = block.textContent.trim()
      if (!looksLikeInstallCommand(text)) continue

      if (text.includes('/plugin install') && !commands['claude-code']) {
        commands['claude-code'] = text
      } else if (text.includes('npm install') && !commands['npm']) {
        commands['npm'] = text
      } else if (text.includes('git clone') && !commands['git']) {
        commands['git'] = text
      }
    }
  }

  return commands
}

function headingTextToPlatform(text: string): Platform | null {
  if (text.includes('claude code') || text.includes('claude-code') || text.includes('option 1') || text.includes('plugin installation')) return 'claude-code'
  if (text.includes('codex')) return 'codex-cli'
  if (text.includes('cursor')) return 'cursor'
  if (text.includes('copilot')) return 'copilot'
  if (text.includes('gemini')) return 'gemini-cli'
  if (text.includes('antigravity')) return 'antigravity'
  if (text.includes('kimi')) return 'kimi-code'
  if (text.includes('opencode')) return 'opencode'
  if (text.includes('npm')) return 'npm'
  if (text.includes('git') || text.includes('standalone') || text.includes('option 2') || text.includes('manual')) return 'git'
  return null
}

function looksLikeInstallCommand(text: string): boolean {
  return /^(\/plugin|npm |npx |git clone|pip |cargo |brew |curl |wget )/.test(text)
}

function extractPrimaryGitRepo(html: string): string | null {
  const root = parse(html)
  // Look for GitHub link in the page header area
  const links = root.querySelectorAll('a[href*="github.com"]')
  for (const link of links) {
    const href = link.getAttribute('href') ?? ''
    if (/https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(href)) {
      return href.replace(/[?#].*$/, '').replace(/\/$/, '')
    }
  }
  return null
}

function extractDescription(card: ReturnType<typeof parse>): string {
  const descEl = card.querySelector('[class*="description"], [class*="desc"]')
  if (descEl) return descEl.textContent.trim().slice(0, 200)
  const p = card.querySelector('p')
  return p?.textContent.trim().slice(0, 200) ?? ''
}

function extractTags(card: ReturnType<typeof parse>): string[] {
  const tagEls = card.querySelectorAll('[data-slot="badge"], [class*="tag"], [class*="badge"]')
  return tagEls
    .map(el => el.textContent.trim().toLowerCase())
    .filter(t => t.length > 0 && t.length < 30)
}

function extractStars(html: string): number {
  // HTML structure: lucide-star SVG (with long path data) followed by </svg><span>3,256</span>
  const m = html.match(/lucide-star[\s\S]{0,800}?<\/svg>\s*<span[^>]*>([\d,]+)<\/span>/)
  if (m) {
    const n = parseInt(m[1].replace(/,/g, ''), 10)
    return isNaN(n) ? 0 : n
  }
  return 0
}

function extractLanguage(card: ReturnType<typeof parse>): string {
  const langEl = card.querySelector('[class*="lang"], [class*="language"]')
  return langEl?.textContent.trim() ?? ''
}

function extractGithubUrl(html: string): string | null {
  // Prefer repo URLs (org/repo pattern) over profile URLs (just org)
  const repoMatch = html.match(/https:\/\/github\.com\/([\w.-]+\/[\w.-]+)/)
  if (repoMatch) return `https://github.com/${repoMatch[1]}`.replace(/\/$/, '')
  const orgMatch = html.match(/https:\/\/github\.com\/([\w.-]+)/)
  return orgMatch ? `https://github.com/${orgMatch[1]}` : null
}

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

export type SkillType = 'skill' | 'plugin' | 'mcp-server' | 'unknown'

export interface SkillDetail extends CatalogEntry {
  installCommands: Partial<Record<Platform, string>>
  primaryGitRepo: string | null
  type: SkillType
}

export interface InstallResult {
  slug: string
  status: 'installed' | 'multi-installed' | 'no-skill-file' | 'git-failed'
  type: SkillType
  installedPaths: string[]
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
  const fallback: SkillDetail = {
    ...entry,
    installCommands: {},
    primaryGitRepo: entry.githubUrl || null,
    type: entry.category === 'mcp-servers' ? 'mcp-server' : 'unknown',
  }
  try {
    const res = await fetch(url)
    if (!res.ok) return fallback
    const html = await res.text()
    const installCommands = parseInstallCommands(html)
    const primaryGitRepo = extractPrimaryGitRepo(html) ?? entry.githubUrl ?? null
    const type: SkillType = entry.category === 'mcp-servers' ? 'mcp-server'
      : html.includes('.claude-plugin') || html.includes('/plugin install') ? 'plugin'
      : html.includes('SKILL.md') || html.includes('skill.md') ? 'skill'
      : 'unknown'
    return { ...entry, installCommands, primaryGitRepo, type }
  } catch {
    return fallback
  }
}

export type KnownPlatform = 'claude-code' | 'cursor' | 'copilot' | 'codex-cli' | 'gemini-cli' | 'antigravity' | 'opencode' | 'kimi-code' | 'factory-droid' | 'pi' | 'unknown'

export function detectPlatform(): KnownPlatform {
  if (fs.existsSync(path.join(os.homedir(), '.claude'))) return 'claude-code'
  if (fs.existsSync(path.join(os.homedir(), '.cursor'))) return 'cursor'
  try { execFileSync('which', ['codex'], { stdio: 'pipe' }); return 'codex-cli' } catch { /* */ }
  try { execFileSync('which', ['gemini'], { stdio: 'pipe' }); return 'gemini-cli' } catch { /* */ }
  try { execFileSync('which', ['aider'], { stdio: 'pipe' }); return 'unknown' } catch { /* */ }
  return 'unknown'
}

// Returns the project-local skill directory for the given platform
export function platformSkillDir(projectDir: string, platform: KnownPlatform): string | null {
  switch (platform) {
    case 'claude-code':   return path.join(projectDir, '.claude', 'skills')
    case 'cursor':        return path.join(projectDir, '.cursor', 'rules')
    case 'copilot':       return null  // appends to .github/copilot-instructions.md
    case 'codex-cli':     return path.join(projectDir, '.codex', 'skills')
    default:              return null  // unknown — show manual command
  }
}

// Install a SKILL.md into the right location for a given platform
export function installSkillForPlatform(
  skillMdContent: string,
  skillName: string,
  projectDir: string,
  platform: KnownPlatform
): { ok: boolean; path: string; note?: string } {
  switch (platform) {
    case 'claude-code': {
      const dir = path.join(projectDir, '.claude', 'skills', skillName)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'SKILL.md'), skillMdContent)
      return { ok: true, path: `.claude/skills/${skillName}/SKILL.md` }
    }
    case 'cursor': {
      const dir = path.join(projectDir, '.cursor', 'rules')
      fs.mkdirSync(dir, { recursive: true })
      const file = path.join(dir, `${skillName}.md`)
      fs.writeFileSync(file, skillMdContent)
      return { ok: true, path: `.cursor/rules/${skillName}.md` }
    }
    case 'copilot': {
      const file = path.join(projectDir, '.github', 'copilot-instructions.md')
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
      const separator = `\n\n<!-- repoloom: ${skillName} -->\n`
      if (!existing.includes(`repoloom: ${skillName}`)) {
        fs.writeFileSync(file, existing + separator + skillMdContent)
      }
      return { ok: true, path: `.github/copilot-instructions.md` }
    }
    default:
      return { ok: false, path: '', note: `Platform ${platform} — manual install required` }
  }
}

// Install skill(s) from a GitHub repo. Handles multi-skill repos and plugin repos.
export function installSkillFromGit(
  githubUrl: string,
  slug: string,
  baseSkillsDir: string,
  platform: KnownPlatform = 'claude-code'
): InstallResult {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repoloom-'))
  try {
    execFileSync('git', ['clone', '--depth', '1', githubUrl, tmp], {
      stdio: 'pipe',
      timeout: 30000,
    })

    const type = detectRepoType(tmp)
    const skillDirs = findAllSkillDirs(tmp)

    if (skillDirs.length === 0) {
      return { slug, status: 'no-skill-file', type, installedPaths: [] }
    }

    const installedPaths: string[] = []

    if (platform === 'claude-code' || platform === 'codex-cli') {
      // Copy full skill directory
      for (const { name, dirPath } of skillDirs) {
        const targetDir = path.join(baseSkillsDir, name)
        fs.mkdirSync(targetDir, { recursive: true })
        for (const file of fs.readdirSync(dirPath, { withFileTypes: true })) {
          if (file.isFile()) {
            fs.copyFileSync(path.join(dirPath, file.name), path.join(targetDir, file.name))
          }
        }
        installedPaths.push(targetDir)
      }
    } else {
      // For other platforms: install SKILL.md content via platform-specific method
      const projectDir = path.dirname(path.dirname(baseSkillsDir)) // baseSkillsDir is project/.claude/skills
      for (const { name, dirPath } of skillDirs) {
        const skillMdPath = fs.readdirSync(dirPath).find(f => f.toLowerCase() === 'skill.md')
        if (!skillMdPath) continue
        const content = fs.readFileSync(path.join(dirPath, skillMdPath), 'utf8')
        const result = installSkillForPlatform(content, name, projectDir, platform)
        if (result.ok) installedPaths.push(result.path)
      }
    }

    return {
      slug,
      status: installedPaths.length > 1 ? 'multi-installed' : 'installed',
      type,
      installedPaths,
    }
  } catch {
    return { slug, status: 'git-failed', type: 'unknown', installedPaths: [] }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

function detectRepoType(repoRoot: string): SkillType {
  if (fs.existsSync(path.join(repoRoot, '.claude-plugin'))) return 'plugin'
  const allFiles = getAllFiles(repoRoot, 3)
  if (allFiles.some(f => path.basename(f).toLowerCase() === 'skill.md')) return 'skill'
  // Check tags/description via package.json or README mentions of MCP
  const pkgPath = path.join(repoRoot, 'package.json')
  if (fs.existsSync(pkgPath)) {
    const pkg = fs.readFileSync(pkgPath, 'utf8')
    if (pkg.includes('mcp') || pkg.includes('model-context-protocol')) return 'mcp-server'
  }
  return 'unknown'
}

function findAllSkillDirs(repoRoot: string): Array<{ name: string; dirPath: string }> {
  const found: Array<{ name: string; dirPath: string }> = []

  // 1. Root has SKILL.md → whole repo is one skill
  if (hasSkillMd(repoRoot)) {
    found.push({ name: path.basename(repoRoot), dirPath: repoRoot })
    return found
  }

  // 2. skills/ subdirectories (plugin format — may be a skill bundle)
  for (const searchDir of [
    path.join(repoRoot, 'skills'),
    path.join(repoRoot, '.claude', 'skills'),
  ]) {
    if (!fs.existsSync(searchDir)) continue
    for (const entry of fs.readdirSync(searchDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const subPath = path.join(searchDir, entry.name)
      if (hasSkillMd(subPath)) {
        found.push({ name: entry.name, dirPath: subPath })
      }
    }
  }

  return found
}

function hasSkillMd(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some(f => f.toLowerCase() === 'skill.md')
  } catch {
    return false
  }
}

function getAllFiles(dir: string, maxDepth: number): string[] {
  if (maxDepth <= 0) return []
  const result: string[] = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isFile()) result.push(full)
      else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        result.push(...getAllFiles(full, maxDepth - 1))
      }
    }
  } catch { /* */ }
  return result
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

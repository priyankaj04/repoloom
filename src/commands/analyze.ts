import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import ora from 'ora'
import prompts from 'prompts'
import { fingerprint } from '../fingerprinter/index.js'
import { rankSkills } from '../ranker/index.js'
import { fetchSkillDetail, installSkillFromGit, detectPlatform } from '../catalog/fetcher.js'
import type { RankedSkill, LockFile } from '../types.js'

const LOCK_FILE = 'repoloom.lock'

function writeLock(projectDir: string, slug: string, githubUrl: string): void {
  const lockPath = path.join(projectDir, LOCK_FILE)
  let lock: LockFile
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as LockFile
  } catch {
    lock = { version: 2, skills: {} }
  }
  lock.skills[slug] = githubUrl
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
}

const LOCAL_SKILLS_DIR = path.join('.claude', 'skills')
const GLOBAL_SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills')

function scoreBar(score: number): string {
  const filled = Math.round(score)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

function scoreLabel(score: number): string {
  if (score >= 8) return 'Excellent'
  if (score >= 6) return 'Good'
  if (score >= 4) return 'Decent'
  return 'Weak'
}

export async function analyzeCommand(): Promise<void> {
  const projectDir = process.cwd()
  const platform = detectPlatform()
  const spinner = ora('Analyzing project...').start()

  try {
    const fp = fingerprint(projectDir)

    const alreadyInstalled = fp.installedSkills
    if (alreadyInstalled.length > 0) {
      spinner.info(`Already installed (skipped): ${alreadyInstalled.join(', ')}`)
      spinner.start()
    }

    spinner.text = `Fetching skills from skillsllm.com (platform: ${platform})...`

    if (!process.env.ANTHROPIC_API_KEY) {
      spinner.warn('ANTHROPIC_API_KEY not set — using tag-based matching (no LLM ranking)')
      spinner.start(`Fetching skills from skillsllm.com (platform: ${platform})...`)
    }

    const result = await rankSkills(fp)
    spinner.stop()

    console.log(`\nPlatform: ${platform} | Project: ${fp.languages.join('+')} ${fp.frameworks.join('+') || ''}`)
    console.log(`Coverage: ${result.coverageSummary}\n`)

    if (result.wellCovered && result.skills.length === 0) {
      console.log('Your skill coverage is solid — no high-value additions found.')
      console.log(`Already installed: ${fp.installedSkills.length} skills`)
      return
    }

    if (result.skills.length === 0) {
      console.log('No skills found that add meaningful incremental value.')
      return
    }

    console.log(`${result.skills.length} skill(s) add real value (incremental ≥6/10):\n`)

    for (const s of result.skills) {
      const stars = s.stars > 0 ? `★${(s.stars / 1000).toFixed(1)}k` : '★?'
      console.log(`  ${s.rank}. ${s.name}  ${stars}  [${s.category}]`)
      console.log(`     ${s.explanation}`)
      console.log(`     Incremental: ${scoreBar(s.incrementalValue)} ${s.incrementalValue}/10  Overall: ${s.overall}/10`)
      console.log(`     R:${s.relevance} U:${s.usefulness} Q:${s.quality}`)
      console.log(`     ${s.githubUrl || `https://skillsllm.com/skill/${s.slug}`}\n`)
    }

    const ranked = result.skills
    const { selected } = await prompts({
      type: 'multiselect',
      name: 'selected',
      message: `Which skills to install? (→ ${LOCAL_SKILLS_DIR}/)`,
      choices: ranked.map(s => ({
        title: `${s.name}  +${s.incrementalValue}/10 incremental  ★${(s.stars / 1000).toFixed(1)}k`,
        value: s,
      })),
    })

    if (!selected?.length) {
      console.log('Nothing selected.')
      return
    }

    console.log('\nFetching install details...\n')
    const fetchSpinner = ora('').start()

    const details = await Promise.all(
      (selected as RankedSkill[]).map(async s => {
        fetchSpinner.text = `Fetching ${s.name}...`
        return fetchSkillDetail(s)
      })
    )
    fetchSpinner.stop()

    console.log('─'.repeat(60))

    let installedCount = 0
    let multiCount = 0

    for (const detail of details) {
      const installSpinner = ora(`Installing ${detail.name} [${detail.type}]...`).start()
      const targetBaseDir = path.join(projectDir, LOCAL_SKILLS_DIR)
      const targetDir = path.join(targetBaseDir, detail.slug)

      // Already installed
      if (fs.existsSync(targetDir)) {
        installSpinner.warn(`${detail.name} already at ${LOCAL_SKILLS_DIR}/${detail.slug}/`)
        continue
      }

      const gitRepo = detail.primaryGitRepo
      if (!gitRepo) {
        installSpinner.warn(`${detail.name}: no git repo found`)
        if (Object.keys(detail.installCommands).length > 0) {
          console.log(`\n  Manual install for ${detail.name}:`)
          for (const [p, cmd] of Object.entries(detail.installCommands)) {
            console.log(`    [${p}] ${cmd.split('\n')[0]}`)
          }
        }
        continue
      }

      const result = installSkillFromGit(gitRepo, detail.slug, targetBaseDir, platform)

      switch (result.status) {
        case 'installed': {
          installedCount++
          writeLock(projectDir, detail.slug, gitRepo)
          const dest = path.relative(projectDir, result.installedPaths[0])
          const typeTag = result.type === 'plugin' ? 'plugin → .claude/plugins/' : `skill → ${dest}/`
          installSpinner.succeed(`${detail.name} [${typeTag}]`)
          break
        }

        case 'multi-installed': {
          multiCount += result.installedPaths.length
          writeLock(projectDir, detail.slug, gitRepo)
          const names = result.installedPaths.map(p => path.basename(p)).join(', ')
          const typeTag = result.type === 'plugin' ? 'plugin' : 'bundle'
          installSpinner.succeed(
            `${detail.name} [${typeTag}: ${result.installedPaths.length}] → ${names}`
          )
          break
        }

        case 'no-skill-file':
          installSpinner.warn(`${detail.name}: no SKILL.md in repo`)
          if (detail.type === 'mcp-server') {
            console.log(`\n  MCP server — add to your claude config:`)
            console.log(`    https://skillsllm.com/skill/${detail.slug}`)
          } else if (Object.keys(detail.installCommands).length > 0) {
            const cmd = Object.values(detail.installCommands)[0]
            console.log(`\n  Run: ${cmd?.split('\n')[0]}`)
          }
          break

        case 'git-failed':
          installSpinner.fail(`${detail.name}: git clone failed — ${gitRepo}`)
          break
      }
    }

    console.log('─'.repeat(60))
    const total = installedCount + multiCount
    if (total > 0) {
      console.log(`\n${total} skill(s) installed to ${LOCAL_SKILLS_DIR}/`)
      console.log('Restart Claude Code to load the new skills.')
    }
  } catch (err) {
    spinner.fail('Failed')
    throw err
  }
}

import fs from 'node:fs'
import path from 'node:path'
import ora from 'ora'
import prompts from 'prompts'
import { fingerprint } from '../fingerprinter/index.js'
import { rankSkills } from '../ranker/index.js'
import { fetchSkillDetail, installSkillFromGit } from '../catalog/fetcher.js'
import type { RankedSkill } from '../types.js'

const LOCAL_SKILLS_DIR = path.join('.claude', 'skills')

const QUALITY_LABEL = (stars: number) => {
  if (stars >= 50000) return '⭐⭐⭐ Popular'
  if (stars >= 10000) return '⭐⭐  Established'
  if (stars >= 1000) return '⭐   Growing'
  return '     New'
}

export async function analyzeCommand(): Promise<void> {
  const projectDir = process.cwd()
  const spinner = ora('Analyzing project...').start()

  try {
    const fp = fingerprint(projectDir)
    spinner.text = 'Fetching skills from skillsllm.com...'

    if (!process.env.ANTHROPIC_API_KEY) {
      spinner.warn('ANTHROPIC_API_KEY not set — using tag-based matching (no LLM ranking)')
      spinner.start('Fetching skills from skillsllm.com...')
    }

    const ranked = await rankSkills(fp)
    spinner.stop()

    if (ranked.length === 0) {
      console.log('No matching skills found for this project.')
      return
    }

    console.log('\nRecommended skills:\n')
    for (const s of ranked) {
      const quality = QUALITY_LABEL(s.stars)
      const stars = s.stars > 0 ? `★${(s.stars / 1000).toFixed(1)}k` : ''
      console.log(`  ${s.rank}. ${s.name} ${stars}`)
      console.log(`     ${quality}  [${s.category}]`)
      console.log(`     ${s.explanation}`)
      console.log(`     ${s.githubUrl || s.slug}\n`)
    }

    const { selected } = await prompts({
      type: 'multiselect',
      name: 'selected',
      message: 'Which skills to install? (local — .claude/skills/)',
      choices: ranked.map(s => ({
        title: `${s.name} ${s.stars > 0 ? `★${(s.stars / 1000).toFixed(1)}k` : ''}`,
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

    const localSkillsDir = path.join(projectDir, LOCAL_SKILLS_DIR)
    console.log(`Installing to ${LOCAL_SKILLS_DIR}/\n`)
    console.log('─'.repeat(60))

    for (const detail of details) {
      const installSpinner = ora(`Installing ${detail.name}...`).start()
      const targetDir = path.join(localSkillsDir, detail.slug)

      // Skip if already installed
      if (fs.existsSync(targetDir)) {
        installSpinner.warn(`${detail.name} already installed at ${LOCAL_SKILLS_DIR}/${detail.slug}`)
        continue
      }

      const gitRepo = detail.primaryGitRepo
      if (gitRepo) {
        const result = installSkillFromGit(gitRepo, detail.slug, targetDir)

        if (result === 'installed') {
          installSpinner.succeed(`Installed ${detail.name} → ${LOCAL_SKILLS_DIR}/${detail.slug}/`)
          continue
        } else if (result === 'no-skill-file') {
          installSpinner.warn(`${detail.name}: no SKILL.md found in repo — showing manual commands`)
        } else {
          installSpinner.warn(`${detail.name}: git clone failed — showing manual commands`)
        }
      } else {
        installSpinner.stop()
      }

      // Fallback: print install commands
      const cmds = Object.entries(detail.installCommands)
      if (cmds.length > 0) {
        console.log(`\n  ${detail.name} — manual install:`)
        for (const [platform, cmd] of cmds) {
          console.log(`\n  ${platform}:`)
          // Only show first line of multi-line commands for brevity
          console.log(`    ${cmd.split('\n')[0]}`)
        }
        console.log(`\n  Full details: https://skillsllm.com/skill/${detail.slug}`)
      } else {
        console.log(`\n  ${detail.name}: https://skillsllm.com/skill/${detail.slug}`)
      }
    }

    console.log('\n' + '─'.repeat(60))

    const installedCount = details.filter(d =>
      fs.existsSync(path.join(localSkillsDir, d.slug))
    ).length

    if (installedCount > 0) {
      console.log(`\n${installedCount} skill(s) installed to ${LOCAL_SKILLS_DIR}/`)
      console.log('Restart Claude Code to pick up the new skills.')
    }
  } catch (err) {
    spinner.fail('Failed')
    throw err
  }
}

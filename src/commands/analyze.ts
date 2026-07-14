import ora from 'ora'
import prompts from 'prompts'
import { fingerprint } from '../fingerprinter/index.js'
import { rankSkills } from '../ranker/index.js'
import { fetchSkillDetail } from '../catalog/fetcher.js'
import type { RankedSkill } from '../types.js'

const PLATFORM_LABELS: Record<string, string> = {
  'claude-code': 'Claude Code',
  'codex-cli': 'Codex CLI',
  'cursor': 'Cursor',
  'copilot': 'GitHub Copilot',
  'gemini-cli': 'Gemini CLI',
  'antigravity': 'Antigravity',
  'kimi-code': 'Kimi Code',
  'opencode': 'OpenCode',
  'pi': 'Pi',
  'chatgpt': 'ChatGPT',
  'npm': 'npm',
  'git': 'GitHub (git clone)',
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
      console.log(`  ${s.rank}. ${s.name} (${s.slug})`)
      console.log(`     ${s.explanation}`)
      console.log(`     ${s.githubUrl}\n`)
    }

    const { selected } = await prompts({
      type: 'multiselect',
      name: 'selected',
      message: 'Which skills would you like to install?',
      choices: ranked.map(s => ({ title: `${s.name} ★${(s.stars / 1000).toFixed(1)}k`, value: s })),
    })

    if (!selected?.length) {
      console.log('Nothing selected.')
      return
    }

    console.log('\nFetching install instructions...\n')
    const detailSpinner = ora('').start()

    const details = await Promise.all(
      (selected as RankedSkill[]).map(s => {
        detailSpinner.text = `Fetching details for ${s.name}...`
        return fetchSkillDetail(s)
      })
    )
    detailSpinner.stop()

    console.log('─'.repeat(60))
    for (const detail of details) {
      console.log(`\n📦 ${detail.name}`)
      console.log(`   ${detail.description || detail.githubUrl}`)

      const cmds = Object.entries(detail.installCommands)
      if (cmds.length === 0) {
        console.log(`\n   No install commands found. Visit: ${detail.githubUrl}`)
      } else {
        console.log('\n   Install commands:')
        for (const [platform, cmd] of cmds) {
          const label = PLATFORM_LABELS[platform] ?? platform
          console.log(`\n   ${label}:`)
          console.log(`     ${cmd}`)
        }
      }
    }

    console.log('\n' + '─'.repeat(60))
    console.log('\nRun the commands above for your platform to install these skills.')
  } catch (err) {
    spinner.fail('Failed')
    throw err
  }
}

import fs from 'node:fs'
import path from 'node:path'
import ora from 'ora'
import prompts from 'prompts'
import { fingerprint } from '../fingerprinter/index.js'
import { rankSkills } from '../ranker/index.js'
import { install } from '../installer/index.js'
import type { InstallOptions } from '../types.js'

export async function analyzeCommand(opts: {
  local?: boolean
  global?: boolean
}): Promise<void> {
  const projectDir = process.cwd()
  const lockExists = fs.existsSync(path.join(projectDir, 'repoloom.lock'))
  const mode: InstallOptions['mode'] =
    opts.local ? 'local' : opts.global ? 'global' : lockExists ? 'local' : 'global'

  const spinner = ora('Analyzing project...').start()

  try {
    const fp = fingerprint(projectDir)
    spinner.text = 'Fetching and ranking skills...'

    if (!process.env.ANTHROPIC_API_KEY) {
      spinner.warn('ANTHROPIC_API_KEY not set — using tag-based matching (no LLM ranking)')
      spinner.start('Fetching and ranking skills...')
    }

    const ranked = await rankSkills(fp)
    spinner.stop()

    if (ranked.length === 0) {
      console.log('No matching skills found for this project.')
      return
    }

    console.log('\nRecommended skills:\n')
    for (const s of ranked) {
      console.log(`  ${s.rank}. ${s.packageName}\n     ${s.explanation}\n`)
    }

    const { selected } = await prompts({
      type: 'multiselect',
      name: 'selected',
      message: 'Which skills would you like to install?',
      choices: ranked.map(s => ({ title: s.packageName, value: s })),
    })

    if (!selected?.length) {
      console.log('Nothing installed.')
      return
    }

    for (const skill of selected as typeof ranked) {
      const s = ora(`Installing ${skill.packageName}...`).start()
      install(skill.packageName, skill.npmVersion, projectDir, { mode })
      s.succeed(`Installed ${skill.packageName}`)
    }

    if (mode === 'local') {
      console.log('\nrepoloom.lock updated. Commit it so teammates can run `npx repoloom sync`.')
    }
  } catch (err) {
    spinner.fail('Failed')
    throw err
  }
}

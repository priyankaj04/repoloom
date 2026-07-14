import fs from 'node:fs'
import path from 'node:path'
import ora from 'ora'
import { installSkillFromGit, detectPlatform, platformSkillDir } from '../catalog/fetcher.js'
import type { LockFile } from '../types.js'

const LOCK_FILE = 'repoloom.lock'

const PLATFORM_LABELS: Record<string, string> = {
  'claude-code':    'Claude Code  → .claude/skills/',
  'cursor':         'Cursor       → .cursor/rules/',
  'copilot':        'Copilot      → .github/copilot-instructions.md',
  'codex-cli':      'Codex CLI    → .codex/skills/',
  'gemini-cli':     'Gemini CLI   → (manual install)',
  'antigravity':    'Antigravity  → (manual install)',
  'opencode':       'OpenCode     → (manual install)',
  'kimi-code':      'Kimi Code    → (manual install)',
  'factory-droid':  'Factory Droid→ (manual install)',
  'pi':             'Pi           → (manual install)',
  'unknown':        'Unknown platform → (manual install)',
}

export async function syncCommand(): Promise<void> {
  const projectDir = process.cwd()
  const lockPath = path.join(projectDir, LOCK_FILE)
  const platform = detectPlatform()

  if (!fs.existsSync(lockPath)) {
    console.error('No repoloom.lock found. Run `repoloom analyze` first.')
    process.exit(1)
  }

  let lock: LockFile
  try {
    lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as LockFile
  } catch {
    console.error('repoloom.lock is malformed.')
    process.exit(1)
  }

  const entries = Object.entries(lock.skills)
  if (entries.length === 0) {
    console.log('repoloom.lock is empty — nothing to sync.')
    return
  }

  console.log(`Platform: ${PLATFORM_LABELS[platform] ?? platform}`)
  console.log(`Syncing ${entries.length} skill(s) from repoloom.lock...\n`)

  const baseDir = platformSkillDir(projectDir, platform) ?? path.join(projectDir, '.claude', 'skills')

  let ok = 0
  let skipped = 0
  let failed = 0
  const manual: string[] = []

  for (const [slug, githubUrl] of entries) {
    const targetDir = path.join(baseDir, slug)

    if (fs.existsSync(targetDir)) {
      console.log(`  ⏭  ${slug} (already installed)`)
      skipped++
      continue
    }

    const spinner = ora(`  Installing ${slug}...`).start()
    const result = installSkillFromGit(githubUrl, slug, baseDir, platform)

    if (result.status === 'installed' || result.status === 'multi-installed') {
      const dest = result.installedPaths[0] ?? slug
      spinner.succeed(`${slug} → ${path.relative(projectDir, dest)}`)
      ok++
    } else if (result.status === 'no-skill-file') {
      spinner.warn(`${slug}: no SKILL.md — visit https://skillsllm.com/skill/${slug}`)
      manual.push(slug)
      failed++
    } else {
      spinner.fail(`${slug}: git clone failed (${githubUrl})`)
      failed++
    }
  }

  console.log(`\nDone: ${ok} installed, ${skipped} skipped, ${failed} failed.`)
  if (manual.length > 0) {
    console.log(`\nManual install needed for: ${manual.join(', ')}`)
  }
  if (ok > 0) {
    const restartMsg: Record<string, string> = {
      'claude-code': 'Restart Claude Code to load the synced skills.',
      'cursor':      'Restart Cursor to load the synced rules.',
      'copilot':     'Commit .github/copilot-instructions.md — Copilot picks it up automatically.',
    }
    console.log(restartMsg[platform] ?? 'Restart your AI tool to load the synced skills.')
  }
}

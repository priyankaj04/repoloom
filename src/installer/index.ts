import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import type { InstallOptions, LockFile } from '../types.js'

const LOCAL_SKILLS_SUBDIR = path.join('.claude', 'skills')
const LOCK_FILE = 'repoloom.lock'

function globalPluginsDir(): string {
  return path.join(os.homedir(), '.claude', 'plugins')
}

function destDir(packageName: string, projectDir: string, mode: InstallOptions['mode']): string {
  return mode === 'global'
    ? path.join(globalPluginsDir(), packageName)
    : path.join(projectDir, LOCAL_SKILLS_SUBDIR, packageName)
}

export function install(
  packageName: string,
  version: string,
  projectDir: string,
  opts: InstallOptions
): void {
  const dest = destDir(packageName, projectDir, opts.mode)
  if (fs.existsSync(dest) && !opts.force) return

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'repoloom-'))
  try {
    execFileSync('npm', ['pack', `${packageName}@${version}`, '--pack-destination', tmp], { stdio: 'pipe' })
    const tarball = fs.readdirSync(tmp).find(f => f.endsWith('.tgz'))!
    execFileSync('tar', ['-xzf', path.join(tmp, tarball), '-C', tmp], { stdio: 'pipe' })

    fs.mkdirSync(dest, { recursive: true })
    for (const file of ['skill.md', 'skill.json']) {
      const src = path.join(tmp, 'package', file)
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, file))
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }

  if (opts.mode === 'local') updateLock(projectDir, packageName, version)
}

export function remove(
  packageName: string,
  projectDir: string,
  opts: InstallOptions
): void {
  const dest = destDir(packageName, projectDir, opts.mode)
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true })
  if (opts.mode === 'local') removeFromLock(projectDir, packageName)
}

export function sync(projectDir: string): void {
  const lock = readLock(projectDir)
  if (!lock) throw new Error('No repoloom.lock found. Run `npx repoloom analyze` first.')
  for (const [name, version] of Object.entries(lock.skills)) {
    install(name, version, projectDir, { mode: 'local', force: true })
  }
}

export function list(projectDir: string): { global: string[]; local: string[] } {
  const globalDir = globalPluginsDir()
  const localDir = path.join(projectDir, LOCAL_SKILLS_SUBDIR)

  return {
    global: fs.existsSync(globalDir)
      ? fs.readdirSync(globalDir).filter(d => d.startsWith('repoloom-skill-'))
      : [],
    local: fs.existsSync(localDir)
      ? fs.readdirSync(localDir).filter(d => d.startsWith('repoloom-skill-'))
      : [],
  }
}

function readLock(projectDir: string): LockFile | null {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(projectDir, LOCK_FILE), 'utf8')
    ) as LockFile
  } catch {
    return null
  }
}

function updateLock(projectDir: string, packageName: string, version: string): void {
  const lock = readLock(projectDir) ?? { version: 1 as const, skills: {} }
  lock.skills[packageName] = version
  fs.writeFileSync(path.join(projectDir, LOCK_FILE), JSON.stringify(lock, null, 2) + '\n')
}

function removeFromLock(projectDir: string, packageName: string): void {
  const lock = readLock(projectDir)
  if (!lock) return
  delete lock.skills[packageName]
  fs.writeFileSync(path.join(projectDir, LOCK_FILE), JSON.stringify(lock, null, 2) + '\n')
}

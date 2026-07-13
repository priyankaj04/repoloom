import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import * as childProcess from 'node:child_process'
import { install, remove, sync, list } from '../src/installer/index.js'

vi.mock('node:child_process')

describe('installer', () => {
  let tmpDir: string
  let tmpHome: string

  beforeEach(() => {
    vi.clearAllMocks()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repoloom-install-'))
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'repoloom-home-'))
    process.env.HOME = tmpHome

    vi.mocked(childProcess.execSync).mockImplementation((cmd: string) => {
      const cmdStr = cmd.toString()
      if (cmdStr.startsWith('npm pack')) {
        const destMatch = cmdStr.match(/--pack-destination (\S+)/)
        if (destMatch) {
          fs.writeFileSync(path.join(destMatch[1], 'repoloom-skill-test-1.0.0.tgz'), '')
        }
      } else if (cmdStr.startsWith('tar')) {
        const destMatch = cmdStr.match(/-C (\S+)/)
        if (destMatch) {
          const pkgDir = path.join(destMatch[1], 'package')
          fs.mkdirSync(pkgDir, { recursive: true })
          fs.writeFileSync(path.join(pkgDir, 'skill.md'), '# skill')
          fs.writeFileSync(path.join(pkgDir, 'skill.json'), '{}')
        }
      }
      return Buffer.from('')
    })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fs.rmSync(tmpHome, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('installs skill files to global plugins dir', () => {
    install('repoloom-skill-react', '1.0.0', tmpDir, { mode: 'global' })
    const dest = path.join(tmpHome, '.claude', 'plugins', 'repoloom-skill-react')
    expect(fs.existsSync(path.join(dest, 'skill.md'))).toBe(true)
    expect(fs.existsSync(path.join(dest, 'skill.json'))).toBe(true)
  })

  it('installs skill files to local skills dir', () => {
    install('repoloom-skill-react', '1.0.0', tmpDir, { mode: 'local' })
    const dest = path.join(tmpDir, '.claude', 'skills', 'repoloom-skill-react')
    expect(fs.existsSync(path.join(dest, 'skill.md'))).toBe(true)
  })

  it('writes repoloom.lock for local installs', () => {
    install('repoloom-skill-react', '1.0.0', tmpDir, { mode: 'local' })
    const lock = JSON.parse(fs.readFileSync(path.join(tmpDir, 'repoloom.lock'), 'utf8'))
    expect(lock.skills['repoloom-skill-react']).toBe('1.0.0')
  })

  it('does not write repoloom.lock for global installs', () => {
    install('repoloom-skill-react', '1.0.0', tmpDir, { mode: 'global' })
    expect(fs.existsSync(path.join(tmpDir, 'repoloom.lock'))).toBe(false)
  })

  it('is idempotent — skips download when already installed', () => {
    install('repoloom-skill-react', '1.0.0', tmpDir, { mode: 'local' })
    install('repoloom-skill-react', '1.0.0', tmpDir, { mode: 'local' })
    // execSync called twice (npm pack + tar) only for the first install
    expect(childProcess.execSync).toHaveBeenCalledTimes(2)
  })

  it('force flag reinstalls even when already installed', () => {
    install('repoloom-skill-react', '1.0.0', tmpDir, { mode: 'local' })
    install('repoloom-skill-react', '1.0.0', tmpDir, { mode: 'local', force: true })
    expect(childProcess.execSync).toHaveBeenCalledTimes(4)
  })

  it('remove deletes skill dir and updates lock file', () => {
    install('repoloom-skill-react', '1.0.0', tmpDir, { mode: 'local' })
    remove('repoloom-skill-react', tmpDir, { mode: 'local' })

    const dest = path.join(tmpDir, '.claude', 'skills', 'repoloom-skill-react')
    expect(fs.existsSync(dest)).toBe(false)

    const lock = JSON.parse(fs.readFileSync(path.join(tmpDir, 'repoloom.lock'), 'utf8'))
    expect(lock.skills['repoloom-skill-react']).toBeUndefined()
  })

  it('sync installs all skills pinned in repoloom.lock', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'repoloom.lock'),
      JSON.stringify({ version: 1, skills: { 'repoloom-skill-react': '1.0.0' } })
    )
    sync(tmpDir)
    const dest = path.join(tmpDir, '.claude', 'skills', 'repoloom-skill-react')
    expect(fs.existsSync(path.join(dest, 'skill.md'))).toBe(true)
  })

  it('sync throws when repoloom.lock does not exist', () => {
    expect(() => sync(tmpDir)).toThrow('No repoloom.lock found')
  })

  it('list returns separate global and local skill names', () => {
    install('repoloom-skill-react', '1.0.0', tmpDir, { mode: 'global' })
    install('repoloom-skill-fastapi', '1.0.0', tmpDir, { mode: 'local' })
    const result = list(tmpDir)
    expect(result.global).toContain('repoloom-skill-react')
    expect(result.local).toContain('repoloom-skill-fastapi')
  })
})

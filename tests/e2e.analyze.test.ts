import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import * as childProcess from 'node:child_process'
import { fingerprint } from '../src/fingerprinter/index.js'
import { rankSkills } from '../src/ranker/index.js'
import { install, list } from '../src/installer/index.js'
import * as npmModule from '../src/ranker/npm.js'

vi.mock('node:child_process')
vi.mock('../src/ranker/npm.js')

describe('analyze flow (E2E)', () => {
  let projectDir: string
  let tmpHome: string

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repoloom-e2e-'))
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'repoloom-e2e-home-'))
    process.env.HOME = tmpHome
    delete process.env.ANTHROPIC_API_KEY

    // React project fixture
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify({
        name: 'my-app',
        dependencies: { react: '^18.0.0' },
        devDependencies: { typescript: '^5.0.0', vitest: '^2.0.0' },
      })
    )
    fs.mkdirSync(path.join(projectDir, '.github', 'workflows'), { recursive: true })

    vi.mocked(npmModule.searchSkillPackages).mockResolvedValue([
      {
        packageName: 'repoloom-skill-react',
        manifest: {
          name: 'react',
          description: 'React best practices',
          tags: ['react', 'javascript', 'typescript'],
          triggers: { dependencies: ['react'] },
          targets: ['claude-code'],
          version: '1.0.0',
        },
        npmVersion: '1.2.0',
      },
      {
        packageName: 'repoloom-skill-rust',
        manifest: {
          name: 'rust',
          description: 'Rust best practices',
          tags: ['rust'],
          triggers: { dependencies: [] },
          targets: ['claude-code'],
          version: '1.0.0',
        },
        npmVersion: '1.0.0',
      },
    ])

    vi.mocked(childProcess.execFileSync).mockImplementation((cmd: string, args?: readonly string[]) => {
      const argList = args ?? []
      if (cmd === 'npm' && argList[0] === 'pack') {
        const destIdx = argList.indexOf('--pack-destination')
        if (destIdx !== -1) {
          fs.writeFileSync(path.join(argList[destIdx + 1], 'repoloom-skill-react-1.2.0.tgz'), '')
        }
      } else if (cmd === 'tar') {
        const destIdx = argList.indexOf('-C')
        if (destIdx !== -1) {
          const pkgDir = path.join(argList[destIdx + 1], 'package')
          fs.mkdirSync(pkgDir, { recursive: true })
          fs.writeFileSync(path.join(pkgDir, 'skill.md'), '# React Skill')
          fs.writeFileSync(path.join(pkgDir, 'skill.json'), '{"name":"react"}')
        }
      }
      return Buffer.from('')
    })
  })

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true })
    fs.rmSync(tmpHome, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('fingerprints a React+TypeScript project correctly', () => {
    const fp = fingerprint(projectDir)
    expect(fp.frameworks).toContain('react')
    expect(fp.languages).toContain('typescript')
    expect(fp.ciProvider).toBe('github-actions')
  })

  it('rankSkills returns react skill and excludes rust skill (no tag match)', async () => {
    const fp = fingerprint(projectDir)
    const ranked = await rankSkills(fp)
    expect(ranked.some(r => r.packageName === 'repoloom-skill-react')).toBe(true)
    expect(ranked.some(r => r.packageName === 'repoloom-skill-rust')).toBe(false)
  })

  it('full flow: fingerprint → rank → install → list shows installed skill', async () => {
    const fp = fingerprint(projectDir)
    const ranked = await rankSkills(fp)
    const topSkill = ranked[0]

    install(topSkill.packageName, topSkill.npmVersion, projectDir, { mode: 'local' })

    const installed = list(projectDir)
    expect(installed.local).toContain('repoloom-skill-react')

    const lock = JSON.parse(fs.readFileSync(path.join(projectDir, 'repoloom.lock'), 'utf8'))
    expect(lock.skills['repoloom-skill-react']).toBe('1.2.0')
  })
})

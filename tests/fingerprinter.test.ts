import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fingerprint } from '../src/fingerprinter/index.js'

describe('fingerprinter', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repoloom-fp-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty fingerprint for unknown project', () => {
    const result = fingerprint(tmpDir)
    expect(result.packageManagers).toEqual([])
    expect(result.languages).toEqual([])
    expect(result.frameworks).toEqual([])
    expect(result.ciProvider).toBeNull()
    expect(result.isMonorepo).toBe(false)
    expect(result.installedSkills).toEqual([])
  })

  it('detects npm and javascript from package.json', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', dependencies: {} })
    )
    const result = fingerprint(tmpDir)
    expect(result.packageManagers).toContain('npm')
    expect(result.languages).toContain('javascript')
  })

  it('detects typescript from devDependencies', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', devDependencies: { typescript: '^5.0.0' } })
    )
    const result = fingerprint(tmpDir)
    expect(result.languages).toContain('typescript')
  })

  it('detects react framework', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', dependencies: { react: '^18.0.0' } })
    )
    const result = fingerprint(tmpDir)
    expect(result.frameworks).toContain('react')
  })

  it('detects vitest test framework', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', devDependencies: { vitest: '^2.0.0' } })
    )
    const result = fingerprint(tmpDir)
    expect(result.testFrameworks).toContain('vitest')
  })

  it('detects python and fastapi from requirements.txt', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'fastapi\nuvicorn\n')
    const result = fingerprint(tmpDir)
    expect(result.languages).toContain('python')
    expect(result.packageManagers).toContain('pip')
    expect(result.frameworks).toContain('fastapi')
  })

  it('detects pytest from requirements.txt', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'pytest\n')
    const result = fingerprint(tmpDir)
    expect(result.testFrameworks).toContain('pytest')
  })

  it('detects cargo from Cargo.toml', () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]\nname = "test"\n')
    const result = fingerprint(tmpDir)
    expect(result.packageManagers).toContain('cargo')
    expect(result.languages).toContain('rust')
  })

  it('detects github-actions CI', () => {
    fs.mkdirSync(path.join(tmpDir, '.github', 'workflows'), { recursive: true })
    const result = fingerprint(tmpDir)
    expect(result.ciProvider).toBe('github-actions')
  })

  it('detects monorepo via workspaces field', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'root', workspaces: ['packages/*'] })
    )
    const result = fingerprint(tmpDir)
    expect(result.isMonorepo).toBe(true)
  })

  it('detects already-installed local skills', () => {
    const skillDir = path.join(tmpDir, '.claude', 'skills', 'repoloom-skill-react')
    fs.mkdirSync(skillDir, { recursive: true })
    const result = fingerprint(tmpDir)
    expect(result.installedSkills).toContain('repoloom-skill-react')
  })
})

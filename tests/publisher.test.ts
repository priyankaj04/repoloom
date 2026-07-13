import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import * as childProcess from 'node:child_process'
import { validate, publish } from '../src/publisher/index.js'

vi.mock('node:child_process')

function writeValidSkill(dir: string): void {
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'repoloom-skill-test', version: '1.0.0' }, null, 2)
  )
  fs.writeFileSync(
    path.join(dir, 'skill.json'),
    JSON.stringify({
      name: 'test',
      description: 'A test skill',
      tags: ['test'],
      triggers: { dependencies: ['test-lib'] },
      targets: ['claude-code'],
      version: '1.0.0',
    }, null, 2)
  )
  fs.writeFileSync(path.join(dir, 'skill.md'), '# Test skill\n\nDo testing things.\n')
}

describe('publisher', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repoloom-pub-'))
    vi.clearAllMocks()
    vi.mocked(childProcess.execSync).mockReturnValue(Buffer.from(''))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  describe('validate', () => {
    it('passes for a valid skill package', () => {
      writeValidSkill(tmpDir)
      expect(() => validate(tmpDir)).not.toThrow()
    })

    it('throws when package name does not follow convention', () => {
      writeValidSkill(tmpDir)
      const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'))
      pkg.name = 'my-skill'
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg))
      expect(() => validate(tmpDir)).toThrow('Package name must match repoloom-skill-*')
    })

    it('accepts scoped packages @scope/repoloom-skill-*', () => {
      writeValidSkill(tmpDir)
      const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'))
      pkg.name = '@myorg/repoloom-skill-test'
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg))
      expect(() => validate(tmpDir)).not.toThrow()
    })

    it('throws when skill.json is missing a required field', () => {
      writeValidSkill(tmpDir)
      const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'skill.json'), 'utf8'))
      delete manifest.description
      fs.writeFileSync(path.join(tmpDir, 'skill.json'), JSON.stringify(manifest))
      expect(() => validate(tmpDir)).toThrow('skill.json missing required field: description')
    })

    it('throws when skill.md is empty or whitespace-only', () => {
      writeValidSkill(tmpDir)
      fs.writeFileSync(path.join(tmpDir, 'skill.md'), '   \n  ')
      expect(() => validate(tmpDir)).toThrow('skill.md is empty')
    })

    it('throws when triggers has no entries', () => {
      writeValidSkill(tmpDir)
      const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'skill.json'), 'utf8'))
      manifest.triggers = {}
      fs.writeFileSync(path.join(tmpDir, 'skill.json'), JSON.stringify(manifest))
      expect(() => validate(tmpDir)).toThrow('triggers must have at least one')
    })

    it('throws when package.json is missing', () => {
      writeValidSkill(tmpDir)
      fs.unlinkSync(path.join(tmpDir, 'package.json'))
      expect(() => validate(tmpDir)).toThrow('package.json not found')
    })
  })

  describe('publish', () => {
    it('syncs skill.json content into package.json repoloom field', () => {
      writeValidSkill(tmpDir)
      publish(tmpDir)
      const pkg = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf8'))
      expect(pkg.repoloom).toBeDefined()
      expect(pkg.repoloom.name).toBe('test')
      expect(pkg.repoloom.tags).toContain('test')
    })

    it('runs npm publish in the skill directory', () => {
      writeValidSkill(tmpDir)
      publish(tmpDir)
      expect(childProcess.execSync).toHaveBeenCalledWith(
        'npm publish',
        expect.objectContaining({ cwd: tmpDir, stdio: 'inherit' })
      )
    })

    it('does not run npm publish when validation fails', () => {
      writeValidSkill(tmpDir)
      fs.writeFileSync(path.join(tmpDir, 'skill.md'), '')
      expect(() => publish(tmpDir)).toThrow()
      expect(childProcess.execSync).not.toHaveBeenCalled()
    })
  })
})

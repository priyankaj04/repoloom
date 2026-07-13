import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { getCacheKey, readCache, writeCache } from '../src/ranker/cache.js'
import type { ProjectFingerprint, RankedSkill } from '../src/types.js'

const mockFingerprint: ProjectFingerprint = {
  packageManagers: ['npm'],
  languages: ['typescript'],
  frameworks: ['react'],
  testFrameworks: ['vitest'],
  ciProvider: 'github-actions',
  isMonorepo: false,
  installedSkills: [],
}

const mockSkills: RankedSkill[] = [
  {
    packageName: 'repoloom-skill-react',
    manifest: {
      name: 'react',
      description: 'React skills',
      tags: ['react'],
      triggers: { dependencies: ['react'] },
      targets: ['claude-code'],
      version: '1.0.0',
    },
    npmVersion: '1.0.0',
    rank: 1,
    explanation: 'React detected in dependencies',
  },
]

describe('cache', () => {
  let tmpHome: string
  let originalHome: string | undefined

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'repoloom-cache-'))
    originalHome = process.env.HOME
    process.env.HOME = tmpHome
  })

  afterEach(() => {
    process.env.HOME = originalHome
    fs.rmSync(tmpHome, { recursive: true, force: true })
  })

  it('returns null on cache miss', () => {
    expect(readCache(getCacheKey(mockFingerprint))).toBeNull()
  })

  it('round-trips skills through write then read', () => {
    const key = getCacheKey(mockFingerprint)
    writeCache(key, mockSkills)
    expect(readCache(key)).toEqual(mockSkills)
  })

  it('getCacheKey is deterministic for the same fingerprint', () => {
    expect(getCacheKey(mockFingerprint)).toBe(getCacheKey({ ...mockFingerprint }))
  })

  it('getCacheKey differs for different fingerprints', () => {
    const key1 = getCacheKey(mockFingerprint)
    const key2 = getCacheKey({ ...mockFingerprint, frameworks: ['vue'] })
    expect(key1).not.toBe(key2)
  })

  it('writeCache creates the cache directory if it does not exist', () => {
    const key = getCacheKey(mockFingerprint)
    writeCache(key, mockSkills)
    expect(fs.existsSync(path.join(tmpHome, '.repoloom', 'cache'))).toBe(true)
  })
})

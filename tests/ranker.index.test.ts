import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rankSkills } from '../src/ranker/index.js'
import * as npmModule from '../src/ranker/npm.js'
import * as cacheModule from '../src/ranker/cache.js'
import type { ProjectFingerprint, SkillPackage } from '../src/types.js'

vi.mock('../src/ranker/npm.js')
vi.mock('../src/ranker/cache.js')

// Mock the Anthropic SDK at the top level so it is always intercepted.
// The mockCreate spy is shared via module-level state so individual tests
// can control what the Claude API returns.
const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => {
  function MockAnthropic() {
    return { messages: { create: mockCreate } }
  }
  return { default: MockAnthropic }
})

const fp: ProjectFingerprint = {
  packageManagers: ['npm'],
  languages: ['typescript'],
  frameworks: ['react'],
  testFrameworks: ['vitest'],
  ciProvider: null,
  isMonorepo: false,
  installedSkills: [],
}

const reactPkg: SkillPackage = {
  packageName: 'repoloom-skill-react',
  manifest: {
    name: 'react',
    description: 'React skills',
    tags: ['react', 'javascript'],
    triggers: { dependencies: ['react'] },
    targets: ['claude-code'],
    version: '1.0.0',
  },
  npmVersion: '1.0.0',
}

describe('rankSkills', () => {
  beforeEach(() => {
    vi.mocked(cacheModule.getCacheKey).mockReturnValue('test-key')
    vi.mocked(cacheModule.readCache).mockReturnValue(null)
    vi.mocked(cacheModule.writeCache).mockImplementation(() => {})
    vi.mocked(npmModule.searchSkillPackages).mockResolvedValue([reactPkg])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.ANTHROPIC_API_KEY
  })

  it('returns cached result immediately without hitting npm', async () => {
    const cached = [{ ...reactPkg, rank: 1, explanation: 'cached' }]
    vi.mocked(cacheModule.readCache).mockReturnValue(cached)

    const result = await rankSkills(fp)

    expect(result).toBe(cached)
    expect(npmModule.searchSkillPackages).not.toHaveBeenCalled()
  })

  it('returns empty array when no skills are available on npm', async () => {
    vi.mocked(npmModule.searchSkillPackages).mockResolvedValue([])
    const result = await rankSkills(fp)
    expect(result).toEqual([])
  })

  it('falls back to tag-based ranking when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY

    const result = await rankSkills(fp)

    expect(result.length).toBeGreaterThan(0)
    expect(result[0].packageName).toBe('repoloom-skill-react')
    expect(result[0].explanation).toMatch(/react/i)
    expect(result[0].rank).toBe(1)
  })

  it('tag-based ranking excludes skills with zero tag matches', async () => {
    delete process.env.ANTHROPIC_API_KEY

    vi.mocked(npmModule.searchSkillPackages).mockResolvedValue([{
      packageName: 'repoloom-skill-rust',
      manifest: {
        name: 'rust',
        description: 'Rust skills',
        tags: ['rust'],
        triggers: { dependencies: [] },
        targets: ['claude-code'],
        version: '1.0.0',
      },
      npmVersion: '1.0.0',
    }])

    const result = await rankSkills(fp)
    expect(result).toHaveLength(0)
  })

  it('excludes already-installed skills from recommendations', async () => {
    delete process.env.ANTHROPIC_API_KEY

    const fpWithInstalled: ProjectFingerprint = {
      ...fp,
      installedSkills: ['repoloom-skill-react'],
    }

    const result = await rankSkills(fpWithInstalled)
    expect(result.every(s => s.packageName !== 'repoloom-skill-react')).toBe(true)
  })

  it('writes result to cache after Claude ranking', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'

    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify([
          { packageName: 'repoloom-skill-react', rank: 1, explanation: 'React detected' },
        ]),
      }],
    })

    await rankSkills(fp)
    expect(cacheModule.writeCache).toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchSkillPackages } from '../src/ranker/npm.js'

describe('searchSkillPackages', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns skill packages that have a repoloom manifest', async () => {
    const searchResponse = {
      objects: [
        { package: { name: 'repoloom-skill-react', version: '1.0.0' } },
        { package: { name: 'unrelated-package', version: '1.0.0' } },
      ],
    }
    const manifestResponse = {
      repoloom: {
        name: 'react',
        description: 'React best practices',
        tags: ['react', 'javascript'],
        triggers: { dependencies: ['react'] },
        targets: ['claude-code'],
        version: '1.0.0',
      },
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => searchResponse } as Response)
      .mockResolvedValue({ ok: true, json: async () => manifestResponse } as Response)

    const result = await searchSkillPackages()

    expect(result).toHaveLength(1)
    expect(result[0].packageName).toBe('repoloom-skill-react')
    expect(result[0].manifest.tags).toContain('react')
    expect(result[0].npmVersion).toBe('1.0.0')
  })

  it('filters packages without a repoloom field in their registry manifest', async () => {
    const searchResponse = {
      objects: [{ package: { name: 'repoloom-skill-react', version: '1.0.0' } }],
    }

    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => searchResponse } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'repoloom-skill-react' }) } as Response)

    const result = await searchSkillPackages()
    expect(result).toHaveLength(0)
  })

  it('throws when npm search API returns a non-ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 503 } as Response)
    await expect(searchSkillPackages()).rejects.toThrow('npm search failed: 503')
  })

  it('filters out packages not matching repoloom-skill-* naming', async () => {
    const searchResponse = {
      objects: [
        { package: { name: 'repoloom-skill-react', version: '1.0.0' } },
        { package: { name: 'repoloom-helper', version: '1.0.0' } },
      ],
    }
    const manifestResponse = { repoloom: { name: 'react', description: 'x', tags: [], triggers: { dependencies: ['react'] }, targets: ['claude-code'], version: '1.0.0' } }

    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => searchResponse } as Response)
      .mockResolvedValue({ ok: true, json: async () => manifestResponse } as Response)

    const result = await searchSkillPackages()
    expect(result.every(s => s.packageName.includes('repoloom-skill-'))).toBe(true)
  })
})

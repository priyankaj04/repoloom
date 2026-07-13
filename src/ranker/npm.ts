import type { SkillManifest, SkillPackage } from '../types.js'

const NPM_SEARCH = 'https://registry.npmjs.org/-/v1/search'
const NPM_REGISTRY = 'https://registry.npmjs.org'
const SKILL_PATTERN = /^(@[\w-]+\/)?repoloom-skill-/

interface NpmSearchResult {
  objects: Array<{ package: { name: string; version: string } }>
}

interface NpmPackageManifest {
  repoloom?: SkillManifest
}

export async function searchSkillPackages(): Promise<SkillPackage[]> {
  const res = await fetch(`${NPM_SEARCH}?text=repoloom-skill&size=100`)
  if (!res.ok) throw new Error(`npm search failed: ${res.status}`)

  const data = (await res.json()) as NpmSearchResult
  const candidates = data.objects
    .map(o => o.package)
    .filter(p => SKILL_PATTERN.test(p.name))

  const results: SkillPackage[] = []
  for (const pkg of candidates) {
    const manifest = await fetchManifest(pkg.name, pkg.version)
    if (manifest) results.push({ packageName: pkg.name, manifest, npmVersion: pkg.version })
  }
  return results
}

async function fetchManifest(
  packageName: string,
  version: string
): Promise<SkillManifest | null> {
  try {
    const encoded = packageName.startsWith('@')
      ? packageName.replace('/', '%2F')
      : packageName
    const res = await fetch(`${NPM_REGISTRY}/${encoded}/${version}`)
    if (!res.ok) return null
    const data = (await res.json()) as NpmPackageManifest
    return data.repoloom ?? null
  } catch {
    return null
  }
}

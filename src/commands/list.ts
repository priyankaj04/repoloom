import { list } from '../installer/index.js'

export function listCommand(): void {
  const { global: globalSkills, local } = list(process.cwd())

  console.log('\nGlobal skills (~/.claude/plugins/):')
  if (globalSkills.length === 0) console.log('  (none)')
  else globalSkills.forEach(s => console.log(`  • ${s}`))

  console.log('\nLocal skills (.claude/skills/):')
  if (local.length === 0) console.log('  (none)')
  else local.forEach(s => console.log(`  • ${s}`))
}

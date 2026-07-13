#!/usr/bin/env node
import { createRequire } from 'node:module'
import { Command } from 'commander'
import { analyzeCommand } from './commands/analyze.js'
import { installCommand } from './commands/install.js'
import { syncCommand } from './commands/sync.js'
import { listCommand } from './commands/list.js'
import { removeCommand } from './commands/remove.js'
import { publishCommand } from './commands/publish.js'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

const program = new Command()

program
  .name('repoloom')
  .description('Analyze your project and install the right Claude Code skills')
  .version(pkg.version)

program
  .command('analyze')
  .description('Fingerprint project and recommend skills')
  .option('--local', 'install skills to .claude/skills/ (project-local)')
  .option('--global', 'install skills to ~/.claude/plugins/ (user-global)')
  .action(analyzeCommand)

program
  .command('install <skill>')
  .description('Install a specific skill by package name')
  .option('--local', 'install locally')
  .option('--global', 'install globally (default)')
  .option('--force', 'reinstall even if already present')
  .action(installCommand)

program
  .command('sync')
  .description('Install all skills pinned in repoloom.lock')
  .action(syncCommand)

program
  .command('list')
  .description('Show installed skills (global and local)')
  .action(listCommand)

program
  .command('remove <skill>')
  .description('Uninstall a skill')
  .option('--local', 'remove from local install')
  .option('--global', 'remove from global install (default)')
  .action(removeCommand)

program
  .command('publish')
  .description('Scaffold a new skill or publish an existing one to npm')
  .action(publishCommand)

program.parse()

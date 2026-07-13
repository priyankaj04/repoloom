import ora from 'ora'
import { install } from '../installer/index.js'
import type { InstallOptions } from '../types.js'

export async function installCommand(
  packageName: string,
  opts: { local?: boolean; global?: boolean; force?: boolean }
): Promise<void> {
  const projectDir = process.cwd()
  const mode: InstallOptions['mode'] = opts.local ? 'local' : 'global'
  const spinner = ora(`Installing ${packageName}...`).start()
  try {
    install(packageName, 'latest', projectDir, { mode, force: opts.force })
    spinner.succeed(`Installed ${packageName} (${mode})`)
  } catch (err) {
    spinner.fail(`Failed to install ${packageName}`)
    throw err
  }
}

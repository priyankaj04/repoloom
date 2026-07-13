import ora from 'ora'
import { remove } from '../installer/index.js'
import type { InstallOptions } from '../types.js'

export async function removeCommand(
  packageName: string,
  opts: { local?: boolean; global?: boolean }
): Promise<void> {
  const mode: InstallOptions['mode'] = opts.local ? 'local' : 'global'
  const spinner = ora(`Removing ${packageName}...`).start()
  remove(packageName, process.cwd(), { mode })
  spinner.succeed(`Removed ${packageName} (${mode})`)
}

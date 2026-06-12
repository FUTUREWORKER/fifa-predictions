#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsx', path.join(root, 'cli/index.ts'), ...process.argv.slice(2)],
  {
    cwd: root,
    stdio: 'inherit',
  },
)

process.exit(result.status ?? 1)

import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import type { AppConfig } from './types'

const root = process.cwd()
const configPath = path.join(root, 'config', 'providers.json')
const examplePath = path.join(root, 'config', 'providers.example.json')

const dataSourceSchema = z.object({
  type: z
    .enum(['generic-json', 'worldcup26', 'csv', 'sporttery-500'])
    .default('generic-json'),
  url: z.string().optional(),
  localFile: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
})

const configSchema = z.object({
  schedule: dataSourceSchema,
  odds: dataSourceSchema,
  providers: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      kind: z.literal('openai-compatible'),
      enabled: z.boolean().default(false),
      baseURL: z.string().min(1),
      apiKey: z.string().min(1),
      model: z.string().min(1),
    }),
  ),
})

async function readJsonFile(filePath: string) {
  const body = await fs.readFile(filePath, 'utf8')
  return JSON.parse(body)
}

export async function loadConfig(): Promise<AppConfig> {
  const file = await fs
    .access(configPath)
    .then(() => configPath)
    .catch(() => examplePath)

  const parsed = configSchema.parse(await readJsonFile(file))
  return parsed
}

export function resolveProjectPath(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath)
}

export function maskConfig(config: AppConfig) {
  return {
    schedule: config.schedule,
    odds: config.odds,
    providers: config.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      kind: provider.kind,
      enabled: provider.enabled,
      baseURL: provider.baseURL,
      model: provider.model,
      hasApiKey:
        provider.apiKey.length > 0 &&
        !provider.apiKey.startsWith('填入你的'),
    })),
  }
}

import fs from 'node:fs/promises'
import path from 'node:path'
import type { Prediction } from './types'

const cachePath = path.join(process.cwd(), 'data', 'prediction-cache.json')

type PredictionCache = Record<string, Prediction>

function cacheKey(matchId: string, providerId: string) {
  return `${matchId}:${providerId}`
}

async function readCache(): Promise<PredictionCache> {
  try {
    return JSON.parse(await fs.readFile(cachePath, 'utf8')) as PredictionCache
  } catch {
    return {}
  }
}

async function writeCache(cache: PredictionCache) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true })
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2) + '\n')
}

export async function getCachedPrediction(matchId: string, providerId: string) {
  const cache = await readCache()
  return cache[cacheKey(matchId, providerId)] ?? null
}

export async function getCachedPredictionsForMatch(matchId: string) {
  const cache = await readCache()
  return Object.values(cache).filter((prediction) => prediction.matchId === matchId)
}

export async function setCachedPrediction(prediction: Prediction) {
  const cache = await readCache()
  cache[cacheKey(prediction.matchId, prediction.providerId)] = prediction
  await writeCache(cache)
}

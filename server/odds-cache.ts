import fs from 'node:fs/promises'
import path from 'node:path'
import type { Odds } from './types'

const oddsCachePath = path.join(process.cwd(), 'data', 'odds-cache.json')

function oddsKey(odds: Odds) {
  return `${odds.homeTeam ?? ''}::${odds.awayTeam ?? ''}`
}

async function readOddsCache(): Promise<Odds[]> {
  try {
    return JSON.parse(await fs.readFile(oddsCachePath, 'utf8')) as Odds[]
  } catch {
    return []
  }
}

async function writeOddsCache(odds: Odds[]) {
  await fs.mkdir(path.dirname(oddsCachePath), { recursive: true })
  await fs.writeFile(oddsCachePath, JSON.stringify(odds, null, 2) + '\n')
}

export async function mergeWithOddsCache(liveOdds: Odds[]) {
  const cachedOdds = await readOddsCache()
  const merged = new Map<string, Odds>()

  for (const odds of cachedOdds) {
    merged.set(oddsKey(odds), {
      ...odds,
      source: odds.source ?? '盘口缓存',
      cached: true,
    })
  }

  for (const odds of liveOdds) {
    merged.set(oddsKey(odds), {
      ...odds,
      source: odds.source ?? '实时盘口',
      cached: false,
    })
  }

  const result = [...merged.values()]
  if (liveOdds.length) await writeOddsCache(result)
  return {
    odds: result,
    cachedCount: cachedOdds.length,
    liveCount: liveOdds.length,
  }
}

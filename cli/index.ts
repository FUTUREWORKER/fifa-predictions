import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import { loadConfig, maskConfig } from '../server/config'
import { loadMatches, loadOdds } from '../server/data'
import { predictMatch } from '../server/predictor'
import { mergeWithOddsCache } from '../server/odds-cache'
import { searchMatchContext } from '../server/search'

type Command = 'serve' | 'check-data' | 'predict' | 'clear-cache' | 'config'

function help() {
  console.log(`FIFA Predictions CLI

Usage:
  fifa-predictions serve
  fifa-predictions check-data
  fifa-predictions predict --match <matchId> [--provider deepseek|qwen|gpt|all] [--force]
  fifa-predictions clear-cache [predictions|odds|all]
  fifa-predictions config

Examples:
  npm run cli -- check-data
  npm run cli -- predict --match 3 --provider all --force
`)
}

function getArg(name: string, fallback = '') {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback
}

function hasFlag(name: string) {
  return process.argv.includes(name)
}

async function serve() {
  const child = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true,
  })
  child.on('exit', (code) => process.exit(code ?? 0))
}

async function checkData() {
  const config = await loadConfig()
  const [{ source, matches }, oddsResult] = await Promise.all([
    loadMatches(config.schedule),
    loadOdds(config.odds),
  ])
  const mergedOdds = await mergeWithOddsCache(oddsResult.odds)
  const withOdds = matches.filter((match) =>
    mergedOdds.odds.some(
      (odds) =>
        odds.homeTeam === match.homeTeam && odds.awayTeam === match.awayTeam,
    ),
  )

  console.log(
    JSON.stringify(
      {
        scheduleSource: source,
        oddsSource: oddsResult.source,
        matches: matches.length,
        finished: matches.filter((match) => match.status === 'finished').length,
        liveOdds: mergedOdds.liveCount,
        cachedOdds: mergedOdds.cachedCount,
        matchesWithOdds: withOdds.length,
        firstWithOdds: withOdds[0]
          ? `${withOdds[0].homeTeam} vs ${withOdds[0].awayTeam}`
          : null,
      },
      null,
      2,
    ),
  )
}

async function runPredict() {
  const matchId = getArg('--match')
  const providerArg = getArg('--provider', 'all')
  const force = hasFlag('--force')
  if (!matchId) throw new Error('Missing --match <matchId>.')

  const config = await loadConfig()
  const [{ matches }, { odds }] = await Promise.all([
    loadMatches(config.schedule),
    loadOdds(config.odds),
  ])
  const mergedOdds = await mergeWithOddsCache(odds)
  const match = matches.find((item) => item.id === matchId)
  if (!match) throw new Error(`Match not found: ${matchId}`)

  const providers = config.providers.filter(
    (provider) =>
      provider.enabled &&
      !provider.apiKey.startsWith('填入你的') &&
      (providerArg === 'all' || provider.id === providerArg),
  )
  if (!providers.length) throw new Error('No enabled provider matched.')

  const oddsForMatch = mergedOdds.odds.find(
    (item) => item.homeTeam === match.homeTeam && item.awayTeam === match.awayTeam,
  )
  const webContext = await searchMatchContext(match)
  const results = await Promise.all(
    providers.map((provider) => predictMatch(provider, match, oddsForMatch, webContext)),
  )

  console.log(
    JSON.stringify(
      {
        match: `${match.homeTeam} vs ${match.awayTeam}`,
        force,
        predictions: results.map((prediction) => ({
          provider: prediction.providerName,
          model: prediction.model,
          result: prediction.predictedResult,
          scoreline: prediction.scoreline,
          confidence: prediction.confidence,
        })),
      },
      null,
      2,
    ),
  )
}

async function clearCache() {
  const target = (process.argv[3] ?? 'all') as 'predictions' | 'odds' | 'all'
  const files = {
    predictions: 'data/prediction-cache.json',
    odds: 'data/odds-cache.json',
  }
  const toDelete =
    target === 'all' ? Object.values(files) : [files[target] ?? files.predictions]

  for (const file of toDelete) {
    await fs.rm(file, { force: true })
  }
  console.log(`Cleared ${target} cache.`)
}

async function showConfig() {
  console.log(JSON.stringify(maskConfig(await loadConfig()), null, 2))
}

async function main() {
  const command = process.argv[2] as Command | undefined
  if (!command || command === '--help' || command === '-h') return help()
  if (command === 'serve') return serve()
  if (command === 'check-data') return checkData()
  if (command === 'predict') return runPredict()
  if (command === 'clear-cache') return clearCache()
  if (command === 'config') return showConfig()
  help()
  process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

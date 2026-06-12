import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { loadConfig, maskConfig } from './config'
import { loadMatches, loadOdds } from './data'
import { predictMatch } from './predictor'
import type { Match, Odds } from './types'
import { getCachedPrediction, getCachedPredictionsForMatch, setCachedPrediction } from './cache'
import { searchMatchContext } from './search'
import { mergeWithOddsCache } from './odds-cache'

const app = express()
const port = Number(process.env.PORT ?? 5174)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'fifa-predictions-api' })
})

app.get('/api/config/status', async (_req, res, next) => {
  try {
    const config = await loadConfig()
    res.json(maskConfig(config))
  } catch (error) {
    next(error)
  }
})

app.get('/api/matches', async (_req, res, next) => {
  try {
    const config = await loadConfig()
    const [matches, odds] = await Promise.all([
      loadMatches(config.schedule),
      loadOdds(config.odds),
    ])
    const mergedOdds = await mergeWithOddsCache(odds.odds)
    res.json({
      source: matches.source,
      oddsSource: odds.source,
      oddsLiveCount: mergedOdds.liveCount,
      oddsCachedCount: mergedOdds.cachedCount,
      matches: matches.matches.map((match) => ({
        ...match,
        odds: findOddsForMatch(match, mergedOdds.odds),
      })),
    })
  } catch (error) {
    next(error)
  }
})

function normalizeName(value = '') {
  const aliases: Record<string, string> = {
    '刚果(金)': '刚果民主共和国',
    乌兹别克: '乌兹别克斯坦',
  }
  const compact = value.replace(/\s+/g, '')
  return (aliases[compact] ?? compact).toLowerCase()
}

function findOddsForMatch(match: Match, odds: Odds[]) {
  return (
    odds.find((item) => item.matchId === match.id) ??
    odds.find(
      (item) =>
        normalizeName(item.homeTeam) === normalizeName(match.homeTeam) &&
        normalizeName(item.awayTeam) === normalizeName(match.awayTeam),
    ) ??
    null
  )
}

const predictSchema = z.object({
  matchId: z.string(),
  providerId: z.string(),
  force: z.boolean().optional(),
})

app.get('/api/predictions/:matchId', async (req, res, next) => {
  try {
    res.json({ predictions: await getCachedPredictionsForMatch(req.params.matchId) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/predict', async (req, res, next) => {
  try {
    const input = predictSchema.parse(req.body)
    const config = await loadConfig()
    const [{ matches }, { odds }] = await Promise.all([
      loadMatches(config.schedule),
      loadOdds(config.odds),
    ])
    const mergedOdds = await mergeWithOddsCache(odds)

    const match = matches.find((item) => item.id === input.matchId)
    const provider = config.providers.find((item) => item.id === input.providerId)
    if (!match) return res.status(404).json({ error: 'Match not found' })
    if (!provider) return res.status(404).json({ error: 'Provider not found' })

    if (!input.force) {
      const cached = await getCachedPrediction(match.id, provider.id)
      if (cached) return res.json({ ...cached, cached: true })
    }

    const webContext = await searchMatchContext(match)
    const prediction = await predictMatch(
      provider,
      match,
      findOddsForMatch(match, mergedOdds.odds) ?? undefined,
      webContext,
    )
    await setCachedPrediction(prediction)
    res.json(prediction)
  } catch (error) {
    next(error)
  }
})

app.post('/api/predict/all', async (req, res, next) => {
  try {
    const input = predictSchema.pick({ providerId: true }).parse(req.body)
    const config = await loadConfig()
    const [{ matches }, { odds }] = await Promise.all([
      loadMatches(config.schedule),
      loadOdds(config.odds),
    ])
    const mergedOdds = await mergeWithOddsCache(odds)
    const provider = config.providers.find((item) => item.id === input.providerId)
    if (!provider) return res.status(404).json({ error: 'Provider not found' })

    const predictions = []
    for (const match of matches) {
      predictions.push(
        await predictMatch(
          provider,
          match,
          findOddsForMatch(match, mergedOdds.odds) ?? undefined,
        ),
      )
    }
    res.json({ predictions })
  } catch (error) {
    next(error)
  }
})

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    void _next
    const message = error instanceof Error ? error.message : 'Unknown server error'
    res.status(500).json({ error: message })
  },
)

app.listen(port, () => {
  console.log(`FIFA predictions API listening on http://localhost:${port}`)
})

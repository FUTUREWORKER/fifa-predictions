import cors from 'cors'
import express from 'express'
import { z } from 'zod'
import { loadConfig, maskConfig } from './config'
import { loadMatches, loadOdds } from './data'
import { predictMatch } from './predictor'
import type { Match, Odds } from './types'
import {
  getAllCachedPredictions,
  getCachedPrediction,
  getCachedPredictionsForMatch,
  setCachedPrediction,
} from './cache'
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
      matches: [...matches.matches]
        .sort(byMatchTime)
        .map((match) => ({
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

function byMatchTime(a: Match, b: Match) {
  return new Date(a.date).getTime() - new Date(b.date).getTime()
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

function actualResult(match: Match) {
  if (
    match.status !== 'finished' ||
    typeof match.homeScore !== 'number' ||
    typeof match.awayScore !== 'number'
  ) {
    return null
  }
  if (match.homeScore > match.awayScore) return 'home'
  if (match.homeScore < match.awayScore) return 'away'
  return 'draw'
}

function normalizeScoreline(value = '') {
  const match = value
    .replace(/[：:]/g, '-')
    .replace(/\s+/g, '')
    .match(/^(\d+)-(\d+)$/)
  return match ? `${Number(match[1])}-${Number(match[2])}` : ''
}

function actualScoreline(match: Match) {
  return typeof match.homeScore === 'number' && typeof match.awayScore === 'number'
    ? `${match.homeScore}-${match.awayScore}`
    : ''
}

function actualHandicapResult(match: Match, odds?: Odds | null) {
  if (
    match.status !== 'finished' ||
    typeof match.homeScore !== 'number' ||
    typeof match.awayScore !== 'number' ||
    !odds?.handicap
  ) {
    return null
  }
  const handicap = Number(odds.handicap)
  if (!Number.isFinite(handicap)) return null
  const adjustedHomeScore = match.homeScore + handicap
  if (adjustedHomeScore > match.awayScore) return 'home'
  if (adjustedHomeScore < match.awayScore) return 'away'
  return 'draw'
}

app.get('/api/analytics/model-performance', async (_req, res, next) => {
  try {
    const config = await loadConfig()
    const [{ matches }, { odds }] = await Promise.all([
      loadMatches(config.schedule),
      loadOdds(config.odds),
    ])
    const mergedOdds = await mergeWithOddsCache(odds)
    const predictions = await getAllCachedPredictions()
    const finishedMatches = matches.filter((match) => actualResult(match))
    const matchById = new Map(finishedMatches.map((match) => [match.id, match]))

    const providers = config.providers.map((provider) => {
      const providerPredictions = predictions
        .filter((prediction) => prediction.providerId === provider.id)
        .map((prediction) => {
          const match = matchById.get(prediction.matchId)
          const result = match ? actualResult(match) : null
          const matchOdds = match ? findOddsForMatch(match, mergedOdds.odds) : null
          const handicapResult = match ? actualHandicapResult(match, matchOdds) : null
          return match && result
            ? {
                matchId: match.id,
                matchDate: match.date,
                matchName: `${match.homeTeam} vs ${match.awayTeam}`,
                actualResult: result,
                actualScoreline: actualScoreline(match),
                actualHandicapResult: handicapResult,
                handicap: matchOdds?.handicap,
                predictedResult: prediction.predictedResult,
                handicapPredictedResult: prediction.handicapPredictedResult,
                predictedScoreline: normalizeScoreline(prediction.scoreline),
                correct: prediction.predictedResult === result,
                handicapCorrect:
                  Boolean(handicapResult && prediction.handicapPredictedResult) &&
                  prediction.handicapPredictedResult === handicapResult,
                handicapEvaluable: Boolean(handicapResult && prediction.handicapPredictedResult),
                scorelineCorrect:
                  normalizeScoreline(prediction.scoreline) === actualScoreline(match),
                confidence: prediction.confidence,
                scoreline: prediction.scoreline,
                createdAt: prediction.createdAt,
              }
            : null
        })
        .filter(Boolean)
        .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())

      let correct = 0
      let scorelineCorrect = 0
      let handicapCorrect = 0
      let handicapTotal = 0
      const trend = providerPredictions.map((item, index) => {
        if (item.correct) correct += 1
        if (item.scorelineCorrect) scorelineCorrect += 1
        if (item.handicapEvaluable) {
          handicapTotal += 1
          if (item.handicapCorrect) handicapCorrect += 1
        }
        return {
          matchId: item.matchId,
          matchDate: item.matchDate,
          matchName: item.matchName,
          total: index + 1,
          correct,
          accuracy: correct / (index + 1),
          scorelineCorrect,
          scorelineAccuracy: scorelineCorrect / (index + 1),
          handicapCorrect,
          handicapTotal,
          handicapAccuracy: handicapTotal ? handicapCorrect / handicapTotal : 0,
        }
      })

      return {
        providerId: provider.id,
        providerName: provider.name,
        model: provider.model,
        total: providerPredictions.length,
        correct,
        scorelineCorrect,
        handicapCorrect,
        handicapTotal,
        accuracy: providerPredictions.length ? correct / providerPredictions.length : 0,
        scorelineAccuracy: providerPredictions.length
          ? scorelineCorrect / providerPredictions.length
          : 0,
        handicapAccuracy: handicapTotal ? handicapCorrect / handicapTotal : 0,
        predictions: providerPredictions,
        trend,
      }
    })

    res.json({
      finishedMatches: finishedMatches.length,
      evaluatedPredictions: providers.reduce((sum, provider) => sum + provider.total, 0),
      providers,
    })
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

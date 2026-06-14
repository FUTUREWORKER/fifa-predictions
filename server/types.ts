export type DataSourceConfig = {
  type: 'generic-json' | 'worldcup26' | 'csv' | 'sporttery-500'
  url?: string
  localFile?: string
  timeoutMs?: number
}

export type ModelProvider = {
  id: string
  name: string
  kind: 'openai-compatible'
  enabled: boolean
  baseURL: string
  apiKey: string
  model: string
}

export type AppConfig = {
  schedule: DataSourceConfig
  odds: DataSourceConfig
  providers: ModelProvider[]
}

export type Match = {
  id: string
  date: string
  stage: string
  group?: string
  homeTeam: string
  awayTeam: string
  homeScore?: number
  awayScore?: number
  matchday?: string
  venue?: string
  city?: string
  status: 'scheduled' | 'live' | 'finished'
}

export type Odds = {
  matchId: string
  homeTeam?: string
  awayTeam?: string
  matchTime?: string
  market: string
  homeWin?: number
  draw?: number
  awayWin?: number
  handicap?: string
  handicapHome?: number
  handicapDraw?: number
  handicapAway?: number
  updatedAt?: string
  source?: string
  cached?: boolean
}

export type Prediction = {
  matchId: string
  providerId: string
  providerName: string
  model: string
  predictedResult: 'home' | 'draw' | 'away'
  handicapPredictedResult?: 'home' | 'draw' | 'away'
  standardProbabilities?: {
    home: number
    draw: number
    away: number
  }
  handicapProbabilities?: {
    home: number
    draw: number
    away: number
  }
  calibratedProbabilities?: {
    home: number
    draw: number
    away: number
  }
  calibratedHandicapProbabilities?: {
    home: number
    draw: number
    away: number
  }
  scorelineProbabilities?: {
    scoreline: string
    probability: number
  }[]
  scoreline: string
  confidence: number
  handicapConfidence?: number
  keyFactors: string[]
  riskNotes: string[]
  handicapKeyFactors?: string[]
  handicapRiskNotes?: string[]
  contrarianNotes?: string[]
  calibrationNotes?: string[]
  errorTags?: string[]
  webContext: {
    title: string
    url: string
    snippet: string
  }[]
  rawText: string
  createdAt: string
}

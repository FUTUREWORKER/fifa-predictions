import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Goal,
  Languages,
  Loader2,
  RadioTower,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import './App.css'

type Odds = {
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
}

type Match = {
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
  odds: Odds | null
}

type ProviderStatus = {
  id: string
  name: string
  enabled: boolean
  baseURL: string
  model: string
  hasApiKey: boolean
}

type ConfigStatus = {
  schedule: { url?: string; localFile?: string }
  odds: { url?: string; localFile?: string }
  providers: ProviderStatus[]
}

type Prediction = {
  matchId: string
  providerId: string
  providerName: string
  model: string
  predictedResult: 'home' | 'draw' | 'away'
  handicapPredictedResult?: 'home' | 'draw' | 'away'
  standardProbabilities?: ResultProbabilities
  handicapProbabilities?: ResultProbabilities
  calibratedProbabilities?: ResultProbabilities
  calibratedHandicapProbabilities?: ResultProbabilities
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
  createdAt: string
}

type Language = 'zh' | 'en'
type PageView = 'matches' | 'performance'
type ResultKey = 'home' | 'draw' | 'away'
type ResultProbabilities = Record<ResultKey, number>

type PerformancePrediction = {
  matchId: string
  matchDate: string
  matchName: string
  actualResult: Prediction['predictedResult']
  actualScoreline: string
  actualHandicapResult?: Prediction['predictedResult'] | null
  handicap?: string
  predictedResult: Prediction['predictedResult']
  handicapPredictedResult?: Prediction['predictedResult']
  predictedScoreline: string
  correct: boolean
  handicapCorrect: boolean
  handicapEvaluable: boolean
  scorelineCorrect: boolean
  confidence: number
  scoreline: string
  createdAt: string
}

type PerformanceTrendPoint = {
  matchId: string
  matchDate: string
  matchName: string
  total: number
  correct: number
  accuracy: number
  scorelineCorrect: number
  scorelineAccuracy: number
  handicapCorrect: number
  handicapTotal: number
  handicapAccuracy: number
}

type ProviderPerformance = {
  providerId: string
  providerName: string
  model: string
  total: number
  correct: number
  scorelineCorrect: number
  handicapCorrect: number
  handicapTotal: number
  accuracy: number
  scorelineAccuracy: number
  handicapAccuracy: number
  predictions: PerformancePrediction[]
  trend: PerformanceTrendPoint[]
}

type PerformanceSummary = {
  finishedMatches: number
  evaluatedPredictions: number
  providers: ProviderPerformance[]
}

const copy = {
  zh: {
    eyebrow: 'FIFA World Cup 2026 Prediction Desk',
    title: '世界杯赛果AI预测',
    subtitle: '聚合赛程、竞彩盘口与多模型推理，给每一场比赛生成可复核的赛果判断。',
    dataStatus: '数据状态',
    fixturesCount: '场赛程',
    refresh: '刷新数据',
    scheduleSource: '赛程源',
    oddsSource: '盘口源',
    notConfigured: '未配置',
    noLiveOdds: '未配置实时盘口',
    liveOdds: '实时',
    cachedOdds: '缓存',
    visibleOdds: '页面可用',
    matchesUnit: '场',
    matchesPage: '比赛预测',
    performancePage: '模型表现',
    matchList: '比赛列表',
    loadingMatches: '加载赛程中',
    groupSuffix: '组',
    hasOdds: '有盘口',
    homeMark: '[主]',
    single: '单',
    pass: '过',
    marketNotOpen: '未开盘',
    homeWin: '主胜',
    draw: '平',
    homeLoss: '主负',
    oddsFrom: '盘口来源',
    publicPage: '公开页面',
    updatedAt: '更新时间',
    justNow: '刚刚',
    noOdds: '当前比赛暂未匹配到公开盘口',
    modelPrediction: '模型预测',
    ensemblePrediction: '综合预测',
    calibratedProbability: '校准概率',
    standardPrediction: '标准盘',
    handicapPrediction: '让球盘',
    topScores: '比分概率',
    contrarianReview: '反方审查',
    calibrationReview: '校准说明',
    pendingConfig: '待配置',
    predicting: '预测中',
    startPrediction: '开始预测',
    detailAnalysis: '详细分析',
    webContext: '联网搜索参考',
    emptyTitle: '选择模型后生成赛果预测',
    emptyText: '点击上方按钮后，系统会结合实时赛程、公开盘口和比赛背景生成预测结论。',
    generatedFallback: '模型已生成预测结论。',
    timePending: '时间待定',
    dataRequestFailed: '数据接口请求失败',
    loadFailed: '加载失败',
    cacheReadFailed: '缓存读取失败',
    predictFailed: '预测失败',
    modelPredictFailed: '模型预测失败',
    performanceTitle: '模型预测表现',
    performanceSubtitle: '基于已完赛比分回测预测缓存，比较每个模型的历史命中率。',
    evaluatedPredictions: '已评估预测',
    finishedForReview: '可回测完赛',
    accuracyTrend: '命中率走势',
    handicapAccuracyTrend: '让球命中率走势',
    scorelineAccuracyTrend: '比分命中率走势',
    latestAccuracy: '当前命中率',
    latestHandicapAccuracy: '当前让球命中率',
    latestScorelineAccuracy: '当前比分命中率',
    correctCount: '命中',
    handicapCorrectCount: '让球命中',
    scorelineCorrectCount: '比分命中',
    predictionHistory: '预测历史',
    noPerformance: '暂无可评估的预测历史。先对已完赛或即将完赛的比赛生成预测，完赛后这里会自动统计。',
    actual: '赛果',
    actualHandicap: '让球赛果',
    actualScore: '实际比分',
    predicted: '预测',
    handicap: '让球',
    predictedScore: '预测比分',
    correct: '正确',
    missed: '未中',
    status: {
      scheduled: '未开赛',
      live: '进行中',
      finished: '已完赛',
    },
    result: {
      home: '主胜',
      draw: '平局',
      away: '客胜',
    },
  },
  en: {
    eyebrow: 'FIFA World Cup 2026 Prediction Desk',
    title: 'World Cup AI Predictions',
    subtitle: 'Combine fixtures, public odds, and multi-model reasoning into reviewable match predictions.',
    dataStatus: 'Data status',
    fixturesCount: 'fixtures',
    refresh: 'Refresh data',
    scheduleSource: 'Fixture source',
    oddsSource: 'Odds source',
    notConfigured: 'Not configured',
    noLiveOdds: 'No live odds configured',
    liveOdds: 'live',
    cachedOdds: 'cached',
    visibleOdds: 'visible',
    matchesUnit: 'matches',
    matchesPage: 'Match Desk',
    performancePage: 'Performance',
    matchList: 'Matches',
    loadingMatches: 'Loading fixtures',
    groupSuffix: 'Group',
    hasOdds: 'odds',
    homeMark: '[Home]',
    single: '1X2',
    pass: 'FT',
    marketNotOpen: 'Not open',
    homeWin: 'Home',
    draw: 'Draw',
    homeLoss: 'Away',
    oddsFrom: 'Odds source',
    publicPage: 'public page',
    updatedAt: 'Updated',
    justNow: 'just now',
    noOdds: 'No public odds matched for this match yet',
    modelPrediction: 'Model Predictions',
    ensemblePrediction: 'Consensus',
    calibratedProbability: 'Calibrated probability',
    standardPrediction: '1X2',
    handicapPrediction: 'Handicap',
    topScores: 'Score probabilities',
    contrarianReview: 'Contrarian Review',
    calibrationReview: 'Calibration Notes',
    pendingConfig: 'Not configured',
    predicting: 'Predicting',
    startPrediction: 'Start Prediction',
    detailAnalysis: 'Analysis',
    webContext: 'Web Search Context',
    emptyTitle: 'Generate match predictions after selecting models',
    emptyText: 'Click the button above to combine live fixtures, public odds, and match context into AI predictions.',
    generatedFallback: 'The model has generated a prediction.',
    timePending: 'Time TBD',
    dataRequestFailed: 'Data API request failed',
    loadFailed: 'Load failed',
    cacheReadFailed: 'Cache read failed',
    predictFailed: 'Prediction failed',
    modelPredictFailed: 'Model prediction failed',
    performanceTitle: 'Model Performance',
    performanceSubtitle: 'Backtest cached predictions against finished match results and compare model accuracy.',
    evaluatedPredictions: 'evaluated predictions',
    finishedForReview: 'finished matches',
    accuracyTrend: 'Accuracy Trend',
    handicapAccuracyTrend: 'Handicap Accuracy Trend',
    scorelineAccuracyTrend: 'Scoreline Accuracy Trend',
    latestAccuracy: 'Current accuracy',
    latestHandicapAccuracy: 'Current handicap accuracy',
    latestScorelineAccuracy: 'Current scoreline accuracy',
    correctCount: 'correct',
    handicapCorrectCount: 'handicap correct',
    scorelineCorrectCount: 'scoreline correct',
    predictionHistory: 'Prediction History',
    noPerformance: 'No evaluated prediction history yet. Generate predictions first; finished matches will be scored here automatically.',
    actual: 'Actual',
    actualHandicap: 'Handicap actual',
    actualScore: 'Actual score',
    predicted: 'Predicted',
    handicap: 'Handicap',
    predictedScore: 'Predicted score',
    correct: 'Correct',
    missed: 'Missed',
    status: {
      scheduled: 'Scheduled',
      live: 'Live',
      finished: 'Finished',
    },
    result: {
      home: 'Home win',
      draw: 'Draw',
      away: 'Away win',
    },
  },
} as const

const teamNamesEn: Record<string, string> = {
  阿尔及利亚: 'Algeria',
  阿根廷: 'Argentina',
  澳大利亚: 'Australia',
  奥地利: 'Austria',
  比利时: 'Belgium',
  波黑: 'Bosnia and Herzegovina',
  巴西: 'Brazil',
  加拿大: 'Canada',
  佛得角: 'Cape Verde',
  哥伦比亚: 'Colombia',
  刚果民主共和国: 'DR Congo',
  克罗地亚: 'Croatia',
  库拉索: 'Curacao',
  捷克: 'Czechia',
  厄瓜多尔: 'Ecuador',
  埃及: 'Egypt',
  英格兰: 'England',
  法国: 'France',
  德国: 'Germany',
  加纳: 'Ghana',
  海地: 'Haiti',
  伊朗: 'Iran',
  伊拉克: 'Iraq',
  科特迪瓦: 'Ivory Coast',
  日本: 'Japan',
  约旦: 'Jordan',
  墨西哥: 'Mexico',
  摩洛哥: 'Morocco',
  荷兰: 'Netherlands',
  新西兰: 'New Zealand',
  挪威: 'Norway',
  巴拿马: 'Panama',
  巴拉圭: 'Paraguay',
  葡萄牙: 'Portugal',
  卡塔尔: 'Qatar',
  沙特阿拉伯: 'Saudi Arabia',
  苏格兰: 'Scotland',
  塞内加尔: 'Senegal',
  南非: 'South Africa',
  韩国: 'South Korea',
  西班牙: 'Spain',
  瑞典: 'Sweden',
  瑞士: 'Switzerland',
  突尼斯: 'Tunisia',
  土耳其: 'Turkey',
  乌拉圭: 'Uruguay',
  美国: 'United States',
  乌兹别克斯坦: 'Uzbekistan',
}

const stageNamesEn: Record<string, string> = {
  小组赛: 'Group Stage',
  '1/16决赛': 'Round of 32',
  '1/8决赛': 'Round of 16',
  四分之一决赛: 'Quarter-finals',
  半决赛: 'Semi-finals',
  季军赛: 'Third-place Match',
  决赛: 'Final',
}

const flagCodes: Record<string, string> = {
  阿尔及利亚: 'dz',
  阿根廷: 'ar',
  澳大利亚: 'au',
  奥地利: 'at',
  比利时: 'be',
  波黑: 'ba',
  巴西: 'br',
  加拿大: 'ca',
  佛得角: 'cv',
  哥伦比亚: 'co',
  刚果民主共和国: 'cd',
  克罗地亚: 'hr',
  库拉索: 'cw',
  捷克: 'cz',
  厄瓜多尔: 'ec',
  埃及: 'eg',
  英格兰: 'gb-eng',
  法国: 'fr',
  德国: 'de',
  加纳: 'gh',
  海地: 'ht',
  伊朗: 'ir',
  伊拉克: 'iq',
  科特迪瓦: 'ci',
  日本: 'jp',
  约旦: 'jo',
  墨西哥: 'mx',
  摩洛哥: 'ma',
  荷兰: 'nl',
  新西兰: 'nz',
  挪威: 'no',
  巴拿马: 'pa',
  巴拉圭: 'py',
  葡萄牙: 'pt',
  卡塔尔: 'qa',
  沙特阿拉伯: 'sa',
  苏格兰: 'gb-sct',
  塞内加尔: 'sn',
  南非: 'za',
  韩国: 'kr',
  西班牙: 'es',
  瑞典: 'se',
  瑞士: 'ch',
  突尼斯: 'tn',
  土耳其: 'tr',
  乌拉圭: 'uy',
  美国: 'us',
  乌兹别克斯坦: 'uz',
}

const modelLogoUrls: Record<string, string> = {
  deepseek: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/deepseek-color.svg',
  qwen: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/qwen-color.svg',
  gpt: 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/openai.svg',
}

function formatDate(value: string, language: Language, timePending: string) {
  if (!value) return timePending
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatOdds(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '--'
}

function hasStandardOdds(match?: Match) {
  return Boolean(
    match?.odds &&
      typeof match.odds.homeWin === 'number' &&
      typeof match.odds.draw === 'number' &&
      typeof match.odds.awayWin === 'number',
  )
}

function sortMatchesByTime(matches: Match[]) {
  return [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
}

function scoreText(match: Match) {
  if (match.status === 'scheduled') return ''
  return `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`
}

function displayTeamName(team: string, language: Language) {
  return language === 'en' ? teamNamesEn[team] ?? team : team
}

function displayStage(stage: string, language: Language) {
  return language === 'en' ? stageNamesEn[stage] ?? stage : stage
}

function displayGroup(group: string | undefined, language: Language) {
  if (!group) return ''
  return language === 'en' ? `Group ${group}` : `${group}组`
}

function displayOddsSource(source: string | undefined, language: Language, fallback: string) {
  if (!source) return fallback
  if (language === 'en' && source.includes('500彩票网')) {
    return '500.com public football odds page'
  }
  return source
}

function TeamFlag({ team, size = 'large' }: { team: string; size?: 'large' | 'small' }) {
  const code = flagCodes[team]
  return (
    <span className={`team-flag ${size}`} aria-hidden="true">
      {code === 'ch' ? (
        <span className="swiss-cross" />
      ) : code ? (
        <img src={`https://flagcdn.com/w80/${code}.png`} alt="" loading="lazy" />
      ) : (
        team.slice(0, 1)
      )}
    </span>
  )
}

function ModelLogo({ provider }: { provider: Pick<ProviderStatus, 'id' | 'name'> }) {
  const label =
    provider.id === 'deepseek' ? 'DS' : provider.id === 'qwen' ? 'QW' : 'GPT'
  return (
    <span className={`model-logo ${provider.id}`} title={provider.name}>
      {modelLogoUrls[provider.id] ? (
        <img src={modelLogoUrls[provider.id]} alt="" loading="lazy" />
      ) : (
        label
      )}
    </span>
  )
}

function formatPercent(value?: number) {
  return `${Math.round((value ?? 0) * 100)}%`
}

function resultFromProbabilities(probabilities: ResultProbabilities): ResultKey {
  return (Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    'draw') as ResultKey
}

function averageProbabilities(
  predictions: Prediction[],
  field: 'calibratedProbabilities' | 'calibratedHandicapProbabilities',
) {
  const withProbabilities = predictions
    .map((prediction) => prediction[field])
    .filter((item): item is ResultProbabilities => Boolean(item))
  if (!withProbabilities.length) return null
  const average = withProbabilities.reduce(
    (total, item) => ({
      home: total.home + item.home,
      draw: total.draw + item.draw,
      away: total.away + item.away,
    }),
    { home: 0, draw: 0, away: 0 },
  )
  return {
    home: average.home / withProbabilities.length,
    draw: average.draw / withProbabilities.length,
    away: average.away / withProbabilities.length,
  }
}

const performanceColors = ['#34d399', '#8b5cf6', '#f8fafc', '#ffd66b', '#38bdf8']

function AccuracyTrendChart({
  providers,
  language,
  metric,
}: {
  providers: ProviderPerformance[]
  language: Language
  metric: 'accuracy' | 'handicapAccuracy' | 'scorelineAccuracy'
}) {
  const width = 860
  const height = 260
  const padding = { top: 24, right: 28, bottom: 40, left: 46 }
  const maxPoints = Math.max(1, ...providers.map((provider) => provider.trend.length))
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const xFor = (index: number) =>
    padding.left + (maxPoints <= 1 ? plotWidth / 2 : (index / (maxPoints - 1)) * plotWidth)
  const yFor = (accuracy: number) => padding.top + (1 - accuracy) * plotHeight

  return (
    <svg className="accuracy-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
        <g key={tick}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={yFor(tick)}
            y2={yFor(tick)}
          />
          <text x={12} y={yFor(tick) + 4}>
            {Math.round(tick * 100)}%
          </text>
        </g>
      ))}
      {providers.map((provider, providerIndex) => {
        const color = performanceColors[providerIndex % performanceColors.length]
        const points = provider.trend.map((point, index) => ({
          x: xFor(index),
          y: yFor(point[metric]),
          label: `${provider.providerName} ${Math.round(point[metric] * 100)}%`,
        }))
        const path = points
          .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
          .join(' ')
        return (
          <g key={provider.providerId} style={{ color }}>
            {path ? <path d={path} stroke={color} /> : null}
            {points.map((point, index) => (
              <circle key={`${provider.providerId}:${index}`} cx={point.x} cy={point.y} r="4">
                <title>{point.label}</title>
              </circle>
            ))}
          </g>
        )
      })}
      <text className="chart-axis-label" x={width / 2} y={height - 8}>
        {language === 'zh' ? '按完赛时间累计' : 'Cumulative by finished match time'}
      </text>
    </svg>
  )
}

function PerformanceView({
  summary,
  loading,
  language,
  ui,
}: {
  summary: PerformanceSummary | null
  loading: boolean
  language: Language
  ui: (typeof copy)[Language]
}) {
  const providers = summary?.providers ?? []
  const rankedProviders = [...providers].sort((a, b) => b.accuracy - a.accuracy)
  const providerById = new Map(providers.map((provider) => [provider.providerId, provider]))
  const history = providers
    .flatMap((provider) =>
      provider.predictions.map((prediction) => ({
        ...prediction,
        providerId: provider.providerId,
        providerName: provider.providerName,
      })),
    )
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime())

  if (loading) {
    return (
      <section className="performance-board">
        <div className="loading">
          <Loader2 className="spin" size={20} />
          {ui.loadingMatches}
        </div>
      </section>
    )
  }

  return (
    <section className="performance-board">
      <div className="performance-head">
        <div>
          <div className="panel-title">
            <TrendingUp size={18} />
            {ui.performanceTitle}
          </div>
          <p>{ui.performanceSubtitle}</p>
        </div>
        <div className="performance-stats">
          <div>
            <strong>{summary?.finishedMatches ?? 0}</strong>
            <span>{ui.finishedForReview}</span>
          </div>
          <div>
            <strong>{summary?.evaluatedPredictions ?? 0}</strong>
            <span>{ui.evaluatedPredictions}</span>
          </div>
        </div>
      </div>

      {summary?.evaluatedPredictions ? (
        <>
          <div className="performance-cards">
            {rankedProviders.map((provider) => (
              <article className="performance-card" key={provider.providerId}>
                <div className="performance-card-head">
                  <ModelLogo provider={{ id: provider.providerId, name: provider.providerName }} />
                  <div>
                    <strong>{provider.providerName}</strong>
                    <span>{provider.model}</span>
                  </div>
                  <b>{Math.round(provider.accuracy * 100)}%</b>
                </div>
                <div className="metric-row">
                  <span>{ui.latestAccuracy}</span>
                  <strong>{Math.round(provider.accuracy * 100)}%</strong>
                </div>
                <div className="metric-row">
                  <span>{ui.latestHandicapAccuracy}</span>
                  <strong>{Math.round(provider.handicapAccuracy * 100)}%</strong>
                </div>
                <div className="metric-row">
                  <span>{ui.latestScorelineAccuracy}</span>
                  <strong>{Math.round(provider.scorelineAccuracy * 100)}%</strong>
                </div>
                <div className="metric-row">
                  <span>{ui.correctCount}</span>
                  <strong>
                    {provider.correct}/{provider.total}
                  </strong>
                </div>
                <div className="metric-row">
                  <span>{ui.handicapCorrectCount}</span>
                  <strong>
                    {provider.handicapCorrect}/{provider.handicapTotal}
                  </strong>
                </div>
                <div className="metric-row">
                  <span>{ui.scorelineCorrectCount}</span>
                  <strong>
                    {provider.scorelineCorrect}/{provider.total}
                  </strong>
                </div>
              </article>
            ))}
          </div>

          <div className="trend-panel">
            <div className="panel-title">
              <TrendingUp size={18} />
              {ui.accuracyTrend}
            </div>
            <AccuracyTrendChart
              providers={rankedProviders}
              language={language}
              metric="accuracy"
            />
            <div className="chart-legend">
              {rankedProviders.map((provider, index) => (
                <span key={provider.providerId}>
                  <i style={{ background: performanceColors[index % performanceColors.length] }} />
                  {provider.providerName}
                </span>
              ))}
            </div>
          </div>

          <div className="trend-panel">
            <div className="panel-title">
              <TrendingUp size={18} />
              {ui.scorelineAccuracyTrend}
            </div>
            <AccuracyTrendChart
              providers={rankedProviders}
              language={language}
              metric="scorelineAccuracy"
            />
            <div className="chart-legend">
              {rankedProviders.map((provider, index) => (
                <span key={provider.providerId}>
                  <i style={{ background: performanceColors[index % performanceColors.length] }} />
                  {provider.providerName}
                </span>
              ))}
            </div>
          </div>

          <div className="trend-panel">
            <div className="panel-title">
              <TrendingUp size={18} />
              {ui.handicapAccuracyTrend}
            </div>
            <AccuracyTrendChart
              providers={rankedProviders}
              language={language}
              metric="handicapAccuracy"
            />
            <div className="chart-legend">
              {rankedProviders.map((provider, index) => (
                <span key={provider.providerId}>
                  <i style={{ background: performanceColors[index % performanceColors.length] }} />
                  {provider.providerName}
                </span>
              ))}
            </div>
          </div>

          <div className="history-panel">
            <div className="panel-title">{ui.predictionHistory}</div>
            <div className="history-list">
              {history.map((item) => {
                const provider = providerById.get(item.providerId)
                return (
                  <div className="history-row" key={`${item.matchId}:${item.providerId}`}>
                    <ModelLogo
                      provider={{
                        id: item.providerId,
                        name: item.providerName,
                      }}
                    />
                    <div>
                      <strong>{item.matchName}</strong>
                      <span>{formatDate(item.matchDate, language, ui.timePending)}</span>
                    </div>
                    <div>
                      <span>{ui.predicted}</span>
                      <strong>{ui.result[item.predictedResult]}</strong>
                    </div>
                    <div>
                      <span>{ui.actual}</span>
                      <strong>{ui.result[item.actualResult]}</strong>
                    </div>
                    <div>
                      <span>{ui.predictedScore}</span>
                      <strong>{item.predictedScoreline || item.scoreline}</strong>
                    </div>
                    <div>
                      <span>{ui.actualScore}</span>
                      <strong>{item.actualScoreline}</strong>
                    </div>
                    <div>
                      <span>
                        {ui.handicap}
                        {item.handicap ? ` ${item.handicap}` : ''}
                      </span>
                      <strong>
                        {item.handicapPredictedResult
                          ? ui.result[item.handicapPredictedResult]
                          : '--'}
                      </strong>
                    </div>
                    <div>
                      <span>{ui.actualHandicap}</span>
                      <strong>
                        {item.actualHandicapResult
                          ? ui.result[item.actualHandicapResult]
                          : '--'}
                      </strong>
                    </div>
                    <b className={item.correct ? 'hit' : 'miss'}>
                      {item.correct ? ui.correct : ui.missed}
                    </b>
                    <small>{provider?.providerName ?? item.providerName}</small>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-prediction">
          <TrendingUp size={28} />
          <h3>{ui.performanceTitle}</h3>
          <p>{ui.noPerformance}</p>
        </div>
      )}
    </section>
  )
}

function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = window.localStorage.getItem('fifa-predictions-language')
    return saved === 'en' || saved === 'zh' ? saved : 'zh'
  })
  const [matches, setMatches] = useState<Match[]>([])
  const [config, setConfig] = useState<ConfigStatus | null>(null)
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({})
  const [activeAnalysisProviderId, setActiveAnalysisProviderId] = useState('')
  const [view, setView] = useState<PageView>('matches')
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null)
  const [oddsStats, setOddsStats] = useState({ live: 0, cached: 0 })
  const [loading, setLoading] = useState(true)
  const [performanceLoading, setPerformanceLoading] = useState(false)
  const [predicting, setPredicting] = useState(false)
  const [error, setError] = useState('')
  const ui = copy[language]

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? matches[0],
    [matches, selectedMatchId],
  )

  const oddsCount = useMemo(
    () => matches.filter((match) => Boolean(match.odds)).length,
    [matches],
  )

  const enabledProviders = useMemo(
    () =>
      config?.providers.filter(
        (provider) => provider.enabled && provider.hasApiKey,
      ) ?? [],
    [config],
  )

  const selectedPredictions = useMemo(
    () =>
      selectedMatch
        ? enabledProviders
            .map((provider) => predictions[`${selectedMatch.id}:${provider.id}`])
            .filter(Boolean)
        : [],
    [enabledProviders, predictions, selectedMatch],
  )

  const activeAnalysis =
    selectedPredictions.find(
      (prediction) => prediction.providerId === activeAnalysisProviderId,
    ) ?? selectedPredictions[0]

  const ensembleStandardProbabilities = useMemo(
    () => averageProbabilities(selectedPredictions, 'calibratedProbabilities'),
    [selectedPredictions],
  )

  const ensembleHandicapProbabilities = useMemo(
    () => averageProbabilities(selectedPredictions, 'calibratedHandicapProbabilities'),
    [selectedPredictions],
  )

  function predictionsForResult(result: Prediction['predictedResult']) {
    return selectedPredictions.filter(
      (prediction) => prediction.predictedResult === result,
    )
  }

  function predictionsForHandicapResult(result: Prediction['predictedResult']) {
    return selectedPredictions.filter(
      (prediction) => prediction.handicapPredictedResult === result,
    )
  }

  const standardMarketNotOpen = Boolean(selectedMatch?.odds && !hasStandardOdds(selectedMatch))

  function providerForPrediction(prediction: Prediction) {
    return (
      config?.providers.find((provider) => provider.id === prediction.providerId) ?? {
        id: prediction.providerId,
        name: prediction.providerName,
      }
    )
  }

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [matchesRes, configRes] = await Promise.all([
        fetch('/api/matches'),
        fetch('/api/config/status'),
      ])
      if (!matchesRes.ok || !configRes.ok) throw new Error(ui.dataRequestFailed)
      const matchesPayload = await matchesRes.json()
      const configPayload = await configRes.json()
      const sortedMatches = sortMatchesByTime(matchesPayload.matches)
      const defaultMatch =
        sortedMatches.find((match: Match) => hasStandardOdds(match)) ??
        sortedMatches.find((match: Match) => match.odds) ??
        sortedMatches[0]
      setMatches(sortedMatches)
      setConfig(configPayload)
      setOddsStats({
        live: matchesPayload.oddsLiveCount ?? 0,
        cached: matchesPayload.oddsCachedCount ?? 0,
      })
      setSelectedMatchId((current) => {
        const currentMatch = sortedMatches.find(
          (match: Match) => match.id === current,
        )
        if (!current || !hasStandardOdds(currentMatch)) return defaultMatch?.id || ''
        return current
      })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : ui.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [ui.dataRequestFailed, ui.loadFailed])

  const loadPerformance = useCallback(async () => {
    setPerformanceLoading(true)
    setError('')
    try {
      const res = await fetch('/api/analytics/model-performance')
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error ?? ui.loadFailed)
      setPerformance(payload as PerformanceSummary)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : ui.loadFailed)
    } finally {
      setPerformanceLoading(false)
    }
  }, [ui.loadFailed])

  async function runPrediction() {
    if (!selectedMatch || enabledProviders.length === 0) return
    setPredicting(true)
    setError('')
    try {
      const results = await Promise.allSettled(
        enabledProviders.map(async (provider) => {
          const res = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matchId: selectedMatch.id,
              providerId: provider.id,
              force: true,
            }),
          })
          const payload = await res.json()
          if (!res.ok) throw new Error(`${provider.name}: ${payload.error ?? ui.predictFailed}`)
          return payload as Prediction
        }),
      )

      const fulfilled = results
        .filter((result): result is PromiseFulfilledResult<Prediction> => result.status === 'fulfilled')
        .map((result) => result.value)
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      )

      setPredictions((current) => ({
        ...current,
        ...Object.fromEntries(
          fulfilled.map((prediction) => [
            `${prediction.matchId}:${prediction.providerId}`,
            prediction,
          ]),
        ),
      }))
      setActiveAnalysisProviderId(fulfilled[0]?.providerId ?? '')
      void loadPerformance()
      if (rejected.length) {
        setError(
          rejected
            .map((result) =>
              result.reason instanceof Error ? result.reason.message : ui.modelPredictFailed,
            )
            .join('；'),
        )
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : ui.predictFailed)
    } finally {
      setPredicting(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard()
      void loadPerformance()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadDashboard, loadPerformance])

  useEffect(() => {
    window.localStorage.setItem('fifa-predictions-language', language)
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
  }, [language])

  useEffect(() => {
    if (!selectedMatch?.id) return
    const controller = new AbortController()
    fetch(`/api/predictions/${selectedMatch.id}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(ui.cacheReadFailed))))
      .then((payload: { predictions: Prediction[] }) => {
        if (!payload.predictions?.length) {
          setActiveAnalysisProviderId('')
          return
        }
        setPredictions((current) => ({
          ...current,
          ...Object.fromEntries(
            payload.predictions.map((prediction) => [
              `${prediction.matchId}:${prediction.providerId}`,
              prediction,
            ]),
          ),
        }))
        setActiveAnalysisProviderId((current) => current || payload.predictions[0].providerId)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [selectedMatch?.id, ui.cacheReadFailed])

  return (
    <main className="app-shell">
      <section className="stadium-hero">
        <div className="pitch-lines" />
        <div className="language-switch" aria-label="Language switch">
          <Languages size={16} />
          <button
            type="button"
            className={language === 'zh' ? 'active' : ''}
            onClick={() => setLanguage('zh')}
          >
            中文
          </button>
          <span>/</span>
          <button
            type="button"
            className={language === 'en' ? 'active' : ''}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
        </div>
        <div className="hero-copy">
          <div className="eyebrow">
            <Trophy size={18} />
            {ui.eyebrow}
          </div>
          <h1>{ui.title}</h1>
          <p>{ui.subtitle}</p>
        </div>
        <div className="hero-scoreboard" aria-label={ui.dataStatus}>
          <div>
            <span>{matches.length || '--'}</span>
            <small>{ui.fixturesCount}</small>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadDashboard()
              void loadPerformance()
            }}
            title={ui.refresh}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      <section className="control-strip">
        <div className="view-switch">
          <button
            type="button"
            className={view === 'matches' ? 'active' : ''}
            onClick={() => setView('matches')}
          >
            {ui.matchesPage}
          </button>
          <button
            type="button"
            className={view === 'performance' ? 'active' : ''}
            onClick={() => setView('performance')}
          >
            {ui.performancePage}
          </button>
        </div>
        <div className="status-pill">
          <RadioTower size={16} />
          {ui.scheduleSource}: {config?.schedule.url || config?.schedule.localFile || ui.notConfigured}
        </div>
        <div className="status-pill">
          <CircleDollarSign size={16} />
          {ui.oddsSource}: {config?.odds.url || ui.noLiveOdds} · {ui.liveOdds}{' '}
          {oddsStats.live} {ui.matchesUnit} · {ui.cachedOdds} {oddsStats.cached}{' '}
          {ui.matchesUnit} · {ui.visibleOdds} {oddsCount} {ui.matchesUnit}
        </div>
      </section>

      {view === 'performance' ? (
        <section className="workspace performance-workspace">
          <PerformanceView
            summary={performance}
            loading={performanceLoading}
            language={language}
            ui={ui}
          />
        </section>
      ) : (
      <section className="workspace">
        <aside className="match-rail">
          <div className="panel-title">
            <CalendarDays size={18} />
            {ui.matchList}
          </div>
          {loading ? (
            <div className="loading">
              <Loader2 className="spin" size={20} />
              {ui.loadingMatches}
            </div>
          ) : (
            <div className="match-list">
              {matches.map((match) => (
                <button
                  key={match.id}
                  className={match.id === selectedMatch?.id ? 'match active' : 'match'}
                  type="button"
                  onClick={() => setSelectedMatchId(match.id)}
                >
                  <span className="match-date">{formatDate(match.date, language, ui.timePending)}</span>
                  <span className="match-line">
                    <strong>
                      {displayTeamName(match.homeTeam, language)} <b>vs</b>{' '}
                      {displayTeamName(match.awayTeam, language)}
                    </strong>
                    {match.status === 'finished' ? (
                      <span className="score-pill">{scoreText(match)}</span>
                    ) : null}
                  </span>
                  <small>
                    <span className={`status-badge ${match.status}`}>
                      {ui.status[match.status]}
                    </span>
                    {displayStage(match.stage, language)}
                    {displayGroup(match.group, language)
                      ? ` · ${displayGroup(match.group, language)}`
                      : ''}{' '}
                    · {match.city}
                    {match.odds ? ` · ${ui.hasOdds}` : ''}
                  </small>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="analysis-board">
          {selectedMatch && (
            <>
              <div className="match-card">
                <div>
                  <div className="tag-row">
                    <span className="tag">{displayStage(selectedMatch.stage, language)}</span>
                    <span className={`detail-status ${selectedMatch.status}`}>
                      {ui.status[selectedMatch.status]}
                    </span>
                  </div>
                  <h2>
                    <span className="team-name home">
                      <TeamFlag team={selectedMatch.homeTeam} />
                      {displayTeamName(selectedMatch.homeTeam, language)}
                    </span>
                    <span>
                      {selectedMatch.status === 'scheduled'
                        ? 'vs'
                        : `${selectedMatch.homeScore ?? 0} - ${
                            selectedMatch.awayScore ?? 0
                          }`}
                    </span>
                    <span className="team-name away">
                      {displayTeamName(selectedMatch.awayTeam, language)}
                      <TeamFlag team={selectedMatch.awayTeam} />
                    </span>
                  </h2>
                  <p>
                    {formatDate(selectedMatch.date, language, ui.timePending)} · {selectedMatch.venue} ·{' '}
                    {selectedMatch.city}
                  </p>
                </div>
                <Goal className="goal-icon" size={52} />
              </div>

              <div className="odds-board">
                <div className="odds-match-title">
                  <span>{ui.homeMark}</span>
                  <strong>
                    <TeamFlag team={selectedMatch.homeTeam} size="small" />
                    {displayTeamName(selectedMatch.homeTeam, language)}
                  </strong>
                  <em>vs</em>
                  <strong>
                    {displayTeamName(selectedMatch.awayTeam, language)}
                    <TeamFlag team={selectedMatch.awayTeam} size="small" />
                  </strong>
                </div>
                <div className="odds-row">
                  <div className="handicap-badge neutral">-</div>
                  <div className="odds-labels">
                    <span className="single">{ui.single}</span>
                    <span>{ui.pass}</span>
                  </div>
                  <div className={standardMarketNotOpen ? 'odds-cell unavailable' : 'odds-cell'}>
                    <span>{ui.homeWin}</span>
                    <strong>
                      {standardMarketNotOpen
                        ? ui.marketNotOpen
                        : formatOdds(selectedMatch.odds?.homeWin)}
                    </strong>
                    <div className="prediction-markers">
                      {predictionsForResult('home').map((prediction) => (
                        <ModelLogo
                          key={prediction.providerId}
                          provider={providerForPrediction(prediction)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className={standardMarketNotOpen ? 'odds-cell unavailable' : 'odds-cell'}>
                    <span>{ui.draw}</span>
                    <strong>
                      {standardMarketNotOpen
                        ? ui.marketNotOpen
                        : formatOdds(selectedMatch.odds?.draw)}
                    </strong>
                    <div className="prediction-markers">
                      {predictionsForResult('draw').map((prediction) => (
                        <ModelLogo
                          key={prediction.providerId}
                          provider={providerForPrediction(prediction)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className={standardMarketNotOpen ? 'odds-cell unavailable' : 'odds-cell'}>
                    <span>{ui.homeLoss}</span>
                    <strong>
                      {standardMarketNotOpen
                        ? ui.marketNotOpen
                        : formatOdds(selectedMatch.odds?.awayWin)}
                    </strong>
                    <div className="prediction-markers">
                      {predictionsForResult('away').map((prediction) => (
                        <ModelLogo
                          key={prediction.providerId}
                          provider={providerForPrediction(prediction)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="odds-row">
                  <div
                    className={
                      selectedMatch.odds?.handicap?.startsWith('-')
                        ? 'handicap-badge negative'
                        : 'handicap-badge positive'
                    }
                  >
                    {selectedMatch.odds?.handicap ?? '--'}
                  </div>
                  <div className="odds-labels">
                    <span>-</span>
                    <span>{ui.pass}</span>
                  </div>
                  <div className="odds-cell">
                    <span>{ui.homeWin}</span>
                    <strong>
                      {formatOdds(selectedMatch.odds?.handicapHome)}
                      {selectedMatch.odds?.handicapHome ? <i className="up" /> : null}
                    </strong>
                    <div className="prediction-markers">
                      {predictionsForHandicapResult('home').map((prediction) => (
                        <ModelLogo
                          key={prediction.providerId}
                          provider={providerForPrediction(prediction)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="odds-cell">
                    <span>{ui.draw}</span>
                    <strong>
                      {formatOdds(selectedMatch.odds?.handicapDraw)}
                      {selectedMatch.odds?.handicapDraw ? <i className="down" /> : null}
                    </strong>
                    <div className="prediction-markers">
                      {predictionsForHandicapResult('draw').map((prediction) => (
                        <ModelLogo
                          key={prediction.providerId}
                          provider={providerForPrediction(prediction)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="odds-cell">
                    <span>{ui.homeLoss}</span>
                    <strong>{formatOdds(selectedMatch.odds?.handicapAway)}</strong>
                    <div className="prediction-markers">
                      {predictionsForHandicapResult('away').map((prediction) => (
                        <ModelLogo
                          key={prediction.providerId}
                          provider={providerForPrediction(prediction)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <p className="odds-footnote">
                {selectedMatch.odds
                  ? `${ui.oddsFrom}: ${displayOddsSource(
                      selectedMatch.odds.source,
                      language,
                      ui.publicPage,
                    )} · ${
                      ui.updatedAt
                    }: ${
                      selectedMatch.odds.updatedAt
                        ? formatDate(selectedMatch.odds.updatedAt, language, ui.timePending)
                        : ui.justNow
                    }`
                  : ui.noOdds}
              </p>

              <div className="model-panel">
                <div className="panel-title">
                  <Sparkles size={18} />
                  {ui.modelPrediction}
                </div>
                <div className="provider-row">
                  {config?.providers.map((provider) => (
                    <div
                      key={provider.id}
                      className={
                        provider.enabled && provider.hasApiKey
                          ? 'provider ready'
                          : 'provider'
                      }
                    >
                      <span>{provider.name}</span>
                      <small>
                        {provider.enabled && provider.hasApiKey
                          ? provider.model
                          : ui.pendingConfig}
                      </small>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="predict-button"
                  onClick={runPrediction}
                  disabled={predicting || enabledProviders.length === 0}
                >
                  {predicting ? <Loader2 className="spin" size={18} /> : <Activity size={18} />}
                  {predicting ? ui.predicting : ui.startPrediction}
                </button>
              </div>

              <div className="prediction-card">
                {selectedPredictions.length ? (
                  <>
                    {ensembleStandardProbabilities ? (
                      <div className="ensemble-card">
                        <div className="panel-title">
                          <Activity size={18} />
                          {ui.ensemblePrediction}
                        </div>
                        <div className="ensemble-grid">
                          <div>
                            <span>{ui.standardPrediction}</span>
                            <strong>
                              {ui.result[resultFromProbabilities(ensembleStandardProbabilities)]}
                            </strong>
                            <small>
                              {ui.homeWin} {formatPercent(ensembleStandardProbabilities.home)}
                              {' · '}
                              {ui.draw} {formatPercent(ensembleStandardProbabilities.draw)}
                              {' · '}
                              {ui.homeLoss} {formatPercent(ensembleStandardProbabilities.away)}
                            </small>
                          </div>
                          {ensembleHandicapProbabilities ? (
                            <div>
                              <span>{ui.handicapPrediction}</span>
                              <strong>
                                {ui.result[
                                  resultFromProbabilities(ensembleHandicapProbabilities)
                                ]}
                              </strong>
                              <small>
                                {ui.homeWin} {formatPercent(ensembleHandicapProbabilities.home)}
                                {' · '}
                                {ui.draw} {formatPercent(ensembleHandicapProbabilities.draw)}
                                {' · '}
                                {ui.homeLoss} {formatPercent(ensembleHandicapProbabilities.away)}
                              </small>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    <div className="prediction-grid">
                      {selectedPredictions.map((prediction) => (
                        <button
                          type="button"
                          className={
                            activeAnalysis?.providerId === prediction.providerId
                              ? 'prediction-mini active'
                              : 'prediction-mini'
                          }
                          key={prediction.providerId}
                          onClick={() => setActiveAnalysisProviderId(prediction.providerId)}
                        >
                          <div className="prediction-mini-head">
                            <ModelLogo provider={providerForPrediction(prediction)} />
                            <span>{prediction.providerName}</span>
                            <b>{Math.round(prediction.confidence * 100)}%</b>
                          </div>
                          <h3>
                            {ui.result[prediction.predictedResult]} · {prediction.scoreline}
                          </h3>
                          {prediction.handicapPredictedResult ? (
                            <div className="prediction-mini-market">
                              <span>{ui.standardPrediction}</span>
                              <strong>{ui.result[prediction.predictedResult]}</strong>
                              <span>{ui.handicapPrediction}</span>
                              <strong>{ui.result[prediction.handicapPredictedResult]}</strong>
                            </div>
                          ) : null}
                          {prediction.calibratedProbabilities ? (
                            <div className="probability-row">
                              <span>{ui.calibratedProbability}</span>
                              <b>{ui.homeWin} {formatPercent(prediction.calibratedProbabilities.home)}</b>
                              <b>{ui.draw} {formatPercent(prediction.calibratedProbabilities.draw)}</b>
                              <b>{ui.homeLoss} {formatPercent(prediction.calibratedProbabilities.away)}</b>
                            </div>
                          ) : null}
                          <p>{prediction.keyFactors[0] ?? ui.generatedFallback}</p>
                        </button>
                      ))}
                    </div>
                    {activeAnalysis ? (
                      <div className="analysis-detail">
                        <div className="analysis-detail-head">
                          <ModelLogo provider={providerForPrediction(activeAnalysis)} />
                          <strong>
                            {activeAnalysis.providerName} {ui.detailAnalysis}
                          </strong>
                          <span>{formatDate(activeAnalysis.createdAt, language, ui.timePending)}</span>
                        </div>
                        <div className="factor-list">
                          <h4>{ui.standardPrediction}</h4>
                          {activeAnalysis.keyFactors.map((factor) => (
                            <p key={factor}>{factor}</p>
                          ))}
                          {activeAnalysis.handicapKeyFactors?.length ? (
                            <>
                              <h4>{ui.handicapPrediction}</h4>
                              {activeAnalysis.handicapKeyFactors.map((factor) => (
                                <p key={factor}>{factor}</p>
                              ))}
                            </>
                          ) : null}
                        </div>
                        <div className="risk-notes">
                          {activeAnalysis.riskNotes.map((note) => (
                            <span key={note}>{note}</span>
                          ))}
                          {activeAnalysis.handicapRiskNotes?.map((note) => (
                            <span key={note}>{note}</span>
                          ))}
                        </div>
                        {activeAnalysis.scorelineProbabilities?.length ? (
                          <div className="probability-panel">
                            <h4>{ui.topScores}</h4>
                            {activeAnalysis.scorelineProbabilities.map((item) => (
                              <span key={item.scoreline}>
                                {item.scoreline} · {formatPercent(item.probability)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {activeAnalysis.contrarianNotes?.length ? (
                          <div className="web-context">
                            <h4>{ui.contrarianReview}</h4>
                            {activeAnalysis.contrarianNotes.map((note) => (
                              <p key={note}>{note}</p>
                            ))}
                          </div>
                        ) : null}
                        {activeAnalysis.calibrationNotes?.length ? (
                          <div className="web-context">
                            <h4>{ui.calibrationReview}</h4>
                            {activeAnalysis.calibrationNotes.map((note) => (
                              <p key={note}>{note}</p>
                            ))}
                          </div>
                        ) : null}
                        {activeAnalysis.webContext?.length ? (
                          <div className="web-context">
                            <h4>{ui.webContext}</h4>
                            {activeAnalysis.webContext.map((item) => (
                              <a href={item.url} target="_blank" key={item.url}>
                                <strong>{item.title}</strong>
                                <span>{item.snippet}</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="empty-prediction">
                    <Sparkles size={28} />
                    <h3>{ui.emptyTitle}</h3>
                    <p>{ui.emptyText}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </section>
      )}
    </main>
  )
}

export default App

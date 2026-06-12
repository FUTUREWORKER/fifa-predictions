import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Goal,
  Loader2,
  RadioTower,
  RefreshCw,
  Sparkles,
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
  scoreline: string
  confidence: number
  keyFactors: string[]
  riskNotes: string[]
  webContext: {
    title: string
    url: string
    snippet: string
  }[]
  createdAt: string
}

const resultLabel = {
  home: '主胜',
  draw: '平局',
  away: '客胜',
}

const statusLabel = {
  scheduled: '未开赛',
  live: '进行中',
  finished: '已完赛',
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

function formatDate(value: string) {
  if (!value) return '时间待定'
  return new Intl.DateTimeFormat('zh-CN', {
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

function scoreText(match: Match) {
  if (match.status === 'scheduled') return ''
  return `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`
}

function TeamFlag({ team, size = 'large' }: { team: string; size?: 'large' | 'small' }) {
  const code = flagCodes[team]
  return (
    <span className={`team-flag ${size}`} aria-hidden="true">
      {code ? (
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

function App() {
  const [matches, setMatches] = useState<Match[]>([])
  const [config, setConfig] = useState<ConfigStatus | null>(null)
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({})
  const [activeAnalysisProviderId, setActiveAnalysisProviderId] = useState('')
  const [oddsStats, setOddsStats] = useState({ live: 0, cached: 0 })
  const [loading, setLoading] = useState(true)
  const [predicting, setPredicting] = useState(false)
  const [error, setError] = useState('')

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

  function predictionsForResult(result: Prediction['predictedResult']) {
    if (!hasStandardOdds(selectedMatch)) return []
    return selectedPredictions.filter(
      (prediction) => prediction.predictedResult === result,
    )
  }

  function providerForPrediction(prediction: Prediction) {
    return (
      config?.providers.find((provider) => provider.id === prediction.providerId) ?? {
        id: prediction.providerId,
        name: prediction.providerName,
      }
    )
  }

  async function loadDashboard() {
    setLoading(true)
    setError('')
    try {
      const [matchesRes, configRes] = await Promise.all([
        fetch('/api/matches'),
        fetch('/api/config/status'),
      ])
      if (!matchesRes.ok || !configRes.ok) throw new Error('数据接口请求失败')
      const matchesPayload = await matchesRes.json()
      const configPayload = await configRes.json()
      const defaultMatch =
        matchesPayload.matches.find((match: Match) => hasStandardOdds(match)) ??
        matchesPayload.matches.find((match: Match) => match.odds) ??
        matchesPayload.matches[0]
      setMatches(matchesPayload.matches)
      setConfig(configPayload)
      setOddsStats({
        live: matchesPayload.oddsLiveCount ?? 0,
        cached: matchesPayload.oddsCachedCount ?? 0,
      })
      setSelectedMatchId((current) => {
        const currentMatch = matchesPayload.matches.find(
          (match: Match) => match.id === current,
        )
        if (!current || !hasStandardOdds(currentMatch)) return defaultMatch?.id || ''
        return current
      })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

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
          if (!res.ok) throw new Error(`${provider.name}: ${payload.error ?? '预测失败'}`)
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
      if (rejected.length) {
        setError(
          rejected
            .map((result) =>
              result.reason instanceof Error ? result.reason.message : '模型预测失败',
            )
            .join('；'),
        )
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '预测失败')
    } finally {
      setPredicting(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!selectedMatch?.id) return
    const controller = new AbortController()
    fetch(`/api/predictions/${selectedMatch.id}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('缓存读取失败'))))
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
  }, [selectedMatch?.id])

  return (
    <main className="app-shell">
      <section className="stadium-hero">
        <div className="pitch-lines" />
        <div className="hero-copy">
          <div className="eyebrow">
            <Trophy size={18} />
            FIFA World Cup 2026 Prediction Desk
          </div>
          <h1>世界杯赛果AI预测</h1>
          <p>
            聚合赛程、竞彩盘口与多模型推理，给每一场比赛生成可复核的赛果判断。
          </p>
        </div>
        <div className="hero-scoreboard" aria-label="数据状态">
          <div>
            <span>{matches.length || '--'}</span>
            <small>场赛程</small>
          </div>
          <button type="button" onClick={loadDashboard} title="刷新数据">
            <RefreshCw size={18} />
          </button>
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      <section className="control-strip">
        <div className="status-pill">
          <RadioTower size={16} />
          赛程源：{config?.schedule.url || config?.schedule.localFile || '未配置'}
        </div>
        <div className="status-pill">
          <CircleDollarSign size={16} />
          盘口源：{config?.odds.url || '未配置实时盘口'} · 实时 {oddsStats.live} 场 ·
          缓存 {oddsStats.cached} 场 · 页面可用 {oddsCount} 场
        </div>
      </section>

      <section className="workspace">
        <aside className="match-rail">
          <div className="panel-title">
            <CalendarDays size={18} />
            比赛列表
          </div>
          {loading ? (
            <div className="loading">
              <Loader2 className="spin" size={20} />
              加载赛程中
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
                  <span className="match-date">{formatDate(match.date)}</span>
                  <span className="match-line">
                    <strong>
                      {match.homeTeam} <b>vs</b> {match.awayTeam}
                    </strong>
                    {match.status === 'finished' ? (
                      <span className="score-pill">{scoreText(match)}</span>
                    ) : null}
                  </span>
                  <small>
                    <span className={`status-badge ${match.status}`}>
                      {statusLabel[match.status]}
                    </span>
                    {match.stage}
                    {match.group ? ` · ${match.group}组` : ''} · {match.city}
                    {match.odds ? ' · 有盘口' : ''}
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
                    <span className="tag">{selectedMatch.stage}</span>
                    <span className={`detail-status ${selectedMatch.status}`}>
                      {statusLabel[selectedMatch.status]}
                    </span>
                  </div>
                  <h2>
                    <span className="team-name home">
                      <TeamFlag team={selectedMatch.homeTeam} />
                      {selectedMatch.homeTeam}
                    </span>
                    <span>
                      {selectedMatch.status === 'scheduled'
                        ? 'vs'
                        : `${selectedMatch.homeScore ?? 0} - ${
                            selectedMatch.awayScore ?? 0
                          }`}
                    </span>
                    <span className="team-name away">
                      {selectedMatch.awayTeam}
                      <TeamFlag team={selectedMatch.awayTeam} />
                    </span>
                  </h2>
                  <p>
                    {formatDate(selectedMatch.date)} · {selectedMatch.venue} ·{' '}
                    {selectedMatch.city}
                  </p>
                </div>
                <Goal className="goal-icon" size={52} />
              </div>

              <div className="odds-board">
                <div className="odds-match-title">
                  <span>[主]</span>
                  <strong>
                    <TeamFlag team={selectedMatch.homeTeam} size="small" />
                    {selectedMatch.homeTeam}
                  </strong>
                  <em>vs</em>
                  <strong>
                    {selectedMatch.awayTeam}
                    <TeamFlag team={selectedMatch.awayTeam} size="small" />
                  </strong>
                </div>
                <div className="odds-row">
                  <div className="handicap-badge neutral">-</div>
                  <div className="odds-labels">
                    <span className="single">单</span>
                    <span>过</span>
                  </div>
                  <div className="odds-cell">
                    <span>主胜</span>
                    <strong>{formatOdds(selectedMatch.odds?.homeWin)}</strong>
                    <div className="prediction-markers">
                      {predictionsForResult('home').map((prediction) => (
                        <ModelLogo
                          key={prediction.providerId}
                          provider={providerForPrediction(prediction)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="odds-cell">
                    <span>平</span>
                    <strong>{formatOdds(selectedMatch.odds?.draw)}</strong>
                    <div className="prediction-markers">
                      {predictionsForResult('draw').map((prediction) => (
                        <ModelLogo
                          key={prediction.providerId}
                          provider={providerForPrediction(prediction)}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="odds-cell">
                    <span>主负</span>
                    <strong>{formatOdds(selectedMatch.odds?.awayWin)}</strong>
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
                    <span>过</span>
                  </div>
                  <div className="odds-cell">
                    <span>主胜</span>
                    <strong>
                      {formatOdds(selectedMatch.odds?.handicapHome)}
                      {selectedMatch.odds?.handicapHome ? <i className="up" /> : null}
                    </strong>
                  </div>
                  <div className="odds-cell">
                    <span>平</span>
                    <strong>
                      {formatOdds(selectedMatch.odds?.handicapDraw)}
                      {selectedMatch.odds?.handicapDraw ? <i className="down" /> : null}
                    </strong>
                  </div>
                  <div className="odds-cell">
                    <span>主负</span>
                    <strong>{formatOdds(selectedMatch.odds?.handicapAway)}</strong>
                  </div>
                </div>
              </div>
              <p className="odds-footnote">
                {selectedMatch.odds
                  ? `盘口来源：${selectedMatch.odds.source ?? '公开页面'} · 更新时间：${
                      selectedMatch.odds.updatedAt
                        ? formatDate(selectedMatch.odds.updatedAt)
                        : '刚刚'
                    }`
                  : '当前比赛暂未匹配到公开盘口'}
              </p>

              <div className="model-panel">
                <div className="panel-title">
                  <Sparkles size={18} />
                  模型预测
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
                          : '待配置'}
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
                  {predicting ? '预测中' : '开始预测'}
                </button>
              </div>

              <div className="prediction-card">
                {selectedPredictions.length ? (
                  <>
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
                            {resultLabel[prediction.predictedResult]} · {prediction.scoreline}
                          </h3>
                          <p>{prediction.keyFactors[0] ?? '模型已生成预测结论。'}</p>
                        </button>
                      ))}
                    </div>
                    {activeAnalysis ? (
                      <div className="analysis-detail">
                        <div className="analysis-detail-head">
                          <ModelLogo provider={providerForPrediction(activeAnalysis)} />
                          <strong>{activeAnalysis.providerName} 详细分析</strong>
                          <span>{formatDate(activeAnalysis.createdAt)}</span>
                        </div>
                        <div className="factor-list">
                          {activeAnalysis.keyFactors.map((factor) => (
                            <p key={factor}>{factor}</p>
                          ))}
                        </div>
                        <div className="risk-notes">
                          {activeAnalysis.riskNotes.map((note) => (
                            <span key={note}>{note}</span>
                          ))}
                        </div>
                        {activeAnalysis.webContext?.length ? (
                          <div className="web-context">
                            <h4>联网搜索参考</h4>
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
                    <h3>选择模型后生成赛果预测</h3>
                    <p>
                      点击上方按钮后，系统会结合实时赛程、公开盘口和比赛背景生成预测结论。
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  )
}

export default App

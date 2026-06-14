import type { Match, ModelProvider, Odds, Prediction } from './types'
import type { WebSearchItem } from './search'

type ChatMessage = {
  role: 'system' | 'user'
  content: string
}

type Result = 'home' | 'draw' | 'away'
type Probabilities = Record<Result, number>

function stripFence(text: string) {
  return text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
}

function isResult(value: unknown): value is Result {
  return value === 'home' || value === 'draw' || value === 'away'
}

function normalizeProbabilities(value: unknown, fallbackResult: Result, confidence = 0.5) {
  const source = value as Partial<Probabilities> | undefined
  const raw = {
    home: Number(source?.home ?? 0),
    draw: Number(source?.draw ?? 0),
    away: Number(source?.away ?? 0),
  }
  const sum = raw.home + raw.draw + raw.away
  if (sum > 0) {
    return {
      home: Number((raw.home / sum).toFixed(4)),
      draw: Number((raw.draw / sum).toFixed(4)),
      away: Number((raw.away / sum).toFixed(4)),
    }
  }
  const main = Math.min(0.92, Math.max(0.34, confidence))
  const rest = (1 - main) / 2
  return {
    home: Number((fallbackResult === 'home' ? main : rest).toFixed(4)),
    draw: Number((fallbackResult === 'draw' ? main : rest).toFixed(4)),
    away: Number((fallbackResult === 'away' ? main : rest).toFixed(4)),
  }
}

function normalizeScorelineProbabilities(value: unknown, fallbackScoreline: string) {
  if (!Array.isArray(value)) {
    return [{ scoreline: fallbackScoreline, probability: 1 }]
  }
  const items = value
    .map((item) => ({
      scoreline: String(
        Array.isArray(item) ? item[0] : item?.scoreline ?? item?.score ?? '',
      ),
      probability: Number(
        Array.isArray(item) ? item[1] : item?.probability ?? item?.prob ?? 0,
      ),
    }))
    .filter((item) => item.scoreline && Number.isFinite(item.probability) && item.probability > 0)
    .slice(0, 6)
  const sum = items.reduce((total, item) => total + item.probability, 0)
  return sum > 0
    ? items.map((item) => ({
        scoreline: item.scoreline,
        probability: Number((item.probability / sum).toFixed(4)),
      }))
    : [{ scoreline: fallbackScoreline, probability: 1 }]
}

function normalizeScoreline(value = '') {
  const match = value
    .replace(/[：:]/g, '-')
    .replace(/\s+/g, '')
    .match(/^(\d+)-(\d+)$/)
  return match ? `${Number(match[1])}-${Number(match[2])}` : ''
}

function resultFromScoreline(scoreline: string): Result | null {
  const normalized = normalizeScoreline(scoreline)
  if (!normalized) return null
  const [home, away] = normalized.split('-').map(Number)
  if (home > away) return 'home'
  if (home < away) return 'away'
  return 'draw'
}

function handicapResultFromScoreline(scoreline: string, handicap?: string): Result | null {
  const normalized = normalizeScoreline(scoreline)
  if (!normalized || !handicap) return null
  const handicapValue = Number(handicap)
  if (!Number.isFinite(handicapValue)) return null
  const [home, away] = normalized.split('-').map(Number)
  const adjustedHome = home + handicapValue
  if (adjustedHome > away) return 'home'
  if (adjustedHome < away) return 'away'
  return 'draw'
}

function marketProbabilities(
  home?: number,
  draw?: number,
  away?: number,
): Probabilities | null {
  const raw = {
    home: impliedProbability(home) ?? 0,
    draw: impliedProbability(draw) ?? 0,
    away: impliedProbability(away) ?? 0,
  }
  const sum = raw.home + raw.draw + raw.away
  if (!sum) return null
  return {
    home: Number((raw.home / sum).toFixed(4)),
    draw: Number((raw.draw / sum).toFixed(4)),
    away: Number((raw.away / sum).toFixed(4)),
  }
}

function blendProbabilities(model: Probabilities, market: Probabilities | null) {
  if (!market) return model
  const modelWeight = 0.55
  const marketWeight = 0.45
  return {
    home: Number((model.home * modelWeight + market.home * marketWeight).toFixed(4)),
    draw: Number((model.draw * modelWeight + market.draw * marketWeight).toFixed(4)),
    away: Number((model.away * modelWeight + market.away * marketWeight).toFixed(4)),
  }
}

function topResult(probabilities: Probabilities): Result {
  return (Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    'draw') as Result
}

function parsePredictionText(
  text: string,
  odds?: Odds,
): Omit<Prediction, 'matchId' | 'providerId' | 'providerName' | 'model' | 'createdAt'> {
  try {
    const parsed = JSON.parse(stripFence(text))
    const rawScoreline = String(parsed.scoreline ?? '')
    const scorelineResult = resultFromScoreline(rawScoreline)
    const predictedResult = scorelineResult ?? (isResult(parsed.predictedResult)
      ? parsed.predictedResult
      : 'draw')
    const scorelineHandicapResult = handicapResultFromScoreline(rawScoreline, odds?.handicap)
    const handicapPredictedResult = scorelineHandicapResult ?? (isResult(parsed.handicapPredictedResult)
      ? parsed.handicapPredictedResult
      : predictedResult)
    const confidence = Number(parsed.confidence ?? 0.5)
    const handicapConfidence =
      typeof parsed.handicapConfidence === 'number'
        ? Number(parsed.handicapConfidence)
        : confidence
    const standardProbabilities = normalizeProbabilities(
      parsed.standardProbabilities,
      predictedResult,
      confidence,
    )
    const handicapProbabilities = normalizeProbabilities(
      parsed.handicapProbabilities,
      handicapPredictedResult,
      handicapConfidence,
    )
    const calibratedProbabilities = blendProbabilities(
      standardProbabilities,
      marketProbabilities(odds?.homeWin, odds?.draw, odds?.awayWin),
    )
    const calibratedHandicapProbabilities = blendProbabilities(
      handicapProbabilities,
      marketProbabilities(odds?.handicapHome, odds?.handicapDraw, odds?.handicapAway),
    )
    const calibratedTopResult = topResult(calibratedProbabilities)
    const calibratedTopHandicapResult = topResult(calibratedHandicapProbabilities)
    const finalPredictedResult = scorelineResult ?? calibratedTopResult
    const finalHandicapPredictedResult =
      scorelineHandicapResult ?? calibratedTopHandicapResult

    return {
      predictedResult: finalPredictedResult,
      handicapPredictedResult: finalHandicapPredictedResult,
      standardProbabilities,
      handicapProbabilities,
      calibratedProbabilities,
      calibratedHandicapProbabilities,
      scoreline: rawScoreline,
      scorelineProbabilities: normalizeScorelineProbabilities(
        parsed.scorelineProbabilities,
        String(parsed.scoreline ?? ''),
      ),
      confidence,
      handicapConfidence,
      keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : [],
      riskNotes: Array.isArray(parsed.riskNotes) ? parsed.riskNotes : [],
      handicapKeyFactors: Array.isArray(parsed.handicapKeyFactors)
        ? parsed.handicapKeyFactors
        : [],
      handicapRiskNotes: Array.isArray(parsed.handicapRiskNotes)
        ? parsed.handicapRiskNotes
        : [],
      contrarianNotes: Array.isArray(parsed.contrarianNotes)
        ? parsed.contrarianNotes
        : [],
      calibrationNotes: [
        '服务端已将模型概率与盘口隐含概率按 55%/45% 加权校准。',
        ...(scorelineResult && scorelineResult !== parsed.predictedResult
          ? [
              `服务端检测到比分 ${rawScoreline} 与标准盘结论不一致，已按比分自动修正为 ${scorelineResult}。`,
            ]
          : []),
        ...(scorelineResult && scorelineResult !== calibratedTopResult
          ? [
              `盘口校准最高项为 ${calibratedTopResult}，但比分 ${rawScoreline} 推导为 ${scorelineResult}；最终标准盘按比分一致性保留为 ${scorelineResult}。`,
            ]
          : []),
        ...(scorelineHandicapResult &&
        scorelineHandicapResult !== parsed.handicapPredictedResult
          ? [
              `服务端检测到比分 ${rawScoreline} 与让球盘结论不一致，已按让球 ${odds?.handicap} 自动修正为 ${scorelineHandicapResult}。`,
            ]
          : []),
        ...(scorelineHandicapResult &&
        scorelineHandicapResult !== calibratedTopHandicapResult
          ? [
              `盘口校准最高项为 ${calibratedTopHandicapResult}，但比分 ${rawScoreline} 按让球 ${odds?.handicap} 推导为 ${scorelineHandicapResult}；最终让球盘按比分一致性保留为 ${scorelineHandicapResult}。`,
            ]
          : []),
        ...(Array.isArray(parsed.calibrationNotes) ? parsed.calibrationNotes : []),
      ],
      errorTags: Array.isArray(parsed.errorTags) ? parsed.errorTags : [],
      rawText: text,
    }
  } catch {
    const standardProbabilities = normalizeProbabilities(null, 'draw', 0.5)
    return {
      predictedResult: 'draw',
      handicapPredictedResult: 'draw',
      standardProbabilities,
      handicapProbabilities: standardProbabilities,
      calibratedProbabilities: standardProbabilities,
      calibratedHandicapProbabilities: standardProbabilities,
      scorelineProbabilities: [{ scoreline: '1-1', probability: 1 }],
      scoreline: '1-1',
      confidence: 0.5,
      handicapConfidence: 0.5,
      keyFactors: ['模型返回了非 JSON 文本，已保留原文供人工判断。'],
      riskNotes: ['请检查该供应商的模型输出格式。'],
      handicapKeyFactors: [],
      handicapRiskNotes: [],
      contrarianNotes: ['模型输出格式异常，无法进行有效反方审查。'],
      calibrationNotes: ['模型输出格式异常，已使用保守平局兜底。'],
      errorTags: ['输出格式异常'],
      rawText: text,
    }
  }
}

function impliedProbability(value?: number) {
  return typeof value === 'number' && value > 0 ? Number((1 / value).toFixed(4)) : null
}

function oddsContext(odds?: Odds) {
  if (!odds) return null
  return {
    standard: {
      homeWin: odds.homeWin,
      draw: odds.draw,
      awayWin: odds.awayWin,
      impliedProbability: {
        home: impliedProbability(odds.homeWin),
        draw: impliedProbability(odds.draw),
        away: impliedProbability(odds.awayWin),
      },
    },
    handicap: {
      line: odds.handicap,
      rule:
        '让球胜平负按主队比分加上 handicap 后再与客队比分比较。例：handicap=-1 表示主队先减 1 球，handicap=1 表示主队先加 1 球。',
      homeWin: odds.handicapHome,
      draw: odds.handicapDraw,
      awayWin: odds.handicapAway,
      impliedProbability: {
        home: impliedProbability(odds.handicapHome),
        draw: impliedProbability(odds.handicapDraw),
        away: impliedProbability(odds.handicapAway),
      },
    },
  }
}

export function buildPrompt(match: Match, odds?: Odds): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        '你是世界杯赛果与竞彩盘口预测分析师。请结合赛程、球队强弱、主客/举办地因素、赔率隐含概率、让球规则、赛程密度、伤停/轮换、旅行与气候、不确定性，输出严格 JSON。不要输出 Markdown。不要因为热门球队名气大就忽略盘口深浅和冷门风险。',
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          task: '同时预测这场世界杯比赛的标准胜平负和让球胜平负',
          scoringNotes: [
            '标准盘 predictedResult 按原始比分判断：home=主胜，draw=平，away=主负。',
            '让球盘 handicapPredictedResult 按主队比分 + handicap 后判断：home=让胜，draw=让平，away=让负。',
            '如果盘口数据缺失，仍需给出让球盘倾向，但必须在风险提示中说明不确定性更高。',
            'scoreline 必须是你预测的真实比分，不是让球后的比分。',
          ],
          outputSchema: {
            predictedResult: 'home | draw | away',
            handicapPredictedResult: 'home | draw | away',
            standardProbabilities: {
              home: '0 到 1，三项合计约等于 1',
              draw: '0 到 1，三项合计约等于 1',
              away: '0 到 1，三项合计约等于 1',
            },
            handicapProbabilities: {
              home: '0 到 1，三项合计约等于 1',
              draw: '0 到 1，三项合计约等于 1',
              away: '0 到 1，三项合计约等于 1',
            },
            scorelineProbabilities: [
              { scoreline: '例如 2-0', probability: '0 到 1' },
              { scoreline: '例如 2-1', probability: '0 到 1' },
            ],
            scoreline: '例如 2-1',
            confidence: '0 到 1 的数字',
            handicapConfidence: '0 到 1 的数字',
            keyFactors: ['3 到 5 条关键依据，中文'],
            riskNotes: ['1 到 3 条风险提示，中文'],
            handicapKeyFactors: ['2 到 4 条让球盘依据，中文'],
            handicapRiskNotes: ['1 到 3 条让球盘风险提示，中文'],
            contrarianNotes: ['2 到 4 条反方审查：热门结果为什么可能不成立'],
            calibrationNotes: ['1 到 3 条你如何处理模型判断与盘口差异'],
            errorTags: ['可能错因标签，如 强队高估/平局低估/盘口过热/伤停不明/轮换风险'],
          },
          match,
          odds: odds ?? null,
          derivedOddsContext: oddsContext(odds),
        },
        null,
        2,
      ),
    },
  ]
}

export async function predictMatch(
  provider: ModelProvider,
  match: Match,
  odds?: Odds,
  webContext: WebSearchItem[] = [],
): Promise<Prediction> {
  if (!provider.enabled || provider.apiKey.startsWith('填入你的')) {
    throw new Error(`模型供应商 ${provider.name} 尚未启用或未配置 API Key。`)
  }

  const endpoint = `${provider.baseURL.replace(/\/$/, '')}/chat/completions`
  const context =
    webContext.length > 0
      ? webContext
      : [
          {
            title: '实时赛程与比赛状态',
            url: 'https://worldcup26.ir/get/games',
            snippet:
              '服务端已从公开实时赛程接口读取本场比赛的开赛时间、状态、比分、分组和场馆信息。',
          },
          ...(odds?.source
            ? [
                {
                  title: '公开竞彩盘口',
                  url: 'https://trade.500.com/jczq/',
                  snippet: `服务端已从公开竞彩足球页面读取本场胜平负与让球胜平负盘口，来源：${odds.source}。`,
                },
              ]
            : []),
        ]
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model,
      messages: buildPrompt(match, odds).map((message) =>
        message.role === 'user'
          ? {
              ...message,
              content: JSON.stringify(
                {
                  ...JSON.parse(message.content),
                  webSearch: {
                    enabled: true,
                    note: '以下是服务端为本次预测实时联网搜索得到的公开网页摘要，请用于校验球队近况、伤停、舆论和盘口背景。',
                    results: context,
                  },
                },
                null,
                2,
              ),
            }
          : message,
      ),
      temperature: 0.35,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${provider.name} 请求失败：HTTP ${res.status} ${body.slice(0, 240)}`)
  }

  const payload = await res.json()
  const text = payload.choices?.[0]?.message?.content ?? ''
  const parsed = parsePredictionText(text, odds)

  return {
    matchId: match.id,
    providerId: provider.id,
    providerName: provider.name,
    model: provider.model,
    createdAt: new Date().toISOString(),
    webContext: context,
    ...parsed,
  }
}

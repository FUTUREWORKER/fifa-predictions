import type { Match, ModelProvider, Odds, Prediction } from './types'
import type { WebSearchItem } from './search'

type ChatMessage = {
  role: 'system' | 'user'
  content: string
}

function stripFence(text: string) {
  return text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
}

function parsePredictionText(
  text: string,
): Omit<Prediction, 'matchId' | 'providerId' | 'providerName' | 'model' | 'createdAt'> {
  try {
    const parsed = JSON.parse(stripFence(text))
    return {
      predictedResult: parsed.predictedResult,
      handicapPredictedResult: parsed.handicapPredictedResult,
      scoreline: String(parsed.scoreline ?? ''),
      confidence: Number(parsed.confidence ?? 0.5),
      handicapConfidence:
        typeof parsed.handicapConfidence === 'number'
          ? Number(parsed.handicapConfidence)
          : undefined,
      keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : [],
      riskNotes: Array.isArray(parsed.riskNotes) ? parsed.riskNotes : [],
      handicapKeyFactors: Array.isArray(parsed.handicapKeyFactors)
        ? parsed.handicapKeyFactors
        : [],
      handicapRiskNotes: Array.isArray(parsed.handicapRiskNotes)
        ? parsed.handicapRiskNotes
        : [],
      rawText: text,
    }
  } catch {
    return {
      predictedResult: 'draw',
      handicapPredictedResult: 'draw',
      scoreline: '1-1',
      confidence: 0.5,
      handicapConfidence: 0.5,
      keyFactors: ['模型返回了非 JSON 文本，已保留原文供人工判断。'],
      riskNotes: ['请检查该供应商的模型输出格式。'],
      handicapKeyFactors: [],
      handicapRiskNotes: [],
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
            scoreline: '例如 2-1',
            confidence: '0 到 1 的数字',
            handicapConfidence: '0 到 1 的数字',
            keyFactors: ['3 到 5 条关键依据，中文'],
            riskNotes: ['1 到 3 条风险提示，中文'],
            handicapKeyFactors: ['2 到 4 条让球盘依据，中文'],
            handicapRiskNotes: ['1 到 3 条让球盘风险提示，中文'],
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
  const parsed = parsePredictionText(text)

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

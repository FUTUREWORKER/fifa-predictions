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
      scoreline: String(parsed.scoreline ?? ''),
      confidence: Number(parsed.confidence ?? 0.5),
      keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : [],
      riskNotes: Array.isArray(parsed.riskNotes) ? parsed.riskNotes : [],
      rawText: text,
    }
  } catch {
    return {
      predictedResult: 'draw',
      scoreline: '1-1',
      confidence: 0.5,
      keyFactors: ['模型返回了非 JSON 文本，已保留原文供人工判断。'],
      riskNotes: ['请检查该供应商的模型输出格式。'],
      rawText: text,
    }
  }
}

export function buildPrompt(match: Match, odds?: Odds): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        '你是世界杯赛果预测分析师。请结合赛程、球队强弱、主客/举办地因素、盘口赔率和不确定性，输出严格 JSON。不要输出 Markdown。',
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          task: '预测这场世界杯比赛赛果',
          outputSchema: {
            predictedResult: 'home | draw | away',
            scoreline: '例如 2-1',
            confidence: '0 到 1 的数字',
            keyFactors: ['3 到 5 条关键依据，中文'],
            riskNotes: ['1 到 3 条风险提示，中文'],
          },
          match,
          odds: odds ?? null,
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

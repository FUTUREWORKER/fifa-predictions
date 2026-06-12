import type { Match } from './types'

export type WebSearchItem = {
  title: string
  url: string
  snippet: string
}

function cleanHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeDuckUrl(value: string) {
  try {
    const url = new URL(value)
    return url.searchParams.get('uddg') ?? value
  } catch {
    return value
  }
}

export async function searchMatchContext(match: Match): Promise<WebSearchItem[]> {
  const query = `${match.homeTeam} ${match.awayTeam} World Cup 2026 preview odds injuries form`
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })
    if (!res.ok) return []
    const html = await res.text()
    const blocks = html.match(/<div class="result[\s\S]*?<\/div>\s*<\/div>/g) ?? []

    return blocks
      .map((block) => {
        const linkMatch = block.match(
          /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/,
        )
        const snippetMatch = block.match(
          /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/,
        )
        if (!linkMatch) return null
        return {
          title: cleanHtml(linkMatch[2]),
          url: decodeDuckUrl(linkMatch[1]),
          snippet: snippetMatch ? cleanHtml(snippetMatch[1]) : '',
        }
      })
      .filter((item): item is WebSearchItem => Boolean(item))
      .slice(0, 5)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

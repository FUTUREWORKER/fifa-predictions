import fs from 'node:fs/promises'
import Papa from 'papaparse'
import type { DataSourceConfig, Match, Odds } from './types'
import { resolveProjectPath } from './config'

const teamNameZh: Record<string, string> = {
  Algeria: '阿尔及利亚',
  Argentina: '阿根廷',
  Australia: '澳大利亚',
  Austria: '奥地利',
  Belgium: '比利时',
  'Bosnia and Herzegovina': '波黑',
  Brazil: '巴西',
  Canada: '加拿大',
  'Cape Verde': '佛得角',
  Colombia: '哥伦比亚',
  'Congo DR': '刚果民主共和国',
  'Democratic Republic of the Congo': '刚果民主共和国',
  Croatia: '克罗地亚',
  Curaçao: '库拉索',
  Curacao: '库拉索',
  'Czech Republic': '捷克',
  Ecuador: '厄瓜多尔',
  Egypt: '埃及',
  England: '英格兰',
  France: '法国',
  Germany: '德国',
  Ghana: '加纳',
  Haiti: '海地',
  Iran: '伊朗',
  Iraq: '伊拉克',
  'Ivory Coast': '科特迪瓦',
  Japan: '日本',
  Jordan: '约旦',
  Mexico: '墨西哥',
  Morocco: '摩洛哥',
  Netherlands: '荷兰',
  'New Zealand': '新西兰',
  Norway: '挪威',
  Panama: '巴拿马',
  Paraguay: '巴拉圭',
  Portugal: '葡萄牙',
  Qatar: '卡塔尔',
  'Saudi Arabia': '沙特阿拉伯',
  Scotland: '苏格兰',
  Senegal: '塞内加尔',
  'South Africa': '南非',
  'South Korea': '韩国',
  Spain: '西班牙',
  Sweden: '瑞典',
  Switzerland: '瑞士',
  Tunisia: '突尼斯',
  Turkey: '土耳其',
  Türkiye: '土耳其',
  Uruguay: '乌拉圭',
  USA: '美国',
  'United States': '美国',
  Uzbekistan: '乌兹别克斯坦',
}

async function fetchWithTimeout(url: string, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchBufferWithTimeout(url: string, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.arrayBuffer()
  } finally {
    clearTimeout(timer)
  }
}

async function readSource(config: DataSourceConfig) {
  if (config.url) {
    try {
      return {
        body: await fetchWithTimeout(config.url, config.timeoutMs),
        source: config.url,
      }
    } catch (error) {
      if (!config.localFile) throw error
    }
  }

  if (!config.localFile) {
    throw new Error('No URL or local file configured for data source.')
  }

  const filePath = resolveProjectPath(config.localFile)
  return {
    body: await fs.readFile(filePath, 'utf8'),
    source: config.localFile,
  }
}

function normalizeMatch(row: Record<string, unknown>, index: number): Match {
  const homeTeam = String(row.homeTeam ?? row.home ?? row.team1 ?? row.home_team ?? '')
  const awayTeam = String(row.awayTeam ?? row.away ?? row.team2 ?? row.away_team ?? '')

  return {
    id: String(row.id ?? row.matchId ?? `match-${index + 1}`),
    date: String(row.date ?? row.datetime ?? row.kickoff ?? ''),
    stage: String(row.stage ?? row.round ?? row.phase ?? '小组赛'),
    group: row.group ? String(row.group) : undefined,
    homeTeam,
    awayTeam,
    homeScore: row.homeScore !== undefined ? Number(row.homeScore) : undefined,
    awayScore: row.awayScore !== undefined ? Number(row.awayScore) : undefined,
    matchday: row.matchday ? String(row.matchday) : undefined,
    venue: row.venue ? String(row.venue) : undefined,
    city: row.city ? String(row.city) : undefined,
    status: (row.status as Match['status']) ?? 'scheduled',
  }
}

function normalizeWorldCupStatus(match: Record<string, unknown>): Match['status'] {
  if (String(match.finished).toUpperCase() === 'TRUE') return 'finished'
  const elapsed = String(match.time_elapsed ?? '').toLowerCase()
  if (elapsed && elapsed !== 'notstarted' && elapsed !== 'not_started') return 'live'
  return 'scheduled'
}

function hostCityUtcOffsetHours(city = '') {
  const value = city.toLowerCase()
  if (
    value.includes('mexico city') ||
    value.includes('guadalajara') ||
    value.includes('zapopan') ||
    value.includes('monterrey') ||
    value.includes('guadalupe')
  ) {
    return -6
  }
  if (
    value.includes('vancouver') ||
    value.includes('seattle') ||
    value.includes('los angeles') ||
    value.includes('inglewood') ||
    value.includes('san francisco') ||
    value.includes('santa clara')
  ) {
    return -7
  }
  if (
    value.includes('dallas') ||
    value.includes('houston') ||
    value.includes('kansas city')
  ) {
    return -5
  }
  if (
    value.includes('toronto') ||
    value.includes('boston') ||
    value.includes('foxborough') ||
    value.includes('new jersey') ||
    value.includes('east rutherford') ||
    value.includes('philadelphia') ||
    value.includes('atlanta') ||
    value.includes('miami')
  ) {
    return -4
  }
  return 0
}

function worldCupLocalDateToIso(value: unknown, city?: string) {
  if (!value) return ''
  const text = String(value)
  const match = text.match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/,
  )
  if (!match) return text

  const [, month, day, year, hour, minute] = match
  const offset = hostCityUtcOffsetHours(city)
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - offset,
      Number(minute),
    ),
  ).toISOString()
}

async function loadWorldCup26Stadiums(url?: string, timeoutMs?: number) {
  if (!url) return new Map<string, Record<string, unknown>>()
  const stadiumUrl = new URL('/get/stadiums', url).toString()
  try {
    const text = await fetchWithTimeout(stadiumUrl, timeoutMs)
    const payload = JSON.parse(text) as { stadiums?: Record<string, unknown>[] }
    return new Map((payload.stadiums ?? []).map((stadium) => [String(stadium.id), stadium]))
  } catch {
    return new Map<string, Record<string, unknown>>()
  }
}

function normalizeWorldCup26(
  payload: unknown,
  stadiums = new Map<string, Record<string, unknown>>(),
): Match[] {
  const data = payload as {
    games?: Record<string, unknown>[]
    matches?: Record<string, unknown>[]
  }
  const rows = data.games ?? data.matches ?? []

  return rows.map((match, index) => {
    const stadium = stadiums.get(String(match.stadium_id))
    const homeName = String(match.home_team_name_en ?? match.home_team_name ?? '')
    const awayName = String(match.away_team_name_en ?? match.away_team_name ?? '')
    const city = String(stadium?.city_en ?? match.city ?? '')
    return normalizeMatch(
      {
        id: match.id ?? match._id,
        date: worldCupLocalDateToIso(match.local_date ?? match.date, city),
        stage: match.type === 'group' ? '小组赛' : (match.type ?? match.stage),
        group: match.group,
        matchday: match.matchday,
        homeTeam: teamNameZh[homeName] ?? homeName,
        awayTeam: teamNameZh[awayName] ?? awayName,
        homeScore: match.home_score,
        awayScore: match.away_score,
        venue: stadium?.fifa_name ?? stadium?.name_en ?? match.stadium_name,
        city,
        status: normalizeWorldCupStatus(match),
      },
      index,
    )
  })
}

function normalizeWorldCup26Legacy(payload: unknown): Match[] {
  const data = payload as { matches?: Record<string, unknown>[] }
  return (data.matches ?? []).map((match, index) =>
    normalizeMatch(
      {
        id: match.id,
        date: match.local_date ?? match.date,
        stage: match.stage_name ?? match.stage,
        group: match.group_name ?? match.group,
        homeTeam: match.home_team_name ?? match.home_team,
        awayTeam: match.away_team_name ?? match.away_team,
        venue: match.stadium_name ?? match.venue,
        city: match.city,
        status: match.status,
      },
      index,
    ),
  )
}

export async function loadMatches(config: DataSourceConfig) {
  const source = await readSource(config)
  const payload = JSON.parse(source.body)
  if (config.type === 'worldcup26') {
    const stadiums = await loadWorldCup26Stadiums(config.url, config.timeoutMs)
    const matches = normalizeWorldCup26(payload, stadiums)
    return {
      source: source.source,
      matches: matches.length ? matches : normalizeWorldCup26Legacy(payload),
    }
  }

  const rows = Array.isArray(payload)
    ? payload
    : (payload.matches ?? payload.fixtures ?? [])

  return {
    source: source.source,
    matches: rows.map((row: Record<string, unknown>, index: number) =>
      normalizeMatch(row, index),
    ),
  }
}

export async function loadOdds(config: DataSourceConfig) {
  if (!config.url && !config.localFile) {
    return { source: '未配置实时盘口源', odds: [] as Odds[] }
  }

  if (config.type === 'sporttery-500') {
    const url = config.url || 'https://trade.500.com/jczq/'
    const buffer = await fetchBufferWithTimeout(url, config.timeoutMs)
    const html = new TextDecoder('gb18030').decode(buffer)
    return { source: url, odds: parse500SportteryOdds(html) }
  }

  const source = await readSource(config)
  const rows =
    config.type === 'csv'
      ? Papa.parse<Record<string, string>>(source.body, {
          header: true,
          skipEmptyLines: true,
        }).data
      : JSON.parse(source.body)

  const odds: Odds[] = (Array.isArray(rows) ? rows : rows.odds ?? []).map(
    (row: Record<string, unknown>) => ({
      matchId: String(row.matchId ?? row.id ?? ''),
      market: String(row.market ?? '竞彩胜平负'),
      homeTeam: row.homeTeam ? String(row.homeTeam) : undefined,
      awayTeam: row.awayTeam ? String(row.awayTeam) : undefined,
      matchTime: row.matchTime ? String(row.matchTime) : undefined,
      homeWin: row.homeWin ? Number(row.homeWin) : undefined,
      draw: row.draw ? Number(row.draw) : undefined,
      awayWin: row.awayWin ? Number(row.awayWin) : undefined,
      handicap: row.handicap ? String(row.handicap) : undefined,
      handicapHome: row.handicapHome ? Number(row.handicapHome) : undefined,
      handicapDraw: row.handicapDraw ? Number(row.handicapDraw) : undefined,
      handicapAway: row.handicapAway ? Number(row.handicapAway) : undefined,
      updatedAt: row.updatedAt ? String(row.updatedAt) : undefined,
      source: row.source ? String(row.source) : source.source,
    }),
  )

  return { source: source.source, odds }
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

function readAttrs(fragment: string) {
  const attrs: Record<string, string> = {}
  for (const match of fragment.matchAll(/([\w-]+)="([^"]*)"/g)) {
    attrs[match[1]] = decodeHtml(match[2])
  }
  return attrs
}

function parseSpByType(rowHtml: string, type: 'nspf' | 'spf') {
  const result: Record<'3' | '1' | '0', number | undefined> = {
    '3': undefined,
    '1': undefined,
    '0': undefined,
  }
  const pattern = new RegExp(
    `<p[^>]+data-type="${type}"[^>]+data-value="([310])"[^>]+data-sp="([^"]+)"`,
    'g',
  )
  for (const match of rowHtml.matchAll(pattern)) {
    const value = match[1] as '3' | '1' | '0'
    result[value] = Number(match[2])
  }
  return result
}

function parse500SportteryOdds(html: string): Odds[] {
  const odds: Odds[] = []
  const rows = html.matchAll(
    new RegExp('<tr\\s+class="bet-tb-tr"([\\s\\S]*?)</tr>', 'g'),
  )

  for (const row of rows) {
    const attrs = readAttrs(row[1])
    if (attrs['data-simpleleague'] !== '世界杯') continue

    const nspf = parseSpByType(row[1], 'nspf')
    const spf = parseSpByType(row[1], 'spf')
    const homeTeam = attrs['data-homesxname']
    const awayTeam = attrs['data-awaysxname']
    if (!homeTeam || !awayTeam) continue

    odds.push({
      matchId: attrs['data-matchid'] || attrs['data-id'] || '',
      homeTeam,
      awayTeam,
      matchTime: `${attrs['data-matchdate'] ?? ''} ${attrs['data-matchtime'] ?? ''}`.trim(),
      market: '竞彩胜平负',
      homeWin: nspf['3'],
      draw: nspf['1'],
      awayWin: nspf['0'],
      handicap: attrs['data-rangqiu'],
      handicapHome: spf['3'],
      handicapDraw: spf['1'],
      handicapAway: spf['0'],
      updatedAt: new Date().toISOString(),
      source: '500彩票网公开竞彩足球页面',
    })
  }

  return odds
}

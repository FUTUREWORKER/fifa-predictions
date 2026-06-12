# FIFA Predictions Architecture

## Runtime

- Frontend: React + Vite in `src/`
- API: Express + TypeScript in `server/`
- CLI: `cli/index.ts`, executable wrapper `bin/fifa-predictions.js`

## Data Flow

1. `server/config.ts` loads `config/providers.json`, falling back to `config/providers.example.json`.
2. `server/data.ts` loads schedule and odds.
3. `server/odds-cache.ts` merges live odds with `data/odds-cache.json`.
4. `server/predictor.ts` calls OpenAI-compatible chat completions.
5. `server/cache.ts` stores predictions in `data/prediction-cache.json`.

## Schedule

Default schedule source:

```text
https://worldcup26.ir/get/games
```

The API also loads `/get/stadiums` and converts host local kickoff times to UTC ISO. The frontend displays all dates in `Asia/Shanghai`.

## Odds

Default public odds source:

```text
https://trade.500.com/jczq/
```

The scraper reads GB18030 HTML and extracts World Cup rows from `data-simpleleague="世界杯"`.

Important cache rule:

- live odds replace cached odds for the same `homeTeam + awayTeam`
- cached odds remain when a match disappears from the public page
- empty live odds must not clear the cache

## Prediction

Each prediction receives:

- match details
- matched odds when available
- web context from search, or fallback context for schedule and odds sources
- strict JSON output schema

The UI caches prediction cards per `matchId + providerId`. Clicking `开始预测` sends `force: true` and refreshes the cache.

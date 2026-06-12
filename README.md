# FIFA Predictions

世界杯赛果 AI 预测工作台：本地 Web 应用 + CLI，聚合实时赛程、公开竞彩盘口和多模型预测。

> This project is for research, learning, and dashboard prototyping. Odds scraping depends on public page structure and should be replaced with an authorized data provider for production use.

## Features

- Live World Cup schedule ingestion from `worldcup26.ir/get/games`
- Public odds scraping from `trade.500.com/jczq/`
- Odds cache: previously scraped odds are kept if the public page later removes a match
- Multi-model predictions with OpenAI-compatible APIs
- Supported provider slots: DeepSeek, Qwen, GPT
- Web search context passed into model prompts
- Per-match prediction cache until the user clicks "开始预测" again
- Local React dashboard with World Cup visuals
- CLI for serving, data checks, predictions, and cache cleanup
- Codex Skill scaffold in `skills/fifa-predictions`

## Quick Start

```bash
npm install
cp config/providers.example.json config/providers.json
npm run dev
```

Open:

```text
http://localhost:5173
```

API:

```text
http://localhost:5174
```

## Configure Models

Edit `config/providers.json`:

```json
{
  "providers": [
    {
      "id": "deepseek",
      "enabled": true,
      "baseURL": "https://api.deepseek.com",
      "apiKey": "YOUR_KEY",
      "model": "deepseek-chat"
    }
  ]
}
```

`config/providers.json` is ignored by git. Keep secrets out of commits.

## CLI

Run with npm:

```bash
npm run cli -- check-data
npm run cli -- predict --match 3 --provider all --force
npm run cli -- clear-cache all
npm run cli -- config
```

After global install or npm link:

```bash
fifa-predictions check-data
fifa-predictions serve
```

Commands:

- `serve`: start the local API and Vite app
- `check-data`: verify schedule, odds, and cache counts
- `predict --match <id> --provider <all|deepseek|qwen|gpt> [--force]`: run model predictions
- `clear-cache [predictions|odds|all]`: remove local cache files
- `config`: print redacted configuration status

## Data Sources

Schedule:

```json
{
  "schedule": {
    "type": "worldcup26",
    "url": "https://worldcup26.ir/get/games",
    "localFile": "data/schedule.seed.json",
    "timeoutMs": 10000
  }
}
```

Odds:

```json
{
  "odds": {
    "type": "sporttery-500",
    "url": "https://trade.500.com/jczq/",
    "localFile": "",
    "timeoutMs": 10000
  }
}
```

The odds scraper writes `data/odds-cache.json`. If a match disappears from the public page on a later refresh, the cached odds remain available.

## API

- `GET /api/health`
- `GET /api/config/status`
- `GET /api/matches`
- `GET /api/predictions/:matchId`
- `POST /api/predict`
- `POST /api/predict/all`

Single prediction:

```json
{
  "matchId": "3",
  "providerId": "deepseek",
  "force": true
}
```

## Codex Skill

The repo includes a skill scaffold:

```text
skills/fifa-predictions/
```

To install it locally:

```bash
mkdir -p ~/.codex/skills
cp -R skills/fifa-predictions ~/.codex/skills/
```

Then ask Codex to use `$fifa-predictions`.

## Development

```bash
npm run lint
npm run build
npm run cli -- check-data
```

## Security

- Do not commit `config/providers.json`
- Do not commit `.env` or `.env.local`
- Do not commit cache files with private analysis context
- Use authorized odds/sports data providers for production

## License

MIT

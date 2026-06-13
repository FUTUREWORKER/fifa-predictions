# Agent Guide

Use this guide when an AI coding agent works inside this repository.

## Project

`fifa-predictions` is a local World Cup 2026 AI prediction dashboard with:

- React + Vite frontend in `src/`
- Express + TypeScript API in `server/`
- CLI in `cli/index.ts`
- OpenAI-compatible model provider config in `config/providers.json`
- Codex Skill package in `skills/fifa-predictions/`

## Safe Defaults

- Never print, commit, or expose `config/providers.json`, `.env`, `.env.local`, `data/prediction-cache.json`, or `data/odds-cache.json`.
- Use `config/providers.example.json` only as the public template.
- Run `npm run lint` and `npm run build` before release-oriented changes.
- Run `npm run cli -- check-data` when touching schedule, odds, cache, or prediction flows.

## Common Commands

```bash
npm install
cp config/providers.example.json config/providers.json
npm run dev
```

```bash
npm run cli -- check-data
npm run cli -- predict --match 3 --provider all --force
npm run cli -- clear-cache all
npm run cli -- config
```

## Data Rules

- Schedule source defaults to `https://worldcup26.ir/get/games`.
- Odds source defaults to `https://trade.500.com/jczq/`.
- Odds are cached in `data/odds-cache.json`.
- If a live scrape returns no odds for a previously cached match, keep the cached odds.
- Predictions are cached in `data/prediction-cache.json` until a forced prediction refresh.

## Model Rules

- Providers are OpenAI-compatible chat completion endpoints.
- The public repo must contain only placeholder keys.
- Use `npm run cli -- config` for redacted provider status.
- The project is for entertainment and learning only. Prediction outputs are not betting, investment, or decision-making advice.

## UI Rules

- The app supports Chinese and English UI switching.
- Keep language-specific README screenshots in sync:
  - `docs/screenshots/dashboard.zh-CN.png`
  - `docs/screenshots/dashboard.en.png`
- Avoid exposing configuration warnings or secret paths in the UI.

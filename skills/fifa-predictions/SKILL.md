---
name: fifa-predictions
description: Run, verify, maintain, and release the FIFA Predictions World Cup AI prediction app. Use when an agent needs to install or start the local dashboard, inspect live schedule or public odds data, run multi-model match predictions, manage prediction/odds caches, update model provider configuration, package the CLI, or prepare/publish this project as an open-source GitHub repository.
---

# FIFA Predictions

Use this skill for the `fifa-predictions` project: a local React + Express app and CLI for World Cup schedule, public odds, and AI match predictions.

If this repository is opened by an agent that does not support Codex Skills, read the root `AGENTS.md` instead.

## Quick Workflow

0. Install from GitHub when the project is not already present:

```bash
git clone https://github.com/FUTUREWORKER/fifa-predictions.git
cd fifa-predictions
npm install
cp config/providers.example.json config/providers.json
```

The user must fill `config/providers.json` locally with provider `baseURL`, `apiKey`, and `model`.

1. Inspect project state:

```bash
npm run cli -- check-data
npm run lint
```

2. Start the app:

```bash
npm run dev
```

Open `http://localhost:5173`.

3. Run predictions:

```bash
npm run cli -- predict --match 3 --provider all --force
```

4. Clear local caches when data shape changes:

```bash
npm run cli -- clear-cache predictions
npm run cli -- clear-cache odds
```

## Data Integrity Rules

- Treat live schedule, public odds, and model outputs as separate evidence layers.
- Do not overwrite cached odds with an empty scrape result. The app keeps old odds when a match disappears from the public page.
- Do not commit `config/providers.json`, `.env*`, `data/prediction-cache.json`, or `data/odds-cache.json`.
- Do not print API keys. Use redacted status commands for diagnostics.
- Before trusting predictions, run `npm run cli -- check-data` and review match counts, odds counts, and first matched odds.
- If a user reports missing odds, first check whether the public odds source still lists that match.

## Common Tasks

### Verify Data

Run:

```bash
npm run cli -- check-data
```

Expect JSON with `matches`, `finished`, `liveOdds`, `cachedOdds`, and `matchesWithOdds`.

### Update Model Providers

Edit `config/providers.json`. Never print API keys. Use:

```bash
npm run cli -- config
```

to verify redacted provider status.

### Prepare For GitHub

Run:

```bash
npm run lint
npm run build
npm run cli -- check-data
```

Then ensure `package.json` repository URLs are updated from `YOUR_GITHUB_USERNAME`.

### Install This Skill For Codex

From a cloned checkout:

```bash
mkdir -p ~/.codex/skills
cp -R skills/fifa-predictions ~/.codex/skills/
```

Then start a new Codex session and ask for `$fifa-predictions`.

## References

Read `references/architecture.md` when changing data flow, caching, prediction prompts, CLI behavior, or release packaging.

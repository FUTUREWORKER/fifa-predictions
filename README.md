# 世界杯赛果 AI 预测

一个本地运行的 2026 世界杯赛果预测工作台，聚合实时赛程、公开竞彩足球盘口、多模型 AI 推理和预测缓存。项目同时提供 Web 界面、CLI 命令和 Codex Skill 脚手架，适合做体育数据看板、模型对比实验和开源二次开发。

> 本项目仅用于研究、学习和原型验证。盘口抓取依赖公开网页结构，生产环境请替换为授权数据源。请勿将真实 API Key 提交到仓库。

![世界杯赛果 AI 预测界面](docs/screenshots/dashboard.png)

## 功能特性

- 接入 2026 世界杯赛程数据，并统一展示为北京时间
- 抓取 500 彩票网公开竞彩足球盘口页面
- 盘口落盘缓存：如果刷新后某场盘口消失，会保留上一次有效盘口
- 支持 DeepSeek、Qwen、GPT 三个 OpenAI-compatible 模型配置位
- 点击“开始预测”后，三个模型并发预测
- 预测时拼接赛程、盘口、比赛状态、比分和联网搜索上下文
- 每场比赛预测结果会缓存，直到再次点击“开始预测”才刷新
- Web 页面包含世界杯视觉氛围、国旗、赛程列表、盘口卡片和模型分析卡
- CLI 支持启动服务、检查数据、发起预测和清理缓存
- 内置 Codex Skill 脚手架，方便结合 Codex/CLI 工作流

## 快速开始

```bash
npm install
cp config/providers.example.json config/providers.json
npm run dev
```

打开 Web 页面：

```text
http://localhost:5173
```

API 服务默认地址：

```text
http://localhost:5174
```

## 模型配置

编辑 `config/providers.json`：

```json
{
  "providers": [
    {
      "id": "deepseek",
      "name": "DeepSeek",
      "enabled": true,
      "baseURL": "https://api.deepseek.com",
      "apiKey": "YOUR_KEY",
      "model": "deepseek-chat"
    }
  ]
}
```

`config/providers.json` 已被 `.gitignore` 忽略，不会提交到 GitHub。真实 API Key 请只保存在本地。

## CLI 用法

通过 npm 运行：

```bash
npm run cli -- check-data
npm run cli -- predict --match 3 --provider all --force
npm run cli -- clear-cache all
npm run cli -- config
```

全局安装或 `npm link` 后：

```bash
fifa-predictions check-data
fifa-predictions serve
```

可用命令：

- `serve`：启动本地 API 和 Vite Web 页面
- `check-data`：检查赛程、盘口和缓存数量
- `predict --match <id> --provider <all|deepseek|qwen|gpt> [--force]`：运行模型预测
- `clear-cache [predictions|odds|all]`：清理本地缓存文件
- `config`：输出脱敏后的模型配置状态

## 数据源

赛程：

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

盘口：

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

盘口缓存会写入 `data/odds-cache.json`。如果某场比赛在后续公开页面中不再出现，应用会继续使用上次缓存的盘口数据。

## API

- `GET /api/health`
- `GET /api/config/status`
- `GET /api/matches`
- `GET /api/predictions/:matchId`
- `POST /api/predict`
- `POST /api/predict/all`

单模型预测请求示例：

```json
{
  "matchId": "3",
  "providerId": "deepseek",
  "force": true
}
```

## Codex Skill

仓库内置 Skill 脚手架：

```text
skills/fifa-predictions/
```

安装到本地 Codex：

```bash
mkdir -p ~/.codex/skills
cp -R skills/fifa-predictions ~/.codex/skills/
```

之后可以让 Codex 使用 `$fifa-predictions` 处理赛程、盘口、预测和缓存相关工作。

## 开发

```bash
npm run lint
npm run build
npm run cli -- check-data
```

## 安全说明

- 不要提交 `config/providers.json`
- 不要提交 `.env` 或 `.env.local`
- 不要提交包含私有分析上下文的缓存文件
- 生产环境请使用授权赛程/盘口/体育数据服务
- 预测结果不构成投注建议

## License

MIT

---

# FIFA Predictions

A local World Cup 2026 AI prediction dashboard that combines live fixtures, public football odds, multi-model AI reasoning, and prediction caching. It includes a React web app, an Express API, a CLI, and a Codex Skill scaffold for local automation workflows.

> This project is for research, learning, and prototyping only. Odds scraping depends on public page structure and should be replaced with an authorized data provider for production use. Never commit real API keys.

![FIFA Predictions dashboard](docs/screenshots/dashboard.png)

## Features

- Ingests World Cup 2026 fixtures and displays match times in Beijing time
- Scrapes public football odds from `trade.500.com/jczq/`
- Persists odds cache so previously available odds are not overwritten by empty refreshes
- Supports DeepSeek, Qwen, and GPT provider slots via OpenAI-compatible APIs
- Runs all enabled models in parallel from the "开始预测" action
- Passes fixture data, odds, match status, scores, and web-search context into prediction prompts
- Caches per-match predictions until the user explicitly refreshes them
- World Cup themed dashboard with flags, match navigation, odds cards, and model analysis cards
- CLI for serving, data checks, predictions, and cache cleanup
- Codex Skill scaffold in `skills/fifa-predictions`

## Quick Start

```bash
npm install
cp config/providers.example.json config/providers.json
npm run dev
```

Open the web app:

```text
http://localhost:5173
```

API server:

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
      "name": "DeepSeek",
      "enabled": true,
      "baseURL": "https://api.deepseek.com",
      "apiKey": "YOUR_KEY",
      "model": "deepseek-chat"
    }
  ]
}
```

`config/providers.json` is ignored by git. Keep secrets local.

## CLI

Run with npm:

```bash
npm run cli -- check-data
npm run cli -- predict --match 3 --provider all --force
npm run cli -- clear-cache all
npm run cli -- config
```

After global install or `npm link`:

```bash
fifa-predictions check-data
fifa-predictions serve
```

Commands:

- `serve`: start the local API and Vite web app
- `check-data`: verify fixture, odds, and cache counts
- `predict --match <id> --provider <all|deepseek|qwen|gpt> [--force]`: run model predictions
- `clear-cache [predictions|odds|all]`: remove local cache files
- `config`: print redacted provider configuration status

## Data Sources

Fixtures:

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

Single prediction request:

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

Install it locally:

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
- Do not commit cache files containing private analysis context
- Use authorized sports and odds data providers for production
- Predictions are not betting advice

## License

MIT

# Security

Do not commit `config/providers.json`, `.env`, `.env.local`, or cache files that may contain private usage context.

Model provider API keys are loaded from `config/providers.json`, which is ignored by git. Use `config/providers.example.json` as the public template.

This project is for entertainment and learning only. It scrapes publicly available odds pages for demo use, and its predictions are not betting, investment, or decision-making advice. Respect source website terms, rate limits, and applicable laws before production use.

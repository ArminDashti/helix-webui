# Helix Web UI

React + Vite frontend for Helix — LLM-powered data analysis and charting.

Companion API: [helix-api](https://github.com/ArminDashti/helix-api).

## Run locally

Start the API first (see helix-api README), then:

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173 — Vite proxies `/api` to Django at `127.0.0.1:8000`.

Optional: copy `.env.example` to `.env` and set `VITE_API_BASE_URL` for an absolute API base URL.

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Prompt + mode, Run |
| `/run` | Live SSE flowchart of the agent pipeline + results |
| `/instructions` | Per-agent instructions + reference `.md` files |
| `/rules` | Rules + which agents use them |
| `/skills` | Skills browser |
| `/admin` | SQL Server + OpenRouter model settings |

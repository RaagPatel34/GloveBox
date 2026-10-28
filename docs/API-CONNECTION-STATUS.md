# API connection status — October 28, 2026

## Connected on the feature preview

| Service | Verification | Cost controls |
| --- | --- | --- |
| Neon database | Local database end-to-end test and hosted save/reload passed | Console shows Free Plan, $0/month |
| EIA fuel data | Hosted California weekly average: $5.888/gal, week of 2026-10-26, with source link | Free API; regional estimate, not a station quote |
| Tavily source search | Hosted search returned five source links and labeled unverified excerpts; no generated answer requested | Researcher Free, 1,000 monthly credits, pay-as-you-go off, requests stop at limit |
| Vercel hosting | Feature deployment Ready; service tests passed in signed-in browser | Hobby active, no payment method, AI credit auto-reload off |

Google Maps remains disabled and its project billing is disconnected. Live AI/Nebius remains disabled. Daily scheduled weather remains disabled pending a separately approved production release. The first hosted EIA request returned the unavailable fallback; retry succeeded.

## Where the secrets live

Real credentials belong only in private Vercel environment variables and the local ignored `.env.local`. GitHub contains the integration code and `.env.example` with blank placeholders. A public repository cannot hide keys committed to files, even if a later commit deletes them.

The connected Vercel variables are scoped to Preview and `codex/first-working-flow`: `DATABASE_URL`, `EIA_API_KEY`, `TAVILY_API_KEY`, and `ENABLE_TAVILY=true`. The direct database migration URL stays local. Keep `ENABLE_LIVE_AI=false` and `ENABLE_MAPS=false`. Never put server credentials in `NEXT_PUBLIC_*` variables or browser code.

A teammate running locally must receive credentials through a private secret-sharing channel and place them in their own ignored environment file. GitHub Actions secrets are unnecessary for the current deployment because the app runs on Vercel; no credentials were copied into GitHub.

## Repository and access

The repository was observed to be public on October 28; this setup pass did not change its visibility. The feature preview remains Vercel-login protected. The pending public-access exception was canceled under the owner's zero-dollar priority. No main-branch merge or production release was performed.

The local tracked source tree matched the GitHub feature branch before this documentation update. A scan for the exact configured local credentials found no matches in tracked files. `.env.local` is ignored; `.env.example` is the only tracked environment file. These checks cover the current feature snapshot, not an audit of every branch or historical commit.

Current billing observations are not a guarantee against future account changes. Do not add paid plans, payment methods, auto-reload, or usage-based overages without explicit owner approval.

# GloveBox release readiness — October 25, 2026

The non-AI core works. The hackathon entry is not yet submission-ready because the required live NVIDIA model on Nebius remains disabled at the owner's request. Do not count optional provider accounts as official eligibility requirements.

## Official requirements

| Requirement | Status / next action |
| --- | --- |
| Working demo | Feature preview deployed; latest Neon setup release undergoing hosted acceptance. |
| NVIDIA open-source model running on Nebius | Paused by owner. Must enable and demonstrate actual runtime inference before submission. |
| Public source and open-source license | MIT license present. Repository remains private per owner instruction; public release needs owner approval. |
| English description and setup | README and submission draft prepared. Final NVIDIA model ID and deployed evidence pending. |
| Public YouTube demo under 3 minutes | Recording script prepared; recording and upload pending, after live AI verification. |
| Sponsor feedback | Observed prior test notes prepared; finalize from real usage. |
| Team | Both teammates registered per owner. Confirm eligibility and team representative. |
| Devpost submission | Owner must review and submit by October 30, 2026, 10 a.m. Pacific. Target October 29 evening. |
| Availability | Keep the submitted demo accessible through December 15, 2026 judging. |

Sources: https://nebiusglobalaihackathon.devpost.com/ and https://nebiusglobalaihackathon.devpost.com/rules

## Verified non-AI release work

- Combined dashboard with Overview, Records, Trips & gas, and Guidance tabs.
- Local maintenance history, source notes, deterministic detour calculations, backup/restore, and live Open-Meteo weather.
- One-time local-to-empty-cloud copy with archive preservation; no automatic ongoing sync.
- Neon authentication and deploy successful; pooled app URL and direct migration URL loaded privately.
- Database schema applied: nudges, proposals, schedule_items, vehicles, weather_checks.
- Production build passed. Real Neon HTTP test passed save/read, eight reminders, service-note preservation, existing-car protection, visitor isolation, cloud dashboard rendering, weather opt-in/out, and isolated fixture cleanup.
- AI stays disabled. No inference or paid provider calls made.

## Optional backlog, not official submission gates

Google Places/Routes/Embed, EIA regional prices, and Tavily source search need provider credentials and live acceptance. Daily weather jobs need explicit activation and a protected scheduler; Vercel cron runs on production deployments. Account login, automatic synchronization, and verified automatic station-price extraction are outside the current working demo.

## Neon changes and failure record

Added neon.ts and Neon configuration dependencies; ignored .neon; documented DATABASE_URL_UNPOOLED; migrations prefer the direct URL; added verify:neon. Build uses webpack. TypeScript scripts now request type stripping explicitly for Node 22.13.

Global Neon install previously failed on permissions, so npx was used. Initial authentication timed out; subsequent login succeeded. Migration initially failed with ERR_UNKNOWN_FILE_EXTENSION on .mts; explicit type stripping fixed it. The existing Neon skills and MCP plugin were already installed; no duplicate configuration was added. MCP tools are not exposed in this session, so the authenticated CLI was used.

Production Git main and PR merge state are unchanged. Database branch production is the explicitly selected Neon branch, independent of Git/Vercel production.

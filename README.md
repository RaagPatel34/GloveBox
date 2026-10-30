# GloveBox

Your car’s upkeep and trip costs, with the reasoning in plain sight.

Built for the **Nebius x NVIDIA Global AI Hackathon — Best Apps and Agents**. Live inference is off by default (`ENABLE_LIVE_AI=false`) until Nebius credits are available; a local Qwen model can stand in during development (see below). The core product needs no AI key.

## What works

- Add your own liquid-fuel car, mileage, city, and MPG. Optional EPA vehicle lookup has a manual fallback.
- Record completed services, update the odometer, and set time/mileage intervals with source links and conditions.
- See due, overdue, and unknown-history states. No history is treated as “unknown,” not “healthy.”
- Review clearly labeled sample suggestions; Apply/Dismiss never marks a service complete.
- Compare gas-detour savings, extra fuel use, and optional time cost using deterministic math.
- Open manually entered stops in Google Maps. Distances and prices are entered by the user, not fetched or claimed to be live.
- Save locally, export a JSON backup, and validate it before restoring. Restoring asks before it replaces your garage; resetting the demo car offers Undo.
- Plan a trip: type up to eight stops (or say your errands in the command bar), get an ordered Google Routes drive from home and back, miles, and a fuel cost from the car's MPG and the EIA weekly price. A planned trip can be drawn on a Google Directions map behind a Load route map button.
- Saving a new car looks up its manufacturer service intervals with Tavily and shows each with a link to its source; your own intervals are never replaced.
- View NHTSA tire-care guidance and an applicable Honda sedan reference. User-entered sources are labeled as user records, not independently verified.

## Run

Use Node 22.13+ (Node 22 LTS is configured for CI).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Choose **Add my car** or **Load demo car**. The app has four pages:

| Route | Page | What lives there |
| --- | --- | --- |
| `/` | Dashboard | The next thing your car needs, the drive review and its suggestions, everything else coming up, the weather check |
| `/log` | Service log | Service history, record a service, update the odometer, mileage forecast |
| `/trips` | Trips | Trip agent, route planner with map, and the gas-detour calculator |
| `/car` | Car & settings | Add or replace your car, intervals and sources, backup and restore, copy to the cloud garage, AI status |

On a desktop the car, its odometer and its status counts stay in a rail on the left; on a phone they fold into a top strip with a tab bar at the bottom. Core features work without credentials; optional EPA lookup requires network access. Sample suggestions run locally in the browser.

For a fast walkthrough, load the demo, try the dirt-road command, apply a reminder, then use the gas-detour example. Example prices are illustrative. Try a $20/hour time value and see the detour verdict change.

## Real maintenance records

For a new vehicle, most items have no presumed interval. Enter guidance from your manual, then the date/mileage of the last completed service. If both time and distance thresholds are supplied, whichever comes first determines status. Tire-pressure checks use a 30-day reminder based on [NHTSA’s monthly-check guidance](https://www.nhtsa.gov/vehicle-safety/tires).

Recording an older service adds history without rolling a newer schedule backward. Service mileage cannot exceed the recorded odometer. Duplicate records and inconsistent date/mileage histories are rejected. Planned trips never change the odometer.

One vehicle per browser. Data does not sync across devices or between localhost and the deployed domain. Export before replacing your garage. The app supports liquid-fuel cost estimates, not EV charging or plug-in hybrid energy modeling.

## Weather and trip providers

On the Dashboard, choose **Live · Nemotron** to plan errands under the command input using your browser garage. Errands require both `NEBIUS_MODEL_NANO` and `NEBIUS_MODEL_SUPER`, plus the Maps/EIA settings below. Sample mode keeps the local dirt-road example; existing Super-only configurations can still review drives. No cloud copy or database is needed for browser-garage errands.

The Dashboard includes your teammate’s Open-Meteo forecast and air-quality rules. Search a US city or ZIP code and explicitly check its conditions. This uses no AI or paid key; incomplete or unavailable conditions are labeled. Forecast guidance never changes your records automatically.

The command bar takes errands too: “gas, car wash and Trader Joe's” goes through the router (Nano) to the same trip agent and shows the plan under the bar. Gas and car-wash stops are real stations and washes found near home with Google Places (the candidates are kept for the detour verdict), and a named place resolves to the one near home. The Trips page opens with the trip agent: type up to eight stops and Nemotron Super looks them up, Google Routes orders the drive from home and back, and code prices the fuel from the car's MPG and the EIA Los Angeles weekly price (California's as a fallback), shown with its source and week. When a gas stop finds more than one station near home, the trip runs on Ultra instead ([#15](https://github.com/RaagPatel34/GloveBox/issues/15)): it prices up to three stations with Tavily (a station's own price when a dated result names it, otherwise an area figure, otherwise the EIA average, with no error shown when Tavily fails), and code says whether the cheapest is worth the extra miles on a 10-gallon fill-up. The verdict only compares two station prices; a worth-it detour reroutes the drive through that station. With one gas option the trip stays on Super. Every price shows its kind, date and source. It needs live AI, `ENABLE_MAPS=true`, `GOOGLE_MAPS_API_KEY` and `EIA_API_KEY`; station and area prices also need `ENABLE_TAVILY=true` and `TAVILY_API_KEY`, and Ultra needs `NEBIUS_MODEL_ULTRA`. Below it, the manual planner includes place search, ordered driving routes, route fuel costs, and a California weekly EIA price lookup. Google Places/Routes remain off unless both `ENABLE_MAPS=true` and `GOOGLE_MAPS_API_KEY` are set. Set provider quotas and restrictions before opting in. EIA needs `EIA_API_KEY`; its results are regional weekly estimates, never station quotes. These adapters are tested with fixtures; hosted live acceptance awaits those credentials. The route map needs `NEXT_PUBLIC_GOOGLE_MAPS_KEY`, a browser key restricted to the Embed API and your domain; without it the stop list and an Open in Google Maps link remain. Manual stops, Maps links, entered prices and detour calculations remain available.

## Reconciled cloud garage

Every page reads one garage: the one saved in your browser. `/garage` is the optional cloud garage (dashboard, setup, visitor identity, Postgres persistence), reached from Car & settings. The two are separate: local records are never uploaded or replaced automatically; **Copy to the cloud garage** on Car & settings is the explicit path.

Neon Postgres is configured locally and its schema was applied on October 25. `npm run verify:neon` passed against the production-mode local app and real Neon: HTTP save/read, visitor isolation, overwrite protection, dashboard rendering, weather consent persistence, and cleanup. The feature preview has a branch-specific `DATABASE_URL`; redeploy and verify the hosted flow after changing it. App queries use the existing Neon serverless HTTP driver. Migrations prefer `DATABASE_URL_UNPOOLED`. For your own deployment, configure these privately, run `npm run db:migrate`, build and start the app, then run `npm run verify:neon` against localhost. Never commit environment files.

Weekly mileage and planned trips now project reminder urgency in the local garage. The recorded odometer and completed-service mileage remain actual readings; planned miles never count as completed driving. Legacy backups remain compatible.

## NVIDIA / Nebius integration

The existing `/api/command` route uses a configured NVIDIA Nemotron model through Nebius Token Factory. It validates bounded structured tool arguments and returns pending suggestions; the model cannot write the schedule directly. This integration previously passed a real local tool-round-trip and maintenance-proposal test.

**Currently disabled:** `ENABLE_LIVE_AI=false`. This switch is enforced on the server, even if a key is saved. No Nebius calls are required by the tests or normal offline preview.

When credits are available:

1. Configure a fresh private `NEBIUS_API_KEY` and the base URL in `.env.local`.
2. Run `npm run smoke` to list accessible model IDs. With no selected model, this intentionally exits after listing them.
3. Set `NEBIUS_MODEL_SUPER` to the chosen NVIDIA Nemotron ID and rerun the smoke test. It incurs two inference calls per configured model.
4. Set `ENABLE_LIVE_AI=true`, restart, and test **Live · Nemotron**.
5. Add shared request metering and a spending budget before exposing paid inference publicly. See [deployment instructions](docs/DEPLOYMENT.md).

### Local Qwen3.5 stand-in (no credits)

Any OpenAI-compatible server works. Run [Ollama](https://ollama.com/) on the same PC as `npm run dev`, run `ollama pull qwen3.5:4b`, and set these in `.env.local`:

```dotenv
NEBIUS_BASE_URL=http://localhost:11434/v1/
NEBIUS_API_KEY=ollama
NEBIUS_MODEL_NANO=qwen3.5:4b
NEBIUS_MODEL_SUPER=qwen3.5:4b
NEBIUS_MODEL_ULTRA=qwen3.5:4b
NEBIUS_REASONING_EFFORT=none
```

All three tiers share one model, a development substitute for the Nemotron tiers. `NEBIUS_REASONING_EFFORT=none` stops Qwen thinking first (about 5 s a reply instead of 20 s, under the 25 s timeout). Run `npm run smoke` for tool calling and `npm run eval:router` for command classification, then restart `npm run dev`. A Vercel deployment cannot reach `localhost`; it needs a hosted endpoint. To return to Nebius, restore its endpoint, key and model IDs and clear the reasoning setting.

The smoke script is an explicit integration test and makes calls when invoked with credentials regardless of the application’s enable switch. Do not run it while credit use is deferred.

## Architecture

- `src/app/(garage)/`: the four pages and their shared layout (rail, phone strip, tab bar, page transitions).
- `src/components/garage/GarageProvider.tsx`: the browser garage every page reads through `useGarage()`: load, validate, save, demo reset with Undo.
- `src/components/dashboard/`: Next up hero, drive review with suggestion cards, Coming up tiles.
- `src/components/motion/`: rolling odometer readouts, tile reordering, the once-per-visit ignition sweep (CSS, gated by reduced motion).
- `src/lib/garage-view.ts`: maps the browser garage onto the dashboard model and words the "Why this date?" basis.
- `/garage`: optional cloud dashboard and setup with anonymous visitor identity and Postgres storage.
- `/api/cloud-command`: upstream Nano/Super command router, guarded by the same live-AI switch.
- `src/components/garage-tools.tsx`: car setup, service history, record a service, odometer, mileage forecast, intervals, backup/restore (one export per tool).
- `/api/plan-trip` and `src/lib/agent/trip.ts`: the trip agent (Super, or Ultra when there is more than one gas station to weigh) behind the Trips panel; `src/lib/gas-price.ts` prices gas from Tavily with the EIA fallback.
- `src/components/trip-planner.tsx`: local trip-cost and detour comparison.
- `src/lib/garage.ts`, `maintenance.ts`, `trip.ts`: validated state transitions and deterministic calculations.
- `/api/vehicle`: bounded, fixed-host EPA lookup with timeout and manual fallback.
- `/api/config`: public feature availability, never credentials.
- `/api/command`: optional model call, disabled by default.

## Verify

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

GitHub Actions runs these checks without credentials. The tests cover reminders, service chronology, source validation, backup data, stale proposals, and detour edge cases. Browser checks cover vehicle entry, service records, persistence, disabled AI, and the calculator.

Browser verification covered the complete EPA flow: 2019 Honda → Civic 4Dr → engine/transmission selection → 33 combined MPG for the selected configuration. Manual MPG entry is also verified. Recheck external lookup from the deployed host.

## Deploy and submit

- [Vercel setup and release checklist](docs/DEPLOYMENT.md)
- [Submission working copy](docs/SUBMISSION.md)
- [2:45 demo recording script](docs/DEMO-SCRIPT.md)
- [Real-user testing worksheet](docs/USER-TEST.md)
- [Original product roadmap](docs/SPEC.md)

Public video: pending. The stable hosted URL and the funded Nemotron run are tracked in [#4](https://github.com/RaagPatel34/GloveBox/issues/4). A sample-only preview is **not** a complete hackathon entry; restore and verify real NVIDIA/Nebius runtime usage before submission.

## Not implemented

The detour verdict on live Tavily prices ([#15](https://github.com/RaagPatel34/GloveBox/issues/15)) is tested with fixtures and the demo's illustrative station prices; it has not run against live Tavily, Maps and Ultra together. Odometer-photo reading ([#17](https://github.com/RaagPatel34/GloveBox/issues/17)) and account authentication are not implemented. The opt-in daily weather job ([#16](https://github.com/RaagPatel34/GloveBox/issues/16)) is code only: it needs a migrated database, `CRON_SECRET` and a production release. Provider-backed features need their keys and hosted acceptance before you call them live. See the [issue status](docs/ISSUE-STATUS.md) for what is merged, what is open and the delivery order.

## Cloud copy and source search

Records includes an explicit copy into an empty cloud garage and download of the original transferred archive. Existing cloud cars are never overwritten; later edits do not sync. The complete original history is preserved, with old proposals archived rather than reactivated.

Trips includes optional Tavily source search and the trip agent's station and area prices (ENABLE_TAVILY + TAVILY_API_KEY; no generated answer; a price counts only with a date from the last week), and saving a new car runs one Tavily search for its manufacturer service intervals (each shown with a link to its source; the owner's own intervals are never replaced) and Google directions embed (NEXT_PUBLIC_GOOGLE_MAPS_KEY restricted to the Embed API and website domains). Both wait for account setup. Search excerpts must not be represented as verified station quotes.

## Daily weather

Migrate the schema, configure CRON_SECRET privately and ENABLE_DAILY_WEATHER=true, and obtain per-car consent in /garage. Vercel cron runs production only. The bounded hackathon batch covers at most 10 cars per invocation, prioritizes oldest eligible work, and prevents duplicate checks within 24 hours. No AI, email or push notifications. Keep disabled until hosted verification and release approval. See docs/NON-AI-HANDOFF.md.

## Neon setup verification

The Neon CLI requires Node 22.20 or newer; app verification also supports Node 22.13 using explicit TypeScript stripping for scripts. `neon deploy` pulls the database variables into `.env.local`; it does not configure Vercel automatically. Keep `ENABLE_LIVE_AI=false` while AI is paused. See [release readiness](docs/RELEASE-READINESS.md) for official submission gates.

## License

[MIT](LICENSE)

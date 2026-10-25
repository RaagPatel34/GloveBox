# GloveBox

Your car’s upkeep and trip costs, with the reasoning in plain sight.

Built for the **Nebius x NVIDIA Global AI Hackathon — Best Apps and Agents**. Live inference is currently paused at the team’s request until credits are available. The core product needs no AI key.

## What works

- Add your own liquid-fuel car, mileage, city, and MPG. Optional EPA vehicle lookup has a manual fallback.
- Record completed services, update the odometer, and set time/mileage intervals with source links and conditions.
- See due, overdue, and unknown-history states. No history is treated as “unknown,” not “healthy.”
- Review clearly labeled sample suggestions; Apply/Dismiss never marks a service complete.
- Compare gas-detour savings, extra fuel use, and optional time cost using deterministic math.
- Open manually entered stops in Google Maps. Distances and prices are entered by the user, not fetched or claimed to be live.
- Save locally, export a JSON backup, and validate it before restoring. Reset/restore explicitly warns before replacement.
- View NHTSA tire-care guidance and an applicable Honda sedan reference. User-entered sources are labeled as user records, not independently verified.

## Run

Use Node 22.13+ (Node 22 LTS is configured for CI).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Choose **Add my car** or **Load demo car**. Core features work without credentials; optional EPA lookup requires network access. Sample suggestions run locally in the browser.

For a fast walkthrough, load the demo, try the dirt-road command, apply a reminder, then use the gas-detour example. Example prices are illustrative. Try a $20/hour time value and see the detour verdict change.

## Real maintenance records

For a new vehicle, most items have no presumed interval. Enter guidance from your manual, then the date/mileage of the last completed service. If both time and distance thresholds are supplied, whichever comes first determines status. Tire-pressure checks use a 30-day reminder based on [NHTSA’s monthly-check guidance](https://www.nhtsa.gov/vehicle-safety/tires).

Recording an older service adds history without rolling a newer schedule backward. Service mileage cannot exceed the recorded odometer. Duplicate records and inconsistent date/mileage histories are rejected. Planned trips never change the odometer.

One vehicle per browser. Data does not sync across devices or between localhost and the deployed domain. Export before replacing your garage. The app supports liquid-fuel cost estimates, not EV charging or plug-in hybrid energy modeling.

## Weather and trip providers

The Overview tab includes your teammate’s Open-Meteo forecast and air-quality rules. Search a US city or ZIP code and explicitly check its conditions. This uses no AI or paid key; incomplete or unavailable conditions are labeled. Forecast guidance never changes your records automatically.

Trips & gas now includes place search, ordered driving routes, route fuel costs, and a California weekly EIA price lookup. Google Places/Routes remain off unless both `ENABLE_MAPS=true` and `GOOGLE_MAPS_API_KEY` are set. Set provider quotas and restrictions before opting in. EIA needs `EIA_API_KEY`; its results are regional weekly estimates, never station quotes. These adapters are tested with fixtures; hosted live acceptance awaits those credentials. Manual stops, Maps links, entered prices and detour calculations remain available.

## Reconciled cloud garage

The feature branch incorporates main through `b5da2e0` plus proposal PR #27 (`d16c1ec`) and weather PR #28 (`c74e55e`). The original local garage remains at `/`; `/garage` contains the newer cloud dashboard, setup, visitor identity, and Postgres persistence. These garages are separate: local records are never uploaded or replaced automatically.

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

The smoke script is an explicit integration test and makes calls when invoked with credentials regardless of the application’s enable switch. Do not run it while credit use is deferred.

## Architecture

- `src/components/local-garage.tsx`: local dashboard, browser persistence, proposal review.
- `/garage`: upstream cloud dashboard and setup with anonymous visitor identity and Postgres storage.
- `/api/cloud-command`: upstream Nano/Super command router, guarded by the same live-AI switch.
- `src/components/garage-tools.tsx`: vehicle setup, service records, intervals, backup/restore.
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

[Feature-branch preview](https://glove-box-git-codex-first-working-flow-glovebox2.vercel.app/) is deployed. Public video: pending. The repository is still private. A sample-only preview is **not** a complete hackathon entry; restore and verify real NVIDIA/Nebius runtime usage before submission.

## Not implemented

Verified automatic station-price discovery and account authentication are not implemented. Tavily source search and opt-in daily weather job code are implemented, but require provider configuration and hosted acceptance before claiming them live. See the [issue acceptance audit](docs/ISSUE-STATUS.md) for implemented work, gaps, and delivery order. The current preview covers own-car upkeep and manually sourced detour comparison.

## License

[MIT](LICENSE)

### October 24 integration follow-up

Records includes an explicit copy into an empty cloud garage and download of the original transferred archive. Existing cloud cars are never overwritten; later edits do not sync. The complete original history is preserved, with old proposals archived rather than reactivated.

Trips includes optional Tavily source search (ENABLE_TAVILY + TAVILY_API_KEY; no generated answer) and Google directions embed (NEXT_PUBLIC_GOOGLE_MAPS_KEY restricted to the Embed API and website domains). Both wait for account setup. Search excerpts must not be represented as verified station quotes.

Daily weather: migrate the schema, configure CRON_SECRET privately and ENABLE_DAILY_WEATHER=true, and obtain per-car consent in /garage. Vercel cron runs production only. The bounded hackathon batch covers at most 10 cars per invocation, prioritizes oldest eligible work, and prevents duplicate checks within 24 hours. No AI, email or push notifications. Keep disabled until hosted verification and release approval. See docs/NON-AI-HANDOFF.md.

## Neon setup verification

The Neon CLI requires Node 22.20 or newer; app verification also supports Node 22.13 using explicit TypeScript stripping for scripts. `neon deploy` pulls the database variables into `.env.local`; it does not configure Vercel automatically. Keep `ENABLE_LIVE_AI=false` while AI is paused. See [release readiness](docs/RELEASE-READINESS.md) for official submission gates.

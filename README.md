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

- `src/app/page.tsx`: dashboard, browser persistence, proposal review.
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

Demo URL and public video: pending. The repository is still private. A sample-only preview is **not** a complete hackathon entry; restore and verify real NVIDIA/Nebius runtime usage before submission.

## Not implemented

Automatic station-price discovery, route optimization, weather nudges, Tavily, scheduled jobs, accounts, and server-side garage storage. Those are roadmap ideas, not claims about this build. The current scope is the own-car upkeep workflow and manually sourced detour comparison.

## License

[MIT](LICENSE)

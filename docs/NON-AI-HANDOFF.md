# Non-AI integration handoff — October 23, 2026

## Combined and verified

- Existing tabbed preview plus the teammate's PR #27 proposal cards/store and PR #28 weather/nudge work.
- Main Overview: opt-in US city/ZIP search, real Open-Meteo weather and air-quality check, dated guidance, explicit partial/unavailable states.
- Trips: place search adapter, Google driving route and optional intermediate-stop ordering, deterministic route fuel cost, EIA California weekly regular gasoline lookup. No model participates in these tools.
- Source/region/date labels distinguish regional prices from station quotes. No generated station prices.
- Local Postgres tests run the combined schema twice, save/read cars, check visitor isolation, apply a proposal atomically, reject a duplicate apply, and invalidate nudges after a wash change.
- Existing local backups, records, mileage forecasting and demo continue to work.

## Connections still required

No DATABASE_URL, GOOGLE_MAPS_API_KEY, EIA_API_KEY or TAVILY_API_KEY was present locally. No paid resources were created or paid API calls made.

1. Configure an existing Neon development database privately as DATABASE_URL, run `npm run db:migrate` against it, and repeat the hosted cloud walkthrough. The local PGlite tests do not prove network connectivity, permissions or configuration of a hosted database.
2. For Google Places/Routes: configure GOOGLE_MAPS_API_KEY with the required APIs, restrictions and usage quotas. Explicitly set ENABLE_MAPS=true only when usage is authorized. Test a known public-landmark route and place results. Until then the UI offers manual Maps links.
3. Configure EIA_API_KEY for the California weekly regional average. Verify a dated response; never use one regional average to claim a station-to-station saving.
4. Leave ENABLE_LIVE_AI=false. No Nebius smoke tests or funded inference were run.

## Still outside this completed pass

- Local and cloud garages remain separate stores; migrating/connecting an existing garage requires a deliberate data-transfer flow after a database is available. Do not silently overwrite either dataset.
- Tavily station-price extraction/manufacturer search, embedded maps, daily scheduler, and odometer photo remain optional backlog work. Provider-free manual alternatives are not claimed as those integrations.
- Final public-repo release, YouTube demo, registration/team confirmation, sponsor feedback and Devpost submission remain user-owned release steps. Do not publish the private repository or merge main without explicit authorization.
- Record the final video only once the real funded AI path is enabled and verified; don't present sample suggestions as live inference.

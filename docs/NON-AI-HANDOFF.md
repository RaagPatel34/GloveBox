# Non-AI integration handoff — October 24, 2026

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

- Records now includes an explicit one-time copy into an empty cloud garage. New database IDs prevent collisions. The full transferred service/proposal history is retained as a downloadable archive; active cloud reminders preserve source notes and mileage forecasts. Copy refuses an existing cloud car. This is not ongoing synchronization: later cloud edits are not in the original archive, and old proposals are not reactivated. Local records remain unchanged. Database acceptance still required.
- Embedded Google directions map is implemented behind a separate domain-restricted browser key and a user Load map button. Live map acceptance remains blocked on account setup.
- Tavily source search is implemented behind ENABLE_TAVILY and its key, requesting no generated answer. It returns source links and excerpts, not verified station quotes. Automatic trustworthy price extraction and manufacturer lookup remain unfinished.
- Daily weather route and Vercel schedule are implemented. Requires migrated database, ENABLE_DAILY_WEATHER=true, a private CRON_SECRET, and per-car user consent. Vercel invokes production only; feature previews do not run automatically. This hackathon implementation claims at most 10 oldest eligible cars per invocation, once per 24 hours; scale/paginate before enabling for more than 10 users. Failures retry on a later daily run, manual checks remain available. No email/push notifications. Unresolved local coordinates (0,0) cannot opt in.
- Odometer photo remains AI/stretch scope and is excluded.
- Final public-repo release, YouTube demo, registration/team confirmation, sponsor feedback and Devpost submission remain user-owned release steps. Do not publish the private repository or merge main without explicit authorization.
- Record the final video only once the real funded AI path is enabled and verified; don't present sample suggestions as live inference.

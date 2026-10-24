# Connect the remaining services

Keep AI disabled throughout. Add secrets directly to provider dashboards and Vercel, never to chat, GitHub, screenshots, or NEXT_PUBLIC variables (except the deliberately public, restricted map embed key).

## 1. Neon — start here

Create a free account at https://console.neon.tech/ and a GloveBox project. Stay on Free; no upgrade is needed for this demo. Create a development branch for this preview. Use its connection dialog to copy the Postgres connection string privately.

In Vercel → glovebox2 → glove-box → Settings → Environment Variables, add DATABASE_URL for Preview, restricted to codex/first-working-flow. Paste the connection string as the value. Do not put it in a NEXT_PUBLIC variable. Leave production unchanged.

The schema must be installed before the cloud UI works. Tell the collaborator when the project exists; then use the Neon SQL Editor with the reviewed schema, or privately configure local .env.local for the migration script. Never paste the password into chat. Redeploy the feature preview after adding the variable. Test with the fictional demo car before copying real records.

Cloud access currently uses an anonymous browser identity, not user accounts. Clearing that identity loses access. Keep exported backups.

## 2. EIA — regional fuel averages

Request an API key at https://www.eia.gov/opendata/register.php. Enter EIA_API_KEY privately in the same Vercel Preview environment and redeploy. Test the California weekly average and its reporting date. This does not provide station-level prices.

## 3. Google — discuss billing before enabling

Create a Google Cloud project and review Maps billing/quotas before enabling anything. Routes and Places can incur usage charges. Budget alerts are not hard spending caps. Do not enable live calls until the owner approves the usage plan.

Use a server-only key for Routes and Places (and Geocoding if used), restricted to only needed APIs. Put it in GOOGLE_MAPS_API_KEY. Keep ENABLE_MAPS=false until restrictions and quotas are set.

For the embedded map, use a separate browser key restricted to Maps Embed API and the exact preview website referrer. Store it as NEXT_PUBLIC_GOOGLE_MAPS_KEY. This key is intentionally public; never reuse the server key. Redeploy after adding it. The map only loads after the visitor clicks Load route map.

## 4. Tavily — source search

Create an account at https://app.tavily.com/. Review the available credits and disable any automatic spending before testing. Add TAVILY_API_KEY privately and set ENABLE_TAVILY=true only once usage is approved. The app requests basic search with no generated answer. Search excerpts require station/grade/date/conditions verification; they are not certified pump prices.

## 5. Daily weather — after database and release acceptance

A production release must be separately authorized; do not merge main or change the production branch just to activate this. Configure a strong random CRON_SECRET and ENABLE_DAILY_WEATHER=true privately on the production environment when ready. Users separately opt in from the cloud garage; only resolved locations qualify.

The current bounded job handles at most ten eligible cars per invocation. Vercel's daily production schedule does not run on preview deployments. Timing is approximate on Hobby. Test secret rejection, successful processing, repeat-call deduplication and opt-out before launch. No email/push messages are sent.

## References

- Neon console: https://neon.com/docs/get-started/signing-up
- Google embed: https://developers.google.com/maps/documentation/embed/embedding-map
- Tavily search: https://docs.tavily.com/documentation/api-reference/endpoint/search
- Vercel cron: https://vercel.com/docs/cron-jobs

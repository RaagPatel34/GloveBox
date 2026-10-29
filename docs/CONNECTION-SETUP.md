# Service connections

**October 28 status:** Neon, EIA and Tavily are connected and verified on the feature preview. Google Maps and AI remain disabled under the zero-dollar policy. See [current connection status and secret handling](API-CONNECTION-STATUS.md). The provider setup steps below also apply to new environments.

Keep AI disabled throughout. Add secrets directly to provider dashboards and Vercel, never to chat, GitHub, screenshots, or NEXT_PUBLIC variables (except the deliberately public, restricted map embed key).

## 1. Neon — connected and verified October 25

The selected Neon project is authenticated and deployed. Its production database branch was explicitly requested by the owner; it is independent of Git main and Vercel production. The schema is applied. Local production-mode verification passed real database save/read, visitor isolation, overwrite protection, dashboard rendering and weather preference persistence.

DATABASE_URL is privately stored for Vercel Preview, restricted to codex/first-working-flow. The feature deployment passed, and a fictional car copied through the hosted UI reloaded successfully from Neon. DATABASE_URL_UNPOOLED remains local for migrations. Existing AI settings remain disabled.

For another environment: privately configure its database URLs, run `npm run db:migrate`, build and start, then run `npm run verify:neon` against localhost. Never paste passwords into chat or GitHub. Neon CLI needs Node 22.20 or newer; use npx if global installation is unavailable.

Cloud access uses an anonymous browser identity, not user accounts. Clearing that identity loses access. Keep exported backups. Local-to-cloud copy is one-time; later edits do not sync.

## 2. EIA — regional fuel averages

The feature preview is connected; the hosted lookup returned $5.888/gal for the week of 2026-10-26. For a new environment, request an API key at https://www.eia.gov/opendata/register.php. Enter EIA_API_KEY privately in the same Vercel Preview environment and redeploy. Test the California weekly average and its reporting date. This does not provide station-level prices.

## 3. Google — discuss billing before enabling

The GloveBox Google Cloud project has no linked billing account and Maps stays disabled. For any future setup, review Maps billing/quotas before enabling anything. Routes and Places can incur usage charges. Budget alerts are not hard spending caps. Do not enable live calls until the owner approves the usage plan.

Use a server-only key for Routes and Places (and Geocoding if used), restricted to only needed APIs. Put it in GOOGLE_MAPS_API_KEY. Keep ENABLE_MAPS=false until restrictions and quotas are set.

For the embedded map, use a separate browser key restricted to Maps Embed API and the exact preview website referrer. Store it as NEXT_PUBLIC_GOOGLE_MAPS_KEY. This key is intentionally public; never reuse the server key. Redeploy after adding it. The map only loads after the visitor clicks Load route map.

## 4. Tavily — source search

The feature preview is connected and returned five source links in the hosted acceptance test. Its Free plan stops at the credit limit with pay-as-you-go off. For a new environment, create an account at https://app.tavily.com/. Review the available credits and disable any automatic spending before testing. Add TAVILY_API_KEY privately and set ENABLE_TAVILY=true only once usage is approved. Trips requests basic search (1 credit) with no generated answer. Saving a new car on Car & settings also runs one advanced search (2 credits, still no generated answer) to find the manufacturer service schedule, in the background after the car is saved; if it fails or times out the car is unaffected. Both only run when ENABLE_TAVILY=true. Search excerpts require station/grade/date/conditions verification; they are not certified pump prices.

## 5. Daily weather — after database and release acceptance

A production release must be separately authorized; do not merge main or change the production branch just to activate this. Configure a strong random CRON_SECRET and ENABLE_DAILY_WEATHER=true privately on the production environment when ready. Users separately opt in from the cloud garage; only resolved locations qualify.

The current bounded job handles at most ten eligible cars per invocation. Vercel's daily production schedule does not run on preview deployments. Timing is approximate on Hobby. Test secret rejection, successful processing, repeat-call deduplication and opt-out before launch. No email/push messages are sent.

## References

- Neon console: https://neon.com/docs/get-started/signing-up
- Google embed: https://developers.google.com/maps/documentation/embed/embedding-map
- Tavily search: https://docs.tavily.com/documentation/api-reference/endpoint/search
- Vercel cron: https://vercel.com/docs/cron-jobs

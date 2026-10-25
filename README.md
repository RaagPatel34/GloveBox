# GloveBox

> Your car's co-pilot for upkeep and trip costs. Tell it what happened; it tells you what's due, when to do it, and what the drive will cost.

Built for the [Nebius x NVIDIA Global AI Hackathon](https://nebiusglobalaihackathon.devpost.com/), **Best Apps & Agents** track.

**Live demo:** _TBD_ · **Video:** _TBD_ · **Spec:** [docs/SPEC.md](docs/SPEC.md)

## What it does

_TBD: one paragraph, what / why / for whom._

## How it works

_TBD: architecture diagram + the command-bar → router → agent flow._

## How we used NVIDIA Nemotron

| Model | Job | Why |
|---|---|---|
| Nemotron 3 Nano | Router: classifies command-bar input, extracts fields | _TBD_ |
| Nemotron 3 Super | Maintenance agent: proposes schedule changes with reasons | _TBD_ |
| Nemotron 3 Ultra | Trip agent: stop order, gas choice, detour verdict | _TBD_ |

## Where Nebius Token Factory helped

_TBD: OpenAI-compatible client, tool calling, switching models per task._

## Other Nebius services

_TBD: Serverless Job for daily nudges (or why we fell back)._

## Tavily

_TBD: live gas prices and manufacturer schedules, shown with source + timestamp._

## Running locally

Requires Node 22+.

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run smoke                # lists Nemotron models + tests tool calling on each
npm run dev                  # http://localhost:3000
```

| Env var | Used for |
|---|---|
| `NEBIUS_API_KEY`, `NEBIUS_BASE_URL` | Nebius Token Factory |
| `NEBIUS_MODEL_NANO` / `_SUPER` / `_ULTRA` | Exact model IDs (get them from `npm run smoke`) |
| `TAVILY_API_KEY` | Gas prices, manufacturer schedules |
| `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Geocoding, Places, Routes, map |
| `DATABASE_URL` | Postgres (Neon or Supabase) |
| `EIA_API_KEY` | Weekly CA / LA gas price fallback |

## Database

Postgres on [Neon](https://neon.tech), reached over HTTPS with `@neondatabase/serverless` (works on Vercel without a connection pool). Set `DATABASE_URL` (the pooled connection string from the Neon dashboard), then:

```bash
npm run db:migrate
```

This applies the schema in [src/lib/db/schema.ts](src/lib/db/schema.ts) (`vehicles` and `schedule_items`) using `CREATE ... IF NOT EXISTS`, so it is idempotent. Run it once per database, including the production one, before the first deploy: `DATABASE_URL=<prod url> node --env-file-if-exists=.env.local scripts/migrate.mts`, or put the production URL in `.env.local` temporarily.

There are no accounts. Each browser gets a random visitor ID (kept in `localStorage`, mirrored to a `gb_visitor` cookie so the server can read it) and its car is stored under that ID. A different browser, or cleared site data, starts fresh.

## Limitations

- Gas prices are best-effort and always shown with source and timestamp
- US only (MPG, $/gal, EPA data)
- Default maintenance intervals are general baselines; check your owner's manual

## Feedback on Nebius & NVIDIA

_TBD: required for submission._

## License

[MIT](LICENSE)

### Life-event suggestions

After running `npm run db:migrate` (including on an existing database), load the demo car
and submit “camping trip, 300 miles on dirt roads”. Nano classifies the command; Super can
read the schedule and propose earlier due points, but cannot log service or change the
odometer for an event. Each card shows its old/new due point, reason, and Super badge.
Apply saves the new schedule and refreshes the dashboard; Dismiss removes the card.
Pending, applied, and dismissed states survive reloads. If another action has changed the
item since the suggestion was created, Apply asks you to dismiss the stale suggestion.

This flow requires configured Nano and Super models. Tests use scripted model tool calls
and local Postgres via PGlite; they do not establish live model reasoning quality.

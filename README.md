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

## Limitations

- Gas prices are best-effort and always shown with source and timestamp
- US only (MPG, $/gal, EPA data)
- Default maintenance intervals are general baselines; check your owner's manual

## Feedback on Nebius & NVIDIA

_TBD: required for submission._

## License

[MIT](LICENSE)

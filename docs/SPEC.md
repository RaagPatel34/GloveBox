# GloveBox — Spec

> Your car's co-pilot for upkeep and trip costs. Tell it what happened; it tells you what's due, when to do it, and what the drive will cost.

**Hackathon:** Nebius x NVIDIA Global AI Hackathon — **Best Apps & Agents** track
**Deadline:** Thu Oct 30, 2026 @ 10:00am PDT — **our target: submit Thu Oct 29 evening**
**Team:** 2 people · **Region:** US only (demo in Buena Park / Santa Ana, CA)

---

## Hard requirements (from the rules)

- [ ] Runs on **Nebius Token Factory** and uses at least one **NVIDIA open model** (Nemotron)
- [ ] Public repo with an **open-source license (MIT)** visible at the top
- [ ] README with setup instructions + how we used Nemotron / Token Factory / Tavily / other Nebius services
- [ ] Working demo URL (Vercel)
- [ ] Public YouTube video, **≤ 3 minutes**
- [ ] Project description (what / why / how)
- [ ] Feedback on Token Factory, AI Cloud and NVIDIA models (separate $100 "Most Valuable Feedback" prize)
- [ ] Track selected: Best Apps & Agents · City: none (didn't attend Builders & Brews)

Also going for: **Best Use of Tavily ($3k)**.

---

## The product in one paragraph

A dashboard-first web app. You add your car (year/make/model → EPA MPG from fueleconomy.gov) and odometer reading. GloveBox shows a **health card** for each upkeep item (overdue / due soon / OK). You type into one **command bar**, using either *life events* ("camping trip, 300 mi on dirt roads") or *errands* ("gas, car wash and Trader Joe's before Friday"). For events, Nemotron proposes schedule changes as cards you **Apply** or **Dismiss**, each with a reason. For errands, it plans the route, prices the trip with live gas prices, and tells you whether the cheaper station is **worth the detour**. It also watches the **weather and air quality** and nudges you on its own ("rain Thursday, wash Friday", "smoke advisory, check the cabin air filter").

Plain code does the math; the model does the reasoning. Numbers are always computed by tools, never invented by the model.

---

## Features

### Must ship (never cut)
1. **Car setup**: year/make/model picker (fueleconomy.gov), MPG override, odometer, weekly-miles estimate, home location
2. **Health dashboard**: one card per upkeep item, status + due date/mileage + source of the interval
3. **Command bar → proposal cards**: life event in, Apply/Dismiss cards out, with a reason on each
4. **Weather / air-quality nudge**: rain-aware car-wash timing, smoke/ash → wash + cabin filter
5. **Trip planner**: gas / car wash / any-address stops → ordered route, total miles, fuel cost, **detour verdict**
6. **"Load demo car"** button: a judge gets a populated dashboard in one click
7. **Model badge** on each AI response (Nano / Super / Ultra)

### Nice to have (cut in this order if behind)
1. Odometer photo → reading via `Nemotron-3-Nano-Omni` *(stretch, first to go)*
2. Tavily lookup of the manufacturer's schedule (fall back to the baseline table only)
3. Nebius Serverless Job for daily nudges (fall back to a Vercel cron)
4. Interactive Google Map (fall back to a stop list + static map image)

### Explicitly out of scope
Home/household chores · metric units · logins/accounts · push/email/SMS notifications · native mobile app · time windows, opening hours, multi-day trips · live GPS tracking

---

## Architecture

```
Browser (Next.js app, anonymous ID in localStorage)
   │
   ├── /api/command ──► Router (Nemotron 3 Nano)
   │                       ├── "event" / "service log" ──► Maintenance agent (Nemotron 3 Super)
   │                       └── "errand"               ──► Trip agent (Nemotron 3 Ultra)
   ├── /api/plan-trip ──► Trip agent (Ultra)
   ├── /api/vehicle    ──► fueleconomy.gov
   └── /api/nudges     ◄── Daily job (Nebius Serverless Job, or Vercel cron fallback)

Postgres (Neon or Supabase): vehicles, schedule items, service log, proposals, trips, nudges
```

- **Stack:** Next.js (TypeScript), single app on **Vercel**
- **LLM client:** OpenAI SDK pointed at the Token Factory base URL (OpenAI-compatible)
- **Persistence:** anonymous visitor ID (UUID in localStorage) → rows keyed by that ID. No login.

### Model routing

| Model | Job | Why |
|---|---|---|
| **Nemotron 3 Nano** | Router: classify command-bar input (event / errand / service log), pull out structured fields | Fast, cheap, runs on every keystroke-submit |
| **Nemotron 3 Super** | Maintenance agent: reason over event + schedule + weather → proposals | Medium reasoning, tool calling |
| **Nemotron 3 Ultra** | Trip agent: stop ordering, gas-station choice, detour verdict | Hard multi-step reasoning; only called for trips |
| *Nemotron-3-Nano-Omni* | *Stretch: read odometer from a photo* | Multimodal |

> ⚠️ **Day-1 blocker:** confirm exact model IDs via Token Factory's `/models` endpoint, and confirm **tool calling works on each model** with a 15-minute smoke test. If one model doesn't support tools, move its job to one that does.

Credit saver: only call Ultra when a trip has more than one gas option to choose between; otherwise compute the plan with Super.

---

## Agent tools

### Maintenance agent (Super)
| Tool | Does |
|---|---|
| `getSchedule()` | Current items, last-done, due date/mileage, status |
| `proposeAdjustment(item, newDue, reason)` | Creates a proposal card. **Never changes the schedule directly.** |
| `logService(item, date, odometer)` | "Just got a car wash" → resets that item |
| `updateOdometer(miles)` | Odometer correction from chat |
| `lookupMfrSchedule(vehicle)` | Tavily search for model-specific intervals; returns values + source URL |
| `getWeather(location)` | Open-Meteo forecast (rain, temp) |
| `getAirQuality(location)` | Open-Meteo air-quality API (PM2.5 → smoke/ash) |

### Trip agent (Ultra)
| Tool | Does |
|---|---|
| `geocode(query)` | Google Places / Geocoding |
| `findPlaces(type, near \| alongRoute)` | Gas stations, car washes |
| `getGasPrice(station \| area)` | Tavily best-effort → **EIA Los Angeles / California weekly** fallback; always returns `{price, source, asOf, kind: "station" \| "area" \| "eia"}` |
| `computeRoute(stops, optimize)` | Google Routes API, waypoint optimization |
| `tripCost(miles, mpg, pricePerGal)` | Plain math |
| `detourWorthIt(pricePerGalSavings, gallons, extraMiles, mpg, basePrice)` | Plain math → `{savings, detourCost, net, worthIt}` |

---

## Data model (shared contract, agree on day 1)

```ts
type Vehicle = {
  id: string; visitorId: string;
  year: number; make: string; model: string;
  epaMpg: number; mpgOverride?: number;
  odometer: number; weeklyMiles: number;
  home: { label: string; lat: number; lng: number };
};

type ScheduleItem = {
  id: string; vehicleId: string;
  kind: "wash" | "oil" | "tire_rotation" | "tire_pressure" | "wipers"
      | "cabin_filter" | "engine_filter" | "brake_check";
  intervalDays?: number; intervalMiles?: number;
  lastDoneAt?: string; lastDoneOdometer?: number;
  dueAt?: string; dueOdometer?: number;
  status: "overdue" | "due_soon" | "ok";
  intervalSource: { kind: "baseline" | "manufacturer"; url?: string };
};

type Proposal = {
  id: string; vehicleId: string; itemId: string;
  from: { dueAt?: string; dueOdometer?: number };
  to:   { dueAt?: string; dueOdometer?: number };
  reason: string; model: "nano" | "super" | "ultra";
  state: "pending" | "applied" | "dismissed";
};

type TripPlan = {
  stops: { label: string; type: "gas" | "wash" | "address"; lat: number; lng: number }[];
  totalMiles: number; fuelCost: number;
  gasPrice: { price: number; source: string; asOf: string; kind: "station" | "area" | "eia" };
  detour?: { station: string; savings: number; detourCost: number; net: number; worthIt: boolean };
  model: "super" | "ultra";
};

type Nudge = { id: string; vehicleId: string; text: string; reason: string; createdAt: string };
```

### Baseline interval table (starting defaults, override per owner's manual / Tavily)

| Item | Days | Miles |
|---|---|---|
| Exterior wash | 14 | — |
| Tire pressure check | 30 | — |
| Oil change (synthetic) | 365 | 7,500 |
| Tire rotation | — | 7,500 |
| Wiper blades | 365 | — |
| Cabin air filter | 365 | 15,000 |
| Engine air filter | — | 20,000 |
| Brake inspection | 365 | 12,000 |

Status rule: `overdue` if past due; `due_soon` if within 7 days or 500 miles; else `ok`. Estimated current odometer = last reading + weeklyMiles × weeks elapsed + planned-trip miles.

---

## External services & env vars

| Service | Used for | Env var |
|---|---|---|
| Nebius Token Factory | Nemotron models | `NEBIUS_API_KEY`, `NEBIUS_BASE_URL` |
| Tavily | Gas prices, manufacturer schedules | `TAVILY_API_KEY` |
| Google Maps Platform | Geocoding, Places, Routes, Maps JS | `GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY` |
| Neon / Supabase | Postgres | `DATABASE_URL` |
| fueleconomy.gov | EPA MPG | — (no key) |
| Open-Meteo | Weather + air quality | — (no key) |
| EIA | Weekly CA / LA gas price fallback | `EIA_API_KEY` |

**Set a spending cap in every dashboard on day 1.** Restrict the browser Google key to your Vercel domain.

---

## Team split

- **Person A (product & frontend):** dashboard, health cards, setup flow, proposal cards, command bar, trip panel + map, model badges, loading/empty states, demo-car button, video
- **Person B (agent & data):** Token Factory client, router + both agent loops, all tools, Tavily / EIA / fueleconomy / Google / Open-Meteo, DB schema, nudge job, README write-up
- **Meet at:** `/api/command`, `/api/plan-trip`, `/api/vehicle`, `/api/nudges` and the types above

---

## Schedule

| Day | Person A | Person B | Done when |
|---|---|---|---|
| **Thu Oct 22** | Repo + MIT + README skeleton, Next.js scaffold, Vercel deploy, agree types, dashboard layout on fake data | Get all keys + credits + spend caps, **tool-call smoke test per model**, DB schema, anonymous ID, fueleconomy lookup, baseline table | Live URL; pick a car → real MPG; one Nemotron tool call works |
| **Fri Oct 23** | Health cards, car setup flow | Nano router + Maintenance agent + `proposeAdjustment` | "Drove dirt roads" returns a proposal |
| **Sat Oct 24** | Proposal cards (Apply/Dismiss), command bar | Open-Meteo weather + air quality, `lookupMfrSchedule` | Weather nudge shows up |
| **Sun Oct 25** | Trip panel + Google Map + route drawing | Trip agent: geocode, places, routes, `tripCost` | 3-stop trip shows route + cost |
| **Mon Oct 26** | Model badges, loading & empty states | Tavily gas prices + EIA fallback, `detourWorthIt` on Ultra | Detour verdict works end to end |
| **Tue Oct 27** | **Feature freeze tonight.** Load demo car, polish | Daily nudge job (Serverless Job → cron fallback) | A stranger can click through it cold |
| **Wed Oct 28** | Record + edit video, upload **public** to YouTube | README, description, Nebius feedback, bug fixes | Video live |
| **Thu Oct 29** | Submit on Devpost **by evening PDT** | Final fixes | Submitted ~15h before deadline |

---

## Demo car (seed data)

- **2019 Honda Civic**, ~48,000 mi, ~250 mi/week
- Home base: **Buena Park, CA**. Use a public landmark, not anyone's real address.
- Last wash 26 days ago → **overdue**; oil change ~400 mi away → **due soon**; everything else OK
- Demo trip: gas + car wash + a grocery stop toward **Santa Ana**; pick the stops so at least two gas stations are close enough that the detour verdict has something to decide
- Seed one pending nudge from the real current forecast (rain-hold for the wash, or air quality → cabin filter)

---

## 3-minute video script

| Time | Beat |
|---|---|
| 0:00–0:20 | **Hook:** "Car upkeep is a pile of mental math: when to wash, whether the cheap gas is worth the drive. GloveBox does it for you." |
| 0:20–0:50 | Click **Load demo car** → health dashboard → weather/air-quality nudge ("rain Thursday, wash Friday") |
| 0:50–1:30 | Type *"camping trip, 300 miles on dirt roads"* → Nano router → Super → proposal cards with reasons → **Apply** → dashboard updates |
| 1:30–2:30 | Type *"gas, car wash and Trader Joe's before Friday"* → Ultra plans → map draws route → trip cost → **detour verdict** with Tavily source + timestamp |
| 2:30–3:00 | Architecture slide: model routing, Token Factory, Tavily, Serverless Job → end on the live URL |

---

## README must include (judges read this)

- Setup + env vars + how to run locally
- **How we used NVIDIA Nemotron**: the Nano/Super/Ultra routing table and why
- **Where Token Factory helped**: OpenAI-compatible client, tool calling, model switching
- **Tavily**: gas prices + manufacturer schedules, with the source/timestamp design
- **Other Nebius services**: Serverless Job (or why we fell back)
- Honest limitations: best-effort gas prices, US-only, baseline intervals

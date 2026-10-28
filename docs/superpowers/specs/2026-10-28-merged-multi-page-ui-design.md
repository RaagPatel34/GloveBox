# Merged multi-page UI

Date: 2026-10-28 · Branch: `feat/multi-page-ui` (from PR #2 tip `1a04b01`) · Target: `main`

## Why

GloveBox has two designs and two garages. `main` has the dark instrument-cluster dashboard reading a Postgres car. PR #2 has a light, tabbed garage at `/` reading a browser (localStorage) car, with the instrument dashboard moved to `/garage` as a separate "cloud garage". A judge sees two different cars and two different looks depending on the page.

This change makes one app: one garage, one look, the instrument dashboard as the homepage, and every other feature on its own page.

## Decisions (agreed)

1. **One garage: the local (browser) garage.** Every page reads and writes the `Garage` in localStorage (`src/lib/maintenance.ts`, key `glovebox.v1`). The cloud garage at `/garage` stays as an optional destination reached from Car & settings only.
2. **Four pages.** Each answers one question.

   | Route | Page | Answers | Contains |
   | --- | --- | --- | --- |
   | `/` | Dashboard | How is my car? | Odometer hero + status counts, drive review box, pending suggestion cards, upkeep tiles, weather check |
   | `/log` | Service log | What has been done? | Service history, record a service, update odometer, mileage forecast |
   | `/trips` | Trips | What will this drive cost? | Route planner (stops, place search, map, fuel price), gas-detour calculator |
   | `/car` | Car & settings | How is this set up? | Add/replace car, intervals and sources, backup & restore, copy to cloud, about / AI status |

3. **`main` is the trunk.** This branch opens one PR into `main` that supersedes PR #2 and PR #27. Nobody merges, closes or comments on PRs without the team agreeing.

## Design

### Structure

- A route group `src/app/(garage)/` with a client `layout` that renders `GarageProvider` and the app navigation. Pages `page.tsx`, `log/page.tsx`, `trips/page.tsx`, `car/page.tsx` live inside it.
- `GarageProvider` (client context) owns what `local-garage.tsx` owns today: load from localStorage once, validate with `isGarage`, `save(next, notice?)`, `now` (ticks each minute), `ready`, storage error and notice messages, `loadDemo()`. Pages read it with `useGarage()`.
- `src/components/local-garage.tsx` is split into those pages and removed. `CarSetup`, `GarageTools`, `SourceLibrary`, `TripPlanner`, `ConditionsPanel` and `GarageTransfer` keep their logic. `GarageTools` splits into the Service log forms and the Car-page items (intervals, backup, cloud copy).
- Navigation uses real `<Link>`s with `aria-current="page"`: a top bar on wide screens, a bottom tab bar on phones. Old hash URLs (`/#records`, `/#trips`, `/#guidance`) redirect client-side to `/log`, `/trips` and `/car`.
- Pages that need a car show the same empty state as the dashboard (Load demo car / Add my car) when there is none.

### Dashboard data

`garageToSnapshot(garage, now): CarSnapshot` (new, tested) maps `vehicle`, `items`, `plannedTripMiles` and `readingAt` (falling back to `now` when absent, as the local garage does today). The dashboard then calls the existing `buildDashboard(snapshot, now, garage.proposals)`, so the odometer estimate, statuses (including `unknown` / "History needed"), sorting, counts and proposal cards come from code already on `main`. Apply/Dismiss call the existing local `resolveProposal`. The drive review keeps its Sample/Live modes and `/api/command` contract.

### Visual system

- `main`'s tokens are the single source: background `#0d0e0f`, panel `#151719`, foreground `#e9e7e2`, muted `#8b8a86`, the three status colours, Instrument Sans for prose and Martian Mono for every number.
- PR #2's `.app-shell` stylesheet is rewritten against those tokens, keeping its class names, so component JSX barely changes. The separate `.cloud-garage` dark override goes away.
- **Status hues mean status only.** Focus rings, text selection, the "Changed" mark and the slider use the foreground colour, never amber/red/green.
- The rail uses `#111315`, one step darker than the panel. Field edges use `white/35` (3:1 against the panel); placeholders use the full `muted` token (≥4.5:1).
- The OK status reads **On track** (PRODUCT.md), so `STATUS_LABEL.ok` changes in `src/lib/readout.ts`.

## Approved design: "Rail + Next up" (prototype variant D)

Approved 2026-10-28 after a throwaway prototype of four variants (see *Prototype record*). B's rail and card language, carrying A's "next up" idea.

### Shell (every page)

- **Desktop (≥1024px):** a persistent left rail, 288px, sticky at full viewport height (`dvh`). From top: GloveBox wordmark; year + make, then model; estimated odometer as six digit tiles + "mi", with "Includes N planned mi" when planned miles > 0; status counts (Overdue / Due soon / On track, plus History needed when any) with coloured dot, label and count; the planned-miles slider; the four-page nav. The current page has a plate behind it.
- **Phone (<1024px):** the rail folds into a sticky top strip (wordmark + car name; odometer; the counts with visible short labels, never colour alone) and a fixed bottom tab bar (Dashboard / Log / Trips / Car, icon + label, 56px tall, current page marked by a bar on top). The slider moves to the top of the Service log page.
- Reset demo car lives only in Car & settings, never in the rail.
- Nav items are real `<Link href>`s with `aria-current="page"`.

### Dashboard (`/`)

1. **Next up hero:** the single most urgent item. Item name as the `h1` ("Next up:" for screen readers only), the limit as a large rolling number in its status colour with unit and status beside it, and two actions: **Log this service** (primary, opens `/log` with that item preselected) and **Why this date?** (disclosure showing the interval source, the interval, and the last service date).
2. **Drive review card:** "What happened on your last drive?" input + **Review drive** (secondary). The reply line (a persistent `role="status"` region) sits under it with the model badge. **Your call** cards (pending suggestions) sit inside the same card, under the reply, each showing from → to, the suggestion's own reason, the badge, and Apply / Dismiss.
3. **Coming up:** every other item as tiles, soonest first (1 / 2 / 3 columns by width). Each tile shows label, status (or "Changed"), the limit as a rolling number, the interval meter, "x% of interval" or "No interval set", and the interval source in words.
4. The weather check ("Ahead on the forecast") sits below Coming up.

### Motion

One orchestrated moment, plus motion that answers the user. Everything is gated by `prefers-reduced-motion: no-preference`; under `reduce`, values land at once.

- **Ignition (once per visit):** odometer drums roll up from zero (the ones wheel spins two extra turns, tens one), the counts and tile numbers roll in, and every interval meter sweeps from empty, 1100ms, `cubic-bezier(0.22, 1, 0.36, 1)`. It does not replay when returning to the dashboard. **Build it with CSS `@starting-style`**, so rendered values are always the real ones and only the transition starts from zero; the prototype's JS phase state is not carried over.
- **Changes roll:** later value changes (slider, Apply, logging) roll drums and meters in 520ms.
- **Apply / Dismiss:** the card exits first (150ms: opacity, `scale 0.98`, `translateY -12px`, `blur 4px`), then the schedule changes; the affected tile slides to its new rank (FLIP, 560ms) and shows "Changed" with a foreground ring until hovered or until the next drive review.
- **Page change:** a view transition. The root holds still; the content area fades out (120ms) and in (260ms, 12px rise, blur); the rail's current-page plate and the tab bar's mark slide as shared elements (320ms).
- **Press:** buttons scale to 0.96 over 150ms ease-out, never when disabled.
- No ambient loops, scroll reveals or per-section entrances.

### Other pages

- **Service log (`/log`):** history table first (date, service, odometer, notes); beside it "Record a service" (preselected item when arriving from the hero) and "Mileage" (last reading, weekly driving, Update odometer). Mileage forecast and planned miles here too.
- **Trips (`/trips`):** route planner and the gas-detour calculator side by side on desktop, stacked on phone; the verdict sentence is the largest text.
- **Car & settings (`/car`):** car facts and Replace car / Reset demo car (reset offers **Undo**, keeping the previous garage until the next reset); intervals and their sources; Backup and restore; Copy to cloud garage; AI status.

### Mobile platform layer

`viewport-fit=cover` and `interactive-widget=resizes-content` in the viewport; content pads with `env(safe-area-inset-*)`; one `theme-color` (`#111315`, the app is dark in every scheme); `touch-action: manipulation` and `user-select: none` on controls only; 16px minimum input text; `inputmode="numeric"` on mileage, `enterkeyhint="send"` on the drive input.

## Prototype record

- Branch: `prototype/multi-page-ui` (local), route `/prototype/pages?variant=A|B|C|D&page=…`. Throwaway; never merged.
- Question: does a four-page instrument layout on one local garage read clearly and feel like one product on desktop and phone? **Answer: yes, as variant D.**
- Skills, in order: `mattpocock-skills:prototype` (throwaway rules); `impeccable` v4.8 (PRODUCT.md, structure roll `seed:b2b0ce2533df4c12`: A Next up, B Rail, C Ask first; user chose B and asked for A's idea → D); `mobile-native` (platform layer); `interfaces:better-interface` (13 findings, 12 fixed in the prototype, the 13th, nav as links, belongs to the build); Inspo references (Diffusion Studio, Dovetail, Ferrari) + `frontend-design` (motion plan above).
- Still to apply during the build: `emil-design-eng` for the final feel pass, then impeccable's finish review and DESIGN.md.

## Guiding both agents

Add a short **Team workflow** section to `AGENTS.md`, which Codex reads automatically and `CLAUDE.md` imports:

- Branch from `main`. One issue per branch and PR. Never push to a teammate's branch.
- The page map above: which feature belongs on which route.
- One garage (local). Do not add another storage path.
- Use the design tokens. No new colours or fonts.
- Run `npm test`, `npm run typecheck` and `npm run lint` before opening a PR.

## Out of scope

The cloud command bar (service/odometer logging through Postgres), issues #25 and #26, PR #29, live AI acceptance, and new trip orchestration (#12, #13, #15). The uncommitted #26 work in the main checkout's `codex/fix-planned-mileage` branch is left untouched.

## Verification

- Unit tests for `garageToSnapshot`, plus the existing suite (`npm test`), `typecheck`, `lint` and `build`.
- Playwright screenshots of all four pages at 1280px, 390px and 320px (no horizontal scroll), with and without `prefers-reduced-motion: reduce`.
- Walkthrough: load demo → review a drive (sample) → Apply → tile changes → Log this service (item preselected) → compare a detour → export a backup → reset demo → Undo → reload, and everything persists.
- Keyboard walk of every page: every control reachable, visible focus ring, nothing hidden behind the sticky strip or tab bar.
- With reduced motion (no transitions), the first paint after the garage loads already shows the real odometer and due values.

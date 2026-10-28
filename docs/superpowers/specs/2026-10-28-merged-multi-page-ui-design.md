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
- Exact layout, spacing, nav treatment and component styling are **settled by the prototype below**, then recorded here before the build.

## Prototype first (before the build)

A throwaway prototype answers one question: *does this four-page instrument layout read clearly and feel like one product on desktop and phone?* It uses fixture data (the demo Civic) and is deleted once the answer is recorded. Skills in this order:

1. `mattpocock-skills:prototype` frames the question and keeps the prototype throwaway.
2. `impeccable` shapes and builds the prototype screens: direction, information architecture, hierarchy, all four pages.
3. `mobile-native` covers the phone pass: bottom tab bar, safe areas, tap targets, input zoom.
4. `interfaces:better-interface` reviews accessibility, layout, writing, typography, colour and polish together; fixes go back into the prototype.
5. `emil-design-eng` handles the last pass on feel (motion, states, small details), applied during the build rather than in the prototype.

`frontend-design` is not used: it overlaps `impeccable` and would set a competing direction.

**Exit:** the prototype's decisions (layout per page, nav, component treatments, copy) are written into this spec and approved, and then the implementation plan is written.

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
- Playwright screenshots of all four pages at 1280px and 390px.
- Walkthrough: load demo → review a drive (sample) → Apply → tile changes → log a service → compare a detour → export a backup → reload, and everything persists.

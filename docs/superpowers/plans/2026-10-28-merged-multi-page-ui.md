# Merged Multi-Page UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn PR #2's single tabbed local garage into the approved four-page "Rail + Next up" app (Dashboard, Service log, Trips, Car & settings) in main's dark instrument look, on one local garage, with the approved motion.

**Architecture:** A `(garage)` route group whose client layout owns one `GarageProvider` (the localStorage garage) and the shell (rail on desktop, top strip + tab bar on phone). Pages read the garage through `useGarage()`. The dashboard reuses main's `buildDashboard()` through a `garageToSnapshot()` adapter. PR #2's feature components keep their logic and class names; their stylesheet is rewritten against main's tokens. Motion is CSS-first (`@starting-style`, transitions) plus React `<ViewTransition>` for page changes.

**Tech Stack:** Next.js 16.4 (App Router, `cacheComponents`), React 19.3, Tailwind 4, Vitest (node env, `src/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-10-28-merged-multi-page-ui-design.md` (read it first; this plan does not repeat its layout descriptions). **Visual reference:** branch `prototype/multi-page-ui`, `src/app/prototype/pages/variant-d.tsx`, `shared.tsx`, `motion.tsx`, `prototype.css` at `?variant=D`. Rewrite from it; never copy the prototype's JS ignition phase or its `<button>` nav.

## Global Constraints

- Before writing Next code, read the matching guide in `node_modules/next/dist/docs/` (AGENTS.md rule). For page transitions read `01-app/02-guides/view-transitions.md`.
- One garage: localStorage key `glovebox.v1` via `STORAGE_KEY`, validated with `isGarage`. No new storage path, no new dependencies.
- Tokens (`:root`): `--background #0d0e0f`, `--foreground #e9e7e2`, `--panel #151719`, `--muted #8b8a86`, `--status-overdue #ff6a3d` / text `#ff8a63`, `--status-due-soon #f2a815` / text `#f5bd4a`, `--status-ok #5fd0a0` / text `#7fdcb3`, rail `#111315`. Fonts: Instrument Sans (prose), Martian Mono (numbers).
- Status hues mean status only. Focus ring, `::selection`, "Changed" mark and slider use the foreground.
- Field edges `ring-white/35`; placeholders `text-muted` (no alpha). Inputs ≥16px.
- Copy: OK state reads "On track". Buttons: "Log this service", "Why this date?" / "Hide the basis", "Review drive", "Apply", "Dismiss", "Reset demo car", "Undo".
- All movement only under `prefers-reduced-motion: no-preference`; under `reduce`, values land at once.
- Ignition 1100ms, later changes 520ms, easing `cubic-bezier(0.22, 1, 0.36, 1)`; card exit 150ms; FLIP 560ms; page swap out 120ms / in 260ms; nav plate 320ms; press scale 0.96 over 150ms ease-out.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work only on `feat/multi-page-ui`; never push to `codex/first-working-flow`.

## Review Focus

1. **Every item has no due date** (new car, no history): the hero must still render with "—" / "No due date" and "History needed", not crash. Test in Task 2.
2. **Odometer past 999,999 (7 digits):** wheels and digit tiles must show all digits. Test in Task 2 (`wheelPlan`).
3. **Corrupt or blocked localStorage:** the app shows the existing recovery copy and still lets you load the demo. Test in Task 3.
4. **An older backup without `readingAt`:** the dashboard estimates from now rather than producing NaN. Test in Task 2.
5. **Deep link to `/log`, `/trips` or `/car` with no saved car:** each page shows the empty state (Load demo car / Add my car), never a blank or an error. Verified in Task 5.

---

### Task 1: Tokens, fonts, viewport and "On track"

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/globals.css` (`:root` and `@theme` only; `.app-shell` rules are Task 7), `src/lib/readout.ts:36-41`
- Test: `src/lib/readout.test.ts`, `src/lib/command.test.ts` (lines 56, 88, 104, 468, 469)

**Interfaces:**
- Produces: CSS custom properties above plus `--rail #111315`; Tailwind colours `background`, `foreground`, `panel`, `muted`, `overdue(-text)`, `due-soon(-text)`, `ok(-text)`, `font-sans`, `font-mono` (main's `@theme inline` block); `STATUS_LABEL.ok === "On track"`.

- [ ] **Step 1: Write the failing test** in `readout.test.ts`: `it("calls the OK state On track", () => expect(STATUS_LABEL.ok).toBe("On track"))`. Update the five `command.test.ts` expectations: `". OK, next due"` → `". On track, next due"` and `"OK → Due soon."` → `"On track → Due soon."`.
- [ ] **Step 2: Run** `npx vitest run src/lib/readout.test.ts src/lib/command.test.ts`. Expected: FAIL on those six assertions.
- [ ] **Step 3: Implement.** `STATUS_LABEL.ok = "On track"`. In `layout.tsx` restore main's `Instrument_Sans` (`--font-body`) and `Martian_Mono` (`--font-numeric`) on `<html className="… h-full antialiased">`, keep PR #2's metadata title, and export `viewport: Viewport = { themeColor: "#111315", colorScheme: "dark", viewportFit: "cover", interactiveWidget: "resizes-content" }`. In `globals.css` replace PR #2's light `:root` with the token block and delete the `.cloud-garage` override blocks (the `/garage` page now inherits the root tokens).
- [ ] **Step 4: Run** `npm test && npm run typecheck`. Expected: all pass.
- [ ] **Step 5: Commit** `Use main's dark tokens and fonts app-wide; call OK "On track"`.

### Task 2: Pure helpers for the dashboard

**Files:**
- Create: `src/lib/garage-view.ts`, `src/lib/garage-view.test.ts`

**Interfaces:**
- Consumes: `Garage` (`@/lib/maintenance`), `CarSnapshot`, `ScheduleItem` (`@/lib/types`), `DashboardItem` (`@/lib/dashboard`).
- Produces:
  - `garageToSnapshot(garage: Garage, now: Date): CarSnapshot`
  - `SOURCE_TEXT: Record<ScheduleItem["intervalSource"]["kind"], string>` = baseline "Illustrative baseline", manufacturer "Manufacturer schedule", user "Your record", nhtsa "NHTSA guidance"
  - `dueBasis(item: ScheduleItem): string`
  - `wheelPlan(value: string): Array<{ kind: "digit"; digit: number; turns: number } | { kind: "sep"; char: string }>`
  - `legacyHashRoute(hash: string): "/" | "/log" | "/trips" | "/car" | null`

- [ ] **Step 1: Write the failing tests:**
  - `garageToSnapshot` copies `vehicle`, `items`, `plannedTripMiles`, and `readingAt`; when `readingAt` is absent it is `now.toISOString()`. `buildDashboard(garageToSnapshot(demoGarage(NOW), NOW), NOW, []).odometerEstimate === 48000`.
  - All items without `dueAt`/`dueOdometer` → `buildDashboard(...).items[0].status === "unknown"` and `formatLimit(items[0].limit)` is `{ value: "—", unit: "No due date" }`.
  - `dueBasis({ ...wash, intervalDays: 14, lastDoneAt: "2026-10-02T19:00:00.000Z", intervalSource: { kind: "baseline" } })` === `"Illustrative baseline: every 14 days, counted from your last one on Oct 2. Check your owner’s manual for your car’s schedule."`; with no `lastDoneAt` and kind `user`: `"Your record. No service recorded yet."`.
  - `wheelPlan("48,000")` → digits 4,8,0,0,0 with turns 0,0,0,1,2 and a `sep ","` after 8; `wheelPlan("1048000")` has 7 digit entries; `wheelPlan("12")` → turns 1,2.
  - `legacyHashRoute("#records") === "/log"`, `"#trips"` → `"/trips"`, `"#guidance"` → `"/car"`, `"#overview"` → `"/"`, `""` → `null`.
- [ ] **Step 2: Run** `npx vitest run src/lib/garage-view.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** in `src/lib/garage-view.ts`. `dueBasis` formats the date with `Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })` (same zone as `readout.ts`). Turns: the rightmost digit 2, the next 1, the rest 0.
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `Add the garage view helpers for the dashboard`.

### Task 3: GarageProvider

**Files:**
- Create: `src/components/garage/GarageProvider.tsx`, `src/lib/garage-storage.ts`, `src/lib/garage-storage.test.ts`

**Interfaces:**
- Produces:
  - `parseStoredGarage(raw: string | null): { garage: Garage | null; error: string | null }`
  - `useGarage(): { garage: Garage | null; ready: boolean; now: Date; save(next: Garage, notice?: string): void; loadDemo(): void; resetDemo(): void; undoReset(): void; canUndo: boolean; message: string; storageError: string; logFor: string | null; setLogFor(id: string | null): void }`
  - `GarageProvider({ children })`

- [ ] **Step 1: Write the failing tests:** `parseStoredGarage(null)` → `{ garage: null, error: null }`; a valid `JSON.stringify(demoGarage(NOW))` → that garage; `"{bad"` and `JSON.stringify({ version: 2 })` → `{ garage: null, error: "Saved data could not be restored. Load a fresh demo to continue." }`.
- [ ] **Step 2: Run** `npx vitest run src/lib/garage-storage.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Move the load/save/clock behaviour out of `local-garage.tsx` (`useEffect` lines 48-73) into the provider, keeping its exact copy, including `"Browser storage is unavailable or unreadable. You can still try the demo in this tab."` and `"Your changes work in this tab, but could not be saved for your next visit."`. `resetDemo()` keeps the previous garage in state and sets `message` to `"Demo car reset. Your earlier records were replaced."` with `canUndo: true`; `undoReset()` restores and saves it (`"Restored your earlier records."`). Read and write localStorage only inside effects and handlers.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `Hold the local garage in one GarageProvider`.

### Task 4: Shell and route group

**Files:**
- Create: `src/app/(garage)/layout.tsx`, `src/components/shell/Rail.tsx`, `src/components/shell/TabBar.tsx`, `src/components/shell/PlannedMiles.tsx`, `src/components/shell/nav.ts`, `src/components/shell/EmptyGarage.tsx`, `src/components/shell/icons.tsx`
- Delete: `src/app/page.tsx` (replaced in Task 5)

**Interfaces:**
- Consumes: `useGarage()`, `buildDashboard`, `garageToSnapshot`, `legacyHashRoute`.
- Produces: `NAV: { href: "/" | "/log" | "/trips" | "/car"; label: string; short: string; Icon }[]` with labels Dashboard / Service log / Trips / Car & settings and shorts Dashboard / Log / Trips / Car; `<EmptyGarage />` (car art, "Meet your next co-pilot.", **Load demo car** button, **Add my car** link to `/car`).

- [ ] **Step 1: Build the layout.** `"use client"` layout renders `<GarageProvider>` → `div.app-shell lg:grid lg:grid-cols-[288px_1fr]` → `<Rail/>`, `<main>` (`{children}` wrapped in `<ViewTransition default="page-swap">`), `<TabBar/>`. Current page from `usePathname()`. Nav items are `<Link href>` with `aria-current="page"`; the current item's plate is `<ViewTransition name="rail-plate" share="plate" default="none">` (tab bar: `name="tab-mark"`). Icons are the prototype's authored 1.5-stroke SVGs. An effect maps `location.hash` through `legacyHashRoute` and calls `router.replace`.
- [ ] **Step 2: Build the Rail** to the spec's Shell section: phone strip below `lg`, rail at `lg` and up, `#111315`, safe-area padding (`pt-[max(0.75rem,env(safe-area-inset-top))]`), counts with visible labels at every size, and `PlannedMiles` (calls `save(setMileagePlan(garage, garage.vehicle.weeklyMiles, miles))`, hidden below `lg`). Odometer digits render plain in this task (motion is Task 6). With no garage the rail shows only the wordmark and nav.
- [ ] **Step 3: Verify.** `npm run typecheck && npm run lint`, then `npx next dev -p 3210` and open `/log` at 1440 and 390 widths. Expected: the rail or the strip + tab bar render, and nav links change the URL and `aria-current`.
- [ ] **Step 4: Commit** `Add the garage route group, rail and tab bar`.

### Task 5: Pages

**Files:**
- Create: `src/app/(garage)/page.tsx`, `src/app/(garage)/log/page.tsx`, `src/app/(garage)/trips/page.tsx`, `src/app/(garage)/car/page.tsx`, `src/components/dashboard/NextUp.tsx`, `src/components/dashboard/DriveReview.tsx`, `src/components/dashboard/ComingUp.tsx`, `src/components/dashboard/Tile.tsx`
- Modify: `src/components/garage-tools.tsx` (split exports, no logic changes)
- Delete: `src/components/local-garage.tsx`

**Interfaces:**
- Consumes: `useGarage()`, `garageToSnapshot`, `dueBasis`, `SOURCE_TEXT`, `buildDashboard`, `sampleCommand`, `addProposals`, `resolveProposal`, `ConditionsPanel`, `TripPlanner`, `GarageTransfer`.
- Produces: from `garage-tools.tsx`: `CarSetup` (unchanged), `ServiceHistory({ garage })`, `RecordService({ garage, onSave, initialItemId? })`, `UpdateOdometer({ garage, onSave })`, `MileageForecast({ garage, onSave })`, `IntervalEditor({ garage, onSave })`, `BackupRestore({ garage, onSave })`, `SourceLibrary` (unchanged).

- [ ] **Step 1: Dashboard (`/`).** Show `<EmptyGarage/>` until a garage exists. Otherwise `NextUp` (item = `dashboard.items[0]`; `h1` with an sr-only "Next up: "; limit + unit + `STATUS_LABEL`; **Log this service** calls `setLogFor(item.id)` then `router.push("/log")`; **Why this date?** toggles `dueBasis` with `aria-expanded`), `DriveReview` (PR #2's submit logic from `local-garage.tsx` lines 77-100, including the Sample/Live mode select and `/api/command`; a persistent, empty `role="status"` reply line; pending cards from `dashboard.proposals` showing `moves` ("No date" when `from` is "—"), the proposal's own `reason`, `ModelBadge`, Apply / Dismiss), `ComingUp` (`items.slice(1)` as `Tile`s, using `SOURCE_TEXT`), then `ConditionsPanel`. The drive input gets `enterKeyHint="send"`; every mileage input in the split tools gets `inputMode="numeric"`.
- [ ] **Step 2: `/log`.** `ServiceHistory` first, beside `RecordService` (`initialItemId={logFor}`, falling back to the first item when that id is no longer in the garage), `UpdateOdometer`, `MileageForecast`, and `PlannedMiles` below `lg`.
- [ ] **Step 3: `/trips`** renders `TripPlanner` with `mpg = vehicle.mpgOverride || vehicle.epaMpg`. **`/car`** renders `CarSetup` (open via "Replace car"), **Reset demo car** with the provider's Undo, `IntervalEditor`, `SourceLibrary`, `BackupRestore`, `GarageTransfer`, and the AI status line (`/api/config`). Every page shows `<EmptyGarage/>` when there is no garage.
- [ ] **Step 4: Verify.** `npm test && npm run typecheck && npm run lint`. On the dev server, clear localStorage and deep-link to each of `/log`, `/trips` and `/car`: Expected: the empty state on each (Review Focus 5). Load the demo: the dashboard shows Exterior wash, 12 days late. Run "I drove 300 miles on dirt roads" in Sample mode, then Apply: the reply says "Reminder updated. No service has been marked complete." and the Cabin air filter tile shows due soon. Log this service: `/log` opens with Exterior wash selected. Open `/#records`: you land on `/log`.
- [ ] **Step 5: Commit** `Split the garage into Dashboard, Service log, Trips and Car pages`.

### Task 6: Motion

**Files:**
- Create: `src/components/motion/RollingNumber.tsx`, `src/components/motion/useFlip.ts`, `src/components/motion/useIgnitedOnce.ts`
- Modify: `src/app/globals.css` (motion section), `Rail.tsx`, `NextUp.tsx`, `Tile.tsx`, `ComingUp.tsx`, `DriveReview.tsx`

**Interfaces:**
- Consumes: `wheelPlan`.
- Produces: `RollingNumber({ value: string; className?: string })` (aria-hidden; callers add sr-only text); `useFlip(): (id: string) => (el: HTMLElement | null) => void`; `useIgnitedOnce()`, which sets `document.documentElement.dataset.ignited = ""` 1100ms after the first garage render of the visit.

- [ ] **Step 1: Ignition in CSS.** Wheel strips (`.wheel-strip`) and meter fills (`.meter-fill`) set their final `translateY(-Nem)` / `scaleX(f)` inline. In CSS: transitions of 520ms; `html:not([data-ignited])` raises them to 1100ms and adds `@starting-style { transform: translateY(0) }` / `scaleX(0)`. Everything is inside `@media (prefers-reduced-motion: no-preference)`. No phase state in JS.
- [ ] **Step 2: Apply in the odometer** (per-digit tiles, `wheelPlan` turns), the rail counts, the hero limit and the tile limits (numeric strings only), plus the tile meters.
- [ ] **Step 3: Responses.** The Your call card gets a `leaving` state: 150ms exit (opacity, scale 0.98, `translateY(-12px)`, `blur(4px)`), then `resolveProposal`, with buttons disabled while it leaves. Tiles use `useFlip` (560ms) and show a foreground "Changed" ring, cleared on pointer-enter or on the next drive review. Reply text fades in over 200ms. Button press: `scale: 0.96` over 150ms ease-out on `button:not(:disabled):active`. Page swap CSS: `::view-transition-old(.page-swap)` 120ms fade + blur; `::view-transition-new(.page-swap)` 260ms, 60ms delay, from 12px down + blur; `::view-transition-group(.plate)` 320ms; root `animation: none`.
- [ ] **Step 4: Verify.** With motion on: on the first dashboard load the odometer rolls up to 048000 and the meters sweep; returning from `/log` doesn't replay; Apply runs card exit → tile slide → "Changed". With reduced motion emulated: no transitions, and the final values show on the first paint. The planned-miles slider at 1000 shows the odometer at 049000 and an accessible name of "49,000 miles, estimated".
- [ ] **Step 5: Commit** `Add the ignition sweep, rolling readouts and page transitions`.

### Task 7: Restyle the feature components and the platform layer

**Files:**
- Modify: `src/app/globals.css` (`.app-shell` rules)

- [ ] **Step 1:** Rewrite PR #2's `.app-shell` class rules (`tool-panel`, `form-grid`, `primary`, `secondary`, `text-button`, `notice`, `error`, `details`, `history-list`, `trip-result`, `calculation-grid`, `location-search`, `source-library`, `empty-state`) against the tokens, matching the prototype's panel look (`bg-panel`, 16px radius, `ring-white/5`, inputs `bg-black/40 ring-white/35`). Delete rules for the removed tabs, topbar, vehicle-card, copilot, health-grid and proposal-grid. Add the platform layer from the spec's *Mobile platform layer*: tap highlight off, `touch-action: manipulation` + `user-select: none` on controls only, focus ring `2px solid var(--foreground)`, `::selection` `rgb(233 231 226 / .22)`.
- [ ] **Step 2: Verify.** Screenshot `/`, `/log`, `/trips`, `/car` and `/garage` at 1280, 390 and 320 widths. Expected: no light panels left, no horizontal scroll at 320, and visible focus on every control during a keyboard walk.
- [ ] **Step 3: Commit** `Restyle the garage tools in the instrument look`.

### Task 8: Guide both agents

**Files:**
- Modify: `AGENTS.md` (add **Team workflow** above `## Agent skills`; keep the managed Next.js block as it is), `README.md` (replace the `/` vs `/garage` paragraphs at lines 48 and 73-77 with the page map)

- [ ] **Step 1:** Add the spec's five *Guiding both agents* rules to `AGENTS.md`, plus the page map table (route → what lives there) and "Design reference: `docs/superpowers/specs/2026-10-28-merged-multi-page-ui-design.md`; product truth: `PRODUCT.md`". Run it through `mattpocock-skills:writing-for-agents`.
- [ ] **Step 2:** Update the README routes and file guide to the new pages and components.
- [ ] **Step 3: Commit** `Tell both agents how we branch and where features live`.

### Task 9: Finish

- [ ] **Step 1:** Run the spec's full *Verification* list (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, screenshots at 1280/390/320 with and without reduced motion, the walkthrough, the keyboard walk). Record the results in the PR body.
- [ ] **Step 2:** Do the `emil-design-eng` feel pass on the dashboard; batch the fixes, then re-run Step 1's checks.
- [ ] **Step 3:** Run impeccable's finish review (`impeccable-finish-reviewer`) and then `impeccable-documenter` to write `DESIGN.md` from the built app.
- [ ] **Step 4:** Commit, then ask the user before pushing `feat/multi-page-ui` and opening the PR into `main` (body via `mattpocock-skills:pr`, noting it supersedes #2 and #27).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Team workflow

Two agents (Claude Code and Codex) work this repo for two people. These rules keep their work mergeable.

- **Branch from `main`.** One issue per branch, one branch per PR. Push only to branches you created; to change a teammate's branch, open your own PR against it.
- **One garage.** Every page reads and writes the browser garage through `useGarage()` (`src/components/garage/GarageProvider.tsx`, localStorage key `glovebox.v1`). New features extend that `Garage`; storage stays in the provider.
- **Design tokens only.** Colours come from the `:root` tokens in `src/app/globals.css` and their Tailwind names (`bg-panel`, `text-muted`, `text-overdue-text`, …). Status hues mean status only; focus, selection and "Changed" use the foreground. Instrument Sans sets prose, Martian Mono sets every number.
- **Green before a PR:** `npm test`, `npm run typecheck` and `npm run lint` all pass.

### Where features live

| Route | Page | Answers | Lives there |
| --- | --- | --- | --- |
| `/` | Dashboard | How is my car? | Next up hero, drive review and suggestion cards, Coming up tiles, weather check |
| `/log` | Service log | What has been done? | Service history, record a service, update odometer, mileage forecast, planned miles (phone) |
| `/trips` | Trips | What will this drive cost? | Route planner, gas-detour calculator |
| `/car` | Car & settings | How is this set up? | Add/replace car, reset demo, intervals and sources, backup and restore, copy to cloud, AI status |

The shell (rail on desktop, top strip and tab bar on phones) is `src/app/(garage)/layout.tsx`. `/garage` is the optional cloud garage, linked from Car & settings only.

Design reference: `docs/superpowers/specs/2026-10-28-merged-multi-page-ui-design.md`. Product truth (voice, users, what "done" means): `PRODUCT.md`. Read both before changing a page's layout or copy.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `RaagPatel34/GloveBox`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created only when first needed. See `docs/agents/domain.md`.

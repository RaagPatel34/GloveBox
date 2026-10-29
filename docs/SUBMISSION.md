# Submission working copy

Status: implementation and preparation only. The feature preview is deployed. Both teammates are registered according to the owner. Eligibility and team representative confirmation, final public release, video, and Devpost submission remain. Live AI is paused at the user’s request until credits are available.

## Project name
GloveBox

## Tagline
Your car’s upkeep and trip costs, with the reasoning in plain sight.

## Inspiration
Car ownership involves many small decisions: when a service was last done, which reminder to trust, and whether a lower gas price is worth the extra drive. We wanted a focused place to record those facts and make the next decision visible.

## What it does
GloveBox lets a driver add a liquid-fuel vehicle, enter or look up fuel economy, record completed services, and set maintenance reminders with source notes. Unknown history stays unknown. A gas-detour calculator compares pump savings against additional fuel use and an optional value for time. The user controls every schedule change, and can export or restore a local backup.

An optional Nebius/Nemotron integration proposes maintenance checks from a driving event. Fixed sample suggestions are labeled separately. Before submission, re-enable and verify the real integration on the hosted build; do not submit a claim of active live inference based only on the offline preview.

## How we built it
Next.js and TypeScript provide the interface and server endpoints. Vehicle data can come from FuelEconomy.gov’s public API, with manual entry available when that service fails. Plain functions calculate deadlines and detour savings. Structured Nemotron tool arguments are validated before creating pending suggestions; the model cannot directly edit the schedule. Browser storage holds the local garage, JSON backups provide portability, and an explicit one-time copy can save a car and reminders to Neon Postgres. The original records remain available as a cloud archive; subsequent changes do not synchronize.

## NVIDIA and Nebius usage
Implemented integration: NVIDIA Nemotron through Nebius Token Factory’s compatible chat API. A prior local test successfully completed a tool-call round trip and produced a maintenance proposal. Current status: inference is deliberately disabled pending credits. Fill in the exact model ID and verified deployed behavior after the final test.

## What makes it useful
The interface connects a suggestion to an explicit action, a visible source, and a saved result. Deterministic calculations make the gas-detour decision auditable. The core tools remain usable without model access.

## Limitations
One car per browser; no accounts or automatic synchronization. Maintenance source notes entered by users are not independently verified. Most vehicle-specific intervals must be entered from the owner’s manual. Detour prices are manually entered; example prices are not live quotes, and the live gas-price detour verdict is not built. Electric vehicles and plug-in hybrid cost modeling are not supported. The trip agent orders stops and measures distance with Google Routes and prices fuel from the EIA regional weekly average, but only when Maps is enabled and keyed; without it, the app falls back to manual stops and a Google Maps link. Open-Meteo weather and air-quality checks work without AI. The trip agent, errands from the command bar, the route map, Google route/place and EIA regional-price adapters, and manufacturer-schedule lookup are merged but await credentials and hosted acceptance. Tavily source search and daily background-check code are implemented but also await credentials and deployment acceptance. Search excerpts are not verified station prices. Local records can be explicitly copied into an empty cloud garage; later edits do not sync.

## Sponsor feedback — use only observed evidence
- The model-list endpoint made it possible to discover exact accessible model IDs rather than hard-code guessed names.
- The integration successfully requested a tool, accepted its computed result, and returned the expected fuel cost in an earlier local test.
- Keep notes on actual response latency, rejected tool arguments, and any credit or model-availability issues during the final test. Do not invent benchmarks or experiences.

## Final checklist
- [x] Both teammates registered (owner confirmation, October 25).
- [ ] Eligibility reviewed; one team representative selected.
- [ ] Track: Best Apps and Agents.
- [x] Feature preview opens without a judge login; recheck the final submission URL.
- [ ] At least one NVIDIA open-source model is actually used at runtime on Nebius.
- [ ] Public source repository with MIT license and complete setup instructions.
- [ ] Public YouTube video under three minutes.
- [ ] Screenshots and exact demo URL added.
- [ ] Sponsor feedback finalized from real use.
- [ ] Scope and limitations match the deployed demo.
- [ ] Submit by October 29 evening Pacific; official deadline October 30, 2026 at 10 a.m. Pacific.
- [ ] Keep demo available through December 15, 2026.

Official rules: https://nebiusglobalaihackathon.devpost.com/rules

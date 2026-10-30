# GitHub issue status

Snapshot: October 29, 2026, taken from `origin/main` at `6e2796d` (PR #41) and the live issue and PR lists; the #15 row describes its feature branch. GitHub Issues remain the delivery tracker; this page summarizes them. It replaces the October 24 acceptance audit, which described a feature branch that has since merged.

"Merged" means the code is on `main` with CI passing. It does not mean a provider-backed feature has been accepted on a hosted deployment with real keys. The right-hand column says what is still unproven.

## Delivered on `main`

| Issue | Delivered | PR | Still unproven |
| --- | --- | --- | --- |
| [#5](https://github.com/RaagPatel34/GloveBox/issues/5) Health dashboard | Next-up hero, status tiles, odometer estimate, due-status logic | [#20](https://github.com/RaagPatel34/GloveBox/pull/20), prototype [#21](https://github.com/RaagPatel34/GloveBox/pull/21) | none |
| [#6](https://github.com/RaagPatel34/GloveBox/issues/6) Car setup | EPA lookup, manual MPG, home location, anonymous visitor identity, Postgres storage | [#22](https://github.com/RaagPatel34/GloveBox/pull/22) | hosted Postgres setup depends on #4 |
| [#7](https://github.com/RaagPatel34/GloveBox/issues/7) Demo car | Repeatable populated Civic, wash overdue, oil due soon | [#23](https://github.com/RaagPatel34/GloveBox/pull/23) | none |
| [#8](https://github.com/RaagPatel34/GloveBox/issues/8) Command bar | Nano routing, Super service and odometer tool loop, model badges | [#24](https://github.com/RaagPatel34/GloveBox/pull/24) | real Nemotron acceptance (#4); bugs #25 and #26 |
| [#9](https://github.com/RaagPatel34/GloveBox/issues/9) Proposal cards | Apply and Dismiss, stale-proposal protection, SQL-backed store | [#27](https://github.com/RaagPatel34/GloveBox/pull/27), with the broader preview in [#2](https://github.com/RaagPatel34/GloveBox/pull/2) | live model run; hosted behaviour |
| [#10](https://github.com/RaagPatel34/GloveBox/issues/10) Weather and air quality | Open-Meteo adapters, deterministic nudge rules, persisted nudges, dashboard display | [#28](https://github.com/RaagPatel34/GloveBox/pull/28) | recurring refresh is #16 |
| [#11](https://github.com/RaagPatel34/GloveBox/issues/11) Manufacturer schedule | Tavily lookup on saving a new car; each interval shown with its source link; the owner's intervals are never replaced | [#34](https://github.com/RaagPatel34/GloveBox/pull/34) | Tavily quota and live acceptance; follow-up fix in open [#39](https://github.com/RaagPatel34/GloveBox/pull/39) |
| [#12](https://github.com/RaagPatel34/GloveBox/issues/12) Trip planner | Up to eight address stops, Google Routes ordering from home and back, miles, fuel cost from MPG and the EIA price | [#31](https://github.com/RaagPatel34/GloveBox/pull/31) | `ENABLE_MAPS` with a restricted key and quotas; hosted routes |
| [#13](https://github.com/RaagPatel34/GloveBox/issues/13) Errands | Gas and car-wash stops near home via Google Places; errands from the command bar (Nano reads the stops, the trip agent plans them); named places resolve to the closest match | [#33](https://github.com/RaagPatel34/GloveBox/pull/33) | live router and trip agent need AI and Maps; stations are searched near home or a stop, not along the route |
| Merge follow-ups | Trip review fixes, errand correctness, local-model reasoning setting, secrets ignore | [#30](https://github.com/RaagPatel34/GloveBox/pull/30), [#32](https://github.com/RaagPatel34/GloveBox/pull/32), [#35](https://github.com/RaagPatel34/GloveBox/pull/35), [#38](https://github.com/RaagPatel34/GloveBox/pull/38) | none |

#14 (route map) merged in [#40](https://github.com/RaagPatel34/GloveBox/pull/40) but the issue is still open on GitHub; see below.

## Open issues

| Issue | Label | State |
| --- | --- | --- |
| [#4](https://github.com/RaagPatel34/GloveBox/issues/4) Keys, spend caps, Nemotron smoke test, live Vercel URL | ready-for-human | Neon, EIA and Tavily are connected on the preview. Nebius is deferred by the team; `ENABLE_LIVE_AI=false`. Google Maps is disabled and its project billing is disconnected. See [API connection status](API-CONNECTION-STATUS.md). |
| [#14](https://github.com/RaagPatel34/GloveBox/issues/14) Route map | ready-for-agent | Code merged in #40: a Directions embed (home, each stop in plan order, home) behind a Load route map button, with the stop list and an Open in Google Maps link as the fallback. Needs a browser key restricted to the deployed domain; the in-iframe render has not been seen. Close the issue once that is checked. |
| [#15](https://github.com/RaagPatel34/GloveBox/issues/15) Live gas prices and the detour verdict on Ultra | ready-for-agent | Code on `feat/15-gas-detour`, not merged: Tavily station and area prices (dated within a week) with the EIA fallback, Ultra only when it is configured and more than one station is near home (otherwise Super, with no detour), the detour verdict on a 10-gallon fill-up, and every price shown with its kind, date and source. The demo errand reaches a verdict end to end in tests on illustrative demo prices. Live Tavily price quality and a real Ultra run are unproven. |
| [#16](https://github.com/RaagPatel34/GloveBox/issues/16) Daily nudge job | ready-for-agent | Authenticated route, opt-in consent, bounded claims (10 cars per run) and a Vercel schedule exist. Needs a migrated database, `ENABLE_DAILY_WEATHER=true`, `CRON_SECRET` and a production release. |
| [#17](https://github.com/RaagPatel34/GloveBox/issues/17) Odometer photo to reading | ready-for-agent | Not started. Stretch scope. |
| [#18](https://github.com/RaagPatel34/GloveBox/issues/18) Cold walkthrough and feature freeze | ready-for-agent | Blocked on the features above. |
| [#19](https://github.com/RaagPatel34/GloveBox/issues/19) Submission package | ready-for-human | Drafts in [SUBMISSION.md](SUBMISSION.md) and [DEMO-SCRIPT.md](DEMO-SCRIPT.md). Public video, public repo and the Devpost entry are the owner's. |
| [#25](https://github.com/RaagPatel34/GloveBox/issues/25) Command saves can overwrite each other or silently save nothing | needs-triage | Reported, not triaged. |
| [#26](https://github.com/RaagPatel34/GloveBox/issues/26) Service log and odometer replies ignore planned-trip miles | needs-triage | Reported, not triaged. |

## Open pull requests

| PR | Base | What it is | Notes |
| --- | --- | --- | --- |
| [#29](https://github.com/RaagPatel34/GloveBox/pull/29) | `main` | Life-event proposal cards with Apply and Dismiss | Mergeable. #27 already put the proposal feature on `main`; compare before merging. |
| [#39](https://github.com/RaagPatel34/GloveBox/pull/39) | `main` | Manufacturer interval ownership and source validation | Mergeable. Follow-up to #34. |
| [#37](https://github.com/RaagPatel34/GloveBox/pull/37) | `codex/issue-9-integration` | Reconcile proposal safety fixes with the current garage | Stacked on #29; retarget or close with it. |
| [#36](https://github.com/RaagPatel34/GloveBox/pull/36) | `chore/local-ai-and-secrets` | Honor local-model reasoning settings in Dashboard reviews | That base merged as #30; check whether this still applies to `main`. |

## Work order

1. Triage #25 and #26; the command bar is the headline surface and both are data-loss or wrong-answer bugs.
2. Decide #29, #37, #39 and #36, then close or retarget the stale ones.
3. Do the human steps in #4 (keys, caps, a funded Nemotron smoke test, the live URL). The required NVIDIA-on-Nebius runtime path is unverified until this is done.
4. Check the route map on the deployed domain and close #14.
5. Then #15, #16 and #17 in that order of value, and #18 and #19 last. #17 is stretch.

Backup and restore, manual service entry and the optional time-value math support the integrations above; they do not complete any of them.

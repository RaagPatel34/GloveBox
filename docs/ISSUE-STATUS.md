# GitHub issue acceptance audit

Reviewed against issues #4–#19 on October 23, 2026. These issues are the delivery backlog. This branch is a partial implementation, not a replacement for their acceptance criteria. No issue is automatically closed by this PR.

| Issue | Implemented on this branch | Still required |
| --- | --- | --- |
| [#4](https://github.com/RaagPatel34/GloveBox/issues/4) Hosting and keys | Feature-branch Vercel preview verified, server-enforced AI pause, prior Super tool-call verification | Provider keys/caps; Nano/Ultra verification. Nebius usage is explicitly deferred by the team. |
| [#5](https://github.com/RaagPatel34/GloveBox/issues/5) Dashboard | Eight fixture cards, status thresholds, reading-date/weekly/planned mileage projection; separate recorded odometer; upstream cloud dashboard and tests | Hosted cloud dashboard acceptance with a configured database. |
| [#6](https://github.com/RaagPatel34/GloveBox/issues/6) Car setup | EPA engine selection, manual MPG, weekly mileage, local persistence; upstream anonymous visitor identity, Postgres store/schema and baseline setup at /garage | Configure an existing database, run schema migration, verify hosted cloud setup and persistence. Local storage does not satisfy Postgres acceptance. |
| [#7](https://github.com/RaagPatel34/GloveBox/issues/7) Demo car | Eight items; wash last done 26 days ago, oil 400 mi away, other six OK; reset clears proposals; public City Hall address | Reset verified on the hosted local preview; cloud reset still needs database acceptance. Existing city-center coordinates are approximate; geocode the landmark for routing before #12. |
| [#8](https://github.com/RaagPatel34/GloveBox/issues/8) Command routing | Manual service and odometer forms; Super proposal loop; upstream Nano classification, command-bar tools, routing fixtures and model badges incorporated | Funded live router and database verification. Both command endpoints remain disabled; fixture tests do not replace live acceptance. |
| [#9](https://github.com/RaagPatel34/GloveBox/issues/9) Proposals | Local proposal cards plus PR #27 SQL-backed Apply/Dismiss/hide and stale-proposal protection; Postgres integration tests; AI remains paused | Reverify funded live model and hosted behavior. Sample output is labeled and is not live AI. |
| [#10](https://github.com/RaagPatel34/GloveBox/issues/10) Weather/AQ | PR #28 weather/AQ rules and persisted cloud nudges combined; main overview has live city-based checks with attribution and partial-failure handling | Hosted cloud nudge persistence needs DATABASE_URL. Automatic recurring refresh remains #16. |
| [#11](https://github.com/RaagPatel34/GloveBox/issues/11) Manufacturer lookup | Source-link UI and manual source entry | Tavily lookup and validated manufacturer/baseline fallback. Manual links do not complete this ticket. |
| [#12](https://github.com/RaagPatel34/GloveBox/issues/12) Trip planner | Manual stops/Maps link plus Google Routes adapter with ordering, real distance/duration validation and fuel-cost UI | Configure Google key/quotas and explicitly enable Maps; verify hosted real routes. AI trip loop deferred. |
| [#13](https://github.com/RaagPatel34/GloveBox/issues/13) Errands | Explicit place search and add-stop UI, Google Places adapter, Buena Park/Santa Ana seed | Live provider acceptance needs Maps setup; natural-language errands remain AI work. |
| [#14](https://github.com/RaagPatel34/GloveBox/issues/14) Map | External Maps directions link | Embedded route/stop map or static-map fallback; domain-restricted browser key. An external link does not satisfy map acceptance. |
| [#15](https://github.com/RaagPatel34/GloveBox/issues/15) Gas prices/detour | Detour math and time costs; EIA California weekly adapter with date/source/staleness labeling and route-cost UI | EIA key and live verification; station-specific Tavily lookup not implemented; AI routing deferred. |
| [#16](https://github.com/RaagPatel34/GloveBox/issues/16) Daily job | Not started | Scheduler, stored cars/nudges, daily deduplication; optional priority. |
| [#17](https://github.com/RaagPatel34/GloveBox/issues/17) Odometer photo | Not started | Upload, model extraction, confirmation and unreadable-image handling; stretch priority. |
| [#18](https://github.com/RaagPatel34/GloveBox/issues/18) Cold walkthrough | Local browser verification, CI checks, user-test worksheet | Full specified live path, independent user walkthrough, code review findings and feature freeze. |
| [#19](https://github.com/RaagPatel34/GloveBox/issues/19) Submission | README, description draft, feedback notes, demo script | Accurate final routing/provider sections after implementation; public video, public repo and actual Devpost submission. |

## Current work order

1. #4 preview is deployed with `ENABLE_LIVE_AI=false`. Preserve main and the draft PR.
2. Finish #5–#7 acceptance, then #8–#10, then #12/#13/#15. Implement provider-independent work while credits are deferred; do not silently replace required integrations with manual-only flows.
3. Complete #18/#19 using the actual finished product. Keep #11/#14/#16/#17 at their stated optional priorities.

Backup/restore, manual maintenance entry and optional time-value math are supporting features. They do not count as completion of the issue integrations they supplement. No further unrelated features should be added before the must-ship issues are satisfied.

Demo landmark address source: [City of Buena Park official publication](https://cms7files1.revize.com/buenaparkca/Sp25%20BP%20Today%20Final%20WEB.pdf). Demo vehicle history and MPG remain illustrative.

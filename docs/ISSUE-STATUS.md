# GitHub issue acceptance audit

Reviewed against issues #4–#19 on October 23, 2026. These issues are the delivery backlog. This branch is a partial implementation, not a replacement for their acceptance criteria. No issue is automatically closed by this PR.

| Issue | Implemented on this branch | Still required |
| --- | --- | --- |
| [#4](https://github.com/RaagPatel34/GloveBox/issues/4) Hosting and keys | Feature-branch Vercel preview verified, server-enforced AI pause, prior Super tool-call verification | Provider keys/caps; Nano/Ultra verification. Nebius usage is explicitly deferred by the team. |
| [#5](https://github.com/RaagPatel34/GloveBox/issues/5) Dashboard | Eight fixture cards, status thresholds, reading-date/weekly/planned mileage projection; separate recorded odometer; upstream cloud dashboard and tests | Hosted cloud dashboard acceptance with a configured database. |
| [#6](https://github.com/RaagPatel34/GloveBox/issues/6) Car setup | EPA engine selection, manual MPG, weekly mileage, local persistence; upstream anonymous visitor identity, Postgres store/schema and baseline setup at /garage | Configure an existing database, run schema migration, verify hosted cloud setup and persistence. Local storage does not satisfy Postgres acceptance. |
| [#7](https://github.com/RaagPatel34/GloveBox/issues/7) Demo car | Eight items; wash last done 26 days ago, oil 400 mi away, other six OK; reset clears proposals; public City Hall address | Reset verified on the hosted local preview; cloud reset still needs database acceptance. Existing city-center coordinates are approximate; geocode the landmark for routing before #12. |
| [#8](https://github.com/RaagPatel34/GloveBox/issues/8) Command routing | Manual service and odometer forms; Super proposal loop; upstream Nano classification, command-bar tools, routing fixtures and model badges incorporated | Funded live router and database verification. Both command endpoints remain disabled; fixture tests do not replace live acceptance. |
| [#9](https://github.com/RaagPatel34/GloveBox/issues/9) Proposals | From/to/reason/model cards, Apply/Dismiss, persistent state, sample dusty-trip path; Super previously verified | Reverify funded live model and hosted behavior. Sample output is labeled and is not live AI. |
| [#10](https://github.com/RaagPatel34/GloveBox/issues/10) Weather/AQ | Shared nudge type only | Open-Meteo providers, conditional nudges, persisted nudges and real forecast demo seed. |
| [#11](https://github.com/RaagPatel34/GloveBox/issues/11) Manufacturer lookup | Source-link UI and manual source entry | Tavily lookup and validated manufacturer/baseline fallback. Manual links do not complete this ticket. |
| [#12](https://github.com/RaagPatel34/GloveBox/issues/12) Trip planner | Manual stop list, Maps link, deterministic fuel math | Geocoding, driving-order optimization, distance provider, EIA price/date/kind, Super trip tool loop. |
| [#13](https://github.com/RaagPatel34/GloveBox/issues/13) Errands | No automated errand flow | Command routing, nearby named places, gas/wash candidates and Santa Ana example. |
| [#14](https://github.com/RaagPatel34/GloveBox/issues/14) Map | External Maps directions link | Embedded route/stop map or static-map fallback; domain-restricted browser key. An external link does not satisfy map acceptance. |
| [#15](https://github.com/RaagPatel34/GloveBox/issues/15) Gas prices/detour | Tested deterministic price/distance detour math; optional time-cost comparison; explicit sample/manual prices | Tavily/EIA providers, source/as-of/kind per price, station selection and conditional Ultra routing. |
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

# Deploy GloveBox

## Publish the credit-free preview

1. Keep the work on `codex/first-working-flow` and deploy that branch as a preview. The team has explicitly requested no push or merge to `main`.
2. In Vercel, choose Add New → Project → Import Git Repository. Connect GitHub and grant access to **RaagPatel34/GloveBox** only. Import the repository.
3. Framework: **Next.js**. Root directory: repository root. Node.js: **22.x**. Install: `npm ci`. Build: `npm run build`. Keep the default output directory.
4. Add `ENABLE_LIVE_AI=false` to the environment variables. No keys are needed for the core preview. Do not copy the local API key or `.env.local` into the repo.
5. Deploy. If using the feature branch, select that branch for the preview; production should use the reviewed main branch.
6. Test the generated HTTPS URL in a private browser window: add a car manually, log a tire-pressure check, reload, use the gas-detour example, and check a phone layout.
7. Put the verified demo URL in README and Devpost. Confirm judges can access it without Vercel deployment protection or a login. Changing deployment protection is an account-owner action.

The car and history are stored in each browser, not on Vercel. Do not use private real-world information in your public demo recording. JSON backup/restore lets a user carry their own data to another browser.

## Live AI later

The user has explicitly deferred Nebius credit use. Keep `ENABLE_LIVE_AI=false` until that changes. Even a saved key cannot trigger inference while the switch is off.

When ready, rotate the previously shared key, configure `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, and `NEBIUS_MODEL_SUPER` privately in the hosting dashboard. Run `npm run smoke` locally with a funded key; it incurs two inference calls per configured model. Then enable live AI and redeploy.

Before enabling a public paid endpoint, add a shared rate limiter and a provider-enforced spending cap or equivalent budget protection. The disabled gate is effective now, but is not a substitute for metering once enabled. The application bounds commands and model output, disables automatic SDK retries, and uses timeouts; these do not prevent aggregate abuse across public requests.

## Release checklist

- [ ] `npm ci`, tests, lint, typecheck, and production build pass.
- [ ] CI checks pass on the branch being deployed.
- [ ] No `.env.local`, keys, or private user backups are tracked.
- [ ] External EPA lookup failure is recoverable through manual entry.
- [ ] Backup restore and reset clearly describe replacing local data.
- [ ] Live inference is paused until explicitly enabled with budget protection.
- [ ] Public URL works from a clean browser and on a phone.
- [ ] The deployed runtime makes a real NVIDIA model call on Nebius before the hackathon submission. A sample-only preview does not satisfy the AI requirement.
- [ ] Keep the judged version accessible through December 15, 2026.

## Troubleshooting

**EPA lookup unavailable:** enter MPG manually. The feature uses FuelEconomy.gov’s public API; it is optional and may time out.

**Nothing due after adding a car:** expected. Enter an interval and the date/mileage of the last completed service. Unknown history is not treated as healthy.

**Old browser data:** valid v1 backups remain readable. Export before replacing the garage. Data does not automatically sync between localhost and the deployed domain.

**Live option disabled:** expected with `ENABLE_LIVE_AI=false`, missing key, or missing model. The server checks the same switch, so changing browser controls cannot enable paid requests.

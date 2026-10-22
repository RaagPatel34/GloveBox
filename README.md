# GloveBox

Your car’s co-pilot for upkeep and trip costs. Built for the Nebius x NVIDIA Global AI Hackathon, Best Apps & Agents track.

## Working today

- Responsive garage dashboard with a one-click demo Civic and illustrative maintenance history.
- Command → pending suggestion → Apply/Dismiss → updated dashboard.
- Sample mode works without keys and is explicitly labeled as fixed sample logic, not AI.
- Live mode calls one configured NVIDIA Nemotron model through Nebius Token Factory. It validates the model’s tool arguments before creating suggestions. **Live provider behavior still needs verification with a real API key.**
- Browser-local persistence, stale-proposal protection, error states, and unknown-history status.
- Suggestions can bring forward inspections or a wash; they cannot postpone existing deadlines, change the odometer, or mark service complete.

Trip planning, real vehicle lookup, manufacturer schedules, weather, Tavily, database persistence, and scheduled nudges are not implemented yet. See [the broader spec](docs/SPEC.md).

## Run locally

Use Node 22.13+ (or a newer supported LTS) and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000, click **Load demo car**, click the dirt-road example, and choose **Review my drive**. Apply one suggestion and dismiss the other. Refresh to verify your decisions were saved.

Sample mode needs no credentials. Data stays in this browser; resetting the demo replaces its saved state. Live mode sends the command and demo schedule to Nebius. The app has no accounts or cross-device sync.

## Enable live Nemotron

1. Create a Nebius Token Factory account and API key. Hackathon credit instructions: https://nebiusglobalaihackathon.devpost.com/resources.
2. Put the key in `.env.local` as `NEBIUS_API_KEY`. Never share or commit this file.
3. Run `npm run smoke` to list model IDs accessible to your account. This first run intentionally exits with instructions if no model is configured.
4. Set `NEBIUS_MODEL_SUPER` to an available NVIDIA Nemotron ID. The name is the existing role variable, not a requirement to use a specific size; one working Nemotron model is enough for this milestone.
5. Run `npm run smoke` again. It verifies tool arguments, executes fuel-cost math, sends the tool result back, and checks the final answer. Each configured model makes two inference requests.
6. Restart the app and choose **Live · Nemotron** in the response menu.

Missing credentials return a clear setup message. Provider failures never silently fall back to sample responses.

## Architecture and team handoff

`src/app/page.tsx` owns the dashboard and browser storage. `POST /api/command` accepts `{ command, mode: "sample" | "live", garage }` and returns `{ proposals, message, source, model? }`. `src/lib/maintenance.ts` owns validation and state transitions; `src/lib/types.ts` remains the shared contract.

The live endpoint uses the `proposeMaintenance` tool with a bounded list of inspection suggestions. Plain code validates IDs, dates, reason lengths, and allowed actions; the model never writes state. This terminal tool returns structured proposals directly to the UI; it does not need a second model call to render the result.

Frontend work can continue around the shared contract. Backend work can next add source-backed maintenance guidance, then trip calculations. Keys stay on the server. Before a public deployment, add shared rate limits and a spending budget for the paid inference endpoint; this milestone is intended for local testing.

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run smoke # requires real credentials
```

Unit tests cover apply/dismiss, stale proposals, invalid model output, unknown history, mileage estimation, and storage validation. The smoke script exits nonzero on failure.

## Submission checklist

Target submission: Thursday, October 29 evening Pacific. Official deadline: Friday, October 30, 2026 at 10 a.m. Pacific.

- [ ] Verify live Nemotron calls with your account and record the model ID.
- [ ] Publish and test the working demo.
- [ ] Make the repository public; keep the MIT license visible.
- [ ] Record a public YouTube demo under three minutes.
- [ ] Describe what works, how NVIDIA/Nebius are used, and known limitations.
- [ ] Add feedback based on actual use of Nebius/NVIDIA tools.

Live demo and video: pending. Do not present sample mode as a real AI integration in the submission.

## License

[MIT](LICENSE)

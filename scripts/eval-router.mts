// Runs the router's fixed example set (src/lib/agent/router-examples.ts) against the real Nano
// and reports each miss. Run with `npm run eval:router` (reads .env.local) after any prompt change.
// Exits non-zero if any example is misrouted, so it can gate a deploy.
import { checkRoute, routeCommand } from "../src/lib/agent/router.ts";
import { ROUTER_EXAMPLES } from "../src/lib/agent/router-examples.ts";
import { missingNebiusConfig, nebiusChat } from "../src/lib/nebius.ts";

const missing = missingNebiusConfig(["nano"]);
if (missing.length > 0) {
  console.error(`Not set: ${missing.join(", ")}. Copy .env.example to .env.local and fill it in.`);
  process.exit(1);
}

const chat = nebiusChat();
const now = new Date();
let misses = 0;

for (const { input, expected } of ROUTER_EXAMPLES) {
  const started = Date.now();
  try {
    const route = await routeCommand(input, chat, now);
    const problems = checkRoute(route, expected);
    const ms = Date.now() - started;
    if (problems.length === 0) {
      console.log(`  ✅ ${input} (${ms}ms) → ${JSON.stringify(route)}`);
    } else {
      misses++;
      console.log(`  ❌ ${input} (${ms}ms) → ${JSON.stringify(route)}\n       ${problems.join("\n       ")}`);
    }
  } catch (err) {
    misses++;
    console.log(`  ❌ ${input}: ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`\n${ROUTER_EXAMPLES.length - misses}/${ROUTER_EXAMPLES.length} routed as expected.`);
process.exit(misses === 0 ? 0 : 1);

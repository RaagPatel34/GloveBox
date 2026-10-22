// Day-1 check: which Nemotron models can our key see, and does tool calling work on each?
// Run with `npm run smoke` (reads .env.local).
import OpenAI from "openai";

if (!process.env.NEBIUS_API_KEY) {
  console.error("NEBIUS_API_KEY is missing. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

const client = new OpenAI({
  baseURL: process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY,
});

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "tripCost",
      description: "Fuel cost in dollars for a drive.",
      parameters: {
        type: "object",
        properties: {
          miles: { type: "number" },
          mpg: { type: "number" },
          pricePerGal: { type: "number" },
        },
        required: ["miles", "mpg", "pricePerGal"],
      },
    },
  },
];

const models = await client.models.list();
const nemotron = models.data.map((m) => m.id).filter((id) => /nemotron/i.test(id));

console.log(`\nNemotron models visible to this key (${nemotron.length}):`);
for (const id of nemotron) console.log(`  ${id}`);

const configured = [
  ["NANO", process.env.NEBIUS_MODEL_NANO],
  ["SUPER", process.env.NEBIUS_MODEL_SUPER],
  ["ULTRA", process.env.NEBIUS_MODEL_ULTRA],
] as const;
const toTest = configured.some(([, id]) => id)
  ? configured.filter(([, id]) => id).map(([tier, id]) => [tier, id!] as const)
  : nemotron.map((id) => ["?", id] as const);

console.log("\nTool-calling test:");
for (const [tier, model] of toTest) {
  const started = Date.now();
  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: "How much does it cost to drive 42 miles in a 32 mpg car with gas at $4.89/gal?",
        },
      ],
      tools,
      tool_choice: "auto",
    });
    const call = res.choices[0]?.message.tool_calls?.[0];
    const ms = Date.now() - started;
    if (call?.type === "function") {
      console.log(`  ✅ [${tier}] ${model} (${ms}ms) → ${call.function.name}(${call.function.arguments})`);
    } else {
      console.log(`  ⚠️  [${tier}] ${model} (${ms}ms) answered without calling the tool`);
    }
  } catch (err) {
    console.log(`  ❌ [${tier}] ${model}: ${err instanceof Error ? err.message : err}`);
  }
}

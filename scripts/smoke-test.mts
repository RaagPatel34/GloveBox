// Lists available Nemotron IDs, then verifies a complete tool-call round trip.
import OpenAI from 'openai';
if (!process.env.NEBIUS_API_KEY) {
  console.error('Set NEBIUS_API_KEY in .env.local first. Never commit that file.');
  process.exit(1);
}
const client = new OpenAI({ baseURL: process.env.NEBIUS_BASE_URL ?? 'https://api.tokenfactory.nebius.com/v1/', apiKey: process.env.NEBIUS_API_KEY, timeout: 25000, maxRetries: 0 });
// Same optional setting the app sends (src/lib/nebius.ts), so timings here match the app.
const effort = (process.env.NEBIUS_REASONING_EFFORT || undefined) as OpenAI.ReasoningEffort | undefined;
let failed = false;
try {
  const models = await client.models.list();
  const available = models.data.map(m => m.id).filter(id => /nemotron/i.test(id));
  console.log('Available Nemotron model IDs:');
  for (const id of available) console.log(`  ${id}`);
  const selected = [...new Set([process.env.NEBIUS_MODEL_SUPER, process.env.NEBIUS_MODEL_NANO, process.env.NEBIUS_MODEL_ULTRA].filter((id): id is string => Boolean(id)))];
  if (!selected.length) {
    console.error('Set NEBIUS_MODEL_SUPER to one of the listed IDs, then run npm run smoke again. No inference requests were made.');
    process.exitCode = 1;
  }
  for (const model of selected) {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [{ role: 'user', content: 'Use tripCost to calculate fuel cost for exactly 42 miles, 32 mpg, and $4.89 per gallon. Then report the returned cost in dollars.' }];
      const response = await client.chat.completions.create({ model, messages, max_tokens: 1500, ...(effort ? { reasoning_effort: effort } : {}), tools: [{ type: 'function', function: { name: 'tripCost', description: 'Compute fuel cost in dollars.', parameters: { type: 'object', properties: { miles: { type: 'number' }, mpg: { type: 'number' }, pricePerGal: { type: 'number' } }, required: ['miles', 'mpg', 'pricePerGal'], additionalProperties: false } } }], tool_choice: { type: 'function', function: { name: 'tripCost' } } });
      const message = response.choices[0]?.message;
      const calls = message?.tool_calls;
      if (calls?.length !== 1 || calls[0].type !== 'function' || calls[0].function.name !== 'tripCost') throw new Error('Expected one tripCost tool call');
      const call = calls[0];
      const args = JSON.parse(call.function.arguments);
      if (args.miles !== 42 || args.mpg !== 32 || args.pricePerGal !== 4.89) throw new Error('Tool arguments did not match the requested inputs');
      const fuelCost = Math.round(args.miles / args.mpg * args.pricePerGal * 100) / 100;
      const final = await client.chat.completions.create({ model, max_tokens: 1500, ...(effort ? { reasoning_effort: effort } : {}), messages: [...messages, message, { role: 'tool', tool_call_id: call.id, content: JSON.stringify({ fuelCost, currency: 'USD' }) }] });
      const answer = final.choices[0]?.message.content;
      if (!answer?.includes(fuelCost.toFixed(2))) throw new Error('Final response did not report the computed cost');
      console.log(`PASS ${model}: validated arguments → executed tool → final answer includes $${fuelCost.toFixed(2)}`);
    } catch {
      failed = true;
      console.error(`FAIL ${model}: could not complete the verified tool-call round trip. Check model availability and tool support.`);
    }
  }
} catch { failed = true; console.error('Could not list models. Check your API key, base URL, credit balance, and network.'); }
if (failed) process.exitCode = 1;

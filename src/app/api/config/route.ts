import { connection } from 'next/server';
export async function GET() {
  await connection();
  return Response.json({ liveAI: process.env.ENABLE_LIVE_AI === 'true' && Boolean(process.env.NEBIUS_API_KEY && process.env.NEBIUS_MODEL_SUPER) }, { headers: { 'Cache-Control':'no-store' } });
}

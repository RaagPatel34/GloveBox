import { neon } from "@neondatabase/serverless";

// The one place the database connection is made.
// @neondatabase/serverless talks to Neon over HTTPS (fetch), so it works on Vercel's serverless
// and edge runtimes with no connection pool to exhaust, and `sql.transaction([...])` gives us an
// atomic multi-statement write in a single round trip.
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  return neon(url);
}

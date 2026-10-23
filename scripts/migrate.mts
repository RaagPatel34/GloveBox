// Creates the tables GloveBox needs in the database at DATABASE_URL.
// Idempotent (CREATE ... IF NOT EXISTS): run it as often as you like, on any environment.
//   npm run db:migrate            (reads .env.local)
import { neon } from "@neondatabase/serverless";
import { SCHEMA_STATEMENTS } from "../src/lib/db/schema.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

const sql = neon(url);
for (const statement of SCHEMA_STATEMENTS) {
  await sql.query(statement);
}

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('vehicles', 'schedule_items', 'proposals')
  ORDER BY table_name`;
console.log(`Schema applied. Tables present: ${tables.map((t) => t.table_name).join(", ")}`);

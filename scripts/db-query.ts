// Ad-hoc DB query runner for the live Supabase Postgres. Not shipped with the
// app — lives here so introspection / one-off ops queries can be run against
// production without hand-rolling a client each time.
//
// Usage:
//   npx tsx scripts/db-query.ts "SELECT current_database(), current_user;"
//   echo "SELECT count(*) FROM votes;" | npx tsx scripts/db-query.ts
//
// Loads DATABASE_URL from .env.local (which is gitignored). This URL uses the
// postgres role and bypasses RLS, so treat it accordingly.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (looked in .env.local).");
  process.exit(1);
}

// SQL comes from argv[2] or, if absent, stdin.
async function readSql(): Promise<string> {
  const arg = process.argv[2];
  if (arg && arg.trim()) return arg;
  if (process.stdin.isTTY) {
    console.error("No SQL provided. Pass as argv or pipe on stdin.");
    process.exit(1);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const sql = (await readSql()).trim();
  if (!sql) {
    console.error("Empty SQL.");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const res = await pool.query(sql);
    // Multi-statement queries return the last result; pg driver folds them.
    console.log(JSON.stringify(res.rows, null, 2));
    if (res.rows.length === 0 && res.rowCount != null) {
      console.error(`(no rows, rowCount=${res.rowCount})`);
    }
  } catch (err) {
    console.error("QUERY_ERROR:", err instanceof Error ? err.message : err);
    process.exit(2);
  } finally {
    await pool.end();
  }
}

main();

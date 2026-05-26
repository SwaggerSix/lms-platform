import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Snapshot the env-var names declared in .env.local.example so a
 * new variable being read from `process.env` (or NEXT_PUBLIC_*)
 * is paired with an entry in the example file. Catches the common
 * "shipped a change that requires a new env var but forgot to
 * document it" miss.
 */

describe(".env.local.example", () => {
  it("declared variable names are snapshotted", () => {
    const source = readFileSync(
      join(process.cwd(), ".env.local.example"),
      "utf8"
    );
    const names = Array.from(source.matchAll(/^([A-Z_][A-Z0-9_]*)\s*=/gm))
      .map((m) => m[1])
      .sort();
    expect(names).toMatchInlineSnapshot(`
      [
        "CRON_SECRET",
        "EMAIL_FROM",
        "NEXT_PUBLIC_APP_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_URL",
        "RESEND_API_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
      ]
    `);
  });
});

import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * supabase/pending/ is the scratch space for migrations that are too
 * destructive to auto-apply but need to live in the repo while the
 * preconditions for their application are being met. The drop migration
 * for compliance_requirements sat there for months until we finished
 * flipping all the readers and 410'd the API.
 *
 * This guardrail snapshots the live set of pending files. Anything new
 * landing in pending/ forces a triage (either commit-and-finish the
 * migration, or document explicitly why it stays parked). The snapshot
 * is updated in the same commit that adds or removes a file.
 *
 * Keeping the set tiny ensures destructive migrations don't quietly
 * decay into "we'll get to it" purgatory.
 */

describe("supabase/pending/ stays empty (or accounted for)", () => {
  it("lists every file currently parked under supabase/pending/", () => {
    const dir = join(process.cwd(), "supabase", "pending");
    if (!existsSync(dir)) {
      expect([]).toEqual([]);
      return;
    }
    const files = readdirSync(dir)
      .filter((name) => {
        const p = join(dir, name);
        return statSync(p).isFile() && !name.startsWith(".");
      })
      .sort();

    // Snapshot the live set. Anything added or removed forces this list
    // to update in the same commit, so a destructive migration can't
    // sit here unannounced.
    expect(files).toMatchInlineSnapshot(`[]`);
  });
});

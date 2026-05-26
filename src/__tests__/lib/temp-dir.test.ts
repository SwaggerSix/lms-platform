import { describe, it, expect } from "vitest";
import { existsSync, writeFileSync } from "node:fs";
import { withTempDir, withTempDirAsync } from "@/lib/testing/temp-dir";

describe("withTempDir", () => {
  it("creates a dir, passes it to fn, and removes it on return", () => {
    let captured = "";
    const result = withTempDir("td-", (dir) => {
      captured = dir;
      expect(existsSync(dir)).toBe(true);
      return 42;
    });
    expect(result).toBe(42);
    expect(existsSync(captured)).toBe(false);
  });

  it("removes the dir even when fn throws", () => {
    let captured = "";
    expect(() =>
      withTempDir("td-", (dir) => {
        captured = dir;
        writeFileSync(`${dir}/x`, "hi");
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(existsSync(captured)).toBe(false);
  });
});

describe("withTempDirAsync", () => {
  it("awaits fn before cleanup, returns its resolved value", async () => {
    let captured = "";
    const result = await withTempDirAsync("td-async-", async (dir) => {
      captured = dir;
      await new Promise((r) => setTimeout(r, 5));
      expect(existsSync(dir)).toBe(true);
      return "ok";
    });
    expect(result).toBe("ok");
    expect(existsSync(captured)).toBe(false);
  });

  it("cleans up on a rejected promise", async () => {
    let captured = "";
    await expect(
      withTempDirAsync("td-async-", async (dir) => {
        captured = dir;
        throw new Error("nope");
      })
    ).rejects.toThrow("nope");
    expect(existsSync(captured)).toBe(false);
  });
});

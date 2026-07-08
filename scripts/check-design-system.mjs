#!/usr/bin/env node
/**
 * Design-system guard (UX review §3.1): keeps the token/primitive cleanup
 * from regressing. Dependency-free so CI can run it without an install.
 *
 * Rules:
 *  1. HARD FAIL — `indigo-` classes anywhere in src/. The palette was
 *     retired for the semantic `primary-*` tokens (PRs #157/#170).
 *  2. HARD FAIL — `bg-blue-600` accent buttons in src/. Blue-as-accent was
 *     swept onto `primary-*` (PRs #158/#159); blue remains fine as an
 *     informational color (badges, callouts) which doesn't use bg-blue-600.
 *  3. RATCHET — files in src/app containing a raw `<table` may not exceed
 *     the baseline below. Use the DataTable component (or the Table
 *     primitives) for new tables; when you convert an old one, lower the
 *     baseline so it can't creep back up.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Raw <table files in src/app when the ratchet was introduced. Only ever
 * lower this number. */
const RAW_TABLE_FILE_BASELINE = 22;

const ROOT = new URL("..", import.meta.url).pathname;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(entry)) yield full;
  }
}

function findMatches(files, regex) {
  const hits = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (regex.test(line)) hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  return hits;
}

const srcFiles = [...walk(join(ROOT, "src"))];
const appFiles = srcFiles.filter((f) => f.includes(`${join("src", "app")}`));

let failed = false;

// 1. Retired indigo palette
const indigoHits = findMatches(srcFiles, /\bindigo-\d/);
if (indigoHits.length > 0) {
  failed = true;
  console.error(`\n✖ indigo-* classes are retired — use the semantic primary-* tokens instead:`);
  for (const hit of indigoHits) console.error(`  ${hit}`);
}

// 2. Accent-blue buttons
const blueHits = findMatches(srcFiles, /bg-blue-600/);
if (blueHits.length > 0) {
  failed = true;
  console.error(`\n✖ bg-blue-600 accent styling was swept onto primary-* — use bg-primary-600 (or the Button component):`);
  for (const hit of blueHits) console.error(`  ${hit}`);
}

// 3. Raw <table> ratchet — .tsx only: HTML email templates in API routes
// legitimately use <table> markup.
const rawTableFiles = appFiles.filter(
  (f) => f.endsWith(".tsx") && /<table[\s>]/.test(readFileSync(f, "utf8"))
);
if (rawTableFiles.length > RAW_TABLE_FILE_BASELINE) {
  failed = true;
  console.error(
    `\n✖ ${rawTableFiles.length} files in src/app contain a raw <table> (baseline: ${RAW_TABLE_FILE_BASELINE}).` +
      `\n  Use the DataTable component or the Table primitives from src/components/ui for new tables.`
  );
  for (const f of rawTableFiles) console.error(`  ${relative(ROOT, f)}`);
} else if (rawTableFiles.length < RAW_TABLE_FILE_BASELINE) {
  console.log(
    `ℹ raw <table> file count (${rawTableFiles.length}) is below the baseline (${RAW_TABLE_FILE_BASELINE}) — ` +
      `lower RAW_TABLE_FILE_BASELINE in scripts/check-design-system.mjs to lock in the progress.`
  );
}

if (failed) {
  process.exit(1);
}
console.log("✓ design-system checks passed");

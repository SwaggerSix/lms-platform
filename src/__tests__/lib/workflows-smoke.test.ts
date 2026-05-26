import { describe, it, expect } from "vitest";

/**
 * Smoke test for the trigger extractor used by the workflows
 * convention test. The live snapshot only proves the current
 * workflows parse correctly; this file proves the walker handles
 * the YAML shapes it'll encounter (multi-trigger blocks, mixed
 * indent, comments, sibling top-level keys).
 *
 * Logic is duplicated inline rather than imported because the
 * live test is small enough that pulling it into a shared module
 * would add boilerplate. If a third caller appears, refactor.
 */

function extractTriggers(source: string): string[] {
  const triggers: string[] = [];
  const lines = source.split("\n");
  let inOnBlock = false;
  for (const line of lines) {
    if (!inOnBlock) {
      if (line.startsWith("on:")) inOnBlock = true;
      continue;
    }
    if (/^[^\s#]/.test(line)) break;
    const m = line.match(/^  ([a-z_]+):/);
    if (m) triggers.push(m[1]);
  }
  return triggers.sort();
}

describe("workflow trigger extractor", () => {
  it("picks push + pull_request from a typical config", () => {
    const yml = `
name: X
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
`;
    expect(extractTriggers(yml)).toEqual(["pull_request", "push"]);
  });

  it("does not capture job names under `jobs:`", () => {
    const yml = `
on:
  push:

jobs:
  build:
    runs-on: ubuntu-latest
  test:
    runs-on: ubuntu-latest
`;
    expect(extractTriggers(yml)).toEqual(["push"]);
  });

  it("does not capture concurrency.group as a trigger", () => {
    const yml = `
on:
  pull_request:

concurrency:
  group: x
  cancel-in-progress: true
`;
    expect(extractTriggers(yml)).toEqual(["pull_request"]);
  });

  it("captures schedule and workflow_dispatch", () => {
    const yml = `
on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:
`;
    expect(extractTriggers(yml)).toEqual(["schedule", "workflow_dispatch"]);
  });

  it("skips comment lines inside the on: block", () => {
    const yml = `
on:
  # we run on every PR
  pull_request:
`;
    expect(extractTriggers(yml)).toEqual(["pull_request"]);
  });

  it("returns empty when there's no on: block", () => {
    expect(extractTriggers(`name: X\njobs:\n  build:\n`)).toEqual([]);
  });
});

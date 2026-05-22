import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import {
  useDocumentVisibility,
  __resetDocumentVisibilityStoreForTests,
} from "@/hooks/use-document-visibility";

/**
 * useDocumentVisibility owns a module-singleton store that binds one
 * `visibilitychange` listener to `document` on first read. Tests must:
 *   - reset the singleton in beforeEach so the next call re-binds
 *     against the current document
 *   - stub `document.visibilityState` via Object.defineProperty
 *   - dispatch a `visibilitychange` event to trigger the store update
 */

function VisibilityReader({ onValue }: { onValue: (v: boolean) => void }) {
  const visible = useDocumentVisibility();
  onValue(visible);
  return null;
}

function setVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => value,
  });
}

describe("useDocumentVisibility", () => {
  beforeEach(() => {
    __resetDocumentVisibilityStoreForTests();
    setVisibility("visible");
  });
  afterEach(() => {
    __resetDocumentVisibilityStoreForTests();
  });

  it("returns true when the document starts visible", () => {
    const seen: boolean[] = [];
    render(<VisibilityReader onValue={(v) => seen.push(v)} />);
    expect(seen.at(-1)).toBe(true);
  });

  it("returns false when the document starts hidden", () => {
    setVisibility("hidden");
    const seen: boolean[] = [];
    render(<VisibilityReader onValue={(v) => seen.push(v)} />);
    expect(seen.at(-1)).toBe(false);
  });

  it("updates when visibilitychange fires", async () => {
    const seen: boolean[] = [];
    render(<VisibilityReader onValue={(v) => seen.push(v)} />);
    expect(seen.at(-1)).toBe(true);

    await act(async () => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(seen.at(-1)).toBe(false);

    await act(async () => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(seen.at(-1)).toBe(true);
  });

  it("multiple subscribers all receive updates from one listener", async () => {
    const a: boolean[] = [];
    const b: boolean[] = [];
    render(
      <>
        <VisibilityReader onValue={(v) => a.push(v)} />
        <VisibilityReader onValue={(v) => b.push(v)} />
      </>
    );
    expect(a.at(-1)).toBe(true);
    expect(b.at(-1)).toBe(true);

    await act(async () => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(a.at(-1)).toBe(false);
    expect(b.at(-1)).toBe(false);
  });

  it("no-op set() — same value as current does not broadcast", async () => {
    const seen: boolean[] = [];
    render(<VisibilityReader onValue={(v) => seen.push(v)} />);
    const before = seen.length;
    await act(async () => {
      // visibilityState already "visible" — dispatching again should
      // not cause a new render.
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(seen.length).toBe(before);
  });
});

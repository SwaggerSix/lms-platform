import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { RelativeTime } from "@/components/ui/relative-time";

/**
 * Lightweight rendered-HTML snapshots per bucket so a future change to
 * the formatRelative output (e.g. tweaking spacing, adding ARIA) is
 * caught at the component boundary. The fixed NOW pinned via fake
 * timers + setSystemTime keeps the snapshots deterministic.
 *
 * If a snapshot deliberately needs to change, regenerate with
 * `npx vitest -u src/__tests__/components/relative-time.snapshots.test.tsx`.
 */

const NOW = new Date("2026-03-16T12:00:00.000Z");

describe("<RelativeTime> rendered HTML snapshots", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("seconds bucket", () => {
    const iso = new Date(NOW.getTime() - 15_000).toISOString();
    const { container } = render(<RelativeTime iso={iso} />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        title="${new Date(iso).toLocaleString()}"
      >
        15s ago
      </span>
    `);
  });

  it("minutes bucket with prefix", () => {
    const iso = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    const { container } = render(<RelativeTime iso={iso} prefix="last " />);
    // Note: snapshot serializer trims trailing whitespace on the
    // "last " prefix line, so the rendered text is "last 5m ago" with
    // a literal space joining the children.
    const span = container.firstChild as HTMLElement;
    expect(span.textContent).toBe("last 5m ago");
    expect(span.getAttribute("title")).toBe(new Date(iso).toLocaleString());
  });

  it("hours bucket with className", () => {
    const iso = new Date(NOW.getTime() - 3 * 3600_000).toISOString();
    const { container } = render(
      <RelativeTime iso={iso} className="text-xs text-gray-500" />
    );
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        class="text-xs text-gray-500"
        title="${new Date(iso).toLocaleString()}"
      >
        3h ago
      </span>
    `);
  });

  it("days bucket", () => {
    const iso = new Date(NOW.getTime() - 4 * 86400_000).toISOString();
    const { container } = render(<RelativeTime iso={iso} />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span
        title="${new Date(iso).toLocaleString()}"
      >
        4d ago
      </span>
    `);
  });

  it("never (literal string)", () => {
    const { container } = render(<RelativeTime iso="never" />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span>
        never
      </span>
    `);
  });

  it("empty string also renders 'never'", () => {
    const { container } = render(<RelativeTime iso="" />);
    expect(container.firstChild).toMatchInlineSnapshot(`
      <span>
        never
      </span>
    `);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { RelativeTime } from "@/components/ui/relative-time";
import { RelativeTimeProvider } from "@/components/ui/relative-time-context";

// All tests pin "now" to a fixed instant so the relative-time math is
// deterministic. vi.setSystemTime works in concert with vi.useFakeTimers.
const NOW = new Date("2026-03-16T12:00:00.000Z");

describe("<RelativeTime> format edge cases", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 'never' for the literal 'never' string", () => {
    render(<RelativeTime iso="never" />);
    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("renders 'never' for the empty string", () => {
    render(<RelativeTime iso="" />);
    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("renders raw input when parse fails (NaN guard)", () => {
    render(<RelativeTime iso="not-a-date" />);
    expect(screen.getByText("not-a-date")).toBeInTheDocument();
  });

  it("seconds bucket: <60s shows Ns ago", () => {
    const iso = new Date(NOW.getTime() - 30_000).toISOString();
    render(<RelativeTime iso={iso} />);
    expect(screen.getByText("30s ago")).toBeInTheDocument();
  });

  it("minutes bucket: 60s..3599s shows Nm ago", () => {
    const iso = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    render(<RelativeTime iso={iso} />);
    expect(screen.getByText("5m ago")).toBeInTheDocument();
  });

  it("hours bucket: 1h..23h shows Nh ago", () => {
    const iso = new Date(NOW.getTime() - 3 * 3600_000).toISOString();
    render(<RelativeTime iso={iso} />);
    expect(screen.getByText("3h ago")).toBeInTheDocument();
  });

  it("days bucket: ≥24h shows Nd ago", () => {
    const iso = new Date(NOW.getTime() - 2 * 86400_000).toISOString();
    render(<RelativeTime iso={iso} />);
    expect(screen.getByText("2d ago")).toBeInTheDocument();
  });

  it("renders prefix and suffix around the value", () => {
    const iso = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    render(<RelativeTime iso={iso} prefix="last " suffix=" (cached)" />);
    expect(screen.getByText("last 5m ago (cached)")).toBeInTheDocument();
  });

  it("derives title from iso when no explicit title prop", () => {
    const iso = new Date(NOW.getTime() - 60_000).toISOString();
    render(<RelativeTime iso={iso} />);
    const span = screen.getByText("1m ago");
    expect(span).toHaveAttribute("title", new Date(iso).toLocaleString());
  });

  it("re-renders on the standalone interval (no provider)", async () => {
    const iso = new Date(NOW.getTime() - 30_000).toISOString();
    const { container } = render(<RelativeTime iso={iso} intervalMs={1_000} />);
    expect(container.textContent).toBe("30s ago");
    // advanceTimersByTimeAsync moves both setInterval and Date forward,
    // so we just assert that the rendered text changed from "30s ago"
    // and is still in the seconds-bucket pattern.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(container.textContent).not.toBe("30s ago");
    expect(container.textContent).toMatch(/^\d+s ago$/);
  });

  it("re-renders via the shared provider tick", async () => {
    const iso = new Date(NOW.getTime() - 30_000).toISOString();
    const { container } = render(
      <RelativeTimeProvider intervalMs={1_000}>
        <RelativeTime iso={iso} />
      </RelativeTimeProvider>
    );
    expect(container.textContent).toBe("30s ago");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(container.textContent).not.toBe("30s ago");
    expect(container.textContent).toMatch(/^\d+s ago$/);
  });
});

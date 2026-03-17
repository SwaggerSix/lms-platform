import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "@/components/ui/progress-bar";

describe("ProgressBar", () => {
  it("renders with progressbar role", () => {
    render(<ProgressBar value={50} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("sets aria-valuenow correctly", () => {
    render(<ProgressBar value={75} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
  });

  it("sets aria-valuemin and aria-valuemax", () => {
    render(<ProgressBar value={50} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps value to 0-100 range", () => {
    const { rerender } = render(<ProgressBar value={150} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

    rerender(<ProgressBar value={-20} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("shows label when showLabel is true", () => {
    render(<ProgressBar value={65} showLabel />);
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText("Progress")).toBeInTheDocument();
  });

  it("hides label by default", () => {
    render(<ProgressBar value={65} />);
    expect(screen.queryByText("65%")).not.toBeInTheDocument();
  });

  it("applies correct width style to inner bar", () => {
    const { container } = render(<ProgressBar value={42} />);
    const innerBar = container.querySelector("[style]");
    expect(innerBar).toHaveStyle({ width: "42%" });
  });
});

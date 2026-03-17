import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders with text content", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies default variant", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default").className).toMatch(/bg-indigo-100/);
  });

  it("applies success variant", () => {
    render(<Badge variant="success">Done</Badge>);
    expect(screen.getByText("Done").className).toMatch(/bg-green-100/);
  });

  it("applies warning variant", () => {
    render(<Badge variant="warning">Pending</Badge>);
    expect(screen.getByText("Pending").className).toMatch(/bg-amber-100/);
  });

  it("applies danger variant", () => {
    render(<Badge variant="danger">Error</Badge>);
    expect(screen.getByText("Error").className).toMatch(/bg-red-100/);
  });

  it("applies small size", () => {
    render(<Badge size="sm">Small</Badge>);
    expect(screen.getByText("Small").className).toMatch(/text-xs/);
  });

  it("merges custom className", () => {
    render(<Badge className="my-custom">Custom</Badge>);
    expect(screen.getByText("Custom").className).toContain("my-custom");
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders with children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("handles click events", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled when loading", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows spinner when loading", () => {
    const { container } = render(<Button loading>Loading</Button>);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("does not show spinner when not loading", () => {
    const { container } = render(<Button>Normal</Button>);
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("applies variant classes", () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    expect(screen.getByRole("button").className).toMatch(/bg-indigo-600/);

    rerender(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button").className).toMatch(/bg-red-600/);

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole("button").className).toMatch(/border/);
  });

  it("applies size classes", () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button").className).toMatch(/h-8/);

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button").className).toMatch(/h-12/);
  });

  it("merges custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    expect(screen.getByRole("button").className).toContain("custom-class");
  });

  it("forwards ref", () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Ref</Button>);
    expect(ref).toHaveBeenCalled();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { EmptyState } from "@/components/ui/empty-state";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<EmptyState title="Empty" description="Try adding some items" />);
    expect(screen.getByText("Try adding some items")).toBeInTheDocument();
  });

  it("renders without description", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText("Try")).not.toBeInTheDocument();
  });

  it("renders icon", () => {
    render(
      <EmptyState
        title="Empty"
        icon={<span data-testid="icon">📦</span>}
      />
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders action element", () => {
    render(
      <EmptyState
        title="Empty"
        action={<button>Add Item</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Add Item" })).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<EmptyState title="Test" className="my-class" />);
    expect((container.firstChild as HTMLElement).className).toContain("my-class");
  });
});

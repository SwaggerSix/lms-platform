import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { StatCard } from "@/components/ui/stat-card";

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="Total Users" value={1234} />);
    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<StatCard title="Status" value="Active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders positive change indicator", () => {
    render(
      <StatCard
        title="Revenue"
        value="$1,000"
        change={{ value: 12, direction: "up" }}
      />
    );
    expect(screen.getByText("12%")).toBeInTheDocument();
  });

  it("renders negative change indicator", () => {
    render(
      <StatCard
        title="Churn"
        value="5%"
        change={{ value: 3, direction: "down" }}
      />
    );
    expect(screen.getByText("3%")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <StatCard
        title="Test"
        value={42}
        icon={<span data-testid="stat-icon">📊</span>}
      />
    );
    expect(screen.getByTestId("stat-icon")).toBeInTheDocument();
  });

  it("renders without change or icon", () => {
    render(<StatCard title="Simple" value={100} />);
    expect(screen.getByText("Simple")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function TestTabs({ value = "tab1", onChange = vi.fn() }) {
  return (
    <Tabs value={value} onChange={onChange}>
      <TabsList>
        <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        <TabsTrigger value="tab3">Tab 3</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1">Content 1</TabsContent>
      <TabsContent value="tab2">Content 2</TabsContent>
      <TabsContent value="tab3">Content 3</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("renders tab triggers", () => {
    render(<TestTabs />);
    expect(screen.getByText("Tab 1")).toBeInTheDocument();
    expect(screen.getByText("Tab 2")).toBeInTheDocument();
    expect(screen.getByText("Tab 3")).toBeInTheDocument();
  });

  it("renders tablist role", () => {
    render(<TestTabs />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("renders tab triggers with tab role", () => {
    render(<TestTabs />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
  });

  it("shows active tab content", () => {
    render(<TestTabs value="tab1" />);
    expect(screen.getByText("Content 1")).toBeInTheDocument();
    expect(screen.queryByText("Content 2")).not.toBeInTheDocument();
  });

  it("marks active tab with aria-selected", () => {
    render(<TestTabs value="tab2" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[2]).toHaveAttribute("aria-selected", "false");
  });

  it("calls onChange when tab is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TestTabs onChange={onChange} />);
    await user.click(screen.getByText("Tab 2"));
    expect(onChange).toHaveBeenCalledWith("tab2");
  });

  it("renders tabpanel role for active content", () => {
    render(<TestTabs value="tab1" />);
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });
});

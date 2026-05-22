import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { FuzzyCombobox, type ComboboxSuggestion } from "@/components/ui/fuzzy-combobox";

const suggestions: ComboboxSuggestion[] = [
  { value: "Created" },
  { value: "Updated" },
  { value: "replay.cron_alerts", label: "Replays" },
  { value: "refresh.notification_audit_view", label: "View refreshes" },
  { value: "export.notification_audit_csv", label: "CSV exports", meta: "12 rows" },
];

describe("FuzzyCombobox", () => {
  it("renders the value and a search input", () => {
    const onChange = vi.fn();
    render(
      <FuzzyCombobox
        value="repl"
        onChange={onChange}
        suggestions={suggestions}
        ariaLabel="Filter"
      />
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("repl");
  });

  it("opens the listbox on focus and shows all suggestions when query is empty", () => {
    const onChange = vi.fn();
    render(
      <FuzzyCombobox value="" onChange={onChange} suggestions={suggestions} ariaLabel="Filter" />
    );
    fireEvent.focus(screen.getByRole("combobox"));
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(suggestions.length);
  });

  it("filters by subsequence match (alerts → replay.cron_alerts)", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FuzzyCombobox value="" onChange={onChange} suggestions={suggestions} />
    );
    fireEvent.focus(screen.getByRole("combobox"));
    rerender(<FuzzyCombobox value="alerts" onChange={onChange} suggestions={suggestions} />);
    const visible = screen
      .getAllByRole("option")
      .map((el) => el.textContent ?? "");
    expect(visible.some((t) => t.includes("replay.cron_alerts"))).toBe(true);
    expect(visible.some((t) => t.startsWith("Created"))).toBe(false);
  });

  it("prefix matches sort ahead of mid-string matches", () => {
    const onChange = vi.fn();
    render(
      <FuzzyCombobox value="re" onChange={onChange} suggestions={suggestions} />
    );
    fireEvent.focus(screen.getByRole("combobox"));
    const options = screen.getAllByRole("option");
    // "replay.cron_alerts" and "refresh.notification_audit_view" both
    // start with "re"; "Created" matches but as mid-string (c-r-e-a-t-e-d).
    // The first two should come before "Created".
    const firstText = options[0].textContent ?? "";
    expect(firstText.toLowerCase().startsWith("re")).toBe(true);
  });

  it("Enter commits the highlighted option", () => {
    const onChange = vi.fn();
    render(<FuzzyCombobox value="re" onChange={onChange} suggestions={suggestions} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(typeof lastCall).toBe("string");
    expect(lastCall.toLowerCase().startsWith("re")).toBe(true);
  });

  it("ArrowDown then Enter commits the second option", () => {
    const onChange = vi.fn();
    render(<FuzzyCombobox value="re" onChange={onChange} suggestions={suggestions} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    const opts = screen.getAllByRole("option");
    const firstText = opts[0].textContent ?? "";
    const secondText = opts[1].textContent ?? "";
    expect(firstText).not.toBe(secondText);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    const committed = onChange.mock.calls.at(-1)?.[0];
    expect(secondText).toContain(committed);
  });

  it("Escape closes the listbox without changing value", () => {
    const onChange = vi.fn();
    render(<FuzzyCombobox value="r" onChange={onChange} suggestions={suggestions} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(screen.queryByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders meta text for suggestions that carry it", () => {
    const onChange = vi.fn();
    render(<FuzzyCombobox value="" onChange={onChange} suggestions={suggestions} />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getByText("12 rows")).toBeInTheDocument();
  });
});

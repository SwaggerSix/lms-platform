import { describe, it, expect } from "vitest";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime-local";

// The coupon form's date fields: a date saved from the form must open again
// for editing showing the same wall-clock time, whatever the admin's zone.
describe("datetime-local conversion", () => {
  it("round-trips a typed local time", () => {
    const typed = "2026-12-31T17:45";
    expect(isoToLocalInput(localInputToIso(typed))).toBe(typed);
  });

  it("shows a stored instant in local time", () => {
    const d = new Date(2026, 2, 8, 9, 5); // local 2026-03-08 09:05
    expect(isoToLocalInput(d.toISOString())).toBe("2026-03-08T09:05");
  });

  it("treats empty and invalid values as no date", () => {
    expect(isoToLocalInput(null)).toBe("");
    expect(isoToLocalInput("nope")).toBe("");
    expect(localInputToIso("")).toBeNull();
  });
});

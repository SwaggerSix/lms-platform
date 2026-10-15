import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseRoster } from "./parser";

function workbook(rows: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("parseRoster", () => {
  it("reads attendance from 'Attended Day N' columns", () => {
    const out = parseRoster(
      workbook([
        ["Roster FCR 404 - COR Refresher"],
        ["#", "Learner Name", "Email Address", "Org", "Attended Day 1", "Attended Day 2"],
        [1, "Jena Smith", "Jena.Smith@nasa.gov", "GRC", "X", "X"],
        [2, "Al Jones", "al.jones@nasa.gov", "GRC", "X", ""],
      ]),
      {},
    );
    expect(out).toEqual([
      { email: "jena.smith@nasa.gov", full_name: "Jena Smith", org: "GRC", days_total: 2, days_attended: 2, attendance_status: "present" },
      { email: "al.jones@nasa.gov", full_name: "Al Jones", org: "GRC", days_total: 2, days_attended: 1, attendance_status: "absent" },
    ]);
  });

  it("counts one dated column per class day", () => {
    const out = parseRoster(
      workbook([
        ["The Federal Budget Process May 29-30, 2024"],
        ["Last", "First", "Email address", "05/29/2024", "05/30/2024"],
        ["Acevedo", "Sathya", "sathya.y.acevedo@hud.gov", "P", "P"],
      ]),
      {},
    );
    expect(out[0]).toMatchObject({ days_total: 2, days_attended: 2, attendance_status: "present" });
  });

  it("marks attendance unknown on a registration list, and reads 'LAST, FIRST' names", () => {
    const out = parseRoster(
      workbook([
        ["LAST, FIRST", "Learner's Work Email"],
        ["Amicone, Rex", "rex.amicone@doe.gov"],
      ]),
      {},
    );
    expect(out).toEqual([
      { email: "rex.amicone@doe.gov", full_name: "Amicone, Rex", org: undefined, days_total: 0, days_attended: 0, attendance_status: "unknown" },
    ]);
  });
});

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

  it("reads a sign-in sheet: 'Registered Attendees' names, 'Signature' X / NS, walk-ins unknown", () => {
    const out = parseRoster(
      workbook([
        ["FGR 402 - ETHICS IN THE GRANTS ENVIRONMENT: Session Sign-In Sheet"],
        ["Date:", "6/16/2026"],
        ["Registered Attendees", "Email Address", "Signature"],
        ["Anderson, Nicholas", "nicholas.anderson@netl.doe.gov", "X"],
        ["Heath, Amie", "amie.heath@netl.doe.gov", "NS"],
        [],
        ["Additional Attendees (Please Print Name)", "Address", ""],
        ["", "melissa.pine@hq.doe.gov", ""],
      ]),
      {},
    );
    expect(out.map((a) => [a.email, a.full_name, a.attendance_status])).toEqual([
      ["nicholas.anderson@netl.doe.gov", "Anderson, Nicholas", "present"],
      ["amie.heath@netl.doe.gov", "Heath, Amie", "absent"],
      ["melissa.pine@hq.doe.gov", undefined, "unknown"],
    ]);
  });

  it("reads 'August 4, 2026' day columns with Present / Absent, and skips people without an email", () => {
    const out = parseRoster(
      workbook([
        ["Federal Appropriations Law & PIA Training"],
        ["No.", "Participant Name", "Work Email", "Role", "August 4, 2026", "August 5, 2026", "August 6, 2026"],
        [1, "Amicone, Rex", "rex.amicone@doe.gov", "Participant", "Absent", "Absent", "Absent"],
        [2, "Cadigan, Kristen", "kristen.cadigan@doe.gov", "Participant", "Present", "Present", "Present"],
        [20, "Villacis, Caroline", "", "Auditor", "", "", ""],
      ]),
      {},
    );
    expect(out.map((a) => [a.full_name, a.days_attended, a.days_total, a.attendance_status])).toEqual([
      ["Amicone, Rex", 0, 3, "absent"],
      ["Cadigan, Kristen", 3, 3, "present"],
    ]);
  });

  it("reads '22-Jun' day columns; a no-show is absent, a totals row or unmarked extra is unknown", () => {
    const out = parseRoster(
      workbook([
        ["FCR 404 - COR Refresher #139743 Roster"],
        ["#", "Learner Name", "Email Address", "Org", "22-Jun", "23-Jun", "Score", "Completed"],
        [1, "KIBLER, KEMPER", "K.S.KIBLER@NASA.GOV", "LARC-D107", "X", "X", "100%", "Y"],
        [4, "UDOH, ENOBONG", "ENOBONG.D.UDOH@NASA.GOV", "JSC-BR111", "NS", "NS", "NA", "NA"],
        ["", "", "charlyn.r.vanderhoff@nasa.gov", "", 3, 3, "97%", ""],
        ["", "", "tracy.a.bennett@nasa.gov", "", "", "", "", ""],
      ]),
      {},
    );
    expect(out.map((a) => [a.email, a.attendance_status])).toEqual([
      ["k.s.kibler@nasa.gov", "present"],
      ["enobong.d.udoh@nasa.gov", "absent"],
      ["charlyn.r.vanderhoff@nasa.gov", "unknown"],
      ["tracy.a.bennett@nasa.gov", "unknown"],
    ]);
  });
});

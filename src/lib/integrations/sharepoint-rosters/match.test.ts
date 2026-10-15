import { describe, expect, it } from "vitest";
import { dateFolderPrefix, pickClassFolder, pickRosterFile, scoreFolder, type FolderCandidate } from "./match";

const f = (name: string, parentPath: string, id = name): FolderCandidate => ({ id, name, parentPath });

describe("dateFolderPrefix", () => {
  it("turns an ISO date into the folder prefix", () => {
    expect(dateFolderPrefix("2026-08-04")).toBe("2026.08.04");
  });
});

describe("pickClassFolder", () => {
  it("takes the only folder dated that day, wherever it is filed", () => {
    const out = pickClassFolder(
      [
        f("2026.08.04 DOE Federal Appropriations Law & PIA", "/drive/root:/_Courses/DOE/FY26"),
        f("2026.08.14 DOE FFM 101", "/drive/root:/_Courses/DOE/FY26"),
      ],
      { session_date: "2026-08-04", title: "2026-057" },
    );
    expect(out).toMatchObject({ kind: "match", folder: { name: "2026.08.04 DOE Federal Appropriations Law & PIA" } });
  });

  it("is none when no folder carries the date", () => {
    expect(pickClassFolder([f("2026.08.05 DOE", "/_Courses/DOE")], { session_date: "2026-08-04" })).toEqual({ kind: "none" });
  });

  it("picks among same-day classes by course, code and customer", () => {
    const folders = [
      f("2026.10.05 - NASA", "/drive/root:/_Courses/NASA 2026/FCR 404 COR Refresher", "nasa"),
      f("2026.10.05 NAVFAC", "/drive/root:/_Courses/AI Literacy", "navfac"),
    ];
    expect(pickClassFolder(folders, { session_date: "2026-10-05", title: "AC: FCR 404 COR Refresher", course_code: "COR_R" }))
      .toMatchObject({ kind: "match", folder: { id: "nasa" } });
    expect(pickClassFolder(folders, { session_date: "2026-10-05", title: "SB: AI Literacy" }))
      .toMatchObject({ kind: "match", folder: { id: "navfac" } });
    expect(pickClassFolder(folders, { session_date: "2026-10-05", title: "Something", customer_code: "NAVFAC" }))
      .toMatchObject({ kind: "match", folder: { id: "navfac" } });
  });

  it("matches a course's initials and word stems (BWEE, WRITE)", () => {
    const folders = [
      f("2026.06.16 FGR 402 Ethics in the Grants Environment", "/drive/root:/_Courses/FGR 402 Ethics in Grants Environment", "fgr"),
      f("2026.06.16 DOE FGR 402", "/drive/root:/_Courses/DOE/FY26", "doe"),
      f("2026.06.16 DOI BWEE", "/drive/root:/_Courses/WRITE/FY26", "bwee"),
    ];
    expect(pickClassFolder(folders, { session_date: "2026-06-16", title: "CM: Business Writing & Email Etiquette (16 hrs)" }))
      .toMatchObject({ kind: "match", folder: { id: "bwee" } });
    expect(pickClassFolder(folders, { session_date: "2026-06-16", title: "GR: FGR 402 Ethics in Grants Environment" }))
      .toMatchObject({ kind: "match", folder: { id: "fgr" } });
  });

  it("reports a tie instead of guessing", () => {
    const out = pickClassFolder(
      [f("2026.07.31 DOI", "/_Courses/MGT/A", "a"), f("2026.07.31 DOI", "/_Courses/MGT/B", "b")],
      { session_date: "2026-07-31", title: "2026-020" },
    );
    expect(out).toMatchObject({ kind: "ambiguous" });
    expect(out.kind === "ambiguous" && out.folders.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("scoreFolder", () => {
  it("matches codes regardless of spacing, and ignores filler words", () => {
    const folder = f("2026.06.16 DOE FGR 402", "/_Courses/DOE/FY26");
    expect(scoreFolder(folder, { session_date: "2026-06-16", course_code: "FGR402" })).toBe(3);
    expect(scoreFolder(folder, { session_date: "2026-06-16", title: "The Training Course" })).toBe(0);
  });
});

describe("pickRosterFile", () => {
  const file = (name: string, at: string) => ({ name, lastModifiedDateTime: at, file: {} });
  it("prefers the latest file named roster, else the latest workbook", () => {
    expect(pickRosterFile([file("Roster - Day 1.xlsx", "2026-10-05"), file("Roster - FINAL.xlsx", "2026-10-09"), file("Sign-in.xlsx", "2026-10-10")])?.name)
      .toBe("Roster - FINAL.xlsx");
    expect(pickRosterFile([file("a.xlsx", "2026-01-01"), file("b.xlsx", "2026-02-01"), file("c.pdf", "2026-03-01")])?.name).toBe("b.xlsx");
    expect(pickRosterFile([{ name: "folder", lastModifiedDateTime: "x" }])).toBeNull();
  });
  it("prefers FINAL over a day's copy, and never picks the evaluation", () => {
    const doe = [
      file("Federal_Appropriations_Law_PIA_3-Day_Roster_August_4-6_2026 Day 1.xlsx", "2026-08-05T13:42"),
      file("Federal_Appropriations_Law_PIA_3-Day_Roster_August_4-6_2026 FINAL.xlsx", "2026-08-07T18:28"),
      file("Federal_Appropriations_Law_PIA_3-Day_Roster_August_4-6_2026 EVALUATION.xlsx", "2026-08-07T18:30"),
      file("Federal_Appropriations_Law_PIA_3-Day_Roster_August_4-6_2026.xlsx", "2026-08-04T12:17"),
    ];
    expect(pickRosterFile(doe)?.name).toBe("Federal_Appropriations_Law_PIA_3-Day_Roster_August_4-6_2026 FINAL.xlsx");
    expect(pickRosterFile([file("Copy of X Roster.xlsx", "2026-06-22"), file("X FINAL ROSTER.xlsx", "2026-06-25")])?.name).toBe("X FINAL ROSTER.xlsx");
  });
});

describe("olderThan (folder walk pruning)", async () => {
  const { olderThan } = await import("./client");
  it("skips year folders before the earliest session's year, walks the rest", () => {
    expect(olderThan("FY24", 2026)).toBe(true);
    expect(olderThan("2025", 2026)).toBe(true);
    expect(olderThan("2025.08 HUD Federal Budget", 2026)).toBe(true);
    expect(olderThan("NASA 2026", 2026)).toBe(false);
    expect(olderThan("FY26", 2026)).toBe(false);
    expect(olderThan("DOE", 2026)).toBe(false);
    expect(olderThan("FCR 404 COR Refresher", 2026)).toBe(false);
  });
});

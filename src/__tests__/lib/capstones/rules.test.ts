import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  addMonths,
  capstoneContentType,
  capstoneState,
  isAcceptableLink,
  isOwnCapstonePath,
  safeFileName,
  type CapstoneAttempt,
} from "@/lib/capstones/rules";

const a = (attempt: number, status: CapstoneAttempt["status"], another_attempt_allowed = false): CapstoneAttempt => ({
  attempt,
  status,
  another_attempt_allowed,
});

describe("capstoneState (two attempts, then a call)", () => {
  it("is locked until the path is complete", () => {
    expect(capstoneState([], 2, false)).toEqual({ kind: "locked" });
  });

  it("opens attempt 1 once the path is complete", () => {
    expect(capstoneState([], 2, true)).toEqual({ kind: "open", nextAttempt: 1 });
  });

  it("waits while an attempt is being marked", () => {
    expect(capstoneState([a(1, "submitted")], 2, true)).toEqual({ kind: "waiting", attempt: 1 });
  });

  it("allows one resubmission after the first Not yet", () => {
    expect(capstoneState([a(1, "not_yet")], 2, true)).toEqual({ kind: "open", nextAttempt: 2 });
  });

  it("needs a call after the second Not yet", () => {
    expect(capstoneState([a(1, "not_yet"), a(2, "not_yet")], 2, true)).toEqual({ kind: "needs_call", attempt: 2 });
  });

  it("reopens once the assessor allows another attempt after the call", () => {
    expect(capstoneState([a(1, "not_yet"), a(2, "not_yet", true)], 2, true)).toEqual({ kind: "open", nextAttempt: 3 });
  });

  it("needs another call if that extra attempt also fails", () => {
    expect(
      capstoneState([a(1, "not_yet"), a(2, "not_yet", true), a(3, "not_yet")], 2, true)
    ).toEqual({ kind: "needs_call", attempt: 3 });
  });

  it("is passed for good once any attempt passed, in any order", () => {
    expect(capstoneState([a(2, "passed"), a(1, "not_yet")], 2, true)).toEqual({ kind: "passed", attempt: 2 });
  });
});

describe("dates", () => {
  it("adds five years, clamping Feb 29", () => {
    expect(addMonths(new Date("2028-02-29T10:00:00Z"), 60).toISOString()).toBe("2033-02-28T10:00:00.000Z");
    expect(addMonths(new Date("2026-11-11T00:00:00Z"), 60).toISOString()).toBe("2031-11-11T00:00:00.000Z");
  });

  it("counts 10 business days, skipping weekends", () => {
    // Wed 11 Nov 2026 + 10 business days = Wed 25 Nov 2026
    expect(addBusinessDays(new Date("2026-11-11T12:00:00Z"), 10).toISOString().slice(0, 10)).toBe("2026-11-25");
    // Fri 13 Nov + 1 = Mon 16 Nov
    expect(addBusinessDays(new Date("2026-11-13T12:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-11-16");
  });
});

describe("files and links", () => {
  const user = "11111111-1111-4111-8111-111111111111";
  const cert = "22222222-2222-4222-8222-222222222222";

  it("only accepts paths in the learner's own folder for this certification", () => {
    expect(isOwnCapstonePath(`${user}/${cert}/abc-memo.pdf`, user, cert)).toBe(true);
    expect(isOwnCapstonePath(`${user}/${cert}/`, user, cert)).toBe(false);
    expect(isOwnCapstonePath(`33333333-3333-4333-8333-333333333333/${cert}/x.pdf`, user, cert)).toBe(false);
    expect(isOwnCapstonePath(`${user}/${cert}/../other/x.pdf`, user, cert)).toBe(false);
  });

  it("allows documents and slides, not video or executables", () => {
    expect(capstoneContentType("Memo.DOCX")).toContain("wordprocessingml");
    expect(capstoneContentType("deck.pptx")).toContain("presentationml");
    expect(capstoneContentType("briefing.mp4")).toBeNull();
    expect(capstoneContentType("run.exe")).toBeNull();
  });

  it("makes storage-safe names", () => {
    expect(safeFileName("../../My Memo (final).pdf")).toBe("My-Memo-final-.pdf");
    expect(safeFileName("")).toBe("file");
  });

  it("only accepts https links", () => {
    expect(isAcceptableLink("https://www.loom.com/share/abc")).toBe(true);
    expect(isAcceptableLink("http://example.com/x")).toBe(false);
    expect(isAcceptableLink("javascript:alert(1)")).toBe(false);
    expect(isAcceptableLink("not a url")).toBe(false);
  });
});

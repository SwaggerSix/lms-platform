import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/sender", () => ({ sendEmail: vi.fn(async () => ({ success: true, id: "x" })) }));

import { sendAwardedEmail, sendRevokedEmail } from "@/lib/certifications/notify";
import { sendEmail } from "@/lib/email/sender";

/** "When all gates are green, you'll get an email" — MOS-100 M10-08. */

let row: Record<string, unknown> | null;
const service: any = {
  from: () => {
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: null }) };
    return q;
  },
};

beforeEach(() => {
  vi.mocked(sendEmail).mockClear();
  row = {
    issued_at: "2026-11-11T12:00:00Z",
    expires_at: "2031-11-11T12:00:00Z",
    user: { email: "lee@example.com", first_name: "Lee" },
    certification: { name: "Mosaic Certified — Mosaic Practitioner" },
  };
});

describe("certification emails", () => {
  it("tells the learner they're certified, until when, and links their certificate", async () => {
    await sendAwardedEmail(service, "uc1");
    const msg = vi.mocked(sendEmail).mock.calls[0][0] as any;
    expect(msg.to).toBe("lee@example.com");
    expect(msg.subject).toBe("You're certified: Mosaic Certified — Mosaic Practitioner");
    expect(msg.text).toContain("valid until November 11, 2031");
    expect(msg.html).toContain("/learn/certifications");
  });

  it("tells the learner when it's revoked", async () => {
    await sendRevokedEmail(service, "uc1");
    const msg = vi.mocked(sendEmail).mock.calls[0][0] as any;
    expect(msg.subject).toContain("no longer active");
  });

  it("sends nothing without an address", async () => {
    row = { ...row!, user: { email: null } };
    await sendAwardedEmail(service, "uc1");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

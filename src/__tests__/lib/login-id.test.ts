import { describe, it, expect } from "vitest";
import {
  isValidLoginId,
  normalizeLoginId,
  loginIdToEmail,
  isSyntheticLoginEmail,
  loginIdentifierToEmail,
  LOGIN_ID_EMAIL_DOMAIN,
} from "@/lib/users/login-id";
import { createUserSchema } from "@/lib/validations";

describe("login-id helpers", () => {
  it("accepts well-formed login IDs", () => {
    expect(isValidLoginId("participant-0142")).toBe(true);
    expect(isValidLoginId("j.smith_01")).toBe(true);
    expect(isValidLoginId("abc")).toBe(true);
  });

  it("rejects malformed login IDs", () => {
    expect(isValidLoginId("ab")).toBe(false); // too short
    expect(isValidLoginId(".starts-with-dot")).toBe(false);
    expect(isValidLoginId("ends-with-dash-")).toBe(false);
    expect(isValidLoginId("has space")).toBe(false);
    expect(isValidLoginId("double..dot")).toBe(false);
    expect(isValidLoginId("has@sign")).toBe(false);
    expect(isValidLoginId("x".repeat(65))).toBe(false);
  });

  it("normalizes and maps to the synthetic email domain", () => {
    expect(normalizeLoginId("  Participant-01 ")).toBe("participant-01");
    expect(loginIdToEmail("Participant-01")).toBe(`participant-01@${LOGIN_ID_EMAIL_DOMAIN}`);
  });

  it("detects synthetic emails", () => {
    expect(isSyntheticLoginEmail(`someone@${LOGIN_ID_EMAIL_DOMAIN}`)).toBe(true);
    expect(isSyntheticLoginEmail("someone@acme.com")).toBe(false);
    expect(isSyntheticLoginEmail(null)).toBe(false);
  });

  it("maps a typed login identifier to the auth email", () => {
    expect(loginIdentifierToEmail("user@acme.com")).toBe("user@acme.com");
    expect(loginIdentifierToEmail("Participant-01")).toBe(`participant-01@${LOGIN_ID_EMAIL_DOMAIN}`);
  });
});

describe("createUserSchema modes", () => {
  it("accepts the classic email mode", () => {
    const parsed = createUserSchema.safeParse({
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@acme.com",
    });
    expect(parsed.success).toBe(true);
  });

  it("requires email and names when no login ID is given", () => {
    const parsed = createUserSchema.safeParse({ first_name: "Jane" });
    expect(parsed.success).toBe(false);
  });

  it("accepts a login ID with no email and no names", () => {
    const parsed = createUserSchema.safeParse({ login_id: "participant-0142" });
    expect(parsed.success).toBe(true);
  });

  it("rejects providing both email and login ID", () => {
    const parsed = createUserSchema.safeParse({
      login_id: "participant-0142",
      email: "jane@acme.com",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects malformed login IDs", () => {
    expect(createUserSchema.safeParse({ login_id: "a" }).success).toBe(false);
    expect(createUserSchema.safeParse({ login_id: "bad id!" }).success).toBe(false);
  });
});

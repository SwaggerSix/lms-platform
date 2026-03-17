import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();

// Mock the Resend SDK - use a real class so `new Resend(...)` works
vi.mock("resend", () => {
  return {
    Resend: class MockResend {
      emails = { send: sendMock };
      constructor(_apiKey?: string) {}
    },
  };
});

import {
  sendEmail,
  createEmailSender,
  ConsoleTransport,
  ResendTransport,
  SendGridTransport,
} from "@/lib/email/sender";

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("returns success with message id when send succeeds", async () => {
    sendMock.mockResolvedValue({ data: { id: "msg-123" }, error: null });
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.id).toBe("msg-123");
    }
  });

  it("calls Resend with correct parameters", async () => {
    sendMock.mockResolvedValue({ data: { id: "msg-1" }, error: null });
    await sendEmail({
      to: "user@example.com",
      subject: "Welcome",
      html: "<p>Hi</p>",
      text: "Hi",
      replyTo: "support@example.com",
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["user@example.com"],
        subject: "Welcome",
        html: "<p>Hi</p>",
        text: "Hi",
        reply_to: "support@example.com",
      })
    );
  });

  it("accepts array of recipients", async () => {
    sendMock.mockResolvedValue({ data: { id: "msg-2" }, error: null });
    await sendEmail({
      to: ["a@b.com", "c@d.com"],
      subject: "Bulk",
      html: "<p>Hi all</p>",
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["a@b.com", "c@d.com"],
      })
    );
  });

  it("returns dev-mock id when send fails in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    sendMock.mockRejectedValue(new Error("API key invalid"));
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Dev test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.id).toBe("dev-mock");
    }

    vi.unstubAllEnvs();
  });

  it("returns error in production when send fails", async () => {
    vi.stubEnv("NODE_ENV", "production");

    sendMock.mockRejectedValue(new Error("API limit exceeded"));
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Prod test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("API limit exceeded");
    }

    vi.unstubAllEnvs();
  });

  it("returns error when Resend returns error object", async () => {
    vi.stubEnv("NODE_ENV", "production");

    sendMock.mockResolvedValue({ data: null, error: { message: "Invalid from address" } });
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid from address");
    }

    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// createEmailSender factory
// ---------------------------------------------------------------------------
describe("createEmailSender", () => {
  it("returns ConsoleTransport for console provider", () => {
    const sender = createEmailSender({ provider: "console" });
    expect(sender).toBeInstanceOf(ConsoleTransport);
  });

  it("returns ResendTransport when resend provider and apiKey given", () => {
    const sender = createEmailSender({ provider: "resend", apiKey: "re_test" });
    expect(sender).toBeInstanceOf(ResendTransport);
  });

  it("throws when resend provider has no apiKey", () => {
    expect(() => createEmailSender({ provider: "resend" })).toThrow("Resend API key required");
  });

  it("throws when sendgrid provider has no apiKey", () => {
    expect(() => createEmailSender({ provider: "sendgrid" })).toThrow("SendGrid API key required");
  });

  it("returns SendGridTransport when sendgrid provider and apiKey given", () => {
    const sender = createEmailSender({ provider: "sendgrid", apiKey: "SG.test" });
    expect(sender).toBeInstanceOf(SendGridTransport);
  });
});

// ---------------------------------------------------------------------------
// ConsoleTransport
// ---------------------------------------------------------------------------
describe("ConsoleTransport", () => {
  it("logs the email and returns success", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const transport = new ConsoleTransport();
    const result = await transport.send({
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hi</p>",
      text: "Hi there",
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^console-/);
  });
});

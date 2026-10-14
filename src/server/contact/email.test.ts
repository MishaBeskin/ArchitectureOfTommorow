import { describe, expect, it, vi } from "vitest";
import { sendContactEmail, singleLine } from "./email";

const message = { name: "Ada Lovelace", email: "ada@example.com", message: "Hello there, a long enough message." };
const input = { apiKey: "re_key", to: "me@example.com", from: "Site <site@example.com>", message };

describe("singleLine", () => {
  it("collapses every kind of line break into a single space and trims", () => {
    const separators = String.fromCharCode(0x2028) + String.fromCharCode(0x2029);

    expect(singleLine(`a\r\nb\nc\r${separators}d`)).toBe("a b c d");
    expect(singleLine("  padded  ")).toBe("padded");
  });

  it("truncates to the maximum length", () => {
    expect(singleLine("x".repeat(500), 100)).toHaveLength(100);
  });
});

describe("sendContactEmail", () => {
  it("posts the message to Resend with the key, recipient and reply-to", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

    const ok = await sendContactEmail({ ...input, fetchImpl });

    expect(ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_key");
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: "Site <site@example.com>",
      to: ["me@example.com"],
      reply_to: "ada@example.com",
      subject: "New message from Ada Lovelace",
    });
    expect(JSON.parse(init.body as string).text).toContain("Hello there, a long enough message.");
  });

  it("cannot be used to inject headers through the name or email", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

    await sendContactEmail({
      ...input,
      message: { ...message, name: "Ada\r\nBcc: victim@example.com", email: "a@b.co\r\nBcc: x@y.z" },
      fetchImpl,
    });

    const payload = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(payload.subject).not.toMatch(/[\r\n]/);
    expect(payload.reply_to).not.toMatch(/[\r\n]/);
    expect(payload.subject).toBe("New message from Ada Bcc: victim@example.com");
  });

  it("returns false instead of throwing when Resend rejects or is unreachable", async () => {
    const rejected = vi.fn(async () => new Response("{}", { status: 422 }));
    const down = vi.fn(async () => {
      throw new Error("network");
    });

    expect(await sendContactEmail({ ...input, fetchImpl: rejected })).toBe(false);
    expect(await sendContactEmail({ ...input, fetchImpl: down })).toBe(false);
  });
});

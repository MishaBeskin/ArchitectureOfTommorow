import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

const reply = (body: unknown, init?: ResponseInit) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200, ...init }));

describe("verifyTurnstile", () => {
  it("rejects a missing token without calling Cloudflare", async () => {
    const fetchImpl = reply({ success: true });

    expect(await verifyTurnstile({ secret: "s", token: null, fetchImpl })).toEqual({
      success: false,
      reason: "missing-token",
    });
    expect(await verifyTurnstile({ secret: "s", token: "", fetchImpl })).toMatchObject({ reason: "missing-token" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the secret, token and visitor IP to the siteverify endpoint", async () => {
    const fetchImpl = reply({ success: true });

    const result = await verifyTurnstile({ secret: "the-secret", token: "the-token", ip: "203.0.113.9", fetchImpl });

    expect(result).toEqual({ success: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("secret")).toBe("the-secret");
    expect(body.get("response")).toBe("the-token");
    expect(body.get("remoteip")).toBe("203.0.113.9");
  });

  it("omits the IP when it is unknown", async () => {
    const fetchImpl = reply({ success: true });

    await verifyTurnstile({ secret: "s", token: "t", ip: "unknown", fetchImpl });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.body as URLSearchParams).has("remoteip")).toBe(false);
  });

  it("reports a rejection with Cloudflare's error codes", async () => {
    const fetchImpl = reply({ success: false, "error-codes": ["invalid-input-response"] });

    expect(await verifyTurnstile({ secret: "s", token: "bad", fetchImpl })).toEqual({
      success: false,
      reason: "rejected",
      codes: ["invalid-input-response"],
    });
  });

  it("only accepts success === true, not a truthy lookalike", async () => {
    const fetchImpl = reply({ success: "true" });

    expect(await verifyTurnstile({ secret: "s", token: "t", fetchImpl })).toMatchObject({ success: false });
  });

  it("fails closed when Cloudflare is unreachable, errors, or answers nonsense", async () => {
    const down = vi.fn(async () => {
      throw new Error("network");
    });
    const serverError = vi.fn(async () => new Response("oops", { status: 500 }));
    const notJson = vi.fn(async () => new Response("<html>", { status: 200 }));

    for (const fetchImpl of [down, serverError, notJson]) {
      expect(await verifyTurnstile({ secret: "s", token: "t", fetchImpl })).toEqual({
        success: false,
        reason: "unreachable",
      });
    }
  });
});

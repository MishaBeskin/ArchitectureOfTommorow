const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult =
  | { success: true }
  | { success: false; reason: "missing-token" | "rejected" | "unreachable"; codes?: string[] };

interface VerifyInput {
  secret: string;
  /** The `cf-turnstile-response` field the widget adds to the form. */
  token: string | null | undefined;
  ip?: string;
  fetchImpl?: typeof fetch;
}

/** Verifies a Turnstile token server-side. Fails closed: any doubt is a rejection. */
export async function verifyTurnstile({ secret, token, ip, fetchImpl = fetch }: VerifyInput): Promise<TurnstileResult> {
  if (!token) return { success: false, reason: "missing-token" };

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  try {
    const response = await fetchImpl(VERIFY_URL, {
      method: "POST",
      body,
      // A verification that hangs must not hang the form.
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { success: false, reason: "unreachable" };

    const data = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    return data.success === true
      ? { success: true }
      : { success: false, reason: "rejected", codes: data["error-codes"] };
  } catch {
    return { success: false, reason: "unreachable" };
  }
}

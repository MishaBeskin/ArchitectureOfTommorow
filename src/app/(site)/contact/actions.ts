"use server";

import { headers } from "next/headers";
import type { ContactState } from "@/lib/contact-validation";
import { getContactEnv, getServerEnv } from "@/env";
import { sendContactEmail } from "@/server/contact/email";
import { handleContactSubmission } from "@/server/contact/submit";
import { verifyTurnstile } from "@/server/contact/turnstile";
import { getDb } from "@/server/db/client";

/** A text field, capped so an oversized request cannot make us process megabytes. */
function field(data: FormData, name: string, max: number): string {
  const value = data.get(name);
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * Receives the contact form. All decisions live in handleContactSubmission; this only reads the
 * request, builds the real dependencies, and makes sure no exception ever reaches the visitor.
 */
export async function submitContact(_previous: ContactState, formData: FormData): Promise<ContactState> {
  const values = {
    name: field(formData, "name", 500),
    email: field(formData, "email", 500),
    message: field(formData, "message", 10_000),
  };

  try {
    const requestHeaders = await headers();
    // x-forwarded-for is only trustworthy behind a proxy that sets it, such as Vercel.
    const ip =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "unknown";

    const contact = getContactEnv();
    const server = getServerEnv();

    const elapsedText = field(formData, "elapsedMs", 20);
    const elapsed = Number(elapsedText);
    const { RESEND_API_KEY: apiKey, CONTACT_TO_EMAIL: to } = contact;

    return await handleContactSubmission(
      {
        db: getDb(),
        config: {
          turnstileSecret: contact.TURNSTILE_SECRET_KEY,
          rateLimitMax: contact.CONTACT_RATE_LIMIT_MAX,
          // Any server-only secret works as the hashing key; reusing one avoids another variable.
          ipHashKey: server.SUPABASE_SECRET_KEY,
          production: process.env.NODE_ENV === "production",
        },
        verifyTurnstile,
        sendEmail:
          apiKey && to
            ? (message) => sendContactEmail({ apiKey, to, from: contact.CONTACT_FROM_EMAIL, message })
            : undefined,
        log: console,
      },
      {
        values,
        honeypot: field(formData, "website", 500),
        elapsedMs: elapsedText !== "" && Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null,
        turnstileToken: field(formData, "cf-turnstile-response", 4096) || null,
        ip,
        userAgent: requestHeaders.get("user-agent"),
      },
    );
  } catch (error) {
    console.error("Contact submission failed", error);
    return {
      status: "error",
      message: "Something went wrong on our side. Please try again in a moment.",
      values,
    };
  }
}

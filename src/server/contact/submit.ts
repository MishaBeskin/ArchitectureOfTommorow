import { hashIp } from "../hash-ip";
import { validateContact, type ContactState, type ContactValues } from "@/lib/contact-validation";
import { contactMessages } from "../db/schema";
import type { AnyDb } from "../db/types";
import { consumeRateLimit } from "../rate-limit";
import type { TurnstileResult } from "./turnstile";

/** Faster than a person can read and type; sent by scripts that fill the form instantly. */
export const MIN_FILL_MS = 1_500;
export const RATE_LIMIT_WINDOW_SECONDS = 3_600;

export interface ContactSubmission {
  values: ContactValues;
  /** Hidden field real visitors never see or fill. */
  honeypot: string;
  /** How long the form was open, measured in the browser; null when JavaScript did not report it. */
  elapsedMs: number | null;
  turnstileToken: string | null;
  ip: string;
  userAgent: string | null;
}

export interface ContactDeps {
  db: AnyDb;
  config: {
    turnstileSecret?: string;
    rateLimitMax: number;
    /** Key for hashing visitor IPs so raw addresses are never stored. */
    ipHashKey: string;
    production: boolean;
  };
  verifyTurnstile: (input: { secret: string; token: string | null; ip: string }) => Promise<TurnstileResult>;
  /** Already bound to its API key and recipient; undefined when email is not configured. */
  sendEmail?: (message: ContactValues) => Promise<boolean>;
  log: { warn: (message: string, meta?: unknown) => void; error: (message: string, meta?: unknown) => void };
}

// Moved to ../hash-ip so the admin sign-in can share it; re-exported to keep this module's API.
export { hashIp };

const error = (message: string, values: ContactValues): ContactState => ({ status: "error", message, values });

/**
 * Order matters: the cheap, local checks run first so bots cost almost nothing, Turnstile (a
 * network call) only runs for submissions that already look valid and are within the limit, and
 * the message is stored before email is attempted so a mail outage never loses a message.
 */
export async function handleContactSubmission(deps: ContactDeps, submission: ContactSubmission): Promise<ContactState> {
  const { db, config, log } = deps;
  const { values } = submission;

  // 1. Honeypot: pretend it worked so the bot learns nothing, and store nothing.
  if (submission.honeypot.trim() !== "") return { status: "success" };

  // 2. Validation.
  const errors = validateContact(values);
  if (Object.keys(errors).length > 0) return { status: "error", errors, values };

  // 3. Filled in faster than a person could.
  if (submission.elapsedMs !== null && submission.elapsedMs < MIN_FILL_MS) {
    return error("That was very quick. Please check your message and send it again.", values);
  }

  // 4. Rate limit per visitor.
  const ipHash = hashIp(submission.ip, config.ipHashKey);
  const limit = await consumeRateLimit(db, `contact:ip:${ipHash}`, {
    limit: config.rateLimitMax,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
  });
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
    return error(`You have sent several messages already. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`, values);
  }

  // 5. Bot check. Without a secret: skipped in development, refused in production (fail closed).
  if (config.turnstileSecret) {
    const result = await deps.verifyTurnstile({
      secret: config.turnstileSecret,
      token: submission.turnstileToken,
      ip: submission.ip,
    });
    if (!result.success) {
      log.warn("Turnstile verification failed", { reason: result.reason });
      return error("We could not verify that you are human. Please try again.", values);
    }
  } else if (config.production) {
    log.error("TURNSTILE_SECRET_KEY is not set; refusing contact submissions in production");
    return error("The contact form is temporarily unavailable. Please try again later.", values);
  }

  // 6. Store.
  const message: ContactValues = {
    name: values.name.trim(),
    email: values.email.trim(),
    message: values.message.trim(),
  };
  try {
    await db.insert(contactMessages).values({
      ...message,
      ipHash,
      userAgent: submission.userAgent?.slice(0, 300) ?? null,
    });
  } catch (cause) {
    log.error("Could not store a contact message", cause);
    return error("Something went wrong on our side. Please try again in a moment.", values);
  }

  // 7. Notify. The message is already safe in the database, so a mail failure is only logged.
  if (deps.sendEmail) {
    const sent = await deps.sendEmail(message);
    if (!sent) log.warn("Contact message stored but the notification email failed");
  }

  return { status: "success" };
}

import type { ContactValues } from "@/lib/contact-validation";

const RESEND_URL = "https://api.resend.com/emails";

interface SendInput {
  apiKey: string;
  to: string;
  from: string;
  message: ContactValues;
  fetchImpl?: typeof fetch;
}

/**
 * Header values must be one line: a newline in a name could inject extra email headers. The
 * Unicode line and paragraph separators are built from code points so no literal one sits in
 * this source file, where it would be treated as a line break.
 */
const LINE_BREAKS = new RegExp(`[\\r\\n${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]+`, "g");

export function singleLine(text: string, maxLength = 100): string {
  return text.replace(LINE_BREAKS, " ").trim().slice(0, maxLength);
}

/** Emails a contact message through Resend. Replies go straight to the sender. */
export async function sendContactEmail({ apiKey, to, from, message, fetchImpl = fetch }: SendInput): Promise<boolean> {
  try {
    const response = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: singleLine(message.email, 254),
        subject: `New message from ${singleLine(message.name)}`,
        text: `From: ${singleLine(message.name)} <${singleLine(message.email, 254)}>\n\n${message.message}`,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

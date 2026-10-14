"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Input, Textarea } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import {
  CONTACT_LIMITS,
  validateContact,
  type ContactErrors,
  type ContactState,
  type ContactValues,
} from "@/lib/contact-validation";
import { Turnstile, resetTurnstile } from "./turnstile";

const FIELD_IDS = { name: "contact-name", email: "contact-email", message: "contact-message" } as const;
const IDLE: ContactState = { status: "idle" };

export type ContactAction = (previous: ContactState, formData: FormData) => Promise<ContactState>;

interface ContactFormProps {
  /** The server action. Passed in (not imported) so the form can be tested without a server. */
  action: ContactAction;
  /** Public Turnstile key; without one no bot check is shown (development only). */
  turnstileSiteKey?: string;
}

function readValues(form: HTMLFormElement): ContactValues {
  const data = new FormData(form);
  return {
    name: String(data.get("name") ?? ""),
    email: String(data.get("email") ?? ""),
    message: String(data.get("message") ?? ""),
  };
}

export function ContactForm({ action, turnstileSiteKey }: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const [clientErrors, setClientErrors] = useState<ContactErrors>({});
  const [attempt, setAttempt] = useState(0);
  const openedAt = useRef<number | null>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  // Measured in the browser: a script that fills the form instantly gives itself away.
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  const failed = state.status === "error";
  const serverMessage = failed ? state.message : undefined;

  useEffect(() => {
    if (!failed) return;
    // A token can only be used once, so a retry needs a fresh challenge.
    resetTurnstile();
    messageRef.current?.focus();
  }, [state, failed]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const found = validateContact(readValues(form));
    setClientErrors(found);
    setAttempt((n) => n + 1);

    if (Object.keys(found).length > 0) {
      // Show the problems immediately instead of making a round trip to the server.
      event.preventDefault();
      return;
    }
    const elapsed = form.elements.namedItem("elapsedMs");
    if (elapsed instanceof HTMLInputElement && openedAt.current !== null) {
      elapsed.value = String(Date.now() - openedAt.current);
    }
  }

  // Errors from this browser's check win; otherwise show what the server said, but not stale
  // errors while a new submission is still in flight.
  const errors: ContactErrors =
    Object.keys(clientErrors).length > 0 ? clientErrors : !pending && failed ? (state.errors ?? {}) : {};
  const values = failed ? state.values : undefined;

  const summary = (Object.keys(errors) as (keyof ContactValues)[]).map((key) => ({
    fieldId: FIELD_IDS[key],
    message: errors[key] ?? "",
  }));
  // Changes whenever the user submits or the server answers, so the summary takes focus each time.
  const summaryKey = useMemo(() => ({}), [attempt, state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.status === "success") {
    return (
      <div role="status" className="flex max-w-xl flex-col items-start gap-4 rounded-xl border border-border-strong p-6">
        <h2 className="font-serif text-2xl font-medium">Thank you, your message is on its way</h2>
        <p className="text-muted">We have received it and will reply to the email address you gave us.</p>
        <Link href="/projects" className={buttonStyles({ variant: "secondary" })}>
          Browse projects
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-6">
      {serverMessage && (
        <p
          ref={messageRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border-2 border-danger p-4 font-medium text-danger"
        >
          {serverMessage}
        </p>
      )}
      <FormErrorSummary errors={summary} attempt={summaryKey} />

      <Field id={FIELD_IDS.name} label="Name" required error={errors.name}>
        {(c) => (
          <Input
            name="name"
            autoComplete="name"
            maxLength={CONTACT_LIMITS.name}
            defaultValue={values?.name}
            {...c}
          />
        )}
      </Field>
      <Field id={FIELD_IDS.email} label="Email" required error={errors.email}>
        {(c) => <Input name="email" type="email" autoComplete="email" defaultValue={values?.email} {...c} />}
      </Field>
      <Field
        id={FIELD_IDS.message}
        label="Message"
        hint={`Up to ${CONTACT_LIMITS.message} characters.`}
        required
        error={errors.message}
      >
        {(c) => <Textarea name="message" rows={6} defaultValue={values?.message} {...c} />}
      </Field>

      {/* Honeypot: invisible and unreachable for people, tempting for bots that fill every field. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="elapsedMs" defaultValue="" />

      {turnstileSiteKey && (
        <>
          <Turnstile siteKey={turnstileSiteKey} />
          {/* The bot check is a script, so without JavaScript the form cannot be accepted. Say so. */}
          <noscript>
            <p className="rounded-lg border border-border-strong p-4">
              The contact form needs JavaScript to check that you are not a robot. Please enable it to send a
              message.
            </p>
          </noscript>
        </>
      )}

      <div>
        <Button type="submit" loading={pending}>
          {pending ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}

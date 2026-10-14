"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import {
  CONTACT_LIMITS,
  validateContact,
  type ContactErrors,
  type ContactValues,
} from "@/lib/contact-validation";

const FIELD_IDS = { name: "contact-name", email: "contact-email", message: "contact-message" } as const;

/** Validation and error UI only. Sending is wired to a server action in step 13. */
export function ContactForm() {
  const [errors, setErrors] = useState<ContactErrors>({});
  const [attempt, setAttempt] = useState(0);
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values: ContactValues = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      message: String(data.get("message") ?? ""),
    };
    const found = validateContact(values);
    setErrors(found);
    setAttempt((n) => n + 1);
    setSent(Object.keys(found).length === 0);
  }

  const summary = (Object.keys(errors) as (keyof ContactValues)[]).map((key) => ({
    fieldId: FIELD_IDS[key],
    message: errors[key] ?? "",
  }));

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-6">
      <FormErrorSummary errors={summary} attempt={attempt} />
      {sent && (
        <p role="status" className="rounded-lg border border-border-strong p-4">
          Your message is valid, but sending is not connected yet.
        </p>
      )}
      <Field id={FIELD_IDS.name} label="Name" required error={errors.name}>
        {(c) => <Input name="name" autoComplete="name" maxLength={CONTACT_LIMITS.name} {...c} />}
      </Field>
      <Field id={FIELD_IDS.email} label="Email" required error={errors.email}>
        {(c) => <Input name="email" type="email" autoComplete="email" {...c} />}
      </Field>
      <Field
        id={FIELD_IDS.message}
        label="Message"
        hint={`Up to ${CONTACT_LIMITS.message} characters.`}
        required
        error={errors.message}
      >
        {(c) => <Textarea name="message" rows={6} {...c} />}
      </Field>
      <div>
        <Button type="submit">Send message</Button>
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Input, Textarea } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { FormErrorSummary, type ErrorSummaryItem } from "@/components/ui/form-error-summary";
import { ARCHITECT_LIMITS, type ArchitectField } from "@/lib/architect-schema";
import { slugify } from "@/lib/slug";
import type { SaveArchitectState } from "@/server/admin/handle-architect";

export type SaveArchitectAction = (previous: SaveArchitectState, formData: FormData) => Promise<SaveArchitectState>;

export interface ArchitectFormValues {
  name: string;
  slug: string;
  websiteUrl: string;
  bio: string;
}

const IDLE: SaveArchitectState = { status: "idle" };
const FIELD_ORDER: ArchitectField[] = ["name", "slug", "websiteUrl", "bio"];
const fieldId = (name: ArchitectField) => `field-${name}`;

/** What the admin typed before a failed save, as text; anything else becomes empty text. */
function submittedValues(values: Record<string, unknown>): ArchitectFormValues {
  const text = (name: string) => (typeof values[name] === "string" ? (values[name] as string) : "");
  return { name: text("name"), slug: text("slug"), websiteUrl: text("websiteUrl"), bio: text("bio") };
}

export function ArchitectForm({
  action,
  initial,
  architectId,
}: {
  action: SaveArchitectAction;
  initial: ArchitectFormValues;
  /** Set when editing; leave out to add a new architect. */
  architectId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const editing = architectId !== undefined;
  const values = state.status === "error" ? submittedValues(state.values) : initial;
  const errors = state.status === "error" ? state.errors : {};

  // The address follows the name until edited by hand; an existing architect's never follows it.
  const slugRef = useRef<HTMLInputElement>(null);
  const followName = useRef(!editing);
  const onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (followName.current && slugRef.current) slugRef.current.value = slugify(event.target.value);
  };
  const onSlugChange = (event: ChangeEvent<HTMLInputElement>) => {
    followName.current = !editing && event.target.value === "";
  };

  const messageRef = useRef<HTMLDivElement>(null);
  const hasFieldErrors = Object.keys(errors).length > 0;
  useEffect(() => {
    if (state.status === "saved" || (state.status === "error" && !hasFieldErrors)) messageRef.current?.focus();
  }, [state, hasFieldErrors]);

  const summaryItems: ErrorSummaryItem[] = FIELD_ORDER.flatMap((name) =>
    errors[name] ? [{ fieldId: fieldId(name), message: errors[name] }] : [],
  );

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6" noValidate>
      {architectId && <input type="hidden" name="id" value={architectId} />}

      {state.status === "saved" && (
        <div ref={messageRef} tabIndex={-1} role="status" className="rounded-lg border-2 border-accent p-4 font-medium">
          {state.message}
        </div>
      )}
      {state.status === "error" && !hasFieldErrors && (
        <div ref={messageRef} tabIndex={-1} role="alert" className="rounded-lg border-2 border-danger p-4 font-medium text-danger">
          {state.message}
        </div>
      )}
      <FormErrorSummary errors={summaryItems} attempt={state} />

      <Field id={fieldId("name")} label="Name" required error={errors.name}>
        {(c) => <Input name="name" defaultValue={values.name} onChange={onNameChange} {...c} />}
      </Field>
      <Field
        id={fieldId("slug")}
        label="Web address"
        required
        error={errors.slug}
        hint="A short unique name used internally. It is filled in from the name until you change it."
      >
        {(c) => (
          <Input
            ref={slugRef}
            name="slug"
            defaultValue={values.slug}
            onChange={onSlugChange}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...c}
          />
        )}
      </Field>
      <Field
        id={fieldId("websiteUrl")}
        label="Website"
        error={errors.websiteUrl}
        hint="Optional. A full address, for example https://example.com. Shown as a link on their projects."
      >
        {(c) => <Input name="websiteUrl" type="url" inputMode="url" defaultValue={values.websiteUrl} {...c} />}
      </Field>
      <Field
        id={fieldId("bio")}
        label="Biography"
        error={errors.bio}
        hint={`Optional. Up to ${ARCHITECT_LIMITS.bio} characters, plain text.`}
      >
        {(c) => <Textarea name="bio" rows={6} defaultValue={values.bio} {...c} />}
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" loading={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Add architect"}
        </Button>
        <Link href="/admin/architects" className={buttonStyles({ variant: "secondary", size: "lg" })}>
          {editing ? "Back to architects" : "Cancel"}
        </Link>
      </div>
    </form>
  );
}

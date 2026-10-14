"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { MarkdownEditor } from "@/components/admin/markdown-editor";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Select, Textarea } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { FormErrorSummary, type ErrorSummaryItem } from "@/components/ui/form-error-summary";
import { formatPhase, formatProjectType } from "@/lib/format";
import { formFromSubmittedValues, type ProjectFormInitial } from "@/lib/project-form";
import { PROJECT_LIMITS, type ProjectField } from "@/lib/project-schema";
import { slugify } from "@/lib/slug";
import { PROJECT_PHASES, PROJECT_TYPES } from "@/lib/types";
import type { SaveProjectState } from "@/server/admin/handle-save-project";

export type SaveProjectAction = (previous: SaveProjectState, formData: FormData) => Promise<SaveProjectState>;

const IDLE: SaveProjectState = { status: "idle" };

/** The order errors are listed in the summary: the order of the fields on the page. */
const FIELD_ORDER: ProjectField[] = [
  "title",
  "slug",
  "summary",
  "type",
  "phase",
  "year",
  "city",
  "region",
  "countryCode",
  "lat",
  "lng",
  "descriptionMd",
  "architects",
  "seoTitle",
  "seoDescription",
];

const fieldId = (name: ProjectField) => `field-${name}`;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="border-b border-border pb-2 font-display text-2xl">{title}</h2>
      {children}
    </section>
  );
}

interface ProjectFormProps {
  action: SaveProjectAction;
  initial: ProjectFormInitial;
  architects: Array<{ id: string; name: string }>;
  countries: Array<{ code: string; name: string }>;
  /** Set when editing a saved project; leave out to create a new draft. */
  projectId?: string;
}

export function ProjectForm({ action, initial, architects, countries, projectId }: ProjectFormProps) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const editing = projectId !== undefined;

  // After a failed save the form shows what was typed (sent back by the server), not the starting values.
  const values = state.status === "error" ? formFromSubmittedValues(state.values) : initial;
  const errors = state.status === "error" ? state.errors : {};

  const [selected, setSelected] = useState(() => new Set(values.credits.map((credit) => credit.architectId)));
  const roleOf = (id: string) => values.credits.find((credit) => credit.architectId === id)?.role ?? "";

  // The address follows the title until the admin edits it by hand. An existing project's address
  // never follows its title: changing it breaks shared links (a redirect is added, but still).
  const slugRef = useRef<HTMLInputElement>(null);
  const followTitle = useRef(!editing);
  const onTitleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (followTitle.current && slugRef.current) slugRef.current.value = slugify(event.target.value);
  };
  const onSlugChange = (event: ChangeEvent<HTMLInputElement>) => {
    followTitle.current = !editing && event.target.value === "";
  };

  // Tell keyboard and screen reader users the outcome. Field errors have their own summary.
  const messageRef = useRef<HTMLDivElement>(null);
  const hasFieldErrors = Object.keys(errors).length > 0;
  useEffect(() => {
    if (state.status === "saved" || (state.status === "error" && !hasFieldErrors)) messageRef.current?.focus();
  }, [state, hasFieldErrors]);

  const summaryItems: ErrorSummaryItem[] = FIELD_ORDER.flatMap((name) =>
    errors[name] ? [{ fieldId: fieldId(name), message: errors[name] }] : [],
  );

  return (
    <form action={formAction} className="flex flex-col gap-10" noValidate>
      {projectId && <input type="hidden" name="id" value={projectId} />}

      {state.status === "saved" && (
        <div ref={messageRef} tabIndex={-1} role="status" className="rounded-lg border-2 border-accent p-4 font-medium">
          {state.message}
        </div>
      )}
      {state.status === "error" && !hasFieldErrors && (
        <div ref={messageRef} tabIndex={-1} role="alert" className="rounded-lg border-2 border-danger p-4">
          <p className="font-medium text-danger">{state.message}</p>
          {state.problems && (
            <ul className="mt-2 list-disc pl-5">
              {state.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <FormErrorSummary errors={summaryItems} attempt={state} />

      <Section title="Basics">
        <Field id={fieldId("title")} label="Title" required error={errors.title}>
          {(c) => <Input name="title" defaultValue={values.title} onChange={onTitleChange} {...c} />}
        </Field>
        <Field
          id={fieldId("slug")}
          label="Web address"
          required
          error={errors.slug}
          hint={
            editing
              ? "The last part of the page address. If you change it, the old address keeps working and redirects to the new one."
              : "The last part of the page address. It is filled in from the title until you change it."
          }
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
          id={fieldId("summary")}
          label="Summary"
          error={errors.summary}
          hint={`One or two sentences shown on project cards and in search results. Up to ${PROJECT_LIMITS.summary} characters. Needed before the project can be published.`}
        >
          {(c) => <Textarea name="summary" rows={3} defaultValue={values.summary} {...c} />}
        </Field>
      </Section>

      <Section title="Details">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id={fieldId("type")} label="Type" required error={errors.type}>
            {(c) => (
              <Select name="type" defaultValue={values.type} {...c}>
                <option value="">Choose a type</option>
                {PROJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatProjectType(type)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id={fieldId("phase")} label="Stage" required error={errors.phase}>
            {(c) => (
              <Select name="phase" defaultValue={values.phase} {...c}>
                <option value="">Choose a stage</option>
                {PROJECT_PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {formatPhase(phase)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id={fieldId("year")} label="Year" required error={errors.year}>
            {(c) => <Input name="year" inputMode="numeric" defaultValue={values.year} {...c} />}
          </Field>
        </div>
      </Section>

      <Section title="Location">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={fieldId("city")} label="City" required error={errors.city}>
            {(c) => <Input name="city" defaultValue={values.city} {...c} />}
          </Field>
          <Field id={fieldId("region")} label="Region or state" error={errors.region}>
            {(c) => <Input name="region" defaultValue={values.region} {...c} />}
          </Field>
          <Field id={fieldId("countryCode")} label="Country" required error={errors.countryCode} className="sm:col-span-2">
            {(c) => (
              <Select name="countryCode" defaultValue={values.countryCode} {...c}>
                <option value="">Choose a country</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field id={fieldId("lat")} label="Latitude" error={errors.lat} hint="Optional. For example 55.6761.">
            {(c) => <Input name="lat" inputMode="decimal" defaultValue={values.lat} {...c} />}
          </Field>
          <Field id={fieldId("lng")} label="Longitude" error={errors.lng} hint="Optional. For example 12.5683.">
            {(c) => <Input name="lng" inputMode="decimal" defaultValue={values.lng} {...c} />}
          </Field>
        </div>
      </Section>

      <Section title="Description">
        <Field
          id={fieldId("descriptionMd")}
          label="Description"
          error={errors.descriptionMd}
          hint="Written in Markdown: ## for a heading, **bold**, *italic*, - for a list, [text](https://example.com) for a link. HTML and images are not allowed here."
        >
          {(c) => <MarkdownEditor name="descriptionMd" defaultValue={values.descriptionMd} {...c} />}
        </Field>
      </Section>

      <Section title="Architects">
        <fieldset
          id={fieldId("architects")}
          tabIndex={-1}
          aria-describedby={errors.architects ? `${fieldId("architects")}-error` : undefined}
          className="flex flex-col gap-2"
        >
          <legend className="mb-2 text-muted">Tick everyone who worked on this project. They are credited in this order.</legend>
          {architects.length === 0 && <p className="text-muted">No architects have been added yet.</p>}
          {architects.map((architect) => {
            const checked = selected.has(architect.id);
            return (
              <div key={architect.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                <div className="sm:w-64">
                  <Checkbox
                    name="architectId"
                    value={architect.id}
                    label={architect.name}
                    checked={checked}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(architect.id);
                        else next.delete(architect.id);
                        return next;
                      })
                    }
                  />
                </div>
                {checked && (
                  <Input
                    name={`role-${architect.id}`}
                    aria-label={`Role of ${architect.name}`}
                    placeholder="Role (optional), for example Lead architect"
                    defaultValue={roleOf(architect.id)}
                    className="sm:max-w-md"
                  />
                )}
              </div>
            );
          })}
          {errors.architects && (
            <p id={`${fieldId("architects")}-error`} className="text-sm font-medium text-danger">
              {errors.architects}
            </p>
          )}
        </fieldset>
      </Section>

      <Section title="Search results">
        <Field
          id={fieldId("seoTitle")}
          label="Search title"
          error={errors.seoTitle}
          hint={`Optional. Replaces the title in search results. Up to ${PROJECT_LIMITS.seoTitle} characters.`}
        >
          {(c) => <Input name="seoTitle" defaultValue={values.seoTitle} {...c} />}
        </Field>
        <Field
          id={fieldId("seoDescription")}
          label="Search description"
          error={errors.seoDescription}
          hint={`Optional. Replaces the summary in search results. Up to ${PROJECT_LIMITS.seoDescription} characters.`}
        >
          {(c) => <Textarea name="seoDescription" rows={3} defaultValue={values.seoDescription} {...c} />}
        </Field>
      </Section>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" loading={pending}>
          {pending ? "Saving…" : editing ? "Save changes" : "Create project"}
        </Button>
        <Link href="/admin/projects" className={buttonStyles({ variant: "secondary", size: "lg" })}>
          {editing ? "Back to projects" : "Cancel"}
        </Link>
      </div>
    </form>
  );
}

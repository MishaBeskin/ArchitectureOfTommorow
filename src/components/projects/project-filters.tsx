import Form from "next/form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Select } from "@/components/ui/controls";
import { Field } from "@/components/ui/field";
import { hasActiveFilters, serializeProjectFilters } from "@/lib/filters";
import { formatProjectType } from "@/lib/format";
import type { FilterOptions, ProjectFilters as Filters } from "@/lib/types";

/**
 * A plain GET form that next/form upgrades to client-side navigation. It stays a real form with
 * a submit button, and there is deliberately no auto-submit on change: a select that reloads
 * results on every arrow-key press fails WCAG 3.2.2 for keyboard users.
 */
export function ProjectFilters({ options, filters }: { options: FilterOptions; filters: Filters }) {
  return (
    <Form
      action="/projects"
      // Remount when the filters change so the selects always show the URL's state.
      key={serializeProjectFilters(filters)}
      aria-label="Filter projects"
      className="grid gap-4 rounded-2xl bg-surface p-5 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end"
    >
      <Field label="Type">
        {(control) => (
          <Select name="type" defaultValue={filters.type ?? ""} {...control}>
            <option value="">All types</option>
            {options.types.map((type) => (
              <option key={type} value={type}>
                {formatProjectType(type)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Location">
        {(control) => (
          <Select name="location" defaultValue={filters.location ?? ""} {...control}>
            <option value="">All locations</option>
            {options.locations.map(({ code, label, count }) => (
              <option key={code} value={code}>
                {label} ({count})
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Year">
        {(control) => (
          <Select name="year" defaultValue={filters.year ? String(filters.year) : ""} {...control}>
            <option value="">All years</option>
            {options.years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-1">
        <Button type="submit">Apply filters</Button>
        {hasActiveFilters(filters) && (
          <Link href="/projects" className={buttonStyles({ variant: "ghost" })}>
            Clear filters
          </Link>
        )}
      </div>
    </Form>
  );
}

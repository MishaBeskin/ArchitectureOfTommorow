"use client";

import { useEffect, useRef } from "react";

export interface ErrorSummaryItem {
  /** id of the control the message belongs to, without the leading #. */
  fieldId: string;
  message: string;
}

/**
 * Lists every error with a link to its field and moves focus to itself each time the user
 * submits (`attempt` changes), so screen reader users hear what went wrong.
 */
export function FormErrorSummary({ errors, attempt }: { errors: ErrorSummaryItem[]; attempt: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const hasErrors = errors.length > 0;

  useEffect(() => {
    if (hasErrors) ref.current?.focus();
  }, [attempt, hasErrors]);

  if (!hasErrors) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby="error-summary-title"
      className="rounded-lg border-2 border-danger p-4"
    >
      <h2 id="error-summary-title" className="font-semibold text-danger">
        There {errors.length === 1 ? "is 1 problem" : `are ${errors.length} problems`} with your submission
      </h2>
      <ul className="mt-2 list-disc pl-5">
        {errors.map(({ fieldId, message }) => (
          <li key={fieldId}>
            <a href={`#${fieldId}`} className="underline underline-offset-4">
              {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

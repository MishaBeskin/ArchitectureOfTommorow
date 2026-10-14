import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Props a form control must receive so its label, hint and error are programmatically linked. */
export interface FieldControlProps {
  id: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

interface FieldProps {
  /** Set a stable id when something else (e.g. an error summary link) must point at the control. */
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Label + control + hint + error. The render prop receives the id/aria wiring:
 *   <Field label="Title">{(c) => <Input name="title" {...c} />}</Field>
 */
export function Field({ id: idProp, label, hint, error, required, className, children }: FieldProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-medium">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-danger">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children({
        id,
        required,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type CheckboxProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  label: ReactNode;
};

/** The label is part of the hit area, so the whole row is at least 44px tall. */
export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        className={cn("size-5 shrink-0 cursor-pointer accent-accent", className)}
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}

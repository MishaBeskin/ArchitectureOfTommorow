import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const control =
  "min-h-11 w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-base text-foreground placeholder:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:border-2 disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(control, className)} {...props} />;
}

export function Textarea({ className, rows = 5, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(control, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, className)} {...props} />;
}

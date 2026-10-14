import type { ComponentProps } from "react";

/** Hides content visually while keeping it available to assistive technology. */
export function VisuallyHidden(props: ComponentProps<"span">) {
  return <span className="sr-only" {...props} />;
}

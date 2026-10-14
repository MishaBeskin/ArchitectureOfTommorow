import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "inverse";
export type ButtonSize = "md" | "lg";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary: "border border-foreground text-foreground hover:bg-foreground hover:text-background",
  ghost: "text-foreground hover:bg-surface",
  // Outlined white, for use on a navy panel.
  inverse: "border border-panel-foreground text-panel-foreground hover:bg-white/10",
  // For destructive confirmations. Red on white (and the dark-mode pair) keeps AA contrast.
  danger: "bg-danger text-accent-foreground hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  md: "px-5 text-base",
  lg: "px-7 text-lg",
};

/** Shared by <Button> and link-styled-as-button so both look and size identically. */
export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

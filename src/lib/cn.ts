type ClassValue = string | false | null | undefined;

/** Joins truthy class names. Order matters: later Tailwind utilities do not override earlier ones. */
export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}

import type { Location, ProjectType } from "./types";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "mixed-use" -> "Mixed-use". */
export function formatProjectType(type: ProjectType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** ISO 3166-1 alpha-2 -> English country name, falling back to the code itself. */
export function countryName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "Vancouver, British Columbia, Canada" or "Copenhagen, Denmark". */
export function formatLocation(location: Pick<Location, "city" | "region" | "countryCode">): string {
  return [location.city, location.region, countryName(location.countryCode)].filter(Boolean).join(", ");
}

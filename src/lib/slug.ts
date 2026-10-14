export const SLUG_MAX_LENGTH = 80;

/** Lower-case letters and digits in groups joined by single hyphens: no leading, trailing or doubled hyphen. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);
}

/**
 * Turns a title into a URL address: "Terrace Houses, Alfama" -> "terrace-houses-alfama".
 * Accents are removed ("Café" -> "cafe") rather than dropped with their letter. Characters with no
 * plain equivalent (such as CJK) are dropped, so a title with no usable letters gives "".
 * \p{M} matches combining marks, which NFKD splits off from their base letters.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

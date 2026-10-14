export interface PublishCheckInput {
  summary: string;
  coverImageId: string | null;
  images: ReadonlyArray<{ id: string; alt: string }>;
}

/**
 * Why a project cannot go public yet, as sentences the admin can act on. An empty list means it
 * is ready. These are the rules from the plan: a summary, at least one image, a cover chosen from
 * those images, and alt text on every image (WCAG: an image without a description is a barrier).
 */
export function publishProblems({ summary, coverImageId, images }: PublishCheckInput): string[] {
  const problems: string[] = [];

  if (summary.trim() === "") problems.push("Add a summary.");

  if (images.length === 0) {
    problems.push("Add at least one image.");
  } else {
    if (!coverImageId || !images.some((image) => image.id === coverImageId)) {
      problems.push("Choose a cover image.");
    }
    const missingAlt = images.filter((image) => image.alt.trim() === "").length;
    if (missingAlt > 0) {
      problems.push(
        missingAlt === 1 ? "One image is missing its alt text." : `${missingAlt} images are missing their alt text.`,
      );
    }
  }

  return problems;
}

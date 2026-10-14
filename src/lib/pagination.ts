export type PageItem = number | "ellipsis";

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * Page numbers to show: always the first, last and current page with `siblings` on each side,
 * and "ellipsis" for the gaps. The list keeps a constant length (2*siblings + 5) so the control
 * does not jump around as you page through.
 */
export function getPageWindow(page: number, pageCount: number, siblings = 1): PageItem[] {
  const slots = siblings * 2 + 5;
  if (pageCount <= slots) return range(1, pageCount);

  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, pageCount);
  const gapLeft = left > 2;
  const gapRight = right < pageCount - 1;
  const edge = 3 + 2 * siblings;

  if (!gapLeft && gapRight) return [...range(1, edge), "ellipsis", pageCount];
  if (gapLeft && !gapRight) return [1, "ellipsis", ...range(pageCount - edge + 1, pageCount)];
  return [1, "ellipsis", ...range(left, right), "ellipsis", pageCount];
}

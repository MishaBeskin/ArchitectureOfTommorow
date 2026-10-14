import { describe, expect, it } from "vitest";
import { getPageWindow } from "./pagination";

describe("getPageWindow", () => {
  it("shows every page when there are few", () => {
    expect(getPageWindow(1, 1)).toEqual([1]);
    expect(getPageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(getPageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses the right side near the start", () => {
    expect(getPageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, "ellipsis", 20]);
    expect(getPageWindow(3, 20)).toEqual([1, 2, 3, 4, 5, "ellipsis", 20]);
  });

  it("collapses both sides in the middle", () => {
    expect(getPageWindow(10, 20)).toEqual([1, "ellipsis", 9, 10, 11, "ellipsis", 20]);
  });

  it("collapses the left side near the end", () => {
    expect(getPageWindow(20, 20)).toEqual([1, "ellipsis", 16, 17, 18, 19, 20]);
    expect(getPageWindow(18, 20)).toEqual([1, "ellipsis", 16, 17, 18, 19, 20]);
  });

  it("keeps a constant length so the control does not jump while paging", () => {
    for (let page = 1; page <= 20; page++) {
      expect(getPageWindow(page, 20)).toHaveLength(7);
    }
  });

  it("always includes the current, first and last page and never repeats a number", () => {
    for (let count = 1; count <= 30; count++) {
      for (let page = 1; page <= count; page++) {
        const numbers = getPageWindow(page, count).filter((i): i is number => i !== "ellipsis");
        expect(numbers).toContain(page);
        expect(numbers).toContain(1);
        expect(numbers).toContain(count);
        expect(new Set(numbers).size).toBe(numbers.length);
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
      }
    }
  });

  it("widens with more siblings", () => {
    expect(getPageWindow(10, 20, 2)).toEqual([1, "ellipsis", 8, 9, 10, 11, 12, "ellipsis", 20]);
  });
});

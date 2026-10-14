import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Pagination } from "./pagination";

describe("Pagination", () => {
  it("renders nothing when everything fits on one page", () => {
    const { container } = render(<Pagination filters={{ page: 1 }} page={1} pageCount={1} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("is a labelled navigation with a link for every page", () => {
    render(<Pagination filters={{ page: 2 }} page={2} pageCount={3} />);

    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav).toBeInTheDocument();
    for (const n of [1, 2, 3]) {
      expect(screen.getByRole("link", { name: `Page ${n}` })).toBeInTheDocument();
    }
  });

  it("marks the current page and no other", () => {
    render(<Pagination filters={{ page: 2 }} page={2} pageCount={3} />);

    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Page 1" })).not.toHaveAttribute("aria-current");
  });

  it("links keep the active filters and omit page 1 from the URL", () => {
    render(<Pagination filters={{ page: 2, type: "civic", year: 2025 }} page={2} pageCount={3} />);

    expect(screen.getByRole("link", { name: "Page 1" })).toHaveAttribute("href", "/projects?type=civic&year=2025");
    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "href",
      "/projects?type=civic&year=2025&page=3",
    );
  });

  it("offers Previous and Next with rel hints, and hides them at the ends", () => {
    const { rerender } = render(<Pagination filters={{ page: 2 }} page={2} pageCount={3} />);
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("rel", "prev");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("rel", "next");

    rerender(<Pagination filters={{ page: 1 }} page={1} pageCount={3} />);
    expect(screen.queryByRole("link", { name: "Previous" })).not.toBeInTheDocument();

    rerender(<Pagination filters={{ page: 3 }} page={3} pageCount={3} />);
    expect(screen.queryByRole("link", { name: "Next" })).not.toBeInTheDocument();
  });

  it("collapses long ranges and hides the ellipsis from assistive technology", () => {
    render(<Pagination filters={{ page: 10 }} page={10} pageCount={20} />);

    expect(screen.queryByRole("link", { name: "Page 5" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Page 20" })).toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(2);
    for (const gap of screen.getAllByText("…")) expect(gap).toHaveAttribute("aria-hidden", "true");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Pagination filters={{ page: 10 }} page={10} pageCount={20} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});

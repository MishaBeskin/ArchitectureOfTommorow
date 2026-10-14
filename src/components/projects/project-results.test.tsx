import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { cardFixture } from "@/test/fixtures";
import { ProjectResults } from "./project-results";
import { ProjectsSkeleton } from "./projects-skeleton";

const items = (count: number) =>
  Array.from({ length: count }, (_, i) => cardFixture({ slug: `p-${i}`, title: `Project ${i}` }));

describe("ProjectResults", () => {
  it("shows the count and every project as a list item", () => {
    render(<ProjectResults filters={{ page: 1 }} result={{ items: items(3), total: 3, page: 1, pageCount: 1 }} />);

    expect(screen.getByRole("status")).toHaveTextContent("3 projects");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("uses the singular for exactly one project", () => {
    render(<ProjectResults filters={{ page: 1 }} result={{ items: items(1), total: 1, page: 1, pageCount: 1 }} />);

    expect(screen.getByRole("status")).toHaveTextContent(/^1 project$/);
  });

  it("mentions the page when there are several", () => {
    render(<ProjectResults filters={{ page: 2 }} result={{ items: items(3), total: 30, page: 2, pageCount: 3 }} />);

    expect(screen.getByRole("status")).toHaveTextContent("30 projects · page 2 of 3");
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
  });

  it("has no pagination for a single page", () => {
    render(<ProjectResults filters={{ page: 1 }} result={{ items: items(3), total: 3, page: 1, pageCount: 1 }} />);

    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  });

  it("explains an empty filtered result and offers to clear the filters", () => {
    render(
      <ProjectResults
        filters={{ page: 1, type: "civic", year: 2021 }}
        result={{ items: [], total: 0, page: 1, pageCount: 1 }}
      />,
    );

    expect(screen.getByRole("heading", { name: "No projects match these filters" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("status")).toHaveTextContent("0 projects");
  });

  it("shows a different empty state, without a clear link, when nothing is published", () => {
    render(<ProjectResults filters={{ page: 1 }} result={{ items: [], total: 0, page: 1, pageCount: 1 }} />);

    expect(screen.getByRole("heading", { name: "No projects yet" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ProjectResults filters={{ page: 2 }} result={{ items: items(3), total: 30, page: 2, pageCount: 3 }} />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("ProjectsSkeleton", () => {
  it("announces loading to screen readers and hides the placeholder blocks", () => {
    render(<ProjectsSkeleton />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading projects");
    expect(document.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ProjectsSkeleton />);

    expect((await axe(container)).violations).toEqual([]);
  });
});

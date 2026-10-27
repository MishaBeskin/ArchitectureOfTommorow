import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { cardFixture } from "@/test/fixtures";
import { FeaturedProjects } from "./featured-projects";
import { Hero } from "./hero";

describe("Hero", () => {
  it("has one h1 and links to view projects and get in touch", () => {
    render(<Hero lead={cardFixture()} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "View projects" })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("link", { name: "Get in touch" })).toHaveAttribute("href", "/contact");
  });

  it("captions the lead project with a link, location and year", () => {
    render(<Hero lead={cardFixture()} />);

    const caption = screen.getByRole("figure");
    expect(within(caption).getByRole("link", { name: "Harbour Light Library" })).toHaveAttribute(
      "href",
      "/projects/harbour-light-library",
    );
    expect(caption).toHaveTextContent("Copenhagen, Denmark · 2025");
  });

  it("keeps the image link out of the tab order so the project is not announced twice", () => {
    render(<Hero lead={cardFixture()} />);

    const imageLink = document.querySelector('a[aria-hidden="true"]');
    expect(imageLink).toHaveAttribute("tabindex", "-1");
    expect(screen.getAllByRole("link", { name: "Harbour Light Library" })).toHaveLength(1);
  });

  it("renders without a figure when there is no lead project or it has no cover", () => {
    const { rerender } = render(<Hero lead={null} />);
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();

    rerender(<Hero lead={cardFixture({ cover: null })} />);
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Hero lead={cardFixture()} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("FeaturedProjects", () => {
  const projects = [
    cardFixture({ slug: "a", title: "Project A" }),
    cardFixture({ slug: "b", title: "Project B" }),
  ];

  it("lists each project as a list item under an h2", () => {
    render(<FeaturedProjects projects={projects} />);

    expect(screen.getByRole("heading", { level: 2, name: "Featured projects" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Project B" })).toHaveAttribute("href", "/projects/b");
  });

  it("links to the full list", () => {
    render(<FeaturedProjects projects={projects} />);

    expect(screen.getByRole("link", { name: "View all projects" })).toHaveAttribute("href", "/projects");
  });

  it("renders nothing when there are no projects", () => {
    const { container } = render(<FeaturedProjects projects={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<FeaturedProjects projects={projects} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});

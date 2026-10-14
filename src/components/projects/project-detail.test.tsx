import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { cardFixture, projectFixture } from "@/test/fixtures";
import { ProjectDescription } from "./project-description";
import { ProjectFacts } from "./project-facts";
import { RelatedProjects } from "./related-projects";

describe("Breadcrumbs", () => {
  const items = [{ label: "Home", href: "/" }, { label: "Projects", href: "/projects" }, { label: "Harbour" }];

  it("is a labelled navigation with links for the parents and the current page as text", () => {
    render(<Breadcrumbs items={items} />);

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/projects");
    expect(screen.queryByRole("link", { name: "Harbour" })).not.toBeInTheDocument();
    expect(screen.getByText("Harbour")).toHaveAttribute("aria-current", "page");
  });

  it("hides the separators from assistive technology", () => {
    render(<Breadcrumbs items={items} />);

    for (const separator of screen.getAllByText("/")) expect(separator).toHaveAttribute("aria-hidden", "true");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Breadcrumbs items={items} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("ProjectFacts", () => {
  const term = (label: string) => screen.getByText(label, { selector: "dt" }).parentElement!;

  it("lists architect, location, year, type and status", () => {
    render(<ProjectFacts project={projectFixture()} />);

    expect(within(term("Architect")).getByText("Studio Nordlys")).toBeInTheDocument();
    expect(within(term("Architect")).getByText(/Lead architect/)).toBeInTheDocument();
    expect(within(term("Location")).getByText("Copenhagen, Denmark")).toBeInTheDocument();
    expect(within(term("Year")).getByText("2025")).toBeInTheDocument();
    expect(within(term("Type")).getByText("Cultural")).toBeInTheDocument();
    expect(within(term("Status")).getByText("Completed")).toBeInTheDocument();
  });

  it("pluralises the label for several architects", () => {
    const base = projectFixture();
    render(
      <ProjectFacts
        project={{
          ...base,
          architects: [
            ...base.architects,
            { id: "a2", slug: "b", name: "Atelier Vento", websiteUrl: null, bio: null, role: null },
          ],
        }}
      />,
    );

    expect(screen.getByText("Architects", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByText("Atelier Vento")).toBeInTheDocument();
  });

  it("links an architect's website safely and says it opens in a new tab", () => {
    const base = projectFixture();
    render(
      <ProjectFacts
        project={{
          ...base,
          architects: [{ ...base.architects[0]!, websiteUrl: "https://studio.example" }],
        }}
      />,
    );

    const link = screen.getByRole("link", { name: /Studio Nordlys/ });
    expect(link).toHaveAttribute("href", "https://studio.example");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAccessibleName(/opens in a new tab/);
  });

  it("omits the architect row when nobody is credited", () => {
    render(<ProjectFacts project={projectFixture({ architects: [] })} />);

    expect(screen.queryByText(/^Architects?$/, { selector: "dt" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ProjectFacts project={projectFixture()} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("ProjectDescription", () => {
  it("renders paragraphs, emphasis and lists", () => {
    const { container } = render(
      <ProjectDescription markdown={"One **bold** and *soft*.\n\n- first\n- second\n\n1. a\n2. b"} />,
    );

    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("never renders raw HTML: scripts, iframes and event handlers are dropped", () => {
    const { container } = render(
      <ProjectDescription
        markdown={'Safe text\n\n<script>window.pwned = 1</script>\n\n<iframe src="https://evil.test"></iframe>\n\n<img src=x onerror="window.pwned=1">'}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
    expect(screen.getByText("Safe text")).toBeInTheDocument();
  });

  it("strips javascript: URLs from links", () => {
    render(<ProjectDescription markdown={"[click](javascript:alert(1)) and [ok](https://example.com)"} />);

    const bad = screen.getByText("click").closest("a");
    expect(bad?.getAttribute("href") ?? "").not.toMatch(/javascript:/i);
    expect(screen.getByRole("link", { name: "ok" })).toHaveAttribute("href", "https://example.com");
  });

  it("opens external links in a new tab with noopener and keeps internal ones in place", () => {
    render(<ProjectDescription markdown={"[out](https://example.com) and [in](/projects)"} />);

    const external = screen.getByRole("link", { name: "out" });
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "in" })).not.toHaveAttribute("target");
  });

  it("does not allow markdown images, which would bypass the image pipeline", () => {
    const { container } = render(<ProjectDescription markdown={"![x](https://evil.test/a.png) text"} />);

    expect(container.querySelector("img")).toBeNull();
  });

  it("demotes headings so the page keeps a single h1 and the h2 sections", () => {
    const { container } = render(<ProjectDescription markdown={"# Big\n\n## Medium\n\n### Small"} />);

    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("h2")).toBeNull();
    expect(container.querySelectorAll("h3")).toHaveLength(2);
    expect(container.querySelectorAll("h4")).toHaveLength(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ProjectDescription markdown={"# Title\n\nText with [a link](/x)."} />);

    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("RelatedProjects", () => {
  it("renders nothing without related projects", () => {
    const { container } = render(<RelatedProjects projects={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("lists related projects under an h2", () => {
    render(<RelatedProjects projects={[cardFixture({ slug: "a", title: "A" }), cardFixture({ slug: "b", title: "B" })]} />);

    expect(screen.getByRole("heading", { level: 2, name: "More projects" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "B" })).toHaveAttribute("href", "/projects/b");
  });
});

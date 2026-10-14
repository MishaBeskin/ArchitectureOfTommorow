import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { cardFixture } from "@/test/fixtures";
import { ProjectCard } from "./project-card";

const SIZES = "33vw";

describe("ProjectCard", () => {
  it("links the title to the project page", () => {
    render(<ProjectCard project={cardFixture()} sizes={SIZES} />);

    expect(screen.getByRole("link", { name: "Harbour Light Library" })).toHaveAttribute(
      "href",
      "/projects/harbour-light-library",
    );
  });

  it("uses an h3 title by default and an h2 when asked, so headings never skip a level", () => {
    const { unmount } = render(<ProjectCard project={cardFixture()} sizes={SIZES} />);
    expect(screen.getByRole("heading", { level: 3, name: "Harbour Light Library" })).toBeInTheDocument();
    unmount();

    render(<ProjectCard project={cardFixture()} sizes={SIZES} headingLevel="h2" />);
    expect(screen.getByRole("heading", { level: 2, name: "Harbour Light Library" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });

  it("has exactly one link, so each card is a single tab stop", () => {
    render(<ProjectCard project={cardFixture()} sizes={SIZES} />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("shows type, year, location and architects", () => {
    render(<ProjectCard project={cardFixture({ architectNames: ["Atelier Vento", "Casa Aurora"] })} sizes={SIZES} />);

    expect(screen.getByText("Cultural · 2025")).toBeInTheDocument();
    expect(screen.getByText("Copenhagen, Denmark")).toBeInTheDocument();
    expect(screen.getByText("Atelier Vento, Casa Aurora")).toBeInTheDocument();
  });

  it("describes the cover image with its alt text", () => {
    render(<ProjectCard project={cardFixture()} sizes={SIZES} />);

    expect(screen.getByRole("img", { name: "Facade at dusk" })).toBeInTheDocument();
  });

  it("omits the architect line when there are none", () => {
    render(<ProjectCard project={cardFixture({ architectNames: [] })} sizes={SIZES} />);

    expect(screen.queryByText(/Nordlys/)).not.toBeInTheDocument();
  });

  it("renders a labelled placeholder when there is no cover", () => {
    render(<ProjectCard project={cardFixture({ cover: null })} sizes={SIZES} />);

    expect(screen.getByRole("img", { name: "No image available" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ul>
        <li>
          <ProjectCard project={cardFixture()} sizes={SIZES} />
        </li>
      </ul>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});

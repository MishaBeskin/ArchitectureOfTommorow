import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import type { FilterOptions } from "@/lib/types";
import { ProjectFilters } from "./project-filters";

const options: FilterOptions = {
  types: ["residential", "mixed-use", "civic"],
  locations: [
    { code: "DK", label: "Denmark", count: 2 },
    { code: "JP", label: "Japan", count: 1 },
  ],
  years: [2026, 2025, 2024],
};

const optionNames = (select: HTMLElement) =>
  within(select)
    .getAllByRole("option")
    .map((o) => o.textContent);

describe("ProjectFilters", () => {
  it("has a labelled select for type and location, and none for year", () => {
    render(<ProjectFilters options={options} filters={{ page: 1 }} />);

    for (const name of ["Type", "Location"]) {
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("combobox", { name: "Year" })).not.toBeInTheDocument();
  });

  it("offers an 'All' choice first and then only the available options", () => {
    render(<ProjectFilters options={options} filters={{ page: 1 }} />);

    expect(optionNames(screen.getByRole("combobox", { name: "Type" }))).toEqual([
      "All types",
      "Residential",
      "Mixed-use",
      "Civic",
    ]);
    expect(optionNames(screen.getByRole("combobox", { name: "Location" }))).toEqual([
      "All locations",
      "Denmark (2)",
      "Japan (1)",
    ]);
  });

  it("hides the location filter while there is only one country to choose from", () => {
    render(
      <ProjectFilters
        options={{ ...options, locations: [{ code: "IL", label: "Israel", count: 7 }] }}
        filters={{ page: 1 }}
      />,
    );

    expect(screen.queryByRole("combobox", { name: "Location" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Type" })).toBeInTheDocument();
  });

  it("preselects the current filters from the URL", () => {
    render(<ProjectFilters options={options} filters={{ page: 1, type: "civic", location: "JP", year: 2025 }} />);

    expect(screen.getByRole("combobox", { name: "Type" })).toHaveValue("civic");
    expect(screen.getByRole("combobox", { name: "Location" })).toHaveValue("JP");
  });

  it("submits with a button instead of reloading on every change", () => {
    render(<ProjectFilters options={options} filters={{ page: 1 }} />);

    expect(screen.getByRole("button", { name: "Apply filters" })).toHaveAttribute("type", "submit");
  });

  it("is a real GET form targeting the projects list, so the URL carries the filters", () => {
    render(<ProjectFilters options={options} filters={{ page: 1 }} />);

    const form = screen.getByRole("form", { name: "Filter projects" });
    expect(form).toHaveAttribute("action", "/projects");
    expect((form.getAttribute("method") ?? "get").toLowerCase()).toBe("get");
  });

  it("shows 'Clear filters' only while a filter is active, ignoring the page", () => {
    const { rerender } = render(<ProjectFilters options={options} filters={{ page: 3 }} />);
    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();

    rerender(<ProjectFilters options={options} filters={{ page: 1, year: 2025 }} />);
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/projects");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <ProjectFilters options={options} filters={{ page: 1, type: "civic" }} />,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});

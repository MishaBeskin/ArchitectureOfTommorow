import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { ProjectActionState } from "@/server/admin/handle-project-action";
import type { AdminProjectRow } from "@/server/queries/admin-projects";
import { ProjectsTable, type ProjectsTableAction } from "./projects-table";

// jsdom does not implement the modal <dialog> API.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const row = (overrides: Partial<AdminProjectRow> = {}): AdminProjectRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  slug: "harbour-light-library",
  title: "Harbour Light Library",
  status: "published",
  type: "cultural",
  year: 2025,
  city: "Copenhagen",
  countryCode: "DK",
  featured: false,
  featuredOrder: null,
  imageCount: 4,
  updatedAt: new Date("2025-03-04T10:00:00Z"),
  publishedAt: new Date("2025-03-01T10:00:00Z"),
  ...overrides,
});

const ROWS = [
  row(),
  row({
    id: "22222222-2222-4222-8222-222222222222",
    slug: "draft-pavilion",
    title: "Draft Pavilion",
    status: "draft",
    imageCount: 1,
    featured: true,
    featuredOrder: 1,
  }),
];

function setup(rows = ROWS, result: ProjectActionState = { status: "success", message: "Done." }) {
  const action = vi.fn<ProjectsTableAction>(async () => result);
  const view = render(<ProjectsTable rows={rows} action={action} />);
  return { action, ...view };
}

describe("the table", () => {
  it("has a caption, column headers and one row per project with its facts", () => {
    setup();

    expect(screen.getByRole("table", { name: /All projects/ })).toBeInTheDocument();
    for (const name of ["Project", "Status", "Type and year", "Location", "Images", "Featured", "Updated", "Actions"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
    const harbour = screen.getByRole("row", { name: /Harbour Light Library/ });
    expect(within(harbour).getByText("harbour-light-library")).toBeInTheDocument();
    expect(within(harbour).getByText("Cultural · 2025")).toBeInTheDocument();
    expect(within(harbour).getByText("Copenhagen, Denmark")).toBeInTheDocument();
    expect(within(harbour).getByText("4 images")).toBeInTheDocument();
    expect(within(harbour).getByText("Mar 4, 2025")).toBeInTheDocument();
  });

  it("states the status in words, not only colour, and summarises the counts", () => {
    setup();

    expect(within(screen.getByRole("row", { name: /Harbour/ })).getByText("Published")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Draft Pavilion/ })).getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText(/2 projects · 1 published · 1 draft$/)).toBeInTheDocument();
  });

  it("uses the singular for one image", () => {
    setup();

    expect(within(screen.getByRole("row", { name: /Draft Pavilion/ })).getByText("1 image")).toBeInTheDocument();
  });

  it("links only published projects to the public site", () => {
    setup();

    expect(screen.getByRole("link", { name: "View Harbour Light Library on the site" })).toHaveAttribute(
      "href",
      "/projects/harbour-light-library",
    );
    expect(screen.queryByRole("link", { name: /View Draft Pavilion/ })).not.toBeInTheDocument();
  });

  it("shows the featured state with aria-pressed", () => {
    setup();

    expect(screen.getByRole("button", { name: "Featured: Harbour Light Library" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Featured: Draft Pavilion" })).toHaveAttribute("aria-pressed", "true");
  });

  it("explains an empty list", () => {
    setup([]);

    expect(screen.getByText("No projects yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/0 projects · 0 published · 0 drafts/)).toBeInTheDocument();
  });

  it("lets a narrow screen scroll the table inside its own labelled, focusable box", () => {
    setup();

    const region = screen.getByRole("region", { name: "Projects" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toContainElement(screen.getByRole("table"));
  });
});

describe("actions", () => {
  async function submittedWith(buttonName: string | RegExp) {
    const { action } = setup();
    await userEvent.click(screen.getByRole("button", { name: buttonName }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    return action.mock.calls[0]![1];
  }

  it("publishes a draft", async () => {
    const data = await submittedWith("Publish Draft Pavilion");

    expect(data.get("intent")).toBe("publish");
    expect(data.get("id")).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("unpublishes a published project", async () => {
    const data = await submittedWith("Unpublish Harbour Light Library");

    expect(data.get("intent")).toBe("unpublish");
    expect(data.get("id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("features a project that is not featured", async () => {
    const data = await submittedWith("Featured: Harbour Light Library");

    expect(data.get("intent")).toBe("feature");
  });

  it("un-features a project that is featured", async () => {
    const data = await submittedWith("Featured: Draft Pavilion");

    expect(data.get("intent")).toBe("unfeature");
  });

  it("names the project in every button, so a screen reader list of buttons is unambiguous", () => {
    setup();

    for (const title of ["Harbour Light Library", "Draft Pavilion"]) {
      expect(screen.getByRole("button", { name: `Featured: ${title}` })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: `Delete ${title}` })).toBeInTheDocument();
    }
  });
});

describe("deleting", () => {
  it("asks for confirmation first, naming the project and its images, and sends nothing yet", async () => {
    const { action } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Delete Harbour Light Library" }));

    const dialog = screen.getByRole("dialog", { name: "Delete this project?" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText(/"Harbour Light Library" and its 4 images will be permanently removed/)).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("offers Cancel first, so the safe choice is what the browser focuses", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete Harbour Light Library" }));

    const buttons = within(screen.getByRole("dialog")).getAllByRole("button");

    expect(buttons.map((b) => b.textContent)).toEqual(["Cancel", "Delete project"]);
  });

  it("cancels without sending anything", async () => {
    const { action } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete Harbour Light Library" }));

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("deletes only after confirming, with the right id and intent, and closes the dialog", async () => {
    const { action } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Delete Draft Pavilion" }));

    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0]![1];
    expect(data.get("intent")).toBe("delete");
    expect(data.get("id")).toBe("22222222-2222-4222-8222-222222222222");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("feedback", () => {
  it("announces a success and moves focus to it", async () => {
    setup(ROWS, { status: "success", message: '"Draft Pavilion" is now published.' });

    await userEvent.click(screen.getByRole("button", { name: "Publish Draft Pavilion" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent('"Draft Pavilion" is now published.');
    await waitFor(() => expect(status).toHaveFocus());
  });

  it("shows a blocked publish as an alert listing what is missing", async () => {
    setup(ROWS, {
      status: "error",
      message: '"Draft Pavilion" cannot be published yet.',
      problems: ["Add at least one image.", "Add a summary."],
    });

    await userEvent.click(screen.getByRole("button", { name: "Publish Draft Pavilion" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('"Draft Pavilion" cannot be published yet.');
    expect(within(alert).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Add at least one image.",
      "Add a summary.",
    ]);
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it("disables every action button while a change is in flight", async () => {
    let finish!: (state: ProjectActionState) => void;
    const action = vi.fn<ProjectsTableAction>(() => new Promise<ProjectActionState>((resolve) => (finish = resolve)));
    render(<ProjectsTable rows={ROWS} action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Publish Draft Pavilion" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Delete Harbour Light Library" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Featured: Harbour Light Library" })).toBeDisabled();
    finish({ status: "success", message: "Done." });
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete Harbour Light Library" })).toBeEnabled());
  });
});

describe("accessibility", () => {
  it("has no violations with rows, with a message, and with the confirmation open", async () => {
    const { container } = setup(ROWS, { status: "error", message: "Cannot publish.", problems: ["Add a summary."] });
    expect((await axe(container)).violations).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Publish Draft Pavilion" }));
    await screen.findByRole("alert");
    expect((await axe(container)).violations).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Delete Harbour Light Library" }));
    expect((await axe(container)).violations).toEqual([]);
  });

  it("has no violations when empty", async () => {
    const { container } = setup([]);

    expect((await axe(container)).violations).toEqual([]);
  });
});

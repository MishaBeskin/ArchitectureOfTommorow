import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { emptyProjectForm } from "@/lib/project-form";
import type { SaveProjectState } from "@/server/admin/handle-save-project";
import { ProjectForm, type SaveProjectAction } from "./project-form";

const ARCHITECTS = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Ada Okafor" },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Ben Lindqvist" },
];
const COUNTRIES = [
  { code: "DK", name: "Denmark" },
  { code: "NO", name: "Norway" },
];

function setup(
  options: { result?: SaveProjectState; projectId?: string; initial?: ReturnType<typeof emptyProjectForm> } = {},
) {
  const action = vi.fn<SaveProjectAction>(async () => options.result ?? { status: "saved", id: "x", message: "Saved." });
  const user = userEvent.setup();
  const utils = render(
    <ProjectForm
      action={action}
      initial={options.initial ?? emptyProjectForm(2026)}
      architects={ARCHITECTS}
      countries={COUNTRIES}
      projectId={options.projectId}
    />,
  );
  return { action, user, ...utils };
}

const submitted = (action: ReturnType<typeof setup>["action"]) => action.mock.calls[0]![1];

describe("ProjectForm", () => {
  it("has a label for every field and no accessibility violations", async () => {
    const { container } = setup();

    for (const name of ["Title", "Web address", "Summary", "Type", "Stage", "Year", "City", "Country", "Latitude", "Longitude", "Description", "Search title", "Search description"]) {
      expect(screen.getByLabelText(new RegExp(`^${name}`))).toBeInTheDocument();
    }
    expect((await axe(container)).violations).toEqual([]);
  });

  it("starts a new project as completed in the current year, and offers every country", () => {
    setup();

    expect(screen.getByLabelText(/^Stage/)).toHaveValue("completed");
    expect(screen.getByLabelText(/^Year/)).toHaveValue("2026");
    expect(within(screen.getByLabelText(/^Country/)).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Choose a country",
      "Denmark",
      "Norway",
    ]);
  });

  it("fills in the web address from the title until it is edited by hand", async () => {
    const { user } = setup();
    const slug = screen.getByLabelText(/^Web address/);

    await user.type(screen.getByLabelText(/^Title/), "Café Münchën & Co");
    expect(slug).toHaveValue("cafe-munchen-and-co");

    await user.clear(slug);
    await user.type(slug, "my-own");
    await user.type(screen.getByLabelText(/^Title/), " Extra");
    expect(slug).toHaveValue("my-own");
  });

  it("follows the title again if the web address is cleared", async () => {
    const { user } = setup();
    const slug = screen.getByLabelText(/^Web address/);
    await user.type(slug, "manual");

    await user.clear(slug);
    await user.type(screen.getByLabelText(/^Title/), "Fresh Start");

    expect(slug).toHaveValue("fresh-start");
  });

  it("never rewrites the web address of an existing project when its title changes", async () => {
    const { user } = setup({ projectId: "p1", initial: { ...emptyProjectForm(2026), title: "Old", slug: "old" } });

    await user.type(screen.getByLabelText(/^Title/), " renamed");

    expect(screen.getByLabelText(/^Web address/)).toHaveValue("old");
    expect(screen.getByText(/old address keeps working/)).toBeInTheDocument();
  });

  it("submits every field, the ticked architects with their roles, and no id for a new project", async () => {
    const { user, action } = setup();

    await user.type(screen.getByLabelText(/^Title/), "New Pavilion");
    await user.selectOptions(screen.getByLabelText(/^Type/), "cultural");
    await user.type(screen.getByLabelText(/^City/), "Oslo");
    await user.selectOptions(screen.getByLabelText(/^Country/), "NO");
    await user.click(screen.getByRole("checkbox", { name: "Ben Lindqvist" }));
    await user.type(screen.getByLabelText("Role of Ben Lindqvist"), "Lead architect");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = submitted(action);
    expect(data.get("title")).toBe("New Pavilion");
    expect(data.get("slug")).toBe("new-pavilion");
    expect(data.get("type")).toBe("cultural");
    expect(data.get("countryCode")).toBe("NO");
    expect(data.getAll("architectId")).toEqual([ARCHITECTS[1]!.id]);
    expect(data.get(`role-${ARCHITECTS[1]!.id}`)).toBe("Lead architect");
    expect(data.has("id")).toBe(false);
  });

  it("sends the project id when editing, and says Save changes", async () => {
    const { user, action } = setup({ projectId: "11111111-1111-4111-8111-111111111111" });

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(submitted(action).get("id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("shows a role box only for ticked architects, and drops it when unticked", async () => {
    const { user } = setup();
    const ada = screen.getByRole("checkbox", { name: "Ada Okafor" });
    expect(screen.queryByLabelText("Role of Ada Okafor")).not.toBeInTheDocument();

    await user.click(ada);
    expect(screen.getByLabelText("Role of Ada Okafor")).toBeInTheDocument();

    await user.click(ada);
    expect(screen.queryByLabelText("Role of Ada Okafor")).not.toBeInTheDocument();
  });

  it("starts with the project's own architects ticked and their roles filled in", () => {
    setup({
      projectId: "p1",
      initial: { ...emptyProjectForm(2026), credits: [{ architectId: ARCHITECTS[0]!.id, role: "Landscape" }] },
    });

    expect(screen.getByRole("checkbox", { name: "Ada Okafor" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Ben Lindqvist" })).not.toBeChecked();
    expect(screen.getByLabelText("Role of Ada Okafor")).toHaveValue("Landscape");
  });

  it("explains when there are no architects yet", () => {
    render(
      <ProjectForm action={vi.fn()} initial={emptyProjectForm(2026)} architects={[]} countries={COUNTRIES} />,
    );

    expect(screen.getByText("No architects have been added yet.")).toBeInTheDocument();
  });

  describe("after a failed save", () => {
    const failed: SaveProjectState = {
      status: "error",
      message: "Fix the problems below and save again.",
      errors: { title: "Enter a title.", year: "Enter a year." },
      values: { ...emptyProjectForm(2026), summary: "Typed summary", year: "", city: "Oslo" } as Record<string, unknown>,
    };

    it("lists every problem with a link to its field, and marks those fields invalid", async () => {
      const { user, container } = setup({ result: failed });
      await user.click(screen.getByRole("button", { name: "Create project" }));

      const summary = await screen.findByRole("alert");
      expect(within(summary).getByRole("heading")).toHaveTextContent("There are 2 problems with your submission");
      expect(within(summary).getByRole("link", { name: "Enter a title." })).toHaveAttribute("href", "#field-title");
      expect(within(summary).getByRole("link", { name: "Enter a year." })).toHaveAttribute("href", "#field-year");
      expect(screen.getByLabelText(/^Title/)).toBeInvalid();
      expect(screen.getByLabelText(/^Title/)).toHaveAccessibleDescription(/Enter a title/);
      expect(summary).toHaveFocus();
      expect((await axe(container)).violations).toEqual([]);
    });

    it("keeps what was typed", async () => {
      const { user } = setup({ result: failed });
      await user.type(screen.getByLabelText(/^Summary/), "Typed summary");
      await user.click(screen.getByRole("button", { name: "Create project" }));

      await screen.findByRole("alert");
      expect(screen.getByLabelText(/^Summary/)).toHaveValue("Typed summary");
      expect(screen.getByLabelText(/^City/)).toHaveValue("Oslo");
    });

    it("shows a message with the reasons when the problem belongs to no single field", async () => {
      const { user } = setup({
        result: {
          status: "error",
          message: "This project is published, so these problems must be fixed before saving:",
          errors: {},
          problems: ["Add a summary."],
          values: { ...emptyProjectForm(2026) },
        },
      });
      await user.click(screen.getByRole("button", { name: "Create project" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("published, so these problems");
      expect(within(alert).getByRole("listitem")).toHaveTextContent("Add a summary.");
      await waitFor(() => expect(alert).toHaveFocus());
    });
  });

  it("announces a successful save and moves focus to the message", async () => {
    const { user } = setup({ projectId: "p1", result: { status: "saved", id: "p1", message: '"T" was saved.' } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent('"T" was saved.');
    await waitFor(() => expect(status).toHaveFocus());
  });
});

describe("description editor", () => {
  it("previews the Markdown the way the public page renders it, without raw HTML or images", async () => {
    const { user } = setup();
    await user.type(
      screen.getByLabelText(/^Description/),
      "## Heading{enter}{enter}Some **bold** text <script>alert(1)</script> ![x](https://e.com/a.png)",
    );

    await user.click(screen.getByRole("button", { name: "Preview" }));

    const preview = screen.getByRole("region", { name: "Preview of the description" });
    expect(within(preview).getByRole("heading", { name: "Heading" })).toBeInTheDocument();
    expect(preview.querySelector("strong")).toHaveTextContent("bold");
    expect(preview.querySelector("script")).toBeNull();
    expect(preview.querySelector("img")).toBeNull();
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the text in the form while previewing, and returns to editing", async () => {
    const { user, action } = setup();
    await user.type(screen.getByLabelText(/^Description/), "Kept text");
    await user.click(screen.getByRole("button", { name: "Preview" }));

    await user.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(submitted(action).get("descriptionMd")).toBe("Kept text");

    await user.click(screen.getByRole("button", { name: "Write" }));
    expect(screen.getByLabelText(/^Description/)).toBeVisible();
    expect(screen.queryByRole("region", { name: "Preview of the description" })).not.toBeInTheDocument();
  });

  it("says when there is nothing to preview", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByText("Nothing to preview yet.")).toBeInTheDocument();
  });
});

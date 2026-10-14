import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { DeleteArchitectState, SaveArchitectState } from "@/server/admin/handle-architect";
import type { AdminArchitectRow } from "@/server/queries/admin-architects";
import { ArchitectForm, type SaveArchitectAction } from "./architect-form";
import { ArchitectsTable, type ArchitectsTableAction } from "./architects-table";

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

const EMPTY = { name: "", slug: "", websiteUrl: "", bio: "" };

function setupForm(options: { result?: SaveArchitectState; architectId?: string; initial?: typeof EMPTY } = {}) {
  const action = vi.fn<SaveArchitectAction>(async () => options.result ?? { status: "saved", id: "x", message: "Saved." });
  const user = userEvent.setup();
  const utils = render(<ArchitectForm action={action} initial={options.initial ?? EMPTY} architectId={options.architectId} />);
  return { action, user, ...utils };
}

describe("ArchitectForm", () => {
  it("has labelled fields and no accessibility violations", async () => {
    const { container } = setupForm();

    for (const name of ["Name", "Web address", "Website", "Biography"]) {
      expect(screen.getByLabelText(new RegExp(`^${name}`))).toBeInTheDocument();
    }
    expect((await axe(container)).violations).toEqual([]);
  });

  it("fills in the web address from the name until edited, and never for an existing architect", async () => {
    const { user, unmount } = setupForm();
    await user.type(screen.getByLabelText(/^Name/), "Zoë Álvarez");
    expect(screen.getByLabelText(/^Web address/)).toHaveValue("zoe-alvarez");

    await user.clear(screen.getByLabelText(/^Web address/));
    await user.type(screen.getByLabelText(/^Web address/), "mine");
    await user.type(screen.getByLabelText(/^Name/), " X");
    expect(screen.getByLabelText(/^Web address/)).toHaveValue("mine");
    unmount();

    const existing = setupForm({ architectId: "a1", initial: { ...EMPTY, name: "Old", slug: "old" } });
    await existing.user.type(screen.getByLabelText(/^Name/), " renamed");
    expect(screen.getByLabelText(/^Web address/)).toHaveValue("old");
  });

  it("submits the fields, and the id only when editing", async () => {
    const { user, action } = setupForm({ architectId: "11111111-1111-4111-8111-111111111111" });
    await user.type(screen.getByLabelText(/^Name/), "Ada");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const data = action.mock.calls[0]![1];
    expect(data.get("name")).toBe("Ada");
    expect(data.get("slug")).toBe("");
    expect(data.get("id")).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("lists problems with links to their fields and keeps what was typed", async () => {
    const { user, container } = setupForm({
      result: {
        status: "error",
        message: "Fix the problems below and save again.",
        errors: { name: "Enter a name.", websiteUrl: "Enter a full website address starting with https://" },
        values: { ...EMPTY, bio: "Kept bio", websiteUrl: "nope" },
      },
    });
    await user.click(screen.getByRole("button", { name: "Add architect" }));

    const summary = await screen.findByRole("alert");
    expect(within(summary).getByRole("link", { name: "Enter a name." })).toHaveAttribute("href", "#field-name");
    expect(screen.getByLabelText(/^Name/)).toBeInvalid();
    expect(screen.getByLabelText(/^Biography/)).toHaveValue("Kept bio");
    expect(summary).toHaveFocus();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("announces a successful save", async () => {
    const { user } = setupForm({ architectId: "a1", result: { status: "saved", id: "a1", message: '"Ada" was saved.' } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent('"Ada" was saved.');
    await waitFor(() => expect(status).toHaveFocus());
  });
});

const row = (overrides: Partial<AdminArchitectRow> = {}): AdminArchitectRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  slug: "ada",
  name: "Ada Okafor",
  websiteUrl: "https://ada.example",
  projectCount: 0,
  ...overrides,
});

function setupTable(rows: AdminArchitectRow[], result: DeleteArchitectState = { status: "success", message: "Done." }) {
  const action = vi.fn<ArchitectsTableAction>(async () => result);
  const user = userEvent.setup();
  const utils = render(<ArchitectsTable rows={rows} action={action} />);
  return { action, user, ...utils };
}

describe("ArchitectsTable", () => {
  it("lists architects with website, project count and edit link, without violations", async () => {
    const { container } = setupTable([row(), row({ id: "2", name: "Ben", websiteUrl: null, projectCount: 2 })]);

    expect(screen.getByRole("table", { name: "All architects, by name" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ada\.example/ })).toHaveAttribute("href", "https://ada.example");
    expect(screen.getByRole("link", { name: "Edit Ada Okafor" })).toHaveAttribute(
      "href",
      "/admin/architects/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByText("2 projects")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("says when there are none", () => {
    setupTable([]);

    expect(screen.getByText("No architects yet.")).toBeInTheDocument();
  });

  it("asks before deleting, and Cancel deletes nothing", async () => {
    const { user, action } = setupTable([row()]);

    await user.click(screen.getByRole("button", { name: "Delete Ada Okafor" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this architect?" });
    expect(dialog).toHaveTextContent("permanently removed");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(action).not.toHaveBeenCalled();
  });

  it("deletes after confirmation and announces the outcome", async () => {
    const { user, action } = setupTable([row()], { status: "success", message: '"Ada Okafor" was deleted.' });

    await user.click(screen.getByRole("button", { name: "Delete Ada Okafor" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete architect" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(action.mock.calls[0]![1].get("id")).toBe("11111111-1111-4111-8111-111111111111");
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("was deleted");
    await waitFor(() => expect(status).toHaveFocus());
  });

  it("warns up front when the architect is still credited", async () => {
    const { user } = setupTable([row({ projectCount: 3 })]);

    await user.click(screen.getByRole("button", { name: "Delete Ada Okafor" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("credited on 3 projects");
  });

  it("shows a refusal as an alert", async () => {
    const { user } = setupTable([row({ projectCount: 1 })], {
      status: "error",
      message: "It is credited, so it was not deleted.",
    });

    await user.click(screen.getByRole("button", { name: "Delete Ada Okafor" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete architect" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not deleted");
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { MessageActionState } from "@/server/admin/handle-message-action";
import type { AdminMessage } from "@/server/queries/admin-messages";
import { MessagesList, type MessagesAction } from "./messages-list";

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

const message = (overrides: Partial<AdminMessage> = {}): AdminMessage => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ada Okafor",
  email: "ada@example.com",
  message: "Hello.\nSecond line.",
  createdAt: new Date("2026-03-04T10:30:00Z"),
  handledAt: null,
  ...overrides,
});

const ROWS = [
  message(),
  message({
    id: "22222222-2222-4222-8222-222222222222",
    name: "Ben Lindqvist",
    email: "ben@example.com",
    message: "Older one",
    createdAt: new Date("2026-02-01T08:00:00Z"),
    handledAt: new Date("2026-02-02T08:00:00Z"),
  }),
];

function setup(
  rows = ROWS,
  result: MessageActionState = { status: "success", message: "Done." },
  total = rows.length,
) {
  const action = vi.fn<MessagesAction>(async () => result);
  const user = userEvent.setup();
  const unhandled = rows.filter((row) => row.handledAt === null).length;
  const utils = render(<MessagesList messages={rows} total={total} unhandled={unhandled} action={action} />);
  return { action, user, ...utils };
}

describe("MessagesList", () => {
  it("shows each message with its sender, status in words, date and text, and has no violations", async () => {
    const { container } = setup();

    expect(screen.getByText("2 messages · 1 new")).toBeInTheDocument();
    const first = screen.getByRole("article", { name: "Message from Ada Okafor" });
    expect(within(first).getByText("New")).toBeInTheDocument();
    expect(within(first).getByText("Mar 4, 2026, 10:30 AM UTC")).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: /ada@example\.com/ })).toHaveAttribute(
      "href",
      "mailto:ada@example.com",
    );
    expect(
      within(screen.getByRole("article", { name: "Message from Ben Lindqvist" })).getByText("Handled"),
    ).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("shows the message as plain text: markup is not interpreted and line breaks are kept", () => {
    setup([message({ message: '<img src=x onerror="alert(1)"> <b>bold</b>\nline two' })]);

    const body = screen.getByText(/line two/);
    expect(body.querySelector("img, b, script")).toBeNull();
    expect(body.textContent).toContain('<img src=x onerror="alert(1)"> <b>bold</b>');
    expect(body.className).toContain("whitespace-pre-wrap");
  });

  it("makes a reply link only for a plain address", () => {
    setup([message({ email: 'x"><script>@a.b' }), message({ id: "2", name: "Cy", email: "cy@example.com" })]);

    expect(screen.queryByRole("link", { name: /script/ })).not.toBeInTheDocument();
    expect(screen.getByText('x"><script>@a.b')).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cy@example\.com/ })).toBeInTheDocument();
  });

  it("offers Mark as handled for new messages and Mark as new for handled ones", () => {
    setup();

    expect(screen.getByRole("button", { name: "Mark the message from Ada Okafor as handled" })).toHaveTextContent(
      "Mark as handled",
    );
    expect(screen.getByRole("button", { name: "Mark the message from Ben Lindqvist as new" })).toHaveTextContent(
      "Mark as new",
    );
  });

  it("sends the id and intent, and announces the result with focus", async () => {
    const { user, action } = setup(ROWS, {
      status: "success",
      message: "The message from Ada Okafor is marked as handled.",
    });

    await user.click(screen.getByRole("button", { name: "Mark the message from Ada Okafor as handled" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const data = action.mock.calls[0]![1];
    expect(data.get("id")).toBe(ROWS[0]!.id);
    expect(data.get("intent")).toBe("handled");
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("marked as handled");
    await waitFor(() => expect(status).toHaveFocus());
  });

  it("asks before deleting, and Cancel deletes nothing", async () => {
    const { user, action } = setup();

    await user.click(screen.getByRole("button", { name: "Delete the message from Ada Okafor" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this message?" });
    expect(dialog).toHaveTextContent("The message from Ada Okafor will be permanently removed.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(action).not.toHaveBeenCalled();
  });

  it("deletes after confirmation", async () => {
    const { user, action } = setup();

    await user.click(screen.getByRole("button", { name: "Delete the message from Ben Lindqvist" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete message" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    const data = action.mock.calls[0]![1];
    expect(data.get("intent")).toBe("delete");
    expect(data.get("id")).toBe(ROWS[1]!.id);
  });

  it("shows a failure as an alert", async () => {
    const { user } = setup(ROWS, { status: "error", message: "That message no longer exists." });

    await user.click(screen.getByRole("button", { name: "Mark the message from Ada Okafor as handled" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("no longer exists");
  });

  it("explains an empty inbox, and a truncated list", () => {
    const { unmount } = setup([]);
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
    unmount();

    setup(ROWS, undefined, 450);
    expect(screen.getByText(/450 messages · 1 new · showing the newest 200/)).toBeInTheDocument();
  });
});

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { ContactState } from "@/lib/contact-validation";
import { ContactForm, type ContactAction } from "./contact-form";
import { resetTurnstile } from "./turnstile";

// The real widget loads Cloudflare's script; the tests only need to know it is there and reset.
vi.mock("./turnstile", () => ({
  Turnstile: ({ siteKey }: { siteKey: string }) => <div className="cf-turnstile" data-sitekey={siteKey} />,
  resetTurnstile: vi.fn(),
}));

const SUCCESS: ContactState = { status: "success" };

function setup(result: ContactState = SUCCESS, turnstileSiteKey?: string) {
  const action = vi.fn<ContactAction>(async () => result);
  const view = render(<ContactForm action={action} turnstileSiteKey={turnstileSiteKey} />);
  return { action, ...view };
}

async function fillValid() {
  await userEvent.type(screen.getByLabelText(/Name/), "Ada Lovelace");
  await userEvent.type(screen.getByLabelText(/Email/), "ada@example.com");
  await userEvent.type(screen.getByLabelText(/Message/), "I would like to discuss a project.");
}

const send = () => userEvent.click(screen.getByRole("button", { name: /Send message|Sending/ }));

describe("validation in the browser", () => {
  it("shows an error summary, focuses it and flags each invalid field, without calling the server", async () => {
    const { action } = setup();

    await send();

    const summary = screen.getByRole("alert", { name: /problems with your submission/ });
    expect(summary).toHaveFocus();
    expect(within(summary).getAllByRole("link")).toHaveLength(3);
    for (const label of [/Name/, /Email/, /Message/]) {
      expect(screen.getByLabelText(label)).toBeInvalid();
    }
    expect(action).not.toHaveBeenCalled();
  });

  it("links each summary entry to its field", async () => {
    setup();
    await send();

    const link = screen.getByRole("link", { name: "Enter your name." });

    expect(link).toHaveAttribute("href", "#contact-name");
    expect(screen.getByLabelText(/Name/)).toHaveAttribute("id", "contact-name");
  });

  it("describes an invalid field with its error message", async () => {
    setup();
    await userEvent.type(screen.getByLabelText(/Email/), "nope");
    await send();

    expect(screen.getByLabelText(/Email/)).toHaveAccessibleDescription(/valid email address/);
  });
});

describe("sending", () => {
  it("passes the fields, an empty honeypot and the time spent to the server action", async () => {
    const { action } = setup();
    await fillValid();

    await send();

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0]![1];
    expect(data.get("name")).toBe("Ada Lovelace");
    expect(data.get("email")).toBe("ada@example.com");
    expect(data.get("message")).toBe("I would like to discuss a project.");
    expect(data.get("website")).toBe("");
    expect(Number(data.get("elapsedMs"))).toBeGreaterThanOrEqual(0);
    expect(data.get("elapsedMs")).not.toBe("");
  });

  it("shows a busy, disabled button while the server is working", async () => {
    let finish!: (state: ContactState) => void;
    const action = vi.fn<ContactAction>(() => new Promise<ContactState>((resolve) => (finish = resolve)));
    render(<ContactForm action={action} />);
    await fillValid();

    await send();

    const button = await screen.findByRole("button", { name: "Sending…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    finish(SUCCESS);
    await screen.findByText(/your message is on its way/);
  });

  it("replaces the form with a thank-you message on success", async () => {
    setup(SUCCESS);
    await fillValid();

    await send();

    expect(await screen.findByRole("status")).toHaveTextContent("your message is on its way");
    expect(screen.queryByRole("button", { name: /Send message/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse projects" })).toHaveAttribute("href", "/projects");
  });
});

describe("when the server says no", () => {
  const values = { name: "Ada Lovelace", email: "ada@example.com", message: "I would like to discuss a project." };

  it("shows the message, focuses it, keeps what the visitor typed and asks for a fresh bot check", async () => {
    setup({ status: "error", message: "You have sent several messages already. Please try again in about 30 minutes.", values });
    await fillValid();

    await send();

    const alert = await screen.findByText(/sent several messages already/);
    expect(alert).toHaveAttribute("role", "alert");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText(/Name/)).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText(/Message/)).toHaveValue("I would like to discuss a project.");
    expect(resetTurnstile).toHaveBeenCalled();
  });

  it("shows field errors the server found, such as when the browser check was bypassed", async () => {
    setup({
      status: "error",
      errors: { email: "Enter a valid email address, like name@example.com." },
      values: { ...values, email: "ada@" },
    });
    await fillValid();

    await send();

    expect(await screen.findByRole("link", { name: /valid email address/ })).toHaveAttribute("href", "#contact-email");
    expect(screen.getByLabelText(/Email/)).toBeInvalid();
  });
});

describe("spam protection fields", () => {
  it("has a honeypot that people cannot see, focus or hear", () => {
    setup();

    const honeypot = document.querySelector<HTMLInputElement>('input[name="website"]')!;

    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
  });

  it("shows the Turnstile widget only when a site key is configured", () => {
    const { container, unmount } = setup(SUCCESS, "1x00000000000000000000AA");
    expect(container.querySelector(".cf-turnstile")).toHaveAttribute("data-sitekey", "1x00000000000000000000AA");
    unmount();

    const { container: without } = setup(SUCCESS, undefined);
    expect(without.querySelector(".cf-turnstile")).toBeNull();
  });
});

describe("accessibility", () => {
  it("has no violations as shown, with errors, with a server message and after success", async () => {
    const { container } = setup({ status: "error", message: "Something went wrong.", values: { name: "", email: "", message: "" } });
    expect((await axe(container)).violations).toEqual([]);

    await send();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("has no violations on the success message", async () => {
    const { container } = setup(SUCCESS);
    await fillValid();
    await send();
    await screen.findByRole("status");

    expect((await axe(container)).violations).toEqual([]);
  });
});

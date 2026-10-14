import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { ContactForm } from "./contact-form";

async function fillValid() {
  await userEvent.type(screen.getByLabelText(/Name/), "Ada Lovelace");
  await userEvent.type(screen.getByLabelText(/Email/), "ada@example.com");
  await userEvent.type(screen.getByLabelText(/Message/), "I would like to discuss a project.");
}

describe("ContactForm", () => {
  it("shows an error summary, focuses it and flags each invalid field", async () => {
    render(<ContactForm />);

    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    const summary = screen.getByRole("alert");
    expect(summary).toHaveFocus();
    expect(within(summary).getAllByRole("link")).toHaveLength(3);
    for (const label of [/Name/, /Email/, /Message/]) {
      expect(screen.getByLabelText(label)).toBeInvalid();
    }
  });

  it("links each summary entry to its field", async () => {
    render(<ContactForm />);
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    const link = screen.getByRole("link", { name: "Enter your name." });

    expect(link).toHaveAttribute("href", "#contact-name");
    expect(screen.getByLabelText(/Name/)).toHaveAttribute("id", "contact-name");
  });

  it("describes an invalid field with its error message", async () => {
    render(<ContactForm />);
    await userEvent.type(screen.getByLabelText(/Email/), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(screen.getByLabelText(/Email/)).toHaveAccessibleDescription(/valid email address/);
  });

  it("clears errors once the input is valid", async () => {
    render(<ContactForm />);
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    await fillValid();
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeValid();
  });

  it("has no accessibility violations with and without errors", async () => {
    const { container } = render(<ContactForm />);
    expect((await axe(container)).violations).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect((await axe(container)).violations).toEqual([]);
  });
});

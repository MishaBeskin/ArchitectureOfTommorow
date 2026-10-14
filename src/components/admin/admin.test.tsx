import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { LoginState } from "@/server/auth/login";
import { AdminShell } from "./admin-shell";
import { LoginForm, type LoginAction } from "./login-form";

function setupLogin(result: LoginState = { status: "idle" }, next = "") {
  const action = vi.fn<LoginAction>(async () => result);
  const view = render(<LoginForm action={action} next={next} />);
  return { action, ...view };
}

async function fillAndSubmit(password = "a password") {
  await userEvent.type(screen.getByLabelText(/Email/), "owner@example.com");
  await userEvent.type(screen.getByLabelText(/Password/), password);
  await userEvent.click(screen.getByRole("button", { name: /Sign in|Signing in/ }));
}

describe("LoginForm", () => {
  it("has labelled email and password fields with the right autocomplete hints for password managers", () => {
    setupLogin();

    expect(screen.getByLabelText(/Email/)).toHaveAttribute("type", "email");
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText(/Password/)).toHaveAttribute("type", "password");
    expect(screen.getByLabelText(/Password/)).toHaveAttribute("autocomplete", "current-password");
  });

  it("sends the credentials and the return-to path to the action", async () => {
    const { action } = setupLogin({ status: "idle" }, "/admin/projects");

    await fillAndSubmit("hunter2");

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const data = action.mock.calls[0]![1];
    expect(data.get("email")).toBe("owner@example.com");
    expect(data.get("password")).toBe("hunter2");
    expect(data.get("next")).toBe("/admin/projects");
  });

  it("shows the error, focuses it, keeps the email and never puts the password back", async () => {
    setupLogin({ status: "error", message: "The email or password is incorrect.", email: "owner@example.com" });

    await fillAndSubmit("wrong");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The email or password is incorrect.");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByLabelText(/Email/)).toHaveValue("owner@example.com");
    expect(screen.getByLabelText(/Password/)).toHaveValue("");
  });

  it("shows a busy, disabled button while signing in", async () => {
    let finish!: (state: LoginState) => void;
    const action = vi.fn<LoginAction>(() => new Promise<LoginState>((resolve) => (finish = resolve)));
    render(<LoginForm action={action} next="" />);

    await fillAndSubmit();

    const button = await screen.findByRole("button", { name: "Signing in…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    finish({ status: "idle" });
    await screen.findByRole("button", { name: "Sign in" });
  });

  it("has no accessibility violations, idle or showing an error", async () => {
    const { container } = setupLogin({ status: "error", message: "The email or password is incorrect.", email: "a@b.co" });
    expect((await axe(container)).violations).toEqual([]);

    await fillAndSubmit();
    await screen.findByRole("alert");
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("AdminShell", () => {
  const logout = vi.fn(async () => {});

  it("shows who is signed in and has navigation, a skip link and a main landmark", () => {
    render(
      <AdminShell email="owner@example.com" logout={logout}>
        <h1>Projects</h1>
      </AdminShell>,
    );

    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "/admin/projects");
    expect(screen.getByRole("link", { name: "View site" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
  });

  it("signs out through the server action when the button is used", async () => {
    render(
      <AdminShell email="owner@example.com" logout={logout}>
        <p>content</p>
      </AdminShell>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <AdminShell email="owner@example.com" logout={logout}>
        <h1>Projects</h1>
      </AdminShell>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});

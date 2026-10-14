import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

afterEach(() => {
  pathname.current = "/";
});

describe("NavLinks", () => {
  it("marks the current page with aria-current", () => {
    pathname.current = "/about";
    render(<NavLinks />);

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the section current on nested routes", () => {
    pathname.current = "/projects/the-vertical-forest";
    render(<NavLinks />);

    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
  });

  it("does not match a different route that merely shares a prefix", () => {
    pathname.current = "/projects-archive";
    render(<NavLinks />);

    expect(screen.getByRole("link", { name: "Projects" })).not.toHaveAttribute("aria-current");
  });
});

describe("MobileNav", () => {
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

  it("opens the menu and reflects it in aria-expanded", async () => {
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: "Menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Main menu" })).toBeVisible();
  });

  it("closes from the Close button and from choosing a link", async () => {
    render(<MobileNav />);
    const trigger = screen.getByRole("button", { name: "Menu" });

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("link", { name: "Contact" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("has no accessibility violations when open", async () => {
    const { container } = render(<MobileNav />);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect((await axe(container)).violations).toEqual([]);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Button } from "./button";
import { buttonStyles } from "./button-styles";

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("calls onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and aria-busy while loading, and does not fire onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving…
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving…" });

    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("has no accessibility violations in any variant", async () => {
    const { container } = render(
      <div>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
      </div>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});

describe("buttonStyles", () => {
  it("keeps the 44px minimum target size and merges a custom class", () => {
    const classes = buttonStyles({ className: "w-full" });

    expect(classes).toContain("min-h-11");
    expect(classes).toContain("w-full");
  });
});

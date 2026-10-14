import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { describe, expect, it, vi } from "vitest";

// Smoke test: proves jsdom, RTL, jest-dom matchers, user-event and axe are wired up.
describe("test harness", () => {
  it("renders, queries by role and handles user events", async () => {
    const onClick = vi.fn();
    render(<button onClick={onClick}>Open gallery</button>);

    await userEvent.click(screen.getByRole("button", { name: "Open gallery" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("button")).toBeVisible();
  });

  it("runs axe against rendered markup", async () => {
    const { container } = render(
      <main>
        <h1>Projects</h1>
        <label htmlFor="year">Year</label>
        <input id="year" />
      </main>,
    );

    const results = await axe(container);

    expect(results.violations).toEqual([]);
  });
});

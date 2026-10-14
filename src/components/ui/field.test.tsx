import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { Checkbox } from "./checkbox";
import { Input, Select, Textarea } from "./controls";
import { Field } from "./field";

describe("Field", () => {
  it("links the label to the control", () => {
    render(<Field label="Title">{(c) => <Input name="title" {...c} />}</Field>);

    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("describes the control with its hint and error and marks it invalid", () => {
    render(
      <Field label="Year" hint="Year of completion" error="Enter a year after 1900">
        {(c) => <Input name="year" {...c} />}
      </Field>,
    );

    const input = screen.getByLabelText("Year");

    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("Year of completion Enter a year after 1900");
  });

  it("does not mark a valid field invalid or describe it", () => {
    render(<Field label="City">{(c) => <Input name="city" {...c} />}</Field>);

    const input = screen.getByLabelText("City");

    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("marks required controls natively and hides the asterisk from assistive tech", () => {
    render(
      <Field label="Name" required>
        {(c) => <Input name="name" {...c} />}
      </Field>,
    );

    expect(screen.getByLabelText(/Name/)).toBeRequired();
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("has no accessibility violations for a full form, with and without errors", async () => {
    const { container } = render(
      <form>
        <Field label="Title" required error="Title is required">
          {(c) => <Input name="title" {...c} />}
        </Field>
        <Field label="Description" hint="Markdown supported">
          {(c) => <Textarea name="description" {...c} />}
        </Field>
        <Field label="Type">
          {(c) => (
            <Select name="type" {...c}>
              <option value="residential">Residential</option>
              <option value="cultural">Cultural</option>
            </Select>
          )}
        </Field>
        <Checkbox name="featured" label="Featured on home page" />
      </form>,
    );

    expect((await axe(container)).violations).toEqual([]);
  });
});

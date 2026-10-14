import { describe, expect, it } from "vitest";
import { CONTACT_LIMITS, validateContact } from "./contact-validation";

const valid = { name: "Ada Lovelace", email: "ada@example.com", message: "I would like to discuss a project." };

describe("validateContact", () => {
  it("accepts valid input", () => {
    expect(validateContact(valid)).toEqual({});
  });

  it("requires every field and treats whitespace as empty", () => {
    const errors = validateContact({ name: "   ", email: "", message: "\n\t" });

    expect(Object.keys(errors).sort()).toEqual(["email", "message", "name"]);
  });

  it.each(["plainaddress", "missing@tld", "two@@example.com", "spaces in@example.com"])(
    "rejects invalid email %s",
    (email) => {
      expect(validateContact({ ...valid, email }).email).toMatch(/valid email/);
    },
  );

  it("enforces message length bounds", () => {
    expect(validateContact({ ...valid, message: "too short" }).message).toMatch(/at least/);
    expect(validateContact({ ...valid, message: "x".repeat(CONTACT_LIMITS.message + 1) }).message).toMatch(
      /or fewer/,
    );
    expect(validateContact({ ...valid, message: "x".repeat(CONTACT_LIMITS.message) })).toEqual({});
  });

  it("rejects an over-long name", () => {
    expect(validateContact({ ...valid, name: "n".repeat(CONTACT_LIMITS.name + 1) }).name).toMatch(/or fewer/);
  });
});

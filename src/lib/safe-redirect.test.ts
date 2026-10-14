import { describe, expect, it } from "vitest";
import { DEFAULT_ADMIN_PATH, safeAdminRedirect } from "./safe-redirect";

describe("safeAdminRedirect", () => {
  it.each(["/admin", "/admin/projects", "/admin/projects/new", "/admin/projects/3f2a-91/edit", "/admin/architects"])(
    "lets the plain admin path %s through unchanged",
    (path) => {
      expect(safeAdminRedirect(path)).toBe(path);
    },
  );

  it("falls back to the default when there is nothing to return to", () => {
    for (const value of [null, undefined, "", "   "]) expect(safeAdminRedirect(value)).toBe(DEFAULT_ADMIN_PATH);
  });

  it("trims surrounding whitespace", () => {
    expect(safeAdminRedirect("  /admin/projects  ")).toBe("/admin/projects");
  });

  it.each([
    ["a protocol-relative URL", "//evil.example"],
    ["a protocol-relative URL under /admin", "/admin//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a backslash inside the path", "/admin\\evil"],
    ["an absolute https URL", "https://evil.example/admin"],
    ["an absolute http URL to the same path", "http://localhost/admin"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html,<script>alert(1)</script>"],
    ["a path outside /admin", "/projects"],
    ["a longer word that merely starts with admin", "/administrator"],
    ["upper case, which is a different path", "/ADMIN/projects"],
    ["parent-directory traversal", "/admin/../projects"],
    ["encoded parent-directory traversal", "/admin/%2e%2e/projects"],
    ["encoded slashes that form //", "/admin/%2F%2Fevil.example"],
    ["an encoded leading slash", "%2F%2Fevil.example"],
    ["a query string", "/admin/projects?next=//evil.example"],
    ["a fragment", "/admin/projects#//evil"],
    ["an embedded newline", "/admin/pro\njects"],
    ["an encoded CRLF", "/admin/projects%0d%0aLocation:%20https://evil.example"],
    ["a malformed percent sequence", "/admin/%E0%A4%A"],
  ])("rejects %s", (_name, value) => {
    expect(safeAdminRedirect(value)).toBe(DEFAULT_ADMIN_PATH);
  });

  it("never sends the admin back to the sign-in page, which would loop", () => {
    for (const value of ["/admin/login", "/admin/login/", "/admin/login/extra", "/admin/%6Cogin"]) {
      expect(safeAdminRedirect(value), value).toBe(DEFAULT_ADMIN_PATH);
    }
  });

  it("only ever returns the default or a path that starts with /admin", () => {
    const attempts = ["//a", "/\\a", "https://a", "/admin/x", "/admin", "javascript:1", "/", "", "/admin/../x"];

    for (const attempt of attempts) {
      const result = safeAdminRedirect(attempt);
      expect(result.startsWith("/admin")).toBe(true);
      expect(result.startsWith("//")).toBe(false);
    }
  });
});

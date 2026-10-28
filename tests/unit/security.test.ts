import { describe, expect, it } from "vitest";
import { defaultDataDir } from "@/lib/config/env";
import { redact } from "@/lib/logger";
import { isSameOriginRequest } from "@/lib/security/origin";

const req = (method: string, headers: Record<string, string>) =>
  new Request("http://127.0.0.1:3001/api/v1/profile", { method, headers: { host: "127.0.0.1:3001", ...headers } });

describe("same-origin enforcement", () => {
  it("allows safe methods", () => {
    expect(isSameOriginRequest(req("GET", {}))).toBe(true);
  });

  it("allows same-origin mutations", () => {
    expect(isSameOriginRequest(req("POST", { origin: "http://127.0.0.1:3001" }))).toBe(true);
    expect(isSameOriginRequest(req("PATCH", { "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("rejects cross-site or origin-less mutations", () => {
    expect(isSameOriginRequest(req("POST", { origin: "https://evil.example" }))).toBe(false);
    expect(isSameOriginRequest(req("POST", { "sec-fetch-site": "cross-site", origin: "http://127.0.0.1:3001" }))).toBe(
      false,
    );
    expect(isSameOriginRequest(req("DELETE", {}))).toBe(false);
    expect(isSameOriginRequest(req("POST", { origin: "null" }))).toBe(false);
  });
});

describe("log redaction", () => {
  it("removes secrets at any depth", () => {
    expect(
      redact({
        email: "a@b.c",
        password: "x",
        nested: { sessionToken: "t", apiKey: "k", ok: 1 },
        list: [{ secret: 1 }],
      }),
    ).toEqual({
      email: "a@b.c",
      password: "[redacted]",
      nested: { sessionToken: "[redacted]", apiKey: "[redacted]", ok: 1 },
      list: [{ secret: "[redacted]" }],
    });
  });
});

describe("default data directory", () => {
  it("uses Application Support on macOS", () => {
    expect(defaultDataDir("darwin", "/Users/me")).toBe("/Users/me/Library/Application Support/CareerOS");
    expect(defaultDataDir("linux", "/home/me")).toBe("/home/me/.local/share/careeros");
  });
});
